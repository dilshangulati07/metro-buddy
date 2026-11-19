// cafes.js - loads Kafé Bangkok's café list and finds cafés near a point.
//
// kafebangkok.netlify.app does not send CORS headers, so a browser on
// another domain cannot read it directly. netlify.toml proxies
// /kafe/cafes.json to the real file (same origin, no CORS needed). We try
// the proxy first, then the direct URL (works if CORS is ever enabled).
// If both fail, the café sections stay hidden.

import { distanceKm } from './geo.js';

const SOURCES = ['/kafe/cafes.json', 'https://kafebangkok.netlify.app/data/cafes.json'];
const KAFE_SITE = 'https://kafebangkok.netlify.app/';
export const RADIUS_M = 800;

let cache = null;

export function loadCafes() {
  if (!cache) {
    cache = (async () => {
      for (const url of SOURCES) {
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) continue;
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.cafes;
          if (Array.isArray(list) && list.length) {
            return list.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.name);
          }
        } catch {
          /* try next source */
        }
      }
      return null; // unavailable
    })();
  }
  return cache;
}

/** Cafés within RADIUS_M metres of any of the given points, nearest first. */
export function cafesNear(cafes, points, limit = 9) {
  return cafes
    .map((c) => ({ cafe: c, m: Math.min(...points.map((p) => distanceKm(p, c) * 1000)) }))
    .filter((x) => x.m <= RADIUS_M)
    .sort((a, b) => a.m - b.m)
    .slice(0, limit);
}

/** Link into Kafé Bangkok with the café's name as the search query. */
export function kafeLink(cafe) {
  return `${KAFE_SITE}#q=${encodeURIComponent(cafe.name)}`;
}
