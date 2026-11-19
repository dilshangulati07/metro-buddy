import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const UA = 'MetroBuddyResearch/1.0 (static site data check)';
const st2page = JSON.parse(readFileSync('st2page.json', 'utf8'));
const pages = [...new Set(Object.values(st2page))];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fname = (t) => 'html/' + t.replace(/[^A-Za-z0-9]+/g, '_') + '.json';
for (const t of pages) {
  if (existsSync(fname(t))) continue;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&prop=text|revid&format=json&page=${encodeURIComponent(t)}`, { headers: { 'User-Agent': UA } });
    const txt = await r.text();
    if (txt.startsWith('{')) { const j = JSON.parse(txt); writeFileSync(fname(t), JSON.stringify({ title: t, revid: j.parse?.revid, html: j.parse?.text?.['*'] })); break; }
    await sleep(8000 * (i + 1));
  }
  await sleep(1500);
}
console.log('done', pages.length);
