// Low-poly land and air units: clean shapes, real-world proportions, one coat of paint.
//
//   node mesh_units.js
//
// Writes assets/models/<name>.json; render.js turns them into sprite sheets. Names follow the
// old voxel files (tank_hull.vox -> tank), so every sprite key keeps working:
//   <unit>        Allied look          <unit>_ax       Axis look (PR #21 split)
//   <unit>_up     reactive armour / body armour research look
// Axes: x forward, y to the right, z up; the origin is the ground point under the pivot.
'use strict';
const { model, writeModel } = require('./mesh_lib');

// ---------- shared parts ----------
// a track run seen from the side: rounded ends, road wheels showing below the skirt
function tracks(m, x0, x1, yOut, w, h = 4.2, o = {}) {
  const pts = [[x0 + 1.2, 0], [x1 - 1.6, 0], [x1, h * 0.55], [x1 - 0.6, h], [x0 + 0.4, h], [x0 - 0.6, h * 0.5]];
  m.sides(s => {
    const a = s > 0 ? yOut - w : -yOut, b = s > 0 ? yOut : -yOut + w;
    m.ext('side', pts, a, b, 'track');
    const n = o.wheels || 7, step = (x1 - x0 - 3.4) / (n - 1), r = o.wheelR || 1.3;
    for (let i = 0; i < n; i++) m.cyl([x0 + 1.7 + i * step, s * (yOut + 0.05), r + 0.05], r, 0.2, 'y', o.wheelMat || 'hub', { seg: 12 });
    m.cyl([x1 - 0.9, s * (yOut + 0.05), h * 0.55], 1.0, 0.2, 'y', 'steelDark', { seg: 10 }); // drive sprocket
  });
}
function wheel(m, x, y, r = 1.9, w = 1.5) {
  m.cyl([x, y, r], r, w, 'y', 'rubber', { seg: 14 });
  m.cyl([x, y + Math.sign(y) * w / 2, r], r * 0.55, 0.2, 'y', 'hub', { seg: 10 });
}
const wheels = (m, xs, y, r, w) => xs.forEach(x => m.sides(s => wheel(m, x, s * y, r, w)));
// a hull from a side profile, symmetric across y
const hullSide = (m, pts, hw, mat = 'camo') => m.ext('side', pts, -hw, hw, mat);
// a long gun barrel along +x starting at x0
function barrel(m, x0, len, z, r = 0.45, o = {}) {
  m.cyl([x0 + len / 2, o.y || 0, z], r, len, 'x', o.mat || 'gun', { r2: r * 0.9 });
  if (o.muzzle) m.cyl([x0 + len - 0.5, o.y || 0, z], r * 1.5, 1.0, 'x', 'gunDark');
}
// reactive-armour bricks along a run (research look)
function eraRow(m, x0, x1, y, z0, z1, step = 2.2, face = 1) {
  for (let x = x0; x + step * 0.8 <= x1; x += step) m.box(x, x + step * 0.85, y - (face > 0 ? 0 : 0.6), y + (face > 0 ? 0.6 : 0), z0, z1, 'camoDark');
}
const sideEra = (m, x0, x1, y, z0, z1, step) => m.sides(s => eraRow(m, x0, x1, s * y, z0, z1, step, s));
function antenna(m, x, y, z, h = 6) { m.cyl([x, y, z + h / 2], 0.07, h, 'z', 'black', { seg: 4 }); }
function teamFlank(m, x0, x1, y, z0, z1) { m.sides(s => m.box(x0, x1, s * y - 0.06, s * y + 0.06, z0, z1, 'team')); }

// ---------- Main battle tank ----------
// Allied: Abrams-style wedge turret and side skirts. Axis: T-90-style low cast turret with
// reactive-armour chevrons, exposed road wheels and fuel drums on the back.
function tank(ax, up) {
  const m = model();
  if (!ax) {
    tracks(m, -14.5, 14.5, 7.2, 3.2);
    hullSide(m, [[-14.6, 1.6], [-14.6, 6.0], [9.5, 6.0], [15.2, 4.2], [15.2, 2.6], [13.2, 1.6]], 4.2, 'camoDark');
    m.sides(s => m.ext('side', [[-14.8, 4.2], [-14.8, 6.0], [10, 6.0], [15.4, 4.4], [15.4, 4.2]], s > 0 ? 4.0 : -7.5, s > 0 ? 7.5 : -4.0, 'camo'));
    m.sides(s => m.ext('side', [[-12.5, 2.4], [-12.5, 4.3], [13.6, 4.3], [13.6, 2.4]], s > 0 ? 7.45 : -7.75, s > 0 ? 7.75 : -7.45, 'camo'));
    if (up) sideEra(m, -11.5, 13, 7.75, 2.5, 4.2, 2.4);
    m.box(-14.4, -9, -6.5, 6.5, 6.0, 6.35, 'grille');
    m.box(-14.75, -14.55, -3.5, 3.5, 3.0, 5.2, 'team');
    m.box(9.6, 11.2, -1.0, 1.0, 5.8, 6.4, 'steelDark');
    m.sides(s => m.box(14.6, 15.25, s * 5.8 - 0.6, s * 5.8 + 0.6, 3.8, 4.4, 'light'));
    m.part('turret', [-1.5, 0, 6.0]);
    const T = [[8.5, -2.3], [8.5, 2.3], [5, 6.1], [-6.2, 6.1], [-8.6, 4.6], [-8.6, -4.6], [-6.2, -6.1], [5, -6.1]];
    m.ext('top', T, 0, 2.2, 'camo');
    m.ext('top', T.map(([x, y]) => [x * 0.97 - 0.2, y * 0.96]), 2.2, 3.5, 'camo');
    m.ext('top', T.map(([x, y]) => [x * 1.005, y * 1.01]), 1.4, 2.3, 'team');
    if (up) { m.sides(s => eraRow(m, -5, 4, s * 6.2, 0.3, 1.4, 2.2, s)); m.box(-2, 1.5, -1.6, 1.6, 3.5, 4.0, 'gunDark'); }
    m.box(-11.2, -8.4, -4.8, 4.8, 0.6, 3.0, 'steelDark');
    m.box(-11.0, -8.6, -4.5, 4.5, 3.0, 3.3, 'olive');
    m.box(7.8, 9.6, -1.5, 1.5, 0.5, 2.8, 'gunDark');
    m.cyl([12.6, 0, 1.7], 0.62, 6.4, 'x', 'gun');
    barrel(m, 15.4, 7.2, 1.7, 0.45);
    m.cyl([16.1, 0, 1.7], 0.72, 1.2, 'x', 'gunDark');
    m.cyl([-2.2, 3.1, 3.9], 1.25, 0.8, 'z', 'steel', { seg: 10 });
    m.box(-1.8, 0.2, 2.8, 3.4, 4.3, 4.6, 'gunDark');
    m.box(1.5, 3.6, -4.0, -2.4, 3.5, 4.7, 'steelDark');
    m.box(3.55, 3.7, -3.8, -2.6, 3.8, 4.5, 'glass');
    antenna(m, -6.5, -4.2, 3.5);
  } else {
    tracks(m, -14.5, 14.5, 7.0, 3.0, 4.0, { wheels: 6, wheelR: 1.6, wheelMat: 'steel' });
    hullSide(m, [[-14.8, 1.6], [-14.8, 5.4], [9, 5.4], [15.4, 3.8], [15.4, 2.4], [13.4, 1.6]], 4.2, 'camoDark');
    m.sides(s => m.ext('side', [[-15, 4.6], [-15, 5.4], [9.6, 5.4], [15.6, 3.9], [15.6, 3.6]], s > 0 ? 4.0 : -7.4, s > 0 ? 7.4 : -4.0, 'camo'));
    m.sides(s => m.box(-13.5, 9, s * 7.35 - 0.12, s * 7.35 + 0.12, 4.2, 5.4, 'camo')); // short rubber skirt plates
    // reactive-armour chevron on the glacis
    m.sides(s => m.box(10, 14.4, s * 2.8 - 2.4, s * 2.8 + 2.4, 4.0, 4.9, 'camoDark', { r: [0, -16, s * 18] }));
    if (up) { sideEra(m, -12, 9, 7.5, 3.8, 5.6, 2.0); m.box(-13.6, -10, -6.6, 6.6, 5.4, 6.6, 'steelDark'); }
    m.sides(s => m.cyl([-15.6, s * 3.2, 4.8], 1.2, 5.4, 'y', 'camoDark', { seg: 12 })); // fuel drums
    m.box(-14.4, -9.4, -6, 6, 5.4, 5.7, 'grille');
    m.box(-15.05, -14.85, -2.4, 2.4, 2.6, 4.2, 'team');
    m.sides(s => m.box(14.9, 15.6, s * 5.4 - 0.5, s * 5.4 + 0.5, 3.4, 3.9, 'light'));
    m.part('turret', [-0.5, 0, 5.4]);
    // low cast turret: a flattened dome with flat cheeks
    m.sph([0, 0, 0.4], 6.2, 'camo', { s: [1.05, 1, 0.48], seg: 18 });
    m.cyl([0, 0, 0.5], 6.1, 1.0, 'z', 'team', { seg: 18 });
    m.sides(s => m.box(2.2, 6.6, s * 2.9 - 1.6, s * 2.9 + 1.6, 0.6, 2.3, 'camoDark', { r: [0, 0, s * 22] })); // ERA cheeks
    if (up) { m.sides(s => m.box(-4, 2, s * 5.2 - 0.6, s * 5.2 + 0.6, 0.4, 2.0, 'camoDark')); m.box(-4.5, -1, -2.5, 2.5, 3.0, 3.4, 'gunDark'); }
    m.box(-8.4, -5.6, -4.2, 4.2, 0.6, 2.2, 'olive');                                       // stowage bin
    m.box(5.8, 7.4, -1.2, 1.2, 0.6, 2.4, 'gunDark');
    barrel(m, 7.2, 14, 1.5, 0.5, { muzzle: false });
    m.cyl([11, 0, 1.5], 0.62, 4, 'x', 'gun');
    m.cyl([-1.4, -2.4, 2.9], 1.1, 0.8, 'z', 'steel', { seg: 10 });
    m.box(-0.6, 1.4, -2.9, -1.9, 3.2, 3.5, 'gunDark');
    m.box(1.0, 3.0, 1.7, 3.3, 2.4, 3.6, 'steelDark'); m.box(2.95, 3.1, 2.0, 3.0, 2.8, 3.4, 'glass');
    antenna(m, -5.5, 3.6, 2.2);
  }
  writeModel('tank' + (ax ? '_ax' : '') + (up ? '_up' : ''), m);
}

// ---------- Recon IFV: 8x8 wheeled carrier, remote turret with autocannon and missile pod ----------
function ifv(up) {
  const m = model();
  wheels(m, [-8, -3.2, 3.6, 8.4], 5.6, 2.0, 1.6);
  hullSide(m, [[-12.4, 2.4], [-12.4, 7.2], [6.5, 7.2], [12.6, 4.2], [12.6, 2.6], [10.8, 1.6], [-11, 1.6]], 4.9, 'camo');
  m.box(-12, 9, -5.1, 5.1, 4.8, 5.4, 'camoDark');                                          // side rub strip
  teamFlank(m, -11, 6, 4.95, 5.8, 6.4);
  if (up) { sideEra(m, -10.5, 6, 5.1, 3.4, 5.6, 2.2); m.box(8, 11.4, -4, 4, 4.4, 6.4, 'camoDark', { r: [0, -25, 0] }); }
  m.box(-12.6, -12.4, -3, 3, 2.6, 6.2, 'steelDark');                                       // rear ramp
  m.box(7, 9, -4, -1.6, 7.1, 7.6, 'steelDark'); m.box(8.9, 9.05, -3.8, -1.8, 7.2, 7.5, 'glass');
  m.sides(s => m.box(12.3, 12.75, s * 3.6 - 0.5, s * 3.6 + 0.5, 4.4, 5.0, 'light'));
  antenna(m, -11, -4, 7.2, 7);
  m.part('turret', [-1, 0, 7.2]);
  m.ext('top', [[3.6, -1.8], [3.6, 1.8], [2, 3], [-3.6, 3], [-3.6, -3], [2, -3]], 0, 2.2, 'camo');
  m.ext('top', [[3.62, -1.82], [3.62, 1.82], [2, 3.02], [-3.62, 3.02], [-3.62, -3.02], [2, -3.02]], 1.2, 1.7, 'team');
  barrel(m, 3.4, 8.5, 1.2, 0.3, { muzzle: true });
  m.box(-2.6, 2.4, 3.1, 4.6, 0.6, 2.4, 'olive');                                            // missile pod
  m.sides(s => m.cyl([2.5, 3.85 + s * 0.4, 1.5], 0.32, 0.2, 'x', 'gunDark', { seg: 8 }));
  m.box(-1.2, 0.6, -2.2, -0.8, 2.2, 3.2, 'steelDark'); m.box(0.55, 0.7, -2.0, -1.0, 2.5, 3.0, 'glass');
  writeModel('ifv' + (up ? '_up' : ''), m);
}

// ---------- Flak Track: tracked Gepard/Tunguska: twin cannons either side of a radar turret ----------
function flak(up) {
  const m = model();
  tracks(m, -12.5, 12.5, 8.2, 3.0, 3.8, { wheels: 6 });
  hullSide(m, [[-12.8, 1.4], [-12.8, 5.6], [8.5, 5.6], [13.2, 3.6], [13.2, 2.2], [11, 1.4]], 5.2, 'camoDark');
  m.sides(s => m.ext('side', [[-13, 3.8], [-13, 5.6], [8.8, 5.6], [13.4, 3.8]], s > 0 ? 5.0 : -8.4, s > 0 ? 8.4 : -5.0, 'camo'));
  if (up) sideEra(m, -11, 9, 8.4, 3.0, 4.8, 2.2);
  m.box(-12.6, -8, -5, 5, 5.6, 5.9, 'grille');
  m.box(-13.05, -12.85, -2.5, 2.5, 2.4, 4.6, 'team');
  m.part('turret', [-1.5, 0, 5.6]);
  m.ext('top', [[5, -3], [5, 3], [3, 4.6], [-5.5, 4.6], [-5.5, -4.6], [3, -4.6]], 0, 3.4, 'camo');
  m.ext('top', [[5.02, -3.02], [5.02, 3.02], [3, 4.62], [-5.52, 4.62], [-5.52, -4.62], [3, -4.62]], 2.0, 2.6, 'team');
  m.sides(s => { m.box(-1.5, 4.2, s * 5.6 - 0.9, s * 5.6 + 0.9, 1.4, 3.4, 'camoDark'); barrel(m, 4, 8, 2.4, 0.3, { y: s * 5.6, muzzle: true }); });
  m.cyl([-3.8, 0, 4.4], 0.3, 2, 'z', 'steelDark', { seg: 6 });
  m.box(-4.6, -3.4, -3, 3, 4.8, 6.4, 'steelDark', { r: [0, 0, 0] });                     // search radar
  m.box(4.4, 5.6, -2, 2, 1.6, 3.2, 'gunDark');                                           // tracking radar dish
  writeModel('flak' + (up ? '_up' : ''), m);
}

// ---------- truck cab (forward-control, flat front) ----------
function cab(m, x0, x1, hw, h, o = {}) {
  hullSide(m, [[x0, 2.6], [x0, h], [x1 - 1.4, h], [x1, h - 1.6], [x1, 2.6]], hw, o.mat || 'camo');
  m.box(x1 - 0.05, x1 + 0.05, -hw + 0.7, hw - 0.7, h - 3.4, h - 1.8, 'glass');
  m.sides(s => m.box(x1 - 4.2, x0 + 4.4 > x1 - 1.4 ? x1 - 1.6 : x0 + 4.4, s * hw - 0.05, s * hw + 0.05, h - 3.2, h - 1.8, 'glass'));
  m.sides(s => m.box(x1 - 0.1, x1 + 0.15, s * (hw - 0.9) - 0.5, s * (hw - 0.9) + 0.5, 3.2, 3.8, 'light'));
  m.box(x0 + 0.3, x1 - 1.6, -hw - 0.04, hw + 0.04, h - 0.6, h - 0.2, 'team');
}

// ---------- MLRS: 6x6 truck with a rotating rocket pod ----------
function mlrs(up) {
  const m = model();
  wheels(m, [-9, -4.6, 8.6], 5.4, 1.9, 1.4);
  m.box(-12.6, 12, -3.4, 3.4, 2.2, 3.4, 'steelDark');                                     // chassis
  cab(m, 5.6, 13.4, 5.6, 9.2);
  m.box(-12.8, 5.4, -5.4, 5.4, 3.4, 4.4, 'camoDark');                                     // flat bed
  if (up) { m.sides(s => eraRow(m, 6.6, 12.4, s * 5.6, 3.2, 5.6, 2.2, s)); m.box(13.3, 13.9, -4.4, 4.4, 4.6, 7.2, 'grille'); }
  m.part('turret', [-4, 0, 4.4]);
  m.box(-1, 1, -2, 2, 0, 1.2, 'steelDark');
  m.group([0, 0, 1.0], [0, 12, 0], () => {
    m.box(-7.8, 7.4, -4.4, 4.4, 0, 5.0, 'camo');
    m.box(-7.85, 7.45, -4.45, 4.45, 3.4, 4.0, 'team');
    m.box(7.4, 7.5, -3.9, 3.9, 0.5, 4.5, 'gunDark');
    for (let y = -3; y <= 3; y += 2) for (let z = 1.2; z < 4.4; z += 1.4) m.cyl([7.5, y, z], 0.5, 0.1, 'x', 'black', { seg: 8 });
  });
  writeModel('mlrs' + (up ? '_up' : ''), m);
}

// ---------- TOS: tank chassis carrying a tilted box of 24 thermobaric tubes ----------
function tos(up) {
  const m = model();
  tracks(m, -14, 14, 7.4, 3.0, 4.0, { wheels: 6, wheelR: 1.6, wheelMat: 'steel' });
  hullSide(m, [[-14.4, 1.6], [-14.4, 5.4], [9, 5.4], [14.8, 3.8], [14.8, 2.4], [13, 1.6]], 4.4, 'camoDark');
  m.sides(s => m.ext('side', [[-14.6, 4.4], [-14.6, 5.4], [9.4, 5.4], [15, 3.8], [15, 3.6]], s > 0 ? 4.2 : -7.6, s > 0 ? 7.6 : -4.2, 'camo'));
  m.sides(s => m.box(-13.4, 9, s * 7.55 - 0.12, s * 7.55 + 0.12, 3.4, 5.4, 'camo'));
  if (up) sideEra(m, -12, 9, 7.7, 3.6, 5.2, 2.0);
  m.box(-14.85, -14.65, -2.4, 2.4, 2.6, 4.2, 'team');
  m.box(9, 12, -2.2, 2.2, 5.0, 5.6, 'steelDark');
  m.part('turret', [-2, 0, 5.4]);
  m.cyl([0, 0, 0.6], 3.5, 1.2, 'z', 'camoDark', { seg: 14 });
  m.group([-1.2, 0, 1.4], [0, 18, 0], () => {
    m.box(-7.6, 8.6, -6.2, 6.2, 0, 5.4, 'camo');
    m.box(-7.65, 8.65, -6.25, 6.25, 3.8, 4.5, 'team');
    m.box(8.6, 8.7, -5.8, 5.8, 0.4, 5.0, 'gunDark');
    for (let y = -5; y <= 5; y += 2) for (let z = 1.1; z < 5; z += 1.3) m.cyl([8.72, y, z], 0.55, 0.08, 'x', 'black', { seg: 8 });
  });
  writeModel('tos' + (up ? '_up' : ''), m);
}

// ---------- Iskander: 8x8 launcher, two missiles on an erector hinged at the back ----------
function iskander(up) {
  const m = model();
  wheels(m, [-11, -6.4, 3.4, 8], 5.6, 2.0, 1.5);
  m.box(-16.4, 10.6, -3.6, 3.6, 2.4, 3.8, 'steelDark');
  cab(m, 10, 17, 5.8, 8.6);
  m.box(-16.6, 9.6, -5.6, 5.6, 3.8, 5.0, 'camoDark');
  m.box(-16.6, -15.2, -5.6, 5.6, 1.0, 5.0, 'camoDark');                                    // stabiliser jacks
  if (up) m.sides(s => eraRow(m, 10.6, 16.4, s * 5.8, 3.2, 5.4, 2.0, s));
  m.part('turret', [-15, 0, 5.0]);
  m.box(0, 26, -4.6, 4.6, 0, 0.8, 'steelDark');                                            // erector frame
  m.sides(s => {
    m.cyl([12.6, s * 2.2, 2.2], 1.4, 23, 'x', 'camoLight', { seg: 14 });
    m.cyl([25.2, s * 2.2, 2.2], 1.4, 2.4, 'x', 'camoLight', { r2: 0.2, seg: 14 });
    m.cyl([4.5, s * 2.2, 2.2], 1.45, 1.4, 'x', 'team', { seg: 14 });
    for (const a of [0, 90]) m.box(1.2, 3.2, s * 2.2 - 0.08, s * 2.2 + 0.08, 0.2, 4.2, 'camoDark', { r: [a, 0, 0] });
  });
  writeModel('iskander' + (up ? '_up' : ''), m);
}

// ---------- Aegis Shield Carrier: 6x6 armoured carrier with a shield emitter dish ----------
function aegis(up) {
  const m = model();
  wheels(m, [-7.4, -2.2, 7.6], 5.4, 2.0, 1.5);
  hullSide(m, [[-12.4, 2.4], [-12.4, 7.6], [6, 7.6], [12.6, 4.4], [12.6, 2.6], [10.8, 1.6], [-11, 1.6]], 5.0, 'camo');
  teamFlank(m, -11, 6, 5.05, 6.0, 6.6);
  if (up) sideEra(m, -10.5, 6, 5.2, 3.4, 5.8, 2.2);
  m.box(7, 9, -3.8, -1.4, 7.5, 8, 'steelDark'); m.box(8.9, 9.05, -3.6, -1.6, 7.6, 7.9, 'glass');
  m.sides(s => m.box(12.3, 12.75, s * 3.6 - 0.5, s * 3.6 + 0.5, 4.4, 5.0, 'light'));
  m.part('turret', [-2, 0, 7.6]);
  m.cyl([0, 0, 0.8], 3.6, 1.6, 'z', 'camoDark', { seg: 16 });
  m.cyl([0, 0, 2.2], 1.2, 1.4, 'z', 'steel', { seg: 10 });
  m.sph([0, 0, 2.9], 4.4, 'metalLight', { s: [1, 1, 0.35], seg: 20 });
  m.cyl([0, 0, 3.8], 1.0, 0.6, 'z', 'cyan', { seg: 12 });
  m.cyl([0, 0, 1.2], 3.65, 0.6, 'z', 'team', { seg: 16 });
  writeModel('aegis' + (up ? '_up' : ''), m);
}

// ---------- Raijin: two-legged EMP walker; legs are the hull, the cockpit-and-coil body turns ----------
function raijin(up) {
  const m = model();
  m.sides(s => {
    m.box(-2.6, 3.4, s * 4.6 - 1.4, s * 4.6 + 1.4, 0, 0.9, 'steelDark');                  // feet
    m.box(-1.0, 1.0, s * 4.6 - 0.8, s * 4.6 + 0.8, 0.9, 5.6, 'camoDark', { r: [0, -14, 0] }); // shins
    m.box(-0.8, 1.6, s * 4.6 - 1.0, s * 4.6 + 1.0, 5.2, 10.4, 'camo', { r: [0, 18, 0] });  // thighs
    m.cyl([0.6, s * 4.6, 5.4], 1.1, 2.4, 'y', 'steel', { seg: 10 });                       // knees
    if (up) m.box(-0.2, 2.4, s * 4.6 - 1.2, s * 4.6 + 1.2, 6, 9.6, 'camoDark', { r: [0, 18, 0] });
  });
  m.box(-1.8, 1.8, -4, 4, 9.8, 11.4, 'steelDark');                                           // hips
  m.part('turret', [0, 0, 11.4]);
  m.ext('top', [[5, -2.6], [5, 2.6], [2.4, 5], [-5, 5], [-6, 3], [-6, -3], [-5, -5], [2.4, -5]], 0, 4.2, 'camo');
  m.ext('top', [[5.02, -2.62], [5.02, 2.62], [2.4, 5.02], [-5.02, 5.02], [-6.02, 3], [-6.02, -3], [-5.02, -5.02], [2.4, -5.02]], 2.4, 3.1, 'team');
  m.box(3.6, 5.1, -2.2, 2.2, 1.6, 3.4, 'glass');                                              // canopy
  m.sides(s => {                                                                                 // EMP coil arms
    m.cyl([6, s * 6, 2.2], 1.0, 9, 'x', 'steel', { seg: 10 });
    for (const x of [4.5, 6.5, 8.5]) m.cyl([x, s * 6, 2.2], 1.25, 0.6, 'x', 'cyan', { seg: 10 });
    m.sph([10.6, s * 6, 2.2], 0.9, 'cyan', { seg: 10 });
  });
  if (up) m.box(-4.4, 1, -4, 4, 4.2, 5, 'camoDark');
  antenna(m, -4.5, 3.4, 4.2, 4);
  writeModel('raijin' + (up ? '_up' : ''), m);
}

// ---------- Demolition truck: cargo truck under a tarp, crates of explosive and a warning stripe ----------
function demotruck(up) {
  const m = model();
  wheels(m, [-7.8, -3.6, 8], 5.2, 1.8, 1.3);
  m.box(-12, 11.4, -3, 3, 2.0, 3.2, 'steelDark');
  cab(m, 5.4, 12.6, 5.4, 8.6);
  m.box(-12.4, 5, -5.4, 5.4, 3.2, 4.2, 'camoDark');
  // tarp over a rounded frame
  const tarp = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; tarp.push([-Math.cos(a) * 5.2, 4.2 + 3.2 + Math.sin(a) * 2.2]); }
  m.ext('front', [[-5.2, 4.2], ...tarp, [5.2, 4.2]], -12.2, 4.4, 'canvas');
  m.box(-12.3, 4.5, -5.35, 5.35, 4.4, 5.0, 'hazard');
  m.box(-12.6, -12.3, -1.6, 1.6, 4.6, 6.6, 'red');
  if (up) m.sides(s => eraRow(m, 6, 12.2, s * 5.4, 3.2, 5.4, 2.0, s));
  writeModel('demotruck' + (up ? '_up' : ''), m);
}

// ---------- Railgun tank: low wedge hull, long twin-rail gun with glowing coils ----------
function railtank(ax, up) {
  const m = model();
  tracks(m, -14.5, 14.5, 7.6, 3.2, 3.8, { wheels: ax ? 6 : 7 });
  hullSide(m, [[-15, 1.6], [-15, 5.0], [6, 5.4], [15.4, 3.4], [15.4, 2.2], [13.2, 1.4]], 4.6, 'camoDark');
  m.sides(s => m.ext('side', [[-15.2, 3.6], [-15.2, 5.0], [6.4, 5.4], [15.6, 3.6]], s > 0 ? 4.4 : -7.9, s > 0 ? 7.9 : -4.4, 'camo'));
  if (!ax) m.sides(s => m.ext('side', [[-13, 2.2], [-13, 3.8], [13.6, 3.8], [13.6, 2.2]], s > 0 ? 7.85 : -8.15, s > 0 ? 8.15 : -7.85, 'camo'));
  else m.sides(s => m.box(-13, 12, s * 7.95 - 0.15, s * 7.95 + 0.15, 3.2, 4.6, 'camoDark'));
  if (up) sideEra(m, -12, 12, 8.15, 2.2, 4.0, 2.4);
  m.box(-15.25, -15.05, -2.4, 2.4, 2.4, 4.4, 'team');
  m.box(-14.6, -9, -5, 5, 4.9, 5.25, 'grille');
  m.part('turret', [-1, 0, 5.2]);
  if (!ax) {
    m.ext('top', [[6.5, -2.2], [6.5, 2.2], [3, 5.4], [-7, 5.4], [-8, 3.6], [-8, -3.6], [-7, -5.4], [3, -5.4]], 0, 2.6, 'camo');
    m.ext('top', [[6.52, -2.22], [6.52, 2.22], [3, 5.42], [-7.02, 5.42], [-8.02, 3.6], [-8.02, -3.6], [-7.02, -5.42], [3, -5.42]], 1.4, 2.0, 'team');
    m.sides(s => m.box(6, 25, s * 0.95 - 0.45, s * 0.95 + 0.45, 0.8, 2.0, 'gunDark'));     // the two rails
    for (const x of [8, 11, 14, 17, 20]) m.box(x, x + 0.9, -1.7, 1.7, 0.5, 2.3, 'steelDark');
    m.box(6.5, 24.5, -0.35, 0.35, 1.2, 1.6, 'cyan');
    m.sides(s => m.box(-6, -1, s * 3.4 - 0.9, s * 3.4 + 0.9, 2.6, 3.2, 'cyan'));          // capacitor vents
  } else {
    // Axis: tall boxed coil gun on a slab-sided turret
    m.box(-7.6, 5.2, -5.2, 5.2, 0, 2.8, 'camo');
    m.box(-7.65, 5.25, -5.25, 5.25, 1.5, 2.1, 'team');
    m.box(4, 24, -1.5, 1.5, 0.8, 3.2, 'camoDark');
    for (const x of [6, 10, 14, 18, 22]) m.box(x, x + 1.4, -1.6, 1.6, 0.7, 3.3, 'cyan');
    m.box(24, 25, -1.0, 1.0, 1.2, 2.8, 'gunDark');
    m.box(-7, -3, -3.6, 3.6, 2.8, 3.8, 'steelDark');
  }
  if (up) m.sides(s => eraRow(m, -6, 2, s * 5.6, 0.2, 1.4, 2.2, s));
  writeModel('railtank' + (ax ? '_ax' : '') + (up ? '_up' : ''), m);
}

// ---------- Titan: double-tracked heavy tank, twin 140 mm guns, missile pods on the turret ----------
function titan(up) {
  const m = model();
  m.sides(s => { tracks(m, -18, 18, s > 0 ? 13.6 : 13.6, 3.2, 4.4, { wheels: 8 }); });
  // inner tracks
  for (const y of [-6.6, 6.6]) m.ext('side', [[-17, 0], [16.4, 0], [18, 2.4], [17.4, 4.4], [-17.6, 4.4], [-18.6, 2.2]], y - 1.6, y + 1.6, 'track');
  hullSide(m, [[-18.6, 1.8], [-18.6, 7.6], [11, 7.6], [19, 4.6], [19, 2.6], [16.6, 1.8]], 10.4, 'camoDark');
  m.sides(s => m.ext('side', [[-18.8, 5.0], [-18.8, 7.6], [11.4, 7.6], [19.2, 4.8], [19.2, 4.6]], s > 0 ? 9 : -13.8, s > 0 ? 13.8 : -9, 'camo'));
  m.sides(s => m.box(-16, 16.5, s * 13.85 - 0.15, s * 13.85 + 0.15, 2.4, 5.0, 'camo'));
  if (up) sideEra(m, -15, 16, 14, 2.6, 5.0, 2.6);
  m.box(-18.9, -18.7, -4, 4, 3.0, 6.4, 'team');
  m.box(-18, -10, -8, 8, 7.6, 8.0, 'grille');
  m.part('turret', [-2, 0, 7.6]);
  const T = [[10, -4.4], [10, 4.4], [6.4, 8.8], [-8.4, 8.8], [-11, 6.4], [-11, -6.4], [-8.4, -8.8], [6.4, -8.8]];
  m.ext('top', T, 0, 3.2, 'camo');
  m.ext('top', T.map(([x, y]) => [x * 0.95, y * 0.93]), 3.2, 4.6, 'camo');
  m.ext('top', T.map(([x, y]) => [x * 1.004, y * 1.004]), 2.0, 2.9, 'team');
  m.sides(s => { m.box(9, 11, s * 2.4 - 1.3, s * 2.4 + 1.3, 0.8, 3.6, 'gunDark'); barrel(m, 10.5, 15, 2.2, 0.6, { y: s * 2.4, muzzle: true }); });
  m.sides(s => { m.box(-6, 2, s * 9.6 - 1.4, s * 9.6 + 1.4, 1.2, 4.0, 'camoDark'); for (let x = -5; x <= 1; x += 2) m.cyl([2.05, s * 9.6, 2.6], 0.5, 0.1, 'x', 'black', { seg: 8 }); });
  m.cyl([-4, 4, 5.0], 1.4, 0.9, 'z', 'steel', { seg: 10 });
  if (up) m.sides(s => eraRow(m, -8, 5, s * 8.9, 0.4, 2.0, 2.4, s));
  antenna(m, -9, -5, 4.6, 7);
  writeModel('titan' + (up ? '_up' : ''), m);
}

// ---------- Harvester: big articulated mining truck with a ribbed ore bed ----------
function harvester(ax, full) {
  const m = model();
  if (!ax) {
    wheels(m, [-10.6, -4.6, 10.8], 8.6, 2.8, 2.6);
    m.box(-16, 15.4, -4, 4, 2.6, 4.4, 'steelDark');
    // cab offset to the left, like a real haul truck, with the engine bay beside it
    m.box(9.6, 16.8, -7.6, 7.6, 4.0, 7.4, 'hazard');
    m.box(10.4, 15.6, -7.4, -1.6, 7.4, 11.2, 'hazard');
    m.box(15.55, 15.7, -7, -2, 8.4, 10.6, 'glass'); m.box(11, 15.2, -7.5, -7.4, 8.4, 10.6, 'glass');
    m.box(16.8, 17.0, 0, 7, 4.6, 6.8, 'grille');
    m.box(10.4, 15.6, -7.45, -1.55, 10.6, 11.2, 'team');
    // bed
    hullSide(m, [[-16.8, 4.4], [-16.8, 11.6], [-14, 12.2], [9.4, 12.2], [9.4, 4.4]], 8.4, 'hazard');
    m.box(-16, 8.6, -7.6, 7.6, 10.6, 12.25, 'oreDark');
    m.sides(s => m.box(-16, 9, s * 8.45 - 0.08, s * 8.45 + 0.08, 9.4, 10.6, 'team'));
    for (let x = -13; x <= 6; x += 4.5) m.sides(s => m.box(x, x + 0.8, s * 8.5 - 0.15, s * 8.5 + 0.15, 4.6, 11.8, 'oreDark'));
    if (full) for (const [x, y, r] of [[-11, -3, 4.2], [-5, 2, 4.8], [2, -2, 4.4], [-1, 4, 3], [5, 3, 3]]) m.sph([x, y, 12], r, 'ore', { s: [1, 1, 0.45], seg: 10 });
  } else {
    // Axis: 8x8 tipper with a flared hopper and a front scoop
    wheels(m, [-14, -9, 5, 10.4], 7.2, 2.4, 1.8);
    m.box(-18, 16, -3.6, 3.6, 2.4, 4.0, 'steelDark');
    cab(m, 11, 19, 7.4, 10, { mat: 'camo' });
    m.box(19, 20.6, -6.4, 6.4, 0.6, 3.2, 'steelDark', { r: [0, -20, 0] });                 // scoop
    m.ext('front', [[-6.6, 4.2], [6.6, 4.2], [8.2, 11.4], [-8.2, 11.4]], -18.4, 10.4, 'camo');
    m.box(-17.6, 9.6, -7.6, 7.6, 10.4, 11.45, 'oreDark');
    m.sides(s => m.box(-18, 10, s * 7.8 - 0.1, s * 7.8 + 0.1, 9.6, 10.6, 'team', { r: [s * -12, 0, 0] }));
    if (full) for (const [x, y, r] of [[-13, -2, 4], [-7, 2.5, 4.6], [-1, -2, 4.4], [4.6, 2, 3.6]]) m.sph([x, y, 11.3], r, 'ore', { s: [1, 1, 0.45], seg: 10 });
  }
  writeModel('harvester' + (ax ? '_ax' : '') + (full ? '_full' : ''), m);
}

// ---------- MCV: heavy transporter carrying the folded construction yard ----------
function mcv(ax) {
  const m = model();
  const L = ax ? 19.6 : 18;
  wheels(m, ax ? [-15, -10.6, -6.2, 6, 12] : [-13, -8.4, 4.6, 12], 8.2, 2.4, 2);
  m.box(-L, L - 4, -4, 4, 2.4, 4.4, 'steelDark');
  cab(m, L - 7.4, L, 9.4, 10.8, { mat: ax ? 'camo' : 'camo' });
  m.box(-L, L - 8, -9.4, 9.4, 4.4, 5.4, 'camoDark');                                        // deck
  // folded building module: walls, a stowed crane and the radar mast
  m.box(-L + 1, L - 10, -8.4, 8.4, 5.4, 13.2, ax ? 'concrete' : 'metal');
  m.box(-L + 0.6, L - 9.6, -8.8, 8.8, 13.2, 14.0, 'roof');
  m.box(-L + 0.9, L - 9.9, -8.45, 8.45, 11.6, 12.6, 'team');
  m.box(-L + 3, -L + 10, -8.42, -8.4, 6.6, 9.8, 'grille');
  m.box(-L + 2, L - 12, 4.6, 5.6, 14, 15, 'hazard');                                         // crane jib laid flat
  m.box(L - 13, L - 11, 3.6, 6.6, 13, 17, 'hazard');
  m.cyl([-L + 4, -4.6, 16], 0.3, 4, 'z', 'steelDark', { seg: 6 });
  m.box(-L + 3, -L + 5, -6, -3.2, 17.6, 18.0, 'metalLight');
  writeModel('mcv' + (ax ? '_ax' : ''), m);
}

// ---------- Recovery vehicle: tank hull with a dozer blade and a slewing crane ----------
function recovery(ax, up) {
  const m = model();
  if (!ax) {
    tracks(m, -13.6, 13.6, 7.8, 3.0, 3.8, { wheels: 6 });
    hullSide(m, [[-14, 1.6], [-14, 9.0], [4, 9.0], [10, 7], [14.2, 3.8], [14.2, 2.4], [12.4, 1.6]], 5.0, 'camo');
    m.sides(s => m.ext('side', [[-14.2, 3.8], [-14.2, 5.4], [12, 5.4], [14.4, 3.8]], s > 0 ? 4.8 : -8.0, s > 0 ? 8.0 : -4.8, 'camoDark'));
    m.box(14.4, 15.6, -7.6, 7.6, 0.4, 3.4, 'steelDark', { r: [0, 10, 0] });                 // dozer blade
    teamFlank(m, -13, 3, 5.02, 7.0, 7.6);
    m.box(-14.25, -14.05, -2.4, 2.4, 3.2, 6.6, 'team');
    m.box(-4, -1, 1, 4, 9, 9.8, 'steelDark');
    m.box(4, 7, -3, -1, 9, 9.5, 'glass');
    if (up) sideEra(m, -12, 12, 8.15, 2.4, 3.8, 2.4);
    m.part('turret', [-5, 0, 9.0]);
    m.cyl([0, 0, 0.6], 2.6, 1.2, 'z', 'steelDark', { seg: 12 });
    m.group([0, 0, 1.0], [0, 32, 0], () => {
      m.box(-1, 13, -0.8, 0.8, -0.8, 0.8, 'hazard');
      m.box(12, 13.6, -0.5, 0.5, -0.5, 0.5, 'black');
    });
    m.cyl([10.9, 0, 3.4], 0.08, 6, 'z', 'black', { seg: 4 });
    m.box(10.4, 11.4, -0.5, 0.5, -0.2, 0.6, 'steelDark');
  } else {
    wheels(m, [-11, -6.6, 4.6, 9.4], 6.6, 2.2, 1.6);
    m.box(-15, 13.4, -3.4, 3.4, 2.4, 4.0, 'steelDark');
    cab(m, 7.6, 15, 6.6, 9.4);
    m.box(-15.2, 7.4, -6.6, 6.6, 4.0, 5.6, 'camoDark');
    m.box(-15.4, -14.4, -6.6, 6.6, 1.0, 5.6, 'camoDark');
    m.box(-14, -6, -6, -2, 5.6, 7.6, 'olive');
    if (up) m.sides(s => eraRow(m, 8, 14.6, s * 6.6, 3.2, 5.6, 2.2, s));
    m.part('turret', [-4, 0, 5.6]);
    m.cyl([0, 0, 0.8], 2.6, 1.6, 'z', 'steelDark', { seg: 12 });
    m.group([0, 0, 1.4], [0, 28, 0], () => {
      for (let x = 0; x < 16; x += 2) m.box(x, x + 1.6, -0.75, 0.75, -0.75, 0.75, (x / 2) % 2 ? 'red' : 'white');
      m.box(16, 17, -0.5, 0.5, -0.5, 0.5, 'black');
    });
    m.cyl([13.9, 0, 3.2], 0.08, 6, 'z', 'black', { seg: 4 });
  }
  writeModel('recovery' + (ax ? '_ax' : '') + (up ? '_up' : ''), m);
}

// ---------- Phantom: faceted stealth tank, flat angled plates, flush turret ----------
function phantom(up) {
  const m = model();
  tracks(m, -12.4, 12.4, 7.6, 2.8, 3.2, { wheels: 6 });
  m.ext('front', [[-8, 2.4], [8, 2.4], [8.4, 3.4], [5.4, 6.2], [-5.4, 6.2], [-8.4, 3.4]], -13, 9, 'camo');
  m.ext('top', [[9, -6.6], [13.6, -2], [13.6, 2], [9, 6.6]], 2.4, 3.6, 'camo');
  m.ext('top', [[9, -5.4], [12.6, -1.6], [12.6, 1.6], [9, 5.4]], 3.6, 5.0, 'camoDark');
  m.box(-13.1, -12.9, -2.4, 2.4, 3.2, 5.2, 'team');
  if (up) sideEra(m, -11, 8, 8.5, 2.6, 3.6, 2.2);
  m.part('turret', [-1, 0, 6.2]);
  m.ext('top', [[5.4, -1.6], [5.4, 1.6], [2.4, 4.4], [-5.4, 4.4], [-6.4, 2.6], [-6.4, -2.6], [-5.4, -4.4], [2.4, -4.4]], 0, 2.2, 'camo');
  m.ext('top', [[5.42, -1.62], [5.42, 1.62], [2.4, 4.42], [-5.42, 4.42], [-6.42, 2.6], [-6.42, -2.6], [-5.42, -4.42], [2.4, -4.42]], 0.8, 1.4, 'team');
  barrel(m, 5, 8.2, 1.1, 0.42);
  m.box(5, 6.4, -1, 1, 0.4, 1.8, 'camoDark');
  writeModel('phantom' + (up ? '_up' : ''), m);
}

// ---------- Mine layer: tracked carrier with a mine hopper and a rear plough ----------
function minelayer(up) {
  const m = model();
  tracks(m, -13, 13, 6.8, 2.8, 3.6, { wheels: 6 });
  hullSide(m, [[-13.4, 1.6], [-13.4, 8.6], [5, 8.6], [8, 6.4], [13.6, 4.6], [13.6, 2.2], [11.6, 1.4]], 4.4, 'camo');
  m.sides(s => m.ext('side', [[-13.6, 3.6], [-13.6, 5.2], [12, 5.2], [13.8, 3.8]], s > 0 ? 4.2 : -7.0, s > 0 ? 7.0 : -4.2, 'camoDark'));
  m.box(-12, 2, -4.2, 4.2, 8.6, 10.6, 'olive');                                              // mine hopper
  for (let x = -11; x <= 0; x += 2.6) m.cyl([x + 1, 0, 10.7], 1.0, 0.25, 'z', 'olive', { seg: 10 });
  m.box(-15.6, -13.4, -3, 3, 0.6, 2.4, 'steelDark');                                         // dispenser chute
  teamFlank(m, -13, 4, 4.42, 6.6, 7.4);
  m.box(8, 10, -3, -1, 6.6, 7.2, 'glass', { r: [0, 30, 0] });
  if (up) sideEra(m, -11, 11, 7.2, 2.4, 3.8, 2.2);
  writeModel('minelayer' + (up ? '_up' : ''), m);
}

// ---------- Attack helicopter: Apache (Allies) or Hind-style gunship (Axis). The main rotor is drawn live. ----------
function heli(ax) {
  const m = model();
  if (!ax) {
    m.ext('side', [[-4, 3.4], [-4, 7.6], [4, 9.4], [8.4, 8.8], [12, 6.2], [12, 4.6], [8, 3.4]], -1.8, 1.8, 'camo');
    m.ext('side', [[7.4, 6.6], [10.6, 8.4], [12.2, 6.4]], -1.3, 1.3, 'glass');                  // tandem canopy
    m.ext('side', [[2.6, 8.6], [8, 9.2], [10.6, 8.4], [7, 6.6]], -1.35, 1.35, 'glass');
    m.ext('side', [[-17, 6.4], [-4, 5.4], [-4, 8.2], [-17, 7.4]], -0.7, 0.7, 'camo');           // tail boom
    m.ext('side', [[-17.4, 6.6], [-15.6, 7.0], [-14.6, 11.2], [-16.4, 11.2]], -0.25, 0.25, 'camo');
    m.box(-16.6, -14.6, -3.4, 3.4, 6.8, 7.1, 'camo');                                           // stabilator
    m.sides(s => { m.box(-2.6, 3.2, s * 2.2 - 1.2, s * 2.2 + 1.2, 6.4, 8.8, 'camoDark'); m.box(-3.4, -2.4, s * 2.2 - 0.9, s * 2.2 + 0.9, 6.8, 8.4, 'grille'); }); // engine pods
    m.sides(s => { m.box(0, 3.2, s * 1.8, s * 6.6, 5.6, 6.0, 'camoDark'); m.box(-0.2, 3.4, s * 5.4 - 0.7, s * 5.4 + 0.7, 4.2, 5.6, 'olive'); m.box(-0.2, 3.4, s * 3.6 - 0.6, s * 3.6 + 0.6, 4.4, 5.6, 'steelDark'); });
    m.box(-3, 3, -1.85, 1.85, 6.4, 7.2, 'team');
    m.cyl([0.4, 0, 9.8], 0.7, 2.0, 'z', 'steelDark', { seg: 8 });
    m.sph([0.4, 0, 11.6], 1.0, 'steelDark', { seg: 10 });                                      // mast radar
    m.box(9.2, 10.4, -0.4, 0.4, 2.8, 3.6, 'gunDark');
    m.sides(s => { m.box(-1, 1, s * 1.4 - 0.15, s * 1.4 + 0.15, 1.0, 3.6, 'black'); m.box(-4, 5, s * 1.6 - 0.2, s * 1.6 + 0.2, 0.8, 1.2, 'black'); }); // skids/legs
    m.cyl([-16.4, 0.4, 9.8], 2.2, 0.15, 'y', 'steelDark', { seg: 14 });                         // tail rotor
  } else {
    m.ext('side', [[-6, 3.6], [-6, 9.4], [6, 10.2], [10, 9.2], [15, 6.4], [15.4, 4.6], [10, 3.0], [-4, 3.0]], -2.6, 2.6, 'camo');
    m.ext('side', [[10.4, 6.6], [12.6, 8.6], [15, 6.4]], -1.6, 1.6, 'glass');
    m.ext('side', [[6.6, 7.6], [9.6, 9.4], [12, 8.4], [9.8, 6.6]], -2.0, 2.0, 'glass');
    m.box(-4, 4, -2.65, 2.65, 4.6, 6.4, 'camoDark');                                           // troop bay windows strip
    for (let x = -3; x < 4; x += 2) m.sides(s => m.box(x, x + 1, s * 2.66 - 0.04, s * 2.66 + 0.04, 6.6, 7.6, 'glass'));
    m.ext('side', [[-20, 7], [-6, 6], [-6, 9.4], [-20, 8.4]], -0.9, 0.9, 'camo');
    m.ext('side', [[-20.4, 7.2], [-18.4, 7.6], [-17.6, 12], [-19.6, 12]], -0.25, 0.25, 'camo');
    m.box(-4, 6, -2.4, 2.4, 9.4, 11.4, 'camoDark');                                              // engines
    m.sides(s => m.box(-4.4, -3.6, s * 1.4 - 0.8, s * 1.4 + 0.8, 9.8, 11.0, 'grille'));
    m.box(-4.2, 6.2, -2.45, 2.45, 9.8, 10.6, 'team');
    m.sides(s => { m.box(-2, 2, s * 2.6, s * 8.6, 6.0, 6.5, 'camoDark', { r: [s * -8, 0, 0] }); m.box(-2.2, 2.2, s * 7.2 - 0.7, s * 7.2 + 0.7, 4.4, 5.8, 'olive'); m.box(-2.2, 2.2, s * 4.6 - 0.6, s * 4.6 + 0.6, 4.4, 5.8, 'steelDark'); });
    m.cyl([1, 0, 12.4], 0.8, 2, 'z', 'steelDark', { seg: 8 });
    m.box(13.8, 15.4, -0.4, 0.4, 3.4, 4.2, 'gunDark');
    m.sides(s => { m.cyl([8, s * 2.2, 1.4], 0.9, 0.6, 'y', 'rubber', { seg: 10 }); m.cyl([-3, s * 3.2, 1.4], 0.9, 0.6, 'y', 'rubber', { seg: 10 }); m.box(-3.4, 8.4, s * 2.6 - 0.2, s * 2.6 + 0.2, 1.4, 3.6, 'steelDark', { r: [0, 0, s * 4] }); });
    m.cyl([-19.6, 0.5, 10.6], 2.4, 0.15, 'y', 'steelDark', { seg: 14 });
  }
  writeModel('heli' + (ax ? '_ax' : ''), m);
}

// ---------- Fighter: F-35-style single tail-pair (Allies), Su-57/Flanker twin engines (Axis) ----------
function jet(ax) {
  const m = model();
  const Z = 3;
  if (!ax) {
    m.ext('top', [[16, 0], [9, -1.6], [2, -2.4], [-10, -2.6], [-14, -1.6], [-14, 1.6], [-10, 2.6], [2, 2.4], [9, 1.6]], Z, Z + 2.6, 'jet');
    m.ext('top', [[2, -2.4], [-6, -12.4], [-10, -12.4], [-9, -2.6]], Z + 0.6, Z + 1.2, 'jet');
    m.ext('top', [[2, 2.4], [-6, 12.4], [-10, 12.4], [-9, 2.6]], Z + 0.6, Z + 1.2, 'jet');
    m.ext('top', [[-9, -2.4], [-12.6, -6.8], [-15, -6.8], [-14, -2]], Z + 0.8, Z + 1.3, 'jet');
    m.ext('top', [[-9, 2.4], [-12.6, 6.8], [-15, 6.8], [-14, 2]], Z + 0.8, Z + 1.3, 'jet');
    m.sides(s => m.ext('side', [[-9, Z + 2.4], [-13.4, Z + 6.6], [-15.2, Z + 6.6], [-14, Z + 2.4]], s * 1.6 - 0.12, s * 1.6 + 0.12, 'jetDark', { r: [s * -22, 0, 0] }));
    m.sides(s => m.ext('side', [[-12.1, Z + 5.4], [-13.4, Z + 6.6], [-15.2, Z + 6.6], [-14.7, Z + 5.4]], s * 1.6 - 0.14, s * 1.6 + 0.14, 'team', { r: [s * -22, 0, 0] }));
    m.ext('side', [[10.6, Z + 2.4], [6, Z + 3.8], [2, Z + 3.4], [2, Z + 2.4]], -0.9, 0.9, 'glass');
    m.cyl([-14.3, 0, Z + 1.3], 1.1, 0.8, 'x', 'black', { seg: 12 });
    m.box(-8.6, -7, -11.8, -9.8, Z + 1.2, Z + 1.3, 'team'); m.box(-8.6, -7, 9.8, 11.8, Z + 1.2, Z + 1.3, 'team');
    m.box(-2, 4, -2.45, 2.45, Z + 1.6, Z + 2.2, 'team');
  } else {
    m.ext('top', [[18, 0], [11, -1.4], [4, -2.2], [-2, -3.6], [-14, -3.6], [-14, 3.6], [-2, 3.6], [4, 2.2], [11, 1.4]], Z, Z + 2.2, 'jetBlue');
    m.ext('top', [[6, -2.6], [-6, -15], [-10.4, -15], [-9, -3.6]], Z + 0.6, Z + 1.2, 'jetBlue');
    m.ext('top', [[6, 2.6], [-6, 15], [-10.4, 15], [-9, 3.6]], Z + 0.6, Z + 1.2, 'jetBlue');
    m.ext('top', [[-10, -3.4], [-14, -8], [-16.6, -8], [-15.4, -3]], Z + 0.6, Z + 1.1, 'jetBlue');
    m.ext('top', [[-10, 3.4], [-14, 8], [-16.6, 8], [-15.4, 3]], Z + 0.6, Z + 1.1, 'jetBlue');
    m.sides(s => { m.cyl([-8, s * 2.2, Z + 0.9], 1.4, 13, 'x', 'jetDark', { seg: 12 }); m.cyl([-14.8, s * 2.2, Z + 0.9], 1.1, 0.6, 'x', 'black', { seg: 12 }); });
    m.sides(s => m.ext('side', [[-9.4, Z + 2], [-13.6, Z + 6.8], [-15.6, Z + 6.8], [-14.6, Z + 2]], s * 3.0 - 0.12, s * 3.0 + 0.12, 'jetDark', { r: [s * -14, 0, 0] }));
    m.sides(s => m.ext('side', [[-12.5, Z + 5.6], [-13.6, Z + 6.8], [-15.6, Z + 6.8], [-15.25, Z + 5.6]], s * 3.0 - 0.14, s * 3.0 + 0.14, 'team', { r: [s * -14, 0, 0] }));
    m.ext('side', [[13, Z + 2.0], [8, Z + 3.4], [4, Z + 3.0], [4, Z + 2.0]], -0.9, 0.9, 'glass');
    m.box(-8.6, -6.8, -14.2, -12.4, Z + 1.2, Z + 1.3, 'team'); m.box(-8.6, -6.8, 12.4, 14.2, Z + 1.2, Z + 1.3, 'team');
    m.box(-4, 2, -2.25, 2.25, Z + 1.4, Z + 2.25, 'team');
  }
  writeModel('jet' + (ax ? '_ax' : ''), m);
}

// ---------- Strike bomber: B-2 style flying wing (Allies), Tu-160 swing-wing (Axis) ----------
function bomber(ax) {
  const m = model();
  const Z = 3;
  if (!ax) {
    const wing = [[14, 0], [-4, -19], [-7, -19], [-4, -15], [-8, -11], [-4, -7], [-8, -3.4], [-6, 0], [-8, 3.4], [-4, 7], [-8, 11], [-4, 15], [-7, 19], [-4, 19]];
    m.ext('top', wing, Z, Z + 1.2, 'jetDark');
    m.ext('top', [[12, 0], [4, -5.6], [-5, -5.6], [-6, 0], [-5, 5.6], [4, 5.6]], Z + 1.2, Z + 2.6, 'jetDark');
    m.ext('top', [[11, -0.9], [8, -1.6], [8, 1.6], [11, 0.9]], Z + 2.6, Z + 3.0, 'glass');
    m.sides(s => m.box(-2, 2, s * 3.2 - 0.6, s * 3.2 + 0.6, Z + 2.6, Z + 3.0, 'grille'));
    m.box(-6, 4, -5.65, 5.65, Z + 1.6, Z + 2.2, 'team');
  } else {
    m.cyl([0, 0, Z + 1.6], 2.0, 40, 'x', 'white', { seg: 14 });
    m.cyl([22, 0, Z + 1.6], 2.0, 4, 'x', 'white', { r2: 0.3, seg: 14 });
    m.ext('side', [[18, Z + 2.8], [15, Z + 4], [10, Z + 3.4]], -1.0, 1.0, 'glass');
    m.ext('top', [[10, -2], [4, -4], [-12, -21], [-15, -21], [-6, -2]], Z + 1.2, Z + 1.8, 'white');
    m.ext('top', [[10, 2], [4, 4], [-12, 21], [-15, 21], [-6, 2]], Z + 1.2, Z + 1.8, 'white');
    m.ext('top', [[-15, -1], [-20, -9], [-22.4, -9], [-21, -1]], Z + 2.6, Z + 3.0, 'white');
    m.ext('top', [[-15, 1], [-20, 9], [-22.4, 9], [-21, 1]], Z + 2.6, Z + 3.0, 'white');
    m.ext('side', [[-14, Z + 3], [-19, Z + 10], [-22, Z + 10], [-21, Z + 3]], -0.25, 0.25, 'white');
    m.sides(s => { for (const y of [3.4, 5.6]) { m.cyl([-6, s * y, Z], 1.0, 8, 'x', 'jetDark', { seg: 10 }); m.cyl([-10.1, s * y, Z], 0.8, 0.3, 'x', 'black', { seg: 10 }); } });
    m.box(-12, 8, -2.05, 2.05, Z + 2.6, Z + 3.2, 'team');
    m.box(-14.4, -12, -20.8, -19.4, Z + 1.75, Z + 1.85, 'team'); m.box(-14.4, -12, 19.4, 20.8, Z + 1.75, Z + 1.85, 'team');
  }
  writeModel('bomber' + (ax ? '_ax' : ''), m);
}

// ---------- MQ-9 Reaper drone: slender fuselage, long straight wings, V-tail, pusher prop ----------
function drone() {
  const m = model();
  const Z = 3;
  m.cyl([0, 0, Z + 1], 1.1, 18, 'x', 'jet', { seg: 12 });
  m.sph([9, 0, Z + 1.3], 1.5, 'jet', { s: [1.6, 1, 1], seg: 12 });
  m.ext('top', [[1.6, -13.8], [1.6, 13.8], [-0.6, 13.8], [-1.0, 0], [-0.6, -13.8]], Z + 1.2, Z + 1.55, 'jet');
  m.sides(s => m.box(-9, -6.6, s * 1.6 - 0.1, s * 1.6 + 0.1, Z + 1, Z + 4, 'jet', { r: [s * -40, 0, 0] }));
  m.box(-9.4, -6.6, -0.1, 0.1, Z - 2.2, Z + 0.4, 'jet');
  m.cyl([-9.5, 0, Z + 1], 2.0, 0.15, 'x', 'steelDark', { seg: 14 });
  m.sph([6, 0, Z - 0.2], 0.8, 'glassLight', { seg: 10 });
  m.sides(s => m.box(-1, 1.2, s * 6 - 0.4, s * 6 + 0.4, Z + 0.2, Z + 1.2, 'olive'));
  m.box(-6, 4, -1.12, 1.12, Z + 1.2, Z + 1.8, 'team');
  writeModel('drone', m);
}

// ---------- Kirov airship: long envelope, armoured gondola, four engines ----------
function kirov() {
  const m = model();
  m.sph([0, 0, 14], 11, 'camo', { s: [2.1, 0.95, 0.85], seg: 24 });
  for (const x of [-12, 12]) m.sph([x, 0, 14], 11, 'team', { s: [0.08, 0.96 * Math.sqrt(1 - (x / 23.1) ** 2) / 0.95 * 0.95 + 0.01, 0.86 * Math.sqrt(1 - (x / 23.1) ** 2) + 0.01], seg: 24 });
  m.sides(s => { m.box(-23, -18, s * 1.5 - 0.15, s * 1.5 + 0.15, 14, 21, 'camoDark', { r: [s * -30, 0, 0] }); });
  m.box(-23, -18, -0.15, 0.15, 5, 14, 'camoDark');
  m.ext('side', [[-10, 4.4], [10, 4.4], [12, 6.6], [10, 6.6], [-10, 6.6]], -3.4, 3.4, 'camoDark');
  m.box(-10, 10, -3.4, 3.4, 1.6, 4.4, 'camoDark');
  m.box(9, 11.6, -2.4, 2.4, 2.4, 3.8, 'glass');
  for (let x = -7; x <= 5; x += 4) m.box(x, x + 2, -1.8, 1.8, 1.1, 1.6, 'black');
  m.sides(s => { for (const x of [-8, 8]) { m.box(x - 1, x + 1, s * 9, s * 12, 9, 9.6, 'steelDark'); m.cyl([x, s * 12.6, 9.3], 1.1, 3, 'x', 'steelDark', { seg: 10 }); m.cyl([x - 1.6, s * 12.6, 9.3], 2.0, 0.15, 'x', 'gunDark', { seg: 14 }); } });
  writeModel('kirov', m);
}

// ---------- Infantry ----------
// Kinds share one body; gear differs. Three walk frames. About 12 units tall, drawn at k 1.4.
// Axis troops wear a rounder helmet, darker gear and carry their rifle with a wooden stock.
const KIT = {
  rifle: { gun: 'rifle' }, rocket: { gun: 'launcher' }, engineer: { gun: 'none', vest: 'hazard', helmet: 'hazard' },
  sniper: { gun: 'sniper', hood: true }, shock: { gun: 'flamer', mask: true }, sas: { gun: 'carbine', dark: true, mask: true },
  hacker: { gun: 'tablet', uplink: true }, commando: { gun: 'carbine', dark: true, beret: true }, medic: { gun: 'none', medic: true },
};
function soldier(kind, frame, ax, up) {
  const m = model();
  const k = KIT[kind], swing = [0, 26, -26][frame];
  const cloth = k.dark ? 'black' : 'camoDark', top = k.dark ? 'steelDark' : 'camo';
  m.sides(s => m.group([0, s * 0.85, 6.0], [0, s * swing, 0], () => {
    m.box(-0.75, 0.75, -0.7, 0.7, -5.2, 0, cloth);
    m.box(-0.8, 1.6, -0.75, 0.75, -6.0, -5.0, 'black');
    if (up) m.box(0.2, 0.95, -0.75, 0.75, -3.4, -2.2, 'steelDark');                            // knee pads
  }));
  m.box(-1.1, 1.1, -1.75, 1.75, 5.6, 9.4, top);
  m.box(-1.3, 1.35, -1.85, 1.85, 6.6, 9.1, k.vest || (k.medic ? 'white' : k.dark ? 'black' : ax ? 'olive' : 'olive'));
  if (up) { m.box(-1.5, 1.55, -2.0, 2.0, 6.4, 9.3, 'steelDark'); m.sides(s => m.box(-0.9, 0.9, s * 2.3 - 0.5, s * 2.3 + 0.5, 8.4, 9.6, 'steelDark')); }
  // backpack in the team colour so sides read at a glance
  m.box(-2.6, -1.2, -1.4, 1.4, 6.4, 9.2, k.uplink ? 'steelDark' : 'team');
  if (k.medic) { m.box(-2.65, -2.55, -0.25, 0.25, 7.2, 8.6, 'red'); m.box(-2.65, -2.55, -0.7, 0.7, 7.65, 8.15, 'red'); }
  // head
  m.box(-0.6, 0.6, -0.5, 0.5, 9.4, 9.9, 'skin');
  m.sph([0.05, 0, 10.6], 1.0, k.mask ? 'black' : 'skin', { seg: 10 });
  if (k.mask) m.box(0.75, 1.05, -0.6, 0.6, 10.4, 10.9, kind === 'shock' ? 'glass' : 'steelDark');
  if (k.beret) m.sph([-0.1, -0.2, 11.3], 1.05, 'team', { s: [1.1, 1.1, 0.45], seg: 10 });
  else if (k.hood) m.sph([-0.2, 0, 10.9], 1.25, 'olive', { s: [1.1, 1.0, 0.85], seg: 10 });
  else if (ax && !k.dark) m.sph([-0.1, 0, 10.9], 1.2, k.helmet || (k.medic ? 'white' : 'camoDark'), { s: [1.0, 1.0, 0.85], seg: 12 });
  else m.sph([-0.1, 0, 10.95], 1.15, k.helmet || (k.medic ? 'white' : cloth === 'black' ? 'black' : 'camoDark'), { s: [1.05, 1.0, 0.75], seg: 12 });
  if (up && !k.beret) m.box(0.6, 1.1, -0.8, 0.8, 10.6, 11.0, 'glass');                           // visor
  if (k.medic && !ax) m.box(-0.2, 0.2, -0.15, 0.15, 11.6, 11.85, 'red');
  // arms forward to the weapon
  m.sides(s => m.group([0, s * 2.0, 9.0], [0, s > 0 ? -40 : -65, s > 0 ? -10 : 20], () => m.box(-0.55, 0.55, -0.55, 0.55, -3.4, 0, top)));
  const stock = ax ? 'wood' : 'gunDark';
  if (k.gun === 'rifle' || k.gun === 'carbine') m.group([1.6, 0.6, 7.6], [0, 4, 0], () => {
    m.box(-1.6, k.gun === 'carbine' ? 3.0 : 3.4, -0.25, 0.25, -0.35, 0.35, 'gunDark');
    m.box(-1.6, -0.4, -0.22, 0.22, -0.5, 0.3, stock);
    m.box(0.4, 1.1, -0.2, 0.2, -1.2, -0.3, 'gunDark');
    if (k.gun === 'carbine') m.cyl([3.8, 0, 0], 0.32, 1.6, 'x', 'black', { seg: 8 });
    else m.box(-0.6, 0.8, -0.2, 0.2, 0.35, 0.65, 'steelDark');
  });
  if (k.gun === 'sniper') m.group([1.6, 0.6, 7.8], [0, 3, 0], () => {
    m.box(-1.8, 5.6, -0.22, 0.22, -0.3, 0.3, 'gunDark'); m.box(-1.8, 0, -0.25, 0.25, -0.6, 0.3, 'olive');
    m.cyl([1.2, 0, 0.75], 0.3, 2.4, 'x', 'black', { seg: 8 });
  });
  if (k.gun === 'launcher') {
    m.cyl([0.6, 1.2, 10.2], 0.62, 7.6, 'x', ax ? 'olive' : 'olive', { seg: 10 });
    m.cyl([4.6, 1.2, 10.2], 0.85, 1.4, 'x', 'olive', { seg: 10 });
    m.box(0.6, 1.4, 0.5, 1.0, 8.8, 9.6, 'gunDark');
  }
  if (k.gun === 'flamer') {
    m.sides(s => m.cyl([-2.2, s * 0.9, 8.4], 0.7, 3.8, 'z', 'hazard', { seg: 10 }));
    m.group([1.6, 0.6, 7.4], [0, 6, 0], () => { m.box(-1, 3, -0.25, 0.25, -0.3, 0.3, 'steelDark'); m.box(3, 3.4, -0.3, 0.3, -0.35, 0.35, 'flame'); });
  }
  if (k.gun === 'tablet') m.box(1.4, 2.0, -0.9, 0.9, 7.2, 8.4, 'cyan', { r: [0, -30, 0] });
  if (k.uplink) { m.cyl([-1.9, 0, 11], 0.12, 3.6, 'z', 'steel', { seg: 6 }); m.cyl([-1.9, 0, 12.9], 1.0, 0.2, 'z', 'white', { seg: 12, r2: 1.2 }); m.box(-2.65, -2.55, -1, 1, 7.4, 8.2, 'team'); }
  if (kind === 'engineer') m.box(-0.6, 1.4, 2.0, 2.8, 4.4, 5.8, 'red');                           // tool bag
  if (k.medic) m.box(-0.8, 0.8, -2.6, -1.9, 5.4, 6.8, 'white');                                    // aid bag
  if (kind === 'sas' || kind === 'commando') m.box(1.35, 1.6, -1.2, 0.2, 7.2, 8.0, 'hazard');      // C4
  writeModel(`${kind}${ax ? '_ax' : ''}_${frame}${up ? '_up' : ''}`, m, { render: { k: 1.4 } });
}

// ---------- write everything ----------
for (const up of [false, true]) {
  for (const ax of [false, true]) { tank(ax, up); railtank(ax, up); recovery(ax, up); }
  ifv(up); flak(up); mlrs(up); tos(up); iskander(up); aegis(up); raijin(up); demotruck(up); titan(up); phantom(up); minelayer(up);
}
for (const ax of [false, true]) { harvester(ax, false); harvester(ax, true); mcv(ax); heli(ax); jet(ax); bomber(ax); }
drone(); kirov();
for (let f = 0; f < 3; f++) {
  for (const kind of Object.keys(KIT)) soldier(kind, f, false, false);
  for (const kind of ['rifle', 'rocket', 'engineer', 'sniper', 'shock', 'sas', 'hacker', 'medic']) soldier(kind, f, false, true);
  for (const kind of ['rifle', 'rocket', 'engineer', 'medic']) { soldier(kind, f, true, false); soldier(kind, f, true, true); }
}
