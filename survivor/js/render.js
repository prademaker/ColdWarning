/* Last Foxhole: draws a Game. Order matters: ground, stains and bodies, the living, things in the air,
   then the lighting pass, then everything that gives off its own light (tracers, fire, explosions). */
(function (root) {
  'use strict';
  var LL = root.LL, TAU = Math.PI * 2;

  LL.col = function (skin, k) {
    var u = skin.ui;
    if (k[0] === '#') return k;
    if (k === 'accent') return u.accent; if (k === 'xp') return u.xp; if (k === 'hp') return u.hp;
    return k[0] === 't' ? skin.tints[+k[1]] : skin.gemTints[+k[1]];
  };

  function Renderer(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.list = [];
  }
  Renderer.prototype.resize = function () {
    var dpr = Math.min(2, root.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.cv.width = Math.max(1, Math.round(r.width * dpr)); this.cv.height = Math.max(1, Math.round(r.height * dpr));
  };

  /* soft sprites for fire, smoke and gas, painted once */
  var tex = null;
  function puff(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (var i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  function makeTex() {
    tex = {
      fire: puff([0, '#fff7d0', 0.22, '#ffc24a', 0.55, 'rgba(255,96,24,.6)', 1, 'rgba(120,20,0,0)']),
      smoke: puff([0, 'rgba(78,74,68,.6)', 0.6, 'rgba(60,58,54,.32)', 1, 'rgba(50,48,46,0)']),
      gas: puff([0, 'rgba(168,182,104,.5)', 0.6, 'rgba(140,158,90,.26)', 1, 'rgba(120,140,80,0)'])
    };
  }
  function stamp(g, img, x, y, size, alpha, add) {
    if (alpha <= 0) return;
    g.globalAlpha = Math.min(1, alpha); if (add) g.globalCompositeOperation = 'lighter';
    g.drawImage(img, x - size / 2, y - size / 2, size, size);
    g.globalAlpha = 1; if (add) g.globalCompositeOperation = 'source-over';
  }
  /* a bullet in flight: a short hot streak, not a glowing ball */
  function tracer(g, x, y, vx, vy, len, c, w) {
    var sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp;
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    g.strokeStyle = c; g.globalAlpha = 0.4; g.lineWidth = w * 2.6; g.beginPath(); g.moveTo(x - ux * len, y - uy * len); g.lineTo(x, y); g.stroke();
    g.strokeStyle = '#fff6d8'; g.globalAlpha = 1; g.lineWidth = w; g.beginPath(); g.moveTo(x - ux * len * 0.5, y - uy * len * 0.5); g.lineTo(x, y); g.stroke();
    g.restore();
  }
  function streak(g, x1, y1, x2, y2, c, w, alpha, add) {
    g.save(); if (add) g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha; g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
  }

  Renderer.prototype.draw = function (game, skin) {
    if (!tex) makeTex();
    var cv = this.cv, g = this.ctx, W = cv.width, H = cv.height, p = game.p, t = game.t, col = LL.col, i, j, e, c, k, a, q, s;
    var z = Math.min(W / 420, H / 560), VW = W / z, VH = H / z;
    game.view.w = VW; game.view.h = VH;
    var camx = p.x - VW / 2, camy = p.y - VH / 2;
    g.setTransform(z, 0, 0, z, -camx * z, -camy * z);
    var x0 = camx - 70, y0 = camy - 70, x1 = camx + VW + 70, y1 = camy + VH + 70;
    function on(o) { return o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1; }

    skin.ground(g, { x: camx, y: camy, w: VW + 1, h: VH + 1 }, t);

    /* ---- on the ground: blood, scorch marks, the dead, wrecks, mines */
    for (i = 0; i < game.decals.length; i++) if (on(game.decals[i])) skin.decal(g, game.decals[i]);
    for (i = 0; i < game.mines.length; i++) {
      var mn = game.mines[i]; if (!on(mn)) continue;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(mn.x + 1, mn.y + 1.5, 6, 0, TAU); g.fill();
      g.fillStyle = '#2b2c24'; g.beginPath(); g.arc(mn.x, mn.y, 5.5, 0, TAU); g.fill(); g.strokeStyle = '#6f6e52'; g.lineWidth = 1; g.stroke();
      g.fillStyle = mn.arm > 0 ? '#55543f' : '#9a9870'; g.beginPath(); g.arc(mn.x, mn.y, 1.8, 0, TAU); g.fill();
    }

    /* ---- the living */
    var list = this.list; list.length = 0;
    for (i = 0; i < game.en.length; i++) { e = game.en[i]; if (on(e)) list.push(e); }
    list.push(p); list.sort(function (m, n) { return (m.r - n.r) || (m.y - n.y); });
    for (i = 0; i < list.length; i++) { if (list[i] === p) skin.player(g, p, t); else skin.enemy(g, list[i], t); }

    /* ---- in the air, but not glowing: blood, dirt, brass, smoke, shrapnel */
    for (i = 0; i < game.parts.length; i++) {
      q = game.parts[i]; k = q.life / q.max;
      if (q.k === 'blood') { g.fillStyle = '#860d0d'; g.beginPath(); g.arc(q.x, q.y, q.r * (0.6 + 0.4 * k), 0, TAU); g.fill(); }
      else if (q.k === 'gib') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot + t * q.vr); g.fillStyle = '#5c0a0a'; g.fillRect(-q.r, -q.r * 0.6, q.r * 2, q.r * 1.2); g.fillStyle = '#8f1b1b'; g.fillRect(-q.r * 0.5, -q.r * 0.3, q.r, q.r * 0.6); g.restore(); }
      else if (q.k === 'dirt') { g.fillStyle = '#241c13'; g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); g.fill(); }
      else if (q.k === 'case') { g.save(); g.translate(q.x, q.y); g.rotate(q.x * 0.3); g.fillStyle = '#d0a94e'; g.fillRect(-1.6, -0.8, 3.2, 1.6); g.restore(); }
      else if (q.k === 'smoke') stamp(g, tex.smoke, q.x, q.y, q.r * 2 * (1 + (1 - k) * 1.3), k * 0.75);
      else if (q.k === 'gas') stamp(g, tex.gas, q.x, q.y, q.r * 2 * (0.6 + (1 - k) * 0.9), Math.min(1, k * 2) * 0.85);
    }
    for (i = 0; i < game.shots.length; i++) {
      s = game.shots[i];
      if (s.k === 'needle') streak(g, s.x - s.vx * 0.014, s.y - s.vy * 0.014, s.x, s.y, '#c3c7cb', 1.7, 1);
      else if (s.k === 'glaive') skin.runner(g, s, t);
    }
    for (i = 0; i < game.weapons.length; i++) {
      var w = game.weapons[i]; if (w.def.kind !== 'orbit') continue;
      var R = w.s.radius * game.stats.area;
      for (j = 0; j < w.s.count; j++) { a = w.ang + j * TAU / w.s.count; skin.orbiter(g, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, a + Math.PI / 2, w.s.size); }
    }

    skin.light(g, { x: camx, y: camy, w: VW, h: VH }, p, t, game.en);

    /* ---- everything below gives off its own light */
    for (i = 0; i < game.gems.length; i++) if (on(game.gems[i])) skin.gem(g, game.gems[i], t);
    for (i = 0; i < game.en.length; i++) {
      e = game.en[i]; if (!on(e)) continue;
      if (e.elite) skin.ring(g, e.x, e.y, e.r * 1.25, skin.ui.accent, 2.5, 0.55 + 0.25 * Math.sin(t * 6));
      if (e.tele) skin.line(g, e.x, e.y, e.x + e.cx * 380, e.y + e.cy * 380, skin.ui.hp, 10, 0.35 + 0.3 * Math.sin(t * 30));
    }
    for (i = 0; i < game.zones.length; i++) {   /* burning pools */
      var zn = game.zones[i], za = Math.min(1, zn.life * 2);
      stamp(g, tex.fire, zn.x, zn.y, zn.r * 2.3, 0.3 * za, true);
      for (j = 0; j < 7; j++) {
        a = j * 2.4 + zn.x; k = zn.r * (0.12 + 0.62 * ((j * 0.37 + zn.y * 0.01) % 1));
        stamp(g, tex.fire, zn.x + Math.cos(a) * k, zn.y + Math.sin(a) * k - 3, zn.r * (0.55 + 0.22 * Math.sin(t * 13 + j * 2.1)), 0.8 * za, true);
      }
    }
    for (i = 0; i < game.strikes.length; i++) {   /* a shell on its way down */
      var sk = game.strikes[i]; k = sk.life / sk.max;
      g.save(); g.setLineDash([5, 6]); g.strokeStyle = 'rgba(255,240,210,' + (0.5 - 0.25 * k) + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(sk.x, sk.y, sk.r, 0, TAU); g.stroke(); g.restore();
      g.fillStyle = 'rgba(0,0,0,' + (0.45 * (1 - k)) + ')'; g.beginPath(); g.ellipse(sk.x, sk.y, 9 * (1.6 - k), 5 * (1.6 - k), 0, 0, TAU); g.fill();
      g.save(); g.translate(sk.x + 70 * k, sk.y - 640 * k); g.rotate(1.68);
      g.fillStyle = '#9a9d94'; g.beginPath(); g.ellipse(0, 0, 8, 3.2, 0, 0, TAU); g.fill(); g.fillStyle = '#5a5c56'; g.fillRect(-11, -3.2, 4, 6.4); g.restore();
    }
    for (i = 0; i < game.picks.length; i++) {
      var pk = game.picks[i]; if (!on(pk)) continue;
      var ic = LL.icon(pk.kind, col(skin, LL.pickCol[pk.kind]), pk.kind === 'coin'), sz = (pk.kind === 'chest' ? 40 : pk.kind === 'coin' ? 18 : 30) * (1 + 0.06 * Math.sin(t * 5 + pk.x));
      if (pk.kind === 'chest') skin.ring(g, pk.x, pk.y, 26 + 4 * Math.sin(t * 4), skin.ui.accent, 3, 0.6);
      g.drawImage(ic, pk.x - sz / 2, pk.y - sz / 2 + Math.sin(t * 3 + pk.y) * 2, sz, sz);
    }
    for (i = 0; i < game.weapons.length; i++) {   /* fighters strafing */
      w = game.weapons[i]; if (w.def.kind !== 'orbit') continue;
      R = w.s.radius * game.stats.area;
      for (j = 0; j < w.s.count; j++) {
        a = w.ang + j * TAU / w.s.count;
        if (Math.sin(t * 34 + j * 2) > 0.1) tracer(g, p.x + Math.cos(a + 0.32) * R, p.y + Math.sin(a + 0.32) * R, -Math.sin(a), Math.cos(a), 9, '#ffd27a', 1.2);
      }
    }
    for (i = 0; i < game.shots.length; i++) {
      s = game.shots[i]; c = col(skin, s.col);
      if (s.k === 'bolt') tracer(g, s.x, s.y, s.vx, s.vy, 18, '#ffb84a', 1.7);
      else if (s.k === 'knife') tracer(g, s.x, s.y, s.vx, s.vy, 8, '#ffb84a', 1.2);
      else if (s.k === 'orb') tracer(g, s.x, s.y, s.vx, s.vy, 13, '#cfe0ff', 1.9);
      else if (s.k === 'flask') {
        g.save(); g.translate(s.x, s.y - Math.sin(Math.min(1, s.u) * Math.PI) * 70); g.rotate(t * 13);
        g.fillStyle = '#4d5a2c'; g.fillRect(-4, -2.4, 7, 4.8); g.fillStyle = '#6d7a44'; g.fillRect(3, -1.1, 3.5, 2.2); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-3, -2, 5, 1);
        stamp(g, tex.fire, 8, 0, 11, 1, true); g.restore();
      } else if (s.k === 'rocket') {
        g.save(); g.translate(s.x, s.y); g.rotate(Math.atan2(s.vy, s.vx));
        stamp(g, tex.fire, -11, 0, 13 + Math.sin(t * 40) * 3, 1, true);
        g.fillStyle = '#56633a'; g.fillRect(-7, -2, 11, 4); g.fillStyle = '#2f3327'; g.beginPath(); g.moveTo(4, -2); g.lineTo(9, 0); g.lineTo(4, 2); g.closePath(); g.fill();
        g.fillRect(-8, -3.6, 3, 7.2); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-6, -2, 9, 1); g.restore();
      }
    }
    for (i = 0; i < game.eshots.length; i++) {   /* incoming fire is red so it reads at a glance */
      q = game.eshots[i]; tracer(g, q.x, q.y, q.vx, q.vy, 13, '#ff4a2a', 2.4);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.fillStyle = '#ff4a2a'; g.beginPath(); g.arc(q.x, q.y, 4.5, 0, TAU); g.fill(); g.restore();
    }
    for (i = 0; i < game.parts.length; i++) {
      q = game.parts[i]; k = q.life / q.max;
      if (q.k === 'flame') stamp(g, tex.fire, q.x, q.y, q.r * 2 * (1 + (1 - k) * 2), k * 0.9, true);
      else if (q.k === 'spark') streak(g, q.x - q.vx * 0.02, q.y - q.vy * 0.02, q.x, q.y, '#ffd9a0', 1.3, k, true);
      else if (q.k === 'muzzle') { stamp(g, tex.fire, q.x, q.y, 24, 1, true); streak(g, q.x, q.y, q.x + Math.cos(q.a) * 15, q.y + Math.sin(q.a) * 15, '#fff3c4', 3, 0.9, true); }
      else if (q.k === 'boom') { stamp(g, tex.fire, q.x, q.y, q.r * 2 * (0.55 + 0.75 * (1 - k)), Math.sqrt(k), true); if (k > 0.6) stamp(g, tex.fire, q.x, q.y, q.r * 1.1, 1, true); }
      else if (q.k === 'smoke' && q.fire) stamp(g, tex.fire, q.x, q.y + 4, q.r * 1.2, k * 0.8, true);
    }
    for (i = 0; i < game.fx.length; i++) {
      var f = game.fx[i]; k = f.life / f.max;
      if (f.k === 'r') skin.ring(g, f.x, f.y, f.R * (1 - k * 0.8), '#fff3d6', 4, k * 0.7);
      else if (f.k === 'z') { streak(g, f.x, f.y, f.x2, f.y2, '#ffb84a', 3.4, k * 0.35, true); streak(g, f.x, f.y, f.x2, f.y2, '#fff6d8', 1.2, k, true); }
      else if (f.k === 'b') { streak(g, f.x, f.y, f.x2, f.y2, '#b9b6aa', f.w * 0.45, k * 0.3, false); if (k > 0.45) streak(g, f.x, f.y, f.x2, f.y2, '#fffbe8', 2.2, (k - 0.45) * 1.8, true); }
      else if (f.k === 'sl') { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#e8eef2'; g.lineCap = 'round'; g.globalAlpha = k; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, f.R * 0.8, f.a, f.a + 1.3); g.stroke(); g.globalAlpha = k * 0.5; g.beginPath(); g.arc(p.x, p.y, f.R * 0.55, f.a + 0.2, f.a + 1.1); g.stroke(); g.restore(); }
    }

    /* ---- numbers, health bars, edge arrows */
    var u = skin.ui;
    g.font = 'bold 13px ' + u.font; g.textAlign = 'center'; g.lineJoin = 'round';
    for (i = 0; i < game.fx.length; i++) {
      f = game.fx[i]; if (f.k !== 'n') continue;
      g.globalAlpha = Math.min(1, f.life / f.max * 2);
      g.lineWidth = 3; g.strokeStyle = u.panel; g.strokeText(f.txt, f.x, f.y); g.fillStyle = typeof f.txt === 'string' ? u.accent : u.text; g.fillText(f.txt, f.x, f.y);
    }
    g.globalAlpha = p.inv > 0.5 ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
    var hw = 40, hx = p.x - hw / 2, hy = p.y + p.r + 12;
    g.fillStyle = u.track; g.fillRect(hx - 1, hy - 1, hw + 2, 7);
    g.fillStyle = u.hp; g.fillRect(hx, hy, hw * Math.max(0, p.hp / game.stats.maxHp), 5);
    g.globalAlpha = 1;
    for (i = 0; i < game.en.length; i++) {
      e = game.en[i]; if (!e.elite || !on(e)) continue;
      g.fillStyle = u.track; g.fillRect(e.x - 21, e.y - e.r - 13, 42, 6);
      g.fillStyle = u.accent; g.fillRect(e.x - 20, e.y - e.r - 12, 40 * Math.max(0, e.hp / e.maxHp), 4);
    }
    function arrow(o, colr) {
      var dx = o.x - p.x, dy = o.y - p.y, hx2 = VW / 2 - 26, hy2 = VH / 2 - 60;
      if (Math.abs(dx) < hx2 && Math.abs(dy) < hy2) return;
      var sc = Math.min(hx2 / Math.abs(dx || 1e-6), hy2 / Math.abs(dy || 1e-6)), ax = p.x + dx * sc, ay = p.y + dy * sc, an = Math.atan2(dy, dx);
      g.save(); g.translate(ax, ay); g.rotate(an); g.fillStyle = colr; g.strokeStyle = u.panel; g.lineWidth = 2;
      g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, -9); g.lineTo(-3, 0); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    if (game.boss && !game.boss.dead) arrow(game.boss, u.hp);
    for (i = 0; i < game.picks.length; i++) if (game.picks[i].kind === 'chest') arrow(game.picks[i], u.accent);
  };
  LL.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : this);
