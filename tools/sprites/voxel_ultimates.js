// Builds the ultimate units, one model per refit tier (Mk I to Mk IV), and writes them as
// MagicaVoxel .vox files into assets/voxels/. Each tier keeps the model before it and bolts more
// on, so the unit visibly grows stronger as it is refitted.
//
//   node voxel_ultimates.js
//
// Axes: x forward, y to the right, z up. Pivots are set in render.js; they stay the same for
// every tier of a unit, so the models only ever grow outward.
'use strict';
const { C, TEAM, TEAM_LIGHT, TEAM_DARK, grid, writeVox } = require('./voxel_lib');

const TIERS = [1, 2, 3, 4];
const name = (base, tier, part = '') => `${base}${tier > 1 ? '_t' + tier : ''}${part}.vox`;

function trackRun(g, x0, x1, y0, y1, h = 4) {
  g.box(x0 + 1, x1 - 1, y0, y1, 0, h, C.track);
  g.box(x0, x1, y0, y1, 1, h - 1, C.track);
  for (let x = x0 + 1; x <= x1 - 1; x += 2) { g.set(x, y0, h, C.link); g.set(x, y1, h, C.link); }
  for (let x = x0 + 3; x <= x1 - 3; x += 5) for (const y of [y0, y1]) { g.set(x, y, 1, C.wheel); g.set(x, y, 2, C.hub); g.set(x + 1, y, 1, C.wheel); g.set(x + 1, y, 2, C.wheel); }
}
function slopeFront(g, xFrom, xTo, y0, y1, zTop) {
  for (let x = xFrom; x <= xTo; x++) for (let z = zTop - (x - xFrom); z <= zTop; z++) for (let y = y0; y <= y1; y++) g.del(x, y, z + 1);
}
// rail coils: rings of glowing cyan round a barrel running along x
function coils(g, x0, x1, step, y, z, r = 1) {
  for (let x = x0; x <= x1; x += step) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) if (Math.abs(dy) === r || Math.abs(dz) === r) g.set(x, y + dy, z + dz, C.rail);
}

// ---------- Goliath Exosuit: a walking suit of armour twice a soldier's height ----------
// Mk I minigun arm; Mk II armour plates and a shoulder rocket pod; Mk III jump jets, a glowing
// power core and a command antenna; Mk IV a shoulder railgun and team-coloured trim.
function goliath(tier, frame) {
  const g = grid(), X = 2, Y = 8;
  const step = [[0, 0], [2, -2], [-2, 2]][frame];
  for (const [s, dx] of [[-1, step[0]], [1, step[1]]]) {                // legs
    const y = Y + s * 3;
    g.box(X + 1 + dx, X + 6 + dx, y - 1, y + 1, 0, 1, C.steelDark);       // feet
    g.box(X + 3 + dx, X + 4 + dx, y - 1, y + 1, 2, 5, C.steel);           // shins
    g.box(X + 2 + dx, X + 5 + dx, y - 1, y + 1, 5, 6, C.camoDark);        // knees
    g.camo(X + 2 + dx / 2, X + 5 + dx / 2, y - 1, y + 1, 7, 9, 3 + frame);// thighs
  }
  g.box(X + 1, X + 6, Y - 4, Y + 4, 9, 10, C.steelDark);                 // hips
  g.camo(X, X + 7, Y - 4, Y + 4, 11, 17, 11);                            // torso
  g.box(X + 7, X + 7, Y - 2, Y + 2, 14, 16, C.glassDark);                // cockpit glass
  g.box(X - 1, X - 1, Y - 3, Y + 3, 11, 17, TEAM);                       // power pack
  g.box(X + 2, X + 5, Y - 1, Y + 1, 18, 19, C.camoDark);                 // helmet
  g.set(X + 5, Y, 18, C.light);                                         // visor
  for (const s of [-1, 1]) {                                            // arms and shoulders
    const y = Y + s * 6;
    g.box(X + 2, X + 5, y - 1, y + 1, 10, 15, C.camo);
    g.box(X + 1, X + 6, y - 1, y + 1, 16, 17, TEAM_DARK);
  }
  g.box(X + 5, X + 13, Y + 6, Y + 6, 11, 12, C.gunDark);                 // minigun on the right arm
  g.box(X + 5, X + 7, Y + 5, Y + 7, 10, 13, C.steel);                    // ammo drum
  g.box(X + 6, X + 7, Y - 6, Y - 6, 10, 11, C.steelDark);                // fist
  if (tier >= 2) {
    g.box(X + 8, X + 8, Y - 3, Y + 3, 11, 13, C.steel);                  // chest plate
    for (let y = Y - 3; y <= Y + 3; y += 3) g.set(X + 8, y, 12, C.grille);
    for (const s of [-1, 1]) g.box(X, X + 7, Y + s * 7, Y + s * 7, 15, 17, C.steel); // heavier shoulder guards
    for (const s of [-1, 1]) for (let x = X; x <= X + 7; x += 3) g.set(x, Y + s * 7, 16, C.grille);
    g.box(X + 1, X + 7, Y - 8, Y - 5, 18, 20, C.olive);                  // rocket pod on the left shoulder
    for (const y of [Y - 7, Y - 6]) for (const z of [18, 20]) g.set(X + 7, y, z, C.gunDark);
  }
  if (tier >= 3) {
    for (const y of [Y - 3, Y + 3]) {                                   // jump jets
      g.box(X - 2, X - 2, y - 1, y, 10, 16, C.steelDark);
      g.box(X - 2, X - 2, y - 1, y, 9, 9, C.flame);
    }
    g.box(X + 8, X + 8, Y - 1, Y + 1, 14, 14, C.rail);                   // power core glow
    g.box(X, X, Y - 2, Y - 2, 18, 24, C.steelDark); g.set(X, Y - 2, 25, C.light); // command antenna
    for (const s of [-1, 1]) g.box(X + 2, X + 5, Y + s * 3 + s, Y + s * 3 + s, 7, 9, C.steel); // thigh armour
  }
  if (tier >= 4) {
    g.box(X - 1, X + 17, Y + 6, Y + 6, 19, 20, C.gun);                   // railgun over the right shoulder
    g.box(X + 15, X + 17, Y + 6, Y + 6, 19, 20, C.gunDark);
    coils(g, X + 4, X + 14, 3, Y + 6, 19, 1);
    g.box(X - 1, X + 3, Y + 5, Y + 7, 18, 21, C.steelDark);              // capacitor
    g.box(X + 3, X + 4, Y - 1, Y + 1, 20, 20, TEAM_LIGHT);               // crest
    for (const s of [-1, 1]) g.box(X + 2, X + 5, Y + s * 3 + s, Y + s * 3 + s, 8, 8, TEAM); // leg trim
    g.box(X, X + 7, Y - 4, Y - 4, 13, 13, TEAM); g.box(X, X + 7, Y + 4, Y + 4, 13, 13, TEAM);
  }
  return g;
}
for (const t of TIERS) for (let f = 0; f < 3; f++) writeVox(name('goliath', t, '_' + f), goliath(t, f));

// ---------- Behemoth: super-heavy tank on four tracks ----------
// Mk I twin 155 mm guns; Mk II reactive armour skirts and turret rocket pods; Mk III hull
// gatling sponsons, a dozer wedge and glowing nanite repair vents; Mk IV a spinal railgun.
function behemothHull(tier) {
  const h = grid();
  for (const [y0, y1] of [[0, 4], [6, 10], [25, 29], [31, 35]]) trackRun(h, 1, 47, y0, y1, 5);
  h.camo(2, 46, 5, 30, 2, 10, 131);
  slopeFront(h, 39, 46, 5, 30, 10);
  for (let x = 1; x <= 47; x++) for (const y of [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35]) h.set(x, y, 6, (x + y) % 11 === 0 ? C.camoDark : C.camo); // fenders
  for (let x = 1; x <= 47; x++) { h.set(x, 0, 6, TEAM_DARK); h.set(x, 35, 6, TEAM_DARK); }
  h.box(3, 12, 9, 26, 11, 11, C.grille);                                 // engine decks
  for (let x = 4; x <= 12; x += 2) h.box(x, x, 9, 26, 11, 11, C.steelDark);
  h.box(2, 2, 11, 24, 4, 8, TEAM);                                       // rear marking
  for (const y of [7, 28]) h.set(46, y, 4, C.light);
  if (tier >= 2) {                                                       // ERA skirts along both sides
    for (let x = 3; x <= 45; x++) for (let z = 2; z <= 6; z++) for (const y of [0, 35]) h.set(x, y === 0 ? 0 : 35, z, (x % 3 === 0 || z === 4) ? C.grille : C.steel);
    for (let x = 3; x <= 45; x++) { h.set(x, 0, 7, C.steel); h.set(x, 35, 7, C.steel); }
  }
  if (tier >= 3) {
    for (const y of [5, 29]) {                                           // gatling sponsons on the front corners
      h.box(37, 40, y - 1, y + 2, 7, 9, C.steelDark);
      h.box(41, 45, y, y + 1, 8, 8, C.gunDark);
    }
    h.box(47, 49, 3, 32, 1, 4, C.steel);                                 // dozer wedge
    for (let y = 4; y <= 31; y += 3) h.set(49, y, 3, C.hazard);
    for (let x = 4; x <= 12; x += 4) h.box(x, x + 1, 13, 22, 12, 12, C.rail); // nanite repair vents
  }
  if (tier >= 4) {
    for (let x = 3; x <= 38; x++) { h.set(x, 5, 11, TEAM); h.set(x, 30, 11, TEAM); } // team trim
    h.box(14, 18, 11, 24, 11, 13, C.steelDark);                          // capacitor bank feeding the railgun
    for (let y = 12; y <= 23; y += 2) h.set(18, y, 13, C.rail);
  }
  return h;
}
const BO = 16; // Behemoth turret pivot
function behemothTurret(tier) {
  const t = grid(), O = BO;
  for (let x = -12; x <= 10; x++) for (let y = -11; y <= 11; y++) {
    if ((x <= -10 || x >= 8) && Math.abs(y) >= 9) continue;              // chamfered corners
    for (let z = 0; z <= 7; z++) t.set(x + O, y + O, z, z === 4 ? TEAM : C.camo);
  }
  t.camo(O - 12, O + 10, O - 11, O + 11, 0, 3, 137); t.camo(O - 12, O + 10, O - 11, O + 11, 5, 7, 139);
  for (const [k, e] of [...t.v]) { const x = e[0] - O, y = e[1] - O; if ((x <= -10 || x >= 8) && Math.abs(y) >= 9) t.v.delete(k); }
  t.box(O + 10, O + 12, O - 8, O + 8, 1, 6, C.steelDark);                 // mantlet
  for (const y of [O - 5, O + 4]) {                                       // twin 155 mm guns
    t.box(O + 12, O + 34, y, y + 1, 3, 4, C.gun);
    t.box(O + 32, O + 35, y - 1, y + 2, 2, 5, C.gunDark);
  }
  t.box(O - 8, O - 4, O + 3, O + 7, 8, 8, C.steelDark); t.set(O - 6, O + 5, 9, C.steelDark); // commander's cupola
  t.box(O - 12, O - 12, O - 6, O + 6, 2, 6, C.steelDark);                 // bustle rack
  if (tier >= 2) {
    for (const y0 of [O - 15, O + 12]) {                                  // rocket pods on the turret sides
      t.box(O - 8, O + 4, y0, y0 + 3, 2, 6, C.olive);
      for (let y = y0; y <= y0 + 3; y += 2) for (const z of [3, 5]) t.set(O + 4, y, z, C.gunDark);
    }
  }
  if (tier >= 3) {
    for (let x = O - 9; x <= O + 7; x++) for (const y of [O - 12, O + 11]) if (!t.get(x, y, 7)) t.set(x, y, 7, C.steel); // armour lip
    t.box(O + 2, O + 6, O - 9, O - 6, 8, 9, C.steelDark); t.set(O + 6, O - 8, 9, C.glassDark); // sensor head
  }
  if (tier >= 4) {
    t.box(O - 10, O + 38, O - 1, O, 9, 10, C.gun);                        // spinal railgun on the roof
    t.box(O + 36, O + 38, O - 2, O + 1, 8, 11, C.gunDark);
    for (let x = O - 2; x <= O + 34; x += 4) for (let y = O - 2; y <= O + 1; y++) for (const z of [8, 11]) t.set(x, y, z, C.rail);
    for (let x = O - 2; x <= O + 34; x += 4) for (const y of [O - 2, O + 1]) for (const z of [9, 10]) t.set(x, y, z, C.rail);
    t.box(O - 11, O - 4, O - 3, O + 2, 8, 10, C.steelDark);               // breech
    t.box(O - 12, O + 10, O - 11, O - 11, 4, 4, TEAM_LIGHT); t.box(O - 12, O + 10, O + 11, O + 11, 4, 4, TEAM_LIGHT);
  }
  return t;
}
for (const t of TIERS) { writeVox(name('behemoth', t, '_hull'), behemothHull(t)); writeVox(name('behemoth', t, '_turret'), behemothTurret(t)); }

// ---------- Valkyrie: heavy gunship lifted by four ducted fans ----------
// Mk I chin chain gun; Mk II stub wings with Hellfire racks; Mk III armour, AA missile rails and
// flare pods; Mk IV a belly-mounted 105 mm gun and a sensor ball.
function valkyrie(tier) {
  const g = grid(), Y = 16;
  for (let x = 4; x <= 36; x++) {                                         // fuselage, tapering to the tail
    const half = x < 10 ? 2 : 3, top = x < 10 ? 6 : x > 32 ? 7 : 9;
    for (let y = Y - half; y <= Y + half; y++) for (let z = 2; z <= top; z++) g.set(x, y, z, C.camo);
  }
  g.camo(4, 36, Y - 3, Y + 3, 2, 9, 151);
  for (const [k, e] of [...g.v]) { const x = e[0], half = x < 10 ? 2 : 3, top = x < 10 ? 6 : x > 32 ? 7 : 9; if (Math.abs(e[1] - Y) > half || e[2] > top) g.v.delete(k); }
  g.box(33, 37, Y - 2, Y + 2, 6, 8, C.glassDark);                         // cockpit
  g.box(38, 38, Y - 1, Y + 1, 3, 6, C.camoDark);                          // nose
  for (let x = 8; x <= 32; x++) { g.set(x, Y - 3, 5, TEAM_DARK); g.set(x, Y + 3, 5, TEAM_DARK); }
  for (const s of [-1, 1]) g.box(1, 4, Y + s * 2, Y + s * 2, 6, 11, TEAM); // twin tail fins
  g.box(1, 4, Y - 2, Y + 2, 5, 5, C.camoDark);
  for (const [fx, fy] of [[11, Y - 11], [11, Y + 11], [29, Y - 11], [29, Y + 11]]) { // ducted fans on pylons
    for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; for (const z of [6, 7]) g.set(Math.round(fx + Math.cos(t) * 4.6), Math.round(fy + Math.sin(t) * 4.6), z, z === 7 ? TEAM : C.steelDark); }
    for (let i = -3; i <= 3; i++) { g.set(fx + i, fy, 6, C.grille); g.set(fx, fy + i, 6, C.grille); }
    const dir = Math.sign(Y - fy);
    for (let y = fy + dir * 4; y !== Y + dir * -3; y += dir) g.box(fx - 1, fx + 1, y, y, 6, 6, C.steelDark);
  }
  g.box(36, 40, Y, Y, 1, 1, C.gunDark); g.box(35, 36, Y - 1, Y + 1, 1, 2, C.steelDark); // chin chain gun
  if (tier >= 2) {
    for (const s of [-1, 1]) {                                            // stub wings with Hellfire racks
      g.box(19, 23, Y + s * 4, Y + s * 6, 5, 5, C.camoDark);
      for (const y of [Y + s * 5, Y + s * 6]) g.box(18, 24, y, y, 3, 4, C.olive);
      g.set(25, Y + s * 5, 3, C.red); g.set(25, Y + s * 6, 3, C.red);
    }
  }
  if (tier >= 3) {
    for (let x = 10; x <= 32; x++) for (let z = 3; z <= 7; z++) for (const y of [Y - 4, Y + 4]) if (z !== 5 && !g.get(x, y, z)) g.set(x, y, z, (x % 4 === 0) ? C.grille : C.steel); // armour panels
    for (const y of [Y - 2, Y + 2]) { g.box(14, 26, y, y, 10, 10, C.white); g.set(26, y, 10, C.red); } // AA missile rails
    g.box(14, 26, Y, Y, 10, 10, C.steelDark);
    for (const s of [-1, 1]) g.box(5, 7, Y + s * 3, Y + s * 3, 2, 3, C.hazard); // flare pods
  }
  if (tier >= 4) {
    g.box(16, 44, Y + 3, Y + 4, 1, 2, C.gunDark);                         // 105 mm gun under the fuselage
    g.box(42, 45, Y + 2, Y + 5, 1, 3, C.steelDark);
    g.box(16, 22, Y + 1, Y + 5, 0, 2, C.steelDark);                       // gun mount
    g.box(38, 39, Y - 2, Y - 1, 0, 1, C.glassDark);                       // sensor ball
    for (let x = 8; x <= 32; x++) { g.set(x, Y - 3, 8, TEAM); g.set(x, Y + 3, 8, TEAM); } // team trim
    for (const [fx, fy] of [[11, Y - 11], [11, Y + 11], [29, Y - 11], [29, Y + 11]]) g.set(fx, fy, 7, C.rail);
  }
  return g;
}
for (const t of TIERS) writeVox(name('valkyrie', t), valkyrie(t));

// ---------- Leviathan: dreadnought with three main turrets (drawn by the game) ----------
// Mk I armoured hull, tower bridge and barbettes; Mk II missile cells, torpedo tubes and a sonar
// bulb; Mk III Aegis radar faces, CIWS domes and an armour belt; Mk IV railgun power conduits.
function hull(g, L, B, H, { bow = 0.3 } = {}) {
  const Y = Math.ceil(B / 2);
  for (let x = 0; x < L; x++) {
    const f = x / (L - 1);
    let w = 1;
    if (f > 1 - bow) { const t = (f - (1 - bow)) / bow; w = Math.sqrt(Math.max(0, 1 - t * t)); }
    else if (f < 0.08) w = 0.86 + f / 0.08 * 0.14;
    const half = B / 2 * w;
    for (let z = 0; z <= H; z++) {
      const top = H + (f > 0.8 ? 1 : 0);
      if (z > top) continue;
      const hz = half * (0.78 + 0.22 * z / H);
      for (let y = Math.round(Y - hz); y <= Math.round(Y + hz); y++) {
        const edge = Math.abs(y - Y) >= hz - 1;
        let c = z === 0 ? C.boot : z === top ? C.deck : C.hull;
        if (z === top - 1 && edge) c = TEAM_DARK;
        if (z === top && edge) c = C.hullDark;
        g.set(x, y, z, c);
      }
    }
  }
  return Y;
}
function house(g, x0, x1, y0, y1, z0, z1, c = C.hull) {
  g.box(x0, x1, y0, y1, z0, z1, c);
  g.box(x0, x1, y0, y1, z1, z1, C.hullDark);
  for (let y = y0 + 1; y < y1; y += 2) g.set(x1, y, z1 - 1, C.glassDark);
  for (let x = x0 + 1; x < x1; x += 2) g.set(x, y1, z1 - 1, C.glassDark);
}
function vls(g, x0, x1, y0, y1, z) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) g.set(x, y, z, (x + y) % 2 ? C.black : C.deckLight); }
const LEV = { L: 84, B: 21, H: 6, turrets: [66, 53, 17] };
function leviathanHull(tier) {
  const g = grid(), Y = hull(g, LEV.L, LEV.B, LEV.H);
  house(g, 28, 46, Y - 6, Y + 6, 7, 13);
  g.box(38, 46, Y - 4, Y + 4, 13, 20, C.hull);                            // tower bridge
  for (let y = Y - 3; y <= Y + 3; y++) { g.set(46, y, 18, C.glassDark); g.set(46, y, 15, C.glassDark); }
  g.box(39, 45, Y - 5, Y + 5, 20, 20, C.hullDark);
  g.box(42, 42, Y, Y, 21, 30, C.steelDark); g.box(42, 42, Y - 3, Y + 3, 27, 27, C.steelDark); g.set(42, Y, 31, C.light); // mast
  for (const x of [30, 35]) { g.box(x, x + 3, Y - 3, Y + 3, 13, 18, C.hullDark); g.box(x, x + 3, Y - 3, Y + 3, 18, 18, TEAM); g.box(x + 1, x + 2, Y - 2, Y + 2, 18, 18, C.black); } // funnels
  for (const x of LEV.turrets) for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; g.set(Math.round(x + Math.cos(t) * 5.5), Math.round(Y + Math.sin(t) * 5.5), 7, C.hullDark); } // barbettes
  for (const x of [30, 36, 42]) for (const s of [-1, 1]) g.box(x, x + 1, Y + s * 8, Y + s * 8, 7, 8, C.gunDark); // secondary mounts
  if (tier >= 2) {
    vls(g, 5, 10, Y - 4, Y + 4, 7);                                       // missile cells aft
    vls(g, 58, 60, Y - 3, Y + 3, 7);
    for (let x = 12; x <= 24; x += 4) for (const y of [Y - 9, Y + 9]) g.box(x, x + 1, y, y, 3, 3, C.black); // torpedo tubes
    for (let x = 80; x <= 85; x++) for (let y = Y - 2; y <= Y + 2; y++) g.set(x, y, 0, C.hullDark); // sonar bulb
  }
  if (tier >= 3) {
    for (const y of [Y - 4, Y + 4]) for (let x = 39; x <= 45; x++) for (let z = 14; z <= 19; z++) if (Math.abs(x - 42) + Math.abs(z - 16.5) <= 3.5) g.set(x, y, z, C.steelDark); // SPY radar faces
    for (let y = Y - 2; y <= Y + 2; y++) for (let z = 14; z <= 19; z++) if (Math.abs(y - Y) + Math.abs(z - 16.5) <= 3) g.set(47, y, z, C.steelDark);
    for (const [x, s] of [[28, -1], [28, 1], [47, -1], [47, 1]]) { g.box(x, x + 1, Y + s * 6, Y + s * 6, 14, 15, C.white); g.set(x, Y + s * 6, 16, C.white); } // CIWS domes
    for (const e of [...g.v.values()]) if ((e[2] === 2 || e[2] === 3) && e[3] === C.hull && e[0] > 6 && e[0] < 76) e[3] = C.steel; // armour belt
  }
  if (tier >= 4) {
    for (let x = 8; x <= 72; x++) { if (!LEV.turrets.some(t => Math.abs(x - t) < 7)) { g.set(x, Y - 6, 7, C.rail); g.set(x, Y + 6, 7, C.rail); } } // power conduits
    for (const e of [...g.v.values()]) if (e[2] === LEV.H - 1 && e[3] === TEAM_DARK) e[3] = TEAM;
    g.box(42, 42, Y - 4, Y - 4, 28, 30, TEAM); g.box(42, 42, Y - 6, Y - 4, 30, 30, TEAM); // ensign
  }
  return g;
}
const LO = 6; // Leviathan turret pivot
function leviathanTurret(tier) {
  const t = grid(), O = LO, r = 5, h = 4;
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = 0; z <= h; z++) {
    if (x * x + y * y > r * r + 1 || (x > r - 2 && z === h)) continue;
    t.set(O + x, O + y, z, z === 1 ? TEAM : z === h ? C.hullDark : C.hull);
  }
  for (const dy of [-2, 0, 2]) t.box(O + r, O + r + 13, O + dy, O + dy, 2, 2, C.gunDark);
  if (tier >= 3) for (let x = -r; x <= r - 2; x++) for (const y of [O - r - 1, O + r + 1]) t.set(O + x, y, 2, C.steel); // armoured cheeks
  if (tier >= 4) {
    for (const dy of [-2, 0, 2]) { t.box(O + r, O + r + 16, O + dy, O + dy, 2, 2, C.gun); t.set(O + r + 16, O + dy, 2, C.gunDark); }
    for (let x = O + r + 2; x <= O + r + 14; x += 3) for (let y = O - 3; y <= O + 3; y++) t.set(x, y, 3, C.rail);
    t.box(O - 3, O + 1, O - 2, O + 2, h + 1, h + 1, C.steelDark); t.set(O - 1, O, h + 2, C.rail);
  }
  return t;
}
for (const t of TIERS) { writeVox(name('leviathan', t, '_hull'), leviathanHull(t)); writeVox(name('leviathan', t, '_turret'), leviathanTurret(t)); }
