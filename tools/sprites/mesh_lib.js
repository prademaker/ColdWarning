// Shared helpers for the game's low-poly models: materials, primitives and the JSON writer.
//
// A model is a list of primitives (boxes, cylinders, extruded profiles, spheres) in model units,
// written to assets/models/<name>.json and turned into meshes by render.html. One unit is the
// size the old voxels had, so models keep the same on-screen scale.
//
// Axes: x forward, y to the right, z up; the origin is the model's pivot (ground centre for
// vehicles and soldiers, footprint centre for structures).
//
// Materials: 'camo' surfaces are painted in the faction colour in game, 'team' surfaces in the
// player colour. Everything else keeps its own colour.
'use strict';
const fs = require('fs');
const path = require('path');

// A restrained palette: muted, slightly warm greys and real-world material colours.
const MAT = {
  camo: { c: [206, 206, 200], camo: 1 },          // main paint, tinted per faction in game
  camoDark: { c: [160, 160, 154], camo: 1 },      // the same paint in shade (recesses, lower hull)
  camoLight: { c: [228, 228, 222], camo: 1 },
  team: { c: [200, 200, 200], team: 1 },          // player colour
  teamDark: { c: [150, 150, 150], team: 1 },
  track: { c: [52, 52, 48] }, rubber: { c: [38, 38, 36] }, hub: { c: [96, 96, 88] },
  steel: { c: [104, 108, 106] }, steelDark: { c: [66, 69, 68] }, gun: { c: [70, 72, 68] }, gunDark: { c: [46, 47, 45] },
  grille: { c: [40, 41, 40] }, glass: { c: [58, 84, 104], shiny: 1 }, glassLight: { c: [120, 160, 190], shiny: 1 },
  light: { c: [255, 232, 170], glow: 1 }, red: { c: [178, 46, 38] }, redLight: { c: [255, 80, 60], glow: 1 },
  white: { c: [226, 228, 224] }, black: { c: [30, 31, 32] }, hazard: { c: [206, 166, 52] },
  skin: { c: [196, 156, 122] }, olive: { c: [102, 106, 78] }, canvas: { c: [138, 128, 100] }, wood: { c: [128, 92, 60] },
  concrete: { c: [176, 174, 166] }, concreteDark: { c: [134, 132, 126] }, concreteLight: { c: [200, 198, 190] },
  asphalt: { c: [74, 76, 76] }, roof: { c: [120, 124, 122] }, roofDark: { c: [92, 96, 94] },
  metal: { c: [150, 154, 152] }, metalLight: { c: [186, 188, 184] }, copper: { c: [168, 108, 62] },
  ore: { c: [222, 176, 70] }, oreDark: { c: [160, 120, 40] }, cyan: { c: [110, 220, 240], glow: 1 },
  hull: { c: [138, 144, 148] }, hullDark: { c: [100, 106, 110] }, deck: { c: [84, 88, 88] }, flightDeck: { c: [66, 70, 72] }, deckRust: { c: [112, 70, 58] }, boot: { c: [130, 48, 42] },
  warm: { c: [170, 162, 144] }, warmDark: { c: [122, 116, 104] }, brick: { c: [134, 78, 58] }, roofGreen: { c: [92, 100, 86] }, sand: { c: [150, 134, 96] },
  jet: { c: [150, 156, 162] }, jetDark: { c: [108, 114, 120] }, jetBlue: { c: [118, 140, 162] }, orange: { c: [214, 112, 44] }, flame: { c: [255, 170, 70], glow: 1 },
};

const OUT = path.join(__dirname, '..', '..', 'assets', 'models');

// Model builder. Every primitive takes a material name and optional rotation r = [roll, pitch, yaw]
// in degrees (pitch > 0 raises the nose, yaw > 0 turns towards +y).
function model() {
  const parts = { hull: [] };
  let cur = parts.hull;
  const stack = [];
  const push = p => { cur.push(p); return api; };
  const api = {
    parts, mount: null,
    // switch the part primitives go into ('hull' or 'turret'); the turret's own origin is its pivot
    part(name, mount) { parts[name] = parts[name] || []; cur = parts[name]; if (mount) api.mount = mount; return api; },
    // box from corner ranges
    box(x0, x1, y0, y1, z0, z1, m, o = {}) { return push({ t: 'box', p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], s: [x1 - x0, y1 - y0, z1 - z0], m, ...o }); },
    // box from centre and size
    cbox(p, s, m, o = {}) { return push({ t: 'box', p, s, m, ...o }); },
    // cylinder: centre p, radius, length, axis 'x' | 'y' | 'z'; r2 = radius at the +axis end
    cyl(p, rad, len, axis, m, o = {}) { return push({ t: 'cyl', p, rad, len, axis, m, ...o }); },
    sph(p, rad, m, o = {}) { return push({ t: 'sph', p, rad, m, ...o }); },
    // extruded profile. plane 'side': pts are [x, z], extruded across y from a to b.
    // 'top': pts are [x, y], extruded up from a to b. 'front': pts are [y, z], extruded along x from a to b.
    ext(plane, pts, a, b, m, o = {}) { return push({ t: 'ext', plane, pts, a, b, m, ...o }); },
    // group with its own transform: everything added inside fn is moved/rotated together
    group(p, r, fn) {
      const g = { t: 'grp', p, r, c: [] };
      cur.push(g); stack.push(cur); cur = g.c; fn(api); cur = stack.pop();
      return api;
    },
    // mirror helper: run fn for y = +1 and y = -1 sides
    sides(fn) { fn(1); fn(-1); return api; },
  };
  return api;
}

function writeModel(name, m, extra = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const used = {};
  const walk = l => l.forEach(p => { if (p.t === 'grp') walk(p.c); else used[p.m] = MAT[p.m] || (() => { throw new Error(name + ': no material ' + p.m); })(); });
  Object.values(m.parts).forEach(walk);
  const out = { parts: m.parts, mount: m.mount, mats: used, ...extra };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(out));
  const n = Object.values(m.parts).reduce((s, l) => s + count(l), 0);
  console.log('wrote', name, n, 'primitives');
}
const count = l => l.reduce((s, p) => s + (p.t === 'grp' ? count(p.c) : 1), 0);

module.exports = { MAT, model, writeModel };
