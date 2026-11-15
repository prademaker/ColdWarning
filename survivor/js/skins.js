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

  /* ---------------------------------------------------------------- E. Lantern-lit Realism
     Top-down, shaded creatures on a textured forest floor. Sprites are painted once into offscreen
     canvases facing +x with the light on their front; since every monster faces the lantern-bearer,
     rotating the sprite toward the player keeps the lighting correct for free. */
  var RS = 2, TILE = 384, realCache = {}, groundTex = null, shadowTex = null;
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function lit(g, cx, cy, rad, tint) {
    var gr = g.createRadialGradient(cx + rad * 0.5, cy, rad * 0.05, cx, cy, rad * 1.1);
    gr.addColorStop(0, shade(tint, 1.55)); gr.addColorStop(0.4, tint); gr.addColorStop(1, shade(tint, 0.2)); return gr;
  }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function eye(g, x, y, r, c) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
    gr.addColorStop(0, c); gr.addColorStop(0.35, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.globalAlpha = 0.55; g.fillStyle = gr; ell(g, x, y, r * 2.6, r * 2.6); g.fill(); g.restore();
    g.fillStyle = c; ell(g, x, y, r, r); g.fill(); g.fillStyle = '#fff8e0'; ell(g, x + r * 0.2, y - r * 0.2, r * 0.4, r * 0.4); g.fill();
  }
  var REAL = {
    blob: function (g, tint, f) {
      g.beginPath();
      for (var i = 0; i < 20; i++) { var a = i / 20 * TAU, rr = 1 + 0.09 * Math.sin(a * 3 + f * 1.7) + 0.05 * Math.sin(a * 5 + 1 + f); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.95); }
      g.closePath(); g.fillStyle = lit(g, 0, 0, 1, tint); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.07; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.2)'; ell(g, -0.4, 0.3, 0.22, 0.2); g.fill(); ell(g, -0.1, -0.45, 0.16, 0.14); g.fill(); ell(g, -0.55, -0.2, 0.13, 0.13); g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, -0.05, 0.02, 0.3, 0.27); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; ell(g, 0.45, -0.38, 0.17, 0.07, -0.7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)'; ell(g, 0.7, 0.05, 0.06, 0.13); g.fill();
      eye(g, 0.6, -0.26, 0.085, '#ffcf5a'); eye(g, 0.6, 0.26, 0.085, '#ffcf5a');
    },
    dart: function (g, tint, f) {
      g.strokeStyle = '#120d09'; g.lineWidth = 0.1; g.lineCap = g.lineJoin = 'round';
      for (var k = -1; k <= 1; k += 2) for (var i = -1; i <= 1; i++) {
        var sw = (f ? 0.14 : -0.14) * (i === 0 ? -1 : 1) * k;
        g.beginPath(); g.moveTo(i * 0.28, k * 0.3); g.lineTo(i * 0.45 + sw, k * 0.95); g.lineTo(i * 0.62 + sw * 1.6 - 0.1, k * 1.38); g.stroke();
      }
      ell(g, -0.45, 0, 0.75, 0.55); g.fillStyle = lit(g, -0.45, 0, 0.75, tint); g.fill(); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.05; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.07;
      for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-0.45, 0, 0.2 + i * 0.2, 0.5, 0, Math.PI * 0.62, Math.PI * 1.38); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.28)'; ell(g, -0.3, -0.24, 0.3, 0.07, 0.15); g.fill();
      ell(g, 0.3, 0, 0.4, 0.38); g.fillStyle = lit(g, 0.3, 0, 0.4, shade(tint, 0.75)); g.fill();
      ell(g, 0.72, 0, 0.24, 0.26); g.fillStyle = lit(g, 0.72, 0, 0.26, shade(tint, 0.45)); g.fill();
      g.strokeStyle = '#120d09'; g.lineWidth = 0.08;
      for (k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(0.9, k * 0.14); g.quadraticCurveTo(1.15, k * 0.22, 1.22, k * 0.04); g.stroke(); }
      eye(g, 0.82, -0.15, 0.05, '#ff5a3c'); eye(g, 0.82, 0.15, 0.05, '#ff5a3c');
    },
    bat: function (g, tint, f) {
      var s = [1, 0.74, 0.46][f];
      for (var k = -1; k <= 1; k += 2) {
        g.beginPath(); g.moveTo(0.15, k * 0.1); g.quadraticCurveTo(0.8, k * 1.0 * s, 0.3, k * 2.05 * s); g.lineTo(-0.12, k * 1.5 * s);
        g.quadraticCurveTo(0.08, k * 1.2 * s, -0.32, k * 1.0 * s); g.quadraticCurveTo(-0.05, k * 0.7 * s, -0.42, k * 0.45 * s); g.lineTo(-0.3, k * 0.1); g.closePath();
        var gr = g.createLinearGradient(0, 0, 0, k * 2 * s); gr.addColorStop(0, shade(tint, 1.05)); gr.addColorStop(1, shade(tint, 0.3));
        g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.05; g.lineJoin = 'round'; g.stroke();
        g.strokeStyle = shade(tint, 1.5); g.lineWidth = 0.045; g.beginPath();
        g.moveTo(0.15, k * 0.1); g.quadraticCurveTo(0.8, k * 1.0 * s, 0.3, k * 2.05 * s); g.moveTo(0.2, k * 0.2); g.lineTo(-0.12, k * 1.5 * s); g.moveTo(0.1, k * 0.2); g.lineTo(-0.32, k * 1.0 * s); g.stroke();
      }
      ell(g, 0, 0, 0.5, 0.28); g.fillStyle = lit(g, 0, 0, 0.5, shade(tint, 0.8)); g.fill();
      for (k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(0.48, k * 0.2); g.lineTo(0.78, k * 0.32); g.lineTo(0.58, k * 0.06); g.closePath(); g.fillStyle = shade(tint, 0.6); g.fill(); }
      ell(g, 0.42, 0, 0.22, 0.2); g.fillStyle = lit(g, 0.42, 0, 0.22, tint); g.fill();
      eye(g, 0.55, -0.09, 0.04, '#ff5a3c'); eye(g, 0.55, 0.09, 0.04, '#ff5a3c');
    },
    brute: function (g, tint, f) {
      var k, i, sw = f ? 0.16 : -0.16;
      g.lineCap = 'round';
      for (k = -1; k <= 1; k += 2) {
        g.strokeStyle = shade(tint, 0.55); g.lineWidth = 0.36; g.beginPath(); g.moveTo(-0.05, k * 0.8); g.lineTo(0.72 + k * sw, k * 0.74); g.stroke();
        ell(g, 0.75 + k * sw, k * 0.74, 0.25, 0.25); g.fillStyle = lit(g, 0.75 + k * sw, k * 0.74, 0.25, shade(tint, 0.9)); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.04; g.stroke();
      }
      ell(g, -0.12, 0, 0.62, 0.98); g.fillStyle = lit(g, -0.12, 0, 0.98, tint); g.fill(); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.05; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.3)'; for (i = 0; i < 4; i++) { ell(g, -0.6 + i * 0.17, 0, 0.07, 0.2 - i * 0.02); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.16)'; ell(g, -0.2, 0.55, 0.2, 0.14); g.fill(); ell(g, -0.3, -0.5, 0.16, 0.18); g.fill();
      for (k = -1; k <= 1; k += 2) {
        g.beginPath(); g.moveTo(0.22, k * 0.24); g.quadraticCurveTo(0.5, k * 0.62, 0.86, k * 0.66); g.quadraticCurveTo(0.6, k * 0.42, 0.46, k * 0.2); g.closePath();
        g.fillStyle = '#d9cdb0'; g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.04; g.stroke();
      }
      ell(g, 0.36, 0, 0.4, 0.4); g.fillStyle = lit(g, 0.36, 0, 0.4, shade(tint, 1.12)); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.04; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.09; g.beginPath(); g.arc(0.3, 0, 0.36, -0.75, 0.75); g.stroke();
      eye(g, 0.64, -0.15, 0.055, '#ffb347'); eye(g, 0.64, 0.15, 0.055, '#ffb347');
    },
    hero: function (g) {
      g.beginPath(); g.moveTo(0.45, -0.6); g.quadraticCurveTo(0.8, 0, 0.45, 0.6); g.quadraticCurveTo(-0.5, 0.85, -1.35, 0.1); g.quadraticCurveTo(-0.5, -0.85, 0.45, -0.6); g.closePath();
      g.fillStyle = lit(g, -0.2, 0, 1, '#3d4f7a'); g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.05; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.06; g.lineCap = 'round';
      for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-0.25, i * 0.14); g.quadraticCurveTo(-0.7, i * 0.24, -1.05, i * 0.12 + 0.08); g.stroke(); }
      g.strokeStyle = '#2c3a5c'; g.lineWidth = 0.22; g.beginPath(); g.moveTo(0.2, 0.42); g.lineTo(0.82, 0.52); g.stroke();
      ell(g, 0.88, 0.52, 0.1, 0.1); g.fillStyle = '#d9a982'; g.fill();
      ell(g, 0.1, 0, 0.44, 0.42); g.fillStyle = lit(g, 0.1, 0, 0.44, '#4f66a0'); g.fill(); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.05; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.3, 0); g.lineTo(0.4, 0); g.stroke();
      var gr = g.createRadialGradient(1.06, 0.52, 0, 1.06, 0.52, 0.75); gr.addColorStop(0, 'rgba(255,214,130,.9)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr; ell(g, 1.06, 0.52, 0.75, 0.75); g.fill();
      ell(g, 1.06, 0.52, 0.18, 0.18); g.fillStyle = '#2a2218'; g.fill(); ell(g, 1.06, 0.52, 0.12, 0.12); g.fillStyle = '#fff0c0'; g.fill();
    }
  };
  function rspr(arch, tint, r, f, flash) {
    var key = arch + tint + r + f + (flash ? 'f' : ''), c = realCache[key];
    if (c) return c;
    var size = Math.ceil(r * 2.5 * 2 * RS); c = mk(size, size);
    var g = c.getContext('2d'); g.translate(size / 2, size / 2); g.scale(r * RS, r * RS);
    REAL[arch](g, tint, f);
    if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,244,225,.8)'; g.fillRect(-3, -3, 6, 6); }
    return (realCache[key] = c);
  }
  function rblit(ctx, c, x, y, ang, sc) {
    var w = c.width / RS * (sc || 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(c, -w / 2, -w / 2, w, w); ctx.restore();
  }
  function rshadow(ctx, x, y, r, ang) {
    if (!shadowTex) {
      shadowTex = mk(64, 64); var g = shadowTex.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    var d = r * 0.45, s = r * 3;
    ctx.drawImage(shadowTex, x - Math.cos(ang) * d - s / 2, y - Math.sin(ang) * d - s / 2, s, s);
  }
  function makeGround() {
    var N = 512, c = mk(N, N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data, x, y, i, seed = 7;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }
    function vn(px, py, per, o) {
      var xi = Math.floor(px), yi = Math.floor(py), fx = px - xi, fy = py - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = hash(xi % per, yi % per + o), b = hash((xi + 1) % per, yi % per + o), e = hash(xi % per, (yi + 1) % per + o), f = hash((xi + 1) % per, (yi + 1) % per + o);
      return (a + (b - a) * fx) * (1 - fy) + (e + (f - e) * fx) * fy;
    }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var lo = vn(x / 64, y / 64, 8, 1000), mid = vn(x / 16, y / 16, 32, 2000), hi = vn(x / 4, y / 4, 128, 3000);
      var m = Math.min(1, Math.max(0, (lo * 0.7 + mid * 0.3 - 0.36) * 3.2)), b = 0.62 + 0.38 * mid + 0.3 * hi + (rnd() - 0.5) * 0.14;
      i = (y * N + x) * 4;
      d[i] = (40 + (48 - 40) * m) * b; d[i + 1] = (33 + (62 - 33) * m) * b; d[i + 2] = (23 + (30 - 23) * m) * b; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    function wrap(px, py, fn) { for (var oy = -N; oy <= N; oy += N) for (var ox = -N; ox <= N; ox += N) { g.save(); g.translate(px + ox, py + oy); fn(); g.restore(); } }
    g.lineCap = 'round';
    for (i = 0; i < 150; i++) (function () {
      var len = 10 + rnd() * 14, a = rnd() * TAU, bend = (rnd() - 0.5) * 10, col = 'hsl(' + (78 + rnd() * 30) + ',' + (26 + rnd() * 14) + '%,' + (17 + rnd() * 14) + '%)', lw = 1.2 + rnd() * 1.3;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = lw + 1; g.beginPath(); g.moveTo(1.5, 1.5); g.quadraticCurveTo(len / 2 + 1.5, bend + 1.5, len + 1.5, 1.5); g.stroke();
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len / 2, bend, len, 0); g.stroke(); });
    })();
    for (i = 0; i < 10; i++) (function () {
      var len = 22 + rnd() * 30, a = rnd() * TAU;
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 4; g.beginPath(); g.moveTo(2, 3); g.lineTo(len + 2, 3); g.stroke();
        g.strokeStyle = '#3d2e1d'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke(); g.strokeStyle = 'rgba(190,160,110,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -0.8); g.lineTo(len, -0.8); g.stroke(); });
    })();
    for (i = 0; i < 40; i++) (function () {
      var a = rnd() * TAU, s = 5 + rnd() * 5, col = 'hsl(' + (18 + rnd() * 28) + ',' + (38 + rnd() * 20) + '%,' + (20 + rnd() * 14) + '%)';
      wrap(rnd() * N, rnd() * N, function () { g.rotate(a); g.fillStyle = 'rgba(0,0,0,.4)'; ell(g, 1.5, 2, s, s * 0.45); g.fill(); g.fillStyle = col; ell(g, 0, 0, s, s * 0.45); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke(); });
    })();
    for (i = 0; i < 26; i++) (function () {
      var rx = 3 + rnd() * 8, ry = rx * (0.6 + rnd() * 0.35), a = rnd() * TAU, tone = 70 + rnd() * 50;
      wrap(rnd() * N, rnd() * N, function () { g.fillStyle = 'rgba(0,0,0,.45)'; ell(g, 2, 2.5, rx * 1.08, ry * 1.08, a); g.fill();
        var gr = g.createRadialGradient(-rx * 0.35, -ry * 0.35, 0.5, 0, 0, rx * 1.1); gr.addColorStop(0, 'rgb(' + (tone + 45) + ',' + (tone + 40) + ',' + (tone + 28) + ')'); gr.addColorStop(1, 'rgb(' + (tone * 0.42 | 0) + ',' + (tone * 0.4 | 0) + ',' + (tone * 0.38 | 0) + ')');
        g.fillStyle = gr; ell(g, 0, 0, rx, ry, a); g.fill(); });
    })();
    return c;
  }
  var gemCache = {};
  var real = {
    id: 'real', name: 'Lantern-lit Realism', pixel: 1, bg: '#0c0b09', gemsGlow: true,
    ui: { font: 'Baskerville, "Iowan Old Style", Georgia, "Times New Roman", serif', text: '#f2e6d0', dim: '#a39780',
      panel: 'rgba(10,9,8,.88)', accent: '#ffb347', hp: '#c8372d', xp: '#59c2c9', track: '#1b1814', edge: '#7a6642' },
    tints: ['#5f8a3a', '#7a4a2a', '#54406a', '#3f6f6a', '#8a3b34', '#b9b2a0'],
    gemTints: ['#59c2c9', '#7fd36a', '#ffcf5a'],
    ground: function (ctx, v) {
      if (!groundTex) groundTex = makeGround();
      tiles(v, TILE, function (i, j, x, y) { ctx.drawImage(groundTex, x, y, TILE + 0.6, TILE + 0.6); });
    },
    player: function (ctx, p, t) {
      var a = p.ang == null ? (p.face < 0 ? Math.PI : 0) : p.ang;
      rshadow(ctx, p.x + 2, p.y + 3, p.r, a);
      rblit(ctx, rspr('hero', '', p.r, 0, p.hurt), p.x, p.y + (p.moving ? Math.sin(t * 12) * 0.8 : 0), a);
    },
    enemy: function (ctx, e, t) {
      var f = 0, sc = 1;
      if (e.arch === 'bat') f = [0, 1, 2, 1][Math.floor(t * 14 + e.seed) % 4];
      else if (e.arch === 'blob') { f = Math.sin(t * 5 + e.seed) > 0 ? 1 : 0; sc = 1 + Math.sin(t * 5 + e.seed) * 0.04; }
      else f = Math.sin(t * (e.arch === 'dart' ? 16 : 5) + e.seed) > 0 ? 1 : 0;
      rshadow(ctx, e.x, e.y + (e.arch === 'bat' ? e.r * 1.2 : 0), e.r, e.ang);
      rblit(ctx, rspr(e.arch, this.tints[e.tint], e.r, f, e.hit > 0), e.x, e.y, e.ang, sc);
    },
    gem: function (ctx, g, t) {
      var c = gemCache[g.tier];
      if (!c) {
        c = gemCache[g.tier] = mk(48, 48); var q = c.getContext('2d'), tint = this.gemTints[g.tier], s = 5 + g.tier * 1.5;
        q.translate(24, 24); var gr = q.createRadialGradient(0, 0, 0, 0, 0, 22); gr.addColorStop(0, tint); gr.addColorStop(1, 'rgba(0,0,0,0)');
        q.globalAlpha = 0.5; q.fillStyle = gr; q.fillRect(-24, -24, 48, 48); q.globalAlpha = 1;
        q.beginPath(); q.moveTo(0, -s * 1.5); q.lineTo(s, -s * 0.4); q.lineTo(s * 0.8, s * 0.9); q.lineTo(0, s * 1.5); q.lineTo(-s * 0.8, s * 0.9); q.lineTo(-s, -s * 0.4); q.closePath();
        var lg = q.createLinearGradient(-s, -s, s, s); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.45, tint); lg.addColorStop(1, shade(tint, 0.35));
        q.fillStyle = lg; q.fill(); q.strokeStyle = 'rgba(255,255,255,.55)'; q.lineWidth = 1; q.beginPath(); q.moveTo(0, -s * 1.5); q.lineTo(0, s * 1.5); q.moveTo(-s, -s * 0.4); q.lineTo(s, -s * 0.4); q.stroke();
      }
      var k = 0.5 * (0.9 + 0.1 * Math.sin(t * 5 + g.x));
      ctx.drawImage(c, g.x - 24 * k, g.y - 24 * k, 48 * k, 48 * k);
    },
    /* called after the creatures are drawn: warm lantern pool, darkness beyond it, and eyes glinting out there */
    light: function (ctx, v, p, t, en) {
      var a = p.ang == null ? (p.face < 0 ? Math.PI : 0) : p.ang, lx = p.x + Math.cos(a) * p.r - Math.sin(a) * p.r * 0.5, ly = p.y + Math.sin(a) * p.r + Math.cos(a) * p.r * 0.5;
      var R = 340 * (p.lightMul || 1) * (1 + 0.025 * Math.sin(t * 13) + 0.02 * Math.sin(t * 7.3)), gr, i;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.75); gr.addColorStop(0, 'rgba(255,165,70,.3)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.globalCompositeOperation = 'source-over';
      gr = ctx.createRadialGradient(lx, ly, R * 0.15, lx, ly, R); gr.addColorStop(0, 'rgba(3,5,10,0)'); gr.addColorStop(0.55, 'rgba(3,5,10,.5)'); gr.addColorStop(1, 'rgba(3,5,10,.86)');
      ctx.fillStyle = gr; ctx.fillRect(v.x, v.y, v.w, v.h);
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < en.length; i++) {
        var e = en[i], d = Math.hypot(e.x - lx, e.y - ly), al = Math.min(1, (d - R * 0.5) / (R * 0.3)); if (al <= 0) continue;
        var cx = Math.cos(e.ang), sy = Math.sin(e.ang), fx = e.x + cx * e.r * 0.6, fy = e.y + sy * e.r * 0.6, sp = e.r * 0.24, er = Math.max(1.3, e.r * 0.08);
        ctx.fillStyle = e.arch === 'dart' || e.arch === 'bat' ? '#ff5a3c' : '#ffcf5a';
        ctx.globalAlpha = al * 0.3; circle(ctx, fx - sy * sp, fy + cx * sp, er * 2.6); ctx.fill(); circle(ctx, fx + sy * sp, fy - cx * sp, er * 2.6); ctx.fill();
        ctx.globalAlpha = al; circle(ctx, fx - sy * sp, fy + cx * sp, er); ctx.fill(); circle(ctx, fx + sy * sp, fy - cx * sp, er); ctx.fill();
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
    line: neon.line, ring: neon.ring
  };

  root.LL = root.LL || {};
  root.LL.SKINS = { neon: neon, cartoon: cartoon, pixel: pixel, ink: ink, real: real };
  root.LL.SKIN_ORDER = ['neon', 'cartoon', 'pixel', 'ink', 'real'];
})(typeof window !== 'undefined' ? window : this);
