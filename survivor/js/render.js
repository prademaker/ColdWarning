/* Last Lantern: draws a Game through the active skin. Weapon effects are built from the skin's three
   primitives (disc, line, ring), so every weapon works in every art style. */
(function (root) {
  'use strict';
  var LL = root.LL, TAU = Math.PI * 2;

  LL.col = function (skin, k) {
    var u = skin.ui;
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
  Renderer.prototype.draw = function (game, skin) {
    var cv = this.cv, ctx = this.ctx, W = cv.width, H = cv.height, p = game.p, t = game.t, col = LL.col, i;
    var z = Math.min(W / 420, H / 560), VW = W / z, VH = H / z, ps = skin.pixel, g, bw, bh;
    game.view.w = VW; game.view.h = VH;
    var camx = p.x - VW / 2, camy = p.y - VH / 2;
    if (ps > 1) {
      camx = Math.round(camx / ps) * ps; camy = Math.round(camy / ps) * ps;
      bw = Math.ceil(VW / ps); bh = Math.ceil(VH / ps);
      if (this.buf.width !== bw || this.buf.height !== bh) { this.buf.width = bw; this.buf.height = bh; }
      g = this.bctx; g.imageSmoothingEnabled = false; g.setTransform(1 / ps, 0, 0, 1 / ps, -camx / ps, -camy / ps);
    } else { g = ctx; g.setTransform(z, 0, 0, z, -camx * z, -camy * z); }
    var x0 = camx - 60, y0 = camy - 60, x1 = camx + VW + 60, y1 = camy + VH + 60;
    function on(o) { return o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1; }

    skin.ground(g, { x: camx, y: camy, w: VW + ps, h: VH + ps }, t);

    for (i = 0; i < game.zones.length; i++) {
      var zn = game.zones[i], za = Math.min(1, zn.life * 2);
      skin.disc(g, zn.x, zn.y, zn.r, col(skin, zn.col), 0.3 * za);
      skin.ring(g, zn.x, zn.y, zn.r * (0.82 + 0.12 * Math.sin(t * 9 + zn.x)), col(skin, zn.col), 3, 0.7 * za);
    }
    for (i = 0; i < game.weapons.length; i++) {
      var w = game.weapons[i];
      if (w.def.kind === 'aura') skin.ring(g, p.x, p.y, w.s.radius * game.stats.area * (1 + 0.03 * Math.sin(t * 5)), col(skin, w.def.col), 3, 0.55);
    }
    for (i = 0; i < game.gems.length; i++) if (on(game.gems[i])) skin.gem(g, game.gems[i], t);

    var list = this.list; list.length = 0;
    for (i = 0; i < game.en.length; i++) { var e = game.en[i]; if (on(e) && !e.def.flies) list.push(e); }
    list.push(p); list.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < list.length; i++) { if (list[i] === p) skin.player(g, p, t); else skin.enemy(g, list[i], t); }
    for (i = 0; i < game.en.length; i++) { e = game.en[i]; if (e.def.flies && on(e)) skin.enemy(g, e, t); }

    for (i = 0; i < game.weapons.length; i++) {
      w = game.weapons[i];
      if (w.def.kind !== 'orbit') continue;
      var R = w.s.radius * game.stats.area;
      for (var j = 0; j < w.s.count; j++) { var a = w.ang + j * TAU / w.s.count; skin.disc(g, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, w.s.size, col(skin, w.def.col)); }
    }
    for (i = 0; i < game.shots.length; i++) {
      var s = game.shots[i], c = col(skin, s.col);
      if (s.k === 'bolt') skin.line(g, s.x - s.vx * 0.035, s.y - s.vy * 0.035, s.x, s.y, c, s.r);
      else if (s.k === 'needle') skin.line(g, s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.x, s.y, c, 3);
      else if (s.k === 'glaive') { var sa = t * 14; skin.line(g, s.x - Math.cos(sa) * s.r, s.y - Math.sin(sa) * s.r, s.x + Math.cos(sa) * s.r, s.y + Math.sin(sa) * s.r, c, 4); skin.ring(g, s.x, s.y, s.r, c, 3); }
      else if (s.k === 'flask') skin.disc(g, s.x, s.y - Math.sin(Math.min(1, s.u) * Math.PI) * 70, s.r, c);
    }
    for (i = 0; i < game.fx.length; i++) {
      var f = game.fx[i], k = f.life / f.max;
      if (f.k === 'p') skin.disc(g, f.x, f.y, 2 + 3 * k, col(skin, f.col), k);
      else if (f.k === 'r') skin.ring(g, f.x, f.y, f.R * (1 - k * 0.8), col(skin, f.col), 6, k);
      else if (f.k === 'z') skin.line(g, f.x, f.y, f.x2, f.y2, col(skin, f.col), 4, k);
    }

    if (ps > 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.buf, 0, 0, bw, bh, 0, 0, bw * ps * z, bh * ps * z); }

    /* screen-space pass: crisp in every skin */
    var u = skin.ui; ctx.setTransform(z, 0, 0, z, -camx * z, -camy * z);
    ctx.font = 'bold 13px ' + u.font; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (i = 0; i < game.fx.length; i++) {
      f = game.fx[i]; if (f.k !== 'n') continue;
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = u.panel; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = u.text; ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    var hw = 40, hx = p.x - hw / 2, hy = p.y + p.r + 12;
    ctx.fillStyle = u.track; ctx.fillRect(hx - 1, hy - 1, hw + 2, 7);
    ctx.fillStyle = u.hp; ctx.fillRect(hx, hy, hw * Math.max(0, p.hp / game.stats.maxHp), 5);
    for (i = 0; i < game.en.length; i++) {
      e = game.en[i]; if (!e.def.boss) continue;
      ctx.fillStyle = u.track; ctx.fillRect(e.x - 41, e.y - e.r - 21, 82, 8);
      ctx.fillStyle = u.hp; ctx.fillRect(e.x - 40, e.y - e.r - 20, 80 * Math.max(0, e.hp / (e.maxHp || (e.maxHp = e.hp))), 6);
    }
  };
  LL.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : this);
