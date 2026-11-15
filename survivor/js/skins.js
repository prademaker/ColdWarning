/* Last Foxhole: the art. Everything is painted in code, so the app ships no third-party artwork.
   Style: top-down, shaded, a night battlefield lit by the flare light around the player.
   Sprites are painted once into offscreen canvases facing +x with the light on their front; since every
   enemy faces the player, rotating the sprite toward the player keeps the lighting correct for free.
   No real-world insignia or emblems are drawn anywhere. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2, RS = 2, TILE = 384;

  function hash(x, y) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function tiles(v, s, fn) {
    var x0 = Math.floor(v.x / s), y0 = Math.floor(v.y / s), x1 = Math.floor((v.x + v.w) / s), y1 = Math.floor((v.y + v.h) / s);
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) fn(i, j, i * s, j * s);
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f <= 1) { r *= f; g *= f; b *= f; } else { var k = f - 1; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return '#' + ((1 << 24) | ((r | 0) << 16) | ((g | 0) << 8) | (b | 0)).toString(16).slice(1);
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function lit(g, cx, cy, rad, tint) {
    var gr = g.createRadialGradient(cx + rad * 0.5, cy, rad * 0.05, cx, cy, rad * 1.1);
    gr.addColorStop(0, shade(tint, 1.5)); gr.addColorStop(0.4, tint); gr.addColorStop(1, shade(tint, 0.22)); return gr;
  }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function seg(g, x1, y1, x2, y2, w, c) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function box(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function edge(g, w) { g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = w || 0.05; g.stroke(); }
  function lamp(g, x, y, r) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, 'rgba(255,236,170,.9)'); gr.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = gr; ell(g, x, y, r * 3, r * 3); g.fill(); g.fillStyle = '#fff3c4'; ell(g, x, y, r, r); g.fill();
  }

  /* ---------------------------------------------------------------- bodies, in units of the body radius, facing +x */
  function soldier(g, tint, f, o) {
    o = o || {};
    var gun = o.gun || 1.25, gw = o.gunW || 0.1, pack = o.pack == null ? 1 : o.pack;
    g.lineCap = 'round';
    g.fillStyle = '#191712'; ell(g, f ? 0.28 : -0.3, -0.3, 0.3, 0.17); g.fill(); ell(g, f ? -0.3 : 0.28, 0.3, 0.3, 0.17); g.fill();
    if (o.ghillie) { g.fillStyle = shade(tint, 0.6); for (var i = 0; i < 9; i++) { ell(g, -0.55 + Math.cos(i * 2.1) * 0.35, Math.sin(i * 1.7) * 0.75, 0.3, 0.2, i); g.fill(); } }
    if (o.tanks) { for (var k = -1; k <= 1; k += 2) { ell(g, -0.62, k * 0.3, 0.42, 0.25); g.fillStyle = lit(g, -0.62, k * 0.3, 0.42, '#7a7f84'); g.fill(); edge(g); } }
    else if (pack) { box(g, -0.78, -0.42 * pack, 0.42, 0.84 * pack, 0.1); g.fillStyle = shade(tint, 0.55); g.fill(); edge(g); }
    seg(g, 0.1, 0.2, gun, 0.14, gw, '#2a2017'); seg(g, gun - 0.32, 0.14, gun, 0.14, gw * 0.6, '#77777a');
    if (o.gunW > 0.14) { seg(g, gun - 0.35, 0.14, gun - 0.2, 0.42, 0.05, '#2a2017'); seg(g, gun - 0.35, 0.14, gun - 0.2, -0.14, 0.05, '#2a2017'); }
    ell(g, 0, 0, 0.42, 0.8); g.fillStyle = lit(g, 0, 0, 0.8, tint); g.fill(); edge(g);
    if (o.belt) { g.setLineDash([0.08, 0.08]); seg(g, -0.2, -0.7, 0.25, 0.7, 0.12, '#c9a24a'); g.setLineDash([]); }
    seg(g, 0.02, 0.62, 0.5, 0.24, 0.24, shade(tint, 0.8)); seg(g, 0.02, -0.62, 0.62, 0.08, 0.24, shade(tint, 0.8));
    g.fillStyle = '#c9a27e'; ell(g, 0.52, 0.24, 0.1, 0.1); g.fill(); ell(g, 0.64, 0.08, 0.1, 0.1); g.fill();
    ell(g, 0.1, 0, 0.4, 0.4); g.fillStyle = lit(g, 0.1, 0, 0.4, o.helmet || shade(tint, 0.78)); g.fill(); edge(g);
    if (o.cap) { ell(g, 0.36, 0, 0.2, 0.3); g.fillStyle = shade(o.helmet || tint, 0.5); g.fill(); }
    if (o.band) { g.strokeStyle = o.band; g.lineWidth = 0.1; g.lineCap = 'butt'; g.beginPath(); g.arc(0.1, 0, 0.29, 0, TAU); g.stroke(); g.lineCap = 'round'; }
    g.fillStyle = 'rgba(255,255,255,.22)'; ell(g, 0.3, -0.13, 0.1, 0.06, -0.5); g.fill();
    if (o.pilot) lamp(g, gun + 0.06, 0.14, 0.05);
  }
  var BODY = {
    soldier: soldier,
    dog: function (g, tint, f) {
      g.lineCap = 'round';
      var s = f ? 0.2 : -0.2;
      seg(g, 0.4, 0.2, 0.62 + s, 0.52, 0.13, shade(tint, 0.55)); seg(g, 0.4, -0.2, 0.62 - s, -0.52, 0.13, shade(tint, 0.55));
      seg(g, -0.55, 0.2, -0.75 - s, 0.52, 0.13, shade(tint, 0.55)); seg(g, -0.55, -0.2, -0.75 + s, -0.52, 0.13, shade(tint, 0.55));
      seg(g, -0.85, 0, -1.3, f ? 0.22 : -0.22, 0.1, shade(tint, 0.7));
      ell(g, -0.1, 0, 0.82, 0.34); g.fillStyle = lit(g, -0.1, 0, 0.82, tint); g.fill(); edge(g);
      g.fillStyle = 'rgba(0,0,0,.28)'; ell(g, -0.3, 0, 0.45, 0.2); g.fill();
      for (var k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(0.55, k * 0.14); g.lineTo(0.5, k * 0.4); g.lineTo(0.78, k * 0.2); g.closePath(); g.fillStyle = shade(tint, 0.5); g.fill(); }
      ell(g, 0.78, 0, 0.3, 0.24); g.fillStyle = lit(g, 0.78, 0, 0.3, shade(tint, 1.1)); g.fill(); edge(g, 0.04);
      ell(g, 1.05, 0, 0.17, 0.12); g.fillStyle = shade(tint, 0.4); g.fill();
    },
    bike: function (g, tint, f) {
      g.lineCap = 'round';
      seg(g, 0.7, 0, 1.2, 0, 0.2, '#131210'); seg(g, -1.2, 0, -0.65, 0, 0.24, '#131210');
      box(g, -0.75, -0.2, 1.5, 0.4, 0.15); g.fillStyle = lit(g, 0, 0, 0.8, '#3a3d40'); g.fill(); edge(g);
      seg(g, 0.6, -0.5, 0.6, 0.5, 0.08, '#1a1a1a');
      seg(g, -0.05, 0.5, 0.58, 0.44, 0.2, shade(tint, 0.8)); seg(g, -0.05, -0.5, 0.58, -0.44, 0.2, shade(tint, 0.8));
      ell(g, -0.15, 0, 0.32, 0.58); g.fillStyle = lit(g, -0.15, 0, 0.58, tint); g.fill(); edge(g);
      ell(g, 0.02, 0, 0.29, 0.29); g.fillStyle = lit(g, 0.02, 0, 0.29, shade(tint, 0.7)); g.fill(); edge(g);
      g.fillStyle = 'rgba(180,170,150,' + (f ? 0.25 : 0.12) + ')'; ell(g, -1.45, 0, 0.3, 0.18); g.fill();
      lamp(g, 1.0, 0, 0.07);
    },
    tank: function (g, tint, f, o) {
      var k, i; o = o || {};
      for (k = -1; k <= 1; k += 2) {
        box(g, -1.08, k * 0.78 - 0.17, 2.16, 0.34, 0.1); g.fillStyle = '#16150f'; g.fill();
        g.strokeStyle = 'rgba(140,130,110,.4)'; g.lineWidth = 0.035; g.beginPath();
        for (i = 0; i < 11; i++) { var tx = -1.0 + i * 0.2 + (f ? 0.1 : 0); if (tx < 1.02) { g.moveTo(tx, k * 0.78 - 0.15); g.lineTo(tx, k * 0.78 + 0.15); } }
        g.stroke();
      }
      box(g, -0.98, -0.64, 1.96, 1.28, 0.12); g.fillStyle = lit(g, 0, 0, 1.25, tint); g.fill(); edge(g, 0.06);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.04; g.beginPath(); for (i = 0; i < 4; i++) { g.moveTo(-0.88 + i * 0.09, -0.4); g.lineTo(-0.88 + i * 0.09, 0.4); } g.stroke();
      g.fillStyle = 'rgba(0,0,0,.22)'; box(g, 0.55, -0.5, 0.36, 1.0, 0.06); g.fill();
      if (o.twin) { for (k = -1; k <= 1; k += 2) { box(g, 0.25, k * 0.2 - 0.07, 1.25, 0.14, 0.03); g.fillStyle = lit(g, 0.9, k * 0.2, 0.9, '#4a4c48'); g.fill(); edge(g, 0.03); } }
      else { box(g, 0.25, -0.08, 1.3, 0.16, 0.03); g.fillStyle = lit(g, 0.9, 0, 0.9, '#4a4c48'); g.fill(); edge(g, 0.03); box(g, 1.42, -0.12, 0.2, 0.24, 0.03); g.fillStyle = '#2c2d2a'; g.fill(); }
      ell(g, -0.08, 0, 0.52, 0.5); g.fillStyle = lit(g, -0.08, 0, 0.52, shade(tint, 1.12)); g.fill(); edge(g, 0.06);
      ell(g, -0.2, -0.16, 0.15, 0.15); g.fillStyle = shade(tint, 0.6); g.fill(); edge(g, 0.03);
      g.fillStyle = 'rgba(255,255,255,.16)'; ell(g, 0.16, -0.22, 0.2, 0.08, -0.4); g.fill();
      lamp(g, 0.98, -0.5, 0.035); lamp(g, 0.98, 0.5, 0.035);
    },
    truck: function (g, tint, f) {
      var k, i;
      for (k = -1; k <= 1; k += 2) {
        box(g, -1.2, k * 0.74 - 0.15, 1.35, 0.3, 0.1); g.fillStyle = '#16150f'; g.fill();
        g.strokeStyle = 'rgba(140,130,110,.4)'; g.lineWidth = 0.035; g.beginPath(); for (i = 0; i < 7; i++) { var tx = -1.12 + i * 0.19 + (f ? 0.09 : 0); g.moveTo(tx, k * 0.74 - 0.13); g.lineTo(tx, k * 0.74 + 0.13); } g.stroke();
        box(g, 0.88, k * 0.66 - 0.12, 0.42, 0.24, 0.08); g.fillStyle = '#131210'; g.fill();
      }
      box(g, -1.25, -0.62, 1.6, 1.24, 0.08); g.fillStyle = lit(g, -0.4, 0, 1.2, shade(tint, 1.15)); g.fill(); edge(g, 0.05);
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.05; g.beginPath(); for (i = 0; i < 4; i++) { g.moveTo(-1.0 + i * 0.36, -0.6); g.lineTo(-1.0 + i * 0.36, 0.6); } g.stroke();
      box(g, 0.35, -0.55, 0.6, 1.1, 0.1); g.fillStyle = lit(g, 0.6, 0, 0.7, tint); g.fill(); edge(g, 0.05);
      g.fillStyle = 'rgba(20,30,36,.8)'; box(g, 0.78, -0.42, 0.12, 0.84, 0.03); g.fill();
      box(g, 0.95, -0.42, 0.5, 0.84, 0.1); g.fillStyle = lit(g, 1.2, 0, 0.6, shade(tint, 0.85)); g.fill(); edge(g, 0.05);
      lamp(g, 1.42, -0.33, 0.04); lamp(g, 1.42, 0.33, 0.04);
    },
    plane: function (g, tint) {
      ell(g, 0.12, 0, 0.3, 1.05); g.fillStyle = lit(g, 0.12, 0, 1.0, tint); g.fill(); edge(g, 0.05);
      ell(g, -0.85, 0, 0.14, 0.4); g.fillStyle = shade(tint, 0.8); g.fill(); edge(g, 0.04);
      ell(g, 0, 0, 1.05, 0.17); g.fillStyle = lit(g, 0, 0, 1.0, shade(tint, 1.1)); g.fill(); edge(g, 0.05);
      ell(g, 0.2, 0, 0.2, 0.1); g.fillStyle = 'rgba(160,200,220,.7)'; g.fill();
      g.fillStyle = 'rgba(220,220,220,.25)'; ell(g, 1.06, 0, 0.05, 0.42); g.fill();
    }
  };
  /* how each thing in the game is drawn: body + options. Keys are class ids and enemy tint slots. */
  var HERO = {
    rifleman: { tint: '#5d6b3a' },
    gunner: { tint: '#56633a', gun: 1.45, gunW: 0.17, belt: true },
    medic: { tint: '#66704a', helmet: '#d9d6c8', band: '#3f8f4f', gun: 0.9, pack: 1.2 },
    sapper: { tint: '#6b6238', pack: 1.45, gun: 1.0 },
    sniper: { tint: '#3f4d2c', helmet: '#34401f', gun: 1.65, gunW: 0.08, ghillie: true, pack: 0 },
    flamer: { tint: '#5a5a3c', tanks: true, gun: 1.0, gunW: 0.14, pilot: true }
  };
  var LOOK = { 3: { cap: true, helmet: '#8a7a4a', gun: 0.9, pack: 0 }, 6: { gunW: 0.15, gun: 1.3 }, 7: { twin: true } };

  var cache = {}, groundTex = null, shadowTex = null, starCache = {};
  function sprite(body, tint, r, f, flash, opt, key) {
    key = body + (key || tint) + r + f + (flash ? 'f' : '');
    var c = cache[key]; if (c) return c;
    var size = Math.ceil(r * 2.6 * 2 * RS); c = mk(size, size);
    var g = c.getContext('2d'); g.translate(size / 2, size / 2); g.scale(r * RS, r * RS); g.lineJoin = 'round';
    BODY[body](g, tint, f, opt);
    if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,244,225,.8)'; g.fillRect(-3, -3, 6, 6); }
    return (cache[key] = c);
  }
  function blit(ctx, c, x, y, ang, sc) {
    var w = c.width / RS * (sc || 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(c, -w / 2, -w / 2, w, w); ctx.restore();
  }
  function shadow(ctx, x, y, r, ang) {
    if (!shadowTex) {
      shadowTex = mk(64, 64); var g = shadowTex.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    var d = r * 0.45, s = r * 3;
    ctx.drawImage(shadowTex, x - Math.cos(ang) * d - s / 2, y - Math.sin(ang) * d - s / 2, s, s);
  }

  /* ---------------------------------------------------------------- the ground: churned mud, craters, puddles, debris */
  function makeGround() {
    var N = 512, c = mk(N, N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data, x, y, i, seed = 11;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }
    function vn(px, py, per, o) {
      var xi = Math.floor(px), yi = Math.floor(py), fx = px - xi, fy = py - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = hash(xi % per, yi % per + o), b = hash((xi + 1) % per, yi % per + o), e = hash(xi % per, (yi + 1) % per + o), f = hash((xi + 1) % per, (yi + 1) % per + o);
      return (a + (b - a) * fx) * (1 - fy) + (e + (f - e) * fx) * fy;
    }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var lo = vn(x / 64, y / 64, 8, 1000), mid = vn(x / 16, y / 16, 32, 2000), hi = vn(x / 4, y / 4, 128, 3000);
      var grass = Math.min(1, Math.max(0, (lo * 0.75 + mid * 0.25 - 0.55) * 4)), b = 0.62 + 0.4 * mid + 0.3 * hi + (rnd() - 0.5) * 0.14;
      i = (y * N + x) * 4;
      d[i] = (58 + (46 - 58) * grass) * b; d[i + 1] = (46 + (56 - 46) * grass) * b; d[i + 2] = (32 + (30 - 32) * grass) * b; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    function wrap(px, py, fn) { for (var oy = -N; oy <= N; oy += N) for (var ox = -N; ox <= N; ox += N) { g.save(); g.translate(px + ox, py + oy); fn(); g.restore(); } }
    g.lineCap = 'round';
    for (i = 0; i < 3; i++) (function () {   /* tyre and track ruts */
      var a = rnd() * TAU, gap = 16 + rnd() * 8;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.setLineDash([7, 5]); for (var k = -1; k <= 1; k += 2) { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 7; g.beginPath(); g.moveTo(-260, k * gap); g.lineTo(260, k * gap); g.stroke(); } g.setLineDash([]); });
    })();
    for (i = 0; i < 7; i++) (function () {   /* shell craters */
      var r = 18 + rnd() * 26, bits = [], k;
      for (k = 0; k < 14; k++) bits.push([rnd() * TAU, r * (1.0 + rnd() * 0.6), 1.5 + rnd() * 3, 1.2 + rnd() * 2]);
      wrap(rnd() * N, rnd() * N, function () {
        var gr = g.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.1, 0, 0, r * 1.25); gr.addColorStop(0, 'rgba(8,7,5,.85)'); gr.addColorStop(0.6, 'rgba(20,16,11,.6)'); gr.addColorStop(0.8, 'rgba(120,100,70,.3)'); gr.addColorStop(1, 'rgba(120,100,70,0)');
        g.fillStyle = gr; ell(g, 0, 0, r * 1.25, r * 1.1); g.fill();
        g.fillStyle = 'rgba(30,24,16,.5)'; for (var q = 0; q < bits.length; q++) { ell(g, Math.cos(bits[q][0]) * bits[q][1], Math.sin(bits[q][0]) * bits[q][1], bits[q][2], bits[q][3]); g.fill(); }
      });
    })();
    for (i = 0; i < 5; i++) (function () {   /* puddles */
      var rx = 14 + rnd() * 22, ry = rx * (0.5 + rnd() * 0.3), a = rnd() * TAU;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.fillStyle = 'rgba(14,16,18,.75)'; ell(g, 0, 0, rx, ry); g.fill(); g.strokeStyle = 'rgba(150,170,190,.22)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, rx * 0.7, ry * 0.6, 0, 3.6, 5.2); g.stroke(); });
    })();
    for (i = 0; i < 90; i++) (function () {   /* grass */
      var len = 8 + rnd() * 12, a = rnd() * TAU, bend = (rnd() - 0.5) * 8, col = 'hsl(' + (64 + rnd() * 30) + ',' + (22 + rnd() * 14) + '%,' + (17 + rnd() * 12) + '%)', lw = 1.2 + rnd() * 1.2;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = lw + 1; g.beginPath(); g.moveTo(1.5, 1.5); g.quadraticCurveTo(len / 2 + 1.5, bend + 1.5, len + 1.5, 1.5); g.stroke();
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len / 2, bend, len, 0); g.stroke(); });
    })();
    for (i = 0; i < 7; i++) (function () {   /* splintered planks */
      var len = 20 + rnd() * 26, a = rnd() * TAU;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(2, 3, len, 6); g.fillStyle = '#4a3a26'; g.fillRect(0, 0, len, 6); g.fillStyle = 'rgba(200,170,120,.25)'; g.fillRect(0, 0, len, 1.5); });
    })();
    for (i = 0; i < 46; i++) (function () {   /* spent brass */
      var a = rnd() * TAU;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(1, 1); g.lineTo(6, 1); g.stroke(); g.strokeStyle = '#b08a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(5, 0); g.stroke(); });
    })();
    for (i = 0; i < 4; i++) (function () {   /* barbed wire */
      var a = rnd() * TAU, len = 60 + rnd() * 50;
      wrap(rnd() * N, rnd() * N, function () { var q; g.rotate(a); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.beginPath(); for (q = 0; q < len; q += 2) g.lineTo(q + 2, Math.sin(q * 0.45) * 5 + 2); g.stroke();
        g.strokeStyle = 'rgba(150,150,145,.65)'; g.lineWidth = 1; g.beginPath(); for (q = 0; q < len; q += 2) g.lineTo(q, Math.sin(q * 0.45) * 5); g.stroke(); });
    })();
    for (i = 0; i < 24; i++) (function () {   /* stones */
      var rx = 3 + rnd() * 6, ry = rx * (0.6 + rnd() * 0.35), a = rnd() * TAU, tone = 66 + rnd() * 40;
      wrap(rnd() * N, rnd() * N, function () { g.fillStyle = 'rgba(0,0,0,.45)'; ell(g, 2, 2.5, rx * 1.08, ry * 1.08, a); g.fill();
        var gr = g.createRadialGradient(-rx * 0.35, -ry * 0.35, 0.5, 0, 0, rx * 1.1); gr.addColorStop(0, 'rgb(' + (tone + 40 | 0) + ',' + (tone + 36 | 0) + ',' + (tone + 26 | 0) + ')'); gr.addColorStop(1, 'rgb(' + (tone * 0.42 | 0) + ',' + (tone * 0.4 | 0) + ',' + (tone * 0.38 | 0) + ')');
        g.fillStyle = gr; ell(g, 0, 0, rx, ry, a); g.fill(); });
    })();
    return c;
  }

  function glowLine(ctx, x1, y1, x2, y2, c, w, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; a = a == null ? 1 : a;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c;
    ctx.globalAlpha = 0.25 * a; ctx.lineWidth = w * 3; ctx.stroke();
    ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.2, w * 0.6); ctx.stroke(); ctx.restore();
  }
  function glowRing(ctx, x, y, r, c, w, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; a = a == null ? 1 : a;
    circle(ctx, x, y, r); ctx.strokeStyle = c;
    ctx.globalAlpha = 0.22 * a; ctx.lineWidth = w * 3; ctx.stroke();
    ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.2, w * 0.6); ctx.stroke(); ctx.restore();
  }

  /* ---------------------------------------------------------------- what is left on the ground */
  var splats = null, scorchTex = null;
  function makeSplats() {
    var seed = 5, n, i, a, d, r, g, c;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }
    splats = [];
    for (n = 0; n < 6; n++) {
      c = mk(96, 96); g = c.getContext('2d'); g.translate(48, 48);
      for (i = 0; i < 18; i++) { a = rnd() * TAU; d = rnd() * rnd() * 32; r = 3 + rnd() * 11 * (1 - d / 40); g.fillStyle = i % 3 ? '#4d0808' : '#6e0e0e'; ell(g, Math.cos(a) * d, Math.sin(a) * d, r, r * (0.6 + rnd() * 0.4), a); g.fill(); }
      for (i = 0; i < 16; i++) { a = rnd() * TAU; d = 24 + rnd() * 22; g.fillStyle = '#4d0808'; ell(g, Math.cos(a) * d, Math.sin(a) * d, 1 + rnd() * 2.6, 0.8 + rnd() * 1.4, a); g.fill(); }
      g.fillStyle = 'rgba(190,40,40,.3)'; ell(g, -5, -5, 7, 3.5, 0.5); g.fill();
      splats.push(c);
    }
    scorchTex = mk(96, 96); g = scorchTex.getContext('2d');
    var gr = g.createRadialGradient(48, 48, 4, 48, 48, 46); gr.addColorStop(0, 'rgba(6,5,4,.85)'); gr.addColorStop(0.5, 'rgba(10,8,6,.55)'); gr.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96); g.strokeStyle = 'rgba(8,6,5,.5)'; g.lineCap = 'round';
    for (i = 0; i < 22; i++) { a = rnd() * TAU; d = 20 + rnd() * 26; g.lineWidth = 1 + rnd() * 2.5; g.beginPath(); g.moveTo(48 + Math.cos(a) * 12, 48 + Math.sin(a) * 12); g.lineTo(48 + Math.cos(a) * d, 48 + Math.sin(a) * d); g.stroke(); }
  }
  /* the same body as in life, drained of colour: bloodied for the dead, burnt out for wrecks */
  function remains(body, tint, r, opt, key, wreck) {
    key = body + key + r + (wreck ? 'w' : 'c');
    var c = cache[key]; if (c) return c;
    var size = Math.ceil(r * 2.6 * 2 * RS); c = mk(size, size);
    var g = c.getContext('2d'); g.translate(size / 2, size / 2); g.scale(r * RS, r * RS); g.lineJoin = 'round';
    BODY[body](g, tint, 0, opt);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = wreck ? 'rgba(9,8,7,.74)' : 'rgba(46,6,6,.5)'; g.fillRect(-3, -3, 6, 6);
    if (!wreck) { g.fillStyle = 'rgba(110,12,12,.75)'; ell(g, -0.05, 0.1, 0.3, 0.42, 0.4); g.fill(); ell(g, 0.2, -0.3, 0.16, 0.2); g.fill(); }
    return (cache[key] = c);
  }

  var skin = {
    id: 'real', name: 'Night Battlefield', pixel: 1, bg: '#0b0b08', gemsGlow: true,
    ui: { font: '"American Typewriter", "Courier New", Courier, monospace', text: '#efe8d6', dim: '#a39d86',
      panel: 'rgba(11,12,9,.9)', accent: '#e8b84a', hp: '#c8372d', xp: '#8fbf5a', track: '#1a1b15', edge: '#6b6a4a' },
    /* enemy colour slots: infantry, dogs, bikes, grenadiers, armour, boss steel, shock troops, the last boss */
    tints: ['#6f7467', '#7a5a3a', '#4d5560', '#8a7a4a', '#59604f', '#7d8178', '#3f4a3a', '#5a3d36'],
    gemTints: ['#c9884a', '#cfd6dc', '#ffd24a'],
    ground: function (ctx, v) {
      if (!groundTex) groundTex = makeGround();
      tiles(v, TILE, function (i, j, x, y) { ctx.drawImage(groundTex, x, y, TILE + 0.6, TILE + 0.6); });
    },
    player: function (ctx, p, t) {
      var a = p.look == null ? (p.ang || 0) : p.look, cls = HERO[p.cls] ? p.cls : 'rifleman', o = HERO[cls];
      shadow(ctx, p.x + 2, p.y + 3, p.r, a);
      blit(ctx, sprite('soldier', o.tint, p.r, p.moving && Math.sin(t * 14) > 0 ? 1 : 0, p.hurt, o, cls), p.x, p.y, a);
    },
    enemy: function (ctx, e, t) {
      var body = BODY[e.arch] ? e.arch : 'soldier', rate = body === 'dog' ? 18 : body === 'soldier' ? 10 : 12;
      var f = Math.sin(t * rate + e.seed) > 0 ? 1 : 0;
      shadow(ctx, e.x, e.y, e.r * (body === 'tank' || body === 'truck' ? 1.25 : 1), e.ang);
      blit(ctx, sprite(body, this.tints[e.tint], e.r, f, e.hit > 0, LOOK[e.tint], 't' + e.tint), e.x, e.y, e.ang);
    },
    decal: function (ctx, d) {
      if (!splats) makeSplats();
      var a = Math.min(1, d.life / 6), s;
      if (d.k === 'scorch') { s = d.r * 2.5; ctx.globalAlpha = 0.85 * a; ctx.drawImage(scorchTex, d.x - s / 2, d.y - s / 2, s, s); ctx.globalAlpha = 1; return; }
      if (d.k === 'blood' || d.pool) {   /* pools under the dead spread for a moment */
        s = (d.k === 'blood' ? d.r * 2.6 : d.r * 4.6 * Math.min(1, 0.35 + d.age * 0.5));
        ctx.globalAlpha = 0.9 * a; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot + d.v); ctx.drawImage(splats[d.v], -s / 2, -s / 2, s, s); ctx.restore();
      }
      if (d.k !== 'blood') { ctx.globalAlpha = a; blit(ctx, remains(BODY[d.arch] ? d.arch : 'soldier', this.tints[d.tint], d.r, LOOK[d.tint], 't' + d.tint, d.k === 'wreck'), d.x, d.y, d.rot); }
      ctx.globalAlpha = 1;
    },
    /* friendly things that move around the player */
    orbiter: function (ctx, x, y, ang, size) { shadow(ctx, x + 6, y + 10, size * 0.9, ang); blit(ctx, sprite('plane', '#5d6b3a', Math.round(size * 1.5), 0, false), x, y, ang); },
    runner: function (ctx, s, t) { var a = Math.atan2(s.vy, s.vx); shadow(ctx, s.x, s.y, s.r, a); blit(ctx, sprite('dog', '#9a7448', Math.round(s.r), Math.sin(t * 22) > 0 ? 1 : 0, false), s.x, s.y, a); },
    gem: function (ctx, g, t) {
      var c = starCache[g.tier];
      if (!c) {
        c = starCache[g.tier] = mk(48, 48); var q = c.getContext('2d'), tint = this.gemTints[g.tier], s = 7 + g.tier * 1.5, i;
        q.translate(24, 24); var gr = q.createRadialGradient(0, 0, 0, 0, 0, 22); gr.addColorStop(0, tint); gr.addColorStop(1, 'rgba(0,0,0,0)');
        q.globalAlpha = 0.45; q.fillStyle = gr; q.fillRect(-24, -24, 48, 48); q.globalAlpha = 1;
        q.beginPath(); for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; q.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } q.closePath();
        var lg = q.createLinearGradient(-s, -s, s, s); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.45, tint); lg.addColorStop(1, shade(tint, 0.4));
        q.fillStyle = lg; q.fill(); q.strokeStyle = 'rgba(0,0,0,.5)'; q.lineWidth = 1; q.stroke();
      }
      var k = 0.5 * (0.9 + 0.1 * Math.sin(t * 5 + g.x));
      ctx.drawImage(c, g.x - 24 * k, g.y - 24 * k, 48 * k, 48 * k);
    },
    /* called after the bodies are drawn: the warm pool of flare light, darkness beyond it, and what glints out there */
    light: function (ctx, v, p, t, en) {
      var lx = p.x, ly = p.y, R = 340 * (p.lightMul || 1) * (1 + 0.025 * Math.sin(t * 13) + 0.02 * Math.sin(t * 7.3)), gr, i;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.75); gr.addColorStop(0, 'rgba(255,175,95,.24)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.globalCompositeOperation = 'source-over';
      gr = ctx.createRadialGradient(lx, ly, R * 0.15, lx, ly, R); gr.addColorStop(0, 'rgba(4,6,10,0)'); gr.addColorStop(0.55, 'rgba(4,6,10,.48)'); gr.addColorStop(1, 'rgba(4,6,10,.84)');
      ctx.fillStyle = gr; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < en.length; i++) {
        var e = en[i], d = Math.hypot(e.x - lx, e.y - ly), al = Math.min(1, (d - R * 0.5) / (R * 0.3)); if (al <= 0) continue;
        var cx = Math.cos(e.ang), sy = Math.sin(e.ang), a = e.arch, lamps = a === 'tank' || a === 'truck' || a === 'bike';
        var fwd = lamps ? 1 : a === 'dog' ? 0.85 : 0.3, sp = a === 'bike' || a === 'soldier' ? 0 : a === 'dog' ? e.r * 0.14 : e.r * 0.45, er = lamps ? Math.max(1.6, e.r * 0.07) : 1.3;
        var fx = e.x + cx * e.r * fwd, fy = e.y + sy * e.r * fwd;
        ctx.fillStyle = lamps ? '#ffe9a8' : a === 'dog' ? '#ff6a4a' : '#9aa6b0';
        ctx.globalAlpha = al * (lamps ? 0.3 : 0.18); circle(ctx, fx - sy * sp, fy + cx * sp, er * 2.8); ctx.fill(); if (sp) { circle(ctx, fx + sy * sp, fy - cx * sp, er * 2.8); ctx.fill(); }
        ctx.globalAlpha = al * (a === 'soldier' ? 0.6 : 1); circle(ctx, fx - sy * sp, fy + cx * sp, er); ctx.fill(); if (sp) { circle(ctx, fx + sy * sp, fy - cx * sp, er); ctx.fill(); }
      }
      ctx.restore();
    },
    disc: function (ctx, x, y, r, c, a) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a == null ? 1 : a;
      if (r > 5) {
        var gr = ctx.createRadialGradient(x, y, 0, x, y, r * 1.7); gr.addColorStop(0, '#fff6e0'); gr.addColorStop(0.3, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; circle(ctx, x, y, r * 1.7); ctx.fill();
      } else { ctx.fillStyle = c; circle(ctx, x, y, r); ctx.fill(); }
      ctx.restore();
    },
    line: glowLine, ring: glowRing
  };

  root.LL = root.LL || {};
  root.LL.SKINS = { real: skin };
  /* a round portrait of a class for menus: the soldier seen from above, facing up */
  root.LL.heroSprite = function (cls, px) {
    var o = HERO[cls] || HERO.rifleman, r = px * 0.4, sp = sprite('soldier', o.tint, Math.round(r), 0, false, o, cls + 'ui'), c = mk(px, px), g = c.getContext('2d');
    var gr = g.createRadialGradient(px / 2, px * 0.4, 4, px / 2, px / 2, px / 2); gr.addColorStop(0, '#4a4433'); gr.addColorStop(1, '#14140e');
    g.fillStyle = gr; circle(g, px / 2, px / 2, px / 2 - 3); g.fill(); g.strokeStyle = '#6b6a4a'; g.lineWidth = 3; g.stroke();
    g.save(); circle(g, px / 2, px / 2, px / 2 - 4); g.clip(); blit(g, sp, px / 2, px * 0.56, -Math.PI / 2); g.restore();
    return c;
  };
})(typeof window !== 'undefined' ? window : this);
