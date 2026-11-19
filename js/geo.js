// geo.js - small distance helpers (pure).

const R = 6371; // Earth radius in km

/** Great-circle distance in km between two {lat, lng} points. */
export function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Average position of a place's station nodes. */
export function placeCentre(place, stations) {
  const pts = place.stations.map((id) => stations.get(id));
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
  };
}

/** Nearest places to a point, closest first. */
export function nearestPlaces(point, places, stations, count = 3) {
  return [...places.values()]
    .map((p) => ({ place: p, km: distanceKm(point, placeCentre(p, stations)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}
