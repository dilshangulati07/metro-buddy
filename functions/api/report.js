// POST /api/report: "Report a problem" from a route or a station page.
// Reports go to the metro_reports table of the D1 database "dilshan-sites" and show up in
// the admin dashboard, where a fare report can become a checked fare in data/fare-checks.json.
import { json, fail, clean, sameOrigin, BOTS, fingerprint } from '../_lib/server.js';

const KINDS = new Set(['fare', 'platform', 'exit', 'route', 'station', 'other']);
const PER_DAY = 10;
const ID = /^[A-Za-z0-9-]{1,40}$/;

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'Reports must come from this site.');
  if (!env.DB) return fail(503, 'Reports are not available on this copy of the site.');
  if (BOTS.test(request.headers.get('User-Agent') || '')) return fail(403, 'Automated reports are not accepted.');
  let b;
  try {
    b = await request.json();
  } catch {
    return fail(400, 'Send the report as JSON.');
  }
  if (b.website) return json({ ok: true }); // the hidden honeypot field: a bot filled it in

  const kind = KINDS.has(b.kind) ? b.kind : 'other';
  const details = clean(b.details, 1000, { lines: true });
  if (details.length < 5) return fail(400, 'Tell us a little about what is wrong (at least a few words).');
  const ctx = b.context || {};
  const context = {
    from: ID.test(ctx.from || '') ? ctx.from : null,
    to: ID.test(ctx.to || '') ? ctx.to : null,
    station: ID.test(ctx.station || '') ? ctx.station : null,
    passenger: ['adult', 'student', 'senior'].includes(ctx.passenger) ? ctx.passenger : null,
    shown: Array.isArray(ctx.shown) ? ctx.shown.slice(0, 6).map((p) => ({ system: clean(p.system, 12), from: clean(p.from, 12), to: clean(p.to, 12), adult: Number.isInteger(p.adult) ? p.adult : null, status: clean(p.status, 12) })) : [],
    lang: ctx.lang === 'th' ? 'th' : 'en',
  };
  const paid = Number.isInteger(b.paid) && b.paid > 0 && b.paid < 500 ? b.paid : null;
  const email = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/.test(String(b.email || '').trim()) ? String(b.email).trim().slice(0, 120) : '';

  const reporter = await fingerprint(request, env, 'report');
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM metro_reports WHERE reporter = ? AND created_at > datetime('now', '-1 day')").bind(reporter).first();
  if (n >= PER_DAY) return fail(429, 'That is a lot of reports for one day. Thank you! Please try again tomorrow.');

  const { meta } = await env.DB.prepare(
    "INSERT INTO metro_reports (created_at, status, kind, details, paid, email, context, reporter) VALUES (datetime('now'), 'new', ?, ?, ?, ?, ?, ?)",
  )
    .bind(kind, details, paid, email, JSON.stringify(context), reporter)
    .run();
  return json({ ok: true, id: meta.last_row_id }, 201);
}
