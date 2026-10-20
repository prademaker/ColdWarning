// Builds the voxel models for the rest of the roster (the tank lives in voxel_tank.js) and
// writes them as MagicaVoxel .vox files into assets/voxels/.
//
//   node voxel_units.js
//
// Axes: x forward, y to the right, z up. Each model's pivot is set in render.js.
'use strict';
const { C, TEAM, TEAM_LIGHT, TEAM_DARK, grid, writeVox } = require('./voxel_lib');

// ---------- shared parts ----------
function trackRun(g, x0, x1, y0, y1, h = 4) {
  g.box(x0 + 1, x1 - 1, y0, y1, 0, h, C.track);
  g.box(x0, x1, y0, y1, 1, h - 1, C.track);
  for (let x = x0 + 1; x <= x1 - 1; x += 2) { g.set(x, y0, h, C.link); g.set(x, y1, h, C.link); }
  for (let x = x0 + 3; x <= x1 - 3; x += 5) for (const y of [y0, y1]) { g.set(x, y, 1, C.wheel); g.set(x, y, 2, C.hub); g.set(x + 1, y, 1, C.wheel); g.set(x + 1, y, 2, C.wheel); }
}
function wheel(g, x, y0, y1, r = 2) {
  g.box(x - r, x + r, y0, y1, 0, r * 2, C.rubber);
  g.del(x - r, y0, 0); g.del(x + r, y0, 0); g.del(x - r, y1, 0); g.del(x + r, y1, 0);
  g.del(x - r, y0, r * 2); g.del(x + r, y0, r * 2); g.del(x - r, y1, r * 2); g.del(x + r, y1, r * 2);
  const outer = y0 === 0 ? y0 : y1;
  g.set(x, outer, r, C.hub);
}
function slopeFront(g, xFrom, xTo, y0, y1, zTop) { // carve a glacis: top drops one voxel per step forward
  for (let x = xFrom; x <= xTo; x++) for (let z = zTop - (x - xFrom); z <= zTop; z++) for (let y = y0; y <= y1; y++) g.del(x, y, z + 1);
}

// ---------- IFV: 8-wheeled, small autocannon turret ----------
{
  const h = grid();
  for (const x of [4, 9, 16, 21]) { wheel(h, x, 0, 1); wheel(h, x, 14, 15); }
  h.camo(1, 25, 2, 13, 2, 8, 3);
  slopeFront(h, 21, 25, 2, 13, 8);
  h.box(0, 0, 4, 11, 3, 6, C.steelDark);                       // rear ramp
  for (let x = 2; x <= 24; x++) { h.set(x, 2, 6, TEAM_DARK); h.set(x, 13, 6, TEAM_DARK); } // team stripe
  h.set(25, 4, 4, C.light); h.set(25, 11, 4, C.light);
  h.box(18, 20, 9, 11, 9, 9, C.steelDark);                      // driver hatch
  h.box(3, 6, 4, 11, 9, 9, C.grille);
  h.box(2, 2, 3, 3, 9, 16, C.steelDark);                        // antenna
  writeVox('ifv_hull.vox', h);
  const t = grid(), O = 6;
  t.camo(O - 4, O + 3, O - 4, O + 4, 0, 3, 5);
  t.band(2, TEAM);
  t.box(O + 4, O + 15, O, O, 1, 2, C.gun);                      // 30mm autocannon
  t.box(O + 14, O + 15, O - 1, O + 1, 1, 2, C.gunDark);
  t.box(O - 3, O + 2, O + 5, O + 6, 1, 3, C.olive);             // missile pod
  t.box(O + 3, O + 3, O + 5, O + 6, 2, 2, C.gunDark);
  t.box(O - 2, O, O - 2, O, 4, 4, C.steelDark);                 // sight
  t.set(O - 1, O - 1, 5, C.glass);
  writeVox('ifv_turret.vox', t);
}

// ---------- MLRS: 6x6 truck with a rotating rocket pod ----------
{
  const h = grid();
  for (const x of [4, 9, 22]) { wheel(h, x, 0, 1); wheel(h, x, 12, 13); }
  h.box(1, 27, 2, 11, 2, 3, C.steelDark);                        // chassis
  h.camo(20, 27, 1, 12, 4, 10, 7);                               // cab
  slopeFront(h, 25, 27, 1, 12, 10);
  h.box(27, 27, 3, 10, 6, 8, C.glassDark);                       // windscreen
  h.box(24, 26, 3, 10, 9, 9, C.glassDark);
  h.camo(1, 19, 1, 12, 4, 5, 2);                                 // flatbed
  for (let x = 20; x <= 27; x++) { h.set(x, 1, 7, TEAM_DARK); h.set(x, 12, 7, TEAM_DARK); }
  h.set(27, 2, 5, C.light); h.set(27, 11, 5, C.light);
  writeVox('mlrs_hull.vox', h);
  const t = grid(), O = 9;
  t.camo(O - 8, O + 7, O - 5, O + 5, 0, 6, 11);                  // launcher box
  for (let y = O - 4; y <= O + 4; y += 2) for (let z = 1; z <= 5; z += 2) t.set(O + 7, y, z, C.gunDark); // tube mouths
  t.band(3, TEAM);
  t.box(O - 8, O - 7, O - 5, O + 5, 0, 1, C.steelDark);          // elevation mount
  writeVox('mlrs_turret.vox', t);
}

// ---------- Railgun Tank: low, sleek hull with glowing coils ----------
{
  const h = grid();
  trackRun(h, 1, 30, 0, 4); trackRun(h, 1, 30, 15, 19);
  h.camo(2, 29, 3, 16, 2, 6, 13);
  slopeFront(h, 24, 29, 3, 16, 6);
  for (let x = 2; x <= 29; x++) { h.set(x, 3, 6, TEAM_DARK); h.set(x, 16, 6, TEAM_DARK); }
  for (let x = 4; x <= 12; x += 2) { h.set(x, 5, 7, C.rail); h.set(x, 14, 7, C.rail); } // coolant vents
  h.box(3, 9, 7, 12, 7, 7, C.grille);
  h.set(29, 5, 3, C.light); h.set(29, 14, 3, C.light);
  writeVox('railtank_hull.vox', h);
  const t = grid(), O = 8;
  for (let x = -7; x <= 5; x++) for (let y = -6; y <= 6; y++) {
    if (Math.abs(y) > 6 - Math.max(0, x - 1)) continue;          // wedge nose
    for (let z = 0; z <= 3; z++) t.set(x + O, y + O, z, C.camo);
  }
  t.camo(O - 7, O + 5, O - 6, O + 6, 0, 3, 17); for (const [k, e] of [...t.v]) { const y = e[1] - O, x = e[0] - O; if (Math.abs(y) > 6 - Math.max(0, x - 1)) t.v.delete(k); }
  t.band(1, TEAM);
  for (const y of [O - 2, O + 1]) t.box(O + 4, O + 26, y, y + 1, 1, 2, C.gun);   // twin rails
  for (let x = O + 8; x <= O + 24; x += 4) t.box(x, x, O - 3, O + 3, 0, 3, C.rail); // magnetic coils
  t.box(O - 5, O - 3, O - 2, O + 2, 4, 4, C.steelDark);
  writeVox('railtank_turret.vox', t);
}

// ---------- Titan Tank: heavy twin-gun tank on double tracks ----------
{
  const h = grid();
  trackRun(h, 1, 37, 0, 6, 5); trackRun(h, 1, 37, 21, 27, 5);
  h.camo(2, 36, 5, 22, 2, 9, 19);
  slopeFront(h, 30, 36, 5, 22, 9);
  for (let x = 1; x <= 37; x++) { h.set(x, 0, 6, TEAM_DARK); h.set(x, 27, 6, TEAM_DARK); h.set(x, 0, 5, C.steelDark); h.set(x, 27, 5, C.steelDark); }
  for (let x = 1; x <= 37; x++) for (const y of [1, 2, 3, 4, 5, 6, 21, 22, 23, 24, 25, 26]) h.set(x, y, 6, (x + y) % 9 === 0 ? C.camoDark : C.camo);
  h.box(3, 10, 8, 19, 10, 10, C.grille);
  h.box(2, 2, 9, 18, 4, 7, TEAM);
  h.set(36, 7, 4, C.light); h.set(36, 20, 4, C.light);
  writeVox('titan_hull.vox', h);
  const t = grid(), O = 10;
  for (let x = -9; x <= 8; x++) for (let y = -8; y <= 8; y++) {
    if ((x <= -8 || x >= 7) && Math.abs(y) >= 7) continue;
    for (let z = 0; z <= 5; z++) t.set(x + O, y + O, z, C.camo);
  }
  t.camo(O - 9, O + 8, O - 8, O + 8, 0, 5, 23); for (const [k, e] of [...t.v]) { const x = e[0] - O, y = e[1] - O; if ((x <= -8 || x >= 7) && Math.abs(y) >= 7) t.v.delete(k); }
  t.band(3, TEAM);
  for (const y of [O - 4, O + 3]) { t.box(O + 9, O + 28, y, y + 1, 2, 3, C.gun); t.box(O + 27, O + 29, y - 1, y + 2, 1, 4, C.gunDark); }
  t.box(O + 8, O + 10, O - 6, O + 6, 0, 5, C.steelDark);          // mantlet
  for (const y of [O - 11, O + 9]) { t.box(O - 7, O + 2, y, y + 2, 1, 5, C.olive); for (let x = O - 6; x <= O + 1; x += 2) t.set(O + 2, y + 1, 3, C.gunDark); }
  t.box(O - 5, O - 2, O + 2, O + 5, 6, 6, C.steelDark); t.set(O - 4, O + 3, 7, C.steelDark);
  writeVox('titan_turret.vox', t);
}

// ---------- Harvester: tracked ore collector; a loaded variant shows the ore ----------
for (const full of [false, true]) {
  const h = grid();
  trackRun(h, 1, 31, 0, 4); trackRun(h, 1, 31, 17, 21);
  h.camo(2, 22, 5, 16, 2, 11, 29);                                 // ore hopper
  h.clear(4, 20, 7, 14, 6, 11);                                    // open top
  if (full) { for (let x = 4; x <= 20; x++) for (let y = 7; y <= 14; y++) { const top = 9 + Math.round(Math.sin(x * 0.7) + Math.cos(y * 0.9)); for (let z = 6; z <= top; z++) h.set(x, y, z, (x * 7 + y * 3 + z) % 5 === 0 ? C.oreDark : C.ore); } }
  for (let x = 2; x <= 22; x++) { h.set(x, 5, 11, TEAM); h.set(x, 16, 11, TEAM); }
  h.camo(23, 31, 5, 16, 2, 9, 31);                                 // cab
  h.box(31, 31, 7, 14, 5, 8, C.glassDark);
  h.box(32, 34, 2, 19, 0, 3, C.steel);                             // collector drum
  for (let y = 3; y <= 18; y += 2) h.set(34, y, 1, C.hazard);
  h.box(26, 28, 8, 13, 10, 10, C.steelDark);
  h.set(31, 6, 4, C.light); h.set(31, 15, 4, C.light);
  writeVox(full ? 'harvester_full.vox' : 'harvester.vox', h);
}

// ---------- MCV: tracked carrier with a folded construction module ----------
{
  const h = grid();
  trackRun(h, 1, 35, 0, 4); trackRun(h, 1, 35, 17, 21);
  h.camo(2, 34, 5, 16, 2, 7, 37);
  h.box(3, 24, 4, 17, 8, 17, C.steel);                              // folded module
  for (let x = 3; x <= 24; x += 3) h.box(x, x, 4, 17, 8, 17, C.steelDark);
  h.box(3, 24, 4, 17, 18, 18, TEAM);                                // team roof
  h.box(5, 22, 6, 15, 19, 19, C.steelDark);
  h.box(20, 21, 9, 12, 20, 25, C.hazard); h.box(10, 21, 10, 11, 25, 25, C.hazard); // crane
  h.camo(27, 34, 5, 16, 8, 13, 41);                                 // cab
  h.box(34, 34, 7, 14, 10, 12, C.glassDark);
  h.set(34, 6, 4, C.light); h.set(34, 15, 4, C.light);
  writeVox('mcv.vox', h);
}

// ---------- Attack helicopter (rotor is drawn live by the game) ----------
{
  const h = grid(), Y = 9;
  for (let x = 10; x <= 28; x++) {                                  // fuselage, tapered
    const w = x > 24 ? 1 : 2, top = x > 25 ? 5 : x > 21 ? 6 : 7;
    for (let y = Y - w; y <= Y + w; y++) for (let z = 1; z <= top; z++) h.set(x, y, z, 0);
  }
  for (const e of h.v.values()) e[3] = C.camo;
  h.camo(10, 28, Y - 2, Y + 2, 1, 7, 43); for (const [k, e] of [...h.v]) { const w = e[0] > 24 ? 1 : 2, top = e[0] > 25 ? 5 : e[0] > 21 ? 6 : 7; if (Math.abs(e[1] - Y) > w || e[2] > top) h.v.delete(k); }
  h.box(19, 24, Y - 1, Y + 1, 7, 8, C.glassDark); h.box(15, 18, Y - 1, Y + 1, 8, 9, C.glassDark); // tandem canopy
  h.camo(0, 9, Y, Y, 4, 5, 47);                                      // tail boom
  h.box(0, 2, Y, Y, 6, 11, TEAM);                                    // tail fin
  h.box(2, 3, Y - 4, Y + 4, 5, 5, C.camoDark);                       // stabiliser
  h.box(1, 1, Y + 1, Y + 1, 8, 10, C.steelDark);                     // tail rotor
  h.box(14, 17, Y - 7, Y + 7, 3, 3, C.camoDark);                     // stub wings
  for (const y of [Y - 7, Y - 6, Y + 6, Y + 7]) h.box(12, 18, y, y, 1, 2, C.olive); // rocket pods
  h.box(27, 29, Y, Y, 0, 1, C.gunDark);                              // chin gun
  for (let x = 11; x <= 24; x++) { h.set(x, Y - 2, 4, TEAM_DARK); h.set(x, Y + 2, 4, TEAM_DARK); }
  h.box(17, 18, Y, Y, 8, 11, C.steelDark);                           // rotor mast
  h.box(13, 13, Y - 2, Y - 2, 0, 0, C.steelDark); h.box(13, 13, Y + 2, Y + 2, 0, 0, C.steelDark); // skids
  writeVox('heli.vox', h);
}

// ---------- Fighter jet: grey with team-coloured fins and wingtips ----------
{
  const h = grid(), Y = 12;
  for (let x = 0; x <= 31; x++) {
    const half = x > 26 ? 0 : x > 20 ? 1 : 2;
    for (let y = Y - half; y <= Y + half; y++) for (let z = 0; z <= (x > 28 ? 1 : 3); z++) h.set(x, y, z, C.jetGrey);
  }
  for (let x = 6; x <= 19; x++) { const span = Math.round((19 - x) * 0.85); for (let y = Y - 2 - span; y <= Y + 2 + span; y++) h.set(x, y, 1, C.jetGrey); }
  for (let x = 0; x <= 5; x++) { const span = 2 + Math.round((5 - x) * 0.8); for (let y = Y - 2 - span; y <= Y + 2 + span; y++) h.set(x, y, 1, C.jetDark); }
  for (const y of [Y - 3, Y + 3]) h.box(1, 5, y, y, 2, 7, TEAM);    // twin fins
  h.box(20, 25, Y - 1, Y + 1, 4, 4, C.glassDark); h.box(21, 24, Y, Y, 5, 5, C.glassDark); // canopy
  h.box(0, 0, Y - 1, Y + 1, 1, 2, C.gunDark);                         // exhausts
  for (const y of [Y - 13, Y + 13]) for (let x = 6; x <= 7; x++) h.set(x, y, 1, TEAM);    // wingtips
  writeVox('jet.vox', h);
}

// ---------- Infantry: three walk frames each ----------
function soldier(kind, frame) {
  const g = grid(), Y = 3;
  const [l, r] = [[0, 0], [1, -1], [-1, 1]][frame];
  for (const [dy, dx] of [[-1, l], [1, r]]) g.box(2 + dx, 3 + dx, Y + dy, Y + dy, 0, 5, kind === 'engineer' ? C.olive : C.camoDark); // legs
  for (const [dy, dx] of [[-1, l], [1, r]]) g.box(2 + dx, 4 + dx, Y + dy, Y + dy, 0, 0, C.rubber);                                    // boots
  g.camo(1, 4, Y - 2, Y + 2, 6, 10, frame * 3 + (kind === 'rocket' ? 5 : 0));                                                        // torso
  if (kind === 'engineer') g.box(1, 4, Y - 2, Y + 2, 7, 9, C.vest);
  g.box(0, 0, Y - 1, Y + 1, 6, 10, TEAM);                                       // backpack (team colour)
  g.box(2, 3, Y - 1, Y + 1, 11, 11, C.skin);                                    // face
  g.box(1, 4, Y - 1, Y + 1, 12, 13, kind === 'engineer' ? C.vest : C.camoDark); // helmet
  g.set(4, Y, 12, kind === 'engineer' ? C.vest : C.camoDark);
  if (kind === 'rifle') { g.box(4, 10, Y + 2, Y + 2, 8, 8, C.gunDark); g.set(5, Y + 2, 7, C.gunDark); }
  if (kind === 'rocket') { g.box(-0, 9, Y + 2, Y + 3, 11, 12, C.olive); g.set(9, Y + 2, 11, C.gunDark); g.set(9, Y + 3, 12, C.gunDark); }
  if (kind === 'engineer') { g.box(4, 6, Y + 2, Y + 3, 4, 6, C.red); g.set(5, Y + 2, 7, C.steelDark); }
  if (kind === 'sniper') { g.box(3, 13, Y + 2, Y + 2, 9, 9, C.gunDark); g.box(5, 7, Y + 2, Y + 2, 10, 10, C.steelDark); g.set(6, Y + 2, 8, C.gunDark); } // long rifle + scope
  if (kind === 'shock') {
    for (const y of [Y - 2, Y + 2]) { g.box(0, 0, y, y, 5, 11, C.hazard); g.set(0, y, 12, C.steelDark); }                            // fuel tanks either side of the pack
    g.box(4, 8, Y + 2, Y + 2, 7, 7, C.steelDark); g.set(9, Y + 2, 7, C.flame);                                                       // flame lance
  }
  if (kind === 'sas') {
    // black kit, gas mask, suppressed carbine, C4 pouches
    for (const [, e] of g.v) if (e[2] >= 6 && e[2] <= 10 && e[3] !== TEAM) e[3] = e[2] === 9 ? C.steelDark : C.rubber;
    g.box(1, 4, Y - 1, Y + 1, 12, 13, C.rubber); g.set(4, Y, 11, C.steelDark); g.set(4, Y, 12, C.glassDark);                          // balaclava + mask
    g.box(5, 5, Y - 2, Y - 1, 7, 8, C.hazard);                                                                                     // C4
    g.box(4, 11, Y + 2, Y + 2, 8, 8, C.gunDark); g.box(9, 11, Y + 2, Y + 2, 8, 8, C.rubber);                                       // suppressed carbine
  }
  if (kind === 'hacker') {
    // backpack uplink with a mast and dish, glowing tablet in hand
    g.box(0, 0, Y - 1, Y + 1, 6, 11, C.steelDark); g.box(0, 0, Y, Y, 12, 16, C.steel); g.box(0, 0, Y - 2, Y + 2, 17, 17, C.white);
    g.box(4, 5, Y + 1, Y + 2, 7, 8, C.rail);
  }
  if (kind === 'commando') {
    // campaign hero: dark fatigues, team-coloured beret instead of a helmet, suppressed rifle, C4 on the chest
    for (const [, e] of g.v) if (e[2] >= 6 && e[2] <= 10 && e[3] !== TEAM) e[3] = e[2] === 8 ? C.steel : C.steelDark;
    g.clear(1, 4, Y - 1, Y + 1, 12, 13);
    g.box(2, 3, Y - 1, Y + 1, 12, 12, C.rubber);                                                                                   // hair
    g.box(1, 4, Y - 2, Y + 1, 13, 13, TEAM); g.set(4, Y - 1, 12, TEAM);                                                            // beret
    g.box(5, 5, Y - 1, Y + 1, 7, 8, C.hazard);                                                                                     // C4 blocks
    g.box(4, 12, Y + 2, Y + 2, 8, 8, C.gunDark); g.box(10, 12, Y + 2, Y + 2, 8, 8, C.rubber); g.set(6, Y + 2, 9, C.steelDark);     // suppressed rifle + sight
  }
  return g;
}
for (const kind of ['rifle', 'rocket', 'engineer', 'sniper', 'shock', 'commando', 'sas', 'hacker']) for (let f = 0; f < 3; f++) writeVox(`${kind}_${f}.vox`, soldier(kind, f));

// ======== bloc and nation specials ========

// ---------- Flak Track (East): tracked hull, radar-topped turret with twin autocannons ----------
{
  const h = grid();
  trackRun(h, 1, 26, 0, 3); trackRun(h, 1, 26, 14, 17);
  h.camo(2, 25, 3, 14, 2, 7, 53);
  slopeFront(h, 21, 25, 3, 14, 7);
  for (let x = 2; x <= 25; x++) { h.set(x, 3, 7, TEAM_DARK); h.set(x, 14, 7, TEAM_DARK); }
  h.box(3, 7, 5, 12, 8, 8, C.grille);
  h.set(25, 5, 4, C.light); h.set(25, 12, 4, C.light);
  writeVox('flak_hull.vox', h);
  const t = grid(), O = 7;
  t.camo(O - 5, O + 4, O - 5, O + 5, 0, 4, 59);
  t.band(2, TEAM);
  for (const y of [O - 4, O + 4]) { t.box(O + 4, O + 15, y, y, 3, 3, C.gun); t.box(O + 14, O + 15, y, y, 2, 4, C.gunDark); } // twin cannons
  t.box(O - 4, O - 2, O - 1, O + 1, 5, 7, C.steelDark); t.box(O - 5, O - 1, O - 3, O + 3, 8, 8, C.steel);                          // radar mast + dish
  writeVox('flak_turret.vox', t);
}

// ---------- Thermobaric Launcher (East): heavy tracked chassis, slab of rocket tubes ----------
{
  const h = grid();
  trackRun(h, 1, 31, 0, 4); trackRun(h, 1, 31, 17, 21);
  h.camo(2, 30, 4, 17, 2, 7, 61);
  slopeFront(h, 26, 30, 4, 17, 7);
  for (let x = 2; x <= 30; x++) { h.set(x, 4, 7, TEAM_DARK); h.set(x, 17, 7, TEAM_DARK); }
  h.box(24, 28, 6, 15, 8, 9, C.camoDark);
  h.set(30, 6, 4, C.light); h.set(30, 15, 4, C.light);
  writeVox('tos_hull.vox', h);
  const t = grid(), O = 10;
  t.camo(O - 10, O + 8, O - 6, O + 6, 0, 7, 67);
  for (let y = O - 5; y <= O + 5; y += 2) for (let z = 1; z <= 6; z += 2) t.set(O + 8, y, z, C.gunDark);                             // 24 tube mouths
  t.band(4, TEAM);
  t.box(O - 10, O - 8, O - 6, O + 6, 0, 2, C.steelDark);
  writeVox('tos_turret.vox', t);
}

// ---------- Iskander-M (Russia): 8x8 transporter with one huge missile ----------
{
  const h = grid();
  for (const x of [4, 9, 23, 28]) { wheel(h, x, 0, 1); wheel(h, x, 14, 15); }
  h.box(1, 33, 2, 13, 2, 3, C.steelDark);
  h.camo(26, 33, 1, 14, 4, 10, 71);                                  // cab
  slopeFront(h, 31, 33, 1, 14, 10);
  h.box(33, 33, 3, 12, 6, 8, C.glassDark);
  h.camo(1, 25, 1, 14, 4, 6, 73);                                    // erector bed
  for (let x = 26; x <= 33; x++) { h.set(x, 1, 8, TEAM_DARK); h.set(x, 14, 8, TEAM_DARK); }
  h.set(33, 2, 5, C.light); h.set(33, 13, 5, C.light);
  writeVox('iskander_hull.vox', h);
  const t = grid(), O = 4;
  t.box(O - 3, O + 21, O - 2, O + 2, 0, 4, C.camoDark);              // missile cradle
  for (let x = O - 2; x <= O + 22; x++) for (let y = O - 1; y <= O + 1; y++) for (let z = 1; z <= 3; z++) t.set(x, y, z + 2, x > O + 19 ? C.red : C.white); // missile
  t.box(O - 3, O - 3, O - 2, O + 2, 4, 6, TEAM);                     // fins
  writeVox('iskander_turret.vox', t);
}

// ---------- MQ-9 Reaper (USA): long thin wings, V-tail, sensor ball ----------
{
  const h = grid(), Y = 14;
  for (let x = 2; x <= 22; x++) {
    const half = x > 19 ? 0 : 1, top = x > 17 ? 3 : 2;
    for (let y = Y - half; y <= Y + half; y++) for (let z = 1; z <= top; z++) h.set(x, y, z, C.jetGrey);
  }
  for (let y = Y - 14; y <= Y + 14; y++) h.box(11, 13, y, y, 2, 2, C.jetGrey);                 // straight high wing
  for (const y of [Y - 13, Y - 12, Y + 12, Y + 13]) h.set(12, y, 2, TEAM);                       // wingtips
  for (const s of [-1, 1]) for (let i = 0; i <= 3; i++) h.set(2, Y + s * i, 3 + i, TEAM);       // V tail
  h.box(0, 1, Y, Y, 1, 2, C.gunDark);                                                          // pusher prop
  h.box(19, 20, Y, Y, 0, 0, C.glassDark);                                                      // sensor ball
  for (const y of [Y - 6, Y + 6]) h.box(10, 14, y, y, 1, 1, C.olive);                          // Hellfires
  writeVox('drone.vox', h);
}

// ---------- Kirov Airship (Soviet): huge red-banded envelope, gondola underneath ----------
{
  const h = grid(), Y = 10, Z = 12;
  for (let x = 0; x <= 46; x++) {
    const t = (x - 23) / 23, r = 9 * Math.sqrt(Math.max(0, 1 - t * t));
    for (let y = Math.floor(Y - r); y <= Math.ceil(Y + r); y++) for (let z = Math.floor(Z - r * 0.85); z <= Math.ceil(Z + r * 0.85); z++) {
      if (((y - Y) / (r || 1)) ** 2 + ((z - Z) / ((r || 1) * 0.85)) ** 2 > 1) continue;
      h.set(x, y, z, x === 12 || x === 34 ? TEAM : x === 13 || x === 35 ? TEAM_DARK : C.camo);                   // two team bands
    }
  }
  for (const s of [-1, 1]) h.box(1, 6, Y + s * 9, Y + s * 11, Z, Z, TEAM);                      // tail fins
  h.box(1, 6, Y, Y, Z + 8, Z + 11, TEAM);
  h.box(16, 30, Y - 2, Y + 2, 1, 4, C.steelDark);                                              // gondola
  h.box(16, 30, Y - 2, Y + 2, 3, 3, C.light);
  for (const y of [Y - 6, Y + 6]) h.box(18, 22, y, y, 6, 7, C.gunDark);                        // engine pods
  writeVox('kirov.vox', h);
}

// ======== country specials added with the Axis and Allies ========

// ---------- Aegis Shield Carrier (EU): 8x8 hull, shield emitter dome with a pintle gun ----------
{
  const h = grid();
  for (const x of [4, 9, 17, 22]) { wheel(h, x, 0, 1); wheel(h, x, 14, 15); }
  h.camo(1, 26, 2, 13, 2, 8, 81);
  slopeFront(h, 22, 26, 2, 13, 8);
  for (let x = 2; x <= 25; x++) { h.set(x, 2, 6, TEAM_DARK); h.set(x, 13, 6, TEAM_DARK); }
  for (const [x, y] of [[3, 3], [3, 12], [20, 3], [20, 12]]) h.box(x, x + 1, y, y, 9, 10, C.rail); // emitter prongs
  h.set(26, 4, 4, C.light); h.set(26, 11, 4, C.light);
  writeVox('aegis_hull.vox', h);
  const t = grid(), O = 6;
  for (let x = -5; x <= 5; x++) for (let y = -5; y <= 5; y++) for (let z = 0; z <= 5; z++) {
    if (x * x + y * y + (z * 1.6) ** 2 > 30) continue;
    t.set(O + x, O + y, z, z >= 3 ? C.rail : z === 1 ? TEAM : C.steel);
  }
  t.box(O + 4, O + 10, O + 3, O + 3, 3, 3, C.gunDark);
  writeVox('aegis_turret.vox', t);
}

// ---------- Raijin EMP Walker (Japan): two legs; the torso with EMP projectors turns ----------
{
  const h = grid(), Y = 7;
  for (const y of [Y - 5, Y + 5]) {
    h.box(4, 9, y - 1, y + 1, 0, 0, C.steelDark);       // feet
    h.box(6, 7, y - 1, y + 1, 1, 5, C.steel);            // shins
    h.box(5, 8, y - 1, y + 1, 6, 6, C.steelDark);        // knees
    h.box(5, 6, y - 1, y + 1, 7, 10, C.camo);            // thighs
    h.set(9, y, 1, C.gunDark);
  }
  h.camo(3, 10, Y - 4, Y + 4, 10, 12, 83);               // hips
  h.band(11, TEAM_DARK);
  writeVox('raijin_hull.vox', h);
  const t = grid(), O = 7;
  t.camo(O - 5, O + 5, O - 5, O + 5, 0, 6, 87);          // torso
  t.band(3, TEAM);
  t.box(O + 4, O + 6, O - 2, O + 2, 4, 6, C.glassDark);  // cockpit
  for (const y of [O - 7, O + 7]) {                      // EMP projector arms
    t.box(O - 2, O + 2, y - 1, y + 1, 2, 5, C.steel);
    t.box(O + 3, O + 11, y, y, 3, 4, C.gunDark);
    t.box(O + 11, O + 12, y, y, 3, 4, C.rail);
  }
  writeVox('raijin_turret.vox', t);
}

// ---------- Demolition Truck (North Korea): old cab-over truck loaded with explosives ----------
{
  const h = grid();
  for (const x of [4, 9, 22]) { wheel(h, x, 0, 1); wheel(h, x, 12, 13); }
  h.box(1, 26, 2, 11, 2, 3, C.steelDark);
  h.camo(20, 26, 1, 12, 4, 11, 91);                     // cab
  h.box(26, 26, 3, 10, 7, 9, C.glassDark);
  for (let x = 20; x <= 26; x++) { h.set(x, 1, 6, TEAM_DARK); h.set(x, 12, 6, TEAM_DARK); }
  h.camo(1, 18, 1, 12, 4, 5, 93);                       // flatbed
  for (const x of [3, 8, 13]) for (const y of [3, 8]) h.box(x, x + 3, y, y + 2, 6, 10, (x + y) % 2 ? C.olive : C.red); // drums of explosive
  h.box(2, 17, 6, 7, 11, 11, C.hazard);                 // warning tape
  h.set(26, 3, 5, C.light); h.set(26, 10, 5, C.light);
  writeVox('demotruck.vox', h);
}
