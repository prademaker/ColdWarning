// Cold War 2: 2030 — light. Explosions, muzzle flashes, fires, burning wrecks and weapon beams
// throw light on the ground and everything near them. At dusk and at night the whole scene is
// darkened to the sky's colour and lit by those, plus the windows of the bases and villages and
// the headlights of vehicles. Cosmetic only: nothing here changes how a match plays.
'use strict';

const DAYTIME = {
  day: { label: 'Day' },
  // ambient: the colour the scene is multiplied by; glow: how strongly lights cut through it;
  // base: how bright windows and headlights are
  dusk: { label: 'Dusk', ambient: [226, 170, 142], glow: 1.1, base: 0.45 },
  night: { label: 'Night', ambient: [52, 64, 104], glow: 1.45, base: 1 },
};

const Light = {
  pools: new Map(), lm: null, list: [],

  // a soft round pool of light in one colour (pre-rendered, scaled per light)
  pool(rgb) {
    const key = rgb.join(',');
    let c = this.pools.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${key},1)`); g.addColorStop(0.35, `rgba(${key},0.55)`);
    g.addColorStop(0.7, `rgba(${key},0.16)`); g.addColorStop(1, `rgba(${key},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this.pools.set(key, c);
    return c;
  },

  // every light this frame: screen position on the ground, radius (world px), colour, strength,
  // and whether it is a hot source that also blooms
  gather(R, mode) {
    const L = this.list; L.length = 0;
    const vw = R.vw, vh = R.vh, pid = G.player;
    const add = (wx, wy, r, rgb, a, hot) => {
      if (a <= 0.02) return;
      const [sx, sy] = R.P(wx, wy);
      if (sx < -r * 1.5 || sy < -r || sx > vw + r * 1.5 || sy > vh + r) return;
      L.push({ sx, sy, r, rgb, a: Math.min(1.2, a), hot });
    };
    const flick = (f, k) => 0.85 + 0.15 * Math.sin(G.time * 23 + f.x * 0.37 + f.y * 0.11 + k);
    const visible = (x, y) => { const ti = G.map.idx(Math.floor(x / TILE), Math.floor(y / TILE)); return G.visible[ti]; };
    for (const f of G.effects) {
      if (f.t < 0) continue;
      const p = f.t / f.life;
      if (p >= 1) continue;
      switch (f.type) {
        case 'explosion': add(f.x, f.y, 34 + f.size * 2.4, [255, 168, 88], Math.pow(1 - p, 1.4) * (0.7 + Math.min(0.5, f.size / 80)), true); break;
        case 'flash': add(f.x, f.y, (f.size || 6) * 5, f.color ? hexRgb(f.color) : [255, 206, 140], (1 - p) * 0.9, true); break;
        case 'fire': add(f.x, f.y, 30, [255, 140, 60], (1 - p) * 0.45 * flick(f, 0), true); break;
        case 'wreck': if (f.t < 7 && visible(f.x, f.y)) add(f.x, f.y, 40, [255, 130, 50], (1 - f.t / 7) * 0.6 * flick(f, 1), true); break;
        case 'beam': case 'laser': case 'rail': {
          const rgb = f.color ? f.color.split(',').map(Number) : f.type === 'laser' ? [255, 110, 100] : [150, 210, 255];
          add(f.x2, f.y2, 44, rgb, (1 - p) * 0.8, true);
          add(f.x, f.y, 26, rgb, (1 - p) * 0.5, true);
          break;
        }
      }
    }
    for (const p of G.projectiles) {
      if (p.type === 'rocket' || p.type === 'flame' || p.type === 'sortie') add(p.x, p.y, 22, [255, 170, 90], 0.4, false);
      else if (p.type === 'laser' || p.type === 'emp') add(p.x, p.y, 22, [150, 200, 255], 0.4, false);
    }
    for (const s of G.pendingStrikes) {
      const k = s.done ? 1 - (s.t - s.delay) / 1.5 : Math.max(0, 1 - (s.delay - s.t) / 1.2) * 0.6;
      if (k > 0) add(s.x, s.y, 220, s.sw.kind === 'lance' ? [150, 210, 255] : [255, 190, 120], k, true);
    }
    if (!mode.base) return;
    // after dark: lit windows and floodlights of the bases and villages, headlights of vehicles
    for (const e of G.entities) {
      if (e.dead) continue;
      if (e.kind === 'building') {
        if (e.def.bridge || e.def.wall || (e.built !== undefined && e.built < 1)) continue;
        if (e.team !== pid && !G.isVisibleBld(e)) continue;
        const team = G.teamOf(e.team), dim = team && team.lowPower ? 0.35 : 1;
        const big = (e.w + e.h) * TILE;
        add(e.x, e.y, big * 0.6, [255, 190, 120], 0.34 * mode.base * dim, false);
        // a floodlight over the front corner
        add((e.tx + e.w) * TILE + 6, (e.ty + e.h) * TILE + 6, 34 + big * 0.15, [255, 236, 200], 0.5 * mode.base * dim, false);
      } else if (!e.air && !e.def.naval && e.def.cat !== 'infantry' && (e.team === pid || G.isVisibleTo(e, pid))) {
        add(e.x + Math.cos(e.facing) * 26, e.y + Math.sin(e.facing) * 26, 26, [255, 240, 214], 0.55 * mode.base, false);
      } else if (e.def.naval && (e.team === pid || G.isVisibleTo(e, pid))) {
        add(e.x, e.y, 40, [255, 220, 170], 0.35 * mode.base, false);
      }
    }
  },

  // drawn after everything on the battlefield and before the fog of war
  draw(ctx, R) {
    const mode = DAYTIME[G.daytime] || DAYTIME.day;
    const vw = ctx.canvas.width, vh = ctx.canvas.height;
    R.vw = vw; R.vh = vh;
    this.gather(R, mode);
    const L = this.list;
    if (!mode.ambient) {
      // daylight: lights only add a warm wash over what they touch
      if (!L.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of L) { ctx.globalAlpha = Math.min(1, l.a * 0.42); ctx.drawImage(this.pool(l.rgb), l.sx - l.r * 1.4, l.sy - l.r * 0.7, l.r * 2.8, l.r * 1.4); }
      ctx.restore();
      return;
    }
    // dusk and night: a quarter-resolution light map, the sky's colour plus every light,
    // multiplied over the scene; hot sources then bloom on top
    const Q = 4, w = Math.ceil(vw / Q), h = Math.ceil(vh / Q);
    let m = this.lm;
    if (!m || m.w !== w || m.h !== h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      m = this.lm = { c, x: c.getContext('2d'), w, h };
    }
    const x = m.x, amb = mode.ambient;
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter';
    for (const l of L) {
      x.globalAlpha = Math.min(1, l.a * mode.glow);
      const r = l.r * 1.4 / Q;
      x.drawImage(this.pool(l.rgb), l.sx / Q - r, l.sy / Q - r / 2, r * 2, r);
      // a second, wider and fainter pass so pools fall off softly into the dark
      x.globalAlpha = Math.min(1, l.a * mode.glow * 0.35);
      x.drawImage(this.pool(l.rgb), l.sx / Q - r * 1.8, l.sy / Q - r * 0.9, r * 3.6, r * 1.8);
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(m.c, 0, 0, w, h, 0, 0, w * Q, h * Q);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of L) {
      if (!l.hot) continue;
      ctx.globalAlpha = Math.min(1, l.a * 0.3 * mode.glow);
      ctx.drawImage(this.pool(l.rgb), l.sx - l.r * 0.8, l.sy - l.r * 0.5, l.r * 1.6, l.r);
    }
    ctx.restore();
  },
};
