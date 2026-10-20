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

class GameMap {
  constructor(size, seed) {
    this.w = size; this.h = size;
    this.seed = seed;
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
      if (h < 0.3) t = T_WATER;
      else if (h < 0.335) t = T_SAND;
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
    for (let i = 0; i < N * N / 14; i++) {
      const x = rng() * N, y = rng() * N;
      const t = this.terrain[this.idx(x | 0, y | 0)];
      if (t === T_GRASS) this.decor.push({ x, y, kind: rng() < 0.7 ? 'bush' : 'tree', s: 0.6 + rng() * 0.6 });
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
  renderTerrain() {
    const cv = document.createElement('canvas');
    cv.width = this.w * TILE; cv.height = this.h * TILE;
    const ctx = cv.getContext('2d');
    const rng = makeRng(this.seed ^ 0x5bd1e995);
    const base = { [T_GRASS]: [74, 96, 52], [T_DIRT]: [110, 92, 62], [T_SAND]: [168, 150, 104], [T_WATER]: [34, 74, 104], [T_ROCK]: [92, 88, 82] };
    const img = ctx.createImageData(cv.width, cv.height);
    const d = img.data;
    const nz = makeNoise(rng, 64);
    for (let py = 0; py < cv.height; py++) {
      for (let px = 0; px < cv.width; px++) {
        const tx = (px / TILE) | 0, ty = (py / TILE) | 0;
        const t = this.terrain[this.idx(tx, ty)];
        const c = base[t];
        const large = nz(px / cv.width * 50, py / cv.height * 50);
        let v = (large - 0.5) * 22 + (rng() - 0.5) * 14;
        if (t === T_WATER) v = (large - 0.5) * 18 + Math.sin(px * 0.15 + py * 0.05 + large * 6) * 4;
        const k = (py * cv.width + px) * 4;
        d[k] = c[0] + v; d[k + 1] = c[1] + v; d[k + 2] = c[2] + v * (t === T_WATER ? 1.4 : 1); d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // rocks: chunky boulders with shading
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = this.terrain[this.idx(x, y)];
      if (t === T_ROCK) {
        for (let k = 0; k < 3; k++) {
          const bx = x * TILE + 6 + rng() * 20, by = y * TILE + 6 + rng() * 20, r = 6 + rng() * 8;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(bx + 3, by + 4, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
          const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.4, 1, bx, by, r);
          g.addColorStop(0, '#9b958c'); g.addColorStop(1, '#4f4a44');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(bx, by, r, r * 0.8, rng(), 0, Math.PI * 2); ctx.fill();
        }
      } else if (t === T_WATER) {
        // shore foam
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!this.inside(nx, ny) || this.terrain[this.idx(nx, ny)] === T_WATER) continue;
          ctx.fillStyle = 'rgba(200,230,240,0.25)';
          const X = x * TILE, Y = y * TILE;
          if (dx === 1) ctx.fillRect(X + TILE - 4, Y, 4, TILE);
          if (dx === -1) ctx.fillRect(X, Y, 4, TILE);
          if (dy === 1) ctx.fillRect(X, Y + TILE - 4, TILE, 4);
          if (dy === -1) ctx.fillRect(X, Y, TILE, 4);
        }
      }
    }
    for (const dc of this.decor) {
      const X = dc.x * TILE, Y = dc.y * TILE;
      if (dc.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(X + 5, Y + 6, 9 * dc.s, 6 * dc.s, 0, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(X - 3, Y - 3, 1, X, Y, 10 * dc.s);
        g.addColorStop(0, '#5f8a3a'); g.addColorStop(1, '#2a4a1c');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(X, Y, 9 * dc.s, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(40,70,30,0.6)';
        ctx.beginPath(); ctx.arc(X, Y, 3 * dc.s, 0, Math.PI * 2); ctx.arc(X + 3, Y + 1, 2.5 * dc.s, 0, Math.PI * 2); ctx.fill();
      }
    }
    this.terrainCanvas = cv;

    // tiny minimap terrain image
    const mm = document.createElement('canvas');
    mm.width = this.w; mm.height = this.h;
    const mctx = mm.getContext('2d');
    const mi = mctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) {
      const c = base[this.terrain[i]];
      mi.data[i * 4] = c[0]; mi.data[i * 4 + 1] = c[1]; mi.data[i * 4 + 2] = c[2]; mi.data[i * 4 + 3] = 255;
    }
    mctx.putImageData(mi, 0, 0);
    this.miniCanvas = mm;
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
