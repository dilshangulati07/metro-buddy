// GET /api/alerts: service alerts that are on right now (posted from the admin dashboard).
// Each: { id, severity: info|minor|major, lines: [line ids], stations: [station ids],
//         title_en, title_th, body_en, body_th, url, starts_at, ends_at }
// Times are ISO strings in UTC. The answer is cached for a minute.
import { json } from '../_lib/server.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: true, alerts: [] });
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, severity, lines, stations, title_en, title_th, body_en, body_th, url, starts_at, ends_at FROM metro_alerts
     WHERE status = 'live' AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)
     ORDER BY CASE severity WHEN 'major' THEN 0 WHEN 'minor' THEN 1 ELSE 2 END, starts_at DESC LIMIT 10`,
  )
    .bind(now, now)
    .all();
  const alerts = results.map((a) => ({ ...a, lines: JSON.parse(a.lines || '[]'), stations: JSON.parse(a.stations || '[]') }));
  return json({ ok: true, alerts }, 200, { 'Cache-Control': 'public, max-age=60' });
}
