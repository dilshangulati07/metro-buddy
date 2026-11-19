// map.js - draws the schematic network map as SVG and handles clicks.

import { computeLayout, MAP_SIZE } from './map-layout.js';
import { nameOf, altNameOf, t } from './i18n.js';
import { placeLabels, POSITIONS } from './labels.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export function createMap({ scroller, canvas, pop, graph, onAction, badgesHtml }) {
  const layout = computeLayout();
  let scale = 1;
  let ends = { from: null, to: null };
  let routeLegs = null;
  let svg;

  function lineColor(id) { return graph.lines.get(id).color; }

  function render() {
    canvas.textContent = '';
    svg = el('svg', {
      viewBox: `0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`, class: 'map-svg', role: 'group',
      'aria-label': t('mapTitle'),
    });
    canvas.appendChild(svg);

    // 1. Tracks
    const tracks = el('g', { class: 'tracks' }, svg);
    for (const { line, points } of layout.polylines) {
      el('polyline', {
        class: 'track', points: pts(points), fill: 'none', stroke: lineColor(line),
        'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, tracks);
    }

    // 2. Route overlay (drawn above tracks, below stations)
    const overlay = el('g', { class: 'route-track' }, svg);
    if (routeLegs) {
      svg.classList.add('has-route');
      for (const leg of routeLegs) {
        if (leg.type === 'ride') {
          for (let i = 0; i + 1 < leg.stations.length; i++) {
            const geom = layout.segGeom.get(`${leg.stations[i]}|${leg.stations[i + 1]}`);
            if (!geom) continue;
            el('polyline', {
              points: pts(geom), fill: 'none', stroke: lineColor(leg.line), 'stroke-width': 10,
              'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            }, overlay);
          }
        } else {
          const a = layout.pos.get(leg.from);
          const b = layout.pos.get(leg.to);
          el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#0F1B33', 'stroke-width': 3, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }, overlay);
        }
      }
    }

    // 3. Interchange connectors (between nodes of one place, and walking links)
    const links = el('g', { class: 'links' }, svg);
    const drawn = new Set();
    for (const st of graph.stations.values()) {
      for (const ic of st.interchanges) {
        const key = [st.id, ic.to].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = layout.pos.get(st.id);
        const b = layout.pos.get(ic.to);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 1) continue;
        el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#0F1B33', 'stroke-width': 11, 'stroke-linecap': 'round' }, links);
        el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#FFFFFF', 'stroke-width': 5, 'stroke-linecap': 'round' }, links);
      }
    }

    // 4. Stations. One clickable group per place position.
    const onRoute = new Set();
    if (routeLegs) {
      for (const leg of routeLegs) {
        if (leg.type === 'ride') leg.stations.forEach((id) => onRoute.add(graph.stations.get(id).place));
        else { onRoute.add(graph.stations.get(leg.from).place); onRoute.add(graph.stations.get(leg.to).place); }
      }
    }
    // Work out every place's dot positions first, then place labels.
    const spotsByPlace = new Map();
    const circles = [];
    for (const place of graph.places.values()) {
      const spots = [];
      for (const id of place.stations) {
        const n = layout.pos.get(id);
        const spot = spots.find((s) => Math.hypot(s.x - n.x, s.y - n.y) < 1);
        if (spot) spot.ids.push(id); else spots.push({ x: n.x, y: n.y, label: n.label, ids: [id] });
      }
      spotsByPlace.set(place.id, spots);
      spots.forEach((s) => circles.push({ x: s.x, y: s.y, r: 6, key: place.id }));
    }
    const segments = [];
    for (const { points } of layout.polylines) {
      for (let i = 0; i + 1 < points.length; i++) segments.push([...points[i], ...points[i + 1], 7]);
    }
    for (const key of drawn) {
      const [a, b] = key.split('|').map((id) => layout.pos.get(id));
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 1) segments.push([a.x, a.y, b.x, b.y, 11]);
    }
    const isInterchange = (place) => place.stations.length > 1 || graph.stations.get(place.stations[0]).interchanges.length > 0;
    const labelItems = [...graph.places.values()]
      .map((place) => {
        const spot = spotsByPlace.get(place.id)[0];
        const big = isInterchange(place);
        return { key: place.id, x: spot.x, y: spot.y, text: nameOf(place), size: big ? 12.5 : 11, weight: big ? 750 : 600, pref: spot.label, big };
      })
      // Interchanges first, then the most crowded stations, so the hard
      // cases get first pick of the free space.
      .map((it, _, all) => ({ ...it, crowd: all.filter((o) => Math.hypot(o.x - it.x, o.y - it.y) < 70).length }))
      .sort((a, b) => Number(b.big) - Number(a.big) || b.crowd - a.crowd);
    const labelPos = placeLabels(labelItems, segments, circles, { x0: 2, y0: 2, x1: MAP_SIZE.width - 2, y1: MAP_SIZE.height - 2 });

    const stationsG = el('g', { class: 'stations' }, svg);
    for (const place of graph.places.values()) {
      // Nodes sharing a position (e.g. Siam on two lines) are one dot.
      const spots = spotsByPlace.get(place.id);
      const interchange = isInterchange(place);
      spots.forEach((spot, i) => {
        const g = el('g', {
          class: 'st', tabindex: '0', role: 'button', 'data-place': place.id,
          'aria-label': `${nameOf(place)} (${altNameOf(place)})`,
        }, stationsG);
        if (place.id === ends.from) g.classList.add('is-from');
        if (place.id === ends.to) g.classList.add('is-to');
        if (onRoute.has(place.id)) g.classList.add('on-route');
        const lineOfSpot = graph.stations.get(spot.ids[0]).line;
        const endMark = place.id === ends.from || place.id === ends.to;
        el('circle', {
          cx: spot.x, cy: spot.y, r: interchange ? 6.5 : 5,
          fill: endMark ? '#0F1B33' : '#FFFFFF',
          stroke: interchange || endMark ? '#0F1B33' : lineColor(lineOfSpot), 'stroke-width': interchange ? 3 : 2.5,
        }, g);
        // Bigger invisible hit area for fingers
        el('circle', { cx: spot.x, cy: spot.y, r: 13, fill: 'transparent' }, g);
        // Only label the first spot of a multi-spot place
        if (i === 0) addLabel(g, { ...spot, label: labelPos.get(place.id) }, nameOf(place), interchange);
      });
    }
  }

  function addLabel(g, spot, text, bold) {
    const p = POSITIONS[String(spot.label).replace('!', '')] || POSITIONS.r;
    const attrs = { 'font-size': bold ? 12.5 : 11, 'text-anchor': p.anchor };
    if (bold) attrs['font-weight'] = 750;
    attrs.transform = `translate(${(spot.x + p.dx).toFixed(1)} ${(spot.y + p.dy).toFixed(1)})${p.rot ? ` rotate(${p.rot})` : ''}`;
    el('text', attrs, g).textContent = text;
  }

  // ---- Zoom & pan ----
  // Zoom changes the canvas width (so the SVG stays sharp). During a pinch we
  // preview with a CSS transform and commit the width when the fingers lift.
  const MAX_SCALE = 2.4;
  function fitScale() { return Math.min(1, scroller.clientWidth / MAP_SIZE.width); }
  const clampScale = (s) => Math.max(fitScale(), Math.min(MAX_SCALE, s));
  function setScale(next, focus) {
    const prev = scale;
    scale = clampScale(next);
    const fx = focus ? focus.x : scroller.clientWidth / 2;
    const fy = focus ? focus.y : scroller.clientHeight / 2;
    const cx = (scroller.scrollLeft + fx) / prev;
    const cy = (scroller.scrollTop + fy) / prev;
    canvas.style.width = `${MAP_SIZE.width * scale}px`;
    scroller.scrollLeft = cx * scale - fx;
    scroller.scrollTop = cy * scale - fy;
    hidePop();
  }
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let anim = 0;
  // Ease from the current view to a target scale and centre point (map units).
  function animateTo(targetScale, centre, ms = 260) {
    cancelAnimationFrame(anim);
    targetScale = clampScale(targetScale);
    const startScale = scale;
    const startCentre = {
      x: (scroller.scrollLeft + scroller.clientWidth / 2) / scale,
      y: (scroller.scrollTop + scroller.clientHeight / 2) / scale,
    };
    const end = centre || startCentre;
    const apply = (k) => {
      scale = startScale + (targetScale - startScale) * k;
      canvas.style.width = `${MAP_SIZE.width * scale}px`;
      centreOn({ x: startCentre.x + (end.x - startCentre.x) * k, y: startCentre.y + (end.y - startCentre.y) * k });
    };
    hidePop();
    if (reduceMotion() || ms <= 0) { apply(1); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      apply(1 - (1 - p) ** 3); // ease-out cubic
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function initialScale() {
    // Phones: start zoomed so labels are readable, centred near Siam.
    const narrow = scroller.clientWidth < 700;
    scale = narrow ? 0.72 : fitScale();
    canvas.style.width = `${MAP_SIZE.width * scale}px`;
    if (narrow) centreOn(layout.pos.get('CEN'));
  }
  function centreOn(p) {
    scroller.scrollLeft = p.x * scale - scroller.clientWidth / 2;
    scroller.scrollTop = p.y * scale - scroller.clientHeight / 2;
  }
  const local = (e) => {
    const r = scroller.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Trackpad pinch and ctrl/cmd + wheel zoom around the pointer.
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    setScale(scale * Math.exp(-e.deltaY * 0.0045), local(e));
  }, { passive: false });

  // Two-finger pinch on touch screens. One finger keeps native scrolling.
  let pinch = null;
  const span = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY) || 1;
  scroller.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    cancelAnimationFrame(anim);
    const [a, b] = e.touches;
    const mid = local({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
    pinch = { dist: span(e.touches), start: scale, mid, target: scale };
    // Scale around the map point under the fingers.
    canvas.style.transformOrigin = `${scroller.scrollLeft + mid.x}px ${scroller.scrollTop + mid.y}px`;
    hidePop();
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    pinch.target = clampScale(pinch.start * (span(e.touches) / pinch.dist));
    canvas.style.transform = `scale(${pinch.target / pinch.start})`;
  }, { passive: false });
  const endPinch = () => {
    if (!pinch) return;
    canvas.style.transform = '';
    canvas.style.transformOrigin = '';
    setScale(pinch.target, pinch.mid);
    pinch = null;
  };
  scroller.addEventListener('touchend', (e) => { if (e.touches.length < 2) endPinch(); });
  scroller.addEventListener('touchcancel', endPinch);

  // Mouse drag to pan (touch uses native scrolling)
  let drag = null;
  scroller.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(anim);
    drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; scroller.classList.add('is-dragging'); }
    scroller.scrollLeft = drag.left - dx;
    scroller.scrollTop = drag.top - dy;
  });
  window.addEventListener('pointerup', () => {
    if (drag?.moved) { scroller.dataset.justDragged = '1'; setTimeout(() => delete scroller.dataset.justDragged, 0); }
    drag = null;
    scroller.classList.remove('is-dragging');
  });

  // ---- Station popover ----
  function showPop(placeId, anchorEl) {
    const place = graph.places.get(placeId);
    const lines = [...new Set(place.stations.map((id) => graph.stations.get(id).line))];
    pop.innerHTML = `
      <button type="button" class="iconbtn map-pop__close" data-act="close" aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      <div class="map-pop__name"></div>
      <div class="map-pop__alt"></div>
      <div class="badges">${badgesHtml(place)}</div>
      <div class="map-pop__actions">
        <button type="button" class="btn btn--small" data-act="from">${t('setFrom')}</button>
        <button type="button" class="btn btn--small btn--primary" data-act="to">${t('setTo')}</button>
        <button type="button" class="btn btn--small" data-act="info">${t('stationInfo')}</button>
      </div>`;
    pop.querySelector('.map-pop__name').textContent = nameOf(place);
    pop.querySelector('.map-pop__alt').textContent = altNameOf(place);
    pop.dataset.place = placeId;
    pop.dataset.lines = lines.join(',');
    pop.hidden = false;
    // Position next to the station, inside the frame
    const frame = pop.parentElement.getBoundingClientRect();
    const r = anchorEl.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = r.left - frame.left + r.width / 2 - pw / 2;
    let top = r.bottom - frame.top + 8;
    if (top + ph > frame.height - 8) top = r.top - frame.top - ph - 8;
    left = Math.max(8, Math.min(frame.width - pw - 8, left));
    top = Math.max(8, top);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.querySelector('[data-act="to"]').focus({ preventScroll: true });
  }
  function hidePop() { pop.hidden = true; }

  canvas.addEventListener('click', (e) => {
    if (scroller.dataset.justDragged) return;
    const g = e.target.closest('.st');
    if (!g) { hidePop(); return; }
    showPop(g.dataset.place, g);
  });
  canvas.addEventListener('keydown', (e) => {
    const g = e.target.closest('.st');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showPop(g.dataset.place, g); }
  });
  pop.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const placeId = pop.dataset.place;
    hidePop();
    if (act !== 'close') onAction(act, placeId);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
  scroller.addEventListener('scroll', () => { if (!drag) hidePop(); }, { passive: true });

  render();
  requestAnimationFrame(initialScale);
  // Label widths depend on the web font; place them again once it loads.
  document.fonts?.ready.then(() => render());
  window.addEventListener('resize', () => { if (scale < fitScale()) setScale(fitScale()); });

  return {
    zoomIn: () => animateTo(scale * 1.4),
    zoomOut: () => animateTo(scale / 1.4),
    fit: () => animateTo(fitScale(), { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 }),
    setEnds(from, to) { ends = { from, to }; render(); },
    showRoute(legs) {
      routeLegs = legs;
      render();
    },
    // Zoom and pan so the whole route fits in view.
    focusRoute(legs, { animate = true } = {}) {
      if (!legs?.length) return;
      const ids = legs.flatMap((l) => (l.type === 'ride' ? l.stations : [l.from, l.to]));
      const ps = ids.map((id) => layout.pos.get(id)).filter(Boolean);
      if (!ps.length || !scroller.clientWidth) return;
      const minX = Math.min(...ps.map((p) => p.x));
      const maxX = Math.max(...ps.map((p) => p.x));
      const minY = Math.min(...ps.map((p) => p.y));
      const maxY = Math.max(...ps.map((p) => p.y));
      const pad = 90;
      const sx = scroller.clientWidth / (maxX - minX + pad * 2);
      const sy = scroller.clientHeight / (maxY - minY + pad * 2);
      animateTo(Math.min(1.4, sx, sy), { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, animate ? 380 : 0);
    },
    rerender: render,
  };
}
