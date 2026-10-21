// Builds the voxel models for structures and writes them to assets/voxels/ (b_<key>.vox, plus
// b_<key>_gun.vox for the rotating weapons of defences).
//
//   node voxel_buildings.js
//
// One voxel is 2 game pixels, so a 3x3-tile structure is 48x48 voxels. Axes: x along the
// map's x, y along its y, z up; the footprint starts at (0, 0). Lights, flags, the radar dish
// and other animated details are drawn live by the game at fixed spots (BLD_LIVE in art.js),
// so features here sit where those expect them.
'use strict';
const { C, TEAM, TEAM_LIGHT, TEAM_DARK, grid, writeVox, camoAt } = require('./voxel_lib');

// structure materials (appended to the shared palette's named colours)
const M = {
  concrete: C.white, concreteDark: C.steel, wall: C.jetGrey, wallDark: C.jetDark, roof: C.wheel,
  window: C.light, windowBlue: C.glass, asphalt: C.track, mark: C.white, dark: C.grille,
};

function foundation(g, W, H) {
  g.box(0, W - 1, 0, H - 1, 0, 0, M.concreteDark);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if ((x + y) % 8 === 0 && x % 4 === 0) g.set(x, y, 0, M.concrete);
}
// a walled block with a roof of the given colour; returns nothing, mutates g
function block(g, x0, x1, y0, y1, z0, z1, wall = M.wall, roof = TEAM) {
  g.box(x0, x1, y0, y1, z0, z1, wall);
  g.box(x0, x1, y0, y1, z1, z1, roof);
  for (let x = x0; x <= x1; x += 4) for (let z = z0; z < z1; z++) { g.set(x, y1, z, M.wallDark); }   // panel seams on the front faces
  for (let y = y0; y <= y1; y += 4) for (let z = z0; z < z1; z++) { g.set(x1, y, z, M.wallDark); }
}
// lit windows along the visible faces (y = y1 face and x = x1 face)
function windowsY(g, x0, x1, y, z, step = 3, c = M.window) { for (let x = x0; x <= x1; x += step) { g.set(x, y, z, c); g.set(x + 1, y, z, c); } }
function windowsX(g, y0, y1, x, z, step = 3, c = M.window) { for (let y = y0; y <= y1; y += step) { g.set(x, y, z, c); g.set(x, y + 1, z, c); } }
function cylinder(g, cx, cy, r, z0, z1, c, rTop = r) {
  for (let z = z0; z <= z1; z++) {
    const rr = r + (rTop - r) * (z1 === z0 ? 0 : (z - z0) / (z1 - z0));
    for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
  }
}
function dome(g, cx, cy, cz, r, c) {
  for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let z = cz; z <= cz + r; z++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  }
}
function hazardStripe(g, x0, x1, y, z) { for (let x = x0; x <= x1; x++) g.set(x, y, z, (x >> 1) % 2 ? C.hazard : M.dark); }
function hazardStripeX(g, y0, y1, x, z) { for (let y = y0; y <= y1; y++) g.set(x, y, z, (y >> 1) % 2 ? C.hazard : M.dark); }

// ---------- Command Center (3x3) ----------
{
  const g = grid(); foundation(g, 48, 48);
  block(g, 3, 44, 16, 44, 1, 12);
  windowsY(g, 5, 14, 44, 7); windowsY(g, 33, 42, 44, 7); windowsX(g, 19, 41, 44, 7);
  g.box(19, 28, 44, 44, 1, 8, M.dark); hazardStripe(g, 19, 28, 44, 9);
  cylinder(g, 14, 29, 6.4, 12, 12, M.dark); cylinder(g, 14, 29, 5, 12, 12, M.dark);
  for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; g.set(Math.round(14 + Math.cos(t) * 5), Math.round(29 + Math.sin(t) * 5), 12, M.mark); }
  block(g, 29, 43, 3, 19, 1, 25, M.wall, M.roof);
  for (const z of [11, 12, 18, 19, 20]) { windowsY(g, 30, 42, 19, z, 2, M.windowBlue); windowsX(g, 4, 18, 43, z, 2, M.windowBlue); }
  dome(g, 39, 8, 26, 2.6, M.concrete);
  g.box(32, 32, 5, 5, 26, 36, M.concrete);
  g.box(30, 42, 4, 18, 25, 25, TEAM_DARK);                                   // team trim on the tower roof
  writeVox('b_cc.vox', g);
}

// ---------- Power Plant (2x2) ----------
{
  const g = grid(); foundation(g, 32, 32);
  block(g, 2, 29, 17, 29, 1, 5, M.wall, M.roof);
  windowsY(g, 4, 27, 29, 3);
  dome(g, 12, 11, 1, 7.6, (x, y, z) => z >= 4 && z <= 5 ? TEAM : M.concrete);
  cylinder(g, 12, 11, 7.5, 1, 3, M.concrete);
  cylinder(g, 12, 11, 2, 9, 9, C.rail);
  cylinder(g, 25, 7, 2.6, 1, 23, (x, y, z) => Math.floor((z - 1) / 4.5) % 2 ? M.concrete : TEAM);
  g.box(17, 21, 9, 11, 2, 3, M.wallDark);                                    // pipework
  writeVox('b_power.vox', g);
}

// ---------- Ore Refinery (3x3) ----------
{
  const g = grid(); foundation(g, 48, 48);
  block(g, 2, 29, 3, 30, 1, 11);
  windowsY(g, 4, 27, 30, 7); windowsX(g, 5, 28, 29, 7);
  for (const cy of [12, 29]) {
    cylinder(g, 39, cy, 5.6, 1, 14, (x, y, z) => z >= 10 && z <= 11 ? TEAM : C.hub);
    cylinder(g, 39, cy, 4, 15, 15, C.ore);
  }
  g.box(29, 34, 15, 17, 7, 8, M.wallDark);                                   // conveyor
  g.box(16, 31, 33, 46, 0, 0, M.asphalt); hazardStripe(g, 16, 31, 33, 1);
  writeVox('b_refinery.vox', g);
}

// ---------- Barracks (2x2) ----------
{
  const g = grid(); foundation(g, 32, 32);
  g.box(2, 29, 6, 27, 1, 7, M.wall);
  for (let z = 8; z <= 13; z++) { const inset = (z - 8) * 2; g.box(2, 29, 6 + inset, 27 - inset, z, z, TEAM); } // pitched roof
  for (let y = 6; y <= 27; y++) for (let z = 8; z <= 13; z++) if (g.get(2, y, z)) { g.set(2, y, z, M.wall); g.set(29, y, z, M.wall); } // gable ends
  g.box(13, 18, 27, 27, 1, 5, M.dark);
  windowsY(g, 4, 10, 27, 4); windowsY(g, 21, 27, 27, 4); windowsX(g, 8, 25, 29, 4);
  for (let x = 3; x <= 10; x++) g.box(x, x, 29, 30, 0, 1, (x % 2) ? C.camoDark : C.camo); // sandbags
  for (let x = 21; x <= 28; x++) g.box(x, x, 29, 30, 0, 1, (x % 2) ? C.camoDark : C.camo);
  writeVox('b_barracks.vox', g);
}

// ---------- War Factory (3x3) ----------
{
  const g = grid(); foundation(g, 48, 48);
  block(g, 2, 45, 5, 44, 1, 15);
  for (let x = 6; x <= 42; x += 8) g.box(x, x + 1, 7, 42, 16, 16, TEAM_DARK);  // roof ribs
  g.box(12, 35, 44, 44, 1, 12, M.dark); hazardStripe(g, 12, 35, 44, 13);
  windowsY(g, 3, 10, 44, 9); windowsY(g, 38, 44, 44, 9); windowsX(g, 8, 40, 45, 9);
  g.box(5, 6, 7, 8, 16, 21, C.hazard); g.box(5, 30, 7, 8, 21, 22, C.hazard);   // crane
  writeVox('b_factory.vox', g);
}

// ---------- Radar Station (2x2); the dish is drawn live ----------
{
  const g = grid(); foundation(g, 32, 32);
  block(g, 4, 27, 12, 28, 1, 9, M.wall, M.roof);
  g.box(4, 27, 28, 28, 6, 7, TEAM); windowsY(g, 6, 25, 28, 3, 3, M.windowBlue);
  g.box(14, 17, 14, 17, 10, 17, M.wallDark); g.box(13, 18, 13, 18, 9, 9, M.dark);
  writeVox('b_radar.vox', g);
}

// ---------- Airfield (3x2) ----------
{
  const g = grid();
  g.box(1, 46, 1, 30, 0, 0, M.asphalt);
  for (let x = 4; x <= 42; x += 6) g.box(x, x + 3, 15, 16, 0, 0, M.mark);      // centre line
  g.box(2, 45, 10, 10, 0, 0, TEAM); g.box(2, 45, 22, 22, 0, 0, TEAM);
  for (let y = 11; y <= 21; y += 3) g.box(2, 4, y, y + 1, 0, 0, M.mark);       // threshold
  block(g, 37, 45, 2, 9, 1, 11, M.wall, M.wall);
  g.box(36, 46, 1, 10, 12, 14, M.windowBlue); g.box(36, 46, 1, 10, 15, 15, TEAM); // glass control room
  // parked jet
  for (let x = 8; x <= 24; x++) { const h = x > 21 ? 0 : 1; g.box(x, x, 16 - h, 16 + h, 1, 2, C.jetGrey); }
  for (let x = 11; x <= 17; x++) { const s = Math.round((17 - x) * 0.9); g.box(x, x, 14 - s, 18 + s, 1, 1, C.jetGrey); }
  g.box(8, 9, 14, 14, 2, 4, TEAM); g.box(8, 9, 18, 18, 2, 4, TEAM); g.box(19, 21, 16, 16, 3, 3, C.glassDark);
  writeVox('b_airfield.vox', g);
}

// ---------- Tech Lab (2x2) ----------
{
  const g = grid(); foundation(g, 32, 32);
  block(g, 3, 28, 7, 28, 1, 11, M.concrete, M.concrete);
  for (const z of [5, 8]) { windowsY(g, 5, 26, 28, z, 3, M.windowBlue); windowsX(g, 9, 26, 28, z, 3, M.windowBlue); }
  cylinder(g, 16, 17, 6, 11, 12, M.wallDark);
  dome(g, 16, 17, 12, 5.5, TEAM);
  g.box(6, 6, 9, 9, 11, 18, M.concrete);
  writeVox('b_tech.vox', g);
}

// ---------- Orbital Lance (3x3) ----------
{
  const g = grid(); foundation(g, 48, 48);
  block(g, 3, 44, 7, 44, 1, 8, M.wall, M.roof);
  g.box(5, 42, 44, 44, 4, 6, TEAM);
  cylinder(g, 24, 25, 6.5, 8, 11, M.concrete, 15);                             // dish
  cylinder(g, 24, 25, 12, 11, 11, M.concreteDark);
  cylinder(g, 24, 25, 1.4, 11, 22, M.wallDark);                                // emitter
  cylinder(g, 24, 25, 2, 22, 24, C.rail);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const x = Math.round(24 + Math.cos(a) * 10), y = Math.round(25 + Math.sin(a) * 10); g.box(x, x, y, y, 11, 19, M.wallDark); }
  writeVox('b_super_lance.vox', g);
}

// ---------- Hypersonic Silo (3x3): closed while charging, open with the missile when ready ----------
for (const open of [false, true]) {
  const g = grid(); foundation(g, 48, 48);
  g.box(3, 44, 3, 44, 1, 5, C.olive); g.box(3, 44, 3, 44, 6, 6, M.wallDark);
  g.box(5, 42, 44, 44, 2, 4, TEAM);
  g.box(13, 34, 13, 34, 6, 6, M.dark);
  const o = open ? 7 : 0;
  g.box(13 - o, 23 - o, 13, 34, 7, 7, M.concreteDark); g.box(24 + o, 34 + o, 13, 34, 7, 7, M.concreteDark);
  hazardStripe(g, 13 - o, 23 - o, 23, 8); hazardStripe(g, 24 + o, 34 + o, 23, 8);
  if (open) { cylinder(g, 24, 24, 2.5, 6, 17, M.concrete); cylinder(g, 24, 24, 2.5, 18, 20, C.red, 0.5); }
  writeVox(open ? 'b_super_silo_open.vox' : 'b_super_silo.vox', g);
}

// ---------- Defences (1x1): static base + rotating gun ----------
{
  const g = grid();
  cylinder(g, 8, 8, 6.8, 0, 2, (x, y, z) => (x + y + z) % 3 ? C.camo : C.camoDark);          // sandbag ring
  cylinder(g, 8, 8, 4, 0, 3, M.wallDark);
  writeVox('b_turret.vox', g);
  const t = grid(), O = 4;
  t.box(O - 3, O + 2, O - 2, O + 2, 0, 2, TEAM); t.box(O - 2, O + 1, O - 2, O + 2, 3, 3, TEAM_LIGHT);
  for (const y of [O - 1, O, O + 1]) t.box(O + 3, O + 9, y, y, 1, 1, C.gunDark);
  writeVox('b_turret_gun.vox', t);
}
{
  const g = grid();
  block(g, 1, 14, 1, 14, 0, 4, M.wall, M.roof); hazardStripe(g, 1, 14, 14, 2); hazardStripeX(g, 1, 14, 14, 2);
  writeVox('b_railturret.vox', g);
  const t = grid(), O = 5;
  for (let x = -4; x <= 3; x++) for (let y = -3; y <= 3; y++) if (Math.abs(y) <= 3 - Math.max(0, x - 1)) t.box(x + O, x + O, y + O, y + O, 0, 2, TEAM);
  t.box(O + 2, O + 12, O - 1, O - 1, 1, 1, C.gun); t.box(O + 2, O + 12, O + 1, O + 1, 1, 1, C.gun);
  for (let x = O + 4; x <= O + 11; x += 3) t.box(x, x, O - 2, O + 2, 0, 2, C.rail);
  writeVox('b_railturret_gun.vox', t);
}
{
  const g = grid();
  g.box(1, 14, 2, 13, 0, 0, M.wallDark); hazardStripe(g, 1, 14, 13, 1);
  cylinder(g, 8, 8, 3, 1, 2, M.wall);
  writeVox('b_sam.vox', g);
  const t = grid(), O = 5;
  t.box(O - 4, O + 3, O - 4, O + 4, 0, 4, TEAM);
  for (const y of [O - 3, O + 2]) for (const z of [1, 3]) t.box(O + 4, O + 4, y, y + 1, z, z, M.dark);
  t.box(O - 4, O + 3, O - 5, O - 5, 1, 3, M.concrete); t.box(O - 4, O + 3, O + 5, O + 5, 1, 3, M.concrete);
  writeVox('b_sam_gun.vox', t);
}

// ---------- Laser Defense Tower (EU, 1x1): armoured pylon + rotating emitter ----------
{
  const g = grid();
  g.box(1, 14, 1, 14, 0, 1, M.wallDark);
  block(g, 3, 12, 3, 12, 2, 9, M.concrete, M.wallDark);
  hazardStripe(g, 3, 12, 12, 3);
  writeVox('b_laser.vox', g);
  const t = grid(), O = 5;
  cylinder(t, O, O, 3.5, 0, 3, TEAM);
  t.box(O + 1, O + 11, O, O, 2, 2, C.steelDark);
  for (let x = O + 3; x <= O + 9; x += 3) t.box(x, x, O - 1, O + 1, 1, 3, C.steel);
  t.box(O + 11, O + 12, O - 1, O + 1, 1, 3, C.red);                                             // focusing lens
  writeVox('b_laser_gun.vox', t);
}

// ---------- Support Hub (China, 2x2): field hospital with a crane and a helipad cross ----------
{
  const g = grid(); foundation(g, 32, 32);
  block(g, 3, 18, 4, 28, 1, 9, M.wall, TEAM);
  windowsY(g, 5, 16, 28, 5); windowsX(g, 6, 26, 18, 5);
  g.box(8, 13, 13, 18, 9, 9, M.concrete); g.box(10, 11, 11, 20, 9, 9, C.red); g.box(6, 15, 15, 16, 9, 9, C.red); // red cross on the roof
  g.box(20, 29, 4, 28, 1, 1, M.asphalt);                                                       // repair apron
  for (let y = 6; y <= 26; y += 4) g.set(25, y, 1, M.mark);
  g.box(27, 28, 5, 6, 2, 16, C.hazard); g.box(20, 28, 5, 6, 16, 16, C.hazard); g.box(21, 21, 5, 5, 11, 15, M.dark); // crane
  writeVox('b_hub.vox', g);
}

// ======== country edge structures added with the Axis and Allies ========

// ---------- THAAD Battery (USA, 2x2): radar truck + pad; the launcher turns to fire ----------
{
  const g = grid(); foundation(g, 32, 32);
  g.box(4, 27, 4, 27, 1, 1, M.asphalt); hazardStripe(g, 4, 27, 27, 2); hazardStripeX(g, 4, 27, 27, 2);
  block(g, 3, 13, 22, 29, 1, 7, M.wall, M.roof);                                             // radar shelter
  g.box(4, 12, 29, 29, 3, 6, C.glassDark);                                                     // AN/TPY-2 face
  g.box(13, 13, 23, 28, 2, 6, C.glassDark);
  writeVox('b_thaad.vox', g);
  const t = grid(), O = 7;
  t.box(O - 6, O + 5, O - 5, O + 5, 0, 1, C.steelDark);
  t.box(O - 5, O + 6, O - 4, O + 4, 2, 6, TEAM);
  for (let y = O - 3; y <= O + 3; y += 2) for (const z of [3, 5]) t.set(O + 6, y, z, C.white); // eight canisters
  t.box(O - 6, O - 6, O - 4, O + 4, 2, 6, C.steel);
  writeVox('b_thaad_gun.vox', t);
}

// ---------- Koksan Gun Emplacement (North Korea, 2x2): earth berm with a casemate ----------
{
  const g = grid();
  for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) {
    const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)), h = Math.round(Math.max(0, 6 - Math.max(0, d - 9) * 0.9));
    for (let z = 0; z <= h; z++) g.set(x, y, z, (x * 7 + y * 3 + z) % 5 ? C.olive : C.camoDark);
  }
  g.clear(8, 23, 8, 23, 4, 9);
  g.box(8, 23, 8, 23, 3, 3, M.concreteDark);
  block(g, 10, 21, 10, 21, 4, 6, M.wall, M.roof);
  writeVox('b_koksan.vox', g);
  const t = grid(), O = 6;
  t.box(O - 5, O + 4, O - 4, O + 4, 0, 4, TEAM);
  t.box(O - 4, O + 3, O - 3, O + 3, 5, 5, TEAM_LIGHT);
  t.box(O + 5, O + 22, O - 1, O + 1, 2, 3, C.gun); t.box(O + 20, O + 22, O - 1, O + 1, 1, 4, C.gunDark); // 170mm barrel + muzzle brake
  writeVox('b_koksan_gun.vox', t);
}

// ---------- GCHQ Listening Post (UK, 2x2): the "doughnut" ring building with an aerial mast ----------
{
  const g = grid(); foundation(g, 32, 32);
  cylinder(g, 15.5, 15.5, 13, 1, 8, (x, y, z) => {
    const r = Math.hypot(x - 15.5, y - 15.5);
    return z === 8 ? (r > 11 ? TEAM : M.roof) : z % 3 === 1 && r > 12 ? M.windowBlue : M.wall;
  });
  cylinder(g, 15.5, 15.5, 6, 1, 8, M.concreteDark);
  g.clear(11, 20, 11, 20, 2, 8);
  cylinder(g, 15.5, 15.5, 3, 1, 3, C.olive);                                                   // courtyard garden
  g.box(24, 24, 6, 6, 9, 20, C.steel); g.box(22, 26, 6, 6, 16, 16, C.steel); g.box(24, 24, 4, 8, 13, 13, C.steel); // mast
  writeVox('b_gchq.vox', g);
}

// ---------- Robotics Plant (Japan, 2x2): clean white hall with glazing and a robot arm ----------
{
  const g = grid(); foundation(g, 32, 32);
  block(g, 3, 28, 4, 27, 1, 11, M.concrete, TEAM);
  for (let x = 5; x <= 26; x++) for (let z = 3; z <= 8; z++) g.set(x, 27, z, M.windowBlue);    // glazed front
  windowsX(g, 6, 25, 28, 6, 3, M.windowBlue);
  g.box(20, 24, 8, 12, 12, 14, M.wallDark);                                                    // rooftop arm: base,
  g.box(22, 22, 10, 10, 15, 20, C.hazard); g.box(22, 27, 10, 10, 20, 20, C.hazard); g.box(27, 27, 9, 11, 18, 19, M.dark); // boom and gripper
  writeVox('b_robotics.vox', g);
}

// ---------- Krasukha EW Station (Russia, 2x2): shelter truck with a raised jamming dish ----------
{
  const g = grid(); foundation(g, 32, 32);
  for (const x of [4, 9, 15]) for (const y of [3, 14]) { g.box(x - 1, x + 1, y, y, 1, 3, C.rubber); }
  g.box(2, 19, 4, 13, 3, 4, C.steelDark);
  for (let x = 2; x <= 19; x++) for (let y = 4; y <= 13; y++) for (let z = 5; z <= 10; z++) g.set(x, y, z, camoAt(x, y, z, 97)); // shelter
  g.box(2, 19, 4, 4, 10, 10, TEAM); g.box(2, 19, 13, 13, 10, 10, TEAM);
  g.box(23, 23, 15, 15, 1, 9, C.steel);                                                         // dish mast
  for (let y = -6; y <= 6; y++) for (let z = -6; z <= 6; z++) if (y * y + z * z <= 36) g.set(22 - Math.round((y * y + z * z) / 14), 15 + y, 15 + z, y * y + z * z > 25 ? TEAM : M.concrete);
  writeVox('b_krasukha.vox', g);
}

// ---------- Propaganda Tower (Soviet Union, 1x1): concrete tower with loudspeakers and a banner ----------
{
  const g = grid();
  g.box(1, 14, 1, 14, 0, 1, M.wallDark);
  g.box(6, 10, 6, 10, 2, 22, M.concrete);
  g.box(10, 10, 7, 9, 6, 16, TEAM); g.box(7, 9, 10, 10, 6, 16, TEAM);                           // banners
  g.box(5, 11, 5, 11, 22, 23, M.wallDark);
  for (const [x, y] of [[12, 8], [8, 12], [4, 8]]) g.box(x - (x > 8 ? 1 : 0), x, y - (y > 8 ? 1 : 0), y, 20, 21, C.steel); // loudspeakers
  g.set(8, 8, 24, C.red); g.set(8, 8, 25, C.red);
  writeVox('b_propaganda.vox', g);
}

// ======== more structures and defences ========

// ---------- Concrete Wall (1x1): fills its tile so neighbouring sections join up ----------
{
  const g = grid();
  g.box(0, 15, 0, 15, 0, 5, M.concrete);
  for (let x = 0; x <= 15; x += 4) for (let z = 1; z <= 5; z++) { g.set(x, 15, z, M.concreteDark); g.set(15, x, z, M.concreteDark); } // slab joints
  g.box(1, 14, 1, 14, 6, 6, M.wall);
  g.box(6, 9, 6, 9, 6, 6, TEAM);
  writeVox('b_wall.vox', g);
}

// ---------- Mortar Pit (1x1): sandbag ring, the tube turns ----------
{
  const g = grid();
  cylinder(g, 8, 8, 7, 0, 3, (x, y, z) => (x * 3 + y + z) % 4 ? C.camo : C.camoDark);
  cylinder(g, 8, 8, 4.5, 1, 3, C.olive);
  g.clear(4, 12, 4, 12, 2, 3);
  for (const [x, y] of [[3, 12], [4, 12], [3, 11]]) g.box(x, x, y, y, 2, 3, C.hazard);          // ammo crates
  writeVox('b_mortar.vox', g);
  const t = grid(), O = 4;
  t.box(O - 2, O + 2, O - 2, O + 2, 0, 0, C.steelDark);                                         // baseplate
  for (let i = 0; i <= 6; i++) t.box(O + i - 1, O + i, O, O, 1 + i, 1 + i, i === 6 ? C.gunDark : C.gun); // tube at 45 degrees
  t.box(O + 2, O + 2, O - 2, O + 2, 1, 2, C.steel);                                             // bipod
  t.set(O - 2, O + 2, 1, TEAM); t.set(O - 2, O - 2, 1, TEAM);
  writeVox('b_mortar_gun.vox', t);
}

// ---------- Missile Nest (Allies, 1x1): low bunker, a four-tube launcher on a turntable ----------
{
  const g = grid();
  g.box(1, 14, 1, 14, 0, 0, M.wallDark); hazardStripe(g, 1, 14, 14, 1);
  g.box(3, 12, 3, 12, 1, 4, M.wall); g.box(3, 12, 3, 12, 5, 5, M.roof);
  writeVox('b_missilenest.vox', g);
  const t = grid(), O = 5;
  t.box(O - 3, O + 3, O - 3, O + 3, 0, 1, C.steelDark);
  t.box(O - 2, O + 4, O - 3, O + 3, 2, 6, TEAM);
  for (const y of [O - 2, O + 1]) for (const z of [3, 5]) t.box(O + 5, O + 5, y, y + 1, z, z, M.dark); // tube mouths
  t.box(O - 3, O - 3, O - 1, O + 1, 3, 5, C.glassDark);                                         // seeker
  writeVox('b_missilenest_gun.vox', t);
}

// ---------- Flame Tower (Axis, 1x1): squat armoured tower with fuel tanks, nozzle turret ----------
{
  const g = grid();
  g.box(0, 15, 0, 15, 0, 0, M.wallDark);
  g.box(3, 12, 3, 12, 1, 9, C.steelDark);
  for (let z = 2; z <= 8; z += 3) for (let x = 3; x <= 12; x++) { g.set(x, 12, z, C.steel); g.set(12, x, z, C.steel); } // rivet bands
  for (const [x, y] of [[1, 13], [13, 1]]) g.box(x, x + 1, y, y + 1, 1, 7, C.hazard);           // fuel tanks
  g.box(4, 11, 4, 11, 10, 10, M.dark);
  writeVox('b_flametower.vox', g);
  const t = grid(), O = 4;
  t.box(O - 3, O + 2, O - 3, O + 3, 0, 3, TEAM); t.box(O - 2, O + 1, O - 2, O + 2, 4, 4, TEAM_LIGHT);
  t.box(O + 3, O + 8, O, O, 1, 2, C.gunDark); t.box(O + 8, O + 9, O - 1, O + 1, 1, 2, C.steel); t.set(O + 10, O, 1, C.flame); // flame nozzle with pilot light
  writeVox('b_flametower_gun.vox', t);
}

// ---------- Sensor Tower (1x1): lattice mast with a radome on top ----------
{
  const g = grid();
  g.box(2, 13, 2, 13, 0, 0, M.concreteDark);
  for (let z = 1; z <= 20; z++) for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]]) g.set(x, y, z, C.steel); // legs
  for (let z = 3; z <= 19; z += 4) { for (let i = 5; i <= 10; i++) { g.set(i, 5, z, C.steelDark); g.set(i, 10, z, C.steelDark); g.set(5, i, z, C.steelDark); g.set(10, i, z, C.steelDark); } }
  g.box(4, 11, 4, 11, 21, 21, TEAM);
  dome(g, 7.5, 7.5, 22, 4, M.concrete);
  g.box(3, 4, 11, 12, 1, 3, M.wall);                                                          // equipment cabinet
  writeVox('b_sensor.vox', g);
}

// ---------- Ore Drill (2x2): derrick over a wellhead with a hopper and pipework ----------
{
  const g = grid(); foundation(g, 32, 32);
  block(g, 3, 13, 18, 29, 1, 8, M.wall, TEAM);                                                 // pump house
  windowsY(g, 4, 12, 29, 5);
  cylinder(g, 22, 22, 6, 1, 6, C.ore, 4);                                                      // ore hopper
  cylinder(g, 22, 22, 3, 6, 7, C.oreDark);
  for (let z = 1; z <= 26; z++) {                                                             // derrick
    const k = Math.round((z - 1) / 26 * 4);
    for (const [x, y] of [[4 + k, 4 + k], [16 - k, 4 + k], [4 + k, 16 - k], [16 - k, 16 - k]]) g.set(x, y, z, C.hazard);
    if (z % 5 === 0) for (let i = 4 + k; i <= 16 - k; i++) { g.set(i, 4 + k, z, M.dark); g.set(i, 16 - k, z, M.dark); g.set(4 + k, i, z, M.dark); g.set(16 - k, i, z, M.dark); }
  }
  g.box(8, 12, 8, 12, 27, 28, M.wallDark);
  g.box(9, 11, 9, 11, 1, 3, C.steelDark);                                                      // wellhead
  g.box(12, 18, 10, 11, 2, 2, C.steel); g.box(18, 19, 10, 18, 2, 2, C.steel);                  // pipe to the hopper
  writeVox('b_drill.vox', g);
}
