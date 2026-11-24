// Helpers shared by the Pages Functions in functions/api/ (this folder has no routes).
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

export const fail = (status, message) => json({ ok: false, message }, status);

// "2026-11-24" in Bangkok time (UTC+7)
export const bangkokDay = (date = new Date()) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);

// Requests from other sites are refused (browsers always send Origin on a POST).
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python/i;

// Plain text: no control characters (line breaks kept when `lines`), trimmed, at most `max` characters.
export const clean = (v, max, { lines = false } = {}) =>
  String(v ?? '')
    .replace(lines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, ' ')
    .replace(lines ? /[ \t]+/g : /\s+/g, ' ')
    .trim()
    .slice(0, max);

// A one-way fingerprint of the visitor's network address, used only to limit how many
// reports one person can send in a day. The salt is random and stays in the database.
export async function fingerprint(request, env, purpose) {
  await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('metro_salt', ?)")
    .bind(JSON.stringify(crypto.randomUUID() + crypto.randomUUID()))
    .run();
  const { value: salt } = await env.DB.prepare("SELECT value FROM settings WHERE key = 'metro_salt'").first();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}|${ip}|${salt}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
