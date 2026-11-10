// Low-poly warships: haze-grey hulls, faceted superstructures, team colour on the deck edge.
//
//   node mesh_naval.js
//
// The waterline is z = 0; the origin is the ship's pivot. Ships with several gun turrets carry
// barbettes where the game draws the extra copies of the turret sprite (EXTRA_TURRETS in
// js/art.js, game px / k forward of the pivot).
'use strict';
const { model, writeModel } = require('./mesh_lib');

// hull from a plan outline: boot topping at the waterline, grey sides, dark deck, team deck edge
function hull(m, plan, h, o = {}) {
  m.ext('top', plan.map(([x, y]) => [x * 0.99, y * 0.92]), 0, 0.8, 'boot');
  m.ext('top', plan, 0.8, h, o.mat || 'hull');
  m.ext('top', plan.map(([x, y]) => [x * 0.995, y * 0.92]), h, h + 0.15, o.deck || 'deck');
  m.ext('top', plan.map(([x, y]) => [x, y * 1.005]), h - 0.7, h - 0.2, 'team');
}
// standard plan: transom stern, parallel middle body, pointed bow
const plan = (L0, L1, B, bow = 0.3) => {
  const xb = L1 - (L1 - L0) * bow;
  return [[L0, -B * 0.42], [L0, B * 0.42], [L0 + 3, B / 2], [xb, B / 2], [(xb + L1) / 2, B * 0.32], [L1, 0], [(xb + L1) / 2, -B * 0.32], [xb, -B / 2], [L0 + 3, -B / 2]];
};
// a stacked, tapering deckhouse with a window band facing forward
function house(m, x0, x1, hw, z0, z1, o = {}) {
  const pts = [[x1, -hw * 0.7], [x1, hw * 0.7], [x1 - 1.2, hw], [x0, hw], [x0, -hw], [x1 - 1.2, -hw]];
  m.ext('top', pts, z0, z1, o.mat || 'hull');
  m.ext('top', pts.map(([x, y]) => [x, y * 1.01]), z1, z1 + 0.25, 'hullDark');
  if (o.win !== false) m.ext('top', [[x1 + 0.05, -hw * 0.6], [x1 + 0.05, hw * 0.6], [x1 - 1.0, hw * 0.88], [x1 - 1.0, -hw * 0.88]], z1 - 1.2, z1 - 0.5, 'glass');
}
function mast(m, x, z0, h) {
  m.cyl([x, 0, z0 + h / 2], 0.45, h, 'z', 'hullDark', { r2: 0.2, seg: 6 });
  m.box(x - 0.4, x + 0.4, -2, 2, z0 + h * 0.7, z0 + h * 0.7 + 0.3, 'hullDark');
  m.box(x - 0.5, x + 0.5, -0.5, 0.5, z0 + h - 0.6, z0 + h, 'white');
}
function funnel(m, x, z0, h, w = 1.6) {
  m.ext('top', [[x + 1.6, -w], [x + 1.6, w], [x - 1.6, w * 1.15], [x - 1.6, -w * 1.15]], z0, z0 + h, 'hull');
  m.ext('top', [[x + 1.62, -w], [x + 1.62, w], [x - 1.62, w * 1.15], [x - 1.62, -w * 1.15]], z0 + h - 1.0, z0 + h - 0.4, 'team');
  m.ext('top', [[x + 1.3, -w * 0.8], [x + 1.3, w * 0.8], [x - 1.3, w * 0.95], [x - 1.3, -w * 0.95]], z0 + h, z0 + h + 0.3, 'black');
}
const vls = (m, x0, x1, hw, z) => m.box(x0, x1, -hw, hw, z, z + 0.15, 'grille');
const barbette = (m, x, r, z0, z1) => m.cyl([x, 0, (z0 + z1) / 2], r, z1 - z0, 'z', 'hullDark', { seg: 16 });
// a naval gun: faceted stealth shield and long barrels (1-3)
function navalGun(m, s = 1, n = 1, o = {}) {
  const H = [[3.2, -1.4], [3.2, 1.4], [1.2, 2.4], [-2.6, 2.4], [-2.6, -2.4], [1.2, -2.4]].map(([x, y]) => [x * s, y * s * (n > 1 ? 1.25 : 1)]);
  m.ext('top', H, 0, 1.4 * s, o.mat || 'hull');
  m.ext('top', H.map(([x, y]) => [x * 0.85, y * 0.82]), 1.4 * s, 1.9 * s, 'hullDark');
  m.ext('top', H.map(([x, y]) => [x * 1.01, y * 1.01]), 0.5 * s, 0.9 * s, 'team');
  const ys = n === 1 ? [0] : n === 2 ? [-0.9, 0.9] : [-1.4, 0, 1.4];
  for (const y of ys) m.cyl([3.2 * s + 3.0 * s * (o.len || 1), y * s, 0.85 * s], 0.3 * s, 6.0 * s * (o.len || 1), 'x', 'gun', { r2: 0.24 * s });
}

// ---------- Patrol Boat: planing hull, enclosed bridge, gun forward (Axis: missile boat) ----------
function patrol(ax) {
  const m = model();
  if (!ax) {
    hull(m, plan(-15, 15, 8.6, 0.38), 2.8);
    house(m, -4, 3.6, 3.2, 2.8, 6.2);
    m.box(-3.6, 2.6, -2.8, 2.8, 6.4, 6.9, 'hullDark');
    mast(m, -2, 6.4, 5);
    m.box(-12, -8, -1.4, 1.4, 2.8, 4, 'hullDark'); m.cyl([-7, 0, 3.6], 0.25, 3.4, 'x', 'gunDark', { seg: 6 });
    m.part('turret', [7, 0, 2.95]);
    navalGun(m, 0.65);
  } else {
    hull(m, plan(-15, 16, 10, 0.36), 3.2, { deck: 'deckRust' });
    house(m, -3, 5, 3.6, 3.2, 7);
    mast(m, 0, 7.2, 5.4);
    m.sides(s => m.cyl([-8, s * 2.6, 4.8], 1.1, 9, 'x', 'hullDark', { seg: 10 }));     // missile canisters
    m.sides(s => m.cyl([-3.45, s * 2.6, 4.8], 1.15, 0.2, 'x', 'team', { seg: 10 }));
    m.part('turret', [8, 0, 3.35]);
    m.cyl([0, 0, 0.6], 1.6, 1.2, 'z', 'hull', { seg: 12 });
    m.sph([0, 0, 1.2], 1.6, 'hull', { s: [1, 1, 0.7], seg: 12 });
    m.cyl([0, 0, 0.6], 1.65, 0.4, 'z', 'team', { seg: 12 });
    m.cyl([3.2, 0, 1.2], 0.25, 4, 'x', 'gun', { seg: 6 });
  }
  writeModel('patrol' + (ax ? '_ax' : ''), m);
}

// ---------- Destroyer ----------
// Allied: Arleigh Burke style (flared bow, flat radar faces, twin funnels, aft hangar).
// Axis: Sovremenny style, gun turrets fore and aft (aft one drawn by the game at -14.5), one big funnel.
function destroyer(ax) {
  const m = model();
  if (!ax) {
    const p = [[-21.5, -5.4], [-21.5, 5.4], [-6, 6.5], [8, 6.3], [15, 4.6], [22, 0], [15, -4.6], [8, -6.3], [-6, -6.5]];
    hull(m, p, 3.4);
    m.ext('top', [[14, -4.4], [22, 0], [14, 4.4], [10, 5.6], [10, -5.6]], 3.4, 4.2, 'hull');
    m.ext('top', [[14, -4.2], [21.6, 0], [14, 4.2], [10.2, 5.4], [10.2, -5.4]], 4.2, 4.3, 'deck');
    const dh = [[8.5, -2.8], [8.5, 2.8], [6.5, 4.4], [-3, 4.4], [-3, -4.4], [6.5, -4.4]];
    m.ext('top', dh, 3.4, 6.6, 'hull');
    m.ext('top', dh.map(([x, y]) => [x * 0.88 - 0.3, y * 0.82]), 6.6, 8.6, 'hull');
    m.ext('top', dh.map(([x, y]) => [x * 0.88 - 0.3, y * 0.82]), 8.6, 8.9, 'hullDark');
    m.ext('top', [[7.2, -2.0], [7.2, 2.0], [6.0, 3.2], [6.0, -3.2]], 6.0, 6.7, 'glass');
    m.sides(s => m.box(3.6, 6.0, s * 3.6 - 0.12, s * 3.6 + 0.12, 7.0, 8.4, 'hullDark', { r: [s * -12, 0, 0] }));
    mast(m, 1.0, 8.9, 6.4);
    funnel(m, -5.2, 3.4, 4.4); funnel(m, -10.6, 3.4, 4.4);
    m.box(-8.2, -7.6, -3.4, 3.4, 3.4, 5.6, 'hullDark');
    m.box(-15, -13, -4.6, 4.6, 3.4, 6.4, 'hull'); m.box(-15.2, -12.8, -4.8, 4.8, 6.4, 6.6, 'hullDark');
    m.box(-21.2, -15, -4.6, 4.6, 3.5, 3.56, 'white'); m.box(-20.6, -15.6, -4.0, 4.0, 3.56, 3.6, 'deck');
    m.cyl([-18.1, 0, 3.6], 2.0, 0.06, 'z', 'white', { seg: 18 }); m.cyl([-18.1, 0, 3.62], 1.7, 0.06, 'z', 'deck', { seg: 18 });
    vls(m, 9.0, 11.6, 2.2, 4.3); vls(m, -12.6, -10.8, 2.6, 3.4);
    m.part('turret', [13.5, 0, 4.3]);
    navalGun(m);
  } else {
    hull(m, plan(-23, 23, 13, 0.3), 3.6, { deck: 'deckRust' });
    barbette(m, -14.5, 2.4, 3.6, 4.6);
    house(m, -4, 9, 4.6, 3.6, 7.4);
    house(m, 0, 8, 3.4, 7.4, 10.4);
    mast(m, 3, 10.6, 8);
    m.cyl([3, 0, 19.4], 2.2, 0.4, 'y', 'metalLight', { seg: 14 });                       // big round radar
    funnel(m, -5.6, 3.6, 5.4, 2.6);
    m.sides(s => m.cyl([-10, s * 4.6, 4.8], 0.8, 5, 'x', 'hullDark', { seg: 8 }));
    vls(m, 9.6, 11, 2.4, 3.6);
    m.part('turret', [14.5, 0, 4.6]);
    navalGun(m, 1, 2);
  }
  writeModel('destroyer' + (ax ? '_ax' : ''), m);
}

// ---------- Attack submarine: Virginia (Allies) / broad missile boat with a hump (Axis) ----------
function sub(ax) {
  const m = model();
  const L = ax ? 22 : 20, R = ax ? 4.6 : 3.8;
  m.cyl([0, 0, 0.4], R, L * 1.5, 'x', 'black', { seg: 18 });
  m.sph([L * 0.75, 0, 0.4], R, 'black', { s: [1.6, 1, 1], seg: 18 });
  m.cyl([-L * 0.75 - 2.4, 0, 0.4], R, 4.8, 'x', 'black', { r2: R * 0.25, seg: 18 });
  m.cyl([-L * 0.75 - 2.4, 0, 0.4], R * 0.62, 4.8, 'x', 'black', { r2: 0.3, seg: 18 });
  m.box(-L - 1.4, -L + 1, -0.15, 0.15, -1, 4.6, 'black');                            // rudder
  m.box(-L - 1.4, -L + 1, -3.4, 3.4, 0.6, 0.9, 'black');
  const sx = ax ? 2 : 5;
  m.ext('side', [[sx - 3, 3], [sx + 2.6, 3], [sx + 2, 7.6], [sx - 2.4, 7.6]], -0.9, 0.9, 'black');
  m.box(sx - 2.45, sx + 2.05, -0.95, 0.95, 6.6, 7.2, 'team');
  if (ax) { m.box(-14, 0, -2.6, 2.6, 3.6, 5.2, 'black'); for (let x = -13; x < 0; x += 2.6) m.sides(s => m.cyl([x + 1, s * 1.2, 5.25], 0.8, 0.1, 'z', 'hullDark', { seg: 10 })); }
  else m.sides(s => m.box(sx - 1, sx + 1, s * 0.9, s * 3.4, 5.6, 5.9, 'black'));
  m.cyl([sx, 0, 8.6], 0.15, 2, 'z', 'steel', { seg: 6 });
  m.box(-L * 0.6, L * 0.6, -0.15, 0.15, 3.9, 4.1, 'team');
  writeModel('sub' + (ax ? '_ax' : ''), m);
}

// ---------- Hovercraft: LCAC (Allies) / Zubr with three propellers on pylons (Axis) ----------
function hover(ax) {
  const m = model();
  const L = ax ? 17 : 15, B = ax ? 9.6 : 8;
  m.ext('top', [[-L, -B + 2], [-L + 2, -B], [L - 3, -B], [L, -B + 3], [L, B - 3], [L - 3, B], [-L + 2, B], [-L, B - 2]], 0, 2.6, 'rubber');
  m.ext('top', [[-L + 0.6, -B + 2], [-L + 2, -B + 0.8], [L - 3, -B + 0.8], [L - 0.6, -B + 3], [L - 0.6, B - 3], [L - 3, B - 0.8], [-L + 2, B - 0.8], [-L + 0.6, B - 2]], 2.6, 3.4, 'hullDark');
  m.box(-L + 3, L - 2, -B + 3, B - 3, 3.4, 3.5, ax ? 'deckRust' : 'deck');
  m.sides(s => { m.box(-L + 3, L - 3, s * (B - 2.2) - 0.8, s * (B - 2.2) + 0.8, 3.4, 6.4, 'hull'); m.box(-L + 3, L - 3, s * (B - 1.35) - 0.05, s * (B - 1.35) + 0.05, 5, 5.8, 'team'); });
  m.box(L - 1.6, L - 0.6, -B + 3.4, B - 3.4, 3.4, 5.6, 'hazard', { r: [0, 0, 0] });         // bow ramp
  m.box(4, 8.6, B - 3.8, B - 0.8, 6.4, 9.4, 'hull'); m.box(8.55, 8.7, B - 3.4, B - 1.2, 8, 9, 'glass');
  const fans = ax ? [-B + 3, 0, B - 3] : [-B + 3.4, B - 3.4];
  for (const y of fans) {
    const z = ax ? 11 : 8.6, r = ax ? 3.2 : 3.6;
    m.cyl([-L + 2, y, z], r, 1.6, 'x', 'hullDark', { seg: 18 });
    m.cyl([-L + 2, y, z], r - 0.5, 1.7, 'x', 'black', { seg: 18 });
    m.box(-L + 1.4, -L + 2.6, y - 0.4, y + 0.4, 3.4, z - r + 0.4, 'hullDark');
    m.box(-L + 0.6, -L + 1.4, y - 0.1, y + 0.1, z - 2.4, z + 2.4, 'team');
  }
  writeModel('hover' + (ax ? '_ax' : ''), m);
}

// ---------- Missile Cruiser (Allies): Ticonderoga: two boxy deckhouses with radar faces, big VLS fields ----------
function cruiser() {
  const m = model();
  hull(m, plan(-26, 26, 14, 0.3), 3.8);
  vls(m, 9, 13.6, 3, 3.8); vls(m, -20, -15.6, 3, 3.8);
  house(m, -4, 8, 5, 3.8, 9.6);
  house(m, -12, -4, 4.4, 3.8, 8.4, { win: false });
  m.sides(s => m.box(2, 6, s * 5.05 - 0.12, s * 5.05 + 0.12, 5.6, 8.8, 'hullDark'));
  mast(m, 2, 9.85, 7); mast(m, -8, 8.65, 5);
  funnel(m, -2, 9.85, 2.4, 1.4); funnel(m, -10, 8.65, 2.4, 1.4);
  m.box(-25.6, -21, -5.6, 5.6, 3.85, 3.9, 'white');
  m.part('turret', [18, 0, 3.95]);
  navalGun(m);
  writeModel('cruiser', m);
}

// ---------- Battlecruiser (Axis): Kirov style; aft turret drawn by the game at -16.5 ----------
function battleship() {
  const m = model();
  hull(m, plan(-30, 30, 17, 0.28), 4.4, { deck: 'deckRust' });
  barbette(m, -16.5, 3.2, 4.4, 5.6);
  house(m, -8, 6, 6, 4.4, 10);
  house(m, -4, 4, 4.4, 10, 14);
  m.cyl([0, 0, 18], 0.8, 8, 'z', 'hullDark', { r2: 0.3, seg: 8 });
  m.box(-0.6, 0.6, -3, 3, 19.4, 19.8, 'hullDark');
  m.cyl([0, 0, 22.6], 2.4, 0.4, 'y', 'metalLight', { seg: 16 });
  funnel(m, -10.4, 4.4, 6, 2.4);
  vls(m, 6.6, 9.6, 4, 4.4); vls(m, -26, -21, 4.4, 4.4);
  m.sides(s => m.box(-20, 20, s * 8.45 - 0.1, s * 8.45 + 0.1, 1.2, 2.6, 'hullDark'));      // armour belt
  m.part('turret', [15.5, 0, 5.6]);
  navalGun(m, 1.15, 3, { len: 1.2 });
  writeModel('battleship', m);
}

// ---------- Aircraft Carrier (UK): Queen Elizabeth: wide flight deck, ski-jump, two islands ----------
function carrier() {
  const m = model();
  hull(m, plan(-34, 34, 15, 0.3), 5, { deck: 'hullDark' });
  m.ext('top', [[-35, -10], [27, -10], [36, -6], [36, 6], [27, 11], [-35, 11]], 5, 6.4, 'hull');
  m.ext('top', [[-35, -10], [27, -10], [36, -6], [36, 6], [27, 11], [-35, 11]], 6.4, 6.6, 'flightDeck');
  m.ext('side', [[26, 6.6], [36, 6.6], [36, 8.6]], -6, 6, 'flightDeck');                      // ski-jump
  m.box(-34, 26, -0.2, 0.2, 6.6, 6.65, 'white');
  for (let x = -30; x < 26; x += 6) m.box(x, x + 3, 3.8, 4.1, 6.6, 6.65, 'white');
  m.box(-35.1, 36.1, -10.1, 11.1, 5.6, 6.2, 'team');
  for (const [x0, x1] of [[2, 10], [-18, -10]]) {
    m.ext('top', [[x1, 7], [x1, 10], [x0, 10.6], [x0, 7]], 6.6, 13.4, 'hull');
    m.ext('top', [[x1 + 0.05, 7.2], [x1 + 0.05, 9.8], [x1 - 1, 10], [x1 - 1, 7.2]], 11.6, 12.6, 'glass');
    m.ext('top', [[x1, 7], [x1, 10], [x0, 10.6], [x0, 7]], 13.4, 13.6, 'hullDark');
  }
  mast(m, 6, 13.6, 6);
  m.cyl([-14, 8.8, 15], 1.6, 3, 'z', 'metalLight', { seg: 12 });
  // parked F-35Bs
  for (const [x, y] of [[-26, -5], [-18, -5], [16, -5]]) {
    m.ext('top', [[x + 3.4, y], [x + 0.6, y - 0.8], [x - 1.4, y - 3.4], [x - 2.6, y - 3.4], [x - 2.4, y - 0.8], [x - 3.4, y - 0.6], [x - 3.4, y + 0.6], [x - 2.4, y + 0.8], [x - 2.6, y + 3.4], [x - 1.4, y + 3.4], [x + 0.6, y + 0.8]], 6.6, 7.4, 'jet');
  }
  writeModel('carrier', m);
}

// ---------- Maya-class Aegis destroyer (Japan): tall block with octagonal SPY faces ----------
function maya() {
  const m = model();
  hull(m, plan(-23, 23, 13, 0.3), 3.6);
  m.ext('top', [[9, -3.4], [9, 3.4], [6.4, 5], [-4, 5], [-4, -5], [6.4, -5]], 3.6, 10.6, 'hull');
  m.ext('top', [[9, -3.4], [9, 3.4], [6.4, 5], [-4, 5], [-4, -5], [6.4, -5]], 10.6, 10.9, 'hullDark');
  m.ext('top', [[9.05, -2.6], [9.05, 2.6], [8, 3.8], [8, -3.8]], 9, 9.8, 'glass');
  m.sides(s => m.cyl([5, s * 5.05, 7.2], 2.0, 0.2, 'y', 'hullDark', { seg: 8 }));
  m.cyl([8.05, 0, 7.2], 2.0, 0.2, 'x', 'hullDark', { seg: 8 });
  mast(m, 1.4, 10.9, 7);
  funnel(m, -7, 3.6, 5.4, 1.8);
  m.box(-17, -11, -5, 5, 3.6, 6.6, 'hull'); m.box(-17.2, -10.8, -5.2, 5.2, 6.6, 6.8, 'hullDark');
  vls(m, 9.6, 12, 2.4, 3.6); vls(m, -10.6, -9, 2.6, 3.6);
  m.box(-22.6, -17.4, -4.6, 4.6, 3.65, 3.7, 'white');
  m.part('turret', [14, 0, 3.75]);
  navalGun(m);
  writeModel('maya', m);
}

for (const ax of [false, true]) { patrol(ax); destroyer(ax); sub(ax); hover(ax); }
cruiser(); battleship(); carrier(); maya();
