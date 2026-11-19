// Combine English + Thai Wikipedia platform rows into tools/sources/platforms.json.
// Usage: node combine.mjs <project dir> [--write] [--show ID,ID]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { platformRows, loadPage } from './rows.mjs';

const project = process.argv[2];
const WRITE = process.argv.includes('--write');
const showArg = process.argv.indexOf('--show');
const SHOW = new Set(showArg > 0 ? process.argv[showArg + 1].split(',') : []);
const dir = process.cwd();
const data = JSON.parse(readFileSync(`${project}/data/transit.json`, 'utf8'));
const st2page = JSON.parse(readFileSync('st2page.json', 'utf8'));
const thTitles = JSON.parse(readFileSync('th_titles.json', 'utf8'));
const EXTRA_TH = { PK08: 'สถานีแจ้งวัฒนะ-ปากเกร็ด 28', PK25: 'สถานีวงแหวนรามอินทรา', PK29: 'สถานีตลาดมีนบุรี', RN09: 'สถานีหลักหก' };

const S = new Map(data.stations.map((s) => [s.id, s]));
const lines = new Map(data.lines.map((l) => [l.id, l]));

// ---- text helpers
const decode = (s) => s.replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const text = (h) => decode(h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const normEn = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\b(station|bts|mrt|srt|arl|interchange)\b/g, '').replace(/[^a-z0-9]/g, '');
const normTh = (s) => s.replace(/^สถานีกลาง/, '').replace(/^สถานี/, '').replace(/[\sฯ.\-–()]/g, '').replace(/สถานี/g, '');

function thRows(html) {
  const rows = [];
  for (const tr of html.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const cells = [...tr[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1]));
    for (let i = 0; i < cells.length - 1; i++) {
      const m = cells[i].match(/^ชานชาลา(?:ที่)?\s*(\d+[A-Z]?)(?:\s*(?:และ|,|\/|&)\s*(\d+[A-Z]?))?$/);
      if (m) rows.push({ nos: [m[1], m[2]].filter(Boolean), desc: cells[i + 1] });
    }
  }
  return rows;
}

// Names our stations can be called, per language.
function names(st, lang) {
  if (lang === 'en') return [st.name_en, ...(st.aliases || [])].map(normEn).filter(Boolean);
  return [st.name_th].map(normTh).filter(Boolean);
}
function nameMatches(st, raw, lang) {
  const q = lang === 'en' ? normEn(raw) : normTh(raw);
  if (!q) return false;
  return names(st, lang).some((n) => n === q || (q.length >= 4 && n.length >= 4 && (n.startsWith(q) || q.startsWith(n))));
}

// Service order per line (Blue runs Tha Phra -> loop -> Tha Phra -> Lak Song).
function sequences(line) {
  if (line.id === 'blue') {
    const loop = line.paths.find((p) => p[0] === p[p.length - 1]);
    const branch = line.paths.find((p) => p[0] !== p[p.length - 1]);
    return [[...loop, ...branch.slice(1)]];
  }
  return line.paths;
}
function terminus(lineId, a, b) {
  for (const seq of sequences(lines.get(lineId))) {
    for (let i = 0; i + 1 < seq.length; i++) {
      if (seq[i] === a && seq[i + 1] === b) return { ahead: seq.slice(i + 1), end: seq[seq.length - 1] };
      if (seq[i] === b && seq[i + 1] === a) return { ahead: seq.slice(0, i + 1).reverse(), end: seq[0] };
    }
  }
  return null;
}
const neighbours = (id) => {
  const st = S.get(id);
  const out = new Set();
  for (const p of lines.get(st.line).paths) p.forEach((x, i) => { if (x === id) { if (p[i - 1] && p[i - 1] !== id) out.add(p[i - 1]); if (p[i + 1] && p[i + 1] !== id) out.add(p[i + 1]); } });
  return [...out];
};

// Parse one row description into { towards, via, next, terminal } names.
const TERMINAL = /^(terminus|terminal|termination|สถานีปลายทาง|ปลายทาง)$/i;
const NOISE = /peak|platform|ชั่วคราว|เฉพาะ|\d{1,2}[:.]\d{2}/i;
function parseDesc(desc, lang) {
  const key = lang === 'en' ? /\btowards?\s+/i : /มุ่งหน้า\s*/;
  const k = desc.match(key);
  if (!k) return null;
  const rest = desc.slice(k.index + k[0].length);
  const parens = [...rest.matchAll(/\(\s*([^()]*?)\s*\)/g)].map((m) => m[1]);
  const main = rest.replace(/\([^()]*\)/g, ' ').split(/\s*,\s*/)[0].trim();
  const vm = main.match(lang === 'en' ? /^(.+?)\s+via\s+(.+)$/i : /^(.+?)\s*(?:ผ่าน|โดยผ่าน)\s*(.+)$/);
  let towards = vm ? vm[1] : main;
  let via = vm ? vm[2] : null;
  let next = null;
  let terminal = false;
  for (const p of parens) {
    const pv = p.match(lang === 'en' ? /^via\s+(.+)$/i : /^(?:ผ่าน|โดยผ่าน)\s*(.+)$/);
    if (pv) { via = pv[1]; continue; }
    if (TERMINAL.test(p)) { terminal = true; continue; }
    if (NOISE.test(p)) continue;
    if (!next) next = p;
  }
  towards = towards.split(/\s*\/\s*|\s+or\s+|\s+หรือ\s+/)[0].trim();
  if (!towards) return null;
  return { towards, via, next, terminal };
}

// Rows from one page -> Map(nodeId -> Map(nextId -> {no, towards, via, raw}))
function extract(rows, candidates, lang, log) {
  const out = new Map();
  for (const r of rows) {
    if (/out of service|not in use|ไม่ได้ใช้งาน|ปิดให้บริการ|ไม่เปิดให้บริการ|under construction|ก่อสร้าง/i.test(r.desc)) { log.push(`skip(closed) ${r.desc}`); continue; }
    // Platforms used only at certain hours or trains are not a firm answer.
    if (/\d{1,2}[:.]\d{2}|\bpeak\b|off-peak|เฉพาะขบวน/i.test(r.desc)) { log.push(`skip(conditional) ${r.desc}`); continue; }
    const p = parseDesc(r.desc, lang);
    if (!p) { log.push(`skip(no parse) ${r.desc}`); continue; }
    // Every (node, neighbour) pair this row could describe.
    const hits = [];
    for (const node of candidates) {
      for (const nb of neighbours(node)) {
        const dir = terminus(S.get(node).line, node, nb);
        if (!dir) continue;
        // "towards" must lie ahead (after "via", when given). Blue passes Tha Phra twice.
        const tis = dir.ahead.map((id, k) => (nameMatches(S.get(id), p.towards, lang) ? k : -1)).filter((k) => k >= 0);
        let ti = tis[0] ?? -1;
        if (p.via) {
          const vi = dir.ahead.findIndex((id) => nameMatches(S.get(id), p.via, lang));
          ti = vi < 0 ? -1 : (tis.find((k) => k > vi) ?? -1);
        }
        if (ti < 0) continue;
        if (p.next && !nameMatches(S.get(nb), p.next, lang)) continue;
        if (p.terminal && !nameMatches(S.get(nb), p.towards, lang)) continue;
        hits.push({ node, next: nb, how: p.next ? 'next' : p.terminal ? 'terminal' : 'towards', atEnd: ti === dir.ahead.length - 1 });
      }
    }
    // Without a next station the "towards" (and "via") must pick exactly one direction.
    // If two directions both pass it, keep the one where it is the end of the line.
    if (hits.length > 1 && hits.filter((h) => h.atEnd).length === 1) hits.splice(0, hits.length, hits.find((h) => h.atEnd));
    if (hits.length !== 1) { log.push(`skip(${hits.length} matches) ${r.desc}`); continue; }
    const hit = hits[0];
    const no = r.nos.join(', ');
    const m = out.get(hit.node) || new Map();
    const prev = m.get(hit.next);
    if (prev && prev.no !== no) {
      // Two platforms of one source serving the same direction: list both.
      prev.no = [...new Set([...prev.no.split(', '), ...r.nos])].sort((x, y) => x.localeCompare(y, 'en', { numeric: true })).join(', ');
    } else if (!prev) m.set(hit.next, { no, how: hit.how, raw: r.desc });
    out.set(hit.node, m);
  }
  return out;
}

const pageNodes = new Map(); // title -> node ids (whole place)
for (const [id, title] of Object.entries(st2page)) {
  const place = S.get(id).place;
  const nodes = data.stations.filter((s) => s.place === place).map((s) => s.id);
  pageNodes.set(title, [...new Set([...(pageNodes.get(title) || []), ...nodes])]);
}

const thFile = (t) => `thhtml/${Buffer.from(t).toString('hex').slice(0, 120)}.json`;
const result = {};
const report = { agree: 0, enOnly: 0, thOnly: 0, conflict: [], partial: [] };
const perNode = new Map(); // node -> {en: Map, th: Map, src: []}
const add = (node, lang, m, src) => {
  const rec = perNode.get(node) || { en: new Map(), th: new Map(), src: [] };
  for (const [k, v] of m) rec[lang].set(k, v);
  if (!rec.src.some((s) => s.url === src.url)) rec.src.push(src);
  perNode.set(node, rec);
};

for (const [title, nodes] of pageNodes) {
  const log = [];
  const en = loadPage(dir, title);
  if (en?.html) {
    const m = extract(platformRows(en.html), nodes, 'en', log);
    for (const [node, mm] of m) add(node, 'en', mm, { label: 'Wikipedia (English)', url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&oldid=${en.revid}` });
  }
  const tht = thTitles[title];
  if (tht && existsSync(thFile(tht))) {
    const p = JSON.parse(readFileSync(thFile(tht), 'utf8'));
    if (p.html) {
      const m = extract(thRows(p.html), nodes, 'th', log);
      const t2 = p.resolved || tht;
      for (const [node, mm] of m) add(node, 'th', mm, { label: 'Wikipedia (Thai)', url: `https://th.wikipedia.org/w/index.php?title=${encodeURIComponent(t2.replace(/ /g, '_'))}&oldid=${p.revid}` });
    }
  }
  if (nodes.some((n) => SHOW.has(n))) console.log('==', title, '\n  ' + log.join('\n  '));
}
for (const [id, tht] of Object.entries(EXTRA_TH)) {
  if (!S.has(id) || !existsSync(thFile(tht))) continue;
  const p = JSON.parse(readFileSync(thFile(tht), 'utf8'));
  const log = [];
  const m = extract(thRows(p.html || ''), [id], 'th', log);
  for (const [node, mm] of m) add(node, 'th', mm, { label: 'Wikipedia (Thai)', url: `https://th.wikipedia.org/w/index.php?title=${encodeURIComponent((p.resolved || tht).replace(/ /g, '_'))}&oldid=${p.revid}` });
  if (SHOW.has(id)) console.log('==', tht, log);
}

// Stations whose platform use changes by time of day (one source says so).
const EXCLUDE = { G2: 'English Wikipedia: platform use differs between peak and off-peak' };
for (const [node, rec] of perNode) {
  const st = S.get(node);
  if (EXCLUDE[node]) { report.conflict.push(`${node} ${st.name_en}: ${EXCLUDE[node]}`); continue; }
  const nexts = new Set([...rec.en.keys(), ...rec.th.keys()]);
  let bad = false;
  const plats = [];
  for (const next of nexts) {
    const e = rec.en.get(next);
    const t = rec.th.get(next);
    if (e && t && e.no !== t.no) { bad = true; break; }
    const v = e || t;
    const dir = terminus(st.line, node, next);
    const entry = { no: v.no, towards: dir.end, next };
    if (st.line === 'blue' && dir.ahead.slice(0, -1).includes('BL11')) entry.via = 'BL11';
    plats.push(entry);
    if (e && t) report.agree += 1; else if (e) report.enOnly += 1; else report.thOnly += 1;
  }
  // Two directions on one platform number is only fine at a terminus-style layout; keep but flag.
  if (bad) {
    report.conflict.push(`${node} ${st.name_en}: EN ${[...rec.en].map(([k, v]) => `${v.no}->${k}`).join(' ')} | TH ${[...rec.th].map(([k, v]) => `${v.no}->${k}`).join(' ')}`);
    continue;
  }
  if (plats.length < neighbours(node).length) report.partial.push(`${node} ${st.name_en} (${plats.length}/${neighbours(node).length})`);
  // Only keep sources that contributed.
  const used = rec.src.filter((s) => (s.label.includes('English') ? rec.en.size : rec.th.size));
  plats.sort((a, b) => a.no.localeCompare(b.no, 'en', { numeric: true }));
  result[node] = { platforms: plats, sources: used };
  if (SHOW.has(node)) console.log(node, JSON.stringify(result[node]));
}

const byLine = {};
for (const st of data.stations) {
  byLine[st.line] ??= { total: 0, confirmed: 0, missing: [] };
  byLine[st.line].total += 1;
  if (result[st.id]) byLine[st.line].confirmed += 1; else byLine[st.line].missing.push(st.id);
}
console.log('nodes with platforms:', Object.keys(result).length, 'of', data.stations.length);
console.log('entries agree EN+TH:', report.agree, ' EN only:', report.enOnly, ' TH only:', report.thOnly);
console.log('conflicts (excluded):\n  ' + report.conflict.join('\n  '));
console.log('partial:', report.partial.join('; '));
for (const [l, c] of Object.entries(byLine)) console.log(l.padEnd(10), `${c.confirmed}/${c.total}`, c.missing.length && c.missing.length < 20 ? 'missing ' + c.missing.join(' ') : '');

if (WRITE) {
  const out = {
    about: 'Platform numbers per station node, from Wikipedia station layout tables (English and Thai). A row is kept only when its next station matches our network and its "towards" station lies ahead in that direction. Stations where English and Thai disagree are left out. "towards" is the line end in that direction.',
    checked_on: new Date().toISOString().slice(0, 10),
    stations: result,
  };
  writeFileSync(`${project}/tools/sources/platforms.json`, JSON.stringify(out, null, 1) + '\n');
  console.log('written');
}
