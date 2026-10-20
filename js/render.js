// Cold War 2: 2030 — rendering of the battlefield (artwork itself lives in art.js).
'use strict';

const Render = {
  fogCanvas: null, fogVersion: -1,

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
  },

  updateFogCanvas() {
    if (this.fogVersion === G.fogVersion) return;
    this.fogVersion = G.fogVersion;
    const d = this.fogImg.data, vis = G.visible, exp = G.explored;
    for (let i = 0; i < vis.length; i++) {
      d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 110 : 255;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    const h = this.fogHiCtx, S = this.fogHi.width;
    h.clearRect(0, 0, S, S);
    h.filter = 'blur(3px)';
    h.imageSmoothingEnabled = true;
    h.drawImage(this.fogCanvas, 0, 0, S, S);
    h.filter = 'none';
  },

  draw(ctx, cam, ui) {
    const vw = ctx.canvas.width, vh = ctx.canvas.height;
    let cx = Math.round(cam.x), cy = Math.round(cam.y);
    if (G.shake > 0) { cx += Math.round((Math.random() - 0.5) * G.shake); cy += Math.round((Math.random() - 0.5) * G.shake); }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(-cx, -cy);
    const m = G.map;
    const sx = Math.max(0, cx), sy = Math.max(0, cy);
    const sw = Math.min(m.w * TILE - sx, vw), sh = Math.min(m.h * TILE - sy, vh);
    if (sw > 0 && sh > 0) ctx.drawImage(m.terrainCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
    const tx0 = Math.max(0, Math.floor(cx / TILE) - 1), ty0 = Math.max(0, Math.floor(cy / TILE) - 1);
    const tx1 = Math.min(m.w - 1, Math.ceil((cx + vw) / TILE) + 1), ty1 = Math.min(m.h - 1, Math.ceil((cy + vh) / TILE) + 1);
    const view = { x0: cx - 80, y0: cy - 80, x1: cx + vw + 80, y1: cy + vh + 80 };
    const inView = (x, y) => x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;

    this.drawOre(ctx, tx0, ty0, tx1, ty1);

    // scorch marks
    for (const d of G.decals) {
      if (!inView(d.x, d.y)) continue;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      g.addColorStop(0, 'rgba(15,10,5,0.55)'); g.addColorStop(1, 'rgba(15,10,5,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, d.a, 0, Math.PI * 2); ctx.fill();
    }

    // corpses / ground effects first
    for (const f of G.effects) if (f.type === 'corpse' && inView(f.x, f.y)) this.drawEffect(ctx, f);

    // ground layer, sorted by y
    const pid = G.player;
    const ground = [], air = [];
    for (const e of G.entities) {
      if (e.dead) continue;
      if (!inView(e.x, e.y) && e.kind !== 'building') continue;
      if (e.team !== pid && !G.isVisibleTo(e, pid)) continue;
      if (e.kind === 'unit' && e.air) air.push(e); else ground.push(e);
    }
    ground.sort((a, b) => this.baseY(a) - this.baseY(b));
    for (const e of ground) {
      if (e.kind === 'building') this.drawBuilding(ctx, e);
      else this.drawUnit(ctx, e);
    }
    // projectiles
    for (const p of G.projectiles) if (inView(p.x, p.y)) this.drawProjectile(ctx, p);
    for (const f of G.effects) if (f.type !== 'corpse' && inView(f.x, f.y)) this.drawEffect(ctx, f);
    // air
    for (const e of air) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.save(); ctx.translate(e.x + 10, e.y + 12); ctx.rotate(e.facing);
      if (e.def.jet) { poly(ctx, [[12, 0], [-2, -10], [-8, -10], [-10, 0], [-8, 10], [-2, 10]]); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fill(); }
      ctx.restore();
    }
    for (const e of air) this.drawUnit(ctx, e);
    this.drawStrikes(ctx);

    // fog of war
    this.updateFogCanvas();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogHi, 0, 0, m.w * TILE, m.h * TILE);

    // overlays
    this.drawOverlays(ctx, ui, ground.concat(air));
    ctx.restore();
    this.drawGrade(ctx, vw, vh);
  },

  // cinematic colour grade and vignette, matching the moody look of the style guide
  drawGrade(ctx, vw, vh) {
    if (!this.grade || this.grade.w !== vw || this.grade.h !== vh) {
      const c = document.createElement('canvas'); c.width = vw; c.height = vh;
      const g = c.getContext('2d');
      const r = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.62);
      r.addColorStop(0, 'rgba(4,10,20,0)'); r.addColorStop(1, 'rgba(4,10,20,0.4)');
      g.fillStyle = r; g.fillRect(0, 0, vw, vh);
      this.grade = { w: vw, h: vh, c };
    }
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(40,70,110,0.35)'; ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
    ctx.drawImage(this.grade.c, 0, 0);
  },

  baseY(e) { return e.kind === 'building' ? (e.ty + e.h) * TILE - 4 : e.y; },

  drawOre(ctx, tx0, ty0, tx1, ty1) {
    const m = G.map;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = m.idx(tx, ty);
      const amt = m.ore[i];
      if (amt < 5 || !G.explored[i]) continue;
      const gem = m.oreType[i] === GEM;
      const n = Math.max(1, Math.min(5, Math.ceil(amt / (gem ? 180 : 110))));
      let seed = i * 9301 + 49297;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      // tinted ground under ore
      ctx.fillStyle = gem ? 'rgba(40,120,140,0.18)' : 'rgba(150,110,30,0.18)';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      for (let k = 0; k < n; k++) {
        const x = tx * TILE + 5 + rnd() * 22, y = ty * TILE + 6 + rnd() * 20;
        const s = 3 + rnd() * 3 + Math.min(3, amt / 300);
        if (gem) {
          ctx.fillStyle = '#1b6b80';
          ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7ff3ff';
          ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y - s * 0.2); ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = '#7a5a18';
          ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e6b23a';
          ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.3, s * 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  },

  // ---------- buildings ----------
  block(ctx, x, y, w, h, hgt, roof, wall, edge) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.moveTo(x + w, y + 2); ctx.lineTo(x + w + hgt * 0.6, y + hgt * 0.4 + 2); ctx.lineTo(x + w + hgt * 0.6, y + h + hgt * 0.4); ctx.lineTo(x + hgt * 0.6, y + h + hgt * 0.4); ctx.lineTo(x, y + h);
    ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, y + h - hgt, 0, y + h);
    g.addColorStop(0, wall); g.addColorStop(1, shade(wall, -0.35));
    ctx.fillStyle = g; ctx.fillRect(x, y + h - hgt, w, hgt);
    ctx.fillStyle = roof; ctx.fillRect(x, y, w, h - hgt);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, w, 2);
    ctx.strokeStyle = edge || 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.moveTo(x, y + h - hgt + 0.5); ctx.lineTo(x + w, y + h - hgt + 0.5); ctx.stroke();
  },

  drawBuilding(ctx, b, opts = {}) {
    const team = opts.team || G.teams[b.team];
    const X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE;
    const k = b.built !== undefined ? b.built : 1;
    ctx.save();
    if (k < 1) ctx.globalAlpha = 0.35 + 0.65 * k;
    // concrete pad
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X, Y + 2, W, H);
    ctx.fillStyle = '#4a4d50';
    ctx.fillRect(X + 1, Y + 1, W - 2, H - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) ctx.strokeRect(X + i * TILE + 1.5, Y + j * TILE + 1.5, TILE - 1, TILE - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(X + 1, Y + 1, W - 2, 1);
    const hgt = b.def.height * k;
    const lowPower = team.lowPower;
    const fn = BLD_ART[b.key];
    if (fn) fn(ctx, b, X, Y, W, H, hgt, team, lowPower, G ? G.time : 0);
    if (k < 1) {
      ctx.strokeStyle = 'rgba(255,220,80,0.8)'; ctx.setLineDash([4, 3]);
      ctx.strokeRect(X + 2, Y + 2, W - 4, H - 4); ctx.setLineDash([]);
    }
    ctx.restore();
    // damage smoke/fire
    if (!opts.icon && b.hp < b.maxHp * 0.5 && Math.random() < 0.15) {
      G.effects.push({ type: 'smoke', x: X + Math.random() * W, y: Y + Math.random() * H * 0.6, t: 0, life: 1.4, size: 5 });
      if (b.hp < b.maxHp * 0.25) G.effects.push({ type: 'fire', x: X + 4 + Math.random() * (W - 8), y: Y + 4 + Math.random() * (H - 8), t: 0, life: 0.5 });
    }
  },

  // ---------- units ----------
  drawUnit(ctx, u, opts = {}) {
    const team = opts.team || G.teams[u.team];
    ctx.save();
    ctx.translate(u.x, u.y - (u.alt || 0) + (u.air && !u.def.jet ? Math.sin(u.anim * 3) * 2 : 0));
    if (!u.air) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(3, 4, u.def.radius * 1.1, u.def.radius * 0.8, u.facing, 0, Math.PI * 2); ctx.fill();
    }
    Art.unit(ctx, u, team);
    ctx.restore();
  },

  drawProjectile(ctx, p) {
    if (p.type === 'arty') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffdc8a';
      ctx.beginPath(); ctx.arc(p.x, p.y - p.z, 3, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.ang);
    if (p.type === 'rocket') {
      ctx.fillStyle = '#ddd'; ctx.fillRect(-5, -1.5, 8, 3);
      ctx.fillStyle = '#ffb347'; ctx.fillRect(-8, -1, 3, 2);
    } else {
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-4, -1.5, 7, 3);
    }
    ctx.restore();
  },

  drawEffect(ctx, f) {
    if (f.t < 0) return;
    const p = f.t / f.life;
    switch (f.type) {
      case 'explosion': {
        const r = f.size * (0.35 + 0.75 * p);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, `rgba(255,240,200,${1 - p})`);
        g.addColorStop(0.35, `rgba(255,150,40,${0.9 * (1 - p)})`);
        g.addColorStop(1, 'rgba(120,30,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (p > 0.3) {
          ctx.fillStyle = `rgba(40,35,30,${0.5 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(f.x, f.y - p * 14, r * 0.8, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'debris':
        ctx.fillStyle = `rgba(40,30,20,${1 - p})`;
        ctx.fillRect(f.x - 1.5, f.y - (f.z || 0) - 1.5, 3, 3);
        break;
      case 'smoke':
        ctx.fillStyle = `rgba(110,110,110,${0.45 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1 + p * 1.5), 0, Math.PI * 2); ctx.fill();
        break;
      case 'fire': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${120 + 80 * (1 - p)},30,${0.8 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y - p * 10, 4 * (1 - p) + 1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'tracer':
        ctx.strokeStyle = `rgba(255,230,140,${1 - p})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        break;
      case 'flash': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = f.color ? f.color : `rgba(255,220,120,${1 - p})`;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'rail': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(80,220,255,${0.8 * (1 - p)})`; ctx.lineWidth = 6 * (1 - p) + 1;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'spark':
        ctx.fillStyle = f.color; ctx.globalAlpha = 1 - p;
        for (let i = 0; i < 3; i++) ctx.fillRect(f.x + Math.sin(i * 7 + f.t * 20) * 6 * p, f.y - p * 8 - i * 2, 2, 2);
        ctx.globalAlpha = 1;
        break;
      case 'corpse':
        ctx.fillStyle = f.color; ctx.globalAlpha = 0.7 * (1 - p);
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a1010';
        ctx.beginPath(); ctx.ellipse(f.x + 2, f.y + 1, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'falling':
        ctx.fillStyle = '#222';
        ctx.save(); ctx.translate(f.x, f.y - f.alt); ctx.rotate(f.t * 12);
        ctx.fillRect(-6, -2, 12, 4); ctx.restore();
        break;
    }
  },

  drawStrikes(ctx) {
    for (const s of G.pendingStrikes) {
      const R = s.sw.radius * TILE;
      if (!s.done) {
        const pulse = 0.5 + 0.5 * Math.sin(s.t * 10);
        ctx.strokeStyle = `rgba(255,40,40,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, R * (1 - s.t / s.delay * 0.3), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.x - R, s.y); ctx.lineTo(s.x + R, s.y); ctx.moveTo(s.x, s.y - R); ctx.lineTo(s.x, s.y + R); ctx.stroke();
        const left = s.delay - s.t;
        if (s.sw.kind === 'missile' && left < 0.7) {
          const k = 1 - left / 0.7;
          ctx.strokeStyle = 'rgba(255,220,180,0.9)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(s.x + 200 * (1 - k), s.y - 900 * (1 - k)); ctx.lineTo(s.x + 220 * (1 - k) + 20, s.y - 900 * (1 - k) - 90); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x + 200 * (1 - k), s.y - 900 * (1 - k), 5, 0, Math.PI * 2); ctx.fill();
        }
        if (s.sw.kind === 'lance' && left < 1.2) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(120,200,255,${0.6 * (1 - left / 1.2)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(s.x, s.y - 1000); ctx.lineTo(s.x, s.y); ctx.stroke();
          ctx.restore();
        }
      } else if (s.sw.kind === 'lance' && s.t - s.delay < 1.2) {
        const k = (s.t - s.delay) / 1.2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const w = 40 * (1 - k) + 6;
        const g = ctx.createLinearGradient(s.x - w, 0, s.x + w, 0);
        g.addColorStop(0, 'rgba(80,180,255,0)'); g.addColorStop(0.5, `rgba(230,250,255,${1 - k})`); g.addColorStop(1, 'rgba(80,180,255,0)');
        ctx.fillStyle = g; ctx.fillRect(s.x - w, s.y - 1200, w * 2, 1200);
        ctx.restore();
      }
    }
  },

  drawOverlays(ctx, ui, visibleEnts) {
    const pid = G.player;
    // rally points of selected buildings
    for (const e of ui.selection) {
      if (e.kind === 'building' && e.rally && !e.dead) {
        const rx = e.rally[0] * TILE + TILE / 2, ry = e.rally[1] * TILE + TILE / 2;
        ctx.strokeStyle = 'rgba(120,255,120,0.7)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#7f7'; ctx.fillRect(rx - 1, ry - 10, 2, 10);
        ctx.beginPath(); ctx.moveTo(rx + 1, ry - 10); ctx.lineTo(rx + 8, ry - 7); ctx.lineTo(rx + 1, ry - 4); ctx.fill();
      }
      if (e.kind === 'unit' && !e.dead && e.order && (e.order.type === 'move' || e.order.type === 'amove') && e.team === pid) {
        ctx.strokeStyle = e.order.type === 'amove' ? 'rgba(255,120,80,0.35)' : 'rgba(120,255,120,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.order.tx * TILE + TILE / 2, e.order.ty * TILE + TILE / 2); ctx.stroke();
      }
      if (e.kind === 'unit' && !e.dead && e.target && e.team === pid) {
        ctx.strokeStyle = 'rgba(255,60,60,0.35)';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.target.x, e.target.y); ctx.stroke();
      }
    }
    const sel = new Set(ui.selection);
    for (const e of visibleEnts) {
      const isSel = sel.has(e);
      const hover = ui.hover === e;
      const recent = e.hitT && G.time - e.hitT < 2.5;
      if (isSel) this.drawSelection(ctx, e);
      if (isSel || hover || recent || ui.showBars) this.drawHealth(ctx, e, isSel);
    }
    // placement ghost
    if (ui.placing) {
      const def = BUILDINGS[ui.placing.key];
      const ok = G.canPlace(ui.placing.key, pid, ui.placing.tx, ui.placing.ty);
      for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
        const tx = ui.placing.tx + x, ty = ui.placing.ty + y;
        const tileOk = G.map.terrainPassable(tx, ty) && G.map.inside(tx, ty) && G.map.bld[G.map.idx(tx, ty)] < 0;
        ctx.fillStyle = ok ? 'rgba(80,255,120,0.28)' : tileOk ? 'rgba(255,200,60,0.3)' : 'rgba(255,60,60,0.4)';
        ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
      }
      ctx.globalAlpha = 0.55;
      this.drawBuilding(ctx, { key: ui.placing.key, def, tx: ui.placing.tx, ty: ui.placing.ty, w: def.w, h: def.h, x: 0, y: 0, hp: 1, maxHp: 1, built: 1, turret: -Math.PI / 2, anim: 0 }, { team: G.playerTeam, icon: true });
      ctx.globalAlpha = 1;
    }
    if (ui.drag) {
      const d = ui.drag;
      ctx.strokeStyle = 'rgba(140,255,140,0.9)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(140,255,140,0.08)';
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
    if (ui.superTargeting) {
      const t = G.playerTeam;
      const R = BUILDINGS[t.superKey()].superweapon.radius * TILE;
      ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ui.mouseWorld.x, ui.mouseWorld.y, R, 0, Math.PI * 2); ctx.stroke();
    }
    for (const c of ui.clickMarks) {
      const p = c.t / 0.5;
      ctx.strokeStyle = c.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 10 * (1 - p) + 2, 6 * (1 - p) + 1, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  drawSelection(ctx, e) {
    ctx.strokeStyle = e.team === G.player ? '#fff' : '#f66';
    ctx.lineWidth = 1.5;
    let x, y, w, h;
    if (e.kind === 'building') { x = e.tx * TILE + 1; y = e.ty * TILE + 1; w = e.w * TILE - 2; h = e.h * TILE - 2; }
    else { const r = e.def.radius + 3; x = e.x - r; y = e.y - (e.alt || 0) - r; w = h = r * 2; }
    const c = Math.min(6, w / 3);
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
    ctx.stroke();
  },

  drawHealth(ctx, e, sel) {
    let x, y, w;
    if (e.kind === 'building') { x = e.tx * TILE + 3; y = e.ty * TILE - 6; w = e.w * TILE - 6; }
    else { w = Math.max(16, e.def.radius * 2.4); x = e.x - w / 2; y = e.y - (e.alt || 0) - e.def.radius - 8; }
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
      ctx.fillText('🔧', e.x, e.y);
    }
    if (e.kind === 'building' && e.primary && sel) {
      ctx.fillStyle = '#ff5'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('PRIMARY', x, y - 3);
    }
  },
};

