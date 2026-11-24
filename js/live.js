// live.js - service alerts posted from the admin dashboard (functions/api/alerts.js).
// Alerts name the lines and stations they affect, so a route or a station page can show
// only the ones that matter to it.
let alerts = [];

export async function loadAlerts() {
  try {
    const res = await fetch('/api/alerts', { headers: { Accept: 'application/json' } });
    if (res.ok) alerts = (await res.json()).alerts || [];
  } catch {
    alerts = []; // no server part (a static copy of the site): just no alerts
  }
  return alerts;
}

const on = (a, now = Date.now()) => Date.parse(a.starts_at) <= now && (!a.ends_at || Date.parse(a.ends_at) > now);

export const activeAlerts = () => alerts.filter((a) => on(a));

/** Alerts that touch any of these lines or stations. */
export function alertsFor({ lines = [], stations = [] }) {
  return activeAlerts().filter((a) => a.lines.some((l) => lines.includes(l)) || a.stations.some((s) => stations.includes(s)));
}

/** Lines and stations a route rides through. */
export function routeScope(route) {
  const rides = route.legs.filter((l) => l.type !== 'walk');
  return { lines: [...new Set(rides.map((l) => l.line))], stations: [...new Set(rides.flatMap((l) => l.stations))] };
}
