// Route, fare and platform tests. Run: node tests/run.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph, findRoutes } from '../js/route.js';
import { priceRoute, PASSENGERS } from '../js/fares.js';
import { legDirection } from '../js/platforms.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data', 'transit.json'), 'utf8'));
const checks = JSON.parse(readFileSync(join(root, 'data', 'fare-checks.json'), 'utf8')).checks;
const graph = buildGraph(data);

let failed = 0;
let passed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed += 1; console.log(`  ok   ${name}`); }
  else { failed += 1; console.log(`  FAIL ${name} ${detail}`); }
}
const warn = (msg) => console.log(`  warn ${msg}`);

const nameOf = (id) => graph.stations.get(id).name_en;
function describe(r) {
  return r.legs.map((l) => {
    if (l.type === 'walk') return `walk ${nameOf(l.from)} -> ${nameOf(l.to)} (${l.minutes}m)`;
    const s = l.stations.map(nameOf);
    return `${l.line}: ${s[0]} -> ${s[s.length - 1]} (${s.length - 1} stops)`;
  }).join('  |  ');
}
const fmt = (fare) => PASSENGERS.map((t) => `${t} ${fare.totals[t].exact ? '' : '~'}${fare.totals[t].amount}`).join(', ');

function run(from, to, expect) {
  console.log(`\n${from} -> ${to}`);
  const res = findRoutes(graph, from, to);
  check('route found', res && res.fastest);
  if (!res?.fastest) return;
  const r = res.fastest;
  const fare = priceRoute(data, graph, r.legs, checks);
  console.log(`  fastest: ${describe(r)}`);
  console.log(`  ${r.minutes} min, ${r.stops} stops, ${r.changes} change(s); ${fmt(fare)} THB (${fare.parts.map((p) => `${p.system} ${p.fares.adult.amount} ${p.fares.adult.status}`).join(' + ')})`);
  expect(r, fare, res);
}

const rideLines = (r) => r.legs.filter((l) => l.type === 'ride').map((l) => l.line);
const adult = (fare) => fare.totals.adult.amount;

// --- Routes and official fares -------------------------------------------
run('mo-chit', 'siam', (r, fare) => {
  check('one BTS Sukhumvit ride, no changes', rideLines(r).join() === 'sukhumvit' && r.changes === 0);
  check('7 stops', r.stops === 7, `got ${r.stops}`);
  check('time 14-22 min', r.minutes >= 14 && r.minutes <= 22, `got ${r.minutes}`);
  check('BTS table: adult 47, official', adult(fare) === 47 && fare.totals.adult.exact, `got ${adult(fare)}`);
  check('senior 24', fare.totals.senior.amount === 24, `got ${fare.totals.senior.amount}`);
  const d = legDirection(graph, r.legs.find((l) => l.type === 'ride'));
  check('direction: towards Kheha', d.towards === 'E23', `got ${d.towards}`);
});

run('bang-wa', 'saphan-taksin', (r, fare) => {
  check('one BTS Silom ride', rideLines(r).join() === 'silom' && r.changes === 0, rideLines(r).join());
  check('BTS table: adult 41 (not 51)', adult(fare) === 41, `got ${adult(fare)}`);
  check('student 34', fare.totals.student.amount === 34, `got ${fare.totals.student.amount}`);
  check('senior 21', fare.totals.senior.amount === 21, `got ${fare.totals.senior.amount}`);
  check('all three official', PASSENGERS.every((t) => fare.parts[0].fares[t].status === 'official'));
});

run('siam', 'saphan-taksin', (r, fare) => {
  check('one BTS Silom ride', rideLines(r).join() === 'silom' && r.changes === 0);
  check('6 stops', r.stops === 6, `got ${r.stops}`);
  check('BTS table: adult 40', adult(fare) === 40, `got ${adult(fare)}`);
});

run('asok', 'si-lom', (r, fare, res) => {
  check('walk to MRT Sukhumvit then Blue Line', r.legs[0].type === 'walk' && rideLines(r).join() === 'blue');
  check('4 stops on Blue', r.stops === 4, `got ${r.stops}`);
  check('no line changes', r.changes === 0);
  check('MRT adult 25, senior 13', adult(fare) === 25 && fare.totals.senior.amount === 13, fmt(fare));
  check('MRT student is an estimate', !fare.totals.student.exact);
  check('no separate fewest-changes route', res.fewest === null);
});

run('bang-wa', 'chatuchak-park', (r, fare) => {
  check('Blue Line only', rideLines(r).join() === 'blue' && r.changes === 0);
  check('goes via Tha Phra and Charan 13 (14 stops)', r.stops === 14, `got ${r.stops}`);
  check('MRT fare 44 (12+ stations)', adult(fare) === 44, `got ${adult(fare)}`);
});

run('suvarnabhumi', 'siam', (r, fare) => {
  check('ARL then BTS Sukhumvit', rideLines(r).join() === 'arl,sukhumvit', rideLines(r).join());
  check('changes at Phaya Thai', r.legs.some((l) => l.type === 'walk' && l.from === 'A8' && l.to === 'N2'));
  check('one change', r.changes === 1);
  check('time 35-55 min', r.minutes >= 35 && r.minutes <= 55, `got ${r.minutes}`);
  check('ARL about 45 + BTS 25 = 70', adult(fare) === 70, `got ${adult(fare)}`);
  check('total is NOT exact (ARL is an estimate)', fare.totals.adult.exact === false);
  check('two operators charged', fare.parts.length === 2);
});

run('siam', 'asok', (r) => check('Sukhumvit Line 4 stops', rideLines(r).join() === 'sukhumvit' && r.stops === 4));
run('mo-chit', 'krung-thon-buri', (r, fare) => {
  check('BTS Sukhumvit -> Silom joined into one BTS fare', fare.parts.length === 1 && fare.parts[0].system === 'bts');
});
run('tha-phra', 'khlong-bang-phai', (r, fare) => {
  check('Blue then Purple at Tao Poon', rideLines(r).join() === 'blue,purple');
  check('one MRT fare, marked estimate', fare.parts.length === 1 && !fare.totals.adult.exact);
});
run('don-mueang', 'siam', (r) => check('uses Red Line', rideLines(r)[0] === 'red'));
run('khu-khot', 'kheha', (r, fare) => {
  check('BTS end to end: adult 65 cap', adult(fare) === 65 && rideLines(r).join() === 'sukhumvit', `got ${adult(fare)}`);
  check('student 60, senior 33', fare.totals.student.amount === 60 && fare.totals.senior.amount === 33, fmt(fare));
});
run('taling-chan', 'rangsit', (r, fare) => {
  check('SRT table: 42 / 38 / 21', adult(fare) === 42 && fare.totals.student.amount === 38 && fare.totals.senior.amount === 21, fmt(fare));
});

// --- Every place reachable ------------------------------------------------
const unreachable = [...graph.places.keys()].filter((p) => p !== 'siam' && !findRoutes(graph, 'siam', p)?.fastest);
console.log('\nNetwork');
check('every place reachable from Siam', unreachable.length === 0, unreachable.join(', '));

// --- Estimates are never shown as exact ----------------------------------
console.log('\nFare status');
{
  let bad = 0;
  let n = 0;
  const places = [...graph.places.keys()];
  for (let i = 0; i < places.length; i += 7) {
    for (let j = 3; j < places.length; j += 11) {
      if (i === j) continue;
      const res = findRoutes(graph, places[i], places[j]);
      if (!res?.fastest) continue;
      const fare = priceRoute(data, graph, res.fastest.legs, checks);
      n += 1;
      for (const t of PASSENGERS) {
        const anyEstimate = fare.parts.some((p) => p.fares[t].status === 'estimate');
        const sum = fare.parts.reduce((s, p) => s + p.fares[t].amount, 0);
        if (fare.totals[t].exact === anyEstimate || sum !== fare.totals[t].amount || !Number.isFinite(sum)) bad += 1;
        if (fare.parts.some((p) => !['official', 'checked', 'estimate'].includes(p.fares[t].status))) bad += 1;
      }
    }
  }
  check(`total is exact only when every part is official/checked (${n} routes)`, bad === 0, `${bad} bad`);
}

// --- Official tables ------------------------------------------------------
console.log('\nOfficial tables');
for (const [id, rule] of Object.entries(data.fares.systems)) {
  if (rule.model !== 'matrix') continue;
  const t = rule.tables;
  const size = t.adult.length;
  for (const type of PASSENGERS) {
    const m = t[type];
    if (!m) continue;
    check(`${id} ${type} table is square and whole numbers`, m.length === size && m.every((row) => row.length === size && row.every((v) => Number.isInteger(v) && v >= 0)));
    let asym = 0;
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (m[i][j] !== m[j][i]) asym += 1;
    check(`${id} ${type} table is the same in both directions`, asym === 0, `${asym} cells differ`);
  }
  const missing = data.stations.filter((s) => rule.lines.includes(s.line) && t.index[s.id] === undefined).map((s) => s.id);
  check(`${id}: every station has a row in the table`, missing.length === 0, missing.join(', '));
}
check('fare systems have {label, url} sources', Object.values(data.fares.systems).every((s) => s.sources?.length && s.sources.every((x) => x.label && /^https:\/\//.test(x.url))));
check('every system says what is official and what is estimated', Object.values(data.fares.systems).every((s) => PASSENGERS.every((t) => ['official', 'estimate'].includes(s.status?.[t]))));
check('fares have a checked date', /^\d{4}-\d{2}-\d{2}$/.test(data.fares.checked_on));

// --- Fares checked at stations -------------------------------------------
console.log('\nFare checks (data/fare-checks.json)');
function journeyFor(c) {
  const a = graph.stations.get(c.from) || [...graph.stations.values()].find((s) => s.code === c.from);
  const b = graph.stations.get(c.to) || [...graph.stations.values()].find((s) => s.code === c.to);
  if (!a || !b) return null;
  for (const res of [findRoutes(graph, a.place, b.place)]) {
    for (const r of [res?.fastest, res?.fewest].filter(Boolean)) {
      const fare = priceRoute(data, graph, r.legs, checksInUse);
      const part = fare.parts.find((p) => p.system === c.operator &&
        ((p.from === a.id && p.to === b.id) || (p.from === b.id && p.to === a.id)));
      if (part) return { part, a, b };
    }
  }
  return null;
}
let checksInUse = checks;
check('fare-checks.json entries are complete', checks.every((c) => c.from && c.to && c.operator && Number.isInteger(c.adult) && /^\d{4}-\d{2}-\d{2}$/.test(c.checked_on)));
for (const c of checks) {
  const found = journeyFor(c);
  check(`checked ${c.operator} ${c.from} -> ${c.to} = ${c.adult}: site shows the same`, found && found.part.fares.adult.amount === c.adult && found.part.fares.adult.status === 'checked',
    found ? `site shows ${found.part.fares.adult.amount} (${found.part.fares.adult.status})` : 'no route uses this trip');
  if (found) {
    const plain = (checksInUse = [], journeyFor(c));
    checksInUse = checks;
    if (plain && plain.part.fares.adult.status === 'official' && plain.part.fares.adult.amount !== c.adult) {
      warn(`official table says ${plain.part.fares.adult.amount} for ${c.from} -> ${c.to}, station check says ${c.adult}`);
    }
  }
}
if (!checks.length) console.log('  (no station checks recorded yet)');
{
  // The override itself works (in-memory check, either direction, by code).
  checksInUse = [{ from: 'CEN', to: 'N8', operator: 'bts', adult: 99, checked_on: '2026-01-01' }];
  const found = journeyFor({ from: 'N8', to: 'CEN', operator: 'bts' });
  check('a station check overrides the table and is marked "checked"', found?.part.fares.adult.amount === 99 && found.part.fares.adult.status === 'checked');
  checksInUse = checks;
}

// --- Platforms ------------------------------------------------------------
console.log('\nPlatforms');
const neighbours = new Map();
for (const line of data.lines) {
  for (const path of line.paths) {
    for (let i = 0; i + 1 < path.length; i++) {
      for (const [x, y] of [[path[i], path[i + 1]], [path[i + 1], path[i]]]) {
        if (!neighbours.has(x)) neighbours.set(x, new Set());
        neighbours.get(x).add(y);
      }
    }
  }
}
const withPlatforms = data.stations.filter((s) => s.platforms?.length);
const lineOfId = (id) => data.stations.find((s) => s.id === id)?.line;
check('platform "next" is a neighbouring station on the same line',
  withPlatforms.every((s) => s.platforms.every((p) => neighbours.get(s.id)?.has(p.next) && lineOfId(p.next) === s.line)),
  withPlatforms.filter((s) => s.platforms.some((p) => !neighbours.get(s.id)?.has(p.next))).map((s) => s.id).join(', '));
check('platform "towards" is a station on the same line', withPlatforms.every((s) => s.platforms.every((p) => lineOfId(p.towards) === s.line)));
check('each direction listed once per station', withPlatforms.every((s) => new Set(s.platforms.map((p) => p.next)).size === s.platforms.length));
check('every station with platforms has a source', withPlatforms.every((s) => s.platform_sources?.length && s.platform_sources.every((x) => /^https:\/\//.test(x.url))));
check('platform direction agrees with the line ends', withPlatforms.every((s) => s.platforms.every((p) => {
  const d = legDirection(graph, { line: s.line, stations: [s.id, p.next] });
  return d.platform === p;
})));
{
  const leg = { line: 'blue', stations: ['BL22', 'BL21'] };
  const d = legDirection(graph, leg);
  check('Blue Sukhumvit -> Phetchaburi heads towards Tha Phra via Bang Sue', d.towards === 'BL01' && d.via === 'BL11', JSON.stringify(d));
  const d2 = legDirection(graph, { line: 'blue', stations: ['BL22', 'BL23'] });
  check('Blue Sukhumvit -> QSNCC heads towards Lak Song', d2.towards === 'BL38', JSON.stringify(d2));
}
const byLine = {};
for (const s of data.stations) {
  byLine[s.line] ??= { total: 0, confirmed: 0 };
  byLine[s.line].total += 1;
  if (s.platforms?.length) byLine[s.line].confirmed += 1;
}
console.log(`  ${withPlatforms.length} of ${data.stations.length} station nodes have confirmed platform numbers`);
for (const [line, c] of Object.entries(byLine)) console.log(`    ${line.padEnd(10)} ${c.confirmed}/${c.total}`);

// --- Data integrity -------------------------------------------------------
console.log('\nData');
const ids = new Set(data.stations.map((s) => s.id));
check('all segments reference real stations', data.segments.every((s) => ids.has(s.from) && ids.has(s.to)));
check('every station has Thai name and coordinates', data.stations.every((s) => s.name_th && s.lat > 13.4 && s.lat < 14.1 && s.lng > 100.3 && s.lng < 100.9));
check('every line has a pill label in both languages', data.lines.every((l) => l.label_en && l.label_th && /^#[0-9A-F]{6}$/i.test(l.text)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
