// Cold War 2: 2030 — visual polish layered over the battlefield: sun shadows for structures and
// rocks, drifting cloud shadows, the earth edge under the map, soft smoke and fire puffs,
// layered explosions with shockwaves and embers, directional muzzle flashes, and charred wrecks.
// Everything here is cosmetic: nothing in it changes how a match plays.
'use strict';

// sunlight comes from the upper left; shadows fall along this world direction per unit of height
const SUN = { x: 0.9, y: -0.3, alpha: 0.4 };
// a light breeze that carries smoke (world px per second)
const WIND = { x: 7, y: -4 };

const FX = {
  puffs: null, shadows: new Map(), wrecks: new Map(), clouds: null, rockShadow: null,

  // ---------- soft particle sprites ----------
  // pre-rendered radial puffs, scaled and faded per particle (much cheaper than a gradient each)
  puff(kind) {
    if (!this.puffs) {
      const make = stops => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        for (const [o, col] of stops) g.addColorStop(o, col);
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        return c;
      };
      this.puffs = {
        smoke: make([[0, 'rgba(150,148,142,0.9)'], [0.45, 'rgba(120,118,112,0.55)'], [1, 'rgba(100,98,92,0)']]),
        dark: make([[0, 'rgba(48,44,40,0.95)'], [0.45, 'rgba(40,36,32,0.6)'], [1, 'rgba(30,28,26,0)']]),
        fire: make([[0, 'rgba(255,226,150,1)'], [0.3, 'rgba(255,160,60,0.9)'], [0.65, 'rgba(220,80,15,0.5)'], [1, 'rgba(140,25,0,0)']]),
        glow: make([[0, 'rgba(255,210,140,0.9)'], [0.4, 'rgba(255,140,50,0.35)'], [1, 'rgba(255,90,20,0)']]),
        dust: make([[0, 'rgba(150,134,108,0.85)'], [0.5, 'rgba(132,118,96,0.5)'], [1, 'rgba(120,108,90,0)']]),
        white: make([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,245,215,0.7)'], [1, 'rgba(255,220,160,0)']]),
      };
    }
    return this.puffs[kind];
  },
  dab(ctx, kind, x, y, r, a) {
    if (a <= 0.004 || r <= 0.2) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(this.puff(kind), x - r, y - r, r * 2, r * 2);
  },

  // stable pseudo-random numbers per effect so a fireball keeps its shape while it grows
  hash(f, i) {
    const s = Math.sin((f.x * 12.9898 + f.y * 78.233 + i * 37.719) % 1000) * 43758.5453;
    return s - Math.floor(s);
  },

  // ---------- shadows ----------
  // a structure's shadow: its footprint swept along the sun direction by its height, blurred,
  // in screen space relative to the footprint's north corner. Cached per footprint and height.
  buildingShadow(w, h, height) {
    const len = Math.round(height * 0.85 / 4) * 4;
    const key = w + ',' + h + ',' + len;
    let s = this.shadows.get(key);
    if (s) return s;
    const W = w * TILE, H = h * TILE, dx = SUN.x * len, dy = SUN.y * len;
    const pts = [[0, H], [0, 0], [dx, dy], [W + dx, dy], [W + dx, H + dy], [W, H]].map(([x, y]) => [x - y, (x + y) / 2]);
    const pad = 10;
    const x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad;
    const y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
    const c = document.createElement('canvas');
    c.width = Math.ceil(x1 - x0); c.height = Math.ceil(y1 - y0);
    const x = c.getContext('2d');
    x.filter = 'blur(3px)';
    x.fillStyle = `rgba(8,12,20,${SUN.alpha})`;
    x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px - x0, py - y0) : x.moveTo(px - x0, py - y0)); x.closePath(); x.fill();
    s = { c, ox: -x0, oy: -y0 };
    this.shadows.set(key, s);
    return s;
  },

  drawBuildingShadows(ctx, R) {
    const pid = G.player, vw = ctx.canvas.width, vh = ctx.canvas.height;
    for (const b of G.entities) {
      if (b.kind !== 'building' || b.dead || b.def.bridge || b.def.noShadow) continue;
      if (b.team !== pid && !G.isVisibleBld(b)) continue;
      const k = b.built !== undefined ? b.built : 1;
      const ht = (b.def.height || 20) * Math.max(0.15, k);
      const s = this.buildingShadow(b.w, b.h, ht);
      const [sx, sy] = R.P(b.tx * TILE, b.ty * TILE);
      if (sx - s.ox > vw || sx + s.c.width < -s.ox || sy - s.oy > vh || sy + s.c.height - s.oy < 0) continue;
      ctx.drawImage(s.c, sx - s.ox, sy - s.oy);
    }
  },

  // ---------- grounding ----------
  // Under every structure (ground pass, world coordinates): soil worn bare around it, a dark
  // contact band where its slab meets the ground, and tracks or a footpath out of its exit for
  // the producers. Cached per footprint, map and variant; drawn before the sun shadows.
  aprons: new Map(),
  APRON: 30,
  apron(b, th, theater) {
    const v = ((b.tx * 7 + b.ty * 13) % 3 + 3) % 3, exit = b.def.produces === 'vehicle' || b.key === 'refinery' ? 'track' : b.def.produces === 'infantry' ? 'path' : '';
    const small = b.def.wall || (b.w === 1 && b.h === 1);
    const key = `${b.w},${b.h},${theater},${v},${exit},${small ? 1 : 0}`;
    let a = this.aprons.get(key);
    if (a) return a;
    const P = this.APRON, W = b.w * TILE, H = b.h * TILE;
    const c = document.createElement('canvas'); c.width = W + 2 * P; c.height = H + 2 * P;
    const x = c.getContext('2d');
    let seed = 4111 + v * 977 + b.w * 31 + b.h * 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const soil = th.dirt.map((n, i) => Math.round(n * 0.7 + th.dry[i] * 0.3)), dark = th.dirt.map(n => Math.round(n * 0.55));
    const blob = (px, py, r, col, a) => {
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    };
    // worn ground: soft soil blotches around the rim, thinning out with distance
    const reach = small ? 9 : 22, n = Math.round((W + H) / (small ? 4 : 2.5));
    for (let i = 0; i < n; i++) {
      const t = rnd() * 2 * (W + H);
      let ex, ey;
      if (t < W) { ex = t; ey = 0; } else if (t < W + H) { ex = W; ey = t - W; } else if (t < 2 * W + H) { ex = t - W - H; ey = H; } else { ex = 0; ey = t - 2 * W - H; }
      const out = Math.pow(rnd(), 1.6) * reach, ang = rnd() * Math.PI * 2;
      const px = P + ex + (ex === 0 ? -out : ex === W ? out : 0) + Math.cos(ang) * 3, py = P + ey + (ey === 0 ? -out : ey === H ? out : 0) + Math.sin(ang) * 3;
      blob(px, py, (small ? 4 : 6) + rnd() * (small ? 5 : 11), soil, (0.3 + rnd() * 0.3) * (1 - out / (reach + 4)));
    }
    if (!small) for (let i = 0; i < 18; i++) blob(P + rnd() * W, P + rnd() * H, 8 + rnd() * 14, soil, 0.35);   // under the slab (shows at its edge)
    // tyre tracks or a footpath from the exit in the middle of the +y side
    if (exit) {
      const ex = P + W / 2, wob = (rnd() - 0.5) * 16, len = P + 10;
      const lane = (off, w, col, a) => {
        x.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`; x.lineWidth = w; x.lineCap = 'round';
        x.beginPath(); x.moveTo(ex + off, P + H - 4); x.quadraticCurveTo(ex + off, P + H + len * 0.5, ex + off + wob, P + H + len); x.stroke();
      };
      // fade the ends out with a gradient mask afterwards
      x.save();
      if (exit === 'track') { lane(0, 14, soil, 0.35); for (const o of [-5, 5]) lane(o, 2.2, dark, 0.32); }
      else { lane(0, 7, soil, 0.4); lane(0, 3, dark, 0.15); }
      x.restore();
      x.save();
      x.globalCompositeOperation = 'destination-out';
      const g = x.createLinearGradient(0, P + H + 4, 0, P + H + len + 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = g; x.fillRect(ex - 30, P + H + 4, 60, len + 6);
      x.restore();
    }
    // contact shadow: a dark band hugging the slab, fading outwards (ambient occlusion)
    for (let i = 0; i < 6; i++) {
      x.strokeStyle = `rgba(14,12,10,${0.2 * (1 - i / 6)})`; x.lineWidth = 1.5;
      x.strokeRect(P - 0.5 - i * 1.4, P - 0.5 - i * 1.4, W + 1 + i * 2.8, H + 1 + i * 2.8);
    }
    // project it onto the iso ground once, so each frame is a plain blit
    const Wp = c.width, Hp = c.height, iso = document.createElement('canvas');
    iso.width = Wp + Hp; iso.height = Math.ceil((Wp + Hp) / 2);
    const ix = iso.getContext('2d');
    ix.setTransform(1, 0.5, -1, 0.5, Hp, 0); ix.drawImage(c, 0, 0);
    a = { c: iso, P, ox: Hp };
    this.aprons.set(key, a);
    return a;
  },
  // drawn in screen space (call it with the ground transform set: it is put back afterwards)
  drawBuildingGround(ctx, R, tx0, ty0, tx1, ty1) {
    const m = G.map, pid = G.player;
    if (!m.theme) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of G.entities) {
      if (b.kind !== 'building' || b.dead || b.def.bridge || b.def.water || b.def.noShadow) continue;
      if (b.tx + b.w < tx0 - 1 || b.ty + b.h < ty0 - 1 || b.tx > tx1 + 1 || b.ty > ty1 + 1) continue;
      if (b.team !== pid && !G.isVisibleBld(b)) continue;
      const a = this.apron(b, m.theme, m.theater);
      const k = b.built !== undefined ? b.built : 1;
      ctx.globalAlpha = Math.min(1, 0.35 + k);
      const [sx, sy] = R.P(b.tx * TILE - a.P, b.ty * TILE - a.P);
      ctx.drawImage(a.c, sx - a.ox, sy);
    }
    ctx.restore();
  },

  // rocks get a small soft shadow to the lower right, like the trees already have
  drawRockShadow(ctx, sx, sy) {
    if (!this.rockShadow) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const x = c.getContext('2d'); x.filter = 'blur(2px)';
      x.fillStyle = `rgba(8,12,20,${SUN.alpha})`;
      x.beginPath(); x.ellipse(32, 16, 22, 9, 0, 0, Math.PI * 2); x.fill();
      this.rockShadow = c;
    }
    ctx.drawImage(this.rockShadow, sx - 24, sy - 13);
  },

  // ---------- cloud shadows ----------
  // a tileable sheet of soft blotches, squashed 2:1 to lie on the iso ground, drifting with the wind
  cloudSheet() {
    if (this.clouds) return this.clouds;
    const W = 1024, H = 512, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    x.filter = 'blur(28px)';
    for (let i = 0; i < 9; i++) {
      const cx = r() * W, cy = r() * H, n = 4 + (r() * 5 | 0);
      for (let k = 0; k < n; k++) {
        const px = cx + (r() - 0.5) * 220, py = cy + (r() - 0.5) * 80, rx = 50 + r() * 90;
        x.fillStyle = `rgba(10,18,30,${0.05 + r() * 0.045})`;
        // draw wrapped so the sheet tiles seamlessly
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
          x.beginPath(); x.ellipse(px + ox, py + oy, rx, rx * 0.5, 0, 0, Math.PI * 2); x.fill();
        }
      }
    }
    this.clouds = { c };
    return this.clouds;
  },

  // Cloud shadows and the cinematic vignette share one overlay, painted at quarter resolution
  // (both are soft, so nothing is lost) and stretched over the view in a single blit.
  drawAtmosphere(ctx, R) {
    const vw = ctx.canvas.width, vh = ctx.canvas.height, Q = 4;
    const w = Math.ceil(vw / Q), h = Math.ceil(vh / Q);
    let a = this.atmo;
    if (!a || a.vw !== vw || a.vh !== vh) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      // the vignette: a cool, slightly dark rim, matching the moody look of the style guide
      const v = document.createElement('canvas'); v.width = w; v.height = h;
      const g = v.getContext('2d'), r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      r.addColorStop(0, 'rgba(10,25,45,0)'); r.addColorStop(1, 'rgba(4,10,20,0.22)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      a = this.atmo = { vw, vh, c, x: c.getContext('2d'), v, pat: null };
    }
    ctx.imageSmoothingEnabled = true;
    if (G.daytime !== 'night') {   // no cloud shadows without the sun
      // world-anchored: offset by the camera, then drift slowly to the lower right. The sheet is
      // laid as a few plain tiles (a transformed repeating pattern costs many times more to fill)
      const cl = this.cloudSheet(), CW = cl.c.width, CH = cl.c.height, t = G.time;
      const ox = (((-R.cx + t * 9) % CW) + CW) % CW - CW, oy = (((-R.cy + t * 3) % CH) + CH) % CH - CH;
      for (let y = oy; y < vh; y += CH) for (let x = ox; x < vw; x += CW) ctx.drawImage(cl.c, Math.round(x), Math.round(y));
    }
    ctx.drawImage(a.v, 0, 0, w, h, 0, 0, w * Q, h * Q);
  },

  // ---------- the earth under the map ----------
  // the battlefield sits on a slab: the two near edges get a cut face of soil and rock
  drawBackdrop(ctx, vw, vh) {
    ctx.fillStyle = '#0b1119'; ctx.fillRect(0, 0, vw, vh);
  },

  drawSlab(ctx, R) {
    const m = G.map, N = m.w * TILE, D = 54, th = m.theme;
    const [ax, ay] = R.P(0, N), [bx, by] = R.P(N, N), [cx, cy] = R.P(N, 0);
    const col = (rgb, k) => `rgb(${rgb.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`;
    const soil = th.dirt, rock = th.rock;
    // each face is painted in thin bands that follow the edge: topsoil, then rock darkening with depth
    const mid = soil.map((v, i) => (v + rock[i]) / 2);
    const bands = [[0, soil, 1.15], [0.1, soil, 1.0], [0.24, mid, 1.0], [0.46, mid, 0.85], [0.68, rock, 0.7], [0.86, rock, 0.55]];
    const face = (x0, y0, x1, y1, lit) => {
      const shade = lit ? 1 : 0.7;
      for (let i = 0; i < bands.length; i++) {
        const k0 = bands[i][0], k1 = i + 1 < bands.length ? bands[i + 1][0] : 1;
        ctx.fillStyle = col(bands[i][1], bands[i][2] * shade);
        ctx.beginPath();
        ctx.moveTo(x0, y0 + D * k0); ctx.lineTo(x1, y1 + D * k0);
        ctx.lineTo(x1, y1 + D * k1 + 0.5); ctx.lineTo(x0, y0 + D * k1 + 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
      for (const k of [0.22, 0.45, 0.7]) {
        ctx.beginPath(); ctx.moveTo(x0, y0 + D * k); ctx.lineTo(x1, y1 + D * k); ctx.stroke();
      }
    };
    face(ax, ay, bx, by, true);
    face(bx, by, cx, cy, false);
    // a thin rim of light along the top edge, and a soft drop shadow under the slab
    ctx.strokeStyle = 'rgba(255,240,210,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    const sg = ctx.createLinearGradient(0, by + D, 0, by + D + 40);
    sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(ax, ay + D); ctx.lineTo(bx, by + D); ctx.lineTo(cx, cy + D);
    ctx.lineTo(cx + 20, cy + D + 30); ctx.lineTo(bx, by + D + 40); ctx.lineTo(ax - 20, ay + D + 30); ctx.closePath(); ctx.fill();
  },

  // ---------- water ----------
  // sunlight glinting on open water: short bright dashes that twinkle in and out
  // (drawn in the ground transform, world coordinates)
  drawWater(ctx, tx0, ty0, tx1, ty1) {
    const m = G.map, t = G.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgb(200,230,240)';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!m.isWater(tx, ty) || !G.explored[m.idx(tx, ty)]) continue;
      const h = Math.sin(tx * 127.1 + ty * 311.7) * 43758.5453, r = h - Math.floor(h);
      const k = Math.sin(t * (0.9 + r) + r * 40);
      if (k < 0.75) continue;
      const a = (k - 0.75) * 2.4;
      const x = tx * TILE + r * TILE, y = ty * TILE + ((r * 7) % 1) * TILE;
      ctx.globalAlpha = a * 0.55;
      // a dash running along the screen horizontal: world direction (1,-1)
      ctx.beginPath(); ctx.ellipse(x, y, 4 + r * 4, 0.8, -Math.PI / 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  // ---------- scorch marks ----------
  // a scorch mark; crater = an aged one, baked into the ground: soil thrown up in a pale rim
  // round a darker, sunken centre
  drawDecal(ctx, d, crater) {
    if (crater && d.r > 6) {
      const th = G.map.theme, s = th.snow ? [190, 198, 206] : th.dirt;
      const rim = ctx.createRadialGradient(d.x, d.y, d.r * 0.45, d.x, d.y, d.r * 1.35);
      rim.addColorStop(0, `rgba(${s[0]},${s[1]},${s[2]},0)`); rim.addColorStop(0.45, `rgba(${s[0] * 1.1 | 0},${s[1] * 1.1 | 0},${s[2] * 1.1 | 0},0.45)`); rim.addColorStop(1, `rgba(${s[0]},${s[1]},${s[2]},0)`);
      ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.35, d.r * 1.1, d.a, 0, Math.PI * 2); ctx.fill();
      // the lit far lip and the shaded near bowl (light from the upper left)
      ctx.strokeStyle = 'rgba(255,245,225,0.16)'; ctx.lineWidth = Math.max(1, d.r * 0.1);
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.6, Math.PI * 0.75, Math.PI * 1.75); ctx.stroke();
    }
    if (crater) {
      // the scorch has weathered: a soft, faint bowl (so heavy shelling turns the ground over
      // rather than painting it black)
      const b = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 0.75);
      b.addColorStop(0, 'rgba(22,16,10,0.34)'); b.addColorStop(1, 'rgba(30,22,14,0)');
      ctx.fillStyle = b; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.75, d.r * 0.6, d.a, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    g.addColorStop(0, 'rgba(12,8,4,0.62)'); g.addColorStop(0.45, 'rgba(22,16,10,0.42)'); g.addColorStop(1, 'rgba(30,22,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, d.a, 0, Math.PI * 2); ctx.fill();
    // a few dark streaks thrown out from the blast
    if (d.r > 8) {
      ctx.strokeStyle = 'rgba(14,10,6,0.28)'; ctx.lineWidth = Math.max(1, d.r * 0.08); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = d.a + i * 1.05 + Math.sin(d.a * 7 + i) * 0.4, r0 = d.r * 0.35, r1 = d.r * (0.8 + 0.3 * Math.sin(d.a * 3 + i * 2));
        ctx.moveTo(d.x + Math.cos(a) * r0, d.y + Math.sin(a) * r0); ctx.lineTo(d.x + Math.cos(a) * r1, d.y + Math.sin(a) * r1);
      }
      ctx.stroke();
    }
  },

  // ---------- effects ----------
  explosion(ctx, R, f, x, y, p) {
    const s = f.size, fade = 1 - p;
    // the blast lights up the ground around it
    const [gx, gy] = R.P(f.x, f.y, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * fade * fade;
    ctx.drawImage(this.puff('glow'), gx - s * 1.8, gy - s * 0.9, s * 3.6, s * 1.8);
    // white-hot flash in the first instant
    if (p < 0.2) this.dab(ctx, 'white', x, y - s * 0.2, s * (0.45 + p * 1.2), 0.8 * (1 - p * 5));
    // the fireball: overlapping puffs that swell, rise and cool
    const n = s > 30 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = this.hash(f, i) * Math.PI * 2, d = s * 0.35 * this.hash(f, i + 9) * (0.5 + p);
      const px = x + Math.cos(a) * d, py = y - s * 0.25 + Math.sin(a) * d * 0.6 - p * s * 0.5 * this.hash(f, i + 3);
      const r = s * (0.3 + 0.55 * Math.min(1, p * 2.2)) * (0.6 + 0.5 * this.hash(f, i + 5));
      this.dab(ctx, 'fire', px, py, r, Math.pow(fade, 1.6) * 0.75);
    }
    ctx.restore();
    // earth thrown up by the blast: a low, spreading skirt of dust and clods flung out on arcs
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const a = this.hash(f, i + 40) * Math.PI * 2, d = s * (0.3 + 0.9 * Math.sqrt(p));
      this.dab(ctx, 'dust', gx + Math.cos(a) * d, gy + Math.sin(a) * d * 0.5 - s * 0.1, s * (0.3 + 0.45 * p), 0.5 * Math.min(1, p * 6) * (1 - p));
    }
    if (s > 10) {
      ctx.globalAlpha = Math.min(1, (1 - p) * 2.5); ctx.fillStyle = '#2a241c';
      for (let i = 0; i < 7; i++) {
        const a = this.hash(f, i + 50) * Math.PI * 2, v = s * (0.7 + 0.8 * this.hash(f, i + 60)), up = s * (1.0 + 1.4 * this.hash(f, i + 70));
        const ex = Math.cos(a) * v * p, ey = Math.sin(a) * v * p * 0.5, ez = up * p * (1 - p) * 4 * 0.5;
        const sz = 0.8 + 1.1 * this.hash(f, i + 80);
        ctx.fillRect(gx + ex - sz / 2, gy + ey - ez - sz / 2, sz, sz);
      }
    }
    ctx.restore();
    // and the smoke it leaves, darkening as the fire dies
    if (p > 0.2) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const k = (p - 0.2) / 0.8, a = this.hash(f, i + 20) * Math.PI * 2;
        const px = x + Math.cos(a) * s * 0.3, py = y - s * 0.4 - k * s * (0.6 + 0.4 * this.hash(f, i + 30));
        this.dab(ctx, 'dark', px, py, s * (0.35 + 0.5 * k), 0.55 * (1 - k) * Math.min(1, k * 4));
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  // a ring of dust racing out across the ground
  shock(ctx, x, y, f, p) {
    const r = f.size * (0.4 + 2.2 * Math.sqrt(p));
    ctx.save();
    ctx.strokeStyle = `rgba(255,236,200,${0.18 * (1 - p)})`; ctx.lineWidth = 2 * (1 - p) + 0.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(150,130,100,${0.3 * (1 - p)})`; ctx.lineWidth = 7 * (1 - p) + 1;
    ctx.beginPath(); ctx.ellipse(x, y + 1, r * 0.92, r * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  },

  ember(ctx, R, f, x, y, p) {
    const [x2, y2] = R.P(f.x - f.vx * 0.03, f.y - f.vy * 0.03, (f.z || 0) - f.vz * 0.03);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,${190 - p * 90 | 0},70,${1 - p})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
  },

  smoke(ctx, f, x, y, p) {
    const r = f.size * (1 + p * 2.2) * 1.5;
    const a = (f.dark ? 0.9 : 0.7) * (1 - p) * Math.min(1, p * 8 + 0.4);
    this.dab(ctx, f.dark ? 'dark' : 'smoke', x, y, r, a);
    ctx.globalAlpha = 1;
  },

  fire(ctx, x, y, p) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 5 * (1 - p) + 2;
    this.dab(ctx, 'fire', x, y - p * 12, r, 0.9 * (1 - p));
    this.dab(ctx, 'glow', x, y - p * 6, r * 2.2, 0.35 * (1 - p));
    ctx.restore();
  },

  // a muzzle flash pointing the way the gun fired: a bright core and a short star-shaped plume
  flash(ctx, f, x, y, p) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const col = f.color || '#ffd890', s = f.size, fade = 1 - p;
    this.dab(ctx, 'glow', x, y, s * 2.6, 0.55 * fade);
    if (f.a !== undefined) {
      const dx = Math.cos(f.a), dy = Math.sin(f.a);
      let ex = dx - dy, ey = (dx + dy) / 2;
      const l = Math.hypot(ex, ey) || 1; ex /= l; ey /= l;
      const L = s * (1.8 + 0.6 * Math.sin(f.x + f.y)), W = s * 0.45;
      ctx.globalAlpha = fade;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - ey * W, y + ex * W);
      ctx.lineTo(x + ex * L, y + ey * L);
      ctx.lineTo(x + ey * W, y - ex * W);
      ctx.closePath(); ctx.fill();
      // side petals
      ctx.globalAlpha = fade * 0.7;
      for (const k of [-1, 1]) {
        const qx = ex * 0.55 + k * -ey * 0.8, qy = ey * 0.55 + k * ex * 0.8;
        ctx.beginPath();
        ctx.moveTo(x - ey * W * 0.4, y + ex * W * 0.4);
        ctx.lineTo(x + qx * s * 1.1, y + qy * s * 1.1);
        ctx.lineTo(x + ey * W * 0.4, y - ex * W * 0.4);
        ctx.closePath(); ctx.fill();
      }
    }
    this.dab(ctx, 'white', x, y, s * 0.9, fade);
    ctx.restore();
  },

  tracer(ctx, f, x, y, x2, y2, p) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const c = f.hot ? '150,255,110' : '255,214,120';
    ctx.strokeStyle = `rgba(${c},${0.28 * (1 - p)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    // the bright slug itself: the last stretch of the line, racing to the target
    const k = Math.min(1, p * 1.6 + 0.35), k0 = Math.max(0, k - 0.45);
    ctx.strokeStyle = f.hot ? `rgba(200,255,170,${1 - p * 0.5})` : `rgba(255,246,200,${1 - p * 0.5})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + (x2 - x) * k0, y + (y2 - y) * k0); ctx.lineTo(x + (x2 - x) * k, y + (y2 - y) * k); ctx.stroke();
    ctx.restore();
  },

  // ---------- wrecks ----------
  // a destroyed vehicle leaves its burnt-out hull behind for a while
  wreckSprite(f) {
    const def = UNITS[f.key];
    const fi = facingIndex(f.facing);
    const key = f.key + '|' + fi + '|' + Art.version;
    let s = this.wrecks.get(key);
    if (s) return s;
    const S = Math.max(96, Math.ceil(def.radius * 9)), ax = S / 2, ay = S * 0.68;
    const raw = document.createElement('canvas'); raw.width = raw.height = S;
    const team = G.teamOf(f.team);
    const a = fi / FACINGS * Math.PI * 2;
    drawUnitArt(raw.getContext('2d'), { key: f.key, def, facing: a, turret: a + (f.twist || 0), anim: 0, alt: 0, cargo: 0, team: f.team }, team, ax, ay);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    x.filter = 'brightness(0.5) saturate(0.2) sepia(0.35) contrast(1.1)';
    x.drawImage(raw, 0, 0);
    s = { c, ax, ay };
    this.wrecks.set(key, s);
    if (this.wrecks.size > 120) this.wrecks.delete(this.wrecks.keys().next().value);
    return s;
  },

  wreck(ctx, f, x, y) {
    if (f.t < 0) return;
    const p = f.t / f.life, s = this.wreckSprite(f);
    // scorched ground and the hull, fading out at the very end
    ctx.globalAlpha = Math.min(1, (1 - p) * 6);
    ctx.drawImage(s.c, x - s.ax, y - s.ay);
    ctx.globalAlpha = 1;
    // still burning for the first stretch, then just smouldering
    const r = UNITS[f.key].radius;
    if (f.t < f.life * 0.45 && Math.random() < 0.25) {
      G.effects.push({ type: 'fire', x: f.x + (Math.random() - 0.5) * r, y: f.y + (Math.random() - 0.5) * r, z: 5, t: 0, life: 0.6 });
    }
    if (p < 0.8 && Math.random() < 0.12) {
      G.effects.push({ type: 'smoke', dark: true, x: f.x + (Math.random() - 0.5) * r, y: f.y + (Math.random() - 0.5) * r, z: 8, t: 0, life: 2.4, size: 3 + r * 0.2 });
    }
  },

  // a damaged vehicle trails smoke, and burns when it is nearly gone
  damageSmoke(u) {
    if (u.def.cat === 'infantry' || u.hp >= u.maxHp * 0.5) return;
    const bad = u.hp < u.maxHp * 0.25;
    if (Math.random() < (bad ? 0.22 : 0.08)) {
      G.effects.push({ type: 'smoke', dark: bad, x: u.x + (Math.random() - 0.5) * 4, y: u.y + (Math.random() - 0.5) * 4, z: (u.alt || 0) + 8, t: 0, life: 1.5, size: 2.2 + u.def.radius * 0.12 });
    }
    if (bad && Math.random() < 0.1) G.effects.push({ type: 'fire', x: u.x, y: u.y, z: (u.alt || 0) + 6, t: 0, life: 0.4 });
  },
};
