/* Last Lantern: render skins.
   Every skin draws the same world. Nothing in here knows the game rules, and all art is drawn in code,
   so the app ships no third-party artwork.
   A skin exposes: ground, player, enemy, gem, and three styled primitives (disc, line, ring) that
   every weapon effect is composed from. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;

  function hash(x, y) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function tiles(v, s, fn) {
    var x0 = Math.floor(v.x / s), y0 = Math.floor(v.y / s);
    var x1 = Math.floor((v.x + v.w) / s), y1 = Math.floor((v.y + v.h) / s);
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) fn(i, j, i * s, j * s);
  }
  function poly(ctx, x, y, r, n, rot) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = rot + i * TAU / n;
      if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f <= 1) { r *= f; g *= f; b *= f; }
    else { var k = f - 1; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  /* ---------------------------------------------------------------- A. Neon Vector */
  function glow(ctx, color, w) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22; ctx.lineWidth = w * 4; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke();
  }
  var neon = {
    id: 'neon', name: 'Neon Vector', pixel: 1, bg: '#07060f',
    ui: { font: 'Menlo, Consolas, "DejaVu Sans Mono", monospace', text: '#e8f7ff', dim: '#8088b8',
      panel: 'rgba(14,12,36,.86)', accent: '#3df2ff', hp: '#ff4d7e', xp: '#3df2ff', track: '#1c1a3a', edge: '#3df2ff' },
    tints: ['#ff4d7e', '#ffb23d', '#b46bff', '#5dff8f', '#ff6bd6', '#ffffff'],
    gemTints: ['#3df2ff', '#5dff8f', '#ffd94d'],
    ground: function (ctx, v) {
      ctx.fillStyle = this.bg; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.lineWidth = 1;
      var s = 64, x, y;
      for (x = Math.floor(v.x / s) * s; x < v.x + v.w; x += s) {
        ctx.strokeStyle = (x / s) % 4 === 0 ? 'rgba(140,100,255,.34)' : 'rgba(110,90,230,.14)';
        ctx.beginPath(); ctx.moveTo(x, v.y); ctx.lineTo(x, v.y + v.h); ctx.stroke();
      }
      for (y = Math.floor(v.y / s) * s; y < v.y + v.h; y += s) {
        ctx.strokeStyle = (y / s) % 4 === 0 ? 'rgba(140,100,255,.34)' : 'rgba(110,90,230,.14)';
        ctx.beginPath(); ctx.moveTo(v.x, y); ctx.lineTo(v.x + v.w, y); ctx.stroke();
      }
    },
    player: function (ctx, p, t) {
      var c = p.hurt ? '#ffffff' : '#3df2ff';
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      poly(ctx, p.x, p.y, p.r * 1.25, 4, Math.PI / 2);
      ctx.fillStyle = c; ctx.globalAlpha = 0.18; ctx.fill(); glow(ctx, c, 2.2);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.75, t * 2, t * 2 + 1.6);
      ctx.moveTo(p.x + Math.cos(t * 2 + Math.PI) * p.r * 1.75, p.y + Math.sin(t * 2 + Math.PI) * p.r * 1.75);
      ctx.arc(p.x, p.y, p.r * 1.75, t * 2 + Math.PI, t * 2 + Math.PI + 1.6);
      glow(ctx, c, 1.2);
      circle(ctx, p.x, p.y, p.r * 0.36); ctx.fillStyle = '#fffbe0'; ctx.fill();
      ctx.restore();
    },
    enemy: function (ctx, e, t) {
      var c = e.hit > 0 ? '#ffffff' : this.tints[e.tint], x = e.x, y = e.y, r = e.r;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      if (e.arch === 'blob') poly(ctx, x, y, r * 1.2, 4, t * 1.5 + e.seed);
      else if (e.arch === 'dart') poly(ctx, x, y, r * 1.35, 3, e.ang);
      else if (e.arch === 'brute') {
        poly(ctx, x, y, r * 0.55, 6, -t); glow(ctx, c, 1.4);
        poly(ctx, x, y, r * 1.1, 6, t * 0.6 + e.seed);
      } else {
        var f = Math.sin(t * 14 + e.seed) * r;
        ctx.beginPath(); ctx.moveTo(x - r * 1.6, y - f); ctx.lineTo(x, y + r * 0.6);
        ctx.lineTo(x + r * 1.6, y - f); ctx.lineTo(x, y - r * 0.15); ctx.closePath();
      }
      ctx.fillStyle = c; ctx.globalAlpha = 0.16; ctx.fill(); glow(ctx, c, 2);
      ctx.restore();
    },
    gem: function (ctx, g, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      poly(ctx, g.x, g.y, 5 + g.tier * 1.5, 4, 0);
      ctx.fillStyle = this.gemTints[g.tier]; ctx.globalAlpha = 0.5; ctx.fill(); glow(ctx, this.gemTints[g.tier], 1.2);
      ctx.restore();
    },
    disc: function (ctx, x, y, r, c, a) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; a = a == null ? 1 : a;
      circle(ctx, x, y, r); ctx.fillStyle = c; ctx.globalAlpha = 0.3 * a; ctx.fill();
      ctx.strokeStyle = c; ctx.globalAlpha = 0.25 * a; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalAlpha = a; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    },
    line: function (ctx, x1, y1, x2, y2, c, w, a) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; a = a == null ? 1 : a;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c;
      ctx.globalAlpha = 0.25 * a; ctx.lineWidth = w * 3; ctx.stroke();
      ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.2, w * 0.6); ctx.stroke(); ctx.restore();
    },
    ring: function (ctx, x, y, r, c, w, a) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; a = a == null ? 1 : a;
      circle(ctx, x, y, r); ctx.strokeStyle = c;
      ctx.globalAlpha = 0.22 * a; ctx.lineWidth = w * 3; ctx.stroke();
      ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.2, w * 0.6); ctx.stroke(); ctx.restore();
    }
  };

  /* ---------------------------------------------------------------- B. Storybook Cartoon */
  var INK = '#2b2140';
  function ol(ctx, fill) {
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function shadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(20,50,30,.24)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, TAU); ctx.fill();
  }
  function eyes(ctx, x, y, gap, r, look) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    circle(ctx, x - gap, y, r); ctx.fill(); ctx.stroke();
    circle(ctx, x + gap, y, r); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    circle(ctx, x - gap + look * r * 0.4, y, r * 0.5); ctx.fill();
    circle(ctx, x + gap + look * r * 0.4, y, r * 0.5); ctx.fill();
  }
  var cartoon = {
    id: 'cartoon', name: 'Storybook Cartoon', pixel: 1, bg: '#7cc470',
    ui: { font: '"Arial Rounded MT Bold", "Chalkboard SE", "Trebuchet MS", system-ui, sans-serif', text: '#ffffff', dim: '#d7e6ff',
      panel: 'rgba(43,33,64,.88)', accent: '#ffd94d', hp: '#ff5a5a', xp: '#4fc3ff', track: '#2b2140', edge: '#2b2140' },
    tints: ['#7ad65b', '#ff8a4c', '#a678f0', '#4fc3d9', '#f06fa8', '#d9d2c4'],
    gemTints: ['#4fc3ff', '#6fe07a', '#ffd94d'],
    ground: function (ctx, v) {
      ctx.fillStyle = this.bg; ctx.fillRect(v.x, v.y, v.w, v.h);
      tiles(v, 96, function (i, j, x, y) {
        var h = hash(i, j), h2 = hash(i + 91, j - 37);
        if (h < 0.45) {
          ctx.fillStyle = 'rgba(60,150,70,.35)';
          ctx.beginPath(); ctx.ellipse(x + h2 * 96, y + h * 150, 30 + h2 * 22, 16 + h * 20, 0, 0, TAU); ctx.fill();
        }
        var gx = x + h2 * 80 + 8, gy = y + hash(i * 3, j * 7) * 80 + 8;
        ctx.strokeStyle = '#4f9e52'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(gx - 5, gy); ctx.lineTo(gx - 7, gy - 8); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 11);
        ctx.moveTo(gx + 5, gy); ctx.lineTo(gx + 8, gy - 7); ctx.stroke();
        if (h > 0.8) {
          var fx = x + h * 60, fy = y + h2 * 70;
          ctx.fillStyle = h2 > 0.5 ? '#fff6d6' : '#ffd0e6';
          for (var k = 0; k < 5; k++) { circle(ctx, fx + Math.cos(k * 1.257) * 4, fy + Math.sin(k * 1.257) * 4, 2.6); ctx.fill(); }
          ctx.fillStyle = '#ffb52e'; circle(ctx, fx, fy, 2.4); ctx.fill();
        }
      });
    },
    player: function (ctx, p, t) {
      var bob = p.moving ? Math.sin(t * 12) * 1.6 : 0, x = p.x, y = p.y + bob, r = p.r, f = p.face;
      shadow(ctx, p.x, p.y + r * 0.95, r * 0.95);
      ctx.fillStyle = 'rgba(255,230,130,.3)'; circle(ctx, x + f * r * 0.95, y + r * 0.15, r * 0.85); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - r * 0.85, y + r * 0.95);
      ctx.quadraticCurveTo(x - r * 0.95, y - r * 0.3, x, y - r * 0.4);
      ctx.quadraticCurveTo(x + r * 0.95, y - r * 0.3, x + r * 0.85, y + r * 0.95); ctx.closePath();
      ol(ctx, p.hurt ? '#ffffff' : '#3f74e0');
      circle(ctx, x, y - r * 0.6, r * 0.58); ol(ctx, '#ffd9b0');
      ctx.beginPath(); ctx.arc(x, y - r * 0.66, r * 0.62, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ol(ctx, '#2f57b3');
      ctx.fillStyle = INK;
      circle(ctx, x + f * r * 0.14 - r * 0.2, y - r * 0.5, 1.8); ctx.fill();
      circle(ctx, x + f * r * 0.14 + r * 0.2, y - r * 0.5, 1.8); ctx.fill();
      circle(ctx, x + f * r * 0.95, y + r * 0.15, r * 0.28); ol(ctx, '#ffd94d');
    },
    enemy: function (ctx, e, t) {
      var c = e.hit > 0 ? '#ffffff' : this.tints[e.tint], x = e.x, y = e.y, r = e.r, k;
      if (e.arch === 'blob') {
        var sq = 1 + Math.sin(t * 7 + e.seed) * 0.09;
        shadow(ctx, x, y + r * 0.9, r);
        ctx.beginPath(); ctx.ellipse(x, y + r * (1 - 1 / sq), r * sq, r / sq, 0, 0, TAU); ol(ctx, c);
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(x - r * 0.4, y - r * 0.5, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
        eyes(ctx, x + e.face * r * 0.12, y - r * 0.05, r * 0.36, r * 0.24, e.face);
      } else if (e.arch === 'dart') {
        shadow(ctx, x, y + r * 0.95, r * 0.85);
        for (k = -1; k <= 1; k += 2) {
          ctx.beginPath(); ctx.moveTo(x + k * r * 0.95, y - r * 1.35); ctx.lineTo(x + k * r * 0.2, y - r * 0.7);
          ctx.lineTo(x + k * r * 0.9, y - r * 0.2); ctx.closePath(); ol(ctx, c);
        }
        circle(ctx, x, y, r * 0.95); ol(ctx, c);
        eyes(ctx, x + e.face * r * 0.15, y - r * 0.1, r * 0.36, r * 0.22, e.face);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath();
        ctx.moveTo(x - r * 0.7, y - r * 0.5); ctx.lineTo(x - r * 0.1, y - r * 0.28);
        ctx.moveTo(x + r * 0.7, y - r * 0.5); ctx.lineTo(x + r * 0.1, y - r * 0.28); ctx.stroke();
      } else if (e.arch === 'brute') {
        shadow(ctx, x, y + r * 0.95, r * 1.05);
        for (k = -1; k <= 1; k += 2) {
          ctx.beginPath(); ctx.moveTo(x + k * r * 0.95, y - r * 1.25); ctx.lineTo(x + k * r * 0.35, y - r * 0.8);
          ctx.lineTo(x + k * r * 0.85, y - r * 0.45); ctx.closePath(); ol(ctx, '#f6ecd2');
        }
        circle(ctx, x, y, r); ol(ctx, c);
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.45, r * 0.6, r * 0.38, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        circle(ctx, x + e.face * r * 0.1, y - r * 0.25, r * 0.3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; circle(ctx, x + e.face * r * 0.2, y - r * 0.25, r * 0.14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - r * 0.45, y + r * 0.3); ctx.lineTo(x + r * 0.45, y + r * 0.3); ctx.stroke();
        ctx.fillStyle = '#fff';
        for (k = -1; k <= 1; k += 2) {
          ctx.beginPath(); ctx.moveTo(x + k * r * 0.34, y + r * 0.3); ctx.lineTo(x + k * r * 0.24, y + r * 0.08);
          ctx.lineTo(x + k * r * 0.14, y + r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      } else {
        var fl = Math.sin(t * 16 + e.seed);
        shadow(ctx, x, y + r * 1.9, r * 0.7);
        for (k = -1; k <= 1; k += 2) {
          ctx.beginPath(); ctx.moveTo(x + k * r * 0.3, y - r * 0.1);
          ctx.quadraticCurveTo(x + k * r * 1.2, y - r * (0.9 + fl * 0.7), x + k * r * 2, y - r * fl * 0.7);
          ctx.quadraticCurveTo(x + k * r * 1.1, y + r * 0.3, x + k * r * 0.3, y + r * 0.45); ctx.closePath(); ol(ctx, c);
        }
        circle(ctx, x, y, r * 0.7); ol(ctx, c);
        eyes(ctx, x, y - r * 0.1, r * 0.28, r * 0.18, e.face);
      }
    },
    gem: function (ctx, g, t) {
      var s = 5.5 + g.tier * 1.5, y = g.y + Math.sin(t * 4 + g.x) * 1.5;
      ctx.beginPath(); ctx.moveTo(g.x, y - s * 1.2); ctx.lineTo(g.x + s, y); ctx.lineTo(g.x, y + s * 1.2); ctx.lineTo(g.x - s, y); ctx.closePath();
      ctx.fillStyle = this.gemTints[g.tier]; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(g.x - s * 0.5, y - s * 0.1); ctx.lineTo(g.x, y - s * 0.8); ctx.lineTo(g.x, y - s * 0.1); ctx.fill();
    },
    disc: function (ctx, x, y, r, c, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
      circle(ctx, x, y, r); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = Math.min(2.4, r * 0.4); ctx.stroke();
      if (r > 3) { ctx.fillStyle = 'rgba(255,255,255,.55)'; circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.3); ctx.fill(); }
      ctx.restore();
    },
    line: function (ctx, x1, y1, x2, y2, c, w, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = INK; ctx.lineWidth = w + 4; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
    },
    ring: function (ctx, x, y, r, c, w, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a; circle(ctx, x, y, r);
      ctx.strokeStyle = INK; ctx.lineWidth = w + 3; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
    }
  };

  /* ---------------------------------------------------------------- C. Pixel Dungeon */
  var PS = 3, OUT = '#1a1423';
  var SPR = {
    blob: [['..........', '...oooo...', '..oCAAAo..', '.oCAAAAAo.', '.oAwkAwkBo', 'oAAAAAAABo', 'oAAAAAABBo', 'oABAAABBBo', '.oBBBBBBo.', '..oooooo..']],
    dart: [['o........o', 'oo......oo', 'oAo....oAo', 'oAAooooAAo', 'oAAAAAAAAo', 'oAkwAAwkAo', 'oAAAAAAABo', '.oAwwwwBo.', '..oBBBBo..', '...oooo...']],
    brute: [['w........w', 'ww.oooo.ww', '.woAAAAow.', 'oAAAAAAAAo', 'oAAwwkwAAo', 'oAAAAAAABo', 'oAwAwAwABo', 'oBAAAAAABo', '.oBBBBBBo.', '..oo..oo..']],
    bat: [
      ['oo......oo', 'oAo.oo.oAo', 'oAAoAAoAAo', 'oAAAkAkAAo', '.oAAAAAAo.', '..oBAABo..', '...oooo...'],
      ['..........', '....oo....', '.ooAAAAoo.', 'oAAAkAkAAo', 'oAoAAAAoAo', 'oo.oBBo.oo', '....oo....']
    ],
    hero: [['...oooo...', '..oHHHHo..', '.oHHHHHHo.', '.oHssssHo.', '.oHksskHo.', '.oHssssHo.', '..oHHHHoy.', '.oHHHHHoyy', '.oHHHHHHoy', '.oHHhhHHo.', '..oho.oho.', '..oo..oo..']],
    gem: [['..o..', '.oCo.', 'oCAAo', 'oAABo', '.oBo.', '..o..']]
  };
  var sprCache = {};
  function spr(name, frame, tint, flash) {
    var key = name + frame + tint + (flash ? 'f' : ''), c = sprCache[key];
    if (c) return c;
    var rows = SPR[name][frame], pal = { o: OUT, w: '#ffffff', k: '#15101c', H: '#4a7de0', h: '#2f4f9e', s: '#f2c9a0', y: '#ffd94d',
      A: tint, B: shade(tint, 0.68), C: shade(tint, 1.45) };
    c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    var g = c.getContext('2d');
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var ch = rows[y][x]; if (ch === '.') continue;
      g.fillStyle = flash && ch !== 'o' ? '#ffffff' : pal[ch]; g.fillRect(x, y, 1, 1);
    }
    return (sprCache[key] = c);
  }
  function blit(ctx, cv, x, y, k, flip) {
    var w = cv.width * PS * k, h = cv.height * PS * k;
    var dx = Math.round((x - w / 2) / PS) * PS, dy = Math.round((y - h / 2) / PS) * PS;
    if (flip) { ctx.save(); ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0, w, h); ctx.restore(); }
    else ctx.drawImage(cv, dx, dy, w, h);
  }
  function pshadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fillRect(Math.round((x - w / 2) / PS) * PS, Math.round(y / PS) * PS, Math.round(w / PS) * PS, PS * 2);
  }
  var pixel = {
    id: 'pixel', name: 'Pixel Dungeon', pixel: PS, bg: '#343a4b',
    ui: { font: '"Courier New", Menlo, "DejaVu Sans Mono", monospace', text: '#f4f0e0', dim: '#a7adc2',
      panel: 'rgba(26,20,35,.92)', accent: '#ffd94d', hp: '#e5484d', xp: '#5fcde4', track: '#1a1423', edge: '#f4f0e0' },
    tints: ['#6abe30', '#df7126', '#9b5de5', '#5fcde4', '#d95763', '#cbdbfc'],
    gemTints: ['#5fcde4', '#99e550', '#fbf236'],
    ground: function (ctx, v) {
      var cols = ['#343a4b', '#30364a', '#383e52'];
      tiles(v, 48, function (i, j, x, y) {
        var h = hash(i, j);
        ctx.fillStyle = cols[(h * 3) | 0]; ctx.fillRect(x, y, 48, 48);
        ctx.fillStyle = '#272b3a'; ctx.fillRect(x, y, 48, PS); ctx.fillRect(x, y, PS, 48);
        if (h < 0.16) { ctx.fillStyle = '#474e66'; ctx.fillRect(x + 18, y + 24, PS * 2, PS); ctx.fillRect(x + 21, y + 21, PS, PS); }
        else if (h > 0.84) { ctx.fillStyle = '#272b3a'; ctx.fillRect(x + 27, y + 12, PS, PS * 3); ctx.fillRect(x + 30, y + 18, PS, PS * 2); ctx.fillRect(x + 24, y + 9, PS, PS); }
        else if (h > 0.5 && h < 0.56) { ctx.fillStyle = '#3f6b3a'; ctx.fillRect(x + 12, y + 33, PS * 2, PS); ctx.fillRect(x + 15, y + 30, PS, PS); }
      });
    },
    player: function (ctx, p, t) {
      pshadow(ctx, p.x, p.y + p.r * 1.05, p.r * 1.8);
      blit(ctx, spr('hero', 0, '#4a7de0', p.hurt), p.x, p.y - 3 + (p.moving && Math.sin(t * 12) > 0 ? -PS : 0), 1, p.face < 0);
    },
    enemy: function (ctx, e, t) {
      var k = Math.max(1, Math.round(e.r / 13)), fr = 0, y = e.y;
      if (e.arch === 'bat') { fr = Math.sin(t * 14 + e.seed) > 0 ? 0 : 1; pshadow(ctx, e.x, e.y + e.r * 1.8, e.r * 1.4); }
      else { pshadow(ctx, e.x, e.y + e.r * 1.0, e.r * 2); if (Math.sin(t * 8 + e.seed) > 0) y -= PS; }
      blit(ctx, spr(e.arch, fr, this.tints[e.tint], e.hit > 0), e.x, y, k, e.face < 0);
    },
    gem: function (ctx, g) { blit(ctx, spr('gem', 0, this.gemTints[g.tier], false), g.x, g.y, 1, false); },
    disc: function (ctx, x, y, r, c, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
      x = Math.round(x / PS) * PS; y = Math.round(y / PS) * PS; r = Math.max(PS, Math.round(r / PS) * PS);
      ctx.fillStyle = OUT; ctx.fillRect(x - r - PS, y - r + PS, r * 2 + PS * 2, r * 2 - PS * 2); ctx.fillRect(x - r + PS, y - r - PS, r * 2 - PS * 2, r * 2 + PS * 2);
      ctx.fillStyle = c; ctx.fillRect(x - r, y - r + PS, r * 2, r * 2 - PS * 2); ctx.fillRect(x - r + PS, y - r, r * 2 - PS * 2, r * 2);
      ctx.restore();
    },
    line: function (ctx, x1, y1, x2, y2, c, w, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = OUT; ctx.lineWidth = w + PS * 2; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = Math.max(PS, w); ctx.stroke(); ctx.restore();
    },
    ring: function (ctx, x, y, r, c, w, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a; circle(ctx, x, y, r);
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(PS, w); ctx.stroke(); ctx.restore();
    }
  };

  /* ---------------------------------------------------------------- D. Ink & Parchment */
  var SEPIA = '#2b2622';
  function wob(ctx, x, y, r, seed, t, n, amp) {
    var fr = Math.floor(t * 7); n = n || 12; amp = amp == null ? 0.2 : amp;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = i * TAU / n, rr = r * (1 + (hash((seed * 31 | 0) + i, fr) - 0.5) * amp);
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function wash(ctx, x, y, r, seed, t, color, n) {
    wob(ctx, x + 1.5, y + 1.5, r * 1.06, seed + 7, t, n, 0.3); ctx.fillStyle = color; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    wob(ctx, x, y, r, seed, t, n); ctx.strokeStyle = SEPIA; ctx.lineWidth = 2; ctx.lineJoin = ctx.lineCap = 'round'; ctx.stroke();
  }
  function dots(ctx, x, y, gap, r) { ctx.fillStyle = SEPIA; circle(ctx, x - gap, y, r); ctx.fill(); circle(ctx, x + gap, y, r); ctx.fill(); }
  var ink = {
    id: 'ink', name: 'Ink & Parchment', pixel: 1, bg: '#ebe1c8',
    ui: { font: '"Marker Felt", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive', text: '#2b2622', dim: '#6f6557',
      panel: 'rgba(235,225,200,.94)', accent: '#b5422c', hp: '#b5422c', xp: '#2f7f86', track: 'rgba(43,38,34,.18)', edge: '#2b2622' },
    tints: ['#c2452d', '#d58a2a', '#7a4fa3', '#4f8a4a', '#b0487c', '#55504a'],
    gemTints: ['#2f7f86', '#4f8a4a', '#d5a52a'],
    ground: function (ctx, v) {
      ctx.fillStyle = this.bg; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.lineCap = 'round';
      tiles(v, 80, function (i, j, x, y) {
        var h = hash(i, j), h2 = hash(i + 17, j + 53), gx = x + h2 * 70, gy = y + hash(i * 5, j * 3) * 70;
        if (h < 0.3) { ctx.fillStyle = 'rgba(150,120,70,.13)'; ctx.beginPath(); ctx.ellipse(gx, gy, 34 + h * 60, 22 + h2 * 20, h * 3, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = 'rgba(43,38,34,.4)'; ctx.lineWidth = 1.4; ctx.beginPath();
        if (h > 0.55) { ctx.moveTo(gx - 4, gy - 7); ctx.lineTo(gx, gy); ctx.lineTo(gx + 5, gy - 8); ctx.moveTo(gx + 9, gy - 5); ctx.lineTo(gx + 8, gy); }
        else if (h > 0.4) { ctx.moveTo(gx, gy); ctx.lineTo(gx + 12, gy - 3); ctx.moveTo(gx + 2, gy + 4); ctx.lineTo(gx + 13, gy + 1); ctx.moveTo(gx + 4, gy + 8); ctx.lineTo(gx + 12, gy + 6); }
        else { ctx.moveTo(gx, gy); ctx.lineTo(gx + 0.5, gy + 0.5); ctx.moveTo(gx + 20, gy + 14); ctx.lineTo(gx + 20.5, gy + 14.5); }
        ctx.stroke();
      });
    },
    player: function (ctx, p, t) {
      var bob = p.moving ? Math.sin(t * 12) * 1.4 : 0, x = p.x, y = p.y + bob, r = p.r, f = p.face, lx = x + f * r * 1.05, ly = y + r * 0.1;
      ctx.strokeStyle = 'rgba(213,165,42,.8)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      for (var k = 0; k < 6; k++) { var a = k * TAU / 6 + Math.floor(t * 7) * 0.4; ctx.moveTo(lx + Math.cos(a) * r * 0.6, ly + Math.sin(a) * r * 0.6); ctx.lineTo(lx + Math.cos(a) * r * 0.95, ly + Math.sin(a) * r * 0.95); }
      ctx.stroke();
      wash(ctx, x, y + r * 0.25, r * 0.85, 3, t, p.hurt ? '#ffffff' : '#3b6aa8', 10);
      wash(ctx, x, y - r * 0.65, r * 0.5, 5, t, '#e8c9a0', 9);
      dots(ctx, x + f * r * 0.12, y - r * 0.65, r * 0.18, 1.5);
      wash(ctx, lx, ly, r * 0.3, 9, t, '#e3b22e', 7);
    },
    enemy: function (ctx, e, t) {
      var c = e.hit > 0 ? '#ffffff' : this.tints[e.tint], x = e.x, y = e.y, r = e.r, k;
      ctx.lineCap = ctx.lineJoin = 'round';
      if (e.arch === 'blob') {
        wash(ctx, x, y, r, e.seed, t, c);
        dots(ctx, x + e.face * r * 0.15, y - r * 0.15, r * 0.3, 2);
      } else if (e.arch === 'dart') {
        wash(ctx, x, y, r * 1.15, e.seed, t, c, 3);
        dots(ctx, x + e.face * r * 0.1, y, r * 0.25, 1.7);
      } else if (e.arch === 'brute') {
        wash(ctx, x, y, r, e.seed, t, c, 14);
        ctx.strokeStyle = SEPIA; ctx.lineWidth = 2; ctx.beginPath();
        for (k = -1; k <= 1; k += 2) { ctx.moveTo(x + k * r * 0.5, y - r * 0.8); ctx.quadraticCurveTo(x + k * r * 0.9, y - r * 1.1, x + k * r * 0.95, y - r * 1.5); }
        ctx.stroke(); ctx.lineWidth = 1.2; ctx.beginPath();
        for (k = 0; k < 4; k++) { ctx.moveTo(x - r * 0.5 + k * r * 0.25, y + r * 0.7); ctx.lineTo(x - r * 0.2 + k * r * 0.25, y + r * 0.25); }
        ctx.stroke();
        circle(ctx, x + e.face * r * 0.1, y - r * 0.25, r * 0.26); ctx.fillStyle = '#f6efdc'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = SEPIA; circle(ctx, x + e.face * r * 0.18, y - r * 0.25, r * 0.1); ctx.fill();
      } else {
        var fl = Math.sin(t * 16 + e.seed) * r * 0.8;
        ctx.strokeStyle = SEPIA; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(x - r * 1.9, y - fl); ctx.quadraticCurveTo(x - r, y - r * 0.9 - fl * 0.4, x - r * 0.3, y);
        ctx.moveTo(x + r * 1.9, y - fl); ctx.quadraticCurveTo(x + r, y - r * 0.9 - fl * 0.4, x + r * 0.3, y);
        ctx.stroke();
        wash(ctx, x, y, r * 0.6, e.seed, t, c, 8);
        dots(ctx, x, y - r * 0.1, r * 0.22, 1.4);
      }
    },
    gem: function (ctx, g, t) { wash(ctx, g.x, g.y, 6 + g.tier * 1.5, g.x, t, this.gemTints[g.tier], 4); },
    disc: function (ctx, x, y, r, c, a) {
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
      circle(ctx, x + 1, y + 1, r * 1.1); ctx.fillStyle = c; ctx.globalAlpha *= 0.6; ctx.fill();
      ctx.globalAlpha = a == null ? 1 : a; circle(ctx, x, y, r); ctx.strokeStyle = SEPIA; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
    },
    line: function (ctx, x1, y1, x2, y2, c, w, a) {
      ctx.save(); ctx.globalAlpha = (a == null ? 1 : a) * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w + 2; ctx.stroke();
      ctx.globalAlpha = a == null ? 1 : a; ctx.strokeStyle = SEPIA; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    },
    ring: function (ctx, x, y, r, c, w, a) {
      ctx.save(); ctx.globalAlpha = (a == null ? 1 : a) * 0.5; circle(ctx, x, y, r); ctx.strokeStyle = c; ctx.lineWidth = w + 2; ctx.stroke();
      ctx.globalAlpha = a == null ? 1 : a; ctx.strokeStyle = SEPIA; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
    }
  };

  root.LL = root.LL || {};
  root.LL.SKINS = { neon: neon, cartoon: cartoon, pixel: pixel, ink: ink };
  root.LL.SKIN_ORDER = ['neon', 'cartoon', 'pixel', 'ink'];
})(typeof window !== 'undefined' ? window : this);
