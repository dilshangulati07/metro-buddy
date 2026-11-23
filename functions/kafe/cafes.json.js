// functions/kafe/cafes.json.js: serves /kafe/cafes.json on this site.
//
// A Cloudflare Pages Function. It fetches Kafé Bangkok's café list and
// passes it on from this site's own address, so js/cafes.js can read it
// without needing CORS headers from the other site. Cloudflare caches the
// answer for an hour, so Kafé Bangkok is asked at most about once an hour.

const KAFE_DATA = 'https://kafe-bangkok.pages.dev/data/cafes.json';

export async function onRequestGet({ request }) {
  let upstream;
  try {
    upstream = await fetch(KAFE_DATA, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
  } catch {
    return Response.json({ error: 'Kafé Bangkok could not be reached' }, { status: 502 });
  }
  if (!upstream.ok) {
    return Response.json({ error: `Kafé Bangkok answered ${upstream.status}` }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
