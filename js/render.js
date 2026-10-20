// ColdWarning — rendering of the battlefield. Everything is drawn procedurally.
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
  },

  updateFogCanvas() {
    if (this.fogVersion === G.fogVersion) return;
    this.fogVersion = G.fogVersion;
    const d = this.fogImg.data, vis = G.visible, exp = G.explored;
    for (let i = 0; i < vis.length; i++) {
      d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 110 : 255;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
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
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(e.x + 6, e.y + 6, e.def.radius, e.def.radius * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of air) this.drawUnit(ctx, e);
    this.drawStrikes(ctx);

    // fog of war
    this.updateFogCanvas();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, m.w, m.h, 0, 0, m.w * TILE, m.h * TILE);

    // overlays
    this.drawOverlays(ctx, ui, ground.concat(air));
    ctx.restore();
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
    ctx.fillStyle = '#3e3f41';
    ctx.fillRect(X + 1, Y + 1, W - 2, H - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) ctx.fillRect(X + i * TILE + 2, Y + j * TILE + 2, TILE - 4, TILE - 4);
    const hgt = b.def.height * k;
    const lowPower = team.lowPower;
    const fn = BLD_DRAW[b.key];
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
    const fn = UNIT_DRAW[u.key];
    ctx.save();
    ctx.translate(u.x, u.y - (u.alt || 0) + (u.air ? Math.sin(u.anim * 3) * 2 : 0));
    if (!u.air) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(2, 3, u.def.radius * 1.05, u.def.radius * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    fn(ctx, u, team);
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

function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// ---------- per-building drawing ----------
const WALL = '#8b8f94', ROOF = '#9da3a8';

function stripe(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

const BLD_DRAW = {
  cc(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 4, Y + 6, W - 8, H - 10, hgt, ROOF, WALL);
    const ry = Y + 6, rh = H - 10 - hgt;
    // team stripes along roof
    stripe(ctx, X + 4, ry + rh - 5, W - 8, 4, team.color);
    // helipad
    ctx.fillStyle = '#555b60'; ctx.beginPath(); ctx.arc(X + W * 0.33, ry + rh * 0.45, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X + W * 0.33, ry + rh * 0.45, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', X + W * 0.33, ry + rh * 0.45 + 1);
    // command tower
    Render.block(ctx, X + W * 0.6, ry + 4, 22, 26, 10, '#b5bcc2', '#7f858b');
    ctx.fillStyle = '#7fd6ff'; ctx.fillRect(X + W * 0.6 + 2, ry + 22, 18, 3);
    // antenna
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X + W * 0.6 + 16, ry + 8); ctx.lineTo(X + W * 0.6 + 16, ry - 10); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 4) > 0 ? '#f44' : '#600'; ctx.beginPath(); ctx.arc(X + W * 0.6 + 16, ry - 10, 2, 0, Math.PI * 2); ctx.fill();
    // garage door
    ctx.fillStyle = '#3a3d40'; ctx.fillRect(X + W / 2 - 14, Y + H - 4 - hgt + 4, 28, hgt - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X + W / 2 - 14, Y + H - hgt + 4 + i * 5); ctx.lineTo(X + W / 2 + 14, Y + H - hgt + 4 + i * 5); ctx.stroke(); }
  },
  power(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 4, Y + 10, W - 8, H - 14, hgt * 0.6, ROOF, WALL);
    // fusion dome
    const cx = X + W / 2, cy = Y + H / 2 - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx + 5, cy + 6, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, 16);
    g.addColorStop(0, '#e9eef2'); g.addColorStop(1, '#7c858d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
    const pulse = low ? 0.15 : 0.6 + 0.4 * Math.sin(t * 3 + b.anim);
    ctx.fillStyle = `rgba(90,220,255,${pulse})`;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = team.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 12, 0.3, Math.PI - 0.3); ctx.stroke();
    // coolant pipes
    ctx.fillStyle = '#6d757c'; ctx.fillRect(X + 6, Y + H - 12, 8, 6); ctx.fillRect(X + W - 14, Y + H - 12, 8, 6);
  },
  refinery(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 4, Y + 4, W * 0.62, H - 22, hgt, ROOF, WALL);
    // silos
    for (let i = 0; i < 2; i++) {
      const cx = X + W * 0.8, cy = Y + 16 + i * 26;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx + 5, cy + 5, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 10);
      g.addColorStop(0, '#e2c37a'); g.addColorStop(1, '#8b6b2a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = team.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
    }
    stripe(ctx, X + 4, Y + 4 + H - 22 - hgt - 5, W * 0.62, 4, team.color);
    // docking pad
    ctx.fillStyle = '#2e3134'; ctx.fillRect(X + TILE + 2, Y + H - 16, TILE - 4, 14);
    ctx.fillStyle = (Math.floor(t * 2) % 2) ? '#fc3' : '#542'; ctx.fillRect(X + TILE + 2, Y + H - 16, TILE - 4, 2);
    // conveyor
    ctx.fillStyle = '#4b4f53'; ctx.fillRect(X + W * 0.6, Y + 26, W * 0.12, 6);
  },
  barracks(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 3, Y + 8, W - 6, H - 12, hgt, '#6f7a5a', '#59614a');
    const rh = H - 12 - hgt;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(X + 3 + i * (W - 6) / 5, Y + 8); ctx.lineTo(X + 3 + i * (W - 6) / 5, Y + 8 + rh); ctx.stroke(); }
    stripe(ctx, X + 3, Y + 8 + rh - 4, W - 6, 3, team.color);
    ctx.fillStyle = '#2a2d2f'; ctx.fillRect(X + W / 2 - 7, Y + H - 4 - hgt + 3, 14, hgt - 3);
    // flag
    ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(X + 8, Y + 10); ctx.lineTo(X + 8, Y - 8); ctx.stroke();
    ctx.fillStyle = team.color;
    const wv = Math.sin(t * 5) * 2;
    ctx.beginPath(); ctx.moveTo(X + 8, Y - 8); ctx.lineTo(X + 20, Y - 6 + wv); ctx.lineTo(X + 8, Y - 2); ctx.fill();
  },
  factory(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 3, Y + 4, W - 6, H - 6, hgt, '#8f969c', '#767c82');
    const rh = H - 6 - hgt;
    // roof ribs
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 6; i++) ctx.fillRect(X + 8 + i * 14, Y + 6, 6, rh - 4);
    stripe(ctx, X + 3, Y + 4 + rh - 5, W - 6, 4, team.color);
    // big door
    ctx.fillStyle = '#26292c'; ctx.fillRect(X + W / 2 - 22, Y + H - 2 - hgt + 3, 44, hgt - 3);
    ctx.strokeStyle = '#d9b234'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(X + W / 2 - 22 + i * 8, Y + H - 2 - hgt + 3); ctx.lineTo(X + W / 2 - 18 + i * 8, Y + H - 2 - hgt + 7); ctx.stroke(); }
    // crane
    ctx.strokeStyle = '#e0b830'; ctx.lineWidth = 3;
    const ca = Math.sin(t * 0.5 + b.anim) * 0.6;
    ctx.beginPath(); ctx.moveTo(X + 16, Y + 16); ctx.lineTo(X + 16 + Math.cos(ca) * 34, Y + 16 + Math.sin(ca) * 14); ctx.stroke();
  },
  radar(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 4, Y + 10, W - 8, H - 14, hgt, ROOF, WALL);
    stripe(ctx, X + 4, Y + 10 + H - 14 - hgt - 4, W - 8, 3, team.color);
    const cx = X + W / 2, cy = Y + 14;
    const a = low ? 0 : t * 1.5;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#666'; ctx.fillRect(-2, 0, 4, 10);
    ctx.scale(Math.cos(a), 1);
    ctx.fillStyle = '#dfe5ea'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a9298'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  dronehub(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 2, Y + 4, W - 4, H - 6, hgt, '#555c62', '#464c51');
    const rh = H - 6 - hgt;
    ctx.strokeStyle = '#e8d24a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X + W / 2, Y + 4 + rh / 2, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = team.color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('D', X + W / 2, Y + 4 + rh / 2 + 1);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      ctx.fillStyle = (Math.floor(t * 3 + i) % 4 === 0 && !low) ? '#4f4' : '#244';
      ctx.beginPath(); ctx.arc(X + W / 2 + Math.cos(a) * 22, Y + 4 + rh / 2 + Math.sin(a) * 18, 2, 0, Math.PI * 2); ctx.fill();
    }
  },
  tech(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 3, Y + 8, W - 6, H - 12, hgt, '#c9ced2', '#9aa0a5');
    const cx = X + W / 2, cy = Y + 18;
    const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 11);
    g.addColorStop(0, '#fff'); g.addColorStop(1, team.color);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (!low && Math.floor(t * 4 + i * 1.3) % 3 === 0) ? '#7ef' : '#355';
      ctx.fillRect(X + 8 + i * 12, Y + H - 4 - hgt + 6, 6, 4);
    }
  },
  super_lance(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 4, Y + 8, W - 8, H - 12, hgt, '#9aa2a8', '#737a80');
    const cx = X + W / 2, cy = Y + H / 2 - 6;
    const tm = b.team !== undefined && G ? G.teams[b.team] : team;
    const charge = tm.superReady ? 1 : Math.min(1, tm.superTimer / BUILDINGS.super_lance.superweapon.charge);
    ctx.fillStyle = '#e3e8ec'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a9298'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = `rgba(90,200,255,${0.4 + 0.6 * charge})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.stroke();
    ctx.fillStyle = tm.superReady ? `rgba(200,240,255,${0.6 + 0.4 * Math.sin(t * 8)})` : '#567';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + t * 0.2;
      ctx.strokeStyle = '#aab'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); ctx.lineTo(cx, cy); ctx.stroke();
    }
    stripe(ctx, X + 4, Y + H - 4 - hgt - 4, W - 8, 3, team.color);
  },
  super_silo(ctx, b, X, Y, W, H, hgt, team, low, t) {
    Render.block(ctx, X + 4, Y + 6, W - 8, H - 10, hgt, '#7d7f74', '#5f6158');
    const tm = b.team !== undefined && G ? G.teams[b.team] : team;
    const charge = tm.superReady ? 1 : Math.min(1, tm.superTimer / BUILDINGS.super_silo.superweapon.charge);
    const cx = X + W / 2, cy = Y + H / 2 - 6;
    ctx.fillStyle = '#2b2d2a'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
    const open = tm.superReady ? 8 : 0;
    ctx.fillStyle = '#8c8f84';
    ctx.fillRect(cx - 20, cy - 20, 20 - open, 40); ctx.fillRect(cx + open, cy - 20, 20 - open, 40);
    ctx.strokeStyle = '#e9c400'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 18, cy - 18); ctx.lineTo(cx - open - 2, cy - 2); ctx.moveTo(cx + 18, cy - 18); ctx.lineTo(cx + open + 2, cy - 2); ctx.stroke();
    if (tm.superReady) { ctx.fillStyle = `rgba(255,80,40,${0.5 + 0.5 * Math.sin(t * 8)})`; ctx.fillRect(cx - open, cy - 18, open * 2, 36); }
    ctx.fillStyle = '#222'; ctx.fillRect(X + 10, Y + H - 12, W - 20, 4);
    ctx.fillStyle = team.color; ctx.fillRect(X + 10, Y + H - 12, (W - 20) * charge, 4);
  },
  turret(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const cx = X + W / 2, cy = Y + H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 4, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a8086'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b6066'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx, cy - 2); ctx.rotate(b.turret);
    ctx.fillStyle = team.color; ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#333'; ctx.fillRect(4, -4, 12, 2); ctx.fillRect(4, 2, 12, 2); ctx.fillRect(4, -1, 13, 2);
    ctx.restore();
  },
  railturret(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const cx = X + W / 2, cy = Y + H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 4, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b7177'; ctx.fillRect(cx - 13, cy - 13, 26, 26);
    ctx.fillStyle = '#868d93'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx, cy - 3); ctx.rotate(b.turret);
    ctx.fillStyle = team.color; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b3f43'; ctx.fillRect(2, -3, 20, 6);
    ctx.fillStyle = low ? '#344' : '#6ef'; for (let i = 0; i < 3; i++) ctx.fillRect(6 + i * 5, -3, 2, 6);
    ctx.restore();
  },
  sam(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const cx = X + W / 2, cy = Y + H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 4, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#707a6a'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx, cy - 2); ctx.rotate(b.turret);
    ctx.fillStyle = team.dark; ctx.fillRect(-8, -9, 14, 18);
    ctx.fillStyle = '#eee';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(-4 + j * 0, -7 + i * 8 + j * 3, 14, 2);
    ctx.fillStyle = '#f44'; ctx.fillRect(9, -7, 2, 2); ctx.fillRect(9, 1, 2, 2);
    ctx.restore();
  },
};

// ---------- per-unit drawing (local coords, origin at unit) ----------
function tracks(ctx, L, Wd, u, color) {
  ctx.fillStyle = '#2a2b2c';
  ctx.fillRect(-L / 2, -Wd / 2, L, 4); ctx.fillRect(-L / 2, Wd / 2 - 4, L, 4);
  ctx.fillStyle = '#4a4b4c';
  const off = u.moving ? (u.anim * 20) % 4 : 0;
  for (let x = -L / 2 + off; x < L / 2; x += 4) { ctx.fillRect(x, -Wd / 2, 1, 4); ctx.fillRect(x, Wd / 2 - 4, 1, 4); }
}
function hull(ctx, L, Wd, team) {
  ctx.fillStyle = team.color;
  ctx.fillRect(-L / 2 + 1, -Wd / 2 + 3, L - 2, Wd - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-L / 2 + 1, Wd / 2 - 6, L - 2, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-L / 2 + 1, -Wd / 2 + 3, L - 2, 2);
}
function infantry(ctx, u, team, extra) {
  const step = u.moving ? Math.sin(u.anim * 12) * 2 : 0;
  ctx.rotate(u.facing);
  ctx.scale(1.3, 1.3);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-2 + step, -3, 3, 2); ctx.fillRect(-2 - step, 1, 3, 2);
  ctx.fillStyle = team.dark; ctx.beginPath(); ctx.arc(-1.5, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = team.color; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill();
  extra && extra();
  ctx.fillStyle = u.key === 'engineer' ? '#f2c230' : '#3c4a35';
  ctx.beginPath(); ctx.arc(0.5, 0, 2.3, 0, Math.PI * 2); ctx.fill();
}

const UNIT_DRAW = {
  rifle(ctx, u, team) {
    infantry(ctx, u, team, () => { ctx.fillStyle = '#222'; ctx.fillRect(1, 1.5, 7, 1.5); });
  },
  rocket(ctx, u, team) {
    infantry(ctx, u, team, () => { ctx.fillStyle = '#556'; ctx.fillRect(-4, -3.5, 11, 2.5); ctx.fillStyle = '#c44'; ctx.fillRect(6, -3.5, 1.5, 2.5); });
  },
  engineer(ctx, u, team) {
    infantry(ctx, u, team, () => { ctx.fillStyle = '#d9c06a'; ctx.fillRect(-5, -2, 3, 4); });
  },
  ifv(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    ctx.fillStyle = '#222';
    for (const x of [-6, 0, 6]) { ctx.fillRect(x - 2, -7, 4, 3); ctx.fillRect(x - 2, 4, 4, 3); }
    ctx.fillStyle = team.color; ctx.beginPath();
    ctx.moveTo(-10, -5); ctx.lineTo(7, -5); ctx.lineTo(11, -2); ctx.lineTo(11, 2); ctx.lineTo(7, 5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-10, 2, 18, 3);
    ctx.restore();
    ctx.save(); ctx.rotate(u.turret);
    ctx.fillStyle = team.dark; ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#ccc'; ctx.fillRect(0, -4, 7, 2.5); ctx.fillRect(0, 1.5, 7, 2.5);
    ctx.restore();
  },
  tank(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    tracks(ctx, 22, 17, u); hull(ctx, 20, 17, team);
    ctx.restore();
    ctx.save(); ctx.rotate(u.turret);
    ctx.fillStyle = '#333'; ctx.fillRect(4, -1.5, 13, 3);
    ctx.fillStyle = team.dark; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = team.color; ctx.beginPath(); ctx.arc(-0.5, -0.5, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  mlrs(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    ctx.fillStyle = '#222';
    for (const x of [-7, -1, 6]) { ctx.fillRect(x - 2, -7, 4, 3); ctx.fillRect(x - 2, 4, 4, 3); }
    ctx.fillStyle = team.color; ctx.fillRect(-11, -5, 22, 10);
    ctx.fillStyle = '#9fd4ff'; ctx.fillRect(7, -4, 3, 8);
    ctx.restore();
    ctx.save(); ctx.rotate(u.turret); ctx.translate(-4, 0);
    ctx.fillStyle = '#4f5a48'; ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = '#222'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(4, -3 + i * 3, 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  railtank(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    tracks(ctx, 24, 18, u);
    ctx.fillStyle = team.color; ctx.beginPath();
    ctx.moveTo(-11, -6); ctx.lineTo(9, -6); ctx.lineTo(12, 0); ctx.lineTo(9, 6); ctx.lineTo(-11, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-11, -6, 20, 2);
    ctx.restore();
    ctx.save(); ctx.rotate(u.turret);
    ctx.fillStyle = '#2f3438'; ctx.fillRect(0, -2.5, 22, 5);
    ctx.fillStyle = '#6ef'; for (let i = 0; i < 4; i++) ctx.fillRect(5 + i * 4, -2.5, 1.5, 5);
    ctx.fillStyle = team.dark; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  titan(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    tracks(ctx, 28, 24, u); ctx.fillStyle = '#2a2b2c'; ctx.fillRect(-14, -12, 28, 6); ctx.fillRect(-14, 6, 28, 6);
    hull(ctx, 26, 22, team);
    ctx.restore();
    ctx.save(); ctx.rotate(u.turret);
    ctx.fillStyle = '#333'; ctx.fillRect(4, -5, 17, 3); ctx.fillRect(4, 2, 17, 3);
    ctx.fillStyle = team.dark; ctx.fillRect(-8, -8, 14, 16);
    ctx.fillStyle = team.color; ctx.fillRect(-7, -7, 11, 14);
    ctx.fillStyle = '#555'; ctx.fillRect(-7, -11, 8, 3); ctx.fillRect(-7, 8, 8, 3);
    ctx.restore();
  },
  harvester(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    tracks(ctx, 26, 20, u);
    ctx.fillStyle = '#b8a35a'; ctx.fillRect(-12, -8, 16, 16);
    const f = u.cargo / u.def.capacity;
    ctx.fillStyle = '#5b4a20'; ctx.fillRect(-11, -7, 14, 14);
    ctx.fillStyle = '#e6b23a'; ctx.fillRect(-11, 7 - 14 * f, 14, 14 * f);
    ctx.fillStyle = team.color; ctx.fillRect(4, -7, 8, 14);
    ctx.fillStyle = '#9fd4ff'; ctx.fillRect(9, -5, 2, 10);
    ctx.fillStyle = '#666'; ctx.fillRect(12, -9, 3, 18);
    if (u.hstate === 'mine') { ctx.fillStyle = '#999'; ctx.fillRect(13 + Math.sin(u.anim * 20), -9, 2, 18); }
    ctx.restore();
  },
  mcv(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    tracks(ctx, 28, 20, u);
    ctx.fillStyle = team.color; ctx.fillRect(-13, -7, 26, 14);
    ctx.fillStyle = '#c3c9ce'; ctx.fillRect(-11, -6, 15, 12);
    ctx.strokeStyle = '#555'; ctx.strokeRect(-11, -6, 15, 12);
    ctx.fillStyle = '#9fd4ff'; ctx.fillRect(8, -5, 3, 10);
    ctx.fillStyle = '#e0b830'; ctx.fillRect(-9, -1, 12, 2);
    ctx.restore();
  },
  drone(ctx, u, team) {
    ctx.rotate(u.facing);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(-7, 7); ctx.lineTo(7, -7); ctx.stroke();
    for (const [x, y] of [[-7, -7], [7, 7], [-7, 7], [7, -7]]) {
      ctx.fillStyle = 'rgba(200,200,200,0.35)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1;
      const a = u.anim * 40;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.lineTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5); ctx.stroke();
    }
    ctx.fillStyle = team.color; ctx.fillRect(-4, -3.5, 9, 7);
    ctx.fillStyle = '#222'; ctx.fillRect(4, -1, 3, 2);
  },
  interceptor(ctx, u, team) {
    ctx.rotate(u.facing);
    ctx.fillStyle = team.dark;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -11); ctx.lineTo(-4, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = team.color;
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fd4ff'; ctx.fillRect(2, -1.5, 5, 3);
    if (u.moving) { ctx.fillStyle = 'rgba(255,180,80,0.8)'; ctx.fillRect(-8, -1.5, 3 + Math.random() * 3, 3); }
  },
};

// Draw an icon for the build sidebar.
function drawIcon(key, team, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c3238'); g.addColorStop(1, '#14181b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const savedG = G;
  if (BUILDINGS[key]) {
    const def = BUILDINGS[key];
    const s = Math.min((w - 6) / (def.w * TILE), (h - 10) / (def.h * TILE + 14), 1.2);
    ctx.save();
    ctx.translate(w / 2 - def.w * TILE * s / 2, h / 2 - (def.h * TILE) * s / 2 + 4 * s);
    ctx.scale(s, s);
    const fake = { key, def, tx: 0, ty: 0, w: def.w, h: def.h, x: def.w * TILE / 2, y: def.h * TILE / 2, hp: 1, maxHp: 1, built: 1, turret: -0.6, anim: 0 };
    const fakeTeam = Object.assign({ superTimer: 200, superReady: false, lowPower: false }, team);
    const fn = BLD_DRAW[key];
    ctx.fillStyle = '#3e3f41'; ctx.fillRect(1, 1, def.w * TILE - 2, def.h * TILE - 2);
    try { G = null; fn(ctx, fake, 0, 0, def.w * TILE, def.h * TILE, def.height, fakeTeam, false, 0.5); } finally { G = savedG; }
    ctx.restore();
  } else {
    const def = UNITS[key];
    const s = Math.min(2.4, (h - 6) / (def.radius * 2.6));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    const fake = { key, def, facing: -0.5, turret: -0.5, anim: 0.3, moving: false, cargo: def.capacity ? def.capacity * 0.6 : 0, alt: 0, air: !!def.air };
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, def.radius, def.radius * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    UNIT_DRAW[key](ctx, fake, team);
    ctx.restore();
  }
  return c;
}
