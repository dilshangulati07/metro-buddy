// route.js - finds routes through the Bangkok rail network with Dijkstra's
// algorithm. Pure functions only: no DOM, no fetch. Used by the app and by
// the tests in tests/run.mjs.
//
// HOW THE NETWORK IS MODELLED
// ---------------------------
// Every station *on a line* is one node. Siam is two nodes (one on the
// Sukhumvit Line, one on the Silom Line) because changing between them
// costs time. A "place" is what a person picks in the UI (for example
// "Siam"); it groups all nodes that share a name.
//
// Edges (one-way arrows between nodes, each with a cost in minutes):
//   ride      next station along the same line   cost = running minutes
//   transfer  change to another line             cost = walk + average wait
//
// We also add two pretend nodes so a trip can start and end at a *place*:
//   START -> every node of the origin place          cost = wait for that line
//   START -> nodes one short walk away from origin   cost = walk + wait
//   every node of the destination place -> END       cost = 0
//   nodes one short walk away from destination -> END cost = walk
// That lets "Asok to Si Lom" begin by walking to MRT Sukhumvit if that is
// faster, without charging a phantom wait at the BTS platform first.

export const START = '__start';
export const END = '__end';

// How much a change of line "costs" in fewest-changes mode. It is far
// bigger than any real trip time, so the search first minimises the number
// of changes and only then the minutes.
const CHANGE_PENALTY = 10000;

/**
 * Build the graph once from data/transit.json.
 * Returns lookups the other functions need.
 */
export function buildGraph(data) {
  const stations = new Map(data.stations.map((s) => [s.id, s]));
  const lines = new Map(data.lines.map((l) => [l.id, l]));
  const places = new Map(data.places.map((p) => [p.id, p]));
  const adjacency = new Map(data.stations.map((s) => [s.id, []]));

  // Ride edges go both ways along each segment of track.
  for (const seg of data.segments) {
    adjacency.get(seg.from).push({ to: seg.to, minutes: seg.minutes, kind: 'ride', line: seg.line });
    adjacency.get(seg.to).push({ to: seg.from, minutes: seg.minutes, kind: 'ride', line: seg.line });
  }

  // Transfer edges come from each station's interchange list (already
  // listed in both directions in the data).
  for (const st of data.stations) {
    for (const ic of st.interchanges) {
      adjacency.get(st.id).push({ to: ic.to, walk: ic.minutes, kind: 'transfer', interchange: ic.kind, note: ic.note });
    }
  }

  return { stations, lines, places, adjacency };
}

/**
 * A tiny binary min-heap so we can always take the cheapest unexplored
 * node next. (A plain array + sort would also work but gets slow.)
 */
class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].cost <= a[i].cost) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < a.length && a[l].cost < a[smallest].cost) smallest = l;
        if (r < a.length && a[r].cost < a[smallest].cost) smallest = r;
        if (smallest === i) break;
        [a[smallest], a[i]] = [a[i], a[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * List the edges leaving `nodeId`, including the pretend START/END edges.
 * `ctx` holds the origin/destination node sets for this search.
 */
function edgesFrom(graph, nodeId, ctx) {
  const out = [];

  if (nodeId === START) {
    for (const id of ctx.fromNodes) {
      // Board directly at the origin place.
      out.push({ to: id, minutes: lineWait(graph, id), kind: 'board' });
      // Or walk to a nearby station first (e.g. Asok -> MRT Sukhumvit).
      for (const e of graph.adjacency.get(id)) {
        if (e.kind === 'transfer' && !ctx.fromNodes.has(e.to)) {
          out.push({ to: e.to, minutes: e.walk + lineWait(graph, e.to), kind: 'walk-start', walk: e.walk, from: id, note: e.note });
        }
      }
    }
    return out;
  }

  for (const e of graph.adjacency.get(nodeId)) {
    if (e.kind === 'ride') {
      out.push(e);
    } else {
      // Changing lines = walk to the other platform + wait for that train.
      out.push({ ...e, minutes: e.walk + lineWait(graph, e.to) });
      // If that other node is the destination we can simply walk out to
      // the street there, no waiting for a train.
      if (ctx.toNodes.has(e.to) && !ctx.toNodes.has(nodeId)) {
        out.push({ to: END, minutes: e.walk, kind: 'walk-end', walk: e.walk, from: nodeId, arrive: e.to, note: e.note });
      }
    }
  }
  // Arrived: any node of the destination place connects to END for free.
  if (ctx.toNodes.has(nodeId)) out.push({ to: END, minutes: 0, kind: 'arrive' });
  return out;
}

function lineWait(graph, stationId) {
  return graph.lines.get(graph.stations.get(stationId).line).waitMinutes;
}

/**
 * Dijkstra's algorithm, step by step:
 *
 * 1. Give every node a "best known cost" of Infinity, except START = 0.
 * 2. Put START in a priority queue (cheapest first).
 * 3. Repeatedly take the cheapest node out of the queue. Because every edge
 *    cost is >= 0, nothing found later can be cheaper, so that node is now
 *    final ("settled").
 * 4. For each edge leaving it, see if going through this node is a cheaper
 *    way to reach the neighbour. If so, remember the new cost and *which
 *    edge we came by* (so we can rebuild the path) and queue the neighbour.
 * 5. Stop when END is settled. Walk the "came by" links backwards from END
 *    to START to get the route.
 *
 * `mode` changes only how an edge is scored:
 *   'fastest' -> cost = minutes
 *   'fewest'  -> cost = minutes + CHANGE_PENALTY for each change of line
 */
export function dijkstra(graph, fromNodes, toNodes, mode = 'fastest') {
  const ctx = { fromNodes: new Set(fromNodes), toNodes: new Set(toNodes) };
  const best = new Map([[START, 0]]); // step 1
  const cameBy = new Map(); // node -> { prev, edge }
  const settled = new Set();
  const queue = new MinHeap();
  queue.push({ node: START, cost: 0 }); // step 2

  while (queue.size > 0) {
    const { node, cost } = queue.pop(); // step 3
    if (settled.has(node)) continue; // an older, more expensive copy
    settled.add(node);
    if (node === END) break; // step 5

    for (const edge of edgesFrom(graph, node, ctx)) { // step 4
      if (settled.has(edge.to)) continue;
      const penalty = mode === 'fewest' && edge.kind === 'transfer' ? CHANGE_PENALTY : 0;
      const newCost = cost + edge.minutes + penalty;
      if (newCost < (best.get(edge.to) ?? Infinity)) {
        best.set(edge.to, newCost);
        cameBy.set(edge.to, { prev: node, edge });
        queue.push({ node: edge.to, cost: newCost });
      }
    }
  }

  if (!cameBy.has(END)) return null;

  // Rebuild the list of edges from START to END.
  const edges = [];
  for (let n = END; n !== START; n = cameBy.get(n).prev) {
    edges.push({ ...cameBy.get(n).edge, from: cameBy.get(n).edge.from ?? cameBy.get(n).prev });
  }
  return edges.reverse();
}

/**
 * Turn the raw edge list into human-sized legs:
 *   { type: 'ride', line, stations: [ids...], minutes, wait }
 *   { type: 'walk', from, to, minutes, note, change: boolean }
 */
export function edgesToLegs(graph, edges) {
  const legs = [];
  let pendingWait = 0;
  for (const e of edges) {
    if (e.kind === 'board') {
      pendingWait = e.minutes;
    } else if (e.kind === 'walk-start') {
      legs.push({ type: 'walk', from: e.from, to: e.to, minutes: e.walk, note: e.note, change: false });
      pendingWait = e.minutes - e.walk;
    } else if (e.kind === 'ride') {
      const last = legs[legs.length - 1];
      if (last && last.type === 'ride' && last.line === e.line) {
        last.stations.push(e.to);
        last.minutes += e.minutes;
      } else {
        legs.push({ type: 'ride', line: e.line, stations: [e.from, e.to], minutes: e.minutes, wait: pendingWait });
      }
      pendingWait = 0;
    } else if (e.kind === 'transfer') {
      legs.push({ type: 'walk', from: e.from, to: e.to, minutes: e.walk, note: e.note, change: true, interchange: e.interchange });
      pendingWait = e.minutes - e.walk;
    } else if (e.kind === 'walk-end') {
      legs.push({ type: 'walk', from: e.from, to: e.arrive, minutes: e.walk, note: e.note, change: false });
    }
  }
  // A transfer straight after boarding/arriving with no ride in between
  // (can happen inside one place) is noise; drop walk legs that change
  // between two nodes of the same place without riding.
  return legs.filter((leg, i) => {
    if (leg.type !== 'walk') return true;
    const sameName = graph.stations.get(leg.from).place === graph.stations.get(leg.to).place;
    const touchesRide = legs[i - 1]?.type === 'ride' && legs[i + 1]?.type === 'ride';
    return !sameName || touchesRide;
  });
}

/** Summarise a list of legs: totals used by the UI and tests. */
export function summarise(graph, legs) {
  let minutes = 0;
  let stops = 0;
  let changes = 0;
  for (const leg of legs) {
    if (leg.type === 'ride') {
      minutes += leg.minutes + leg.wait;
      stops += leg.stations.length - 1;
    } else {
      minutes += leg.minutes;
      if (leg.change) changes += 1;
    }
  }
  const rides = legs.filter((l) => l.type === 'ride');
  return {
    legs,
    minutes: Math.round(minutes),
    stops,
    changes,
    lines: rides.map((l) => l.line),
    // A stable key so we can tell whether two routes are really the same.
    key: rides.map((l) => `${l.line}:${l.stations[0]}>${l.stations[l.stations.length - 1]}`).join('|'),
  };
}

/**
 * Main entry: route between two places (ids like "mo-chit", "siam").
 * Returns { fastest, fewest } where `fewest` is null when it is the same
 * route as `fastest`. Returns null if either place is unknown or no route.
 */
export function findRoutes(graph, fromPlaceId, toPlaceId) {
  const from = graph.places.get(fromPlaceId);
  const to = graph.places.get(toPlaceId);
  if (!from || !to) return null;
  if (from.id === to.id) return { same: true, fastest: null, fewest: null };

  const fastestEdges = dijkstra(graph, from.stations, to.stations, 'fastest');
  if (!fastestEdges) return null;
  const fastest = summarise(graph, edgesToLegs(graph, fastestEdges));

  const fewestEdges = dijkstra(graph, from.stations, to.stations, 'fewest');
  const fewest = fewestEdges ? summarise(graph, edgesToLegs(graph, fewestEdges)) : null;

  const different = fewest && fewest.key !== fastest.key && fewest.changes < fastest.changes;
  return { same: false, fastest, fewest: different ? fewest : null };
}
