// POST /api/track: anonymous counts of what people do on Metro Buddy (js/track.js sends
// them): routes searched, station pages opened, passenger type, cafés clicked.
// Each event becomes a row in site_events for the admin dashboard's Insights page.
// No cookies, no IP addresses.
import { bangkokDay, sameOrigin, BOTS } from '../_lib/server.js';

const TYPES = new Set(['route', 'station', 'passenger', 'cafe', 'map', 'share', 'save', 'report', 'alert_open', 'lang']);
const done = () => new Response(null, { status: 204 });

export function cleanEvents(body) {
  const list = Array.isArray(body?.events) ? body.events.slice(0, 12) : [];
  return list
    .filter((e) => e && TYPES.has(e.type))
    .map((e) => ({ type: e.type, target: String(e.target ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) }));
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (BOTS.test(request.headers.get('User-Agent') || '') || !env.DB) return done();
  const text = await request.text();
  if (text.length > 4000) return new Response(null, { status: 413 });
  let events;
  try {
    events = cleanEvents(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!events.length) return done();
  const now = new Date();
  const country = String(request.cf?.country || '').slice(0, 2);
  const insert = env.DB.prepare('INSERT INTO site_events (site, day, created_at, type, target, country) VALUES (?, ?, ?, ?, ?, ?)');
  try {
    await env.DB.batch(events.map((e) => insert.bind('metro', bangkokDay(now), now.toISOString(), e.type, e.target, country)));
  } catch {
    // Counting must never break the site.
  }
  return done();
}
