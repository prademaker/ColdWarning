// ColdWarning — terrain generation, ore, pathfinding.
'use strict';

const T_GRASS = 0, T_DIRT = 1, T_WATER = 2, T_ROCK = 3, T_SAND = 4;
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
  temperate: { grass: [68, 88, 46], dirt: [102, 86, 58], sand: [156, 142, 100], water: [30, 66, 84], deep: [12, 32, 50], rock: [92, 90, 84],
    water0: 0.3, decor: 'broadleaf', density: 1 / 12, leaf: ['#56803a', '#26431a'] },
  desert: { grass: [184, 156, 108], dirt: [152, 118, 80], sand: [204, 180, 132], water: [40, 104, 110], deep: [18, 60, 74], rock: [146, 108, 76],
    water0: 0.24, decor: 'shrub', density: 1 / 40, leaf: ['#7d7a45', '#4e4a28'], dunes: true },
  arctic: { grass: [214, 222, 232], dirt: [146, 154, 158], sand: [186, 204, 218], water: [42, 76, 100], deep: [16, 36, 58], rock: [104, 112, 124],
    water0: 0.3, decor: 'pine', density: 1 / 14, leaf: ['#3e5e46', '#1c3122'], snow: true },
  steppe: { grass: [136, 130, 76], dirt: [116, 96, 64], sand: [172, 158, 112], water: [36, 74, 88], deep: [14, 38, 52], rock: [110, 102, 88],
    water0: 0.27, decor: 'shrub', density: 1 / 26, leaf: ['#6f7a3c', '#3e4a20'] },
  jungle: { grass: [44, 78, 36], dirt: [90, 72, 46], sand: [148, 134, 90], water: [22, 74, 72], deep: [8, 38, 42], rock: [78, 86, 72],
    water0: 0.32, decor: 'broadleaf', density: 1 / 4, leaf: ['#3f7a2c', '#173a12'] },
};

class GameMap {
  constructor(size, seed, theater = 'temperate') {
    this.w = size; this.h = size;
    this.seed = seed;
    this.theater = THEMES[theater] ? theater : 'temperate';
    this.theme = THEMES[this.theater];
    const n = size * size;
    this.terrain = new Uint8Array(n);
    this.ore = new Float32Array(n);      // credit value remaining
    this.oreType = new Uint8Array(n);
    this.oreMax = new Float32Array(n);   // for regrowth
    this.bld = new Int32Array(n).fill(-1);  // building id occupying tile
    this.generate();
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  terrainPassable(x, y) {
    if (!this.inside(x, y)) return false;
    const t = this.terrain[this.idx(x, y)];
    return t !== T_WATER && t !== T_ROCK;
  }
  passable(x, y) {
    return this.terrainPassable(x, y) && this.bld[this.idx(x, y)] < 0;
  }

  generate() {
    const N = this.w, rng = makeRng(this.seed);
    this.rng = rng;
    const n1 = makeNoise(rng, 16), n2 = makeNoise(rng, 32), n3 = makeNoise(rng, 24), n4 = makeNoise(rng, 40);
    const height = (x, y) => n1(x / N * 6, y / N * 6) * 0.65 + n2(x / N * 14, y / N * 14) * 0.35;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = height(x, y);
      const r = n3(x / N * 10, y / N * 10) * 0.7 + n2(x / N * 25, y / N * 25) * 0.3;
      const d = n4(x / N * 18, y / N * 18);
      let t = T_GRASS;
      const w0 = this.theme.water0;
      if (h < w0) t = T_WATER;
      else if (h < w0 + 0.035) t = T_SAND;
      else if (r > 0.7) t = T_ROCK;
      else if (d > 0.62) t = T_DIRT;
      this.terrain[this.idx(x, y)] = t;
    }
    // edges are water-free so armies can always flank
    // starting positions: opposite corners
    const m = 11;
    const corners = [[m, N - 1 - m], [N - 1 - m, m], [m, m], [N - 1 - m, N - 1 - m]];
    const pick = rng() < 0.5 ? 0 : 2;
    this.starts = [corners[pick], corners[pick + 1]];
    if (rng() < 0.5) this.starts.reverse();

    for (const [sx, sy] of this.starts) this.paint(sx, sy, 9, T_GRASS);
    // guarantee land connectivity between starts and to the center
    const c = [N >> 1, N >> 1];
    this.carve(this.starts[0], c); this.carve(this.starts[1], c);
    this.carve(this.starts[0], this.starts[1]);

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
    const extra = 6;
    for (let i = 0; i < extra; i++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 8 + Math.floor(rng() * (N - 16)), y = 8 + Math.floor(rng() * (N - 16));
        if (this.starts.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 16)) continue;
        if (!this.terrainPassable(x, y)) continue;
        this.oreField(x, y, 2.5 + rng() * 1.5, rng() < 0.25 ? GEM : ORE);
        break;
      }
    }
    // shoreline sand
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = this.idx(x, y);
      if (this.terrain[i] !== T_GRASS && this.terrain[i] !== T_DIRT) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.inside(x + dx, y + dy) && this.terrain[this.idx(x + dx, y + dy)] === T_WATER) { this.terrain[i] = T_SAND; break; }
      }
    }
    this.decor = [];
    for (let i = 0; i < N * N * this.theme.density; i++) {
      const x = rng() * N, y = rng() * N;
      const t = this.terrain[this.idx(x | 0, y | 0)];
      if (t === T_GRASS && this.ore[this.idx(x | 0, y | 0)] === 0) this.decor.push({ x, y, kind: rng() < 0.55 ? 'bush' : 'tree', s: 0.6 + rng() * 0.6 });
    }
  }

  paint(cx, cy, r, t) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (this.inside(x, y) && Math.hypot(x - cx, y - cy) <= r) this.terrain[this.idx(x, y)] = t;
    }
  }

  carve(a, b) {
    // only carve if not already reachable
    if (this.reachable(a, b)) return;
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

  reachable(a, b) {
    const seen = new Uint8Array(this.w * this.h);
    const q = [a[0], a[1]]; seen[this.idx(a[0], a[1])] = 1;
    while (q.length) {
      const y = q.pop(), x = q.pop();
      if (x === b[0] && y === b[1]) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.terrainPassable(nx, ny)) continue;
        const k = this.idx(nx, ny);
        if (seen[k]) continue;
        seen[k] = 1; q.push(nx, ny);
      }
    }
    return false;
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
    const pal = { [T_GRASS]: th.grass, [T_DIRT]: th.dirt, [T_SAND]: th.sand, [T_WATER]: th.water, [T_ROCK]: th.rock };
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
      const v = 1 + (rng() - 0.5) * 0.08;
      tc[i * 3] = c[0] * v; tc[i * 3 + 1] = c[1] * v; tc[i * 3 + 2] = c[2] * v;
    }
    const S = 8, LW = N * S;
    const low = document.createElement('canvas'); low.width = LW; low.height = LW;
    const lctx = low.getContext('2d');
    const img = lctx.createImageData(LW, LW), d = img.data;
    const hill = makeNoise(rng, 40), det = makeNoise(rng, 170), mott = makeNoise(rng, 64); // sizes cover the sampled ranges
    const H = (x, y) => hill(x / LW * 9, y / LW * 9) * 0.7 + hill(x / LW * 23 + 7, y / LW * 23 + 3) * 0.3;
    const sm = t => t < 0.2 ? 0 : t > 0.8 ? 1 : (t - 0.2) / 0.6 * ((t - 0.2) / 0.6) * (3 - 2 * (t - 0.2) / 0.6);
    const warp = makeNoise(rng, 64);
    const hard = t => t === T_ROCK;
    for (let py = 0; py < LW; py++) {
      for (let px = 0; px < LW; px++) {
        // warp terrain boundaries so shores and patches look organic; cliffs stay exact
        let fx = px / S - 0.5, fy = py / S - 0.5;
        const wx = fx + (warp(px / LW * 40, py / LW * 40) - 0.5) * 1.1, wy = fy + (warp(px / LW * 40 + 17, py / LW * 40 + 9) - 0.5) * 1.1;
        const cx0 = Math.max(0, Math.min(N - 2, Math.floor(wx))), cy0 = Math.max(0, Math.min(N - 2, Math.floor(wy)));
        const ux = Math.min(N - 1, (px / S) | 0), uy = Math.min(N - 1, (py / S) | 0);
        if (!hard(this.terrain[uy * N + ux]) && !hard(this.terrain[cy0 * N + cx0]) && !hard(this.terrain[cy0 * N + cx0 + 1]) &&
            !hard(this.terrain[(cy0 + 1) * N + cx0]) && !hard(this.terrain[(cy0 + 1) * N + cx0 + 1])) { fx = wx; fy = wy; }
        const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(N - 1, y0 + 1), ty = sm(Math.min(1, Math.max(0, fy - y0)));
        const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(N - 1, x0 + 1), tx = sm(Math.min(1, Math.max(0, fx - x0)));
        const a = (y0 * N + x0) * 3, b = (y0 * N + x1) * 3, c = (y1 * N + x0) * 3, e = (y1 * N + x1) * 3;
        const k = (py * LW + px) * 4;
        const ti = this.terrain[((py / S) | 0) * N + ((px / S) | 0)];
        const water = ti === T_WATER;
        // hill shading from a smooth height field, light from the top-left
        const shade = water ? 0 : (H(px - 2, py - 2) - H(px + 2, py + 2)) * 260;
        const m = (mott(px / LW * 60, py / LW * 60) - 0.5) * (water ? 10 : 26) + (det(px / LW * 160, py / LW * 160) - 0.5) * 12;
        let dune = 0;
        if (th.dunes && !water) dune = Math.sin(px * 0.09 + py * 0.05 + mott(px / LW * 20, py / LW * 20) * 9) * 7;
        for (let ch = 0; ch < 3; ch++) {
          const top = tc[a + ch] + (tc[b + ch] - tc[a + ch]) * tx, bot = tc[c + ch] + (tc[e + ch] - tc[c + ch]) * tx;
          let v = top + (bot - top) * ty + shade + m + dune;
          if (water && ch === 2) v += m * 0.5;
          d[k + ch] = v;
        }
        d[k + 3] = 255;
      }
    }
    lctx.putImageData(img, 0, 0);

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

    // ground details: tufts, pebbles, cracks, ripples on water
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = this.terrain[this.idx(x, y)], X = x * TILE, Y = y * TILE;
      if (t === T_GRASS) {
        const n = th.snow ? 1 : 4;
        for (let k = 0; k < n; k++) {
          const gx = X + rng() * TILE, gy = Y + rng() * TILE;
          if (th.snow) { ctx.fillStyle = 'rgba(120,140,160,0.18)'; ctx.fillRect(gx, gy, 3 + rng() * 5, 1); continue; }
          ctx.strokeStyle = `rgba(${rng() < 0.5 ? '20,35,10' : '150,160,90'},0.35)`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + (rng() - 0.5) * 3, gy - 2 - rng() * 3); ctx.stroke();
        }
      } else if (t === T_DIRT || t === T_SAND) {
        for (let k = 0; k < 2; k++) {
          ctx.fillStyle = `rgba(${rng() < 0.5 ? '40,30,20' : '230,220,190'},0.25)`;
          ctx.beginPath(); ctx.arc(X + rng() * TILE, Y + rng() * TILE, 0.8 + rng() * 1.4, 0, Math.PI * 2); ctx.fill();
        }
        if (t === T_DIRT && rng() < 0.15) {
          ctx.strokeStyle = 'rgba(30,20,10,0.25)'; ctx.beginPath();
          let cx = X + rng() * TILE, cy = Y + rng() * TILE; ctx.moveTo(cx, cy);
          for (let s2 = 0; s2 < 3; s2++) { cx += (rng() - 0.5) * 12; cy += (rng() - 0.5) * 12; ctx.lineTo(cx, cy); }
          ctx.stroke();
        }
      } else if (t === T_WATER) {
        if (th.snow && depth[this.idx(x, y)] <= 2 && rng() < 0.5) {
          ctx.fillStyle = 'rgba(225,238,248,0.55)';
          ctx.beginPath(); ctx.ellipse(X + rng() * TILE, Y + rng() * TILE, 4 + rng() * 8, 3 + rng() * 5, rng() * 3, 0, Math.PI * 2); ctx.fill();
        } else if (rng() < 0.35) {
          ctx.strokeStyle = 'rgba(190,225,240,0.12)'; ctx.lineWidth = 1;
          const wx = X + rng() * TILE, wy = Y + rng() * TILE;
          ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 5, wy - 2, wx + 10, wy); ctx.stroke();
        }
      }
    }
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

  // Find a path from (sx,sy) to within `range` tiles of (gx,gy). Returns array of [x,y] tile coords.
  find(sx, sy, gx, gy, range = 0, maxNodes = 6000) {
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
        if (!m.passable(nx, ny)) continue;
        if (ox !== 0 && oy !== 0 && (!m.passable(x + ox, y) || !m.passable(x, y + oy))) continue;
        const ni = nx + ny * W;
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
    return this.smooth(sx, sy, path);
  }

  lineClear(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      // check a small box around the sample so units don't clip corners
      for (const [ox, oy] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
        if (!this.map.passable(Math.floor(x + 0.5 + ox), Math.floor(y + 0.5 + oy))) return false;
      }
    }
    return true;
  }

  smooth(sx, sy, path) {
    if (path.length < 3) return path;
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < path.length) {
      let j = Math.min(path.length - 1, i + 12);
      while (j > i && !this.lineClear(ax, ay, path[j][0], path[j][1])) j--;
      out.push(path[j]);
      ax = path[j][0]; ay = path[j][1];
      i = j + 1;
    }
    return out;
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
