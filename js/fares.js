// fares.js - works out the fare for a route. Pure functions, no DOM.
//
// Each operator charges separately, so a route is split into "fare
// journeys": consecutive rides on the same fare system joined by an
// in-station change (e.g. BTS Sukhumvit -> Silom at Siam, MRT Blue ->
// Purple at Tao Poon). A journey is priced from the station where you tap
// in to the station where you tap out.
//
// Every fare comes back with a status:
//   'official' - read from an operator's published table or rule
//   'checked'  - a fare someone checked at a ticket machine (fare-checks.json)
//   'estimate' - our best guess; the UI shows it as "about X THB"
//
// Passenger types: adult, student, senior.

export const PASSENGERS = ['adult', 'student', 'senior'];

/**
 * Split a list of legs into fare journeys.
 * Returns [{ system, rides: [leg...] }].
 */
export function fareJourneys(graph, legs) {
  const journeys = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.type !== 'ride') continue;
    const system = graph.lines.get(leg.line).fareSystem;
    const prev = journeys[journeys.length - 1];
    const between = legs[i - 1];
    // Same fare system, and the only thing in between is an in-station change.
    const joined = prev && prev.system === system && prev.endIndex === i - 2 &&
      between?.type === 'walk' && between.interchange === 'same';
    if (joined) {
      prev.rides.push(leg);
      prev.endIndex = i;
    } else {
      journeys.push({ system, rides: [leg], endIndex: i });
    }
  }
  return journeys.map(({ system, rides }) => ({
    system,
    rides,
    from: rides[0].stations[0],
    to: rides[rides.length - 1].stations[rides[rides.length - 1].stations.length - 1],
  }));
}

/**
 * Price a whole route for all three passenger types.
 * `checks` is the list from data/fare-checks.json (optional).
 */
export function priceRoute(data, graph, legs, checks = []) {
  const systems = data.fares.systems;
  const parts = fareJourneys(graph, legs).map((j) => {
    const rule = systems[j.system];
    const fares = {};
    for (const type of PASSENGERS) fares[type] = priceJourney(rule, j, type, graph);
    const check = findCheck(checks, j.system, j.from, j.to, graph);
    if (check) fares.adult = { amount: check.adult, status: 'checked', checked_on: check.checked_on };
    return {
      system: j.system,
      name_en: rule.name_en,
      name_th: rule.name_th,
      from: j.from,
      to: j.to,
      lines: [...new Set(j.rides.map((r) => r.line))],
      fares,
      child: rule.child || null,
    };
  });

  const totals = {};
  for (const type of PASSENGERS) {
    const amount = parts.reduce((sum, p) => sum + p.fares[type].amount, 0);
    const exact = parts.every((p) => p.fares[type].status !== 'estimate');
    totals[type] = { amount, exact };
  }

  const usedLines = new Set(legs.filter((l) => l.type === 'ride').map((l) => l.line));
  const cap = data.fares.dailyCap;
  const capApplies = cap && cap.lines.some((l) => usedLines.has(l));

  return { parts, totals, dailyCap: capApplies ? cap : null };
}

/**
 * A checked fare matches a journey in either direction (every official
 * Bangkok fare table we have is the same both ways).
 */
export function findCheck(checks, system, from, to, graph) {
  const ids = (id) => {
    const st = graph.stations.get(id);
    return st ? [st.id, st.code] : [id];
  };
  const a = ids(from);
  const b = ids(to);
  return checks.find((c) => c.operator === system &&
    ((a.includes(c.from) && b.includes(c.to)) || (b.includes(c.from) && a.includes(c.to)))) || null;
}

const hops = (ride) => ride.stations.length - 1;
const totalHops = (rides) => rides.reduce((s, r) => s + hops(r), 0);
const halfUp = (n) => Math.ceil(n / 2);

/**
 * Price one journey for one passenger type.
 * Returns { amount, status }.
 */
export function priceJourney(rule, journey, type, graph) {
  const status = (rule.status && rule.status[type]) || 'estimate';

  switch (rule.model) {
    case 'matrix': {
      // Look the fare up in the operator's station-to-station table.
      const t = rule.tables;
      const i = t.index[journey.from];
      const j = t.index[journey.to];
      const table = t[type];
      if (i !== undefined && j !== undefined && table) return { amount: table[i][j], status };
      // No table for this passenger type: fall back to the adult fare, as an estimate.
      if (i !== undefined && j !== undefined) return { amount: t.adult[i][j], status: 'estimate' };
      return { amount: rule.fallbackMax, status: 'estimate' };
    }

    case 'mrt': {
      // Blue Line: fare by number of stations travelled.
      // Purple Line: station-to-station table.
      // A journey using both (change at Tao Poon) is an estimate: we add the
      // two parts and take off one entry fare.
      const blue = journey.rides.filter((r) => r.line === 'blue');
      const purple = journey.rides.filter((r) => r.line === 'purple');
      let adult;
      let exact = true;
      if (blue.length && !purple.length) {
        adult = rule.blue.byStations[Math.min(Math.max(totalHops(blue), 1), rule.blue.byStations.length) - 1];
      } else if (purple.length && !blue.length) {
        const t = rule.purple;
        adult = t.adult[t.index[journey.from]][t.index[journey.to]];
      } else {
        const b = rule.blue.byStations[Math.min(Math.max(totalHops(blue), 1), rule.blue.byStations.length) - 1];
        const pr = purple[0];
        const t = rule.purple;
        const ends = [pr.stations[0], pr.stations[pr.stations.length - 1]];
        const p = t.adult[t.index[ends[0]]][t.index[ends[1]]];
        adult = b + p - rule.transferEntryCredit;
        exact = false;
      }
      if (type === 'senior') return { amount: halfUp(adult), status: exact ? status : 'estimate' };
      if (type === 'student') return { amount: adult, status: 'estimate' };
      return { amount: adult, status: exact ? status : 'estimate' };
    }

    case 'flat':
      return { amount: rule.flat[type] ?? rule.flat.adult, status };

    case 'linear': {
      const n = Math.max(totalHops(journey.rides), 1);
      const adult = Math.min(rule.max, Math.round(rule.base + rule.perStation * (n - 1)));
      if (type === 'senior' && rule.seniorRule === 'half-up') return { amount: halfUp(adult), status };
      return { amount: adult, status };
    }

    case 'table': {
      const n = Math.max(totalHops(journey.rides), 1);
      return { amount: rule.table[Math.min(n, rule.table.length) - 1], status };
    }

    default:
      throw new Error(`Unknown fare model ${rule.model}`);
  }
}
