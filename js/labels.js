// labels.js - greedy label placement for the schematic map.
//
// For each station we try up to 8 label positions (right, left, and the
// four 45-degree diagonals, above, below). Each candidate is an oriented
// rectangle; we score it by how many tracks, station dots and already
// placed labels it would cover, and keep the cheapest. Stations are
// processed in priority order (interchanges first) so the important names
// get the best spots.

const DEG = Math.PI / 180;

// pos -> anchor offset from the station, rotation, and text anchor
export const POSITIONS = {
  r: { dx: 10, dy: 4, rot: 0, anchor: 'start' },
  l: { dx: -10, dy: 4, rot: 0, anchor: 'end' },
  t: { dx: 0, dy: -11, rot: 0, anchor: 'middle' },
  b: { dx: 0, dy: 20, rot: 0, anchor: 'middle' },
  tr: { dx: 6, dy: -8, rot: -45, anchor: 'start' },
  br: { dx: 4, dy: 13, rot: 45, anchor: 'start' },
  tl: { dx: -6, dy: -8, rot: 45, anchor: 'end' },
  bl: { dx: -4, dy: 13, rot: -45, anchor: 'end' },
};
const ORDER = ['r', 'l', 'tr', 'br', 'tl', 'bl', 't', 'b'];

let ctx;
export function measure(text, size, weight) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${weight} ${size}px Manrope, "IBM Plex Sans Thai", system-ui, sans-serif`;
  return ctx.measureText(text).width;
}

function box(x, y, pos, w, h) {
  const p = POSITIONS[pos];
  const sx = x + p.dx;
  const sy = y + p.dy;
  const cos = Math.cos(p.rot * DEG);
  const sin = Math.sin(p.rot * DEG);
  // Local text box centre (baseline at y=0, glyphs mostly above it).
  // The first few pixels next to the station are left out of the box so
  // the label does not "collide" with its own station's track.
  const trim = p.anchor === 'middle' ? 0 : 4;
  const dir = p.anchor === 'start' ? 1 : p.anchor === 'end' ? -1 : 0;
  const lx = dir * (w / 2 + trim / 2);
  const ly = -h * 0.32;
  return {
    cx: sx + lx * cos - ly * sin,
    cy: sy + lx * sin + ly * cos,
    ux: cos, uy: sin, vx: -sin, vy: cos,
    hw: w / 2 + 1.5 - trim / 2, hh: h * 0.42 + 1,
  };
}

function boxesOverlap(a, b) {
  // Separating axis test on the 4 box axes
  const axes = [[a.ux, a.uy], [a.vx, a.vy], [b.ux, b.uy], [b.vx, b.vy]];
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  for (const [ax, ay] of axes) {
    const ra = a.hw * Math.abs(a.ux * ax + a.uy * ay) + a.hh * Math.abs(a.vx * ax + a.vy * ay);
    const rb = b.hw * Math.abs(b.ux * ax + b.uy * ay) + b.hh * Math.abs(b.vx * ax + b.vy * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
  }
  return true;
}

function toLocal(bx, x, y) {
  const dx = x - bx.cx;
  const dy = y - bx.cy;
  return [dx * bx.ux + dy * bx.uy, dx * bx.vx + dy * bx.vy];
}

function segmentHits(bx, x1, y1, x2, y2, pad) {
  // Liang-Barsky clip of the segment against the box (in box space)
  const [ax, ay] = toLocal(bx, x1, y1);
  const [bxl, byl] = toLocal(bx, x2, y2);
  const dx = bxl - ax;
  const dy = byl - ay;
  let t0 = 0;
  let t1 = 1;
  const hw = bx.hw + pad;
  const hh = bx.hh + pad;
  const tests = [[-dx, ax + hw], [dx, hw - ax], [-dy, ay + hh], [dy, hh - ay]];
  for (const [p, q] of tests) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

function circleHits(bx, x, y, r) {
  const [lx, ly] = toLocal(bx, x, y);
  const cx = Math.max(-bx.hw, Math.min(bx.hw, lx));
  const cy = Math.max(-bx.hh, Math.min(bx.hh, ly));
  return (lx - cx) ** 2 + (ly - cy) ** 2 < r * r;
}

/**
 * items: [{ key, x, y, text, size, weight, pref }]
 * segments: [[x1, y1, x2, y2, width]]   circles: [{ x, y, r, key }]
 * Returns Map(key -> pos)
 */
export function placeLabels(items, segments, circles, bounds) {
  const placed = [];
  const result = new Map();
  for (const it of items) {
    const w = measure(it.text, it.size, it.weight);
    const h = it.size * 1.2;
    // A hint ending in "!" is fixed; otherwise it is just tried first.
    const forced = it.pref?.endsWith('!');
    const pref = forced ? it.pref.slice(0, -1) : it.pref;
    const order = forced ? [pref] : [pref, ...ORDER.filter((p) => p !== pref)].filter(Boolean);
    let best = null;
    for (let i = 0; i < order.length; i++) {
      const bx = box(it.x, it.y, order[i], w, h);
      let score = i * 1.5;
      for (const other of placed) if (boxesOverlap(bx, other)) score += 100;
      for (const [x1, y1, x2, y2, sw] of segments) if (segmentHits(bx, x1, y1, x2, y2, sw / 2 - 0.5)) score += 40;
      for (const c of circles) if (c.key !== it.key && circleHits(bx, c.x, c.y, c.r)) score += 60;
      const ext = Math.abs(bx.ux) * bx.hw + Math.abs(bx.vx) * bx.hh;
      const eyt = Math.abs(bx.uy) * bx.hw + Math.abs(bx.vy) * bx.hh;
      if (bx.cx - ext < bounds.x0 || bx.cx + ext > bounds.x1 || bx.cy - eyt < bounds.y0 || bx.cy + eyt > bounds.y1) score += 300;
      if (!best || score < best.score) best = { score, pos: order[i], bx };
      if (score === i * 1.5) break; // no collisions: later options can't beat it
    }
    placed.push(best.bx);
    result.set(it.key, best.pos);
  }
  return result;
}
