// Builds the voxel models for the navy and writes them as MagicaVoxel .vox files into
// assets/voxels/. The water surface is z = 0: hulls start at the waterline.
//
//   node voxel_naval.js
//
// Axes: x forward (bow at high x), y to the right, z up. Pivots are set in render.js.
'use strict';
const { C, TEAM, TEAM_DARK, grid, writeVox } = require('./voxel_lib');

// A hull L long and B wide, H tall at the deck: sharp bow, rounded stern, sides tumbling home a
// little toward the waterline, red boot-top along z = 0 and a team stripe under the deck edge.
// Returns the centre line y.
function hull(g, L, B, H, { bow = 0.32, deck = C.deck, stripe = true } = {}) {
  const Y = Math.ceil(B / 2);
  for (let x = 0; x < L; x++) {
    const f = x / (L - 1);
    let w = 1;
    if (f > 1 - bow) { const t = (f - (1 - bow)) / bow; w = Math.sqrt(Math.max(0, 1 - t * t)); }
    else if (f < 0.08) w = 0.86 + f / 0.08 * 0.14;
    const half = B / 2 * w;
    for (let z = 0; z <= H; z++) {
      // the bow rises a little (sheer); sides narrow toward the water
      const top = H + (f > 0.8 ? 1 : 0);
      if (z > top) continue;
      const hz = half * (0.78 + 0.22 * z / H);
      for (let y = Math.round(Y - hz); y <= Math.round(Y + hz); y++) {
        const edge = Math.abs(y - Y) >= hz - 1;
        let c = z === 0 ? C.boot : z === top ? deck : C.hull;
        if (stripe && z === top - 1 && edge) c = TEAM_DARK;
        if (z === top && edge) c = C.hullDark;
        g.set(x, y, z, c);
      }
    }
  }
  return Y;
}
// a deckhouse: grey walls with a row of dark windows facing forward and to starboard
function house(g, x0, x1, y0, y1, z0, z1, c = C.hull) {
  g.box(x0, x1, y0, y1, z0, z1, c);
  g.box(x0, x1, y0, y1, z1, z1, C.hullDark);
  for (let y = y0 + 1; y < y1; y += 2) g.set(x1, y, z1 - 1, C.glassDark);
  for (let x = x0 + 1; x < x1; x += 2) g.set(x, y1, z1 - 1, C.glassDark);
}
function mast(g, x, y, z0, z1) {
  g.box(x, x, y, y, z0, z1, C.steelDark);
  g.box(x, x, y - 2, y + 2, z1 - 2, z1 - 2, C.steelDark);
  g.set(x, y, z1 + 1, C.light);
}
function funnel(g, x0, x1, y0, y1, z0, z1) {
  g.box(x0, x1, y0, y1, z0, z1, C.hullDark);
  g.box(x0, x1, y0, y1, z1, z1, TEAM);
  g.box(x0 + 1, x1 - 1, y0 + 1, y1 - 1, z1, z1, C.black);
}
// vertical launch cells: a grid of dark hatches on the deck
function vls(g, x0, x1, y0, y1, z) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) g.set(x, y, z, (x + y) % 2 ? C.black : C.deckLight); }
// a gun turret on its own grid, pivot at (O, O): a rounded gunhouse with a barrel forward
function gunTurret(name, r, len, h = 3, barrels = 1) {
  const t = grid(), O = r + 1;
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = 0; z <= h; z++) {
    if (x * x + y * y > r * r + 1 || (x > r - 2 && z === h)) continue;
    t.set(O + x, O + y, z, z === 1 ? TEAM : z === h ? C.hullDark : C.hull);
  }
  const off = barrels === 1 ? [0] : barrels === 2 ? [-1, 1] : [-2, 0, 2];
  for (const dy of off) t.box(O + r, O + r + len, O + dy, O + dy, 1, 1, C.gunDark);
  writeVox(name, t);
}

// ---------- Patrol Boat: small fast gunboat ----------
{
  const g = grid(), Y = hull(g, 30, 8, 3, { bow: 0.38 });
  house(g, 9, 16, Y - 2, Y + 2, 4, 7);
  g.box(15, 16, Y - 2, Y + 2, 7, 7, C.glassDark);
  mast(g, 11, Y, 8, 12);
  g.box(3, 6, Y - 1, Y + 1, 4, 5, C.gunDark);       // aft autocannon mount
  g.box(6, 9, Y, Y, 5, 5, C.gunDark);
  writeVox('patrol_hull.vox', g);
  gunTurret('patrol_turret.vox', 2, 6, 2);
}

// ---------- Destroyer: forward gun, missile cells, two-block superstructure ----------
{
  const g = grid(), Y = hull(g, 44, 11, 4);
  vls(g, 26, 29, Y - 2, Y + 2, 5);
  house(g, 14, 25, Y - 4, Y + 4, 5, 11);
  g.box(21, 25, Y - 4, Y + 4, 11, 13, C.hull);          // bridge
  for (let y = Y - 3; y <= Y + 3; y++) g.set(25, y, 12, C.glassDark);
  mast(g, 19, Y, 12, 21);
  funnel(g, 10, 13, Y - 2, Y + 2, 5, 10);
  vls(g, 6, 8, Y - 2, Y + 2, 5);
  g.box(1, 5, Y - 4, Y + 4, 5, 5, C.deckLight);          // helicopter pad
  for (let y = Y - 2; y <= Y + 2; y++) g.set(3, y, 5, C.white);
  writeVox('destroyer_hull.vox', g);
  gunTurret('destroyer_turret.vox', 3, 7, 3);
}

// ---------- Attack Submarine: long low cylinder, sail and planes ----------
{
  const g = grid(), Y = 4, L = 40;
  for (let x = 0; x < L; x++) {
    const f = x / (L - 1), r = 3.6 * (f > 0.85 ? Math.sqrt(1 - ((f - 0.85) / 0.15) ** 2) : f < 0.25 ? 0.45 + 0.55 * f / 0.25 : 1);
    for (let y = Math.round(Y - r); y <= Math.round(Y + r); y++) for (let z = 0; z <= Math.round(r * 0.7); z++) {
      if ((y - Y) ** 2 / (r * r) + (z / (r * 0.7 + 0.01)) ** 2 > 1.05) continue;
      g.set(x, y, z, C.black);
    }
  }
  g.box(24, 29, Y - 1, Y + 1, 3, 7, C.black);              // sail
  g.box(24, 29, Y - 1, Y + 1, 7, 7, TEAM_DARK);
  g.box(26, 27, Y - 3, Y + 3, 5, 5, C.black);              // sail planes
  g.box(0, 2, Y, Y, 1, 4, C.black);                        // rudder
  g.box(1, 2, Y - 3, Y + 3, 1, 1, C.black);                // stern planes
  g.set(27, Y, 8, C.steel); g.set(27, Y, 9, C.steel);      // periscope
  for (let x = 8; x <= 32; x += 3) g.set(x, Y, 3, TEAM_DARK);
  writeVox('sub.vox', g);
}

// ---------- Hovercraft: inflated black skirt, open deck, two big fans at the back ----------
{
  const g = grid(), L = 30, B = 15, Y = 8;
  for (let x = 0; x < L; x++) for (let y = 0; y <= B; y++) {
    const dx = Math.max(0, Math.abs(x - 14.5) - 11), dy = Math.max(0, Math.abs(y - 7.5) - 4.5);
    if (dx * dx + dy * dy > 9) continue;
    g.box(x, x, y, y, 0, 2, C.skirt);
    g.set(x, y, 3, C.hullDark);
  }
  g.box(4, 26, Y - 5, Y + 5, 3, 3, C.deck);                 // cargo deck
  g.box(4, 26, Y - 6, Y - 6, 3, 5, C.hull); g.box(4, 26, Y + 5, Y + 5, 3, 5, C.hull);
  for (let x = 6; x <= 24; x++) { g.set(x, Y - 6, 5, TEAM); g.set(x, Y + 5, 5, TEAM); }
  g.box(27, 28, Y - 4, Y + 3, 3, 5, C.hazard);              // bow ramp
  house(g, 18, 23, Y + 2, Y + 4, 6, 9);                     // cab on the starboard side
  for (const y of [Y - 4, Y + 3]) {                         // fans in rings
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; g.set(2, Math.round(y + Math.cos(t) * 3), Math.round(8 + Math.sin(t) * 3), C.steelDark); }
    g.box(2, 2, y, y, 5, 11, C.gunDark); g.box(2, 2, y - 3, y + 3, 8, 8, C.gunDark);
  }
  g.box(1, 3, Y - 1, Y, 4, 7, C.steelDark);
  writeVox('hover.vox', g);
}

// ---------- Missile Cruiser (Allies): boxy superstructure with radar panels, big VLS fields ----------
{
  const g = grid(), Y = hull(g, 52, 13, 4);
  vls(g, 33, 38, Y - 3, Y + 3, 5);
  vls(g, 6, 11, Y - 3, Y + 3, 5);
  house(g, 15, 31, Y - 5, Y + 5, 5, 12);
  g.box(24, 31, Y - 4, Y + 4, 12, 15, C.hull);
  for (const y of [Y - 5, Y + 5]) g.box(25, 29, y, y, 12, 15, C.steelDark);   // flat radar arrays
  g.box(31, 31, Y - 2, Y + 2, 12, 15, C.steelDark);
  for (let y = Y - 3; y <= Y + 3; y++) g.set(31, y, 14, C.glassDark);
  mast(g, 22, Y, 13, 23);
  funnel(g, 17, 20, Y - 3, Y + 3, 12, 16);
  g.box(1, 5, Y - 5, Y + 5, 5, 5, C.deckLight);
  writeVox('cruiser_hull.vox', g);
  gunTurret('cruiser_turret.vox', 3, 7, 3);
}

// ---------- Battlecruiser (Axis): long armoured hull, tower bridge; two triple turrets drawn by the game ----------
{
  const g = grid(), Y = hull(g, 60, 15, 5, { bow: 0.3 });
  house(g, 22, 36, Y - 5, Y + 5, 6, 12);
  g.box(30, 36, Y - 3, Y + 3, 12, 18, C.hull);               // tower bridge
  for (let y = Y - 2; y <= Y + 2; y++) { g.set(36, y, 16, C.glassDark); g.set(36, y, 13, C.glassDark); }
  g.box(31, 35, Y - 4, Y + 4, 18, 18, C.hullDark);
  mast(g, 33, Y, 19, 28);
  funnel(g, 24, 28, Y - 3, Y + 3, 12, 17);
  for (const x of [23, 27, 31]) for (const s of [-1, 1]) g.box(x, x + 1, Y + s * 6, Y + s * 6, 6, 7, C.gunDark); // secondary mounts
  for (const x of [45, 13]) for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; g.set(Math.round(x + Math.cos(t) * 4.5), Math.round(Y + Math.sin(t) * 4.5), 6, C.hullDark); } // barbettes
  writeVox('battleship_hull.vox', g);
  gunTurret('battleship_turret.vox', 4, 11, 3, 3);
}

// ---------- Aircraft Carrier (UK): wide flight deck, ski-jump bow, two islands to starboard ----------
{
  const g = grid(), L = 72, B = 21, Y = Math.ceil(B / 2);
  hull(g, L, 15, 5, { bow: 0.25, stripe: false });
  // the flight deck overhangs the hull, wider to port at the angled section
  for (let x = 2; x < L; x++) {
    const f = x / (L - 1), half = (f > 0.82 ? 1 - (f - 0.82) / 0.18 * 0.55 : 1) * B / 2;
    for (let y = Math.round(Y - half); y <= Math.round(Y + half - 1); y++) g.set(x, y, 6, C.flightDeck);
  }
  for (let x = 64; x < L; x++) g.set(x, Y, 7 + Math.floor((x - 64) / 3), C.flightDeck);       // ski jump
  for (let x = 62; x < L; x++) for (let y = Y - 4; y <= Y + 4; y++) if (g.get(x, y, 6)) g.set(x, y, 7 + Math.floor((x - 64) / 3), C.flightDeck);
  for (let x = 6; x < 64; x += 4) g.set(x, Y - 2, 6, C.white);                               // centre line
  for (let x = 4; x < 64; x++) { g.set(x, Math.round(Y - B / 2) + 1, 6, C.hazard); }        // deck edge marking
  for (const [x0, x1] of [[40, 48], [22, 30]]) {                                            // twin islands
    house(g, x0, x1, B - 4, B - 1, 7, 14);
    g.box(x0, x1, B - 1, B - 1, 7, 7, TEAM);
  }
  g.box(44, 46, B - 3, B - 2, 15, 18, C.steelDark); g.set(45, B - 2, 19, C.light);
  funnel(g, 24, 27, B - 4, B - 2, 14, 17);
  for (const [x, y] of [[54, Y - 4], [34, Y - 5], [14, Y - 3]]) {                           // parked F-35Bs
    g.box(x - 2, x + 2, y, y, 7, 7, C.jetGrey);
    g.box(x - 1, x, y - 2, y + 2, 7, 7, C.jetGrey);
    g.set(x + 2, y, 8, C.glassDark);
  }
  writeVox('carrier.vox', g);
}

// ---------- Aegis BMD Destroyer (Japan): octagonal SPY radar faces on a tall block ----------
{
  const g = grid(), Y = hull(g, 46, 11, 4);
  vls(g, 28, 32, Y - 2, Y + 2, 5);
  vls(g, 5, 8, Y - 3, Y + 3, 5);
  house(g, 13, 27, Y - 4, Y + 4, 5, 11);
  g.box(19, 27, Y - 4, Y + 4, 11, 15, C.hull);
  for (const y of [Y - 4, Y + 4]) for (let x = 21; x <= 25; x++) for (let z = 11; z <= 15; z++) if (Math.abs(x - 23) + Math.abs(z - 13) <= 3) g.set(x, y, z, C.steelDark); // SPY-1 faces
  for (let y = Y - 2; y <= Y + 2; y++) for (let z = 11; z <= 15; z++) if (Math.abs(y - Y) + Math.abs(z - 13) <= 3) g.set(27, y, z, C.steelDark);
  mast(g, 17, Y, 12, 22);
  funnel(g, 14, 16, Y - 2, Y + 2, 11, 14);
  for (let x = 13; x <= 27; x++) g.set(x, Y + 4, 6, TEAM);
  writeVox('maya_hull.vox', g);
  gunTurret('maya_turret.vox', 3, 7, 3);
}

// ---------- Naval Shipyard (3x3 tiles, 48x48 voxels at 2 px each): a floating dock ----------
// Two concrete piers either side of an open slip, a gantry crane across it and a control block.
{
  const g = grid(), W = 48;
  const pier = (y0, y1) => {
    g.box(1, 46, y0, y1, 0, 2, C.steel);
    g.box(1, 46, y0, y1, 3, 3, C.white);
    for (let x = 2; x <= 45; x += 6) g.set(x, y1, 3, C.hazard);
    for (let x = 4; x <= 44; x += 8) g.box(x, x, y0, y0, 0, 1, C.steelDark);      // fenders
  };
  pier(1, 12); pier(35, 46);
  g.box(1, 4, 13, 34, 0, 2, C.steel); g.box(1, 4, 13, 34, 3, 3, C.white);          // the dock head joins them
  g.box(5, 5, 14, 33, 1, 2, C.hazard);                                             // dock gate
  // control block with a team roof on the near pier
  g.box(30, 44, 37, 45, 4, 12, C.jetGrey);
  g.box(30, 44, 37, 45, 12, 12, TEAM);
  for (let x = 31; x <= 43; x += 3) { g.set(x, 45, 9, C.glass); g.set(x + 1, 45, 9, C.glass); }
  for (let y = 38; y <= 44; y += 3) { g.set(44, y, 9, C.glass); g.set(44, y + 1, 9, C.glass); }
  // gantry crane spanning the slip on two legs
  for (const y of [8, 39]) { g.box(16, 17, y, y + 1, 4, 22, C.hazard); g.box(26, 27, y, y + 1, 4, 22, C.hazard); }
  g.box(16, 27, 8, 40, 22, 24, C.hazard);
  g.box(19, 24, 20, 25, 18, 21, C.steelDark);                                      // trolley
  g.box(21, 22, 22, 23, 10, 17, C.black);                                          // hook cable
  g.box(16, 27, 8, 40, 25, 25, TEAM_DARK);
  // stacked containers and a small jib crane on the far pier
  for (const [x, c] of [[8, C.red], [12, C.glassDark], [8, C.olive]]) g.box(x, x + 3, 3, 9, c === C.olive ? 7 : 4, c === C.olive ? 6 + 3 : 6, c);
  g.box(38, 39, 4, 5, 4, 14, C.steelDark); g.box(30, 40, 4, 5, 14, 15, C.steelDark);
  // bollards and lights along the slip edges
  for (let x = 8; x <= 44; x += 9) { g.set(x, 12, 4, C.black); g.set(x, 35, 4, C.black); }
  g.set(46, 12, 4, C.light); g.set(46, 35, 4, C.light);
  writeVox('b_shipyard.vox', g);
}
