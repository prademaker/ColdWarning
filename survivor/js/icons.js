/* Last Lantern: icons for weapons, passives and pickups, painted in code as glowing glyphs on a dark token. */
(function (root) {
  'use strict';
  var LL = root.LL, TAU = Math.PI * 2, cache = {};
  function C(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function O(g, x, y, r, w) { g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  function L(g, pts, w) { g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
  function P(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function cut(g, fn) { g.save(); g.globalCompositeOperation = 'destination-out'; fn(); g.restore(); }
  function rays(g, n, r0, r1, w, rot) { for (var i = 0; i < n; i++) { var a = (rot || 0) + i * TAU / n; L(g, [Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1], w); } }
  function heart(g) { g.beginPath(); g.moveTo(0, 0.85); g.bezierCurveTo(-1.3, -0.1, -0.6, -1.05, 0, -0.35); g.bezierCurveTo(0.6, -1.05, 1.3, -0.1, 0, 0.85); g.fill(); }
  function magnet(g) { g.lineCap = 'butt'; g.lineWidth = 0.36; g.beginPath(); g.moveTo(-0.55, -0.85); g.lineTo(-0.55, 0); g.arc(0, 0, 0.55, Math.PI, 0, true); g.lineTo(0.55, -0.85); g.stroke();
    cut(g, function () { g.fillRect(-0.8, -0.9, 0.5, 0.26); g.fillRect(0.3, -0.9, 0.5, 0.26); }); g.globalAlpha = 0.55; g.fillRect(-0.73, -0.9, 0.36, 0.22); g.fillRect(0.37, -0.9, 0.36, 0.22); g.globalAlpha = 1; }
  var GL = {
    spark: function (g) { P(g, [0, -1, 0.24, -0.24, 1, 0, 0.24, 0.24, 0, 1, -0.24, 0.24, -1, 0, -0.24, -0.24]); },
    halo: function (g) { O(g, 0, 0, 0.66, 0.1); for (var i = 0; i < 3; i++) C(g, Math.cos(i * TAU / 3 - 1.57) * 0.66, Math.sin(i * TAU / 3 - 1.57) * 0.66, 0.24); },
    glow: function (g) { C(g, 0, 0, 0.4); rays(g, 8, 0.62, 0.95, 0.15); },
    pulse: function (g) { C(g, 0, 0, 0.2); O(g, 0, 0, 0.5, 0.14); O(g, 0, 0, 0.88, 0.1); },
    flask: function (g) { C(g, 0, 0.3, 0.58); g.fillRect(-0.17, -0.75, 0.34, 0.6); L(g, [-0.3, -0.82, 0.3, -0.82], 0.16); cut(g, function () { C(g, -0.2, 0.2, 0.14); }); },
    arc: function (g) { g.lineJoin = 'miter'; P(g, [0.35, -1, -0.5, 0.1, -0.02, 0.1, -0.35, 1, 0.5, -0.2, 0.02, -0.2]); },
    glaive: function (g) { C(g, 0, 0, 0.92); cut(g, function () { C(g, 0.38, -0.22, 0.74); }); },
    thorns: function (g) { C(g, 0, 0, 0.2); rays(g, 8, 0.38, 0.95, 0.13, 0.39); },
    lance: function (g) { L(g, [0, 0.95, 0, -0.4], 0.2); P(g, [0, -1, 0.34, -0.38, -0.34, -0.38]); L(g, [-0.3, 0.55, 0.3, 0.55], 0.14); },
    mines: function (g) { C(g, 0, 0, 0.46); rays(g, 8, 0.46, 0.92, 0.17); cut(g, function () { C(g, 0, 0, 0.16); }); },
    wisp: function (g) { C(g, 0.3, -0.3, 0.38); g.lineWidth = 0.2; g.beginPath(); g.moveTo(0.1, -0.02); g.quadraticCurveTo(-0.2, 0.7, -0.85, 0.8); g.stroke(); g.lineWidth = 0.1; g.beginPath(); g.moveTo(-0.05, -0.3); g.quadraticCurveTo(-0.6, 0.1, -0.9, 0.35); g.stroke(); },
    frost: function (g) { rays(g, 6, 0, 0.95, 0.13, 0.52); for (var i = 0; i < 6; i++) { var a = 0.52 + i * TAU / 6, x = Math.cos(a) * 0.62, y = Math.sin(a) * 0.62; L(g, [x + Math.cos(a + 2.2) * 0.26, y + Math.sin(a + 2.2) * 0.26, x, y, x + Math.cos(a - 2.2) * 0.26, y + Math.sin(a - 2.2) * 0.26], 0.1); } },
    meteor: function (g) { C(g, -0.32, 0.36, 0.44); L(g, [0.0, -0.05, 0.9, -0.92], 0.18); L(g, [0.22, 0.34, 0.95, -0.36], 0.11); L(g, [-0.36, -0.2, 0.3, -0.92], 0.11); },
    whip: function (g) { g.lineWidth = 0.17; g.beginPath(); g.moveTo(-0.85, 0.8); g.quadraticCurveTo(-0.95, -0.7, 0, -0.6); g.quadraticCurveTo(0.95, -0.5, 0.65, 0.25); g.quadraticCurveTo(0.4, 0.7, 0.05, 0.35); g.stroke(); C(g, -0.85, 0.8, 0.16); },
    fan: function (g) { var t = [[-0.72, -0.62], [0, -0.98], [0.72, -0.62]]; for (var i = 0; i < 3; i++) { L(g, [0, 0.85, t[i][0] * 0.8, 0.85 + (t[i][1] - 0.85) * 0.8], 0.15); C(g, t[i][0], t[i][1], 0.15); } C(g, 0, 0.82, 0.18); },
    bounce: function (g) { C(g, 0.5, -0.5, 0.32); g.setLineDash([0.16, 0.2]); L(g, [-0.92, -0.3, -0.5, 0.82, -0.02, -0.05, 0.32, 0.6], 0.12); g.setLineDash([]); },
    might: function (g) { L(g, [0, -0.95, 0, 0.4], 0.24); L(g, [-0.42, 0.4, 0.42, 0.4], 0.17); L(g, [0, 0.4, 0, 0.92], 0.14); },
    haste: function (g) { g.lineJoin = 'round'; L(g, [-0.72, -0.62, -0.1, 0, -0.72, 0.62], 0.2); L(g, [0.02, -0.62, 0.64, 0, 0.02, 0.62], 0.2); },
    swift: function (g) { L(g, [-0.92, -0.42, -0.05, -0.42], 0.13); L(g, [-0.92, 0, 0.25, 0], 0.13); L(g, [-0.92, 0.42, -0.05, 0.42], 0.13); P(g, [0.28, -0.52, 0.96, 0, 0.28, 0.52]); },
    vital: heart, heal: heart, magnet: magnet,
    reach: function (g) { C(g, 0, 0, 0.3); g.setLineDash([0.3, 0.2]); O(g, 0, 0, 0.82, 0.12); g.setLineDash([]); },
    regen: function (g) { g.fillRect(-0.17, -0.8, 0.34, 1.6); g.fillRect(-0.8, -0.17, 1.6, 0.34); },
    armor: function (g) { g.beginPath(); g.moveTo(0, -0.92); g.lineTo(0.78, -0.62); g.lineTo(0.72, 0.1); g.quadraticCurveTo(0.5, 0.72, 0, 0.96); g.quadraticCurveTo(-0.5, 0.72, -0.72, 0.1); g.lineTo(-0.78, -0.62); g.closePath(); g.fill(); cut(g, function () { g.fillRect(-0.06, -0.6, 0.12, 1.2); }); },
    luck: function (g) { C(g, -0.34, -0.36, 0.36); C(g, 0.34, -0.36, 0.36); C(g, -0.34, 0.3, 0.36); C(g, 0.34, 0.3, 0.36); L(g, [0, 0.2, 0.3, 0.95], 0.12); },
    growth: function (g) { P(g, [0, -0.96, 0.72, -0.12, -0.72, -0.12]); g.fillRect(-0.22, -0.14, 0.44, 1.0); },
    coin: function (g) { C(g, 0, 0, 0.84); cut(g, function () { O(g, 0, 0, 0.56, 0.1); g.fillRect(-0.07, -0.34, 0.14, 0.68); }); },
    bomb: function (g) { C(g, -0.08, 0.24, 0.66); g.lineWidth = 0.13; g.beginPath(); g.moveTo(0.3, -0.3); g.quadraticCurveTo(0.5, -0.8, 0.8, -0.7); g.stroke(); rays(g, 5, 0.1, 0.24, 0.07); cut(g, function () { C(g, -0.3, 0.02, 0.15); }); },
    chest: function (g) { g.fillRect(-0.85, -0.02, 1.7, 0.8); g.beginPath(); g.moveTo(-0.85, -0.14); g.quadraticCurveTo(-0.85, -0.82, 0, -0.82); g.quadraticCurveTo(0.85, -0.82, 0.85, -0.14); g.closePath(); g.fill(); cut(g, function () { g.fillRect(-0.15, -0.22, 0.3, 0.46); }); C(g, 0, 0.02, 0.09); }
  };
  /* returns a square canvas; bare = glyph only, for use in the world */
  LL.icon = function (id, color, bare) {
    var key = id + color + (bare ? 'b' : ''), c = cache[key];
    if (c) return c;
    var N = 96, t = document.createElement('canvas'); t.width = t.height = N;
    var g = t.getContext('2d'); g.translate(N / 2, N / 2); g.scale(N * 0.27, N * 0.27);
    g.fillStyle = g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    (GL[id] || GL.spark)(g);
    c = document.createElement('canvas'); c.width = c.height = N; g = c.getContext('2d');
    if (!bare) {
      var gr = g.createRadialGradient(N / 2, N * 0.4, 4, N / 2, N / 2, N / 2); gr.addColorStop(0, '#3a3024'); gr.addColorStop(1, '#0e0c09');
      g.fillStyle = gr; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 3, 0, TAU); g.fill(); g.strokeStyle = '#7a6642'; g.lineWidth = 3; g.stroke();
    }
    g.shadowColor = color; g.shadowBlur = bare ? 14 : 10; g.drawImage(t, 0, 0); g.shadowBlur = 0; g.globalAlpha = 0.6; g.drawImage(t, 0, 0);
    return (cache[key] = c);
  };
  var urls = {};
  LL.iconURL = function (id, color) { var k = id + color; return urls[k] || (urls[k] = LL.icon(id, color).toDataURL()); };
  LL.pickCol = { heal: 'hp', magnet: 'xp', bomb: 't1', chest: 'accent', coin: 'g2' };
})(typeof window !== 'undefined' ? window : this);
