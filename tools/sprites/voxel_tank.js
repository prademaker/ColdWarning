// Builds the sample RA2-style voxel tank and writes it as MagicaVoxel .vox files
// (assets/voxels/tank_hull.vox and tank_turret.vox), which can be edited in MagicaVoxel.
//
//   node voxel_tank.js
//
// Palette and helpers are shared with the other units (voxel_lib.js).
'use strict';

const { C, TEAM, TEAM_LIGHT, TEAM_DARK, camoAt, grid, writeVox } = require('./voxel_lib');

// ---- hull: 32 long (x), 20 wide (y), x forward ----
const hull = grid();
for (const [y0, y1] of [[0, 4], [15, 19]]) {
  hull.box(2, 29, y0, y1, 0, 4, C.track);
  hull.box(1, 30, y0, y1, 1, 3, C.track);           // rounded track ends
  for (let x = 2; x <= 29; x += 2) for (const y of [y0, y1]) hull.set(x, y, 4, C.link);
  for (const x of [5, 10, 15, 20, 25]) for (const y of [y0, y1]) { hull.set(x, y, 1, C.wheel); hull.set(x, y, 2, C.hub); hull.set(x + 1, y, 1, C.wheel); hull.set(x + 1, y, 2, C.wheel); }
  for (let x = 1; x <= 30; x++) for (let y = y0; y <= y1; y++) hull.set(x, y, 5, camoAt(x, y, 5));   // fenders
  for (let x = 1; x <= 30; x++) hull.set(x, y0 === 0 ? 0 : 19, 5, TEAM_DARK);                         // team-coloured fender edge
  for (let x = 4; x <= 27; x++) for (let z = 3; z <= 4; z++) hull.set(x, y0 === 0 ? 0 : 19, z, C.steelDark); // side skirts
}
for (let x = 3; x <= 28; x++) for (let y = 5; y <= 14; y++) for (let z = 2; z <= 7; z++) hull.set(x, y, z, camoAt(x, y, z)); // hull body
for (let x = 24; x <= 28; x++) for (let z = 8 - (x - 23); z <= 7; z++) hull.box(x, x, 5, 14, z, z, 0); // sloped glacis
for (const k of [...hull.v.keys()]) if (hull.v.get(k)[3] === 0) hull.v.delete(k);
for (let x = 3; x <= 23; x++) for (let y = 5; y <= 14; y++) hull.set(x, y, 7, camoAt(x, y, 7)); // top plates
hull.box(4, 9, 6, 13, 7, 7, C.grille);               // engine deck
for (let x = 4; x <= 9; x += 2) hull.box(x, x, 6, 13, 7, 7, C.steelDark);
hull.box(3, 3, 5, 14, 3, 6, C.steelDark);            // rear plate
hull.box(3, 3, 7, 12, 4, 5, TEAM);                    // team-coloured rear marking
hull.box(20, 22, 6, 8, 8, 8, C.steelDark); hull.set(21, 7, 9, C.gun); // driver's hatch & periscope
for (let x = 2; x <= 2; x++) for (let z = 8; z <= 15; z++) hull.set(5, 6, z, C.steelDark); // whip antenna
hull.set(28, 6, 4, C.light); hull.set(28, 13, 4, C.light);
hull.box(10, 12, 3, 4, 5, 6, C.olive); hull.box(10, 12, 15, 16, 5, 6, C.olive); // stowage boxes

// ---- turret: pivot at (0,0); stored with an offset, see TURRET_PIVOT ----
const tur = grid();
const T0 = 8; // offset so coordinates stay positive
for (let x = -7; x <= 6; x++) for (let y = -6; y <= 6; y++) {
  const cut = (x <= -6 || x >= 5) && Math.abs(y) >= 5;  // chamfered corners
  if (cut) continue;
  for (let z = 0; z <= 3; z++) tur.set(x + T0, y + T0, z, camoAt(x + 14, y + 10, z + 8, 0));
  tur.set(x + T0, y + T0, 4, camoAt(x + 14, y + 10, 12, 0));
}
// team-coloured band around the turret sides
for (const [k, v] of tur.v) { const [x, y, z] = v; if (z === 2 && (x === T0 - 7 || Math.abs(y - T0) === 6 || ((x >= T0 + 5) && Math.abs(y - T0) === 4) || (x <= T0 - 6 && Math.abs(y - T0) === 4))) v[3] = TEAM; }
tur.box(5 + T0, 7 + T0, -3 + T0, 3 + T0, 0, 3, C.steelDark);        // mantlet
for (let x = 8; x <= 22; x++) tur.box(x + T0, x + T0, -1 + T0, 0 + T0, 1, 2, C.gun); // barrel
tur.box(13 + T0, 15 + T0, -2 + T0, 1 + T0, 1, 2, C.gunDark);        // fume extractor
tur.box(22 + T0, 24 + T0, -2 + T0, 1 + T0, 0, 3, C.gunDark);        // muzzle brake
tur.box(-4 + T0, -2 + T0, 2 + T0, 4 + T0, 5, 5, C.steel);           // commander hatch
tur.set(-3 + T0, 3 + T0, 6, C.steelDark);
tur.box(-5 + T0, -3 + T0, -4 + T0, -2 + T0, 5, 5, C.steelDark);     // gunner sight
tur.set(-4 + T0, -3 + T0, 6, C.glass);
tur.box(-9 + T0, -8 + T0, -4 + T0, 4 + T0, 1, 3, C.olive);          // bustle rack

writeVox('tank_hull.vox', hull);
writeVox('tank_turret.vox', tur);
