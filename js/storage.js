// storage.js - recent and favourite routes in localStorage.
// Every access is wrapped: private mode or blocked storage must not break the app.

const PREFIX = 'metrobuddy.';
const MAX_RECENT = 6;

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable - ignore */
  }
}

const same = (a, b) => a.from === b.from && a.to === b.to;

export function addRecent(from, to) {
  const list = load('recent', []).filter((r) => !same(r, { from, to }));
  list.unshift({ from, to });
  save('recent', list.slice(0, MAX_RECENT));
}

export function clearRecent() { save('recent', []); }
export function getRecent() { return load('recent', []); }
export function getFavourites() { return load('favourites', []); }
export function isFavourite(from, to) { return getFavourites().some((r) => same(r, { from, to })); }

export function toggleFavourite(from, to) {
  const list = getFavourites();
  const exists = list.some((r) => same(r, { from, to }));
  const next = exists ? list.filter((r) => !same(r, { from, to })) : [{ from, to }, ...list];
  save('favourites', next.slice(0, 20));
  return !exists;
}

export function removeFavourite(from, to) {
  save('favourites', getFavourites().filter((r) => !same(r, { from, to })));
}

// Recently used stations (place ids), newest first, for the quick chips.
const MAX_STATIONS = 6;
export function getRecentStations() { return load('stations', []); }
export function addRecentStation(placeId) {
  const list = getRecentStations().filter((id) => id !== placeId);
  list.unshift(placeId);
  save('stations', list.slice(0, MAX_STATIONS));
}
