// Low-poly ultimate units, one model per refit tier (Mk I to Mk IV), Allied and Axis looks.
// Each tier keeps the model before it and bolts more on, so the unit visibly grows stronger.
//
//   node mesh_ultimates.js
'use strict';
const { model, writeModel } = require('./mesh_lib');

const TIERS = [1, 2, 3, 4];
const nm = (base, ax, tier, suffix = '') => `${base}${ax ? '_ax' : ''}${tier > 1 ? '_t' + tier : ''}${suffix}`;

function tracks(m, x0, x1, yc, w, h) {
  const pts = [[x0 + 1.4, 0], [x1 - 1.8, 0], [x1, h * 0.55], [x1 - 0.6, h], [x0 + 0.4, h], [x0 - 0.6, h * 0.5]];
  m.ext('side', pts, yc - w / 2, yc + w / 2, 'track');
  const n = 8, step = (x1 - x0 - 4) / (n - 1);
  for (let i = 0; i < n; i++) m.cyl([x0 + 2 + i * step, yc + Math.sign(yc || 1) * (w / 2 + 0.05), 1.5], 1.45, 0.2, 'y', 'hub', { seg: 12 });
}

// ---------- Goliath Exosuit: a pilot in a walking suit of armour with a rotary cannon ----------
// Mk II armour plates and a shoulder rocket pod; Mk III jump jets and a power core; Mk IV a
// shoulder railgun. The Axis suit is bulkier and riveted, with a drum-fed autocannon.
function goliath(ax, tier, frame) {
  const m = model();
  const swing = [0, 22, -22][frame], W = ax ? 1.15 : 1;
  m.sides(s => m.group([0, s * 3.0 * W, 8.6], [0, s * swing, 0], () => {
    m.box(-1.3, 1.3, -1.1, 1.1, -4.4, 0, 'camo');                                // thigh
    m.group([0, 0, -4.4], [0, -2 * Math.abs(swing) / 3, 0], () => {
      m.box(-1.0, 1.0, -0.9, 0.9, -3.8, 0, 'steel');                              // shin
      m.box(-1.6, 2.8, -1.3, 1.3, -4.2, -3.4, 'steelDark');                       // foot
      if (tier >= 2) m.box(1.0, 1.5, -1.0, 1.0, -3.4, -0.6, 'camoDark');
    });
    m.cyl([0, 0, -4.4], 1.15, 2.2, 'y', 'steelDark', { seg: 10 });
  }));
  m.box(-1.6, 1.6, -3.4 * W, 3.4 * W, 7.8, 9.6, 'steelDark');                     // hips
  // torso: armoured shell with the pilot's window
  m.ext('top', [[2.8, -2.4], [2.8, 2.4], [1.6, 4.0], [-2.6, 4.0], [-2.6, -4.0], [1.6, -4.0]].map(([x, y]) => [x * W, y * W]), 9.6, 15.4, 'camo');
  m.ext('top', [[2.82, -2.42], [2.82, 2.42], [1.6, 4.02], [-2.62, 4.02], [-2.62, -4.02], [1.6, -4.02]].map(([x, y]) => [x * W, y * W]), 12.4, 13.2, 'team');
  if (!ax) m.box(2.75, 2.9, -1.4, 1.4, 13.4, 14.8, 'glass');
  else { m.box(2.0 * W, 3.3 * W, -1.4, 1.4, 13.6, 15.0, 'camoDark'); m.box(3.3 * W, 3.4 * W, -1.0, 1.0, 14.0, 14.5, 'glass'); }
  m.box(-3.8, -2.6, -2.4, 2.4, 10, 14.6, 'steelDark');                            // power pack
  // arms: the right carries the cannon, the left a claw
  m.sides(s => m.cyl([0, s * 4.6 * W, 14], 1.6, 2.4, 'y', 'camoDark', { seg: 12 }));  // shoulders
  m.box(-1, 1.6, 4.0 * W, 5.6 * W, 9.6, 13.4, 'camo');
  if (!ax) { m.cyl([4.4, 5.0 * W, 10], 1.1, 6, 'x', 'gunDark', { seg: 10 }); for (const a of [0, 2.1, 4.2]) m.cyl([8, 5.0 * W + Math.cos(a) * 0.5, 10 + Math.sin(a) * 0.5], 0.25, 2, 'x', 'gun', { seg: 6 }); }
  else { m.cyl([5, 5.0 * W, 10], 0.6, 8, 'x', 'gunDark', { seg: 8 }); m.cyl([1.4, 5.0 * W, 8.4], 1.8, 1.4, 'y', 'olive', { seg: 14 }); }
  m.box(-1, 1.6, -5.6 * W, -4.0 * W, 9.6, 13.4, 'camo');
  m.box(1.6, 3.4, -5.4 * W, -4.2 * W, 9.4, 10.6, 'steelDark');
  if (tier >= 2) { m.box(-0.6, 2.6, -6.2 * W, -3.8 * W, 15.2, 17.4, 'olive'); for (const y of [-5.6, -4.4]) m.cyl([2.65, y * W, 16.3], 0.4, 0.1, 'x', 'black', { seg: 8 }); m.sides(s => m.box(-1.2, 1.4, s * 4.6 * W - 1.2, s * 4.6 * W + 1.2, 15.2, 15.8, 'camoDark')); }
  if (tier >= 3) { m.sides(s => { m.cyl([-4.2, s * 1.4, 12], 0.8, 4, 'z', 'steelDark', { seg: 10 }); m.cyl([-4.2, s * 1.4, 9.8], 0.6, 0.4, 'z', 'flame', { seg: 10 }); }); m.cyl([-3.85, 0, 13], 0.7, 0.2, 'x', 'cyan', { seg: 10 }); m.cyl([-3, -2, 16.8], 0.08, 4, 'z', 'black', { seg: 4 }); }
  if (tier >= 4) { m.box(-2, 8, 2.0 * W, 3.0 * W, 16, 17, 'gunDark'); m.box(-1, 7.6, 2.3 * W, 2.7 * W, 16.9, 17.2, 'cyan'); m.box(-2.7, -2.6, -2.2, 2.2, 10.6, 14, 'team'); }
  writeModel(nm('goliath', ax, tier, '_' + frame), m, { render: { k: 1.6 } });
}

// ---------- Behemoth: four-track land fortress with twin 155 mm guns ----------
// Mk II reactive armour skirts and turret rocket pods; Mk III gatling sponsons, a dozer wedge and
// repair vents; Mk IV a spinal railgun. The Axis fortress has a rear command tower.
function behemoth(ax, tier) {
  const m = model();
  for (const y of [-14.6, -9.4, 9.4, 14.6]) tracks(m, -23, 23, y, 4.4, 5.4);
  m.ext('side', [[-24, 2], [-24, 9.6], [14, 9.6], [24.4, 6], [24.4, 3], [21, 2]], -12, 12, 'camoDark');
  m.ext('side', [[-24.4, 5.4], [-24.4, 9.6], [14.4, 9.6], [24.8, 5.8], [24.8, 5.4]], 12, 17.4, 'camo');
  m.ext('side', [[-24.4, 5.4], [-24.4, 9.6], [14.4, 9.6], [24.8, 5.8], [24.8, 5.4]], -17.4, -12, 'camo');
  m.sides(s => m.box(-21, 21, s * 17.4 - 0.15, s * 17.4 + 0.15, 2.6, 5.6, 'camo'));
  m.box(-24.5, -24.3, -6, 6, 3.6, 8.4, 'team');
  m.box(-23, -13, -10, 10, 9.6, 10.0, 'grille');
  if (ax) { m.box(-23, -15, -6, 6, 9.6, 16, 'camo'); m.box(-23.05, -14.95, -6.05, 6.05, 13.6, 14.4, 'team'); m.box(-15.05, -14.95, -4.6, 4.6, 14.6, 15.6, 'glass'); m.cyl([-20, 4, 19], 0.1, 6, 'z', 'black', { seg: 4 }); }
  if (tier >= 2) m.sides(s => { for (let x = -20; x < 20; x += 3) m.box(x, x + 2.6, s * 17.6 - 0.5, s * 17.6 + 0.5, 2.8, 5.4, 'camoDark'); });
  if (tier >= 3) { m.box(24.4, 26.4, -16, 16, 0.4, 5, 'steelDark', { r: [0, 12, 0] }); m.sides(s => { m.cyl([12, s * 18.4, 7.6], 1.4, 1.4, 'y', 'steelDark', { seg: 12 }); m.cyl([15, s * 18.4, 7.6], 0.6, 5, 'x', 'gunDark', { seg: 8 }); }); for (const x of [-10, -6]) m.box(x, x + 2, -8, 8, 9.6, 10.1, 'cyan'); }
  m.part('turret', [ax ? -4 : -3, 0, 9.6]);
  const T = [[12, -6], [12, 6], [8, 11], [-11, 11], [-14, 8], [-14, -8], [-11, -11], [8, -11]];
  m.ext('top', T, 0, 4.4, 'camo');
  m.ext('top', T.map(([x, y]) => [x * 0.92, y * 0.9]), 4.4, 6.2, 'camo');
  m.ext('top', T.map(([x, y]) => [x * 1.004, y * 1.004]), 2.6, 3.6, 'team');
  m.sides(s => { m.box(11, 14, s * 3.4 - 1.8, s * 3.4 + 1.8, 1.0, 4.6, 'gunDark'); m.cyl([24, s * 3.4, 2.8], 0.85, 20, 'x', 'gun', { r2: 0.75, seg: 10 }); m.cyl([33.4, s * 3.4, 2.8], 1.2, 1.6, 'x', 'gunDark', { seg: 10 }); });
  m.cyl([-5, 6, 6.8], 1.8, 1.2, 'z', 'steel', { seg: 12 });
  if (ax) m.cyl([4, 0, 6.6], 1.4, 0.8, 'z', 'steelDark', { seg: 10 });
  if (tier >= 2) m.sides(s => { m.box(-8, 2, s * 12.6 - 1.6, s * 12.6 + 1.6, 1, 4.6, 'olive'); for (const z of [2, 3.6]) m.cyl([2.05, s * 12.6, z], 0.5, 0.1, 'x', 'black', { seg: 8 }); });
  if (tier >= 4) { m.box(-6, 30, -0.9, 0.9, 6.2, 7.6, 'gunDark'); m.box(-4, 29, -0.3, 0.3, 7.6, 7.9, 'cyan'); for (const x of [2, 8, 14, 20]) m.box(x, x + 1, -1.4, 1.4, 6, 8, 'steelDark'); }
  writeModel(nm('behemoth', ax, tier), m);
}

// ---------- Valkyrie: heavy gunship lifted by four ducted fans (fans part of the model) ----------
// Mk II stub wings with missile racks; Mk III armour and flare pods; Mk IV a belly 105 mm gun.
function valkyrie(ax, tier) {
  const m = model();
  const Z = 4;
  m.ext('side', [[-12, Z + 1], [-12, Z + 6], [8, Z + 7.4], [14, Z + 5], [15, Z + 2.4], [12, Z], [-8, Z]], -3.4, 3.4, 'camo');
  m.ext('side', [[9, Z + 5], [11.6, Z + 6.8], [14.4, Z + 5]], -2.4, 2.4, 'glass');
  m.box(-12.1, 8, -3.45, 3.45, Z + 4.4, Z + 5.2, 'team');
  m.ext('side', [[-20, Z + 4], [-12, Z + 3], [-12, Z + 6], [-20, Z + 6]], -1.2, 1.2, 'camo');
  m.ext('side', [[-21, Z + 4], [-18.6, Z + 4.6], [-17.6, Z + 10], [-20.4, Z + 10]], -0.3, 0.3, 'camo');
  for (const [x, y] of [[8, 10], [8, -10], [-8, 12], [-8, -12]]) {
    m.cyl([x, y, Z + 5], 5.2, 2.2, 'z', ax ? 'camoDark' : 'camo', { seg: 22 });
    m.cyl([x, y, Z + 5], 4.5, 2.3, 'z', 'black', { seg: 22 });
    m.cyl([x, y, Z + 6.1], 4.4, 0.1, 'z', 'steelDark', { seg: 22 });
    m.cyl([x, y, Z + 5.6], 1.0, 1.2, 'z', 'steel', { seg: 10 });
    m.box(x - 0.6, x + 0.6, Math.min(Math.sign(y) * 3, y), Math.max(Math.sign(y) * 3, y), Z + 4.6, Z + 5.4, 'camoDark');
    m.cyl([x, y, Z + 5.0], 5.25, 0.6, 'z', 'team', { seg: 22 });
  }
  m.box(10.8, 13, -0.6, 0.6, Z - 1.4, Z, 'gunDark'); m.cyl([14, 0, Z - 1], 0.3, 3, 'x', 'gun', { seg: 6 });
  if (ax) { m.box(-6, 6, -3.5, 3.5, Z + 6.8, Z + 8.4, 'camoDark'); m.sides(s => m.box(-4, 4, s * 3.6 - 0.05, s * 3.6 + 0.05, Z + 2.6, Z + 4, 'glass')); }
  if (tier >= 2) m.sides(s => { m.box(-2, 2, s * 3.4, s * 7, Z + 2.4, Z + 2.9, 'camoDark'); m.box(-2.4, 2.4, s * 6 - 0.6, s * 6 + 0.6, Z + 1.2, Z + 2.4, 'olive'); });
  if (tier >= 3) { m.sides(s => m.box(-10, 6, s * 3.5 - 0.3, s * 3.5 + 0.3, Z + 1, Z + 4.4, 'camoDark')); m.sides(s => m.cyl([-14, s * 1.6, Z + 3], 0.6, 2, 'x', 'steelDark', { seg: 8 })); }
  if (tier >= 4) { m.cyl([2, 0, Z - 0.6], 1.6, 3, 'x', 'gunDark', { seg: 10 }); m.cyl([9, 0, Z - 0.6], 0.6, 12, 'x', 'gun', { seg: 8 }); m.sph([6, -2, Z - 0.6], 1, 'glassLight', { seg: 10 }); }
  writeModel(nm('valkyrie', ax, tier), m);
}

// ---------- Leviathan: dreadnought with three triple turrets (two drawn by the game at 11.5 and -24.5) ----------
// Mk II missile cells and a sonar bulb; Mk III radar faces, CIWS domes and an armour belt; Mk IV
// railgun power conduits glowing along the deck.
function leviathan(ax, tier) {
  const m = model();
  const L = 42, B = 22, H = 5.4;
  const p = [[-L, -B * 0.4], [-L, B * 0.4], [-L + 4, B / 2], [22, B / 2], [33, B * 0.32], [L, 0], [33, -B * 0.32], [22, -B / 2], [-L + 4, -B / 2]];
  m.ext('top', p.map(([x, y]) => [x * 0.99, y * 0.92]), 0, 0.9, 'boot');
  m.ext('top', p, 0.9, H, 'hull');
  m.ext('top', p.map(([x, y]) => [x * 0.995, y * 0.93]), H, H + 0.15, ax ? 'deckRust' : 'deck');
  m.ext('top', p.map(([x, y]) => [x, y * 1.004]), H - 0.8, H - 0.2, 'team');
  for (const x of [11.5, -24.5]) m.cyl([x, 0, H + 0.8], 4.4, 1.6, 'z', 'hullDark', { seg: 18 });
  // superstructure: stepped pyramid (Axis) or tower bridge (Allies)
  if (!ax) {
    m.ext('top', [[4, -5], [4, 5], [2, 7], [-14, 7], [-14, -7], [2, -7]], H, H + 5, 'hull');
    m.ext('top', [[2, -3.6], [2, 3.6], [0.6, 5], [-10, 5], [-10, -5], [0.6, -5]], H + 5, H + 10, 'hull');
    m.ext('top', [[2.05, -3], [2.05, 3], [1, 4.2], [1, -4.2]], H + 8.4, H + 9.4, 'glass');
    m.cyl([-4, 0, H + 15], 0.7, 10, 'z', 'hullDark', { r2: 0.3, seg: 8 });
    m.box(-4.5, -3.5, -3, 3, H + 16.6, H + 17, 'hullDark');
    m.ext('top', [[-15.5, -2.6], [-15.5, 2.6], [-19, 3.2], [-19, -3.2]], H, H + 9, 'hull');
    m.ext('top', [[-15.48, -2.6], [-15.48, 2.6], [-19.02, 3.2], [-19.02, -3.2]], H + 7.4, H + 8.2, 'team');
  } else {
    for (let i = 0; i < 4; i++) m.ext('top', [[4 - i * 1.6, -(7 - i * 1.4)], [4 - i * 1.6, 7 - i * 1.4], [-16 + i * 1.6, 7 - i * 1.4], [-16 + i * 1.6, -(7 - i * 1.4)]], H + i * 3, H + i * 3 + 3, 'hull');
    m.box(-7.6, -4.4, -1.6, 1.6, H + 12, H + 20, 'hullDark');
    m.cyl([-6, 0, H + 21], 2.6, 0.4, 'y', 'metalLight', { seg: 16 });
    m.box(-0.75, -0.6, -4, 4, H + 7.4, H + 8.6, 'glass');
    m.box(-16.05, 4.05, -7.05, 7.05, H + 1.6, H + 2.4, 'team');
  }
  if (tier >= 2) { m.box(15.6, 21, -4.6, 4.6, H + 0.15, H + 0.3, 'grille'); m.box(-36, -30, -5, 5, H + 0.15, H + 0.3, 'grille'); m.sph([L - 2, 0, 0.6], 2.4, 'hull', { s: [1.6, 1, 0.6], seg: 12 }); }
  if (tier >= 3) { m.sides(s => m.box(-34, 30, s * (B / 2 + 0.1) - 0.15, s * (B / 2 + 0.1) + 0.15, 1.4, 3.4, 'hullDark')); for (const [x, y] of [[0, 7.6], [0, -7.6], [-20, 7.2], [-20, -7.2]]) { m.cyl([x, y, H + 1], 1, 2, 'z', 'white', { seg: 10 }); m.sph([x, y, H + 2], 1, 'white', { seg: 10 }); } m.sides(s => m.box(-4, 1, s * 7.05 - 0.12, s * 7.05 + 0.12, H + 1, H + 4.4, 'hullDark')); }
  if (tier >= 4) m.sides(s => m.box(-34, 30, s * 8.6 - 0.25, s * 8.6 + 0.25, H + 0.15, H + 0.45, 'cyan'));
  m.part('turret', [24.5, 0, H + 1.6]);
  const T = [[4.4, -3.4], [4.4, 3.4], [2.4, 4.8], [-4.4, 4.8], [-5.4, 3.6], [-5.4, -3.6], [-4.4, -4.8], [2.4, -4.8]];
  m.ext('top', T, 0, 2.6, 'hull');
  m.ext('top', T.map(([x, y]) => [x * 0.9, y * 0.88]), 2.6, 3.2, 'hullDark');
  m.ext('top', T.map(([x, y]) => [x * 1.01, y * 1.01]), 0.9, 1.5, 'team');
  for (const y of [-2.2, 0, 2.2]) m.cyl([4.4 + 5.4, y, 1.4], 0.42, 10.8, 'x', 'gun', { r2: 0.34, seg: 8 });
  if (tier >= 3) m.sides(s => m.box(-4, 2.4, s * 5.1 - 0.35, s * 5.1 + 0.35, 0.2, 2.4, 'hullDark'));
  if (tier >= 4) for (const y of [-2.2, 0, 2.2]) for (const x of [7, 10, 13]) m.cyl([x, y, 1.4], 0.6, 0.4, 'x', 'cyan', { seg: 8 });
  writeModel(nm('leviathan', ax, tier), m);
}

for (const ax of [false, true]) for (const t of TIERS) {
  for (const f of [0, 1, 2]) goliath(ax, t, f);
  behemoth(ax, t); valkyrie(ax, t); leviathan(ax, t);
}
