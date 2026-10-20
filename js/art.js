// Cold War 2: 2030 — artwork. Units, structures and scenery are small 3D models built from
// shaded prisms, projected isometrically and pre-rendered into sprite caches (32 facings for
// anything that turns, like the voxel units of the classic RTS games).
'use strict';

// ---------- projection & colour helpers ----------
// world (x, y on the ground, z up) -> screen offset; a 32px tile becomes a 64x32 diamond
function isoX(x, y) { return x - y; }
function isoY(x, y, z) { return (x + y) / 2 - z; }

const FACINGS = 32;
function facingIndex(a) { return ((Math.round(a / (Math.PI * 2) * FACINGS) % FACINGS) + FACINGS) % FACINGS; }

const RGB_CACHE = new Map();
function hexRgb(hex) {
  let v = RGB_CACHE.get(hex);
  if (v) return v;
  if (hex.startsWith('rgb')) v = hex.match(/[\d.]+/g).slice(0, 3).map(Number);
  else {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const n = parseInt(c, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  RGB_CACHE.set(hex, v);
  return v;
}
function tone(hex, amt) { // amt < 0 darkens, > 0 lightens
  const [r, g, b] = hexRgb(hex), f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return `rgb(${Math.round((f - r) * p + r)},${Math.round((f - g) * p + g)},${Math.round((f - b) * p + b)})`;
}
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function shade(hex, amt) { return tone(hex, amt); }
function lit(rgb, k) { return `rgb(${Math.min(255, rgb[0] * k) | 0},${Math.min(255, rgb[1] * k) | 0},${Math.min(255, rgb[2] * k) | 0})`; }

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

// ---------- the prism renderer ----------
const LIGHT = (() => { const v = [-0.5, 0.65, 1], l = Math.hypot(...v); return v.map(c => c / l); })();

// primitives, in model space: x forward, y right, z up (pixels)
function box(x0, x1, y0, y1, z0, z1, color, o) { return Object.assign({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color }, o); }
function prism(pts, top, z0, z1, color, o) { return Object.assign({ pts, top, z0, z1, color }, o); }
function cyl(cx, cy, r, z0, z1, color, rt = r, n = 10, o) {
  const ring = rr => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + Math.PI / n; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
  return Object.assign({ pts: ring(r), top: ring(rt), z0, z1, color }, o);
}
// shrink a polygon towards its centroid (for sloped armour and roofs)
function inset(pts, k, dx = 0, dy = 0) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy]);
}

// rotate/scale/translate parts into world-space prisms
function place(parts, ang = 0, dx = 0, dy = 0, dz = 0, scale = 1) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const tf = (x, y, z) => [(x * c - y * s) * scale + dx, (x * s + y * c) * scale + dy, z * scale + dz];
  return parts.map(p => ({
    p,
    B: p.pts.map(([x, y]) => tf(x, y, p.z0)),
    T: (p.top || p.pts).map(([x, y]) => tf(x, y, p.z1)),
  }));
}

function paintPrisms(ctx, prisms, ox, oy) {
  for (const q of prisms) {
    let cx = 0, cy = 0, cz = 0;
    for (const v of q.B.concat(q.T)) { cx += v[0]; cy += v[1]; cz += v[2]; }
    const n = q.B.length * 2;
    q.c = [cx / n, cy / n, cz / n];
    // painter's order: further back first; parts standing on others (higher base) later
    q.depth = (cx + cy) / n + cz / n + 1.5 * Math.min(...q.B.map(v => v[2])) + (q.p.order || 0);
  }
  prisms.sort((a, b) => a.depth - b.depth);
  for (const q of prisms) paintPrism(ctx, q, ox, oy);
}

let CAMO_SEED = 1;
function paintPrism(ctx, q, ox, oy) {
  const { B, T, p, c } = q, n = B.length;
  const pr = v => [ox + v[0] - v[1], oy + (v[0] + v[1]) / 2 - v[2]];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = B[i], b = B[j], d = T[i];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const mx = (a[0] + b[0] + T[j][0] + d[0]) / 4 - c[0], my = (a[1] + b[1] + T[j][1] + d[1]) / 4 - c[1], mz = (a[2] + b[2] + T[j][2] + d[2]) / 4 - c[2];
    if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    if (nx + ny + nz <= 1e-6) continue; // facing away from the camera
    const l = Math.hypot(nx, ny, nz) || 1;
    face(ctx, [pr(a), pr(b), pr(T[j]), pr(d)], [nx / l, ny / l, nz / l], p, false);
  }
  face(ctx, T.map(pr), [0, 0, 1], p, true);
}

function face(ctx, pts, nrm, p, top) {
  const col = hexRgb(top && p.topColor ? p.topColor : p.color);
  const k = p.light ? 1.08 : 0.5 + 0.62 * Math.max(0, nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]);
  poly(ctx, pts);
  ctx.fillStyle = lit(col, k);
  ctx.fill();
  if (p.camo && !(top && p.topColor)) {
    ctx.save(); ctx.clip();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const r = makeRng(CAMO_SEED++);
    const w = x1 - x0, h = y1 - y0;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = lit(hexRgb(p.camo[i % 2]), k);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(x0 + r() * w, y0 + r() * h, 1 + r() * w * 0.3, 1 + r() * h * 0.3, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    poly(ctx, pts);
  }
  if (p.edge !== false) {
    ctx.strokeStyle = lit(col, k * 0.55);
    ctx.globalAlpha = 0.7; ctx.lineWidth = 0.6; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Render prisms into a tight canvas. Returns { c, ox, oy }: the screen position of the model
// origin inside the canvas, so callers draw it at (screenX - ox, screenY - oy).
function bake(prisms, extra) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of prisms) for (const v of q.B.concat(q.T)) {
    const sx = v[0] - v[1], sy = (v[0] + v[1]) / 2 - v[2];
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
  }
  if (!prisms.length) { x0 = y0 = -1; x1 = y1 = 1; }
  const pad = 3, S = 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0 + pad * 2) * S); c.height = Math.ceil((y1 - y0 + pad * 2) * S);
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  const ox = pad - x0, oy = pad - y0;
  CAMO_SEED = 7;
  paintPrisms(ctx, prisms, ox, oy);
  if (extra) extra(ctx, ox, oy);
  return { c, ox: ox, oy: oy, w: c.width / S, h: c.height / S };
}

const Art = {
  cache: new Map(),
  get(id, fn) {
    let s = this.cache.get(id);
    if (!s) { s = fn(); this.cache.set(id, s); }
    return s;
  },
  blit(ctx, s, x, y) {
    if (s.sw) ctx.drawImage(s.c, s.sx, s.sy, s.sw, s.sh, x - s.ox, y - s.oy, s.w, s.h);
    else ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  },
};

// ---------- pre-rendered 3D model sprites (see tools/sprites) ----------
// Sheets hold 32 facings; a mask sheet marks the paintable hull, which gets the faction's
// camouflage tint and the team colour. Units without sheets fall back to the prism models.
const SHEETS = {};
if (typeof SPRITE_META !== 'undefined') {
  for (const [key, m] of Object.entries(SPRITE_META)) {
    for (const part of Object.keys(m.parts)) {
      const base = new Image(), mask = new Image();
      base.src = `assets/sprites/${key}_${part}.png`; mask.src = `assets/sprites/${key}_${part}_mask.png`;
      let camo = null;
      if (m.camo) { camo = new Image(); camo.src = `assets/sprites/${key}_${part}_camo.png`; }
      SHEETS[key + '_' + part] = { base, mask, camo };
    }
  }
}
const CAMO_TINT = { usa: '#e6dcc4', russia: '#a9b480', china: '#98b78b', eu: '#a4ad98', soviet: '#b3ae7c' };
const loaded = img => img.complete && img.naturalWidth > 0;

function teamSheet(key, part, team) {
  const sh = SHEETS[key + '_' + part];
  if (!sh || !loaded(sh.base) || !loaded(sh.mask) || (sh.camo && !loaded(sh.camo))) return null;
  return Art.get(`S|${key}|${part}|${team.faction}|${team.color}`, () => {
    const w = sh.base.naturalWidth, h = sh.base.naturalHeight;
    const layer = (color, img = sh.mask) => {
      const l = document.createElement('canvas'); l.width = w; l.height = h;
      const lx = l.getContext('2d');
      lx.drawImage(img, 0, 0);
      lx.globalCompositeOperation = 'source-in'; lx.fillStyle = color; lx.fillRect(0, 0, w, h);
      return l;
    };
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(sh.base, 0, 0);
    if (SPRITE_META[key].style === 'voxel') {
      // voxel units: faction-tinted camouflage on the armour, solid team colour on the accent
      // parts (fender edges, turret band, rear plate), keeping the voxels' shading
      if (sh.camo) { x.globalCompositeOperation = 'multiply'; x.drawImage(layer(CAMO_TINT[team.faction] || '#ffffff', sh.camo), 0, 0); }
      x.globalCompositeOperation = 'color'; x.globalAlpha = 0.85;
      x.drawImage(layer(team.color), 0, 0);
      x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.2;
      x.drawImage(layer(team.color), 0, 0);
    } else {
      x.globalCompositeOperation = 'multiply';
      x.drawImage(layer(CAMO_TINT[team.faction] || '#ffffff'), 0, 0);
      // a light wash of team colour keeps sides recognisable without hiding the camouflage
      x.globalCompositeOperation = 'color'; x.globalAlpha = 0.2;
      x.drawImage(layer(team.color), 0, 0);
    }
    return c;
  });
}

function modelSprite(key, part, team, ang) {
  const m = SPRITE_META[key], c = teamSheet(key, part, team);
  if (!c) return null;
  const f = facingIndex(ang), C = m.cell * m.res;
  return { c, sx: (f % m.cols) * C, sy: Math.floor(f / m.cols) * C, sw: C, sh: C, ox: m.ax, oy: m.ay, w: m.cell, h: m.cell };
}

// ---------- unit models ----------
const TRACK = '#2b2b26', STEEL = '#7a848e', DARKSTEEL = '#3a4047', GUN = '#3a3c38', GLASS = '#2d5476';

function teamCamo(team) { const c = team.camo || FACTIONS[team.faction].camo; return c; }
function tracks(L, y0, y1, h = 5) { return [box(-L / 2, L / 2, -y1, -y0, 0, h, TRACK, { edge: true }), box(-L / 2, L / 2, y0, y1, 0, h, TRACK)]; }
function wheelSet(xs, y0, y1, r = 2.3) { const out = []; for (const x of xs) for (const s of [-1, 1]) out.push(box(x - r, x + r, s > 0 ? y0 : -y1, s > 0 ? y1 : -y0, 0, r * 1.9, '#1e1f1c')); return out; }

const UNIT_MODELS = {
  tank: {
    scale: 1.3,
    hull(T, C) {
      return [...tracks(27, 5, 9.5),
        prism([[-13, -7.5], [12, -7.5], [12, 7.5], [-13, 7.5]], [[-12, -6.6], [7, -6.6], [7, 6.6], [-12, 6.6]], 3, 9, C[0], { camo: [C[1], C[2]] }),
        box(-12, -7, -4, 4, 9, 9.5, C[1]),
        box(-12.5, -10, -6.6, -4, 9, 9.6, T.color), box(-12.5, -10, 4, 6.6, 9, 9.6, T.color)];
    },
    turret(T, C) {
      const base = [[-8, -6], [3, -6.5], [7, -3], [7, 3], [3, 6.5], [-8, 6]];
      return [prism(base, inset(base, 0.85, -0.6), 9, 14, C[0], { camo: [C[1], C[2]] }),
        box(-6, -1, -3, 3, 14, 14.5, T.color),
        cyl(-2.5, 3.2, 1.8, 14, 15.4, C[1], 1.6, 6),
        box(5, 22, -0.9, 0.9, 10.8, 12.4, GUN), box(11, 14, -1.3, 1.3, 10.5, 12.7, '#2c2e2a'), box(21, 23.5, -1.3, 1.3, 10.5, 12.7, '#2c2e2a')];
    },
  },
  ifv: {
    scale: 1.3,
    hull(T, C) {
      const p = [[-12, -6.5], [10, -6.5], [13, -3], [13, 3], [10, 6.5], [-12, 6.5]];
      return [...wheelSet([-8, -2.7, 2.7, 8], 5.4, 8.4),
        prism(p, inset(p, 0.9, -1), 2.5, 10, C[0], { camo: [C[1], C[2]] }),
        box(-12, -9.5, -6, -3.5, 10, 10.5, T.color), box(-12, -9.5, 3.5, 6, 10, 10.5, T.color)];
    },
    turret(T, C) {
      const p = [[-4.5, -3.8], [2, -4], [4, -1.8], [4, 1.8], [2, 4], [-4.5, 3.8]];
      return [prism(p, inset(p, 0.8), 10, 13.5, C[0], { camo: [C[1], C[2]] }),
        box(3, 15, -0.6, 0.6, 11.6, 12.6, GUN),
        box(-3, 3, -6.5, -4, 10.5, 13, '#5a5d55'), box(-3.5, -0.5, -1.5, 1.5, 13.5, 13.9, T.color)];
    },
  },
  mlrs: {
    scale: 1.3,
    hull(T, C) {
      return [...wheelSet([-9, -3.5, 8], 5.4, 8.4),
        box(-13, 5, -6.5, 6.5, 2.5, 6, C[0], { camo: [C[1], C[2]] }),
        prism([[5, -6.5], [13, -6.5], [13, 6.5], [5, 6.5]], [[5, -6], [10.5, -6], [10.5, 6], [5, 6]], 2.5, 11.5, C[0], { camo: [C[1], C[2]] }),
        box(10.8, 12.6, -5, 5, 7.5, 10.8, GLASS, { light: true }),
        box(5.5, 8.5, -6.5, 6.5, 11.5, 12, T.color)];
    },
    turret(T, C) {
      const out = [box(-9, 5, -5, 5, 6, 13, tone(C[0], -0.15), { camo: [C[1], C[2]] }), box(-9, -5, -5, 5, 13, 13.5, T.color)];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(box(5, 5.7, -4 + i * 2.8, -2.2 + i * 2.8, 7 + j * 3, 9 + j * 3, '#121310'));
      return out;
    },
  },
  railtank: {
    scale: 1.3,
    hull(T, C) {
      const p = [[-13, -7.5], [9, -7.5], [14, -3], [14, 3], [9, 7.5], [-13, 7.5]];
      return [...tracks(27, 5, 9.5),
        prism(p, inset(p, 0.88, -1), 3, 9, C[0], { camo: [C[1], C[2]] }),
        box(-12, -5, -6.5, -5.5, 9, 9.4, '#55e6ff', { light: true }), box(-12, -5, 5.5, 6.5, 9, 9.4, '#55e6ff', { light: true }),
        box(3, 6.5, -6.6, 6.6, 9, 9.4, T.color)];
    },
    turret(T, C) {
      const p = [[-8, -6], [1, -6], [6, -2.6], [6, 2.6], [1, 6], [-8, 6]];
      const out = [prism(p, inset(p, 0.82, -0.8), 9, 14, C[0], { camo: [C[1], C[2]] }), box(-7, -2, -2.5, 2.5, 14, 14.5, T.color)];
      for (const y of [-2.6, 1.2]) out.push(box(4, 26, y, y + 1.4, 11, 12.4, '#3a3d40'));
      for (let i = 0; i < 4; i++) out.push(box(8 + i * 4.2, 9.2 + i * 4.2, -3, 3, 10.5, 12.9, '#55e6ff', { light: true }));
      return out;
    },
  },
  titan: {
    scale: 1.3,
    hull(T, C) {
      const p = [[-15.5, -9], [13, -9], [13, 9], [-15.5, 9]];
      return [...tracks(32, 6, 12.5, 6.5),
        prism(p, [[-14.5, -8], [9, -8], [9, 8], [-14.5, 8]], 3.5, 11, C[0], { camo: [C[1], C[2]] }),
        box(-14.5, -11, -8, -5, 11, 11.6, T.color), box(-14.5, -11, 5, 8, 11, 11.6, T.color)];
    },
    turret(T, C) {
      const p = [[-10, -8.5], [5, -8.5], [10, -4], [10, 4], [5, 8.5], [-10, 8.5]];
      return [prism(p, inset(p, 0.85, -0.8), 11, 17.5, C[0], { camo: [C[1], C[2]] }),
        box(-8, -2, -3.5, 3.5, 17.5, 18, T.color),
        box(8, 27, -4, -2.2, 13.2, 15, GUN), box(8, 27, 2.2, 4, 13.2, 15, GUN),
        box(25, 28, -4.6, -1.6, 12.8, 15.4, '#262826'), box(25, 28, 1.6, 4.6, 12.8, 15.4, '#262826'),
        box(-8, 2, -12.5, -8.5, 12, 16.5, '#5c6058'), box(-8, 2, 8.5, 12.5, 12, 16.5, '#5c6058'),
        cyl(1, 5, 2, 17.5, 19, C[1], 1.8, 6)];
    },
  },
  harvester: {
    scale: 1.3,
    hull(T, C, cargo) {
      const out = [...tracks(30, 6, 10.5, 5.5),
        box(-15, 6, -8.5, 8.5, 3, 14, '#c69a2e'),
        box(-13, 4, -6.5, 6.5, 13.8, 14.4, '#2a2418'),
        box(-15, -12, -8.6, 8.6, 9, 14.2, T.color),
        box(6, 14, -8, 8, 3, 13, STEEL), box(13.4, 14.4, -6, 6, 8, 12, GLASS, { light: true }),
        box(14, 17.5, -9.5, 9.5, 0, 4, '#4b4f52')];
      if (cargo > 0) out.push(box(-13, 4, -6.5, 6.5, 14.4, 14.4 + cargo * 1.2, '#e2ae3c'));
      return out;
    },
  },
  mcv: {
    scale: 1.3,
    hull(T, C) {
      return [...tracks(31, 6, 10.5, 5.5),
        box(-15.5, 15.5, -9, 9, 3, 9, C[0], { camo: [C[1], C[2]] }),
        box(-13, 6, -7, 7, 9, 19, '#7b848c', { topColor: T.color }),
        box(-13, 6, -7.2, -6.8, 11, 17, DARKSTEEL), box(-13, 6, 6.8, 7.2, 11, 17, DARKSTEEL),
        box(8, 15, -7, 7, 9, 15, C[0], { camo: [C[1], C[2]] }), box(14.4, 15.4, -5, 5, 10.5, 14, GLASS, { light: true }),
        box(-10, -9, -5, -4, 19, 27, '#c9ced2')];
    },
  },
  heli: {
    scale: 1.3,
    hull(T, C) {
      const f = [[-6, -3.5], [8, -3.5], [13, -1.5], [13, 1.5], [8, 3.5], [-6, 3.5]];
      return [prism(f, inset(f, 0.75, -1), 0, 7, C[0], { camo: [C[1], C[2]] }),
        prism([[3, -2.2], [10, -2.2], [10, 2.2], [3, 2.2]], [[4, -1.6], [8, -1.6], [8, 1.6], [4, 1.6]], 6.5, 9.5, GLASS, { light: true }),
        box(-23, -6, -1, 1, 3.5, 6, C[0], { camo: [C[1], C[2]] }),
        box(-24.5, -21, -0.6, 0.6, 3.5, 12, T.color),
        box(-20, -18, -4.5, 4.5, 4, 5, C[1]),
        box(-2, 2, -9, 9, 2, 3.2, C[1]),
        box(-3, 3, -10, -7.2, 0.4, 2.6, '#55584f'), box(-3, 3, 7.2, 10, 0.4, 2.6, '#55584f'),
        box(-0.9, 0.9, -0.9, 0.9, 7, 11, '#2c2e2c')];
    },
  },
  jet: {
    scale: 1.3,
    hull(T, C) {
      const west = FACTIONS[T.faction].side === 'west';
      const body = west ? '#a7b0b8' : '#9aa39a';
      // the planform is concave, so it is built from convex pieces
      return [
        prism([[17, 0], [9, -2.6], [-15, -2.6], [-15, 2.6], [9, 2.6]], null, 0, 2.6, body),
        prism([[3, -2.6], [-2, -12.5], [-7.5, -12.5], [-6, -2.6]], null, 0.6, 1.8, body),
        prism([[3, 2.6], [-6, 2.6], [-7.5, 12.5], [-2, 12.5]], null, 0.6, 1.8, body),
        prism([[-11, -2.6], [-15, -8], [-17, -8], [-15, -2.6]], null, 0.6, 1.6, body),
        prism([[-11, 2.6], [-15, 2.6], [-17, 8], [-15, 8]], null, 0.6, 1.6, body),
        box(-12, 9, -1.8, 1.8, 2.6, 4, body),
        box(3, 9.5, -1.3, 1.3, 4, 5.5, '#c9a25a', { light: true }),
        box(-14, -9.5, -4.6, -3.8, 2.6, 8.5, T.color), box(-14, -9.5, 3.8, 4.6, 2.6, 8.5, T.color),
        box(-16.5, -14.5, -2.2, 2.2, 0.6, 3.2, '#2a2d30'),
        box(-6, -3.5, -10, -8, 1.8, 2.1, T.color), box(-6, -3.5, 8, 10, 1.8, 2.1, T.color)];
    },
  },
};

// infantry: little voxel soldiers with a walk cycle
function infantryParts(key, T, C, frame) {
  const p = [0, 1.4, 0, -1.4][frame];
  const helmet = key === 'engineer' ? '#e6b62e' : tone(C[2], -0.35);
  const out = [
    box(-1 + p, 1 + p, -2, -0.5, 0, 4.5, tone(C[1], -0.1)), box(-1 - p, 1 - p, 0.5, 2, 0, 4.5, tone(C[1], -0.1)),
    box(-1.6, 1.6, -2.4, 2.4, 4.5, 9.5, C[0], { camo: [C[1], C[2]] }),
    box(-3.2, -1.6, -1.8, 1.8, 5, 9, T.color),
    box(-1.1, 1.3, -1.2, 1.2, 9.5, 12, helmet)];
  if (key === 'rifle') out.push(box(0, 8, 1.5, 2.3, 6.5, 7.6, '#1b1c1a'));
  if (key === 'rocket') out.push(box(-4.5, 8, -2.7, -1.2, 9, 10.7, tone(C[1], -0.2)), box(7.4, 8.2, -2.8, -1.1, 8.8, 10.9, '#111'));
  if (key === 'engineer') out.push(box(-1, 2.5, 2.6, 4.2, 3, 5.5, '#c9a43a'));
  return out;
}

function unitSprite(u, team, part) {
  const m = UNIT_MODELS[u.key];
  const C = teamCamo(team);
  if (!m) { // infantry
    const frame = u.moving ? Math.floor(u.anim * 8) % 4 : 0;
    const f = facingIndex(u.facing);
    return Art.get(`${u.key}|${team.faction}|${team.color}|${f}|${frame}`, () =>
      bake(place(infantryParts(u.key, team, C, frame), f / FACINGS * Math.PI * 2, 0, 0, 0, 1.6)));
  }
  const ang = part === 'turret' ? u.turret : u.facing;
  const f = facingIndex(ang);
  const cargo = u.def.harvester ? Math.ceil(u.cargo / u.def.capacity * 3) : 0;
  return Art.get(`${u.key}|${part}|${team.faction}|${team.color}|${f}|${cargo}`, () =>
    bake(place(m[part](team, C, cargo), f / FACINGS * Math.PI * 2, 0, 0, 0, m.scale)));
}

// draw a unit whose ground point projects to (sx, sy)
// Which sprite set draws a unit type. Tanks use the camouflaged voxel model by default;
// '?tank=model' in the URL switches back to the ITHappy model.
const SPRITE_FOR = { tank: 'tank_vox' };
if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('tank') === 'model') delete SPRITE_FOR.tank;

function drawUnitArt(ctx, u, team, sx, sy) {
  const m = UNIT_MODELS[u.key];
  const sk = u.spriteKey || SPRITE_FOR[u.key] || u.key;
  const meta = typeof SPRITE_META !== 'undefined' ? SPRITE_META[sk] : null;
  const lift = u.alt || 0;
  const rec = (u.recoil || 0) * 2.5;
  const hull = meta && modelSprite(sk, 'hull', team, u.facing);
  if (hull) {
    Art.blit(ctx, hull, sx, sy - lift);
    if (meta.parts.turret) {
      const off = meta.turretOffset || 0;
      const tx = Math.cos(u.facing) * off - Math.cos(u.turret) * rec, ty = Math.sin(u.facing) * off - Math.sin(u.turret) * rec;
      const tur = modelSprite(sk, 'turret', team, u.turret);
      if (tur) Art.blit(ctx, tur, sx + isoX(tx, ty), sy - lift + isoY(tx, ty, 0));
    }
  } else {
    Art.blit(ctx, unitSprite(u, team, 'hull'), sx, sy - lift);
    if (m && m.turret) {
      const tx = -Math.cos(u.turret) * rec, ty = -Math.sin(u.turret) * rec;
      Art.blit(ctx, unitSprite(u, team, 'turret'), sx + isoX(tx, ty), sy - lift + isoY(tx, ty, 0));
    }
  }
  if (u.recoil) u.recoil = Math.max(0, u.recoil - 0.08);
  if (u.key === 'heli') {
    // rotor disc in the horizontal plane (a world circle projects to a 2:1 ellipse)
    const rz = hull && meta.rotor ? meta.rotor.z * 1.22 : 11 * 1.3, R = hull && meta.rotor ? meta.rotor.r : 17;
    const ry = sy - lift - rz;
    ctx.fillStyle = 'rgba(220,225,230,0.10)';
    ctx.beginPath(); ctx.ellipse(sx, ry, R * 1.41, R * 0.71, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(25,25,25,0.75)'; ctx.lineWidth = 1.6;
    const a = u.anim * 28;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const b = a + i * Math.PI / 2, bx = Math.cos(b) * R, by = Math.sin(b) * R; ctx.moveTo(sx, ry); ctx.lineTo(sx + isoX(bx, by), ry + isoY(bx, by, 0)); }
    ctx.stroke();
  }
  if (u.key === 'jet') {
    const bx = -Math.cos(u.facing) * 21, by = -Math.sin(u.facing) * 21;
    const ex = sx + isoX(bx, by), ey = sy - lift + isoY(bx, by, 2);
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6 + Math.random() * 2);
    g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.5, 'rgba(255,140,40,0.7)'); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- structure models (footprint-local: 0..W along x, 0..H along y) ----------
const ROOF = '#949da5';
function foundation(W, H) { return [box(1, W - 1, 1, H - 1, 0, 2, '#5b5e60', { order: -100 })]; }
function lamp(x, y, z, c = '#ffd27a') { return box(x - 1.2, x + 1.2, y - 1.2, y + 1.2, z, z + 1.2, c, { light: true }); }

const BLD_MODELS = {
  cc(T) {
    return [...foundation(96, 96),
      box(6, 90, 32, 90, 2, 24, STEEL, { topColor: T.color }),
      box(10, 30, 89.6, 90.8, 12, 17, '#ffd27a', { light: true }), box(66, 86, 89.6, 90.8, 12, 17, '#ffd27a', { light: true }),
      box(89.6, 90.8, 40, 84, 12, 17, '#ffd27a', { light: true }),
      box(38, 58, 89.4, 91, 2, 18, '#1b1f22'), box(38, 58, 89.4, 91.2, 18, 20, '#d9ad2b'),
      cyl(28, 58, 13, 24, 25, '#3a3f43', 13, 12),
      box(58, 88, 6, 40, 2, 52, STEEL, { topColor: '#46505a' }),
      box(60, 86, 39.6, 40.8, 36, 44, '#9fd8ff', { light: true }), box(87.6, 88.8, 8, 38, 36, 44, '#9fd8ff', { light: true }),
      box(60, 86, 39.6, 40.8, 22, 26, '#9fd8ff', { light: true }),
      cyl(78, 16, 5, 52, 57, '#e9edf0', 3, 8),
      box(64, 65.5, 10, 11.5, 52, 74, '#c9ced2')];
  },
  power(T) {
    const out = [...foundation(64, 64),
      box(4, 60, 34, 60, 2, 12, STEEL, { topColor: ROOF }),
      box(8, 56, 59.6, 60.8, 5, 8, '#ffd27a', { light: true }),
      cyl(24, 22, 15, 2, 14, '#d8dde1', 13, 12), cyl(24, 22, 13, 14, 21, '#e9edf0', 6, 12),
      cyl(24, 22, 15.3, 7, 10, T.color, 15.3, 12),
      cyl(24, 22, 4.5, 21, 22.5, '#6fe9ff', 4, 8, { light: true })];
    for (let i = 0; i < 5; i++) out.push(cyl(50, 14, 5, 2 + i * 9, 2 + (i + 1) * 9, i % 2 ? '#e6e6e6' : T.color, 5, 10));
    return out;
  },
  refinery(T) {
    return [...foundation(96, 96),
      box(4, 60, 6, 62, 2, 24, STEEL, { topColor: T.color }),
      box(8, 56, 61.6, 62.8, 12, 17, '#ffd27a', { light: true }),
      cyl(78, 24, 11, 2, 30, '#c9cfd4', 11, 12, { topColor: '#e2ae3c' }), cyl(78, 58, 11, 2, 30, '#c9cfd4', 11, 12, { topColor: '#e2ae3c' }),
      cyl(78, 24, 11.2, 20, 23, T.color, 11.2, 12), cyl(78, 58, 11.2, 20, 23, T.color, 11.2, 12),
      box(58, 68, 30, 36, 14, 18, '#3c4247'),
      box(32, 64, 66, 94, 0, 2.5, '#2b2f32', { order: -50 }), box(32, 64, 66, 68.5, 2.5, 3, '#d9ad2b', { order: -49 })];
  },
  barracks(T) {
    return [...foundation(64, 64),
      box(4, 60, 12, 56, 2, 14, STEEL),
      prism([[4, 12], [60, 12], [60, 56], [4, 56]], [[4, 30], [60, 30], [60, 38], [4, 38]], 14, 24, T.color),
      box(26, 38, 55.6, 57, 2, 11, '#1b1f22'),
      box(8, 22, 55.6, 56.8, 7, 10, '#ffd27a', { light: true }), box(42, 56, 55.6, 56.8, 7, 10, '#ffd27a', { light: true }),
      ...[0, 1, 2, 3].map(i => box(6 + i * 4, 9.5 + i * 4, 58, 61, 0, 3, '#9a8b60')),
      ...[0, 1, 2, 3].map(i => box(44 + i * 4, 47.5 + i * 4, 58, 61, 0, 3, '#9a8b60'))];
  },
  factory(T) {
    const out = [...foundation(96, 96),
      box(4, 92, 10, 90, 2, 30, STEEL, { topColor: T.color }),
      box(24, 72, 89.4, 91, 2, 24, '#1b1f22'), box(24, 72, 89.4, 91.2, 24, 26.5, '#d9ad2b'),
      box(6, 20, 89.6, 90.8, 16, 21, '#ffd27a', { light: true }), box(76, 90, 89.6, 90.8, 16, 21, '#ffd27a', { light: true }),
      box(91.6, 92.8, 20, 80, 16, 21, '#ffd27a', { light: true }),
      box(10, 13, 14, 17, 30, 42, '#d9ad2b'), box(10, 62, 14, 17, 42, 44.5, '#d9ad2b')];
    for (let i = 0; i < 5; i++) out.push(box(16 + i * 16, 20 + i * 16, 18, 84, 30, 31.5, tone(T.color, -0.35)));
    return out;
  },
  radar(T) {
    return [...foundation(64, 64),
      box(8, 56, 24, 58, 2, 18, STEEL, { topColor: ROOF }),
      box(8, 56, 57.6, 58.8, 13, 16, T.color),
      box(12, 52, 57.6, 58.8, 6, 9, '#9fd8ff', { light: true }),
      box(28, 36, 28, 36, 18, 34, '#7c858c'), box(26, 38, 26, 38, 18, 20, DARKSTEEL)];
  },
  airfield(T) {
    const out = [box(2, 94, 2, 62, 0, 1.5, '#33373a', { order: -100 }),
      box(4, 92, 19.5, 20.5, 1.5, 1.8, T.color, { order: -99 }), box(4, 92, 43.5, 44.5, 1.5, 1.8, T.color, { order: -99 })];
    for (let i = 0; i < 6; i++) out.push(box(8 + i * 13, 15 + i * 13, 31, 33, 1.5, 1.8, '#e8e8e8', { order: -99 }));
    out.push(box(74, 92, 4, 20, 1.5, 24, STEEL), box(73, 93, 3, 21, 24, 30, '#7fc8f0', { light: true, topColor: T.color }));
    const jet = place(UNIT_MODELS.jet.hull(T, teamCamo(T)), 0, 34, 32, 1.5, 1.1);
    return { parts: out, extra: jet };
  },
  tech(T) {
    return [...foundation(64, 64),
      box(6, 58, 14, 58, 2, 22, '#cfd4d8', { topColor: '#e4e8eb' }),
      box(10, 54, 57.6, 58.8, 10, 15, '#9fd8ff', { light: true }),
      cyl(32, 34, 12, 22, 25, '#9aa3ab', 12, 12), cyl(32, 34, 11, 25, 33, T.color, 4, 12),
      box(12, 13.5, 18, 19.5, 22, 36, '#c9ced2')];
  },
  super_lance(T, st) {
    const out = [...foundation(96, 96),
      box(6, 90, 14, 90, 2, 16, STEEL, { topColor: ROOF }),
      box(10, 86, 89.6, 90.8, 8, 12, T.color),
      cyl(48, 50, 13, 16, 22, '#d8dde1', 30, 14),
      cyl(48, 50, 3, 22, 44, '#9aa3ab', 2, 8)];
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; out.push(box(48 + Math.cos(a) * 20 - 1, 48 + Math.cos(a) * 20 + 1, 50 + Math.sin(a) * 20 - 1, 50 + Math.sin(a) * 20 + 1, 22, 38, '#6d7680')); }
    out.push(cyl(48, 50, 4, 44, 48, st ? '#bff4ff' : '#5a6670', 2, 8, { light: !!st }));
    return out;
  },
  super_silo(T, st) {
    const out = [...foundation(96, 96),
      box(6, 90, 6, 90, 2, 12, '#5f6458', { topColor: '#4b4f46' }),
      box(10, 86, 89.6, 90.8, 5, 9, T.color),
      box(26, 70, 26, 70, 12, 12.4, '#141516')];
    const o = st ? 14 : 0;
    out.push(box(26 - o, 48 - o, 26, 70, 12.4, 14.5, '#8f9488'), box(48 + o, 70 + o, 26, 70, 12.4, 14.5, '#8f9488'),
      box(26 - o, 48 - o, 46, 50, 14.5, 14.8, '#d9ad2b'), box(48 + o, 70 + o, 46, 50, 14.5, 14.8, '#d9ad2b'));
    if (st) out.push(cyl(48, 48, 5, 12.4, 34, '#e8e8e8', 4, 10), cyl(48, 48, 4, 34, 40, '#d33', 0.5, 10));
    return out;
  },
  turret() {
    return [cyl(16, 16, 13, 0, 5, '#9a8b60', 12, 12), cyl(16, 16, 8, 0, 7, '#4d545b', 7, 10)];
  },
  railturret() {
    return [box(3, 29, 3, 29, 0, 10, STEEL, { topColor: ROOF }), box(3, 29, 28.6, 29.6, 3, 6, '#d9ad2b')];
  },
  sam() {
    return [box(2, 30, 4, 28, 0, 4, '#3d4247'), box(2, 30, 27.6, 28.6, 1, 3, '#d9ad2b'), cyl(16, 16, 6, 4, 8, '#4d545b', 5, 10)];
  },
};

// rotating weapons on defensive structures (pivot at the footprint centre)
const BLD_TURRETS = {
  turret: { z: 7, parts: T => [box(-5, 4, -4.5, 4.5, 0, 5, tone(T.color, -0.15)), box(4, 16, -2.2, -1.2, 2, 3, GUN), box(4, 17, -0.5, 0.5, 2, 3, GUN), box(4, 16, 1.2, 2.2, 2, 3, GUN)] },
  railturret: {
    z: 10, parts: T => {
      const p = [[-7, -6], [1, -6], [5, -2], [5, 2], [1, 6], [-7, 6]];
      const out = [prism(p, inset(p, 0.85), 0, 6, tone(T.color, -0.1)), box(4, 24, -2.2, -0.8, 2, 3.5, '#3a3d40'), box(4, 24, 0.8, 2.2, 2, 3.5, '#3a3d40')];
      for (let i = 0; i < 4; i++) out.push(box(7 + i * 4, 8 + i * 4, -2.6, 2.6, 1.5, 4, '#55e6ff', { light: true }));
      return out;
    },
  },
  sam: {
    z: 8, parts: T => {
      const out = [box(-8, 8, -7, 7, 0, 8, tone(T.color, -0.2))];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) out.push(box(8, 8.8, -6 + i * 7, -1 + i * 7, 1 + j * 3.5, 3.5 + j * 3.5, '#151617'));
      out.push(box(-8, 8, -7.2, -6.8, 1, 7, '#e8e8e8'), box(-8, 8, 6.8, 7.2, 1, 7, '#e8e8e8'));
      return out;
    },
  },
};

function buildingState(b, team) {
  if (b.key === 'super_lance' || b.key === 'super_silo') return team.superReady ? 1 : 0;
  return 0;
}

function buildingSprite(b, team) {
  const st = buildingState(b, team);
  return Art.get(`B|${b.key}|${team.faction}|${team.color}|${st}`, () => {
    // structures wear a slightly muted team colour so roofs don't overpower the scene
    const m = BLD_MODELS[b.key](Object.assign({}, team, { color: tone(team.color, -0.18) }), st);
    const parts = m.parts || m;
    let prisms = place(parts);
    if (m.extra) prisms = prisms.concat(m.extra);
    return bake(prisms);
  });
}

function buildingTurretSprite(b, team) {
  const spec = BLD_TURRETS[b.key];
  const f = facingIndex(b.turret);
  return Art.get(`BT|${b.key}|${team.color}|${f}`, () =>
    bake(place(spec.parts(team), f / FACINGS * Math.PI * 2, b.w * TILE / 2, b.h * TILE / 2, spec.z)));
}

// ---------- live structure details (lights, flags, dishes) ----------
function blink(ctx, x, y, on, color) {
  ctx.fillStyle = on ? color : '#3a1010';
  ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  if (on) { ctx.fillStyle = rgba(color, 0.25); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
}

function flagpole(ctx, x, y, faction, t) {
  ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.stroke();
  const img = FLAG_IMG[faction];
  if (!img || !img.complete || !img.naturalWidth) return;
  const W = 15, H = 10, n = 5, sw = img.naturalWidth / n;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(t * 5 - i * 0.9) * 1.1 * (i / n);
    ctx.drawImage(img, i * sw, 0, sw, img.naturalHeight, x + i * W / n, y - 26 + wave, W / n + 0.3, H);
  }
}

const BLD_LIVE = {
  cc(ctx, P, b, team, t) {
    let [x, y] = P(64.7, 10.7, 74); blink(ctx, x, y, Math.sin(t * 4) > 0, '#ff4040');
    [x, y] = P(28, 58, 25.2);
    ctx.strokeStyle = 'rgba(230,230,230,0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y, 13, 6.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(230,230,230,0.9)'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', x, y);
    [x, y] = P(14, 40, 24); flagpole(ctx, x, y, team.faction, t);
  },
  power(ctx, P, b, team, t, low) {
    let [x, y] = P(50, 14, 48); blink(ctx, x, y, Math.sin(t * 3) > 0, '#ff4040');
    [x, y] = P(24, 22, 22.5);
    const pulse = low ? 0.1 : 0.45 + 0.35 * Math.sin(t * 3 + b.anim);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
    g.addColorStop(0, `rgba(190,250,255,${pulse})`); g.addColorStop(1, 'rgba(60,200,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    if (!low && Math.random() < 0.06) { const [wx, wy] = [b.tx * TILE + 50, b.ty * TILE + 14]; G.effects.push({ type: 'smoke', x: wx, y: wy, z: 50, t: 0, life: 1.6, size: 3 }); }
  },
  refinery(ctx, P, b, team, t) {
    let [x, y] = P(33, 94, 3); blink(ctx, x, y, Math.floor(t * 2) % 2 === 0, '#ffcc33');
    [x, y] = P(63, 94, 3); blink(ctx, x, y, Math.floor(t * 2) % 2 === 1, '#ffcc33');
  },
  barracks(ctx, P, b, team, t) { const [x, y] = P(8, 14, 14); flagpole(ctx, x, y, team.faction, t); },
  radar(ctx, P, b, team, t, low) {
    const [x, y] = P(32, 32, 38);
    const a = low ? 0.4 : t * 1.4;
    ctx.save(); ctx.translate(x, y);
    const sx = Math.cos(a);
    ctx.scale(Math.max(0.12, Math.abs(sx)), 1);
    const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 14);
    g.addColorStop(0, '#f5f7f9'); g.addColorStop(1, '#8e98a1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#59616a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#59616a'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const [lx, ly] = P(10, 26, 19); blink(ctx, lx, ly, Math.sin(t * 5) > 0.3, '#40ff70');
  },
  airfield(ctx, P, b, team, t, low) {
    for (let i = 0; i < 8; i++) { const [x, y] = P(8 + i * 11.5, 50, 2); blink(ctx, x, y, !low && Math.floor(t * 6) % 8 === i, '#ffd040'); }
  },
  tech(ctx, P, b, team, t, low) {
    for (let i = 0; i < 3; i++) { const [x, y] = P(12 + i * 6, 58.5, 19); blink(ctx, x, y, !low && Math.floor(t * 3 + i) % 3 === 0, '#60e0ff'); }
    const [x, y] = P(12.7, 18.7, 36); blink(ctx, x, y, Math.sin(t * 4) > 0, '#ff4040');
  },
  super_lance(ctx, P, b, team, t) {
    const charge = team.superReady ? 1 : Math.min(1, (team.superTimer || 0) / BUILDINGS.super_lance.superweapon.charge);
    const [x, y] = P(48, 50, 22.5);
    ctx.strokeStyle = rgba('#5ac8ff', 0.4 + 0.6 * charge); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, 26, 13, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.stroke();
    if (team.superReady) { const [ex, ey] = P(48, 50, 48); const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 14); g.addColorStop(0, `rgba(210,245,255,${0.6 + 0.4 * Math.sin(t * 8)})`); g.addColorStop(1, 'rgba(90,200,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill(); }
  },
  super_silo(ctx, P, b, team, t) {
    const charge = team.superReady ? 1 : Math.min(1, (team.superTimer || 0) / BUILDINGS.super_silo.superweapon.charge);
    const [x0, y0] = P(10, 91, 4), [x1, y1] = P(86, 91, 4);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = team.color; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * charge, y0 + (y1 - y0) * charge); ctx.stroke();
    if (team.superReady) { const [x, y] = P(48, 48, 40); blink(ctx, x, y, Math.sin(t * 8) > 0, '#ff3020'); }
  },
};

// ---------- scenery ----------
function rockSprite(theme, v) {
  return Art.get(`R|${theme.rock}|${!!theme.snow}|${v}`, () => {
    const r = makeRng(v * 977 + 13);
    const col = `rgb(${theme.rock.join(',')})`;
    const parts = [];
    const n = 2 + (v % 3);
    for (let k = 0; k < n; k++) {
      const cx = (r() - 0.5) * 16, cy = (r() - 0.5) * 16, rad = 5 + r() * 7, h = 5 + r() * 12;
      const sides = 6 + ((r() * 3) | 0), rot = r() * 6;
      const pts = Array.from({ length: sides }, (_, i) => { const a = rot + i / sides * Math.PI * 2, rr = rad * (0.75 + r() * 0.3); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
      parts.push(prism(pts, inset(pts, 0.45 + r() * 0.25, (r() - 0.5) * 3, (r() - 0.5) * 3), 0, h, col, theme.snow ? { topColor: '#eef3f8' } : {}));
    }
    return bake(place(parts));
  });
}

function treeSprite(theme, v) {
  return Art.get(`T|${theme.decor}|${theme.leaf.join()}|${!!theme.snow}|${v}`, () => {
    const r = makeRng(v * 131 + 7);
    const s = 0.8 + r() * 0.5;
    const c = document.createElement('canvas');
    const W = 52, H = 72, S = 2;
    c.width = W * S; c.height = H * S;
    const ctx = c.getContext('2d'); ctx.scale(S, S);
    const ox = W / 2, oy = H - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ox + 8 * s, oy + 2, 14 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    const [hi, lo] = theme.leaf;
    if (theme.decor === 'pine') {
      ctx.fillStyle = '#4a3422'; ctx.fillRect(ox - 1.5, oy - 10 * s, 3, 10 * s);
      for (let k = 0; k < 4; k++) {
        const w = (13 - k * 2.8) * s, y = oy - (6 + k * 9) * s, h = 15 * s;
        ctx.fillStyle = lo;
        ctx.beginPath(); ctx.moveTo(ox, y - h); ctx.lineTo(ox + w, y); ctx.lineTo(ox - w, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hi;
        ctx.beginPath(); ctx.moveTo(ox, y - h); ctx.lineTo(ox, y); ctx.lineTo(ox - w, y); ctx.closePath(); ctx.fill();
        if (theme.snow) { ctx.fillStyle = 'rgba(240,246,252,0.85)'; ctx.beginPath(); ctx.moveTo(ox, y - h); ctx.lineTo(ox + w * 0.45, y - h * 0.45); ctx.lineTo(ox - w * 0.5, y - h * 0.4); ctx.closePath(); ctx.fill(); }
      }
    } else if (theme.decor === 'shrub') {
      ctx.strokeStyle = lo; ctx.lineWidth = 1.3;
      for (let k = 0; k < 7; k++) { const a = -Math.PI * (0.1 + k / 7 * 0.8); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 9 * s, oy + Math.sin(a) * 9 * s); ctx.stroke(); }
      ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(ox, oy - 4 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#4a3422'; ctx.fillRect(ox - 1.8, oy - 14 * s, 3.6, 14 * s);
      const lobes = [[0, -26], [-8, -20], [8, -20], [-4, -32], [5, -31], [0, -18]];
      for (const [lx, ly] of lobes) {
        const x = ox + lx * s, y = oy + ly * s, rr = (8 + r() * 3) * s;
        const g = ctx.createRadialGradient(x - rr * 0.4, y - rr * 0.4, 1, x, y, rr);
        g.addColorStop(0, hi); g.addColorStop(1, lo);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
      }
    }
    return { c, ox, oy, w: W, h: H };
  });
}

// ---------- sidebar cameos ----------
// Units and structures shown in the style mock use its artwork; everything else gets a
// rendered cameo in the same dark style.
const CAMEO_ART = { tank: 1, ifv: 1, heli: 1, jet: 1, rifle: 1, sam: 1, cc: 1, barracks: 1, factory: 1, power: 1, radar: 1, airfield: 1 };
function cameoUrl(key, faction) { return CAMEO_ART[key] ? `assets/cameos/${faction}/${key}.webp` : null; }

function drawIcon(key, team, w, h) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  const g = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, '#22344a'); g.addColorStop(1, '#0a131f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const fakeTeam = Object.assign({ superTimer: 200, superReady: false, lowPower: false }, team);
  let s;
  if (BUILDINGS[key]) {
    const def = BUILDINGS[key];
    s = buildingSprite({ key, w: def.w, h: def.h }, fakeTeam);
    if (BLD_TURRETS[key]) {
      const t = buildingTurretSprite({ key, w: def.w, h: def.h, turret: 0.6 }, fakeTeam);
      const both = document.createElement('canvas');
      both.width = s.c.width; both.height = s.c.height;
      const bc = both.getContext('2d');
      bc.drawImage(s.c, 0, 0);
      bc.drawImage(t.c, (s.ox - t.ox) * 2, (s.oy - t.oy) * 2);
      s = { c: both, ox: s.ox, oy: s.oy, w: s.w, h: s.h };
    }
  } else {
    const fake = { key, def: UNITS[key], facing: 0.6, turret: 0.4, anim: 0, moving: false, cargo: UNITS[key].capacity ? UNITS[key].capacity * 0.7 : 0 };
    s = unitSprite(fake, fakeTeam, 'hull');
    if (UNIT_MODELS[key] && UNIT_MODELS[key].turret) {
      const t = unitSprite(fake, fakeTeam, 'turret');
      const both = document.createElement('canvas');
      const x0 = Math.min(-s.ox, -t.ox), y0 = Math.min(-s.oy, -t.oy);
      const x1 = Math.max(s.w - s.ox, t.w - t.ox), y1 = Math.max(s.h - s.oy, t.h - t.oy);
      both.width = (x1 - x0) * 2; both.height = (y1 - y0) * 2;
      const bc = both.getContext('2d'); bc.scale(2, 2);
      bc.drawImage(s.c, -s.ox - x0, -s.oy - y0, s.w, s.h);
      bc.drawImage(t.c, -t.ox - x0, -t.oy - y0, t.w, t.h);
      s = { c: both, ox: -x0, oy: -y0, w: x1 - x0, h: y1 - y0 };
    }
  }
  const k = Math.min((w - 8) / s.w, (h - 8) / s.h, 2.2);
  ctx.drawImage(s.c, (w - s.w * k) / 2, (h - s.h * k) / 2 + 2, s.w * k, s.h * k);
  return c;
}
