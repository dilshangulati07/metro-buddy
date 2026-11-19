// map-layout.js - hand-made schematic positions for the network map.
//
// Each line lists its track in order. An item is either
//   'ID'          a station placed automatically between its neighbours
//   'ID@x,y'      a station pinned to a position
//   '@x,y'        a bend in the track (no station)
// Unpinned stations are spread evenly (by track length) between the
// nearest pinned points, which keeps spacing tidy and lines at 0/45/90deg.
//
// Label positions: r, l, t, b (horizontal text) or
// tr, br, tl, bl (text at 45 degrees). Each line has a default; `labels`
// overrides single stations.

export const MAP_SIZE = { width: 1310, height: 1290 };
export const OFFSET_Y = 140;

// Widen the crowded north-centre: everything from the Red Line eastwards
// moves right, and again from the Sukhumvit trunk eastwards.
const shiftX = (x) => x + (x >= 455 ? 25 : 0) + (x >= 500 ? 25 : 0);

export const LAYOUT = {
  sukhumvit: {
    label: 'r',
    paths: [[
      'N24@680,-40', 'N23', 'N22', 'N21', 'N20', 'N19', 'N18', 'N17@540,90',
      'N16', 'N15', 'N14', 'N13', 'N12', 'N11', 'N10', 'N9@540,340',
      'N8@540,420', 'N7', 'N5', 'N4', 'N3', 'N2@540,580', 'N1', 'CEN@540,640',
      'E1', 'E2', 'E3', 'E4@700,640', 'E5', 'E6', 'E7', 'E8', 'E9@900,640',
      '@980,720', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15@980,900',
      'E16', 'E17', 'E18', 'E19', 'E20', 'E21', 'E22', 'E23@980,1120',
    ]],
    labels: {
      E1: 'br', E2: 'br', E3: 'br', E4: 'tl', E5: 'br', E6: 'br', E7: 'br', E8: 'br', E9: 'tr',
      E10: 'l', E11: 'l', E12: 'l', E13: 'l', E14: 'l', E15: 'l', E16: 'l', E17: 'l', E18: 'l', E19: 'l', E20: 'l', E21: 'l', E22: 'l', E23: 'l',
      N8: 'r', N1: 'r', N2: 'tr', N9: 'r', CEN: 'tr', N17: 'br!',
      N18: 'l', N19: 'l', N20: 'l', N21: 'l', N22: 'l', N23: 'l', N24: 'r',
      N10: 'r', N11: 'r', N12: 'r', N13: 'r', N14: 'r', N15: 'r', N16: 'r',
      N7: 'r', N5: 'r', N4: 'r', N3: 'r',
    },
  },
  silom: {
    label: 'r',
    paths: [[
      'W1@460,640', 'CEN-SL@540,640', 'S1@580,680', 'S2@580,736', 'S3@580,800',
      'S4', 'S5@520,860', 'S6@450,860', 'S7@380,860', 'S8@320,860',
      'S9', 'S10', 'S11', '@220,860', 'S12@160,800',
    ]],
    labels: { W1: 't', S2: 'l', S4: 'r', S5: 'b', S6: 'b', S7: 'b', S8: 'b', S9: 'b', S10: 'b', S11: 'b', S12: 'bl' },
  },
  gold: {
    label: 'r',
    paths: [['G1@380,860', 'G2@410,830', 'G3@440,800']],
    labels: { G1: 'b', G2: 'r', G3: 'r' },
  },
  blue: {
    label: 'r',
    paths: [
      [
        'BL01@240,720', 'BL02', 'BL03', 'BL04', 'BL05', 'BL06@240,540',
        'BL07', 'BL08', 'BL09', 'BL10@360,420', 'BL11@420,420', 'BL12', 'BL13@510,420',
        'BL14@510,340', '@510,293', 'BL15@640,293', 'BL16@720,373',
        'BL17', 'BL18', 'BL19', 'BL20', 'BL21@720,600', 'BL22@720,664', 'BL23@720,720',
        'BL24@680,760', 'BL25', 'BL26@610,760', 'BL27', 'BL28', 'BL29', 'BL30', 'BL31@290,760',
        '@280,760', 'BL32', '@240,720',
      ],
      ['BL01@240,720', 'BL33', 'BL34@160,800', 'BL35', 'BL36', 'BL37', 'BL38@40,800'],
    ],
    labels: {
      BL01: 'r', BL02: 'l', BL03: 'l', BL04: 'l', BL05: 'l', BL06: 'l', BL07: 'tl', BL08: 'tl', BL09: 'tl', BL10: 'b',
      BL11: 'b', BL12: 'b', BL13: 'l', BL14: 'l', BL15: 'tl',
      BL24: 'b', BL25: 'b', BL26: 'b', BL27: 'b', BL28: 'b', BL29: 'b', BL30: 'b', BL31: 'b', BL32: 'bl', BL33: 'r',
      BL34: 'bl', BL35: 'b', BL36: 'b', BL37: 'b', BL38: 'b', BL22: 'r', BL23: 'r', BL21: 'r',
    },
  },
  purple: {
    label: 'bl',
    paths: [[
      'PP01@50,200', 'PP02', 'PP03', 'PP04', 'PP05', 'PP06', 'PP07', 'PP08', 'PP09', 'PP10',
      'PP11@290,200', 'PP12', 'PP13', 'PP14', '@290,340', 'PP15@330,380', 'PP16@360,420',
    ]],
    labels: { PP11: 'r', PP12: 'r', PP13: 'r', PP14: 'r', PP15: 'tl', PP16: 'b' },
  },
  pink: {
    label: 'tr',
    paths: [
      [
        'PK01@290,200', 'PK02', 'PK03', 'PK04', 'PK05', 'PK06@290,-10',
        'PK07', 'PK08', 'PK09', 'PK10@385,-10', 'PK11', 'PK12', 'PK13', 'PK14@460,90', 'PK15', 'PK16@540,90',
        'PK17', 'PK18', 'PK19', 'PK20', 'PK21', 'PK22', 'PK23', 'PK24', 'PK25', 'PK26', 'PK27', 'PK28', 'PK29', 'PK30@1110,90',
      ],
      ['PK10', 'MT01', 'MT02'],
    ],
    labels: {
      PK01: 'r', PK02: 'l', PK03: 'l', PK04: 'l', PK05: 'l', PK06: 'tl',
      PK07: 'tl!', PK08: 'tl!', PK09: 'tl!', PK10: 'bl!', PK11: 'bl', PK12: 'bl', PK13: 'bl', PK14: 'tr', PK15: 'tr',
      MT01: 'r', MT02: 'r',
    },
  },
  arl: {
    label: 'b',
    paths: [['A8@540,580', 'A7', 'A6@680,580', 'A5', 'A4@1040,580', 'A3', 'A2', '@1180,580', 'A1@1220,620']],
    labels: { A8: 'tr', A7: 'tr', A6: 'tr', A5: 'tr', A4: 'r', A3: 'tr', A2: 'tr', A1: 'b' },
  },
  yellow: {
    label: 'r',
    paths: [[
      'YL01@640,293', 'YL02', 'YL03', 'YL04', 'YL05', 'YL06', 'YL07', '@1000,293', '@1040,333', 'YL08', 'YL09', 'YL10',
      'YL11@1040,580', 'YL12', 'YL13', 'YL14', 'YL15', 'YL16', 'YL17', 'YL18', 'YL19', 'YL20',
      '@1040,840', 'YL21', 'YL22', 'YL23@980,900',
    ]],
    labels: { YL01: 'tl', YL02: 'tr', YL03: 'tr', YL04: 'tr', YL05: 'tr', YL06: 'tr', YL07: 'tr', YL21: 'r', YL22: 'r', YL23: 'l' },
  },
  red: {
    label: 'l',
    paths: [['RN10@460,10', 'RN09', 'RN08', 'RN07', 'RN06@460,90', 'RN05', 'RN04', 'RN03', 'RN02', 'RN01@460,380']],
    labels: { RN01: 'tr', RN06: 'b', RN02: 'l', RN03: 'l', RN04: 'l', RN05: 'l', RN07: 'r', RN08: 'r', RN09: 'r', RN10: 'r' },
  },
  'red-light': {
    label: 'b',
    paths: [['RW06@110,380', 'RW05@220,380', 'RW02@330,380', 'RW01@460,380']],
    labels: { RW02: 'tl', RW01: 'tr' },
  },
};

/**
 * Work out x/y for every station and the drawn polyline for every path.
 * Returns { pos: Map(id -> {x, y, label}), polylines: [{ line, points }] }.
 */
export function computeLayout() {
  const pos = new Map();
  const polylines = [];
  const segGeom = new Map(); // "a|b" -> [[x,y]...] following the track

  for (const [line, spec] of Object.entries(LAYOUT)) {
    for (const path of spec.paths) {
      const items = path.map(parseItem);
      // A branch whose first station was placed by an earlier path starts
      // there; its other stations step straight up into empty space.
      if (!items[0].pinned && pos.has(items[0].id)) {
        const start = pos.get(items[0].id);
        items.forEach((it, i) => {
          it.x = start.x;
          it.y = start.y - OFFSET_Y - i * 28;
          it.pinned = true;
        });
      }
      // Index of pinned items (stations with coordinates or bends).
      const pinned = items.map((it, i) => (it.x !== undefined ? i : -1)).filter((i) => i >= 0);
      // Place unpinned items between consecutive pins.
      for (let k = 0; k + 1 < pinned.length; k++) {
        const a = pinned[k];
        const b = pinned[k + 1];
        const between = items.slice(a + 1, b);
        if (between.some((it) => it.x !== undefined)) continue;
        const stationsBetween = between.length;
        if (stationsBetween === 0) continue;
        const p0 = items[a];
        const p1 = items[b];
        for (let j = 0; j < stationsBetween; j++) {
          const t = (j + 1) / (stationsBetween + 1);
          between[j].x = p0.x + (p1.x - p0.x) * t;
          between[j].y = p0.y + (p1.y - p0.y) * t;
        }
      }
      // Bends inside a run of unpinned stations: spread by length along
      // the bent polyline instead (handled by distributeAlong).
      distributeAlong(items);

      // Free stations sit on the straight runs between pinned points, so
      // the drawn track only needs the pinned points (stations and bends).
      const points = items.filter((it) => it.pinned).map((it) => [it.x, it.y + OFFSET_Y]);
      polylines.push({ line, points });
      addSegmentGeometry(items, points, segGeom);
      for (const it of items) {
        if (!it.id) continue;
        if (!pos.has(it.id)) pos.set(it.id, { x: it.x, y: it.y + OFFSET_Y, label: spec.labels?.[it.id] || spec.label, line });
      }
    }
  }
  return { pos, polylines, segGeom };
}

// For each pair of neighbouring stations, store the drawn points between
// them (including any bends) so a highlighted route follows the track.
function addSegmentGeometry(items, points, segGeom) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  // Arc length of a point lying on the polyline.
  const along = (x, y) => {
    let bestD = Infinity;
    let bestS = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const len = cum[i + 1] - cum[i] || 1;
      let t = ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / (len * len);
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x0 + (x1 - x0) * t - x, y0 + (y1 - y0) * t - y);
      if (d < bestD - 1e-6) { bestD = d; bestS = cum[i] + t * len; }
    }
    return bestS;
  };
  const stations = items.filter((it) => it.id).map((it) => ({ id: it.id, x: it.x, y: it.y + OFFSET_Y }));
  let prevS = -1;
  for (const st of stations) {
    // On a loop the first station is also the end; keep arc length rising.
    let s = along(st.x, st.y);
    if (s <= prevS) s = cum[cum.length - 1];
    st.s = s;
    prevS = s;
  }
  for (let i = 0; i + 1 < stations.length; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    const mid = points.filter((p, k) => cum[k] > a.s + 0.01 && cum[k] < b.s - 0.01);
    const geom = [[a.x, a.y], ...mid, [b.x, b.y]];
    segGeom.set(`${a.id}|${b.id}`, geom);
    segGeom.set(`${b.id}|${a.id}`, [...geom].reverse());
  }
  // Close the Blue Line loop (last listed station back to the first).
  const first = stations[0];
  const last = stations[stations.length - 1];
  const end = points[points.length - 1];
  if (Math.hypot(end[0] - first.x, end[1] - first.y) < 0.5 && last.id !== first.id) {
    const mid = points.filter((p, k) => cum[k] > last.s + 0.01);
    const geom = [[last.x, last.y], ...mid];
    segGeom.set(`${last.id}|${first.id}`, geom);
    segGeom.set(`${first.id}|${last.id}`, [...geom].reverse());
  }
}

function parseItem(s) {
  const [id, xy] = s.split('@');
  const it = { id: id || null };
  if (xy) {
    const [x, y] = xy.split(',').map(Number);
    it.x = shiftX(x);
    it.y = y;
    it.pinned = true;
  }
  return it;
}

// For a run "pinnedStation, s, s, bend, s, s, pinnedStation" place the
// unpinned stations evenly along the whole bent route.
function distributeAlong(items) {
  const anchors = items.map((it, i) => (it.pinned && it.id ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k + 1 < anchors.length; k++) {
    const a = anchors[k];
    const b = anchors[k + 1];
    const run = items.slice(a, b + 1);
    const bends = run.filter((it) => it.pinned && !it.id);
    if (bends.length === 0) continue;
    const corners = run.filter((it) => it.pinned);
    const free = run.filter((it) => !it.pinned);
    if (free.length === 0) continue;
    const seg = [];
    let total = 0;
    for (let i = 0; i + 1 < corners.length; i++) {
      const len = Math.hypot(corners[i + 1].x - corners[i].x, corners[i + 1].y - corners[i].y);
      seg.push(len);
      total += len;
    }
    free.forEach((it, j) => {
      let d = (total * (j + 1)) / (free.length + 1);
      let i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i += 1; }
      const t = seg[i] === 0 ? 0 : d / seg[i];
      it.x = corners[i].x + (corners[i + 1].x - corners[i].x) * t;
      it.y = corners[i].y + (corners[i + 1].y - corners[i].y) * t;
    });
  }
}
