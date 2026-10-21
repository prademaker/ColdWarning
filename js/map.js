// ColdWarning — terrain generation, ore, pathfinding.
'use strict';

const T_GRASS = 0, T_DIRT = 1, T_WATER = 2, T_ROCK = 3, T_SAND = 4, T_CLIFF = 5;
const ORE = 1, GEM = 2;

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(rng, size) {
  const g = new Float32Array((size + 2) * (size + 2));
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const W = size + 2;
  const smooth = t => t * t * (3 - 2 * t);
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = g[yi * W + xi], b = g[yi * W + xi + 1];
    const c = g[(yi + 1) * W + xi], d = g[(yi + 1) * W + xi + 1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

// Per-theater palettes (RGB) and scenery.
const THEMES = {
  temperate: { dry: [112, 110, 62], blades: ['#3d5a26', '#5c7f36', '#7f9a4a', '#a3a866'], grass: [68, 88, 46], dirt: [102, 86, 58], sand: [156, 142, 100], water: [30, 66, 84], deep: [12, 32, 50], rock: [92, 90, 84],
    water0: 0.3, decor: 'broadleaf', density: 1 / 12, leaf: ['#56803a', '#26431a'] },
  desert: { dry: [200, 170, 120], blades: null, grass: [184, 156, 108], dirt: [152, 118, 80], sand: [204, 180, 132], water: [40, 104, 110], deep: [18, 60, 74], rock: [146, 108, 76],
    water0: 0.24, decor: 'shrub', density: 1 / 40, leaf: ['#7d7a45', '#4e4a28'], dunes: true },
  arctic: { dry: [196, 206, 220], blades: null, grass: [214, 222, 232], dirt: [146, 154, 158], sand: [186, 204, 218], water: [42, 76, 100], deep: [16, 36, 58], rock: [104, 112, 124],
    water0: 0.3, decor: 'pine', density: 1 / 14, leaf: ['#3e5e46', '#1c3122'], snow: true },
  steppe: { dry: [164, 150, 90], blades: ['#7a7a3e', '#9a944e', '#b8a964', '#5f6a34'], grass: [136, 130, 76], dirt: [116, 96, 64], sand: [172, 158, 112], water: [36, 74, 88], deep: [14, 38, 52], rock: [110, 102, 88],
    water0: 0.27, decor: 'shrub', density: 1 / 26, leaf: ['#6f7a3c', '#3e4a20'] },
  jungle: { dry: [70, 104, 44], blades: ['#24461c', '#33602a', '#4d7d34', '#2a5022'], palms: true, grass: [44, 78, 36], dirt: [90, 72, 46], sand: [148, 134, 90], water: [22, 74, 72], deep: [8, 38, 42], rock: [78, 86, 72],
    water0: 0.32, decor: 'broadleaf', density: 1 / 4, leaf: ['#3f7a2c', '#173a12'] },
};

// Tileable 256px surface textures (mostly translucent detail laid over the base colour).
function surfaceTexture(kind, th, rng) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  // draw a mark at (px, py) and its wrapped copies so the texture tiles seamlessly
  const wrap = (px, py, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(px + ox, py + oy); };
  const pebble = (px, py, r, base, alpha) => wrap(px, py, (X, Y) => {
    x.fillStyle = `rgba(0,0,0,${alpha * 0.6})`; x.beginPath(); x.ellipse(X + r * 0.4, Y + r * 0.4, r, r * 0.75, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = `rgba(${base},${alpha})`; x.beginPath(); x.ellipse(X, Y, r, r * 0.75, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = `rgba(255,255,255,${alpha * 0.45})`; x.beginPath(); x.ellipse(X - r * 0.3, Y - r * 0.3, r * 0.4, r * 0.3, 0, 0, Math.PI * 2); x.fill();
  });
  const crack = (alpha) => {
    let px = rng() * S, py = rng() * S;
    const pts = [[px, py]];
    for (let i = 0; i < 4 + rng() * 4; i++) { px += (rng() - 0.5) * 14; py += (rng() - 0.5) * 14; pts.push([px, py]); }
    wrap(0, 0, (ox, oy) => { x.strokeStyle = `rgba(30,20,10,${alpha})`; x.lineWidth = 0.8; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a + ox, b + oy) : x.moveTo(a + ox, b + oy)); x.stroke(); });
  };
  if (kind === 'grass') {
    // clumps of blades in mixed greens, some lighter dry tufts
    for (let i = 0; i < 260; i++) {
      const cx = rng() * S, cy = rng() * S, n = 4 + (rng() * 8 | 0);
      for (let k = 0; k < n; k++) {
        const bx = cx + (rng() - 0.5) * 6, by = cy + (rng() - 0.5) * 4, len = 2 + rng() * 4, lean = (rng() - 0.5) * 2.5;
        const col = th.blades[(rng() * th.blades.length) | 0];
        wrap(bx, by, (X, Y) => { x.strokeStyle = col; x.globalAlpha = 0.55 + rng() * 0.35; x.lineWidth = 0.9; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + lean, Y - len); x.stroke(); });
      }
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 2600; i++) { const px = rng() * S, py = rng() * S; x.fillStyle = rng() < 0.5 ? 'rgba(20,34,12,0.25)' : 'rgba(170,180,110,0.18)'; x.fillRect(px, py, 1, 1); }
    for (let i = 0; i < 40; i++) pebble(rng() * S, rng() * S, 0.6 + rng() * 0.8, '120,112,92', 0.5);
  } else if (kind === 'dirt') {
    for (let i = 0; i < 3500; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(40,28,16,0.22)' : 'rgba(210,190,150,0.16)'; x.fillRect(rng() * S, rng() * S, 1, 1); }
    for (let i = 0; i < 160; i++) pebble(rng() * S, rng() * S, 0.7 + rng() * 1.6, rng() < 0.5 ? '150,132,104' : '112,96,74', 0.75);
    for (let i = 0; i < 26; i++) crack(0.28);
    for (let i = 0; i < 30; i++) { const px = rng() * S, py = rng() * S, r = 3 + rng() * 6; wrap(px, py, (X, Y) => { x.fillStyle = 'rgba(60,40,22,0.12)'; x.beginPath(); x.ellipse(X, Y, r, r * 0.7, rng() * 3, 0, Math.PI * 2); x.fill(); }); }
  } else if (kind === 'sand') {
    for (let i = 0; i < 6000; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(90,70,40,0.16)' : 'rgba(255,245,220,0.2)'; x.fillRect(rng() * S, rng() * S, 1, 1); }
    // wind ripples: wavy light crests with a shadow below
    for (let r = 0; r < 26; r++) {
      const y0 = r * (S / 26) + rng() * 4, ph = rng() * 6;
      for (const [dy, col] of [[0, 'rgba(255,248,226,0.22)'], [1.4, 'rgba(90,66,36,0.16)']]) {
        x.strokeStyle = col; x.lineWidth = 1; x.beginPath();
        for (let px = 0; px <= S; px += 4) { const py = y0 + dy + Math.sin(px / S * Math.PI * 4 + ph) * 3; px ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke();
      }
    }
    for (let i = 0; i < 30; i++) pebble(rng() * S, rng() * S, 0.6 + rng() * 0.9, '150,126,90', 0.5);
  } else if (kind === 'snow') {
    for (let i = 0; i < 70; i++) { const px = rng() * S, py = rng() * S, l = 10 + rng() * 30; wrap(px, py, (X, Y) => { x.fillStyle = 'rgba(120,150,190,0.08)'; x.beginPath(); x.ellipse(X, Y, l, 2 + rng() * 3, -0.25, 0, Math.PI * 2); x.fill(); }); }
    for (let i = 0; i < 700; i++) { x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(rng() * S, rng() * S, 1, 1); }
    for (let i = 0; i < 300; i++) { x.fillStyle = 'rgba(70,80,90,0.2)'; x.fillRect(rng() * S, rng() * S, 1, 1); }
  } else if (kind === 'gravel') {
    for (let i = 0; i < 4000; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(30,30,30,0.22)' : 'rgba(220,220,210,0.16)'; x.fillRect(rng() * S, rng() * S, 1, 1); }
    for (let i = 0; i < 320; i++) pebble(rng() * S, rng() * S, 0.8 + rng() * 2, rng() < 0.5 ? '140,136,128' : '100,98,92', 0.8);
    for (let i = 0; i < 18; i++) crack(0.35);
  } else if (kind === 'water') {
    // short wavelets at random angles (long parallel lines turn into streaks in the iso view)
    for (let i = 0; i < 520; i++) {
      const px = rng() * S, py = rng() * S, w = 3 + rng() * 5, a = rng() * Math.PI, light = rng() < 0.55;
      const dx = Math.cos(a) * w, dy = Math.sin(a) * w;
      wrap(px, py, (X, Y) => { x.strokeStyle = light ? 'rgba(200,230,245,0.09)' : 'rgba(0,20,35,0.08)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + dx / 2 - dy * 0.2, Y + dy / 2 + dx * 0.2, X + dx, Y + dy); x.stroke(); });
    }
  }
  return c;
}

// how a unit gets about: on land, on water (ships) or on both (the hovercraft)
const MOVE_LAND = 0, MOVE_WATER = 1, MOVE_AMPHIB = 2;

class GameMap {
  constructor(size, seed, theater = 'temperate', players = 2, water = 'lakes') {
    this.w = size; this.h = size;
    this.players = players;
    this.seed = seed;
    this.water = MAP_WATER[water] ? water : 'lakes';
    this.theater = THEMES[theater] ? theater : 'temperate';
    this.theme = THEMES[this.theater];
    const n = size * size;
    this.terrain = new Uint8Array(n);
    this.ore = new Float32Array(n);      // credit value remaining
    this.oreType = new Uint8Array(n);
    this.oreMax = new Float32Array(n);   // for regrowth
    this.bld = new Int32Array(n).fill(-1);  // building id occupying tile
    // ground level: 0 the plain (and the sea), 1 a hill. Ramps are the only ways up; the
    // hill's edges facing the viewer are cliff faces (T_CLIFF, impassable).
    this.height = new Uint8Array(n);
    this.ramp = new Uint8Array(n);       // 1 + direction it leads down (index into DIRS), or 0
    this.noBuild = new Uint8Array(n);    // walkable but no place for a structure: hill rims, bridgeheads
    this.bridgeAt = new Int16Array(n).fill(-1); // bridge spanning this water tile
    this.bridges = [];                   // { x, y, w, h, axis, up, ends }
    this.generate();
  }

  // saves from before hills and bridges: a flat map without any
  ensureLevels() {
    if (this.height) return;
    const n = this.w * this.h;
    this.height = new Uint8Array(n); this.ramp = new Uint8Array(n); this.noBuild = new Uint8Array(n);
    this.bridgeAt = new Int16Array(n).fill(-1); this.bridges = [];
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  // open, level ground a structure can stand on
  terrainPassable(x, y) {
    if (!this.inside(x, y)) return false;
    const i = this.idx(x, y), t = this.terrain[i];
    return t !== T_WATER && t !== T_ROCK && t !== T_CLIFF && !this.ramp[i] && !this.noBuild[i];
  }
  // ground a soldier or vehicle can stand on: land that isn't rock or cliff, and standing bridges
  walkable(i) {
    const t = this.terrain[i];
    if (t === T_WATER) { const b = this.bridgeAt[i]; return b >= 0 && this.bridges[b].up; }
    return t !== T_ROCK && t !== T_CLIFF;
  }
  passable(x, y, mode = MOVE_LAND) {
    if (!this.inside(x, y)) return false;
    const i = this.idx(x, y);
    if (this.bld[i] >= 0) return false;
    if (mode === MOVE_WATER) return this.terrain[i] === T_WATER;
    if (mode === MOVE_AMPHIB && this.terrain[i] === T_WATER) return true;
    return this.walkable(i);
  }
  // whether a unit can step between two neighbouring tiles: on the level, or up or down a ramp
  step(i, j) { return this.height[i] === this.height[j] || this.ramp[i] > 0 || this.ramp[j] > 0; }
  // up on a hill (a ramp is neither up nor down)
  high(x, y) { return this.inside(x, y) && this.height[this.idx(x, y)] === 1 && !this.ramp[this.idx(x, y)]; }
  isWater(x, y) { return this.inside(x, y) && this.terrain[this.idx(x, y)] === T_WATER; }
  // water with no standing bridge over it
  openWater(x, y) {
    if (!this.isWater(x, y)) return false;
    const b = this.bridgeAt[this.idx(x, y)];
    return b < 0 || !this.bridges[b].up;
  }

  generate() {
    const N = this.w, rng = makeRng(this.seed);
    this.rng = rng;
    const n1 = makeNoise(rng, 16), n2 = makeNoise(rng, 32), n3 = makeNoise(rng, 24), n4 = makeNoise(rng, 40);
    const height = (x, y) => n1(x / N * 6, y / N * 6) * 0.65 + n2(x / N * 14, y / N * 14) * 0.35;
    const sea = this.seaShape();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = height(x, y);
      const r = n3(x / N * 10, y / N * 10) * 0.7 + n2(x / N * 25, y / N * 25) * 0.3;
      const d = n4(x / N * 18, y / N * 18);
      let t = T_GRASS;
      const w0 = this.theme.water0 - (sea ? 0.08 : 0); // the sea maps keep few lakes inland
      if (h < w0 || (sea && sea(x, y, h))) t = T_WATER;
      else if (h < w0 + 0.035) t = T_SAND;
      else if (r > 0.7) t = T_ROCK;
      else if (d > 0.62) t = T_DIRT;
      this.terrain[this.idx(x, y)] = t;
    }
    // edges are water-free so armies can always flank
    // starting positions: opposite corners for two players; with more, corners in order around
    // the map, so neighbours in the list share a side
    const m = 11;
    if (this.players <= 2) {
      const corners = [[m, N - 1 - m], [N - 1 - m, m], [m, m], [N - 1 - m, N - 1 - m]];
      const pick = rng() < 0.5 ? 0 : 2;
      this.starts = [corners[pick], corners[pick + 1]];
      if (rng() < 0.5) this.starts.reverse();
    } else {
      const ring = [[m, m], [N - 1 - m, m], [N - 1 - m, N - 1 - m], [m, N - 1 - m]];
      const off = Math.floor(rng() * 4);
      this.starts = [];
      for (let i = 0; i < this.players; i++) this.starts.push(ring[(off + i) % 4]);
    }

    for (const [sx, sy] of this.starts) this.paint(sx, sy, 9, T_GRASS);
    // guarantee land connectivity between starts and to the center (on the sea maps round the
    // rim instead: the middle is open water with an island of crystals)
    const c = [N >> 1, N >> 1];
    if (sea) this.carveRim();
    else {
      for (const s of this.starts) this.carve(s, c);
      for (let i = 1; i < this.starts.length; i++) this.carve(this.starts[i - 1], this.starts[i]);
    }

    // ore fields
    for (const [sx, sy] of this.starts) {
      const towardCenter = Math.atan2(c[1] - sy, c[0] - sx);
      for (let k = 0; k < 2; k++) {
        const a = towardCenter + (k === 0 ? -0.9 : 0.9) + (rng() - 0.5) * 0.4;
        const dist = 9 + rng() * 3;
        this.oreField(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist), 3.2, ORE);
      }
    }
    this.oreField(c[0], c[1], 3.5, GEM);
    if (sea) {
      // a ring of small ore islands out in the sea, worth a hovercraft trip
      const k = Math.round(4 * N / 88), a0 = rng() * Math.PI * 2;
      for (let i = 0; i < k; i++) {
        const a = a0 + i / k * Math.PI * 2, r = this.seaR0 * (0.5 + rng() * 0.2);
        this.oreField(Math.round(c[0] + Math.cos(a) * r), Math.round(c[1] + Math.sin(a) * r), 2.2 + rng(), rng() < 0.3 ? GEM : ORE);
      }
    }
    const extra = Math.round(6 * (N / 88) * (N / 88));
    for (let i = 0; i < extra; i++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 8 + Math.floor(rng() * (N - 16)), y = 8 + Math.floor(rng() * (N - 16));
        if (this.starts.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 16)) continue;
        if (!this.terrainPassable(x, y)) continue;
        this.oreField(x, y, 2.5 + rng() * 1.5, rng() < 0.25 ? GEM : ORE);
        break;
      }
    }
    this.raiseHills(c);
    // shoreline sand
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = this.idx(x, y);
      if (this.terrain[i] !== T_GRASS && this.terrain[i] !== T_DIRT) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.inside(x + dx, y + dy) && this.terrain[this.idx(x + dx, y + dy)] === T_WATER) { this.terrain[i] = T_SAND; break; }
      }
    }
    this.placeBridges();
    this.placeCivilians(rng, c);
    this.labelWater();
    this.decor = [];
    for (let i = 0; i < N * N * this.theme.density; i++) {
      const x = rng() * N, y = rng() * N;
      const t = this.terrain[this.idx(x | 0, y | 0)];
      if (t === T_GRASS && this.ore[this.idx(x | 0, y | 0)] === 0 && !this.civMask[this.idx(x | 0, y | 0)]) this.decor.push({ x, y, kind: rng() < 0.55 ? 'bush' : 'tree', s: 0.6 + rng() * 0.6 });
    }
  }

  // Sea maps: water wherever a point lies inside a rounded star centred on the map, its arms
  // (bays) reaching toward the corners where bases start, with a ragged coastline from the
  // height noise. Returns null on the classic land map.
  seaShape() {
    const spec = MAP_WATER[this.water], N = this.w;
    if (!spec.edge) return null;
    const c = N / 2, corner = (c - 11) * Math.SQRT2;
    const r0 = c - spec.edge * N;  // toward the middle of each edge
    const r1 = corner - 10;        // toward the bases
    this.seaR0 = r0;
    return (x, y, h) => {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, a = Math.atan2(dy, dx);
      const k = Math.pow(Math.abs(Math.sin(2 * a)), 2.5);         // 1 on the diagonals
      return Math.hypot(dx, dy) < r0 + (r1 - r0) * k + (h - 0.5) * 10;
    };
  }

  // a land route along the edges joining the four corners (narrow causeways where the sea cut it)
  carveRim() {
    const N = this.w, m = 11, ring = [[m, m], [N - 1 - m, m], [N - 1 - m, N - 1 - m], [m, N - 1 - m]];
    for (let i = 0; i < 4; i++) this.carve(ring[i], ring[(i + 1) % 4], true);
  }

  // Number every body of water (4-connected) so ships and the AI know which seas join up.
  labelWater() {
    const N = this.w;
    this.waterId = new Int16Array(N * N).fill(-1);
    this.waterSize = [];
    for (let i = 0; i < N * N; i++) {
      if (this.terrain[i] !== T_WATER || this.waterId[i] >= 0) continue;
      const id = this.waterSize.length, q = [i];
      this.waterId[i] = id;
      for (let k = 0; k < q.length; k++) {
        const j = q[k], x = j % N, y = (j / N) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!this.inside(nx, ny)) continue;
          const n = ny * N + nx;
          if (this.terrain[n] === T_WATER && this.waterId[n] < 0) { this.waterId[n] = id; q.push(n); }
        }
      }
      this.waterSize.push(q.length);
    }
  }

  // Small villages of civilian buildings between the bases and around the map, for infantry to
  // garrison. A building that would cut a base off from the centre is left out.
  placeCivilians(rng, c) {
    const N = this.w;
    this.civ = [];
    this.civMask = new Uint8Array(N * N);
    const centres = [];
    for (const s of this.starts) centres.push([Math.round(s[0] + (c[0] - s[0]) * 0.55), Math.round(s[1] + (c[1] - s[1]) * 0.55)]);
    const extra = Math.max(1, Math.round(2 * (N / 88) * (N / 88)));
    for (let i = 0; i < extra; i++) centres.push([10 + Math.floor(rng() * (N - 20)), 10 + Math.floor(rng() * (N - 20))]);
    const keys = ['civ_house', 'civ_house', 'civ_flats', 'civ_office'];
    for (const [vx, vy] of centres) {
      const want = 2 + Math.floor(rng() * 3);
      for (let k = 0, tries = 0; k < want && tries < 40; tries++) {
        const key = keys[Math.floor(rng() * keys.length)], def = BUILDINGS[key];
        const tx = vx + Math.round((rng() - 0.5) * 10), ty = vy + Math.round((rng() - 0.5) * 10);
        if (!this.civFits(tx, ty, def.w, def.h)) continue;
        this.markCiv(tx, ty, def.w, def.h, 1);
        if (this.starts.some(s => !this.reachable(s, c, this.civMask))) { this.markCiv(tx, ty, def.w, def.h, 0); continue; }
        this.civ.push({ key, tx, ty });
        k++;
      }
    }
  }

  // footprint plus a one-tile walkway on open ground, clear of ore and away from the bases
  civFits(tx, ty, w, h) {
    if (tx < 3 || ty < 3 || tx + w > this.w - 3 || ty + h > this.h - 3) return false;
    if (this.starts.some(([sx, sy]) => Math.hypot(sx - tx, sy - ty) < 14)) return false;
    for (let y = ty - 1; y <= ty + h; y++) for (let x = tx - 1; x <= tx + w; x++) {
      const i = this.idx(x, y);
      if (this.civMask[i] || this.ore[i] > 0) return false;
      if (!this.terrainPassable(x, y)) return false;
    }
    return true;
  }

  markCiv(tx, ty, w, h, v) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) this.civMask[this.idx(x, y)] = v;
  }

  paint(cx, cy, r, t) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (this.inside(x, y) && Math.hypot(x - cx, y - cy) <= r) this.terrain[this.idx(x, y)] = t;
    }
  }

  carve(a, b, always) {
    // only carve if not already reachable
    if (!always && this.reachable(a, b)) return;
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(a[0] + (b[0] - a[0]) * i / steps), y = Math.round(a[1] + (b[1] - a[1]) * i / steps);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!this.inside(x + ox, y + oy)) continue;
        const k = this.idx(x + ox, y + oy);
        if (this.terrain[k] === T_WATER || this.terrain[k] === T_ROCK) this.terrain[k] = T_DIRT;
      }
    }
  }

  reachable(a, b, blocked) {
    return this.flood(a, blocked)[this.idx(b[0], b[1])] === 1;
  }

  // every tile a soldier could walk to from a, up and down ramps and over standing bridges
  flood(a, blocked) {
    const N = this.w, seen = new Uint8Array(N * this.h);
    const s = this.idx(a[0], a[1]), q = [s];
    seen[s] = 1;
    while (q.length) {
      const i = q.pop(), x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inside(nx, ny)) continue;
        const k = ny * N + nx;
        if (seen[k] || (blocked && blocked[k]) || !this.walkable(k) || !this.step(i, k)) continue;
        seen[k] = 1; q.push(k);
      }
    }
    return seen;
  }

  // ---------- hills ----------
  // Raised plateaus from a noise field, clear of the bases, the map edge and the water. Each gets
  // a few ramps; the sides facing the viewer become cliff faces. A hill that would cut a base off
  // or can't be climbed is left flat.
  raiseHills(c) {
    const N = this.w, n = N * N, rng = makeRng(this.seed ^ 0x2545f491);
    const n1 = makeNoise(rng, 24), n2 = makeNoise(rng, 48);
    // tiles at least three steps from any water
    const wd = new Uint8Array(n).fill(9), q = [];
    for (let i = 0; i < n; i++) if (this.terrain[i] === T_WATER) { wd[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % N, y = (i / N) | 0;
      if (wd[i] >= 3) continue;
      for (const [dx, dy] of DIRS) {
        if (!this.inside(x + dx, y + dy)) continue;
        const j = (y + dy) * N + x + dx;
        if (wd[j] > wd[i] + 1) { wd[j] = wd[i] + 1; q.push(j); }
      }
    }
    const cand = new Uint8Array(n), hv = new Float32Array(n), vals = [];
    for (let y = 4; y < N - 4; y++) for (let x = 4; x < N - 4; x++) {
      const i = y * N + x;
      if (wd[i] < 3 || this.starts.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 17)) continue;
      cand[i] = 1;
      hv[i] = n1(x / N * 5, y / N * 5) * 0.7 + n2(x / N * 12, y / N * 12) * 0.3;
      vals.push(hv[i]);
    }
    if (vals.length < 60) return;
    vals.sort((a, b) => b - a);
    const thr = vals[Math.min(vals.length - 1, Math.floor(n * 0.12))];
    let mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = cand[i] && hv[i] > thr ? 1 : 0;
    // smooth out specks and thin necks (opening by a 5x5 square, twice)
    const morph = (m, grow) => {
      const out = new Uint8Array(n);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let v = grow ? 0 : 1;
        for (let oy = -1; oy <= 1 && v === (grow ? 0 : 1); oy++) for (let ox = -1; ox <= 1; ox++) {
          const inb = this.inside(x + ox, y + oy), b = inb ? m[(y + oy) * N + x + ox] : 0;
          if (grow ? b : !b) { v = grow ? 1 : 0; break; }
        }
        out[y * N + x] = v;
      }
      return out;
    };
    for (let k = 0; k < 2; k++) {
      mask = morph(morph(mask, false), false);
      mask = morph(morph(mask, true), true);
      for (let i = 0; i < n; i++) mask[i] &= cand[i];
    }
    // no strips one tile wide
    for (let changed = true; changed;) {
      changed = false;
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const i = y * N + x;
        if (mask[i] && ((!mask[i - 1] && !mask[i + 1]) || (!mask[i - N] && !mask[i + N]))) { mask[i] = 0; changed = true; }
      }
    }
    // the separate hills, biggest first
    const comp = new Int32Array(n).fill(-1), hills = [];
    for (let i = 0; i < n; i++) {
      if (!mask[i] || comp[i] >= 0) continue;
      const tiles = [i];
      comp[i] = hills.length;
      for (let k = 0; k < tiles.length; k++) {
        const j = tiles[k], x = j % N, y = (j / N) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const o = (y + dy) * N + x + dx;
          if (this.inside(x + dx, y + dy) && mask[o] && comp[o] < 0) { comp[o] = hills.length; tiles.push(o); }
        }
      }
      hills.push(tiles);
    }
    hills.sort((a, b) => b.length - a.length);
    // what the first base can walk to now has to stay in reach
    const seen0 = this.flood(this.starts[0]);
    const goals = this.starts.concat([c]).filter(([x, y]) => seen0[this.idx(x, y)]);
    for (const tiles of hills) {
      if (tiles.length < 36) continue;
      const saved = tiles.map(i => [this.terrain[i], this.ore[i], this.oreMax[i]]);
      const revert = () => tiles.forEach((i, k) => { this.height[i] = 0; this.ramp[i] = 0; [this.terrain[i], this.ore[i], this.oreMax[i]] = saved[k]; });
      // a few goes at placing the ramps before the hill is given up; after the first, ramps go
      // where the roads between the bases run into the hill, so they climb over it
      let must = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt === 1) must = this.roadEnds(tiles, goals);
        for (const i of tiles) this.height[i] = 1;
        if (this.tryHill(tiles, rng, goals, must)) break;
        revert();
      }
    }
    // structures keep off the rims, above and below
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.inside(x + dx, y + dy) && this.height[(y + dy) * N + x + dx] !== this.height[i]) { this.noBuild[i] = 1; break; }
      }
    }
  }

  // ramps and cliff faces for a raised hill; false if it then cuts off a base or can't be climbed
  tryHill(tiles, rng, goals, must) {
    const N = this.w;
    if (!this.cutRamps(tiles, rng, must)) return false;
    for (const i of tiles) {
      if (this.ramp[i]) { this.terrain[i] = T_DIRT; this.ore[i] = this.oreMax[i] = 0; }
      else if (this.height[i + 1] === 0 || this.height[i + N] === 0) { this.terrain[i] = T_CLIFF; this.ore[i] = this.oreMax[i] = 0; }
    }
    // the bases still reach each other and the middle, and the top of the hill is reachable
    const seen = this.flood(this.starts[0]);
    if (goals.some(([gx, gy]) => !seen[this.idx(gx, gy)])) return false;
    return tiles.some(i => !this.ramp[i] && this.walkable(i) && seen[i]);
  }

  // where the shortest walks from the first base to the other goals enter and leave a hill
  // (worked out while the hill is still flat)
  roadEnds(tiles, goals) {
    const N = this.w, hill = new Set(tiles), out = [];
    const from = new Int32Array(N * this.h).fill(-1), s = this.idx(goals[0][0], goals[0][1]), q = [s];
    from[s] = s;
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.inside(x + dx, y + dy)) continue;
        const j = (y + dy) * N + x + dx;
        if (from[j] < 0 && this.walkable(j) && this.step(i, j)) { from[j] = i; q.push(j); }
      }
    }
    for (const [gx, gy] of goals.slice(1)) {
      let i = this.idx(gx, gy);
      if (from[i] < 0) continue;
      const on = [];
      for (; i !== s; i = from[i]) if (hill.has(i)) on.push(i);
      if (on.length) out.push(on[0], on[on.length - 1]);
    }
    return out.map(i => [i % N, (i / N) | 0]);
  }

  // Ramps three tiles wide on straight stretches of a hill's edge with open ground below,
  // spread out round the hill: one per ~90 tiles of hill, two to four. Returns how many.
  cutRamps(tiles, rng, must) {
    const N = this.w, inHill = i => this.height[i] === 1;
    const interior = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oy]) => this.inside(x + ox, y + oy) && inHill(this.idx(x + ox, y + oy)));
    const lowGround = (x, y) => {
      if (!this.inside(x, y)) return false;
      const i = this.idx(x, y), t = this.terrain[i];
      return this.height[i] === 0 && t !== T_WATER && t !== T_ROCK && t !== T_CLIFF;
    };
    const cands = [];
    for (const i of tiles) {
      const x = i % N, y = (i / N) | 0;
      DIRS.slice(0, 4).forEach(([dx, dy], d) => {
        const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;
        for (const s of [-1, 0, 1]) {
          const ex = x + px * s, ey = y + py * s;
          if (!inHill(this.idx(ex, ey)) || !interior(ex - dx, ey - dy)) return;
          if (!lowGround(ex + dx, ey + dy) || !lowGround(ex + 2 * dx, ey + 2 * dy)) return;
        }
        cands.push({ x, y, d, px, py });
      });
    }
    if (!cands.length) return 0;
    let want = Math.max(2, Math.min(4, Math.round(tiles.length / 90) + 1));
    const picked = [];
    for (const [mx, my] of must || []) {
      let best = null, bd = 5;
      for (const c of cands) {
        const d = Math.hypot(c.x - mx, c.y - my);
        if (d < bd && !picked.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 4)) { bd = d; best = c; }
      }
      if (best) picked.push(best);
    }
    want = Math.max(want, picked.length);
    if (!picked.length) picked.push(cands[Math.floor(rng() * cands.length)]);
    while (picked.length < want) {
      let best = null, bd = 8;
      for (const c of cands) {
        const d = Math.min(...picked.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
        if (d > bd) { bd = d; best = c; }
      }
      if (!best) break;
      picked.push(best);
    }
    for (const r of picked) for (const s of [-1, 0, 1]) this.ramp[this.idx(r.x + r.px * s, r.y + r.py * s)] = r.d + 1;
    return picked.length;
  }

  // ---------- bridges ----------
  // Two-lane bridges over narrow water, where they save a long walk round by land (or reach
  // somewhere no road goes). The land routes between the bases never depend on one.
  placeBridges() {
    const N = this.w, want = Math.max(1, Math.round(2 * (N / 88) * (N / 88)));
    const bank = (x, y) => {
      if (!this.inside(x, y)) return false;
      const i = this.idx(x, y), t = this.terrain[i];
      return (t === T_GRASS || t === T_DIRT || t === T_SAND) && this.height[i] === 0 && !this.ramp[i];
    };
    const cands = [];
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const px = dy, py = dx;
      for (let y = 6; y < N - 6; y++) for (let x = 6; x < N - 6; x++) {
        if (!bank(x, y) || !bank(x + px, y + py) || !bank(x - dx, y - dy) || !bank(x - dx + px, y - dy + py)) continue;
        let L = 0;
        while (L < 13 && this.isWater(x + dx * (L + 1), y + dy * (L + 1)) && this.isWater(x + px + dx * (L + 1), y + py + dy * (L + 1))) L++;
        if (L < 2 || L > 12) continue;
        const ex = x + dx * (L + 1), ey = y + dy * (L + 1);
        if (!bank(ex, ey) || !bank(ex + px, ey + py) || !bank(ex + dx, ey + dy) || !bank(ex + dx + px, ey + dy + py)) continue;
        cands.push({ x: x + dx, y: y + dy, L, dx, dy, a: [x, y], b: [ex, ey] });
      }
    }
    // how far round it is by land without the bridge
    for (const c of cands) {
      const N2 = N * N, dist = new Int32Array(N2).fill(-1), s = this.idx(c.a[0], c.a[1]), q = [s];
      dist[s] = 0;
      const goal = this.idx(c.b[0], c.b[1]);
      for (let k = 0; k < q.length && dist[goal] < 0; k++) {
        const i = q[k], x = i % N, y = (i / N) | 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!this.inside(x + ox, y + oy)) continue;
          const j = (y + oy) * N + x + ox;
          if (dist[j] >= 0 || !this.walkable(j) || !this.step(i, j)) continue;
          dist[j] = dist[i] + 1; q.push(j);
        }
      }
      c.gain = (dist[goal] < 0 ? 90 : dist[goal]) - c.L;
    }
    cands.sort((a, b) => b.gain - a.gain);
    for (const c of cands) {
      if (this.bridges.length >= want || c.gain < 24) break;
      const mx = c.x + c.dx * c.L / 2, my = c.y + c.dy * c.L / 2;
      if (this.bridges.some(b => Math.hypot(b.x + b.w / 2 - mx, b.y + b.h / 2 - my) < 16)) continue;
      const w = c.dx ? c.L : 2, h = c.dy ? c.L : 2, k = this.bridges.length;
      this.bridges.push({ x: c.x, y: c.y, w, h, axis: c.dx ? 'x' : 'y', up: true, ends: [c.a, c.b] });
      for (let y = c.y; y < c.y + h; y++) for (let x = c.x; x < c.x + w; x++) this.bridgeAt[this.idx(x, y)] = k;
      // keep the bridgeheads clear of structures
      for (const [ex, ey] of [c.a, c.b]) {
        const sx = c.dx ? -c.dx * (ex < c.x ? 1 : -1) : 0, sy = c.dy ? -c.dy * (ey < c.y ? 1 : -1) : 0;
        for (let r = 0; r < 3; r++) for (const s of [0, 1]) {
          const x = ex + sx * r + c.dy * s, y = ey + sy * r + c.dx * s;
          if (this.inside(x, y)) this.noBuild[this.idx(x, y)] = 1;
        }
      }
    }
  }

  oreField(cx, cy, r, type) {
    const rng = this.rng;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (!this.inside(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy) + (rng() - 0.5) * 1.4;
      if (d > r) continue;
      const i = this.idx(x, y);
      if (this.terrain[i] === T_WATER || this.terrain[i] === T_ROCK) this.terrain[i] = T_DIRT;
      const amt = (type === GEM ? 900 : 500) * (0.6 + 0.4 * (1 - d / r)) * (0.8 + rng() * 0.4);
      this.ore[i] = amt; this.oreMax[i] = amt; this.oreType[i] = type;
    }
  }

  regrow(dt) {
    // slow regrowth of depleted fields, RA2-style
    for (let i = 0; i < this.ore.length; i++) {
      if (this.oreMax[i] > 0 && this.ore[i] < this.oreMax[i]) {
        this.ore[i] = Math.min(this.oreMax[i], this.ore[i] + this.oreMax[i] * 0.012 * dt);
      }
    }
  }

  // ---------- rendering of static terrain ----------
  // Colour is computed on a low-resolution grid (8 px per tile) with smooth tile blending,
  // hill shading and water depth, upscaled, then detailed with grain and scenery at full size.
  renderTerrain() {
    const N = this.w, th = this.theme;
    const rng = makeRng(this.seed ^ 0x5bd1e995);
    const pal = { [T_GRASS]: th.grass, [T_DIRT]: th.dirt, [T_SAND]: th.sand, [T_WATER]: th.water, [T_ROCK]: th.rock, [T_CLIFF]: th.rock.map(v => v * 0.7) };
    // distance from land for water depth
    const depth = new Float32Array(N * N).fill(99);
    const q = [];
    for (let i = 0; i < N * N; i++) if (this.terrain[i] !== T_WATER) { depth[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inside(nx, ny)) continue;
        const j = ny * N + nx;
        if (depth[j] > depth[i] + 1) { depth[j] = depth[i] + 1; q.push(j); }
      }
    }
    const tc = new Float32Array(N * N * 3);
    for (let i = 0; i < N * N; i++) {
      const t = this.terrain[i];
      let c = pal[t];
      if (t === T_WATER) {
        const k = Math.min(1, (depth[i] - 1) / 4);
        c = [c[0] + (th.deep[0] - c[0]) * k, c[1] + (th.deep[1] - c[1]) * k, c[2] + (th.deep[2] - c[2]) * k];
      }
      // hilltops catch a little more light than the plain
      const v = (1 + (rng() - 0.5) * 0.08) * (this.height[i] && t !== T_CLIFF ? 1.14 : 1);
      tc[i * 3] = c[0] * v; tc[i * 3 + 1] = c[1] * v; tc[i * 3 + 2] = c[2] * v;
    }
    const S = 8, LW = N * S;
    const low = document.createElement('canvas'); low.width = LW; low.height = LW;
    const lctx = low.getContext('2d');
    const img = lctx.createImageData(LW, LW), d = img.data;
    // per-material coverage (alpha) for blending surface detail later
    const masks = [];  // indexed by terrain type
    for (const t of [T_GRASS, T_DIRT, T_WATER, T_ROCK, T_SAND, T_CLIFF]) masks[t] = lctx.createImageData(LW, LW);
    const moist = makeNoise(rng, 16);
    const hill = makeNoise(rng, 40), det = makeNoise(rng, 170), mott = makeNoise(rng, 64); // sizes cover the sampled ranges
    const H = (x, y) => hill(x / LW * 9, y / LW * 9) * 0.7 + hill(x / LW * 23 + 7, y / LW * 23 + 3) * 0.3;
    const sm = t => t < 0.1 ? 0 : t > 0.9 ? 1 : (t - 0.1) / 0.8 * ((t - 0.1) / 0.8) * (3 - 2 * (t - 0.1) / 0.8);
    const warp = makeNoise(rng, 64);
    // tiles whose edges stay exact: boulders, cliffs, ramps and the rims of the hills
    const hard = i => { const t = this.terrain[i]; return t === T_ROCK || t === T_CLIFF || this.ramp[i] > 0 || this.noBuild[i] > 0; };
    for (let py = 0; py < LW; py++) {
      for (let px = 0; px < LW; px++) {
        // warp terrain boundaries so shores and patches look organic; cliffs stay exact
        let fx = px / S - 0.5, fy = py / S - 0.5;
        const wx = fx + (warp(px / LW * 40, py / LW * 40) - 0.5) * 1.4 + (warp(px / LW * 13 + 5, py / LW * 13) - 0.5) * 0.8,
          wy = fy + (warp(px / LW * 40 + 17, py / LW * 40 + 9) - 0.5) * 1.4 + (warp(px / LW * 13, py / LW * 13 + 23) - 0.5) * 0.8;
        const cx0 = Math.max(0, Math.min(N - 2, Math.floor(wx))), cy0 = Math.max(0, Math.min(N - 2, Math.floor(wy)));
        const ux = Math.min(N - 1, (px / S) | 0), uy = Math.min(N - 1, (py / S) | 0);
        if (!hard(uy * N + ux) && !hard(cy0 * N + cx0) && !hard(cy0 * N + cx0 + 1) &&
            !hard((cy0 + 1) * N + cx0) && !hard((cy0 + 1) * N + cx0 + 1)) { fx = wx; fy = wy; }
        const y0 = Math.max(0, Math.min(N - 1, Math.floor(fy))), y1 = Math.min(N - 1, y0 + 1), ty = sm(Math.min(1, Math.max(0, fy - y0)));
        const x0 = Math.max(0, Math.min(N - 1, Math.floor(fx))), x1 = Math.min(N - 1, x0 + 1), tx = sm(Math.min(1, Math.max(0, fx - x0)));
        const a = (y0 * N + x0) * 3, b = (y0 * N + x1) * 3, c = (y1 * N + x0) * 3, e = (y1 * N + x1) * 3;
        const k = (py * LW + px) * 4;
        const ti = this.terrain[((py / S) | 0) * N + ((px / S) | 0)];
        const tA = this.terrain[y0 * N + x0], tB = this.terrain[y0 * N + x1], tC = this.terrain[y1 * N + x0], tE = this.terrain[y1 * N + x1];
        const wA = (1 - tx) * (1 - ty), wB = tx * (1 - ty), wC = (1 - tx) * ty, wE = tx * ty;
        for (const [t, w] of [[tA, wA], [tB, wB], [tC, wC], [tE, wE]]) masks[t].data[k + 3] += w * 255;
        const wGrass = (tA === T_GRASS ? wA : 0) + (tB === T_GRASS ? wB : 0) + (tC === T_GRASS ? wC : 0) + (tE === T_GRASS ? wE : 0);
        // large patches of dry and lush ground
        const dry = Math.min(1, Math.max(0, (moist(px / LW * 8, py / LW * 8) - 0.38) * 2.4)) * wGrass;
        const water = ti === T_WATER;
        // hill shading from a smooth height field, light from the top-left
        const shade = water ? 0 : (H(px - 2, py - 2) - H(px + 2, py + 2)) * 260;
        const m = (mott(px / LW * 60, py / LW * 60) - 0.5) * (water ? 10 : 26) + (det(px / LW * 160, py / LW * 160) - 0.5) * 12;
        let dune = 0;
        if (th.dunes && !water) dune = Math.sin(px * 0.09 + py * 0.05 + mott(px / LW * 20, py / LW * 20) * 9) * 7;
        for (let ch = 0; ch < 3; ch++) {
          const top = tc[a + ch] + (tc[b + ch] - tc[a + ch]) * tx, bot = tc[c + ch] + (tc[e + ch] - tc[c + ch]) * tx;
          let v = top + (bot - top) * ty + shade + m + dune + (th.dry[ch] - th.grass[ch]) * dry * 0.85;
          if (water && ch === 2) v += m * 0.5;
          d[k + ch] = v;
        }
        d[k + 3] = 255;
      }
    }
    lctx.putImageData(img, 0, 0);
    const maskCanvas = mk => { const c = document.createElement('canvas'); c.width = c.height = LW; const x = c.getContext('2d'); for (let i = 0; i < mk.data.length; i += 4) mk.data[i] = mk.data[i + 1] = mk.data[i + 2] = 255; x.putImageData(mk, 0, 0); return c; };
    const mGrass = maskCanvas(masks[T_GRASS]), mDirt = maskCanvas(masks[T_DIRT]), mSand = maskCanvas(masks[T_SAND]);
    const mWater = maskCanvas(masks[T_WATER]), mRock = maskCanvas(masks[T_ROCK]), mCliff = maskCanvas(masks[T_CLIFF]);

    const cv = document.createElement('canvas');
    cv.width = N * TILE; cv.height = N * TILE;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(low, 0, 0, cv.width, cv.height);
    // fine grain via a tiling noise pattern
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gctx = gc.getContext('2d'), gi = gctx.createImageData(128, 128);
    for (let i = 0; i < gi.data.length; i += 4) {
      const v = rng() < 0.5 ? 0 : 255;
      gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = v; gi.data[i + 3] = rng() * 22;
    }
    gctx.putImageData(gi, 0, 0);
    ctx.fillStyle = ctx.createPattern(gc, 'repeat');
    ctx.fillRect(0, 0, cv.width, cv.height);

    // surface detail: a tiling texture per material, laid only where that material is
    const W = cv.width, layer = document.createElement('canvas');
    layer.width = layer.height = W;
    const lc = layer.getContext('2d');
    const overlay = (tex, mask, alpha = 1) => {
      lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, W, W);
      lc.fillStyle = lc.createPattern(tex, 'repeat'); lc.fillRect(0, 0, W, W);
      lc.globalCompositeOperation = 'destination-in'; lc.imageSmoothingEnabled = true;
      lc.drawImage(mask, 0, 0, W, W);
      ctx.globalAlpha = alpha; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
    };
    overlay(surfaceTexture(th.snow ? 'snow' : th.blades ? 'grass' : 'sand', th, rng), mGrass);
    overlay(surfaceTexture('dirt', th, rng), mDirt);
    overlay(surfaceTexture(th.snow ? 'snow' : 'sand', th, rng), mSand, 0.8);
    overlay(surfaceTexture('gravel', th, rng), mRock);
    overlay(surfaceTexture('gravel', th, rng), mCliff, 0.6);
    overlay(surfaceTexture('water', th, rng), mWater);
    // shoreline: a wide band of wet ground and a thin line of foam just outside the water
    // (computed on the low-resolution grid, then stretched: they are soft anyway)
    if ('filter' in ctx) {
      const bc = document.createElement('canvas'); bc.width = bc.height = LW;
      const bx = bc.getContext('2d');
      const band = (blur, color) => {
        bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, LW, LW);
        bx.filter = `blur(${blur}px)`; bx.drawImage(mWater, 0, 0); bx.filter = 'none';
        bx.globalCompositeOperation = 'destination-out'; bx.drawImage(mWater, 0, 0);
        bx.globalCompositeOperation = 'source-in'; bx.fillStyle = color; bx.fillRect(0, 0, LW, LW);
        ctx.drawImage(bc, 0, 0, W, W);
      };
      band(3, th.snow ? 'rgba(200,220,235,0.35)' : 'rgba(40,30,16,0.38)');
      band(0.5, 'rgba(236,246,250,0.6)');
    }
    // broken ice floes along arctic shores: irregular slabs with a lit edge
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!th.snow || this.terrain[this.idx(x, y)] !== T_WATER || depth[this.idx(x, y)] > 1 || rng() > 0.35) continue;
      const cx = x * TILE + rng() * TILE, cy = y * TILE + rng() * TILE, r = 4 + rng() * 7, n = 5 + ((rng() * 3) | 0), rot = rng() * 6;
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const a = rot + k / n * Math.PI * 2, rr = r * (0.6 + rng() * 0.5); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath();
      ctx.fillStyle = 'rgba(220,234,246,0.75)'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,175,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    }
    this.paintRelief(ctx, layer);
    // boulders and trees are upright 3D props drawn by the renderer; only bushes are painted flat
    this.props = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.terrain[this.idx(x, y)] !== T_ROCK) continue;
      this.props.push({ kind: 'rock', x: (x + 0.3 + rng() * 0.4) * TILE, y: (y + 0.3 + rng() * 0.4) * TILE, v: (rng() * 8) | 0 });
    }
    for (const dc of this.decor) {
      if (dc.kind === 'bush') this.drawDecor(ctx, dc, th, rng);
      else this.props.push({ kind: 'tree', x: dc.x * TILE, y: dc.y * TILE, v: (rng() * 6) | 0 });
    }
    this.terrainCanvas = cv;

    // minimap terrain
    const mm = document.createElement('canvas');
    mm.width = N; mm.height = N;
    mm.getContext('2d').drawImage(low, 0, 0, N, N);
    this.miniCanvas = mm;
  }

  // Hills, painted onto the flat ground texture. The isometric transform is affine and turns a
  // world offset of (TILE, TILE) into one tile-height straight down the screen, so a rock face
  // hanging below a hilltop edge is the parallelogram from that edge to the edge moved by
  // (TILE, TILE): it fills the band of cliff tiles in front of the hill and ends in true vertical
  // corners. Faces are drawn back to front on their own layer, then cut away wherever a hilltop
  // lies in front of them. Ramps are graded slopes; the far edges of a hill get a bright rim.
  paintRelief(ctx, layer) {
    const N = this.w, T = TILE, rock = this.theme.rock, dirt = this.theme.dirt;
    // cliff rock: the theatre's stone warmed toward its soil
    const face0 = rock.map((v, k) => v * 0.6 + dirt[k] * 0.5);
    const at = (x, y) => this.inside(x, y) ? this.idx(x, y) : -1;
    const low = (x, y) => at(x, y) >= 0 && this.height[at(x, y)] === 0;
    const cliff = (x, y) => at(x, y) >= 0 && this.terrain[at(x, y)] === T_CLIFF;
    const top = (x, y) => at(x, y) >= 0 && this.height[at(x, y)] === 1 && !cliff(x, y);
    const col = (c, k, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
    const hash = k => { let t = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b); t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
    const line = (c, x0, y0, x1, y1, style, w = 1) => { c.strokeStyle = style; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    // the foot of the cliff band (shows beside the ends of the faces) and shadows on the plain
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!cliff(x, y)) continue;
      const X = x * T, Y = y * T;
      ctx.fillStyle = col(face0, 0.42); ctx.fillRect(X, Y, T, T);
      if (low(x, y + 1)) {
        const g = ctx.createLinearGradient(0, Y + T, 0, Y + T * 1.8);
        g.addColorStop(0, 'rgba(10,8,4,0.5)'); g.addColorStop(1, 'rgba(10,8,4,0)');
        ctx.fillStyle = g; ctx.fillRect(X, Y + T, T, T * 0.8);
      }
      if (low(x + 1, y)) {
        const g = ctx.createLinearGradient(X + T, 0, X + T * 1.8, 0);
        g.addColorStop(0, 'rgba(10,8,4,0.55)'); g.addColorStop(1, 'rgba(10,8,4,0)');
        ctx.fillStyle = g; ctx.fillRect(X + T, Y, T * 0.8, T);
      }
    }
    // the rock faces, back to front
    const lc = layer.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, layer.width, layer.height);
    const faces = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!top(x, y) || this.ramp[this.idx(x, y)]) continue;
      if (cliff(x, y + 1)) faces.push({ x, y, south: true, d: x + y });
      if (cliff(x + 1, y)) faces.push({ x, y, south: false, d: x + y });
    }
    faces.sort((a, b) => a.d - b.d);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const f of faces) {
      // the face's upper edge (ex, ey) along its run, then the face hangs (T, T) below it
      const ex = f.south ? f.x * T : (f.x + 1) * T, ey = f.south ? (f.y + 1) * T : f.y * T;
      const rx = f.south ? T : 0, ry = f.south ? 0 : T;
      x0 = Math.min(x0, ex); y0 = Math.min(y0, ey); x1 = Math.max(x1, ex + 2 * T); y1 = Math.max(y1, ey + 2 * T);
      lc.save();
      lc.beginPath(); lc.moveTo(ex, ey); lc.lineTo(ex + rx, ey + ry); lc.lineTo(ex + rx + T, ey + ry + T); lc.lineTo(ex + T, ey + T); lc.closePath();
      lc.clip();
      const k = f.south ? 1 : 0.66; // light from the upper left: south faces lit, east faces in shade
      const g = f.south ? lc.createLinearGradient(0, ey, 0, ey + T) : lc.createLinearGradient(ex, 0, ex + T, 0);
      g.addColorStop(0, col(face0, 1.55 * k)); g.addColorStop(0.12, col(face0, 1.25 * k));
      g.addColorStop(0.65, col(face0, 0.95 * k)); g.addColorStop(1, col(face0, 0.55 * k));
      lc.fillStyle = g; lc.fillRect(ex, ey, 2 * T, 2 * T);
      // cracks straight down the face (world lines x - y = c), continuous from face to face
      for (let c = Math.floor((ex - ey - T) / 3) * 3; c <= ex - ey + T; c += 3) {
        const r = hash(c * 7919 + 13);
        if (r < 0.4) continue;
        const len = T * (0.5 + hash(c * 31 + 7) * 0.5);
        line(lc, ey + c, ey, ey + c + len, ey + len, r > 0.86 ? 'rgba(255,248,230,0.14)' : `rgba(0,0,0,${0.1 + r * 0.22})`, r > 0.7 ? 1.6 : 1);
      }
      // ledges along the face
      for (const fr of [0.33, 0.62]) {
        const j = fr * T + (hash(ex * 31 + ey * 17 + fr * 100) - 0.5) * 6;
        if (f.south) { line(lc, ex, ey + j, ex + 2 * T, ey + j, 'rgba(0,0,0,0.2)', 1.5); line(lc, ex, ey + j - 1.5, ex + 2 * T, ey + j - 1.5, 'rgba(255,250,235,0.08)'); }
        else { line(lc, ex + j, ey, ex + j, ey + 2 * T, 'rgba(0,0,0,0.2)', 1.5); line(lc, ex + j - 1.5, ey, ex + j - 1.5, ey + 2 * T, 'rgba(255,250,235,0.08)'); }
      }
      lc.restore();
      // the lit lip along the top edge and a dark seam at the foot
      line(lc, ex, ey, ex + rx, ey + ry, 'rgba(255,250,235,0.55)', 2.5);
      line(lc, ex + T, ey + T, ex + T + rx, ey + T + ry, 'rgba(0,0,0,0.45)', 1.5);
    }
    if (faces.length) {
      // hilltops (and ramps) in front of a face hide it
      lc.globalCompositeOperation = 'destination-out'; lc.fillStyle = '#000';
      for (let y = Math.floor(y0 / T); y <= Math.min(N - 1, y1 / T); y++) for (let x = Math.floor(x0 / T); x <= Math.min(N - 1, x1 / T); x++) {
        if (!top(x, y)) continue;
        const r = this.ramp[this.idx(x, y)], X = x * T, Y = y * T;
        if (r === 3 || r === 1) {
          // a ramp toward the viewer only hides what is above its slope: the face beside it
          // shows as a triangle running down to the foot (south ramps: lower left kept)
          lc.beginPath();
          if (r === 3) { lc.moveTo(X, Y); lc.lineTo(X + T, Y); lc.lineTo(X + T, Y + T); }
          else { lc.moveTo(X, Y); lc.lineTo(X, Y + T); lc.lineTo(X + T, Y + T); }
          lc.closePath(); lc.fill();
        } else lc.fillRect(X, Y, T, T);
      }
      lc.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    // ramps: graded slopes with tread marks across them
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = this.ramp[this.idx(x, y)];
      if (!r) continue;
      const [dx, dy] = DIRS[r - 1], X = x * T, Y = y * T;
      // from the hill side of the tile to the plain side
      const ax = X + T / 2 - dx * T / 2, ay = Y + T / 2 - dy * T / 2, bx = X + T / 2 + dx * T / 2, by = Y + T / 2 + dy * T / 2;
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      const facing = dx > 0 || dy > 0; // toward the viewer: lit; away: in shade
      g.addColorStop(0, col(dirt, 1.3)); g.addColorStop(1, col(dirt, facing ? 1.0 : 0.7));
      ctx.fillStyle = g; ctx.fillRect(X, Y, T, T);
      for (let k = 4; k < T; k += 6) {
        if (dx) line(ctx, X + k, Y, X + k, Y + T, 'rgba(0,0,0,0.2)', 1.5); else line(ctx, X, Y + k, X + T, Y + k, 'rgba(0,0,0,0.2)', 1.5);
      }
    }
    // far edges of the hills (facing away from the viewer): a bright rim over a dark drop
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = this.idx(x, y);
      if (!top(x, y) || this.ramp[i]) continue;
      const X = x * T, Y = y * T;
      if (low(x, y - 1) && !this.ramp[at(x, y - 1)]) { line(ctx, X, Y - 2, X + T, Y - 2, 'rgba(0,0,0,0.45)', 4); line(ctx, X, Y + 1, X + T, Y + 1, 'rgba(255,250,235,0.45)', 2); }
      if (low(x - 1, y) && !this.ramp[at(x - 1, y)]) { line(ctx, X - 2, Y, X - 2, Y + T, 'rgba(0,0,0,0.45)', 4); line(ctx, X + 1, Y, X + 1, Y + T, 'rgba(255,250,235,0.45)', 2); }
    }
  }

  drawDecor(ctx, dc, th, rng) {
    const X = dc.x * TILE, Y = dc.y * TILE, s = dc.s;
    const [hi, lo] = th.leaf;
    if (dc.kind === 'bush') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(X + 2, Y + 2, 5 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k === 2 ? hi : lo;
        ctx.beginPath(); ctx.arc(X + (k - 1) * 3 * s, Y - k * s, (3.2 - k * 0.4) * s, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    if (th.decor === 'pine') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(X + 7 * s, Y + 6 * s, 10 * s, 5 * s, 0.5, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 3; k++) {
        const r = (10 - k * 3) * s;
        ctx.fillStyle = k % 2 ? hi : lo;
        ctx.beginPath();
        for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2, rr = a % 2 ? r * 0.6 : r; ctx.lineTo(X + Math.cos(ang) * rr, Y - k * 2 * s + Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
        if (th.snow) { ctx.fillStyle = 'rgba(240,246,252,0.7)'; ctx.beginPath(); ctx.arc(X - r * 0.25, Y - k * 2 * s - r * 0.25, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
      }
      return;
    }
    if (th.decor === 'shrub') {
      ctx.strokeStyle = lo; ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * 6 * s, Y + Math.sin(a) * 5 * s); ctx.stroke(); }
      ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(X, Y, 2.5 * s, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // broadleaf canopy: several overlapping lobes with a lit top-left
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(X + 6 * s, Y + 7 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + dc.x, lx = X + Math.cos(a) * 4 * s, ly = Y + Math.sin(a) * 4 * s;
      const g = ctx.createRadialGradient(lx - 3 * s, ly - 3 * s, 0.5, lx, ly, 7 * s);
      g.addColorStop(0, hi); g.addColorStop(1, lo);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(lx, ly, 6.5 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------------- A* pathfinding ----------------
class PathFinder {
  constructor(map) {
    this.map = map;
    const n = map.w * map.h;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.gen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.cur = 0;
    this.heapI = new Int32Array(n * 8);
    this.heapF = new Float32Array(n * 8);
  }

  // Find a path from (sx,sy) to within `range` tiles of (gx,gy) for a unit that moves by `mode`
  // (MOVE_LAND, MOVE_WATER or MOVE_AMPHIB). Returns array of [x,y] tile coords.
  find(sx, sy, gx, gy, range = 0, mode = MOVE_LAND, maxNodes = 6000) {
    const m = this.map, W = m.w;
    this.cur++;
    const cur = this.cur;
    let hs = 0;
    const hI = this.heapI, hF = this.heapF;
    const push = (i, f) => {
      let k = hs++;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (hF[p] <= f) break;
        hI[k] = hI[p]; hF[k] = hF[p]; k = p;
      }
      hI[k] = i; hF[k] = f;
    };
    const pop = () => {
      const top = hI[0];
      const li = hI[--hs], lf = hF[hs];
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= hs) break;
        if (c + 1 < hs && hF[c + 1] < hF[c]) c++;
        if (hF[c] >= lf) break;
        hI[k] = hI[c]; hF[k] = hF[c]; k = c;
      }
      hI[k] = li; hF[k] = lf;
      return top;
    };
    const H = (x, y) => {
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy);
    };
    const s = sx + sy * W;
    this.g[s] = 0; this.gen[s] = cur; this.parent[s] = -1;
    push(s, H(sx, sy));
    let best = s, bestH = H(sx, sy), count = 0;
    const r2 = range * range;
    while (hs > 0) {
      const i = pop();
      if (this.closed[i] === cur) continue;
      this.closed[i] = cur;
      const x = i % W, y = (i / W) | 0;
      const dx = x - gx, dy = y - gy;
      if (dx * dx + dy * dy <= r2 || (dx === 0 && dy === 0)) { best = i; break; }
      const h = H(x, y);
      if (h < bestH) { bestH = h; best = i; }
      if (++count > maxNodes) break;
      const gi = this.g[i];
      for (let d = 0; d < 8; d++) {
        const ox = DIRS[d][0], oy = DIRS[d][1];
        const nx = x + ox, ny = y + oy;
        if (!m.passable(nx, ny, mode)) continue;
        const ni = nx + ny * W;
        if (!m.step(i, ni)) continue;
        if (ox !== 0 && oy !== 0 && (!m.passable(x + ox, y, mode) || !m.passable(x, y + oy, mode) || !m.step(i, i + ox) || !m.step(i, i + oy * W))) continue;
        if (this.closed[ni] === cur) continue;
        const ng = gi + (ox !== 0 && oy !== 0 ? 1.4142 : 1);
        if (this.gen[ni] === cur && this.g[ni] <= ng) continue;
        this.gen[ni] = cur; this.g[ni] = ng; this.parent[ni] = i;
        push(ni, ng + H(nx, ny) * 1.05);
      }
    }
    const path = [];
    let k = best;
    while (k !== s && k >= 0) { path.push([k % W, (k / W) | 0]); k = this.parent[k]; }
    path.reverse();
    return this.smooth(sx, sy, path, mode);
  }

  lineClear(x0, y0, x1, y1, mode) {
    const m = this.map;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 3);
    let prev = m.idx(x0, y0);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const cx = Math.floor(x + 0.5), cy = Math.floor(y + 0.5);
      if (!m.passable(cx, cy, mode)) return false;
      const ci = m.idx(cx, cy);
      // no walking off a cliff edge: every tile change has to be a legal step
      if (!m.step(prev, ci)) return false;
      prev = ci;
      // check a small box around the sample so units don't clip corners
      for (const [ox, oy] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
        const bx = Math.floor(x + 0.5 + ox), by = Math.floor(y + 0.5 + oy);
        if (!m.passable(bx, by, mode) || !m.step(ci, m.idx(bx, by))) return false;
      }
    }
    return m.step(prev, m.idx(x1, y1));
  }

  smooth(sx, sy, path, mode) {
    if (path.length < 3) return path;
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < path.length) {
      let j = Math.min(path.length - 1, i + 12);
      while (j > i && !this.lineClear(ax, ay, path[j][0], path[j][1], mode)) j--;
      out.push(path[j]);
      ax = path[j][0]; ay = path[j][1];
      i = j + 1;
    }
    return out;
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
