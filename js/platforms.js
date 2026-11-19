// platforms.js - which platform and direction a ride leaves from. Pure, no DOM.
//
// Platform numbers come from data (station.platforms), only where a source
// confirmed them. Each entry says which station comes next from that
// platform, so a ride is matched by its first two stations. When a station
// has no confirmed platforms we still give the direction ("towards Kheha"),
// worked out from the line's end stations.

/**
 * Direction and platform for a ride leg.
 * Returns { platform: {no, towards, via?, next} | null, towards: id, via: id | null }.
 */
export function legDirection(graph, leg) {
  const [a, b] = leg.stations;
  const st = graph.stations.get(a);
  const platform = (st.platforms || []).find((p) => p.next === b) || null;
  if (platform) return { platform, towards: platform.towards, via: platform.via || null };
  const dir = terminusOf(graph, leg.line, a, b);
  return { platform: null, towards: dir.towards, via: dir.via };
}

/**
 * The station a train is heading for, travelling a -> b on a line.
 *
 * Ordinary lines: the end of the path in the direction of travel.
 * Blue Line: trains run as one long line, Tha Phra -> Bang Sue ->
 * Hua Lamphong -> Tha Phra -> Lak Song, and back. So the ends are Tha Phra
 * and Lak Song, and we add "via Bang Sue" when the train passes Bang Sue on
 * the way (as the station signs do).
 */
export function terminusOf(graph, lineId, a, b) {
  for (const seq of serviceOrder(graph.lines.get(lineId))) {
    for (let i = 0; i + 1 < seq.length; i++) {
      let ahead = null;
      if (seq[i] === a && seq[i + 1] === b) ahead = seq.slice(i + 1);
      else if (seq[i] === b && seq[i + 1] === a) ahead = seq.slice(0, i + 1).reverse();
      if (!ahead) continue;
      const end = ahead[ahead.length - 1];
      let via = null;
      if (lineId === 'blue') via = ahead.slice(0, -1).find((id) => graph.stations.get(id).name_en === 'Bang Sue') || null;
      return { towards: end, via };
    }
  }
  return { towards: b, via: null };
}

/** Station order as trains run. Blue joins its loop and its Lak Song branch. */
export function serviceOrder(line) {
  if (line.id === 'blue') {
    const loop = line.paths.find((p) => p[0] === p[p.length - 1]);
    const branch = line.paths.find((p) => p[0] !== p[p.length - 1]);
    if (loop && branch && branch[0] === loop[0]) return [[...loop, ...branch.slice(1)]];
  }
  return line.paths;
}

/** Platforms of one station node, sorted by number, for the station page. */
export function stationPlatforms(st) {
  return [...(st.platforms || [])].sort((x, y) => String(x.no).localeCompare(String(y.no), 'en', { numeric: true }));
}
