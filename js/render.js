// Cold War 2: 2030 — isometric rendering of the battlefield (artwork lives in art.js).
// The ground (terrain, ore, decals, fog) is drawn through an affine iso transform; everything
// upright (structures, units, trees, rocks) is drawn as pre-rendered sprites sorted by depth.
'use strict';

const CHUNK = 512;

const Render = {
  fogCanvas: null, fogVersion: -1, cx: 0, cy: 0,

  init() {
    const N = G.map.w;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = N; this.fogCanvas.height = N;
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.fogImg = this.fogCtx.createImageData(N, N);
    this.fogVersion = -1;
    // blurred, upsampled copy so the fog edge is soft instead of tile-stepped
    this.fogHi = document.createElement('canvas');
    this.fogHi.width = N * 4; this.fogHi.height = N * 4;
    this.fogHiCtx = this.fogHi.getContext('2d');
    // fog re-projected into iso space at quarter resolution whenever it changes
    const W = N * TILE;
    this.fogIso = document.createElement('canvas');
    this.fogIso.width = W / 2; this.fogIso.height = W / 4;
    this.fogIsoCtx = this.fogIso.getContext('2d');
    // terrain pre-projected into iso chunks on demand (cheap blits instead of a transformed draw)
    this.chunks = new Map();
  },

  terrainChunk(i, j) {
    const key = i + ',' + j;
    let c = this.chunks.get(key);
    if (c) { this.chunks.delete(key); this.chunks.set(key, c); return c; } // keep LRU order
    c = document.createElement('canvas');
    c.width = c.height = CHUNK;
    const x = c.getContext('2d');
    x.setTransform(1, 0.5, -1, 0.5, -i * CHUNK, -j * CHUNK);
    x.imageSmoothingEnabled = true;
    x.drawImage(G.map.terrainCanvas, 0, 0);
    this.chunks.set(key, c);
    if (this.chunks.size > 48) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  },

  updateFogCanvas() {
    if (this.fogVersion === G.fogVersion) return;
    this.fogVersion = G.fogVersion;
    const d = this.fogImg.data, vis = G.visible, exp = G.explored;
    for (let i = 0; i < vis.length; i++) d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 110 : 255;
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    const h = this.fogHiCtx, S = this.fogHi.width;
    h.clearRect(0, 0, S, S);
    h.filter = 'blur(3px)';
    h.imageSmoothingEnabled = true;
    h.drawImage(this.fogCanvas, 0, 0, S, S);
    h.filter = 'none';
    const f = this.fogIsoCtx, W = G.map.w * TILE;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, this.fogIso.width, this.fogIso.height);
    f.setTransform(0.25, 0.125, -0.25, 0.125, W / 4, 0);
    f.imageSmoothingEnabled = true;
    f.drawImage(this.fogHi, 0, 0, W, W);
  },

  // world -> screen
  P(x, y, z = 0) { return [x - y - this.cx, (x + y) / 2 - z - this.cy]; },
  ground(ctx) { ctx.setTransform(1, 0.5, -1, 0.5, -this.cx, -this.cy); },

  draw(ctx, cam, ui) {
    const vw = ctx.canvas.width, vh = ctx.canvas.height;
    let cx = Math.round(cam.x), cy = Math.round(cam.y);
    if (G.shake > 0) { cx += Math.round((Math.random() - 0.5) * G.shake); cy += Math.round((Math.random() - 0.5) * G.shake); }
    this.cx = cx; this.cy = cy;
    const m = G.map, pid = G.player, t = G.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // visible tile range: inverse-project the screen corners
    let wx0 = 1e9, wy0 = 1e9, wx1 = -1e9, wy1 = -1e9;
    for (const [sx, sy] of [[0, 0], [vw, 0], [0, vh], [vw, vh]]) {
      const X = sx + cx, Y = sy + cy, wx = Y + X / 2, wy = Y - X / 2;
      wx0 = Math.min(wx0, wx); wx1 = Math.max(wx1, wx); wy0 = Math.min(wy0, wy); wy1 = Math.max(wy1, wy);
    }
    const tx0 = Math.max(0, Math.floor(wx0 / TILE) - 2), tx1 = Math.min(m.w - 1, Math.ceil(wx1 / TILE) + 2);
    const ty0 = Math.max(0, Math.floor(wy0 / TILE) - 2), ty1 = Math.min(m.h - 1, Math.ceil((wy1 + 200) / TILE) + 2);
    const onScreen = (sx, sy, pad = 120) => sx > -pad && sx < vw + pad && sy > -pad && sy < vh + pad * 1.6;

    // ---- ground pass ----
    for (let j = Math.floor(cy / CHUNK); j * CHUNK < cy + vh; j++) {
      for (let i = Math.floor(cx / CHUNK); i * CHUNK < cx + vw; i++) {
        if (j < 0 || j * CHUNK > m.w * TILE || (i + 1) * CHUNK < -m.w * TILE || i * CHUNK > m.w * TILE) continue;
        ctx.drawImage(this.terrainChunk(i, j), i * CHUNK - cx, j * CHUNK - cy);
      }
    }
    ctx.save();
    this.ground(ctx);
    this.drawOre(ctx, tx0, ty0, tx1, ty1);
    for (const d of G.decals) {
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      g.addColorStop(0, 'rgba(15,10,5,0.55)'); g.addColorStop(1, 'rgba(15,10,5,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, d.a, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of G.effects) if (f.type === 'corpse') this.drawCorpse(ctx, f);
    this.drawGroundOverlays(ctx, ui);
    ctx.restore();
    this.drawOreDeposits(ctx, tx0, ty0, tx1, ty1, t);

    // ---- upright pass, sorted by depth ----
    const list = [], air = [];
    for (const p of m.props) {
      const ti = Math.floor(p.y / TILE) * m.w + Math.floor(p.x / TILE);
      if (!G.explored[ti]) continue;
      const [sx, sy] = this.P(p.x, p.y);
      if (onScreen(sx, sy)) list.push({ d: p.x + p.y, p, sx, sy });
    }
    for (const e of G.entities) {
      if (e.dead) continue;
      if (e.team !== pid && !G.isVisibleTo(e, pid)) continue;
      if (e.kind === 'building') {
        const [sx, sy] = this.P(e.x, e.y);
        if (onScreen(sx, sy, 200)) list.push({ d: e.x + e.y, e });
      } else {
        const [sx, sy] = this.P(e.x, e.y);
        if (!onScreen(sx, sy)) continue;
        if (e.air) air.push(e); else list.push({ d: e.x + e.y, e, sx, sy });
      }
    }
    list.sort((a, b) => a.d - b.d);
    const theme = m.theme;
    for (const it of list) {
      if (it.p) Art.blit(ctx, it.p.kind === 'rock' ? rockSprite(theme, it.p.v) : treeSprite(theme, it.p.v), it.sx, it.sy);
      else if (it.e.kind === 'building') this.drawBuilding(ctx, it.e, G.teamOf(it.e.team), t);
      else this.drawUnit(ctx, it.e, it.sx, it.sy);
    }
    for (const p of G.projectiles) this.drawProjectile(ctx, p);
    for (const f of G.effects) if (f.type !== 'corpse') this.drawEffect(ctx, f);
    air.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const e of air) {
      const [sx, sy] = this.P(e.x, e.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of air) { const [sx, sy] = this.P(e.x, e.y); this.drawUnit(ctx, e, sx, sy); }
    this.drawStrikes(ctx);
    this.drawCharges(ctx);

    // ---- fog of war ----
    this.updateFogCanvas();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogIso, -m.w * TILE - cx, -cy, m.w * TILE * 2, m.w * TILE);

    this.drawScreenOverlays(ctx, ui, list, air);
    this.drawGrade(ctx, vw, vh);
  },

  // cinematic colour grade and vignette, matching the moody look of the style guide
  drawGrade(ctx, vw, vh) {
    if (!this.grade || this.grade.w !== vw || this.grade.h !== vh) {
      const c = document.createElement('canvas'); c.width = vw; c.height = vh;
      const g = c.getContext('2d');
      const r = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.62);
      r.addColorStop(0, 'rgba(10,25,45,0.06)'); r.addColorStop(1, 'rgba(4,10,20,0.42)');
      g.fillStyle = r; g.fillRect(0, 0, vw, vh);
      this.grade = { w: vw, h: vh, c };
    }
    ctx.drawImage(this.grade.c, 0, 0);
  },

  // soil stains under ore fields (ground pass, world coordinates)
  drawOre(ctx, tx0, ty0, tx1, ty1) {
    const m = G.map;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = m.idx(tx, ty);
      if (m.ore[i] < 5 || !G.explored[i]) continue;
      const gem = m.oreType[i] === GEM, x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
      const g = ctx.createRadialGradient(x, y, 2, x, y, TILE * 0.85);
      const a = 0.18 + Math.min(0.22, m.ore[i] / 2500);
      g.addColorStop(0, gem ? `rgba(40,110,120,${a})` : `rgba(120,82,24,${a + 0.05})`);
      g.addColorStop(1, gem ? 'rgba(40,110,120,0)' : 'rgba(120,82,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - TILE, y - TILE, TILE * 2, TILE * 2);
    }
  },

  // the deposits themselves: upright 3D ore lumps and crystals, back to front
  drawOreDeposits(ctx, tx0, ty0, tx1, ty1, t) {
    const m = G.map;
    for (let d = tx0 + ty0; d <= tx1 + ty1; d++) {
      for (let tx = Math.max(tx0, d - ty1); tx <= Math.min(tx1, d - ty0); tx++) {
        const ty = d - tx, i = m.idx(tx, ty), amt = m.ore[i];
        if (amt < 5 || !G.explored[i]) continue;
        const gem = m.oreType[i] === GEM;
        const level = Math.max(1, Math.min(4, Math.ceil(amt / (gem ? 220 : 130))));
        const v = (i * 2654435761 >>> 0) % 4;
        const [sx, sy] = this.P(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
        if (sx < -60 || sy < -60 || sx > ctx.canvas.width + 60 || sy > ctx.canvas.height + 60) continue;
        Art.blit(ctx, oreSprite(gem, level, v), sx, sy);
        // lithium glints now and then
        if (gem && ((i * 7 + Math.floor(t * 1.5)) % 23) === 0) {
          const p = (t * 1.5) % 1, gx = sx + ((i * 13) % 17) - 8, gy = sy - 10 - ((i * 7) % 6);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(230,255,255,${Math.sin(p * Math.PI)})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(gx - 3, gy); ctx.lineTo(gx + 3, gy); ctx.moveTo(gx, gy - 3); ctx.lineTo(gx, gy + 3); ctx.stroke();
          ctx.restore();
        }
      }
    }
  },

  // ---------- structures ----------
  drawBuilding(ctx, b, team, t) {
    const s = buildingSprite(b, team);
    const [sx, sy] = this.P(b.tx * TILE, b.ty * TILE);
    const k = b.built !== undefined ? b.built : 1;
    if (k < 1) {
      // rises out of the ground while under construction
      const cut = s.h * (1 - k);
      const src = s.sw ? [s.sx, s.sy, s.sw, s.sh] : [0, 0, s.c.width, s.c.height], r = src[3] / s.h;
      ctx.drawImage(s.c, src[0], src[1] + cut * r, src[2], src[3] - cut * r, sx - s.ox, sy - s.oy + cut, s.w, s.h - cut);
      return;
    }
    Art.blit(ctx, s, sx, sy);
    if (BLD_TURRETS[b.key]) Art.blit(ctx, buildingTurretSprite(b, team), sx, sy);
    const live = BLD_LIVE[b.key];
    if (live) live(ctx, (lx, ly, lz) => this.P(b.tx * TILE + lx, b.ty * TILE + ly, lz), b, team, t, team.lowPower);
    if (b.garrison && b.garrison.length) this.drawGarrison(ctx, b, team);
    if (b.hp < b.maxHp * 0.5 && Math.random() < 0.15) {
      const x = b.tx * TILE + Math.random() * b.w * TILE, y = b.ty * TILE + Math.random() * b.h * TILE;
      G.effects.push({ type: 'smoke', x, y, z: b.def.height * 0.8, t: 0, life: 1.4, size: 5 });
      if (b.hp < b.maxHp * 0.25) G.effects.push({ type: 'fire', x, y, z: b.def.height * 0.6, t: 0, life: 0.5 });
    }
  },

  // occupancy pips over a held structure, in the holder's colour
  drawGarrison(ctx, b, team) {
    const [cx, cy] = this.P(b.x, b.y, b.def.height + 4), n = b.def.garrison, w = 5;
    const x0 = cx - (n * w + (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x0 + i * (w + 1) - 1, cy - 1, w + 2, w + 2);
      ctx.fillStyle = i < b.garrison.length ? team.color : '#333';
      ctx.fillRect(x0 + i * (w + 1), cy, w, w);
    }
  },

  // ---------- units ----------
  drawUnit(ctx, u, sx, sy) {
    const team = G.teamOf(u.team);
    if (!u.air) {
      const r = u.def.radius * 1.15;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(sx + 2, sy + 1, r * 1.25, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
    }
    // a dug-in soldier sits in a ring of sandbags: the far half behind them, the near half in front
    const bags = u.dug ? 1 : u.digging ? Math.max(0, Math.min(1, u.digging > 0 ? 1 - u.digT / u.def.dig.time : u.digT / u.def.dig.pack)) : 0;
    if (bags) this.drawSandbags(ctx, u, bags, false);
    const bob = u.air && !u.def.jet ? Math.sin(u.anim * 3) * 2 : 0;
    const hidden = u.def.stealth && G.stealthRange(u) < 1e9;
    if (hidden) ctx.globalAlpha = 0.55;
    drawUnitArt(ctx, u, team, sx, sy - bob);
    ctx.globalAlpha = 1;
    if (bags) this.drawSandbags(ctx, u, bags, true);
    if (u.def.hero) {
      // a gold marker so the hero is easy to find in a crowd
      const y = sy - 30 + Math.sin(u.anim * 3) * 1.5;
      ctx.fillStyle = '#ffd27a'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, y + 5); ctx.lineTo(sx - 4, y); ctx.lineTo(sx, y - 5); ctx.lineTo(sx + 4, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },

  drawSandbags(ctx, u, k, front) {
    const n = 9, R = 9;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, bx = Math.cos(a) * R, by = Math.sin(a) * R;
      if ((bx + by > 0) !== front) continue;
      for (let layer = 0; layer < 2; layer++) {
        if (layer && k < 0.6) continue;
        const [x, y] = this.P(u.x + bx, u.y + by, 1.6 + layer * 2.6);
        ctx.fillStyle = layer ? '#b7a473' : '#9c8a5c'; ctx.strokeStyle = 'rgba(40,30,15,0.7)'; ctx.lineWidth = 0.8;
        ctx.globalAlpha = Math.min(1, k * 1.5);
        const rot = Math.atan2(isoY(-Math.sin(a), Math.cos(a), 0), isoX(-Math.sin(a), Math.cos(a)));
        ctx.beginPath(); ctx.ellipse(x, y, 4.2, 2.2, rot, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  },

  drawProjectile(ctx, p) {
    const [x, y] = this.P(p.x, p.y, p.z || 0);
    if (p.type === 'arty') {
      const [gx, gy] = this.P(p.x, p.y, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffdc8a';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const dx = Math.cos(p.ang), dy = Math.sin(p.ang);
    const a = Math.atan2((dx + dy) / 2, dx - dy);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    if (p.type === 'rocket') {
      ctx.fillStyle = '#ddd'; ctx.fillRect(-5, -1.5, 8, 3);
      ctx.fillStyle = '#ffb347'; ctx.fillRect(-8, -1, 3, 2);
    } else {
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-4, -1.5, 7, 3);
    }
    ctx.restore();
  },

  drawCorpse(ctx, f) {
    const p = f.t / f.life;
    ctx.fillStyle = f.color; ctx.globalAlpha = 0.7 * (1 - p);
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a1010';
    ctx.beginPath(); ctx.ellipse(f.x + 2, f.y + 1, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawEffect(ctx, f) {
    if (f.t < 0) return;
    const p = f.t / f.life;
    const [x, y] = this.P(f.x, f.y, f.type === 'falling' ? f.alt : (f.z || 0));
    if (x < -150 || y < -150 || x > ctx.canvas.width + 150 || y > ctx.canvas.height + 150) return;
    switch (f.type) {
      case 'explosion': {
        const r = f.size * (0.35 + 0.75 * p);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y - r * 0.3, r);
        g.addColorStop(0, `rgba(255,240,200,${1 - p})`);
        g.addColorStop(0.35, `rgba(255,150,40,${0.9 * (1 - p)})`);
        g.addColorStop(1, 'rgba(120,30,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y - r * 0.3, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (p > 0.3) {
          ctx.fillStyle = `rgba(40,35,30,${0.5 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(x, y - r * 0.4 - p * 18, r * 0.8, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'debris':
        ctx.fillStyle = `rgba(40,30,20,${1 - p})`;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        break;
      case 'smoke':
        ctx.fillStyle = `rgba(110,110,110,${0.45 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(x, y, f.size * (1 + p * 1.5), 0, Math.PI * 2); ctx.fill();
        break;
      case 'fire': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${120 + 80 * (1 - p)},30,${0.8 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(x, y - p * 10, 4 * (1 - p) + 1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'tracer': {
        const [x2, y2] = this.P(f.x2, f.y2, f.z2 || 0);
        ctx.strokeStyle = `rgba(255,230,140,${1 - p})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        break;
      }
      case 'flash': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = f.color ? f.color : 'rgb(255,220,120)';
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.arc(x, y, f.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'rail': {
        const [x2, y2] = this.P(f.x2, f.y2, f.z2 || 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(80,220,255,${0.8 * (1 - p)})`; ctx.lineWidth = 6 * (1 - p) + 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'laser': {
        const [x2, y2] = this.P(f.x2, f.y2, f.z2 || 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,70,60,${0.75 * (1 - p)})`; ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,230,220,${1 - p})`; ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'flame': {
        const [x2, y2] = this.P(f.x2, f.y2, f.z2 || 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 6; i++) {
          const k = i / 6 * Math.min(1, p * 4 + 0.3), r = 1.5 + k * 5;
          const fx = x + (x2 - x) * k + Math.sin(f.t * 40 + i) * k * 3, fy = y + (y2 - y) * k - k * 3;
          ctx.fillStyle = `rgba(255,${200 - k * 120 | 0},40,${0.75 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'spark':
        ctx.fillStyle = f.color; ctx.globalAlpha = 1 - p;
        for (let i = 0; i < 3; i++) ctx.fillRect(x + Math.sin(i * 7 + f.t * 20) * 6 * p, y - p * 8 - i * 2, 2, 2);
        ctx.globalAlpha = 1;
        break;
      case 'falling':
        ctx.fillStyle = '#222';
        ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * 12);
        ctx.fillRect(-7, -2, 14, 4); ctx.restore();
        break;
    }
  },

  // C4 on a structure: a blinking light and the seconds left
  drawCharges(ctx) {
    for (const c of G.charges) {
      const b = c.b;
      if (b.team !== G.player && !G.isVisibleBld(b)) continue;
      const [x, y] = this.P(b.x, b.y, b.def.height * 0.45);
      const on = Math.sin(G.time * (6 + (c.fuse - c.t) * 4)) > 0;
      ctx.fillStyle = on ? '#ff3b2f' : '#5a1410';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,60,40,0.3)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = 'bold 11px Oswald, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText('C4 ' + Math.ceil(c.t), x + 1, y - 7);
      ctx.fillStyle = '#ffb4a8'; ctx.fillText('C4 ' + Math.ceil(c.t), x, y - 8);
    }
  },

  drawStrikes(ctx) {
    for (const s of G.pendingStrikes) {
      const [x, y] = this.P(s.x, s.y);
      if (!s.done) {
        const left = s.delay - s.t;
        if (s.sw.kind === 'missile' && left < 0.7) {
          const k = 1 - left / 0.7, h = 900 * (1 - k);
          ctx.strokeStyle = 'rgba(255,220,180,0.9)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x + 120 * (1 - k), y - h); ctx.lineTo(x + 120 * (1 - k) + 18, y - h - 90); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 120 * (1 - k), y - h, 5, 0, Math.PI * 2); ctx.fill();
        }
        if (s.sw.kind === 'lance' && left < 1.2) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(120,200,255,${0.6 * (1 - left / 1.2)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y - 1000); ctx.lineTo(x, y); ctx.stroke();
          ctx.restore();
        }
      } else if (s.sw.kind === 'lance' && s.t - s.delay < 1.2) {
        const k = (s.t - s.delay) / 1.2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const w = 40 * (1 - k) + 6;
        const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, 'rgba(80,180,255,0)'); g.addColorStop(0.5, `rgba(230,250,255,${1 - k})`); g.addColorStop(1, 'rgba(80,180,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - w, y - 1200, w * 2, 1200);
        ctx.restore();
      }
    }
  },

  // overlays that lie on the ground (drawn through the iso transform, in world units)
  drawGroundOverlays(ctx, ui) {
    const pid = G.player;
    for (const s of G.pendingStrikes) {
      if (s.done) continue;
      const R = s.sw.radius * TILE * (1 - s.t / s.delay * 0.3);
      ctx.strokeStyle = `rgba(255,40,40,${0.6 + 0.4 * Math.sin(s.t * 10)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x - R, s.y); ctx.lineTo(s.x + R, s.y); ctx.moveTo(s.x, s.y - R); ctx.lineTo(s.x, s.y + R); ctx.stroke();
    }
    if (G.mission) {
      for (const mk of G.mission.markers) {
        const p = (G.time * 0.8) % 1;
        ctx.strokeStyle = 'rgba(255,210,122,0.9)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(mk.x, mk.y, TILE * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,210,122,${0.8 * (1 - p)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mk.x, mk.y, TILE * (0.5 + 1.5 * p), 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const e of ui.selection) {
      if (e.dead) continue;
      ctx.lineWidth = 1.5;
      if (e.kind === 'building' && e.rally) {
        const rx = e.rally[0] * TILE + TILE / 2, ry = e.rally[1] * TILE + TILE / 2;
        ctx.strokeStyle = 'rgba(120,255,120,0.7)'; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI * 2); ctx.stroke();
      }
      if (e.kind === 'unit' && e.order && (e.order.type === 'move' || e.order.type === 'amove') && e.team === pid) {
        ctx.strokeStyle = e.order.type === 'amove' ? 'rgba(255,120,80,0.4)' : 'rgba(120,255,120,0.35)';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.order.tx * TILE + TILE / 2, e.order.ty * TILE + TILE / 2); ctx.stroke();
      }
      if (e.kind === 'unit' && e.target && e.team === pid) {
        ctx.strokeStyle = 'rgba(255,60,60,0.4)';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.target.x, e.target.y); ctx.stroke();
      }
      if (e.kind === 'unit' && !e.air) {
        ctx.strokeStyle = e.team === pid ? 'rgba(140,255,140,0.9)' : 'rgba(255,110,110,0.9)';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.def.radius + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (ui.placing) {
      const def = BUILDINGS[ui.placing.key];
      const ok = G.canPlace(ui.placing.key, pid, ui.placing.tx, ui.placing.ty);
      for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
        const tx = ui.placing.tx + x, ty = ui.placing.ty + y;
        const tileOk = G.map.inside(tx, ty) && G.map.terrainPassable(tx, ty) && G.map.bld[G.map.idx(tx, ty)] < 0;
        ctx.fillStyle = ok ? 'rgba(80,255,120,0.35)' : tileOk ? 'rgba(255,200,60,0.35)' : 'rgba(255,60,60,0.45)';
        ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
      }
    }
    if (ui.superTargeting) {
      const R = BUILDINGS[G.playerTeam.superKey()].superweapon.radius * TILE;
      ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ui.mouseWorld.x, ui.mouseWorld.y, R, 0, Math.PI * 2); ctx.stroke();
    }
    for (const c of ui.clickMarks) {
      const p = c.t / 0.5;
      ctx.strokeStyle = c.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(c.x, c.y, 14 * (1 - p) + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  // overlays in screen space: selection, health bars, ghosts, drag box
  drawScreenOverlays(ctx, ui, list, air) {
    if (ui.placing) {
      const def = BUILDINGS[ui.placing.key];
      const fake = { key: ui.placing.key, def, tx: ui.placing.tx, ty: ui.placing.ty, w: def.w, h: def.h, built: 1, turret: -Math.PI / 4 };
      ctx.globalAlpha = 0.6;
      const s = buildingSprite(fake, G.playerTeam);
      const [sx, sy] = this.P(fake.tx * TILE, fake.ty * TILE);
      Art.blit(ctx, s, sx, sy);
      if (BLD_TURRETS[fake.key]) Art.blit(ctx, buildingTurretSprite(fake, G.playerTeam), sx, sy);
      ctx.globalAlpha = 1;
    }
    const sel = new Set(ui.selection);
    const ents = list.filter(it => it.e).map(it => it.e).concat(air);
    for (const e of ents) {
      const isSel = sel.has(e), hover = ui.hover === e, recent = e.hitT && G.time - e.hitT < 2.5;
      if (e.kind === 'building' && isSel) this.drawBuildingSelection(ctx, e);
      if (e.kind === 'unit' && e.air && isSel) {
        const [x, y] = this.P(e.x, e.y, e.alt + 6);
        ctx.strokeStyle = G.hostile(e.team, G.player) ? '#f66' : '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, 18, 9, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (isSel || hover || recent || ui.showBars) this.drawHealth(ctx, e, isSel);
    }
    if (G.mission) {
      ctx.font = '600 12px Oswald, sans-serif'; ctx.textAlign = 'center';
      for (const mk of G.mission.markers) {
        const [x, y] = this.P(mk.x, mk.y, 18);
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(mk.label, x + 1, y + 1);
        ctx.fillStyle = '#ffd27a'; ctx.fillText(mk.label, x, y);
      }
    }
    if (ui.drag) {
      const d = ui.drag;
      ctx.strokeStyle = 'rgba(140,255,140,0.9)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(140,255,140,0.08)';
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
  },

  drawBuildingSelection(ctx, b) {
    const X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE;
    const c = [this.P(X, Y), this.P(X + W, Y), this.P(X + W, Y + H), this.P(X, Y + H)];
    ctx.strokeStyle = G.hostile(b.team, G.player) ? 'rgba(255,110,110,0.9)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
    // corner brackets along the footprint diamond
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = c[i], [bx, by] = c[(i + 1) % 4], [px, py] = c[(i + 3) % 4];
      ctx.moveTo(ax + (px - ax) * 0.2, ay + (py - ay) * 0.2); ctx.lineTo(ax, ay); ctx.lineTo(ax + (bx - ax) * 0.2, ay + (by - ay) * 0.2);
    }
    ctx.stroke();
  },

  drawHealth(ctx, e, sel) {
    let x, y, w;
    if (e.kind === 'building') {
      const [cx, cy] = this.P(e.x, e.y, e.def.height + 10);
      w = Math.min(90, e.w * TILE * 1.1); x = cx - w / 2; y = cy;
    } else {
      const [sx, sy] = this.P(e.x, e.y, (e.alt || 0) + (e.def.cat === 'infantry' ? 20 : 26));
      w = Math.max(18, e.def.radius * 2.4); x = sx - w / 2; y = sy;
    }
    const f = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = f > 0.6 ? '#3f3' : f > 0.3 ? '#fd3' : '#f33';
    ctx.fillRect(x, y, w * f, 3);
    if (e.kind === 'unit' && e.def.harvester && e.team === G.player) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y + 4, w + 2, 4);
      ctx.fillStyle = '#e6b23a'; ctx.fillRect(x, y + 5, w * e.cargo / e.def.capacity, 2);
    }
    if (e.kind === 'unit' && e.rank) {
      ctx.fillStyle = e.rank === 2 ? '#ff5' : '#ddd';
      for (let i = 0; i < e.rank; i++) {
        const cx = x + w + 4, cy = y + 1 + i * 4;
        ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx, cy + 2.5); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx + 3, cy + 1.5); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx - 3, cy + 1.5); ctx.fill();
      }
    }
    if (e.kind === 'building' && e.repairing) {
      ctx.fillStyle = '#7f7'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🔧', x + w / 2, y + 16);
    }
    if (e.kind === 'building' && e.primary && sel) {
      ctx.fillStyle = '#ff5'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('PRIMARY', x, y - 3);
    }
  },
};
