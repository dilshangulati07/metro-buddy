import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const UA = 'MetroBuddyResearch/1.0 (static site data check)';
const th = JSON.parse(readFileSync('th_titles.json', 'utf8'));
const extra = ['สถานีแจ้งวัฒนะ-ปากเกร็ด 28', 'สถานีวงแหวนรามอินทรา', 'สถานีตลาดมีนบุรี', 'สถานีหลักหก'];
const titles = [...new Set([...Object.values(th), ...extra])];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fname = (t) => 'thhtml/' + Buffer.from(t).toString('hex').slice(0, 120) + '.json';
for (const t of titles) {
  if (existsSync(fname(t))) continue;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://th.wikipedia.org/w/api.php?action=parse&prop=text|revid&format=json&redirects=1&page=${encodeURIComponent(t)}`, { headers: { 'User-Agent': UA } });
    const txt = await r.text();
    if (txt.startsWith('{')) { const j = JSON.parse(txt); writeFileSync(fname(t), JSON.stringify({ title: t, resolved: j.parse?.title, revid: j.parse?.revid, html: j.parse?.text?.['*'] || '' })); break; }
    await sleep(8000 * (i + 1));
  }
  await sleep(1500);
}
console.log('done', titles.length);
