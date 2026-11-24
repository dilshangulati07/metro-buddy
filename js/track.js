// track.js - anonymous counts of what people do here (routes searched, station pages,
// passenger type), sent to /api/track (functions/api/track.js) for the Insights page of
// the private admin dashboard. No cookies and nothing that identifies a person. Browsers
// that ask not to be tracked (Do Not Track or Global Privacy Control) send nothing, and
// neither does a local copy.
const off =
  navigator.globalPrivacyControl === true ||
  navigator.doNotTrack === '1' ||
  /^(localhost|127\.|\[::1\])/.test(location.hostname) ||
  location.protocol === 'file:';

const last = new Map();

export function track(type, target = '') {
  if (off) return;
  // The same event twice within a few seconds (a re-render, a double click) counts once.
  const key = `${type}:${target}`;
  if (Date.now() - (last.get(key) || 0) < 5000) return;
  last.set(key, Date.now());
  const body = JSON.stringify({ events: [{ type, target: String(target) }] });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', body)) return;
    fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // Counting must never get in the way of the site.
  }
}
