// app.js - UI wiring for Metro Buddy.

import { buildGraph, findRoutes } from './route.js';
import { priceRoute, PASSENGERS } from './fares.js';
import { legDirection, terminusOf, stationPlatforms } from './platforms.js';
import { nearestPlaces } from './geo.js';
import { createMap } from './map.js';
import { loadCafes, cafesNear, kafeLink } from './cafes.js';
import { t, setLang, getLang, nameOf, altNameOf, labelOf } from './i18n.js';
import * as store from './storage.js';
import { track } from './track.js';
import { loadAlerts, activeAlerts, alertsFor, routeScope } from './live.js';
import { openReport } from './report.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EXAMPLES = [
  ['mo-chit', 'siam'],
  ['suvarnabhumi', 'asok'],
  ['bang-wa', 'saphan-taksin'],
  ['hua-lamphong', 'chatuchak-park'],
];

const state = {
  data: null,
  graph: null,
  checks: [],
  from: null, // place id
  to: null,
  routes: null,
  tab: 'fastest',
  passenger: 'adult',
  cafes: undefined, // undefined = loading, null = unavailable, [] = loaded
  map: null,
  index: [],
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
init();

async function init() {
  const preferred = store.load('lang', null) || ((navigator.language || '').toLowerCase().startsWith('th') ? 'th' : 'en');
  setLang(preferred);
  const savedPassenger = store.load('passenger', 'adult');
  state.passenger = PASSENGERS.includes(savedPassenger) ? savedPassenger : 'adult';
  applyStatic();
  syncPassenger();
  $('#planner-status').textContent = t('loadingStations');

  try {
    const [data, checks] = await Promise.all([
      fetch('/data/transit.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      // Fares checked at ticket machines. Optional: an empty list if missing.
      fetch('/data/fare-checks.json').then((r) => (r.ok ? r.json() : { checks: [] })).catch(() => ({ checks: [] })),
    ]);
    state.data = data;
    state.checks = Array.isArray(checks.checks) ? checks.checks : [];
  } catch {
    $('#planner').setAttribute('aria-busy', 'false');
    $('#planner-status').textContent = t('loadFailed');
    return;
  }
  state.graph = buildGraph(state.data);
  buildIndex();
  loadAlerts().then(() => {
    renderAlerts();
    if (state.routes) renderResult();
    if (!$('#view-station').hidden) renderStation(resolvePlace(currentStationId()));
  });

  state.map = createMap({
    scroller: $('#map-scroll'),
    canvas: $('#map-canvas'),
    pop: $('#map-pop'),
    graph: state.graph,
    badgesHtml,
    onAction: (act, placeId) => {
      if (act === 'info') return go(`#station=${placeId}`);
      if (act === 'from') setEnd('from', placeId, true);
      if (act === 'to') setEnd('to', placeId, true);
      if (state.from && state.to) planRoute();
      else {
        $('#plan').scrollIntoView();
        $(act === 'from' ? '#to-input' : '#from-input').focus({ preventScroll: true });
      }
    },
  });
  $('#zoom-in').addEventListener('click', () => state.map.zoomIn());
  $('#zoom-out').addEventListener('click', () => state.map.zoomOut());
  $('#zoom-fit').addEventListener('click', () => state.map.fit());

  renderLegend();
  renderFares();
  renderSaved();
  renderQuick();
  renderExamples();
  wireCombo('from');
  wireCombo('to');
  wirePlanner();

  // Ready: enable the form.
  $$('.combo__input').forEach((i) => { i.disabled = false; });
  $('.planner__go').disabled = false;
  $('#planner').setAttribute('aria-busy', 'false');
  $('#planner-status').textContent = '';

  $('#lang-toggle').addEventListener('click', () => {
    setLang(getLang() === 'en' ? 'th' : 'en');
    store.save('lang', getLang());
    track('lang', getLang());
    applyStatic();
    refreshAll();
  });

  window.addEventListener('hashchange', readHash);
  readHash();

  loadCafes().then((cafes) => {
    state.cafes = cafes;
    renderCafes();
    if (!$('#view-station').hidden) renderStation(resolvePlace(currentStationId()));
  });
}

// ---------------------------------------------------------------------------
// Static text + language
// ---------------------------------------------------------------------------
function applyStatic() {
  $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  $$('[data-i18n-alt]').forEach((n) => { n.alt = t(n.dataset.i18nAlt); });
  $('#lang-toggle').lang = getLang() === 'en' ? 'th' : 'en';
}

function refreshAll() {
  renderAlerts();
  if (!state.graph) return;
  syncInputs();
  renderLegend();
  renderFares();
  renderSaved();
  renderQuick();
  renderExamples();
  state.map.rerender();
  if (state.routes) renderResult();
  renderCafes();
  if (!$('#view-station').hidden) renderStation(resolvePlace(currentStationId()));
}

// ---------------------------------------------------------------------------
// Station search (English, Thai, aliases, codes)
// ---------------------------------------------------------------------------
const norm = (s) => String(s).toLowerCase().normalize('NFKC').replace(/[\s\-–.'’()]/g, '');

function buildIndex() {
  state.index = [...state.graph.places.values()].map((place) => {
    const nodes = place.stations.map((id) => state.graph.stations.get(id));
    const terms = [place.name_en, place.name_th, ...nodes.flatMap((s) => [s.code, ...(s.aliases || [])])];
    return { place, terms: terms.map(norm), en: norm(place.name_en), th: norm(place.name_th) };
  });
}

function search(query) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const item of state.index) {
    let score = 0;
    if (item.en === q || item.th === q) score = 100;
    else if (item.en.startsWith(q) || item.th.startsWith(q)) score = 80;
    else if (item.terms.some((term) => term === q)) score = 75;
    else if (item.terms.some((term) => term.startsWith(q))) score = 60;
    else if (item.terms.some((term) => term.includes(q))) score = 40;
    if (score) scored.push({ place: item.place, score: score - item.en.length / 100 });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((s) => s.place);
}

function lineOf(id) { return state.graph.lines.get(id); }
function stationOf(id) { return state.graph.stations.get(id); }
function stationName(id) { return nameOf(stationOf(id)); }

/** Small code badges (N8, BL13) in each line's colour. */
function badgesHtml(place) {
  return place.stations.map((id) => {
    const st = stationOf(id);
    const line = lineOf(st.line);
    return `<span class="badge" style="background:${line.color};color:${line.text}" title="${esc(labelOf(line))}">${esc(st.code)}</span>`;
  }).join('');
}

/** Rounded line pill in the official colour ("BTS Sukhumvit"). */
function pill(line) {
  return `<span class="pill-line" style="--bg:${line.color};--fg:${line.text}">${esc(labelOf(line))}</span>`;
}

// ---------------------------------------------------------------------------
// Service alerts (posted from the admin dashboard; see live.js)
// ---------------------------------------------------------------------------
const ALERT_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.2l7.2 12.6H2.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 8.2v3.6M10 14v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/** "18:00", or "Sat 18:00" when it isn't today (Bangkok time). */
function alertTime(iso) {
  const d = new Date(iso);
  const opts = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };
  const day = (x) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const locale = getLang() === 'th' ? 'th-TH' : 'en-GB';
  return day(d) === day(new Date()) ? d.toLocaleTimeString(locale, opts) : d.toLocaleString(locale, { ...opts, weekday: 'short', day: 'numeric', month: 'short' });
}

function alertHtml(a) {
  const th = getLang() === 'th';
  const title = (th && a.title_th) || a.title_en;
  const body = (th && a.body_th) || a.body_en;
  const lines = a.lines.map((id) => lineOf(id)).filter(Boolean);
  return `<details class="alert alert--${esc(a.severity)}" data-alert="${esc(a.id)}">
    <summary>${ALERT_ICON}<span class="alert__sev">${esc(t(`sev_${a.severity}`))}</span>${lines.map(pill).join('')}<span class="alert__title">${esc(title)}</span>${a.ends_at ? `<span class="alert__until">${esc(t('alertUntil', alertTime(a.ends_at)))}</span>` : ''}</summary>
    <div class="alert__body">${body ? `<p>${esc(body)}</p>` : ''}${a.stations.length ? `<p class="alert__stations">${a.stations.map((id) => stationOf(id)).filter(Boolean).map((s) => `<a href="#station=${esc(s.place)}">${esc(nameOf(s))}</a>`).join(', ')}</p>` : ''}${a.url ? `<p><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(t('alertMore'))} ↗</a></p>` : ''}</div>
  </details>`;
}

function renderAlerts() {
  const box = $('#alerts');
  if (!box || !state.graph) return;
  const list = activeAlerts();
  box.hidden = !list.length;
  box.innerHTML = list.length ? `<div class="wrap"><p class="visually-hidden">${esc(t('alertsLabel'))}</p>${list.map(alertHtml).join('')}</div>` : '';
}

document.addEventListener('toggle', (e) => {
  if (e.target.matches?.('details[data-alert]') && e.target.open) track('alert_open', e.target.dataset.alert);
}, true);
document.addEventListener('click', (e) => {
  const cafe = e.target.closest('a[data-cafe]');
  if (cafe) track('cafe', cafe.dataset.cafe);
});

// ---------------------------------------------------------------------------
// Combobox
// ---------------------------------------------------------------------------
function wireCombo(which) {
  const input = $(`#${which}-input`);
  const list = $(`#${which}-list`);
  const clear = input.parentElement.querySelector('.combo__clear');
  let options = [];
  let active = -1;

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); };

  const renderList = () => {
    options = search(input.value);
    if (!input.value.trim()) { close(); return; }
    list.innerHTML = options.length
      ? options.map((p, i) => `
        <li class="combo__opt" role="option" id="${which}-opt-${i}" data-place="${p.id}" aria-selected="${i === active}">
          <span class="combo__opt-names"><span class="combo__opt-main">${esc(nameOf(p))}</span><span class="combo__opt-alt">${esc(altNameOf(p))}</span></span>
          <span class="badges">${badgesHtml(p)}</span>
        </li>`).join('')
      : `<li class="combo__empty">${esc(t('noMatch'))}</li>`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const choose = (placeId) => {
    setEnd(which, placeId, true);
    close();
    if (state.from && state.to) planRoute();
    else if (which === 'from') $('#to-input').focus();
  };

  input.addEventListener('input', () => {
    active = -1;
    if (state[which]) { state[which] = null; state.map.setEnds(state.from, state.to); }
    clear.hidden = !input.value;
    renderList();
  });
  input.addEventListener('focus', () => { if (input.value && !state[which]) renderList(); input.select(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) renderList();
      if (!options.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      $$('.combo__opt', list).forEach((o, i) => o.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', `${which}-opt-${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (!list.hidden && options.length) {
        e.preventDefault();
        choose(options[Math.max(active, 0)].id);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus
  list.addEventListener('click', (e) => {
    const opt = e.target.closest('.combo__opt');
    if (opt) choose(opt.dataset.place);
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    state[which] = null;
    state.map.setEnds(state.from, state.to);
    input.focus();
  });
}

/** Set From or To. `remember` adds the station to the quick chips. */
function setEnd(which, placeId, remember = false) {
  if (!state.graph.places.has(placeId)) return;
  state[which] = placeId;
  if (remember) { store.addRecentStation(placeId); renderQuick(); }
  syncInputs();
  state.map.setEnds(state.from, state.to);
}

function syncInputs() {
  for (const which of ['from', 'to']) {
    const input = $(`#${which}-input`);
    const place = state[which] && state.graph.places.get(state[which]);
    if (place) input.value = nameOf(place);
    input.parentElement.querySelector('.combo__clear').hidden = !input.value;
  }
}

function syncPassenger() {
  $$('#passenger [data-passenger]').forEach((b) => {
    const on = b.dataset.passenger === state.passenger;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------
function wirePlanner() {
  $('#planner').addEventListener('submit', (e) => {
    e.preventDefault();
    // Accept a typed name that was never picked from the list.
    for (const which of ['from', 'to']) {
      if (!state[which]) {
        const first = search($(`#${which}-input`).value)[0];
        if (first) setEnd(which, first.id, true);
      }
    }
    planRoute();
  });

  $('#swap-btn').addEventListener('click', swapEnds);

  // Passenger type: a radio group, remembered in the browser.
  const seg = $('#passenger');
  const pick = (type) => {
    state.passenger = type;
    store.save('passenger', type);
    track('passenger', type);
    syncPassenger();
    if (state.routes) renderResult();
  };
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-passenger]');
    if (b) pick(b.dataset.passenger);
  });
  seg.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = PASSENGERS[(PASSENGERS.indexOf(state.passenger) + step + PASSENGERS.length) % PASSENGERS.length];
    pick(next);
    seg.querySelector(`[data-passenger="${next}"]`).focus();
  });

  $('#locate-btn').addEventListener('click', () => {
    const status = $('#planner-status');
    if (!('geolocation' in navigator)) { status.textContent = t('locDenied'); return; }
    status.textContent = t('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const [best] = nearestPlaces(point, state.graph.places, state.graph.stations, 1);
        setEnd('from', best.place.id, true);
        status.textContent = t('locFound', nameOf(best.place), t('km', best.km * 1000));
        if (state.to) planRoute(); else $('#to-input').focus();
      },
      () => { status.textContent = t('locDenied'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  });

  // Quick station chips fill the first empty field.
  $('#quick-list').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-place]');
    if (!chip) return;
    const which = !state.from ? 'from' : !state.to ? 'to' : 'to';
    setEnd(which, chip.dataset.place, true);
    if (state.from && state.to) planRoute();
    else $(which === 'from' ? '#to-input' : '#from-input').focus();
  });

  $('#clear-recent').addEventListener('click', () => { store.clearRecent(); renderSaved(); });
  const routeChips = (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const [from, to] = rm.dataset.remove.split('|');
      store.removeFavourite(from, to);
      renderSaved();
      if (state.routes) renderResult();
      return;
    }
    const chip = e.target.closest('[data-route]');
    if (!chip) return;
    const [from, to] = chip.dataset.route.split('|');
    setEnd('from', from);
    setEnd('to', to);
    planRoute();
  };
  $('#saved-routes').addEventListener('click', routeChips);
  $('#example-list').addEventListener('click', routeChips);
}

function swapEnds() {
  [state.from, state.to] = [state.to, state.from];
  const a = $('#from-input').value;
  $('#from-input').value = $('#to-input').value;
  $('#to-input').value = a;
  syncInputs();
  state.map.setEnds(state.from, state.to);
  if (state.from && state.to) planRoute();
}

function planRoute({ fromHash = false } = {}) {
  const status = $('#planner-status');
  if (!state.from || !state.to) {
    status.textContent = t('pickBoth');
    return;
  }
  const res = findRoutes(state.graph, state.from, state.to);
  if (!res) { status.textContent = t('noRoute'); return; }
  if (res.same) { status.textContent = t('samePlace'); return; }
  status.textContent = '';
  state.routes = res;
  state.tab = 'fastest';
  store.addRecent(state.from, state.to);
  track('route', `${state.from}>${state.to}`);
  const hash = `#from=${state.from}&to=${state.to}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  renderResult();
  renderSaved();
  renderCafes();
  // Highlight the route on the map straight away (without scrolling the page to it).
  requestAnimationFrame(() => state.map.focusRoute(currentRoute().legs, { animate: false }));
  if (!fromHash || window.innerWidth < 960) $('#result').scrollIntoView({ block: 'start' });
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
function currentRoute() {
  return state.tab === 'fewest' && state.routes.fewest ? state.routes.fewest : state.routes.fastest;
}

const ICON = {
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4.2M8 4.6v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/** "47 THB" when exact, "about 45 THB" for estimates. */
function money(amount, exact) {
  return exact ? t('baht', amount) : t('aboutBaht', amount);
}

function renderResult() {
  const section = $('#result');
  const inner = $('#result-inner');
  const route = currentRoute();
  const fare = priceRoute(state.data, state.graph, route.legs, state.checks);
  const from = state.graph.places.get(state.from);
  const to = state.graph.places.get(state.to);
  const total = fare.totals[state.passenger];
  state.map.showRoute(route.legs);

  const tabs = state.routes.fewest
    ? `<div class="tabs" role="tablist">
        ${['fastest', 'fewest'].map((k) => {
          const r = state.routes[k];
          return `<button type="button" class="tab" role="tab" data-tab="${k}" aria-selected="${state.tab === k}">${esc(t(k))} · ${esc(t('min', r.minutes))} · ${esc(t('changes', r.changes))}</button>`;
        }).join('')}
      </div>`
    : '';

  const fav = store.isFavourite(state.from, state.to);
  const fareValue = `${total.exact ? '' : `<span class="approx">${esc(t('aboutWord'))}</span>`}${total.amount}<small>${esc(t('unit'))}</small>`;

  const hits = alertsFor(routeScope(route));
  inner.innerHTML = `
    ${hits.length ? `<div class="route-alerts" role="note"><p class="route-alerts__title">${esc(t('alertOnRoute'))}</p>${hits.map(alertHtml).join('')}</div>` : ''}
    <div class="summary" role="group" aria-label="${esc(nameOf(from))} - ${esc(nameOf(to))}">
      <h2 class="summary__route"><span>${esc(nameOf(from))}</span>${ICON.arrow}<span>${esc(nameOf(to))}</span></h2>
      <div class="summary__stats">
        ${stat(t('totalTime'), `${route.minutes}<small>${esc(t('minutes'))}</small>`)}
        ${stat(`${t('totalFare')} · ${t(state.passenger)}`, fareValue)}
        ${stat(t('changesLabel'), String(route.changes))}
      </div>
      ${tabs}
    </div>
    <article class="card card--main journey">
      <ol class="tl">${timeline(route, from, to)}</ol>
    </article>
    <div class="side">
      <aside class="card card--main fare">${fareCard(fare)}</aside>
      <div class="card actions">
        <button type="button" class="btn" data-act="fav" aria-pressed="${fav}">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path class="star" d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          ${esc(fav ? t('saved') : t('save'))}
        </button>
        <button type="button" class="btn" data-act="return">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7h11l-3-3M16 13H5l3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${esc(t('returnTrip'))}
        </button>
        <button type="button" class="btn" data-act="share">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5l3-3M7 9.5l-2 2a2.8 2.8 0 004 4l2-2M13 10.5l2-2a2.8 2.8 0 00-4-4l-2 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          ${esc(t('share'))}
        </button>
        <button type="button" class="btn" data-act="map">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2z M7.5 3v12 M12.5 5v12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          ${esc(t('showOnMap'))}
        </button>
        <a class="btn" href="#station=${to.id}" style="grid-column:1 / -1">${esc(t('stationInfo'))}: ${esc(nameOf(to))}</a>
        <button type="button" class="btn btn--quiet" data-act="report" style="grid-column:1 / -1">${esc(t('report'))}</button>
      </div>
    </div>`;

  section.hidden = false;
  $('#empty-state').hidden = true;
  $$('[data-tab]', inner).forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    renderResult();
    state.map.focusRoute(currentRoute().legs);
  }));
  $('[data-act="fav"]', inner).addEventListener('click', () => {
    store.toggleFavourite(state.from, state.to);
    if (store.isFavourite(state.from, state.to)) track('save', `${state.from}>${state.to}`);
    renderResult();
    renderSaved();
  });
  $('[data-act="return"]', inner).addEventListener('click', swapEnds);
  $('[data-act="report"]', inner).addEventListener('click', () => openReport({
    about: `${nameOf(from)} → ${nameOf(to)}`,
    context: {
      from: state.from,
      to: state.to,
      passenger: state.passenger,
      shown: fare.parts.map((p) => ({ system: p.system, from: p.from, to: p.to, adult: p.fares.adult.amount, status: p.fares.adult.status })),
    },
    onDone: toast,
  }));
  $('[data-act="share"]', inner).addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#from=${state.from}&to=${state.to}`;
    track('share', `${state.from}>${state.to}`);
    try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { prompt('', url); }
  });
  $('[data-act="map"]', inner).addEventListener('click', () => {
    $('#network').scrollIntoView();
    requestAnimationFrame(() => state.map.focusRoute(route.legs));
  });
}

function stat(label, value) {
  return `<div class="sstat"><div class="sstat__label">${esc(label)}</div><div class="sstat__value">${value}</div></div>`;
}

function note(text, info = false) {
  return `<p class="note${info ? ' note--info' : ''}">${ICON.info}<span>${esc(text)}</span></p>`;
}

/** "Platform 2 · towards Kheha", or just "towards Kheha" when the platform isn't confirmed. */
function directionText(leg) {
  const dir = legDirection(state.graph, leg);
  const towards = dir.via ? t('towardsVia', stationName(dir.towards), stationName(dir.via)) : t('towards', stationName(dir.towards));
  return { dir, towards, platform: dir.platform ? platLabel(dir.platform.no) : null };
}

function directionHtml(d) {
  return d.platform
    ? `<span class="plat">${esc(d.platform)}</span><strong>${esc(d.towards)}</strong>`
    : `<strong>${esc(cap(d.towards))}</strong>`;
}

/** "Platform 2", or "Platforms 1, 2" when two platforms serve one direction. */
const platLabel = (no) => (String(no).includes(',') ? t('platforms', no) : t('platform', no));

const cap = (s) => (getLang() === 'en' ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Vertical timeline: a node for the start, every change and the end, with a
 * coloured rail for each ride between them.
 */
function timeline(route, from, to) {
  const legs = route.legs;
  const rides = legs.map((l, i) => ({ l, i })).filter((x) => x.l.type === 'ride');
  const out = [];
  const color = (leg) => lineOf(leg.line).color;

  // Walk before the first ride (e.g. from a place to another of its stations).
  const firstRideIdx = rides[0].i;
  const leadWalk = legs.slice(0, firstRideIdx).filter((l) => l.type === 'walk');

  // Start node
  out.push(`<li class="tl__item tl__item--start" style="--out:${leadWalk.length ? 'transparent' : color(rides[0].l)}">
    <div class="tl__rail"><span class="tl__node"></span></div>
    <div class="tl__body"><div class="tl__kicker">${esc(t('from'))}</div>
      <div class="tl__name">${esc(nameOf(from))}</div><div class="tl__alt">${esc(altNameOf(from))}</div>
      ${leadWalk.map((w) => `<div class="tl__sub">${esc(t('startWalk', stationName(w.to), w.minutes))}${w.note ? ` · ${esc(w.note)}` : ''}</div>`).join('')}
    </div></li>`);
  if (leadWalk.length) out.push(walkItem());

  rides.forEach(({ l: leg, i }, r) => {
    const line = lineOf(leg.line);
    const d = directionText(leg);
    const stopsN = leg.stations.length - 1;
    const middle = leg.stations.slice(1, -1);

    // Ride segment
    out.push(`<li class="tl__item tl__item--ride" style="--c:${line.color}">
      <div class="tl__rail"></div>
      <div class="tl__body tl__ride">
        <div>${pill(line)}</div>
        <div class="tl__plat">${directionHtml(d)}</div>
        <div class="tl__meta">
          ${leg.wait ? `<span>${esc(t('waitAbout', Math.round(leg.wait)))}</span>` : ''}
          <span>${esc(t('rideMin', Math.round(leg.minutes)))}</span>
        </div>
        ${middle.length
          ? `<details class="stops"><summary>${esc(t('stops', stopsN))}${ICON.chevron}</summary><ol>${middle.map((id) => `<li>${esc(stationName(id))}</li>`).join('')}</ol></details>`
          : `<div class="tl__meta"><span>${esc(t('stops', stopsN))}</span></div>`}
      </div></li>`);

    const exitId = leg.stations[leg.stations.length - 1];
    const next = rides[r + 1];
    if (!next) return;

    // Change node: what happens between this ride and the next.
    const between = legs.slice(i + 1, next.i).filter((l) => l.type === 'walk');
    const walkMin = between.reduce((s, w) => s + w.minutes, 0);
    const nd = directionText(next.l);
    const where = nd.platform ? t('platformLine', nd.platform, nd.towards) : nd.towards;
    const nextBoard = next.l.stations[0];
    const walkName = stationName(nextBoard) !== stationName(exitId) ? stationName(nextBoard) : null;
    const subs = [];
    if (walkName) subs.push(t('walkTo', walkName, walkMin));
    else if (walkMin) subs.push(t('walkThen', walkMin));
    between.forEach((w) => { if (w.note) subs.push(w.note); });
    out.push(`<li class="tl__item tl__item--change" style="--in:${line.color};--out:${color(next.l)}">
      <div class="tl__rail"><span class="tl__node"></span></div>
      <div class="tl__body">
        <div class="tl__kicker">${esc(t('getOffKicker'))}</div>
        <div class="tl__name">${esc(stationName(exitId))}</div>
        <div class="tl__change">
          <div>${esc(nd.platform ? t('changeAtGo', stationName(exitId), where) : t('changeAtTake', stationName(exitId), where))}</div>
          ${subs.length ? `<div class="tl__sub">${esc(subs.join(' · '))}</div>` : ''}
        </div>
      </div></li>`);
  });

  // Walk after the last ride (to another station of the destination place).
  const last = rides[rides.length - 1];
  const tailWalk = legs.slice(last.i + 1).filter((l) => l.type === 'walk');
  if (tailWalk.length) out.push(walkItem());
  out.push(`<li class="tl__item tl__item--end" style="--in:${tailWalk.length ? 'transparent' : color(last.l)}">
    <div class="tl__rail"><span class="tl__node"></span></div>
    <div class="tl__body"><div class="tl__kicker">${esc(t('arrive'))}</div>
      <div class="tl__name">${esc(nameOf(to))}</div><div class="tl__alt">${esc(altNameOf(to))}</div>
      ${tailWalk.map((w) => `<div class="tl__sub">${esc(t('walkTo', stationName(w.to), w.minutes))}</div>`).join('')}
    </div></li>`);
  return out.join('');
}

function walkItem() {
  return '<li class="tl__item tl__item--walk" aria-hidden="true"><div class="tl__rail"></div><div class="tl__body" style="padding:6px 0"></div></li>';
}

/** Fare card: every operator's fare for adult, student and senior, with its status. */
function fareCard(fare) {
  const th = getLang() === 'th';
  const cell = (type, f, exact) => `
    <div class="fcell${type === state.passenger ? ' is-me' : ''}">
      <div class="fcell__k">${esc(t(type))}</div>
      <div class="fcell__v">${exact ? '' : `<span class="approx">${esc(t('aboutWord'))}</span>`}${f}</div>
    </div>`;

  const statusTags = (fares) => {
    const groups = new Map();
    for (const type of PASSENGERS) {
      const s = fares[type].status;
      const key = s === 'checked' ? `checked|${fares[type].checked_on || ''}` : s;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t(type));
    }
    const all = groups.size === 1;
    return [...groups.entries()].map(([key, types]) => {
      const [s, date] = key.split('|');
      const label = s === 'official' ? t('official') : s === 'checked' ? `${t('checkedAt')}${date ? ` (${date})` : ''}` : t('estimate');
      const icon = s === 'estimate' ? '' : ICON.check;
      return `<span class="tag tag--${s}">${icon}${esc(all ? label : `${label}: ${types.join(', ')}`)}</span>`;
    }).join(' ');
  };

  const parts = fare.parts.map((p) => `
    <div class="fare__part">
      <div class="fare__op">${p.lines.map((l) => `<i class="dot" style="background:${lineOf(l).color}"></i>`).join('')}<span>${esc(th ? p.name_th : p.name_en)}</span></div>
      <div class="fare__route">${esc(stationName(p.from))} &rarr; ${esc(stationName(p.to))}</div>
      <div class="fare__grid">${PASSENGERS.map((type) => cell(type, p.fares[type].amount, p.fares[type].status !== 'estimate')).join('')}</div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${statusTags(p.fares)}</div>
    </div>`).join('');

  const totals = fare.parts.length > 1
    ? `<div class="fare__total"><div class="fare__title">${esc(t('fareTotal'))}</div>
        <div class="fare__grid">${PASSENGERS.map((type) => cell(type, fare.totals[type].amount, fare.totals[type].exact)).join('')}</div></div>`
    : '';

  // Child notes, once each (BTS and Gold share theirs).
  const childSeen = new Set();
  const childNotes = fare.parts.map((p) => p.child).filter((c) => {
    if (!c || childSeen.has(c.en)) return false;
    childSeen.add(c.en);
    return true;
  }).map((c) => note(`${th ? c.th : c.en}${c.confirmed === false ? ` ${t('childReported')}` : ''}`, true)).join('');

  const anyEstimate = fare.parts.some((p) => PASSENGERS.some((type) => p.fares[type].status === 'estimate'));
  return `
    <div class="fare__head"><h3 class="fare__title">${esc(t('fareBreakdown'))}</h3></div>
    ${parts}
    ${totals}
    ${anyEstimate ? note(`${t('estimateNote')}`) : ''}
    ${childNotes}
    ${fare.dailyCap ? note(th ? fare.dailyCap.note_th || fare.dailyCap.note : fare.dailyCap.note, true) : ''}`;
}

// ---------------------------------------------------------------------------
// Cafés near destination
// ---------------------------------------------------------------------------
function placePoints(placeId) {
  const place = state.graph.places.get(placeId);
  return place.stations.map((id) => stationOf(id));
}

function cafeCards(near) {
  return near.map(({ cafe, m }) => `
    <li><a class="cafe" href="${esc(kafeLink(cafe))}" target="_blank" rel="noopener" data-cafe="${esc(cafe.id)}">
      <span class="cafe__top"><span class="cafe__name">${esc(cafe.name)}</span><span class="cafe__dist">${esc(t('km', m))}</span></span>
      ${cafe.description ? `<span class="cafe__desc">${esc(cafe.description)}</span>` : ''}
      <span class="cafe__more">${esc(t('onKafe'))}</span>
    </a></li>`).join('');
}

function renderCafes() {
  const section = $('#cafes');
  if (!state.cafes || !state.to || !state.routes) { section.hidden = true; return; }
  const near = cafesNear(state.cafes, placePoints(state.to));
  $('#cafes-title').textContent = `${t('nearDest')}: ${nameOf(state.graph.places.get(state.to))}`;
  $('#cafe-list').innerHTML = near.length ? cafeCards(near) : `<li class="muted">${esc(t('noCafes'))}</li>`;
  section.hidden = false;
}

// ---------------------------------------------------------------------------
// Saved trips, recent stations, examples
// ---------------------------------------------------------------------------
function routeLabel(r) {
  const a = state.graph.places.get(r.from);
  const b = state.graph.places.get(r.to);
  return a && b ? { a: nameOf(a), b: nameOf(b) } : null;
}

function routeChip(r, removable) {
  const { a, b } = routeLabel(r);
  const key = `${r.from}|${r.to}`;
  return `<li class="chip-row"><button type="button" class="chip" data-route="${key}"><span>${esc(a)}</span><span class="chip__arrow">&rarr;</span><span>${esc(b)}</span></button>${removable ? `<button type="button" class="chip-x" data-remove="${key}" aria-label="${esc(t('remove'))}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>` : ''}</li>`;
}

function renderSaved() {
  const favs = store.getFavourites().filter(routeLabel);
  const recent = store.getRecent().filter(routeLabel);
  $('#fav-group').hidden = !favs.length;
  $('#recent-group').hidden = !recent.length;
  $('#saved-routes').hidden = !favs.length && !recent.length;
  $('#fav-list').innerHTML = favs.map((r) => routeChip(r, true)).join('');
  $('#recent-list').innerHTML = recent.map((r) => routeChip(r, false)).join('');
}

function renderQuick() {
  const ids = store.getRecentStations().filter((id) => state.graph.places.has(id));
  $('#quick-stations').hidden = !ids.length;
  $('#quick-list').innerHTML = ids.map((id) => {
    const place = state.graph.places.get(id);
    const colors = [...new Set(place.stations.map((s) => lineOf(stationOf(s).line).color))];
    return `<li><button type="button" class="qchip" data-place="${id}"><span class="qchip__dots" aria-hidden="true">${colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>${esc(nameOf(place))}</button></li>`;
  }).join('');
}

function renderExamples() {
  $('#example-list').innerHTML = EXAMPLES
    .map(([from, to]) => ({ from, to }))
    .filter(routeLabel)
    .map((r) => routeChip(r, false)).join('');
}

// ---------------------------------------------------------------------------
// Legend and fares section
// ---------------------------------------------------------------------------
function renderLegend() {
  $('#legend').innerHTML = state.data.lines.map((l) => `<li>${pill(l)}</li>`).join('');
}

function sourceLinks(list) {
  return list.map((s) => {
    const url = typeof s === 'string' ? s : s.url;
    const label = typeof s === 'string' ? s.replace(/^https?:\/\/(www\.)?/, '') : s.label;
    return `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a></li>`;
  }).join('');
}

function renderFares() {
  const f = state.data.fares;
  const th = getLang() === 'th';
  const cards = Object.values(f.systems).map((s) => {
    const statuses = new Set(Object.values(s.status || {}));
    const tag = statuses.size === 1 && statuses.has('official')
      ? `<span class="tag tag--official">${ICON.check}${esc(t('officialTables'))}</span>`
      : statuses.has('official')
        ? `<span class="tag tag--estimate">${esc(t('partly'))}</span>`
        : `<span class="tag tag--estimate">${esc(t('estimate'))}</span>`;
    return `<article class="card fare-card">
      <h3><span class="fare-card__lines">${s.lines.map((l) => `<i style="background:${lineOf(l).color}"></i>`).join('')}</span>${esc(th ? s.name_th : s.name_en)}</h3>
      <div>${tag}</div>
      <p>${esc(th ? s.note_th || s.note : s.note)}</p>
      ${s.effective ? `<p class="muted">${esc(t('effectiveFrom', s.effective))}</p>` : ''}
      ${s.child ? `<p class="muted">${esc(th ? s.child.th : s.child.en)}${s.child.confirmed === false ? ` ${esc(t('childReported'))}` : ''}</p>` : ''}
      <div class="sources">${esc(t('sources'))}<ul>${sourceLinks(s.sources || [])}</ul></div>
    </article>`;
  }).join('');

  const cap = f.dailyCap ? [{ en: f.dailyCap.note, th: f.dailyCap.note_th }] : [];
  const notes = [...f.upcoming, ...f.notes, ...cap].map((n) => `<div class="card">${esc(th ? n.th : n.en)}${n.sources ? `<div class="sources"><ul>${sourceLinks(n.sources)}</ul></div>` : ''}</div>`).join('');

  $('#fares-inner').innerHTML = `
    <div class="section-head">
      <h2 id="fares-title">${esc(t('faresTitle'))}</h2>
      <p class="muted">${esc(t('faresLead'))}</p>
      <p class="checked">${ICON.check.replace('<svg', '<svg width="16" height="16"')}${esc(t('checkedOn', f.checked_on))}</p>
    </div>
    <div class="fare-grid">${cards}</div>
    <h3 class="fare__title" style="margin-top:24px">${esc(t('upcoming'))}</h3>
    <div class="fare-notes">${notes}</div>`;
}

// ---------------------------------------------------------------------------
// Station view
// ---------------------------------------------------------------------------
function currentStationId() {
  return new URLSearchParams(location.hash.slice(1)).get('station');
}

/** "Wikipedia (English)" etc., in the current language. */
function srcLabel(src) {
  const label = src.label || src.url.replace(/^https?:\/\//, '').split('/')[0];
  if (getLang() !== 'th') return label;
  return label.replace('Wikipedia (English)', 'วิกิพีเดีย (อังกฤษ)').replace('Wikipedia (Thai)', 'วิกิพีเดีย (ไทย)');
}

/** Platforms per line; without confirmed numbers, just the two directions. */
function platformsHtml(nodes) {
  return nodes.map((s) => {
    const line = lineOf(s.line);
    const plats = stationPlatforms(s);
    let body;
    if (plats.length) {
      body = `<ul class="plats__list">${plats.map((p) => {
        const dir = p.via ? t('towardsVia', stationName(p.towards), stationName(p.via)) : t('towards', stationName(p.towards));
        return `<li><span class="plat">${esc(platLabel(p.no))}</span><span>${esc(dir)}</span><span class="tl__sub">${esc(t('nextStation', stationName(p.next)))}</span></li>`;
      }).join('')}</ul>`;
      const srcs = s.platform_sources || [];
      if (srcs.length) {
        body += `<p class="plats__src">${esc(t('platformSource'))}: ${srcs.map((src) => `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(srcLabel(src))}</a>`).join(', ')}</p>`;
      }
    } else {
      // Neighbours on this line, each with the direction a train heads in.
      const nbrs = new Set();
      for (const path of line.paths) {
        path.forEach((id, i) => {
          if (id !== s.id) return;
          if (path[i - 1] && path[i - 1] !== s.id) nbrs.add(path[i - 1]);
          if (path[i + 1] && path[i + 1] !== s.id) nbrs.add(path[i + 1]);
        });
      }
      const dirs = [...nbrs].map((n) => {
        const d = terminusOf(state.graph, s.line, s.id, n);
        const dir = d.via ? t('towardsVia', stationName(d.towards), stationName(d.via)) : t('towards', stationName(d.towards));
        return `<li><span>${esc(cap(dir))}</span><span class="tl__sub">${esc(t('nextStation', stationName(n)))}</span></li>`;
      }).join('');
      body = `<ul class="plats__list">${dirs}</ul><p class="plats__src">${esc(t('platformsNone'))}</p>`;
    }
    return `<div class="plats__line"><div>${pill(line)} <span class="muted" style="font-size:13px">${esc(s.code)}</span></div>${body}</div>`;
  }).join('');
}

function renderStation(placeId) {
  const view = $('#view-station');
  const place = placeId && state.graph.places.get(placeId);
  if (!place) { go('#plan'); return; }
  const nodes = place.stations.map((id) => stationOf(id));
  const th = getLang() === 'th';

  const linesHtml = nodes.map((s) => {
    const line = lineOf(s.line);
    return `<li>${pill(line)}<span class="badge" style="background:${line.color};color:${line.text}">${esc(s.code)}</span><span class="muted">${esc(line.operator)}</span></li>`;
  }).join('');

  // Each connection once (Siam's Sukhumvit<->Silom change would otherwise
  // be listed from both sides).
  const seen = new Set();
  const changes = nodes.flatMap((s) => s.interchanges.map((ic) => ({ from: s, ic })))
    .filter(({ from, ic }) => {
      const key = [from.id, ic.to].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const changesHtml = changes.map(({ from, ic }) => {
    const other = stationOf(ic.to);
    const line = lineOf(other.line);
    return `<li>${pill(line)}<span>${esc(nameOf(other))}<br><span class="muted">${esc(ic.kind === 'walk' ? t('walkTransfer') : t('sameStation'))} · ${esc(t('min', ic.minutes))} (${esc(from.code)})</span></span></li>`;
  }).join('');

  const exits = nodes.flatMap((s) => s.exits);
  const uniqExits = exits.filter((e, i) => exits.findIndex((x) => x.en === e.en) === i);
  const exitsHtml = uniqExits.length
    ? `<ul class="station__list">${uniqExits.map((e) => `<li>${e.ref ? `<span class="ref">${th ? 'ทางออก' : 'Exit'} ${esc(e.ref)}</span>` : ''}<span>${esc(th ? e.th : e.en)}</span></li>`).join('')}</ul>`
    : `<p class="muted">${esc(t('noExits'))}</p>`;

  let cafesHtml = '';
  if (state.cafes) {
    const near = cafesNear(state.cafes, nodes, 6);
    cafesHtml = `<div class="card"><h2>${esc(t('nearbyCafes'))}</h2>${near.length ? `<ul class="cafe-grid">${cafeCards(near)}</ul>` : `<p class="muted">${esc(t('noCafes'))}</p>`}</div>`;
  }

  const stationAlerts = alertsFor({ lines: nodes.map((s) => s.line), stations: nodes.map((s) => s.id) });
  track('station', placeId);
  const first = nodes[0];
  const mapsQuery = encodeURIComponent(`${lineOf(first.line).short} ${first.name_en} station, Bangkok`);
  view.innerHTML = `
    <section class="station"><div class="wrap">
      <a class="btn btn--small station__back" href="#plan">&larr; ${esc(t('back'))}</a>
      <div class="station__head">
        <h1>${esc(nameOf(place))}</h1>
        <p class="station__alt">${esc(altNameOf(place))}</p>
        <div class="badges" style="margin-top:12px">${badgesHtml(place)}</div>
      </div>
      <div class="station__actions">
        <button type="button" class="btn btn--primary" data-act="from">${esc(t('routeFromHere'))}</button>
        <button type="button" class="btn" data-act="to">${esc(t('routeToHere'))}</button>
        <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}" target="_blank" rel="noopener">${esc(t('openMaps'))}</a>
      </div>
      ${stationAlerts.length ? `<div class="route-alerts station__alerts" role="note"><p class="route-alerts__title">${esc(t('alertAtStation'))}</p>${stationAlerts.map(alertHtml).join('')}</div>` : ''}
      <div class="station__grid">
        <div class="card card--main"><h2>${esc(t('stationPlatforms'))}</h2><div class="plats">${platformsHtml(nodes)}</div></div>
        <div class="card"><h2>${esc(t('stationLines'))}</h2><ul class="station__lines">${linesHtml}</ul></div>
        ${changesHtml ? `<div class="card"><h2>${esc(t('stationChanges'))}</h2><ul class="station__lines">${changesHtml}</ul></div>` : ''}
        <div class="card"><h2>${esc(t('stationExits'))}</h2>${exitsHtml}</div>
        ${cafesHtml}
      </div>
      <p class="station__report"><button type="button" class="linkbtn" data-report>${esc(t('reportStation'))}</button></p>
    </div></section>`;
  $('[data-report]', view).addEventListener('click', () => openReport({
    about: nameOf(place),
    kind: 'station',
    context: { station: placeId, shown: [] },
    onDone: toast,
  }));

  $$('[data-act]', view).forEach((b) => b.addEventListener('click', () => {
    setEnd(b.dataset.act, placeId, true);
    go('#plan');
    if (state.from && state.to) planRoute();
    else $(b.dataset.act === 'from' ? '#to-input' : '#from-input').focus();
  }));
  document.title = `${nameOf(place)} - Metro Buddy`;
}

// ---------------------------------------------------------------------------
// Hash routing: #from=..&to=.. | #station=.. | #plan #network #fares
// ---------------------------------------------------------------------------
function go(hash) {
  if (location.hash === hash) readHash();
  else location.hash = hash;
}

function resolvePlace(value) {
  if (!value) return null;
  if (state.graph.places.has(value)) return value;
  const st = state.graph.stations.get(value.toUpperCase());
  return st ? st.place : null;
}

function readHash() {
  const raw = location.hash.slice(1);
  const params = new URLSearchParams(raw);
  const mainView = $('#view-main');
  const stationView = $('#view-station');

  if (params.has('station')) {
    mainView.hidden = true;
    stationView.hidden = false;
    renderStation(resolvePlace(params.get('station')));
    window.scrollTo(0, 0);
    return;
  }
  document.title = 'Metro Buddy - Bangkok rail route finder';
  const wasStation = !stationView.hidden;
  stationView.hidden = true;
  mainView.hidden = false;

  if (params.has('from') || params.has('to')) {
    const from = resolvePlace(params.get('from'));
    const to = resolvePlace(params.get('to'));
    if (from) setEnd('from', from);
    if (to) setEnd('to', to);
    if (from && to) planRoute({ fromHash: true });
    return;
  }
  if (raw && document.getElementById(raw)) {
    document.getElementById(raw).scrollIntoView();
  } else if (wasStation) {
    window.scrollTo(0, 0);
  }
}

// ---------------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}
