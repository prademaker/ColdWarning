/* Last Foxhole: draws a Game through the active skin. Weapon effects are built from the skin's
   primitives (disc, line, ring) and are drawn after the lighting pass, so they glow in the dark. */
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
    this.buf = document.createElement('canvas'); this.bctx = this.buf.getContext('2d');
    this.list = [];
  }
  Renderer.prototype.resize = function () {
    var dpr = Math.min(2, root.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.cv.width = Math.max(1, Math.round(r.width * dpr)); this.cv.height = Math.max(1, Math.round(r.height * dpr));
  };
  function arc(g, x, y, R, a0, a1, c, w, alpha) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = c; g.lineCap = 'round';
    g.globalAlpha = alpha * 0.3; g.lineWidth = w * 2.4; g.beginPath(); g.arc(x, y, R, a0, a1); g.stroke();
    g.globalAlpha = alpha; g.lineWidth = w; g.beginPath(); g.arc(x, y, R, a0, a1); g.stroke(); g.restore();
  }
  Renderer.prototype.draw = function (game, skin) {
    var cv = this.cv, ctx = this.ctx, W = cv.width, H = cv.height, p = game.p, t = game.t, col = LL.col, i, j, e, c, k, a;
    var z = Math.min(W / 420, H / 560), VW = W / z, VH = H / z, ps = skin.pixel, g, bw, bh;
    game.view.w = VW; game.view.h = VH;
    var camx = p.x - VW / 2, camy = p.y - VH / 2;
    if (ps > 1) {
      camx = Math.round(camx / ps) * ps; camy = Math.round(camy / ps) * ps;
      bw = Math.ceil(VW / ps); bh = Math.ceil(VH / ps);
      if (this.buf.width !== bw || this.buf.height !== bh) { this.buf.width = bw; this.buf.height = bh; }
      g = this.bctx; g.imageSmoothingEnabled = false; g.setTransform(1 / ps, 0, 0, 1 / ps, -camx / ps, -camy / ps);
    } else { g = ctx; g.setTransform(z, 0, 0, z, -camx * z, -camy * z); }
    var x0 = camx - 70, y0 = camy - 70, x1 = camx + VW + 70, y1 = camy + VH + 70;
    function on(o) { return o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1; }

    skin.ground(g, { x: camx, y: camy, w: VW + ps, h: VH + ps }, t);
    if (!skin.gemsGlow) for (i = 0; i < game.gems.length; i++) if (on(game.gems[i])) skin.gem(g, game.gems[i], t);

    var list = this.list; list.length = 0;
    for (i = 0; i < game.en.length; i++) { e = game.en[i]; if (on(e) && !e.def.flies) list.push(e); }
    list.push(p); list.sort(function (m, n) { return m.y - n.y; });
    for (i = 0; i < list.length; i++) { if (list[i] === p) skin.player(g, p, t); else skin.enemy(g, list[i], t); }
    for (i = 0; i < game.en.length; i++) { e = game.en[i]; if (e.def.flies && on(e)) skin.enemy(g, e, t); }

    if (skin.light) skin.light(g, { x: camx, y: camy, w: VW, h: VH }, p, t, game.en);
    if (skin.gemsGlow) for (i = 0; i < game.gems.length; i++) if (on(game.gems[i])) skin.gem(g, game.gems[i], t);

    /* ---- everything below gives off its own light */
    for (i = 0; i < game.en.length; i++) {
      e = game.en[i]; if (!on(e)) continue;
      if (e.elite) skin.ring(g, e.x, e.y, e.r * 1.25, skin.ui.accent, 2.5, 0.55 + 0.25 * Math.sin(t * 6));
      if (e.slow > 0) skin.ring(g, e.x, e.y, e.r * 0.9, skin.ui.xp, 2, 0.5);
      if (e.tele) skin.line(g, e.x, e.y, e.x + e.cx * 380, e.y + e.cy * 380, skin.ui.hp, 10, 0.35 + 0.3 * Math.sin(t * 30));
    }
    for (i = 0; i < game.zones.length; i++) {
      var zn = game.zones[i], za = Math.min(1, zn.life * 2);
      skin.disc(g, zn.x, zn.y, zn.r * 0.62, col(skin, zn.col), 0.3 * za);
      skin.ring(g, zn.x, zn.y, zn.r * (0.88 + 0.08 * Math.sin(t * 9 + zn.x)), col(skin, zn.col), 3, 0.7 * za);
    }
    for (i = 0; i < game.mines.length; i++) {
      var mn = game.mines[i]; c = col(skin, mn.col);
      skin.disc(g, mn.x, mn.y, 4, c, mn.arm > 0 ? 0.4 : 1);
      if (mn.arm <= 0) for (j = 0; j < 6; j++) { a = j * TAU / 6 + mn.x; skin.line(g, mn.x + Math.cos(a) * 5, mn.y + Math.sin(a) * 5, mn.x + Math.cos(a) * 11, mn.y + Math.sin(a) * 11, c, 2.5, 0.8); }
    }
    for (i = 0; i < game.strikes.length; i++) {
      var sk = game.strikes[i]; k = sk.life / sk.max; c = col(skin, sk.col);
      skin.ring(g, sk.x, sk.y, sk.r * (0.3 + 0.7 * k), c, 2.5, 0.8);
      skin.line(g, sk.x + 90 * k + 30 * k, sk.y - 700 * k - 60 * k, sk.x + 90 * k, sk.y - 700 * k, c, 9, 1);
      skin.disc(g, sk.x + 90 * k, sk.y - 700 * k, 8, c);
    }
    for (i = 0; i < game.picks.length; i++) {
      var pk = game.picks[i]; if (!on(pk)) continue;
      var ic = LL.icon(pk.kind, col(skin, LL.pickCol[pk.kind]), pk.kind === 'coin'), sz = (pk.kind === 'chest' ? 40 : pk.kind === 'coin' ? 18 : 30) * (1 + 0.06 * Math.sin(t * 5 + pk.x));
      if (pk.kind === 'chest') skin.ring(g, pk.x, pk.y, 26 + 4 * Math.sin(t * 4), skin.ui.accent, 3, 0.6);
      g.drawImage(ic, pk.x - sz / 2, pk.y - sz / 2 + Math.sin(t * 3 + pk.y) * 2, sz, sz);
    }
    for (i = 0; i < game.weapons.length; i++) {
      var w = game.weapons[i]; c = col(skin, w.def.col);
      if (w.def.kind === 'aura') skin.ring(g, p.x, p.y, w.s.radius * game.stats.area * (1 + 0.03 * Math.sin(t * 5)), c, 3, 0.55);
      if (w.def.kind !== 'orbit') continue;
      var R = w.s.radius * game.stats.area;
      for (j = 0; j < w.s.count; j++) {
        a = w.ang + j * TAU / w.s.count;
        if (skin.orbiter) { skin.orbiter(g, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, a + Math.PI / 2, w.s.size); if (Math.sin(t * 30 + j) > 0.2) skin.line(g, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, p.x + Math.cos(a + 0.22) * R, p.y + Math.sin(a + 0.22) * R, c, 2, 0.7); }
        else skin.disc(g, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, w.s.size, c);
      }
    }
    for (i = 0; i < game.shots.length; i++) {
      var s = game.shots[i]; c = col(skin, s.col);
      if (s.k === 'bolt') skin.line(g, s.x - s.vx * 0.035, s.y - s.vy * 0.035, s.x, s.y, c, s.r);
      else if (s.k === 'needle' || s.k === 'knife') skin.line(g, s.x - s.vx * 0.022, s.y - s.vy * 0.022, s.x, s.y, c, 3);
      else if (s.k === 'glaive' && skin.runner) skin.runner(g, s, t);
      else if (s.k === 'glaive') { a = t * 14; skin.line(g, s.x - Math.cos(a) * s.r, s.y - Math.sin(a) * s.r, s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, c, 4); skin.ring(g, s.x, s.y, s.r, c, 3); }
      else if (s.k === 'flask') skin.disc(g, s.x, s.y - Math.sin(Math.min(1, s.u) * Math.PI) * 70, s.r, c);
      else if (s.k === 'rocket') { skin.line(g, s.x - s.vx * 0.09, s.y - s.vy * 0.09, s.x, s.y, c, 4, 0.6); skin.disc(g, s.x, s.y, 4, '#fff3c4'); }
      else if (s.k === 'orb') { skin.disc(g, s.x, s.y, s.r, c); skin.ring(g, s.x, s.y, s.r + 3 + Math.sin(t * 20) * 1.5, c, 1.5, 0.7); }
    }
    for (i = 0; i < game.eshots.length; i++) { var q = game.eshots[i]; skin.disc(g, q.x, q.y, q.r + Math.sin(t * 18 + q.x) * 0.8, skin.ui.hp); }
    for (i = 0; i < game.fx.length; i++) {
      var f = game.fx[i]; k = f.life / f.max;
      if (f.k === 'p') skin.disc(g, f.x, f.y, 2 + 3 * k, col(skin, f.col), k);
      else if (f.k === 'r') skin.ring(g, f.x, f.y, f.R * (1 - k * 0.8), col(skin, f.col), 6, k);
      else if (f.k === 'z') skin.line(g, f.x, f.y, f.x2, f.y2, col(skin, f.col), 4, k);
      else if (f.k === 'b') skin.line(g, f.x, f.y, f.x2, f.y2, col(skin, f.col), f.w * (0.4 + 0.6 * k), k);
      else if (f.k === 's') { c = col(skin, f.col); arc(g, f.x, f.y, f.R * (0.9 - 0.25 * k), f.a - f.arc / 2, f.a + f.arc / 2, c, f.R * 0.2, k * 0.8); arc(g, f.x, f.y, f.R * (0.6 - 0.2 * k), f.a - f.arc * 0.4, f.a + f.arc * 0.4, '#ffd9a0', f.R * 0.22, k * 0.7); arc(g, f.x, f.y, f.R * 0.3, f.a - f.arc * 0.3, f.a + f.arc * 0.3, '#fff3c4', f.R * 0.16, k * 0.6); }
    }

    if (ps > 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.buf, 0, 0, bw, bh, 0, 0, bw * ps * z, bh * ps * z); }

    /* ---- screen-space pass: numbers, health bars, edge arrows */
    var u = skin.ui; ctx.setTransform(z, 0, 0, z, -camx * z, -camy * z);
    ctx.font = 'bold 13px ' + u.font; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (i = 0; i < game.fx.length; i++) {
      f = game.fx[i]; if (f.k !== 'n') continue;
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = u.panel; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = u.text; ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = p.inv > 0.5 ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
    var hw = 40, hx = p.x - hw / 2, hy = p.y + p.r + 12;
    ctx.fillStyle = u.track; ctx.fillRect(hx - 1, hy - 1, hw + 2, 7);
    ctx.fillStyle = u.hp; ctx.fillRect(hx, hy, hw * Math.max(0, p.hp / game.stats.maxHp), 5);
    ctx.globalAlpha = 1;
    for (i = 0; i < game.en.length; i++) {
      e = game.en[i]; if (!e.elite || !on(e)) continue;
      ctx.fillStyle = u.track; ctx.fillRect(e.x - 21, e.y - e.r - 13, 42, 6);
      ctx.fillStyle = u.accent; ctx.fillRect(e.x - 20, e.y - e.r - 12, 40 * Math.max(0, e.hp / e.maxHp), 4);
    }
    /* arrows at the screen edge toward the boss and any unopened chest */
    function arrow(o, colr) {
      var dx = o.x - p.x, dy = o.y - p.y, hx2 = VW / 2 - 26, hy2 = VH / 2 - 60;
      if (Math.abs(dx) < hx2 && Math.abs(dy) < hy2) return;
      var sc = Math.min(hx2 / Math.abs(dx || 1e-6), hy2 / Math.abs(dy || 1e-6)), ax = p.x + dx * sc, ay = p.y + dy * sc, an = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.fillStyle = colr; ctx.strokeStyle = u.panel; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (game.boss && !game.boss.dead) arrow(game.boss, u.hp);
    for (i = 0; i < game.picks.length; i++) if (game.picks[i].kind === 'chest') arrow(game.picks[i], u.accent);
  };
  LL.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : this);
