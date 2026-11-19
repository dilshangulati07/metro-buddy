// Extract "Platform N | <line> towards X (Next)" rows from rendered Wikipedia HTML.
import { readFileSync, existsSync } from 'node:fs';

const decode = (s) => s.replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const text = (h) => decode(h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export function pageFile(dir, title) {
  return `${dir}/html/${title.replace(/[^A-Za-z0-9]+/g, '_')}.json`;
}

export function platformRows(html) {
  const rows = [];
  for (const tr of html.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const cells = [...tr[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1]));
    for (let i = 0; i < cells.length - 1; i++) {
      const m = cells[i].match(/^Platforms?\s+(\d+[A-Z]?)(?:\s*(?:and|&|,|\/)\s*(\d+[A-Z]?))?\b/i);
      if (m) rows.push({ nos: [m[1], m[2]].filter(Boolean), desc: cells[i + 1], raw: cells.join(' | ') });
    }
  }
  return rows;
}

export function loadPage(dir, title) {
  const f = pageFile(dir, title);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8'));
}
