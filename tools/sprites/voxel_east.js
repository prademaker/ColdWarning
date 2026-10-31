// The Axis look: its own model for every unit and structure the two factions share, written as
// "<name>_ax.vox" next to the Allied ones in assets/voxels/ (plus the "_up" upgraded looks and the
// refit tiers of the ultimate units). Run it after the other voxel scripts.
//
//   node voxel_east.js
//
// The Allies keep the sleek look of the other scripts: soft blob camouflage, cool grey panels,
// glass and team-coloured roofs. The Axis are built heavier and older-fashioned: hard-edged
// splinter camouflage, cast round turrets with red IR dazzlers, big road wheels and fuel drums,
// 8x8 trucks, greatcoats and fur hats, Flanker-style jets in blue splinter, rust-red ship decks,
// and brutalist concrete-and-brick architecture with stepped towers, cooling towers and stacks.
//
// Axes: x forward (along the map's x for structures), y to the right, z up. Pivots are in render.js.
'use strict';
const { C, TEAM, TEAM_LIGHT, TEAM_DARK, camoEast, grid, writeVox } = require('./voxel_lib');
const { era, vest, defenseKit, gunKit, chevrons, shifted } = require('./voxel_upgrades');

const ONLY = process.argv.slice(2); // optional filter: node voxel_east.js tank harvester ...
const want = k => !ONLY.length || ONLY.includes(k);
const out = (name, g) => writeVox(name, g);

// ======== shared parts ========

// a track run with five big road wheels and no return rollers (T-series style)
function eTrack(g, x0, x1, y0, y1, h = 4, wheels = 6) {
  g.box(x0 + 1, x1 - 1, y0, y1, 0, h, C.track);
  g.box(x0, x1, y0, y1, 1, h - 1, C.track);
  for (let x = x0 + 1; x <= x1 - 1; x++) { if (x % 2) { g.set(x, y0, 0, C.link); g.set(x, y1, 0, C.link); } }
  const step = (x1 - x0 - 4) / (wheels - 1);
  for (let i = 0; i < wheels; i++) {
    const cx = Math.round(x0 + 2 + i * step);
    for (const y of [y0, y1]) {
      for (const [dx, dz] of [[-1, 1], [0, 1], [1, 1], [-1, 2], [1, 2], [-1, 3], [0, 3], [1, 3]]) g.set(cx + dx, y, dz, C.wheel);
      g.set(cx, y, 2, C.hub);
    }
  }
}
// a wheel seen from the side (8x8 trucks)
function wheel(g, x, y0, y1, r = 2) {
  g.box(x - r, x + r, y0, y1, 0, r * 2, C.rubber);
  for (const y of [y0, y1]) for (const [dx, dz] of [[-r, 0], [r, 0], [-r, r * 2], [r, r * 2]]) g.del(x + dx, y, dz);
  g.set(x, y0 === 0 ? y0 : y1, r, C.olive);
  g.set(x, y0 === 0 ? y0 : y1, r, C.hub);
}
function slopeFront(g, xFrom, xTo, y0, y1, zTop) {
  for (let x = xFrom; x <= xTo; x++) for (let z = zTop - (x - xFrom); z <= zTop; z++) for (let y = y0; y <= y1; y++) g.del(x, y, z + 1);
}
function keepIf(g, f) { for (const [k, e] of [...g.v]) if (!f(e[0], e[1], e[2], e[3])) g.v.delete(k); }
// a fuel drum lying across the hull (axis y), centre (x, z), from y0 to y1
function drum(g, x, z, y0, y1, r = 1.6) {
  for (let y = y0; y <= y1; y++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (dx * dx + dz * dz > r * r + 0.3) continue;
    g.set(x + dx, y, z + dz, y === y0 || y === y1 ? C.steelDark : C.olive);
  }
}
// a small team-coloured "star" emblem (a plus with a bright centre) on a vertical face
function starY(g, x, y, z) { for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x + dx, y, z + dz, dx || dz ? TEAM : TEAM_LIGHT); }
function starX(g, x, y, z) { for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x, y + dy, z + dz, dy || dz ? TEAM : TEAM_LIGHT); }
// a squashed dome (cast turrets): ellipse rx by ry, height h, painted with the splinter camo
function castDome(g, O, rx, ry, h, seed, { front = 1 } = {}) {
  for (let x = -rx; x <= rx; x++) for (let y = -ry; y <= ry; y++) {
    const ex = x > 0 ? x / (rx * front) : x / rx, r2 = ex * ex + (y / ry) ** 2;
    if (r2 > 1) continue;
    const top = Math.round(1 + (h - 1) * Math.sqrt(1 - r2));
    for (let z = 0; z <= top; z++) g.set(O + x, O + y, z, camoEast(x + 14, y + 10, z + 8, seed));
  }
}

// ======== vehicles ========

// ---------- Main battle tank: low hull, cast dome turret, rear fuel drums, IR dazzlers ----------
function tankAx() {
  const h = grid();
  eTrack(h, 1, 30, 0, 4); eTrack(h, 1, 30, 15, 19);
  for (let x = 1; x <= 30; x++) for (let y = 0; y <= 19; y++) if (y <= 4 || y >= 15) h.set(x, y, 5, camoEast(x, y, 5, 3)); // fenders
  for (const y of [0, 19]) for (let x = 17; x <= 30; x++) for (let z = 3; z <= 4; z++) h.set(x, y, z, x % 3 === 0 ? C.grille : C.rubber); // rubber skirt flaps
  for (let x = 1; x <= 30; x++) { h.set(x, 0, 5, TEAM_DARK); h.set(x, 19, 5, TEAM_DARK); }
  h.camoE(3, 28, 5, 14, 2, 6, 5);
  slopeFront(h, 20, 28, 5, 14, 6);                                   // long glacis
  for (let y = 5; y <= 14; y++) if (y !== 9 && y !== 10) h.set(22, y, 4, C.steel); // a row of Kontakt bricks on the glacis
  h.box(3, 9, 6, 13, 7, 7, C.grille);                                 // engine deck
  for (let x = 4; x <= 9; x += 2) h.box(x, x, 6, 13, 7, 7, C.steelDark);
  drum(h, 2, 8, 5, 8); drum(h, 2, 8, 11, 14);                          // external fuel drums
  h.box(1, 2, 7, 12, 3, 5, TEAM);                                     // rear plate
  h.box(1, 2, 9, 10, 4, 4, TEAM_LIGHT);
  h.set(28, 6, 3, C.light); h.set(28, 13, 3, C.light);
  h.box(22, 23, 9, 10, 7, 7, C.steelDark);                            // driver's periscopes
  for (let z = 7; z <= 15; z++) h.set(6, 13, z, C.steelDark);         // whip antenna
  return h;
}
function tankAxTurret() {
  const t = grid(), O = 9;
  castDome(t, O, 8, 8, 6, 11, { front: 0.95 });
  for (const e of t.v.values()) {                                    // team band right round the dome's foot
    const x = e[0] - O, y = e[1] - O, ex = x > 0 ? x / 7.6 : x / 8;
    if (e[2] === 2 && ex * ex + (y / 8) ** 2 > 0.55) e[3] = TEAM;
  }
  for (const s of [-1, 1]) for (let i = 0; i <= 4; i++) {           // two plain steel wedges of armour either side of the gun
    const x = O + 3 + i, y = O + s * (2 + i);
    for (let z = 3; z <= 4; z++) if (t.get(x, y, z - 1) || z === 3) t.set(x, y, z, C.steel);
  }
  for (let x = O + 7; x <= O + 25; x++) t.box(x, x, O, O, 2, 3, C.gun);           // 125 mm gun with thermal sleeve bands
  for (const x of [O + 12, O + 17, O + 22]) t.box(x, x, O - 1, O + 1, 2, 3, C.gunDark);
  t.box(O + 25, O + 25, O, O, 2, 3, C.gunDark);
  for (const s of [-1, 1]) t.box(O + 4, O + 4, O + s * 3, O + s * 3, 4, 4, C.red); // Shtora IR dazzlers ("red eyes")
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) t.set(O + 1 - i, O + s * 7, 2 + (i % 2), C.gunDark); // smoke dischargers
  t.box(O - 4, O - 2, O + 2, O + 4, 6, 6, C.steelDark);               // commander's cupola + heavy MG
  t.box(O - 2, O + 2, O + 3, O + 3, 7, 7, C.gunDark);
  t.box(O - 9, O - 8, O - 4, O + 4, 2, 3, C.olive);                   // stowage basket
  return t;
}

// ---------- Railgun tank (tech package, China): slab-sided hull, huge boxed coil gun ----------
function railAx() {
  const h = grid();
  eTrack(h, 1, 30, 0, 4); eTrack(h, 1, 30, 15, 19);
  for (let x = 1; x <= 30; x++) for (let y = 0; y <= 19; y++) if (y <= 4 || y >= 15) h.set(x, y, 5, camoEast(x, y, 5, 7));
  for (const y of [0, 19]) for (let x = 3; x <= 28; x++) for (let z = 2; z <= 4; z++) h.set(x, y, z, x % 4 === 0 ? C.grille : C.steelDark); // slab skirts
  for (let x = 1; x <= 30; x++) { h.set(x, 0, 5, TEAM_DARK); h.set(x, 19, 5, TEAM_DARK); }
  h.camoE(3, 28, 5, 14, 2, 6, 9);
  slopeFront(h, 24, 28, 5, 14, 6);
  h.box(3, 10, 6, 13, 7, 7, C.grille);
  for (const x of [5, 8]) { h.set(x, 6, 7, C.rail); h.set(x, 13, 7, C.rail); }
  h.box(1, 2, 6, 13, 3, 6, C.steelDark); h.box(1, 1, 8, 11, 4, 5, TEAM);
  h.set(28, 6, 3, C.light); h.set(28, 13, 3, C.light);
  return h;
}
function railAxTurret() {
  const t = grid(), O = 9;
  t.camoE(O - 7, O + 5, O - 6, O + 6, 0, 4, 13);                       // slab-sided box turret
  keepIf(t, (x, y, z) => !(x - O >= 4 && z === 4 && Math.abs(y - O) > 3));
  for (const e of t.v.values()) if (e[2] === 2 && (Math.abs(e[1] - O) === 6 || e[0] === O - 7)) e[3] = TEAM;
  for (let x = O + 5; x <= O + 25; x++) for (let y = O - 1; y <= O + 1; y++) for (let z = 1; z <= 3; z++) {
    const shell = Math.abs(y - O) === 1 || z !== 2;
    t.set(x, y, z, !shell ? C.gunDark : (x % 4 === 0 ? C.rail : C.steelDark)); // boxed coil housing with glowing seams
  }
  t.box(O + 25, O + 26, O, O, 2, 2, C.rail);
  t.box(O - 5, O - 2, O - 4, O - 1, 5, 5, C.steelDark); t.set(O - 3, O - 3, 6, C.glass);
  t.box(O - 9, O - 8, O - 5, O + 5, 1, 3, C.steelDark);                // capacitor bustle
  for (let y = O - 4; y <= O + 4; y += 2) t.set(O - 9, y, 2, C.rail);
  return t;
}

// ---------- Ore truck: 8x8 tipper with a flared hopper and a front scoop ----------
function harvesterAx(full) {
  const h = grid();
  for (const x of [4, 9, 24, 29]) { wheel(h, x, 0, 1); wheel(h, x, 16, 17); }
  h.box(1, 33, 2, 15, 2, 3, C.steelDark);                              // chassis
  for (let z = 4; z <= 12; z++) {                                      // hopper flaring toward the top
    const f = Math.floor((z - 4) / 3);
    h.camoE(2, 22, 3 - f, 14 + f, z, z, 17);
  }
  h.clear(4, 20, 4, 13, 6, 12);                                        // open top
  for (let x = 2; x <= 22; x++) { h.set(x, 1, 12, TEAM); h.set(x, 16, 12, TEAM); }
  for (let x = 3; x <= 21; x += 4) for (let z = 5; z <= 11; z++) { h.set(x, z >= 10 ? 1 : z >= 7 ? 2 : 3, z, C.steelDark); h.set(x, z >= 10 ? 16 : z >= 7 ? 15 : 14, z, C.steelDark); } // ribs
  if (full) for (let x = 4; x <= 20; x++) for (let y = 4; y <= 13; y++) {
    const top = 10 + Math.round(Math.sin(x * 0.6) * 1.2 + Math.cos(y * 0.8));
    for (let z = 6; z <= top; z++) h.set(x, y, z, (x * 5 + y * 3 + z) % 6 === 0 ? C.oreDark : C.ore);
  }
  h.camoE(25, 33, 2, 15, 4, 12, 19);                                    // cab-forward cab
  slopeFront(h, 31, 33, 2, 15, 12);
  h.box(33, 33, 4, 13, 7, 9, C.glassDark); h.box(31, 32, 4, 13, 11, 11, C.glassDark);
  h.box(25, 33, 2, 2, 5, 5, TEAM_DARK); h.box(25, 33, 15, 15, 5, 5, TEAM_DARK);
  starY(h, 28, 15, 8); starY(h, 28, 2, 8);
  h.box(23, 23, 3, 4, 4, 16, C.steelDark); h.set(23, 3, 17, C.grille);  // exhaust stack
  h.box(34, 36, 1, 16, 0, 3, C.steel);                                 // scoop with teeth
  for (let y = 1; y <= 16; y += 2) h.set(37, y, 0, C.hazard);
  h.set(33, 3, 4, C.light); h.set(33, 14, 4, C.light);
  return h;
}

// ---------- MCV: ten-wheeled heavy transporter with the folded construction yard ----------
function mcvAx() {
  const h = grid();
  for (const x of [4, 9, 14, 26, 34]) { wheel(h, x, 0, 1); wheel(h, x, 16, 17); }
  h.box(1, 38, 2, 15, 2, 3, C.steelDark);
  h.camoE(31, 38, 1, 16, 4, 12, 23);                                   // wide cab
  slopeFront(h, 36, 38, 1, 16, 12);
  h.box(38, 38, 3, 14, 7, 9, C.glassDark); h.box(36, 37, 3, 14, 11, 11, C.glassDark);
  starX(h, 38, 8, 5); starX(h, 38, 9, 5);
  h.box(2, 28, 2, 15, 4, 15, C.concreteE);                              // folded module: concrete panels
  for (let x = 2; x <= 28; x += 4) h.box(x, x, 2, 15, 4, 15, C.concreteEDark);
  for (let z = 5; z <= 14; z += 3) { h.box(2, 28, 2, 2, z, z, C.concreteEDark); h.box(2, 28, 15, 15, z, z, C.concreteEDark); }
  h.box(2, 28, 2, 15, 16, 16, TEAM);                                   // team roof
  h.box(4, 26, 4, 13, 17, 17, C.roofE);
  for (let i = 0; i <= 22; i++) h.box(4 + i, 4 + i, 8, 9, 18, 18, (i >> 1) % 2 ? C.red : C.white); // folded crane jib
  h.box(26, 27, 8, 9, 17, 22, C.red); h.box(26, 27, 8, 9, 23, 23, C.white);
  for (const y of [1, 16]) h.box(6, 24, y, y, 4, 5, C.hazard);          // folded outriggers
  h.set(38, 2, 5, C.light); h.set(38, 15, 5, C.light);
  return h;
}

// ---------- Recovery: 8x8 crane truck; the striped boom swings round ----------
function recoveryAx() {
  const h = grid();
  for (const x of [4, 9, 20, 25]) { wheel(h, x, 0, 1); wheel(h, x, 14, 15); }
  h.box(1, 29, 2, 13, 2, 3, C.steelDark);
  h.camoE(22, 29, 1, 14, 4, 11, 29);
  slopeFront(h, 27, 29, 1, 14, 11);
  h.box(29, 29, 3, 12, 6, 8, C.glassDark);
  h.box(22, 29, 1, 1, 5, 5, TEAM_DARK); h.box(22, 29, 14, 14, 5, 5, TEAM_DARK);
  h.camoE(1, 20, 1, 14, 4, 5, 31);                                     // flat deck
  h.box(14, 18, 4, 11, 6, 8, C.olive); h.box(14, 18, 4, 11, 9, 9, TEAM);  // winch house
  h.set(20, 3, 9, C.flame); h.set(20, 12, 9, C.flame);                // amber beacons
  for (const y of [0, 15]) h.box(2, 3, y, y, 2, 6, C.hazard);          // outriggers
  h.set(29, 3, 4, C.light); h.set(29, 12, 4, C.light);
  return h;
}
function recoveryAxTurret() {
  const t = grid(), O = 5;
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (x * x + y * y <= 10) t.box(O + x, O + x, O + y, O + y, 0, 2, C.steelDark);
  t.box(O - 2, O + 1, O - 2, O + 2, 3, 6, C.camoDark); t.box(O, O + 1, O - 2, O - 1, 5, 6, C.glassDark); // operator cab
  for (let i = 0; i <= 16; i++) t.box(O + i, O + i, O + 1, O + 2, 5 + Math.floor(i / 2.5), 5 + Math.floor(i / 2.5), (i >> 1) % 2 ? C.red : C.white); // boom
  t.box(O + 16, O + 16, O + 1, O + 1, 4, 11, C.steel); t.box(O + 15, O + 17, O + 1, O + 1, 3, 3, C.hazard); // hook
  t.box(O - 4, O - 3, O - 2, O + 2, 1, 4, C.gunDark);                 // counterweight
  t.set(O - 4, O, 4, TEAM);
  return t;
}

// ---------- Attack helicopter: Hind-style gunship with a troop bay and stub wings ----------
function heliAx() {
  const h = grid(), Y = 12;
  for (let x = 8; x <= 33; x++) {
    const half = x > 30 ? 1 : x > 27 ? 2 : 3, top = x > 31 ? 4 : x > 27 ? 6 : x > 24 ? 8 : 9, bot = x > 29 ? 2 : 1;
    for (let y = Y - half; y <= Y + half; y++) for (let z = bot; z <= top; z++) h.set(x, y, z, camoEast(x, y, z, 37));
  }
  h.box(28, 31, Y - 1, Y + 1, 5, 6, C.glassDark);                      // gunner's bubble
  h.box(24, 27, Y - 2, Y + 2, 8, 9, C.glassDark);                      // pilot's bubble, stepped up
  h.camoE(0, 8, Y - 1, Y, 6, 7, 41);                                   // tail boom
  h.box(0, 2, Y - 1, Y, 8, 14, TEAM);                                  // fin
  h.box(1, 1, Y + 1, Y + 1, 10, 13, C.steelDark);                      // tail rotor on the right
  h.box(2, 4, Y - 4, Y + 4, 7, 7, C.camoDark);                         // tailplane
  for (const s of [-1, 1]) {                                          // anhedral stub wings with rocket pods
    for (let i = 4; i <= 10; i++) h.box(15, 19, Y + s * i, Y + s * i, 6 - Math.floor((i - 4) / 3), 6 - Math.floor((i - 4) / 3), C.camoDark);
    for (const i of [6, 9]) for (let x = 14; x <= 20; x++) for (const dz of [0, 1]) h.set(x, Y + s * i, 3 + dz, x === 20 ? C.gunDark : C.olive);
    h.box(15, 20, Y + s * 11, Y + s * 11, 4, 4, C.white); h.set(20, Y + s * 11, 4, C.red); // wingtip missile rails
  }
  for (const s of [-1, 1]) { h.box(14, 21, Y + s * 2, Y + s * 2, 10, 11, C.steelDark); h.box(12, 13, Y + s * 3, Y + s * 3, 9, 10, C.grille); } // engine pods + exhausts
  h.box(17, 18, Y, Y, 10, 12, C.steelDark);                            // rotor mast
  h.box(33, 35, Y, Y, 1, 1, C.gunDark); h.box(32, 33, Y - 1, Y + 1, 0, 1, C.steelDark); // chin gun
  for (let x = 9; x <= 26; x++) { h.set(x, Y - 3, 4, TEAM_DARK); h.set(x, Y + 3, 4, TEAM_DARK); }
  starY(h, 12, Y + 3, 6); starY(h, 12, Y - 3, 6);
  for (const [x, y] of [[29, Y], [12, Y - 3], [12, Y + 3]]) h.set(x, y, 0, C.rubber);  // wheels
  return h;
}

// ---------- Fighter: Flanker-style, twin spaced engines, twin tails, blue splinter scheme ----------
const jetPaint = (x, y, z, s = 0) => { const v = Math.floor((x * 0.7 + y * 0.45 + s) / 3.2); return Math.abs(Math.sin(v * 12.9898 + s) * 43758.5) % 1 < 0.45 ? C.jetBlue : C.jetGrey; };
function jetAx() {
  const h = grid(), Y = 16;
  for (let x = 6; x <= 36; x++) {                                      // spine and long nose
    const half = x > 33 ? 0 : x > 28 ? 1 : 1, top = x > 34 ? 2 : x > 30 ? 3 : 3, bot = x > 33 ? 1 : 0;
    for (let y = Y - half; y <= Y + half; y++) for (let z = bot; z <= top; z++) h.set(x, y, z, x > 33 ? C.jetDark : jetPaint(x, y, z));
  }
  for (const s of [-1, 1]) for (let x = 1; x <= 22; x++) for (const dy of [2, 3]) for (let z = 0; z <= 2; z++) h.set(x, Y + s * dy, z, jetPaint(x, Y + s * dy, z, 3)); // engine nacelles
  for (const s of [-1, 1]) h.box(0, 0, Y + s * 3, Y + s * 2, 1, 1, C.gunDark);
  for (const s of [-1, 1]) h.box(0, 0, Y + s * 2, Y + s * 3, 0, 2, C.grille);
  for (let x = 8; x <= 28; x++) {                                      // LERX blending into swept wings
    const span = x > 22 ? Math.round((28 - x) * 0.5) : Math.round(3 + (22 - x) * 0.72);
    for (let y = Y - 2 - span; y <= Y + 2 + span; y++) h.set(x, y, 2, jetPaint(x, y, 2, 1));
  }
  for (let x = 0; x <= 6; x++) { const span = 3 + Math.round((6 - x) * 0.9); for (let y = Y - 3 - span; y <= Y + 3 + span; y++) if (!h.get(x, y, 1)) h.set(x, y, 1, C.jetDark); } // tailplanes
  for (const s of [-1, 1]) for (let x = 2; x <= 8; x++) for (let z = 3; z <= 3 + Math.min(6, 8 - x + 2); z++) h.set(x, Y + s * (z > 6 ? 5 : 4), z, TEAM); // twin canted tails
  h.box(25, 29, Y, Y, 4, 4, C.glassDark); h.box(26, 28, Y - 1, Y + 1, 4, 4, C.glassDark); h.set(27, Y, 5, C.glassDark); // bubble canopy
  for (const s of [-1, 1]) { h.set(15, Y + s * 12, 2, C.white); h.set(16, Y + s * 12, 2, C.white); h.set(17, Y + s * 12, 2, C.red); } // wingtip missiles
  starY(h, 5, Y + 4, 5); starY(h, 5, Y - 4, 5);
  return h;
}

// ---------- Strategic bomber: long white swing-wing with four engines in two pods ----------
function bomberAx() {
  const h = grid(), Y = 24;
  for (let x = 0; x <= 47; x++) {
    const half = x > 44 ? 0 : x > 38 ? 1 : 2, top = x > 45 ? 2 : x > 41 ? 3 : 4, bot = x > 44 ? 1 : 0;
    for (let y = Y - half; y <= Y + half; y++) for (let z = bot; z <= top; z++) h.set(x, y, z, x > 45 ? C.jetDark : C.white);
  }
  for (let x = 20; x <= 34; x++) { const g2 = Math.round((34 - x) * 0.45); for (let y = Y - 2 - g2; y <= Y + 2 + g2; y++) h.box(x, x, y, y, 2, 3, C.white); } // wing glove
  for (let x = 8; x <= 26; x++) { const span = Math.round((26 - x) * 0.95); for (let y = Y - 6 - span; y <= Y + 6 + span; y++) if (Math.abs(y - Y) > 5) h.set(x, y, 2, C.jetGrey); } // swept outer wings
  for (const s of [-1, 1]) for (let x = 3; x <= 17; x++) for (const dy of [3, 4, 5, 6]) for (let z = 0; z <= 1; z++) h.set(x, Y + s * dy, z, x <= 4 ? C.grille : C.jetDark); // paired engine pods
  for (let x = 0; x <= 7; x++) for (let z = 5; z <= 5 + Math.min(10, 9 - x + 3); z++) h.set(x, Y, z, z > 11 ? TEAM : C.white); // tall fin with an all-moving top
  for (let x = 0; x <= 5; x++) { const span = 2 + Math.round((5 - x) * 1.3); h.box(x, x, Y - span, Y + span, 10, 10, C.jetGrey); } // high tailplane
  h.box(39, 42, Y - 1, Y + 1, 4, 4, C.glassDark); h.box(40, 41, Y, Y, 5, 5, C.glassDark);
  h.box(22, 30, Y - 1, Y + 1, 0, 0, C.grille);                         // bomb bay
  for (const s of [-1, 1]) { h.set(9, Y + s * 22, 2, TEAM); h.set(10, Y + s * 22, 2, TEAM); }
  starY(h, 30, Y + 2, 2);
  return h;
}

// ======== infantry: greatcoats, fur hats, AKs with wooden furniture ========
function soldierAx(kind, frame) {
  const g = grid(), Y = 3;
  const [l, r] = [[0, 0], [1, -1], [-1, 1]][frame];
  for (const [dy, dx] of [[-1, l], [1, r]]) g.box(2 + dx, 3 + dx, Y + dy, Y + dy, 0, 3, C.camoDark);     // legs under the coat
  for (const [dy, dx] of [[-1, l], [1, r]]) g.box(2 + dx, 4 + dx, Y + dy, Y + dy, 0, 1, C.rubber);       // tall boots
  for (let z = 3; z <= 10; z++) {                                                                       // greatcoat, flared skirt
    const w = z <= 5 ? 2 : 2, x0 = z <= 5 ? 1 : 1, x1 = z <= 5 ? 4 : 4;
    for (let x = x0; x <= x1; x++) for (let y = Y - w; y <= Y + w; y++) g.set(x, y, z, camoEast(x, y, z, frame * 2 + (kind === 'rocket' ? 5 : 0)));
  }
  for (let x = 0; x <= 5; x++) for (let y = Y - 2; y <= Y + 2; y++) if ((x === 0 || x === 5) && Math.abs(y - Y) <= 1) g.set(x, y, 3, camoEast(x, y, 3, 1)); // coat hem
  g.box(1, 4, Y - 2, Y + 2, 6, 6, C.wood);                                                              // belt
  g.box(0, 0, Y - 1, Y + 1, 6, 9, C.olive);                                                             // pack
  g.box(0, 1, Y - 2, Y + 2, 10, 10, TEAM);                                                              // rolled bedroll on the pack (team colour)
  g.box(2, 3, Y - 1, Y + 1, 11, 11, C.skin);                                                            // face
  const hat = kind === 'engineer' ? C.orange : kind === 'medic' ? C.white : C.fur;
  g.box(1, 4, Y - 2, Y + 2, 12, 13, hat);                                                               // ushanka (wider than a helmet)
  for (const s of [-1, 1]) g.box(2, 3, Y + s * 2, Y + s * 2, 11, 11, hat);                              // ear flaps
  g.set(4, Y, 13, kind === 'medic' ? C.red : TEAM);                                                      // badge
  if (kind === 'rifle' || kind === 'medic') {                                                           // AK with a curved magazine
    g.box(3, 9, Y + 2, Y + 2, 8, 8, C.gunDark); g.box(3, 3, Y + 2, Y + 2, 7, 8, C.wood); g.box(6, 7, Y + 2, Y + 2, 8, 8, C.wood);
    g.set(6, Y + 2, 7, C.gunDark); g.set(7, Y + 2, 6, C.gunDark);
  }
  if (kind === 'rocket') {                                                                              // RPG on the shoulder: tube + bulbous warhead
    g.box(0, 8, Y + 2, Y + 2, 11, 11, C.olive); g.box(3, 4, Y + 2, Y + 2, 10, 10, C.wood);
    g.box(9, 10, Y + 1, Y + 3, 10, 12, C.olive); g.set(11, Y + 2, 11, C.olive); g.set(0, Y + 2, 11, C.gunDark);
    g.box(0, 0, Y - 2, Y - 1, 7, 10, C.olive); g.set(0, Y - 2, 11, C.olive);                            // spare grenades on the back
  }
  if (kind === 'engineer') {                                                                            // toolbox, shovel and a big wrench
    g.box(4, 6, Y + 2, Y + 3, 3, 5, C.steel); g.box(5, 5, Y + 3, Y + 3, 6, 6, C.steelDark);
    g.box(0, 0, Y + 2, Y + 2, 5, 13, C.wood); g.box(0, 0, Y + 1, Y + 3, 4, 4, C.steelDark);
    g.box(1, 4, Y - 2, Y + 2, 8, 8, C.orange);
  }
  if (kind === 'medic') {                                                                               // red-cross armband and a big satchel
    g.box(2, 3, Y - 2, Y - 2, 9, 9, C.white); g.set(2, Y - 2, 9, C.red);
    g.box(2, 4, Y + 3, Y + 3, 4, 6, C.white); g.set(3, Y + 3, 5, C.red);
  }
  if (kind === 'shock') {                                                                               // Axis flame trooper: twin tanks, lance, gas mask
    for (const y of [Y - 2, Y + 2]) { g.box(0, 0, y, y, 4, 11, C.hazard); g.set(0, y, 12, C.steelDark); }
    g.box(4, 8, Y + 2, Y + 2, 7, 7, C.steelDark); g.set(9, Y + 2, 7, C.flame);
    g.box(4, 4, Y - 1, Y + 1, 11, 11, C.glassDark); g.set(5, Y, 11, C.steelDark);
  }
  if (kind === 'hacker') {                                                                              // China: uplink pack with a mast and a glowing tablet
    g.box(0, 0, Y - 1, Y + 1, 6, 11, C.steelDark); g.box(0, 0, Y, Y, 12, 16, C.steel); g.box(0, 0, Y - 2, Y + 2, 17, 17, C.white);
    g.box(4, 5, Y + 1, Y + 2, 7, 8, C.rail);
  }
  return g;
}

// ======== navy: darker hulls with rust-red decks, angular superstructures ========
function shipHull(g, L, B, H, { bow = 0.34 } = {}) {
  const Y = Math.ceil(B / 2);
  for (let x = 0; x < L; x++) {
    const f = x / (L - 1);
    let w = 1;
    if (f > 1 - bow) w = 1 - (f - (1 - bow)) / bow * 0.92;            // straight, raked bow (not rounded)
    else if (f < 0.06) w = 0.8 + f / 0.06 * 0.2;
    const half = B / 2 * w;
    for (let z = 0; z <= H; z++) {
      const top = H + (f > 0.75 ? 1 : 0);
      if (z > top) continue;
      const hz = half * (0.72 + 0.28 * z / H);
      for (let y = Math.round(Y - hz); y <= Math.round(Y + hz); y++) {
        const edge = Math.abs(y - Y) >= hz - 1;
        let c = z === 0 ? C.boot : z === top ? C.deckE : C.hullE;
        if (z === top - 1 && edge) c = TEAM_DARK;
        if (z === top && edge) c = C.hullEDark;
        g.set(x, y, z, c);
      }
    }
  }
  return Y;
}
// a slab-sided deckhouse with a band of dark portholes
function blockHouse(g, x0, x1, y0, y1, z0, z1, c = C.hullE) {
  g.box(x0, x1, y0, y1, z0, z1, c);
  g.box(x0, x1, y0, y1, z1, z1, C.hullEDark);
  for (let y = y0 + 1; y < y1; y += 3) g.set(x1, y, z1 - 1, C.glassDark);
  for (let x = x0 + 1; x < x1; x += 3) g.set(x, y1, z1 - 1, C.glassDark);
}
// a lattice mast topped with a big round search radar
function radarMast(g, x, y, z0, z1, r = 3) {
  for (let z = z0; z <= z1; z++) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if ((z + dx + dy) % 2 === 0 || z === z0) g.set(x + dx, y + dy, z, C.steelDark);
  for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; g.set(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r), z1 + 1, C.steel); }
  g.box(x, x, y - r + 1, y + r - 1, z1 + 1, z1 + 1, C.steelDark);
  g.set(x, y, z1 + 2, C.light);
}
// a twin-barrelled angular gunhouse on its own grid, pivot at (O, O)
function boxTurret(r, len, h = 3, barrels = 2) {
  const t = grid(), O = r + 1;
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = 0; z <= h; z++) {
    if (x > r - 2 && z >= h - (x - (r - 2))) continue;                // sloped face
    if (x < -r + 1 && Math.abs(y) === r) continue;
    t.set(O + x, O + y, z, z === 1 && (Math.abs(y) === r || x === -r) ? TEAM : z === h ? C.hullEDark : C.hullE);
  }
  const off = barrels === 1 ? [0] : barrels === 2 ? [-1, 1] : [-2, 0, 2];
  for (const dy of off) t.box(O + r - 1, O + r + len, O + dy, O + dy, 1, 1, C.gunDark);
  return t;
}

// ---------- Patrol boat: missile boat with four big canisters ----------
function patrolAx() {
  const g = grid(), Y = shipHull(g, 30, 9, 3, { bow: 0.4 });
  blockHouse(g, 13, 19, Y - 2, Y + 2, 4, 7);
  g.box(19, 19, Y - 2, Y + 2, 6, 6, C.glassDark);
  radarMast(g, 15, Y, 8, 10, 2);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {               // missile canisters angled up toward the bow
    const y = Y + s * (2 + i);
    for (let x = 3; x <= 11; x++) for (const dz of [0, 1]) g.set(x, y, 4 + Math.floor((x - 3) / 4) + dz, x === 11 ? C.hullEDark : C.hullE);
  }
  g.box(1, 2, Y - 1, Y + 1, 4, 5, C.gunDark);                          // aft gun
  return g;
}
// ---------- Destroyer: two twin gun turrets (fore and aft), big funnel, round radar ----------
const DESTROYER_AX = { L: 46, turrets: [37, 8] };
function destroyerAx() {
  const g = grid(), Y = shipHull(g, DESTROYER_AX.L, 12, 4);
  blockHouse(g, 15, 30, Y - 4, Y + 4, 5, 10);
  blockHouse(g, 24, 30, Y - 3, Y + 3, 10, 14);                          // stepped bridge
  for (let y = Y - 2; y <= Y + 2; y++) g.set(30, y, 13, C.glassDark);
  radarMast(g, 25, Y, 15, 22, 3);
  g.box(17, 21, Y - 2, Y + 2, 10, 15, C.hullEDark); g.box(17, 21, Y - 2, Y + 2, 15, 15, TEAM); g.box(18, 20, Y - 1, Y + 1, 15, 15, C.black); // big funnel
  for (const s of [-1, 1]) for (let x = 31; x <= 34; x++) g.box(x, x, Y + s * 4, Y + s * 4, 5, 6 + (x - 31) % 2, C.hullEDark); // quad missile canisters
  for (const x of DESTROYER_AX.turrets) for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; g.set(Math.round(x + Math.cos(t) * 3.6), Math.round(Y + Math.sin(t) * 3.6), 5, C.hullEDark); }
  g.box(11, 14, Y - 4, Y + 4, 5, 8, C.hullE); g.box(11, 14, Y - 4, Y + 4, 8, 8, C.hullEDark); // helicopter hangar
  for (const s of [-1, 1]) g.box(28, 29, Y + s * 5, Y + s * 5, 6, 7, C.gunDark);
  return g;
}
// ---------- Submarine: broad ballistic-missile boat with a hump of launch hatches ----------
function subAx() {
  const g = grid(), Y = 5, L = 44;
  for (let x = 0; x < L; x++) {
    const f = x / (L - 1), r = 4.6 * (f > 0.86 ? Math.sqrt(1 - ((f - 0.86) / 0.14) ** 2) : f < 0.22 ? 0.4 + 0.6 * f / 0.22 : 1);
    for (let y = Math.round(Y - r); y <= Math.round(Y + r); y++) for (let z = 0; z <= Math.round(r * 0.6); z++) {
      if ((y - Y) ** 2 / (r * r) + (z / (r * 0.6 + 0.01)) ** 2 > 1.05) continue;
      g.set(x, y, z, C.black);
    }
  }
  for (let x = 12; x <= 26; x++) for (let y = Y - 2; y <= Y + 2; y++) g.set(x, y, 3, C.black);  // missile deck hump
  for (let x = 13; x <= 25; x += 2) for (const y of [Y - 1, Y + 1]) g.set(x, y, 4, C.hullEDark); // hatches
  g.box(28, 33, Y - 1, Y + 1, 3, 7, C.black); g.box(28, 33, Y - 1, Y + 1, 7, 7, TEAM_DARK); // sail forward of the hump
  g.box(33, 33, Y - 1, Y + 1, 4, 6, C.hullEDark);
  g.box(0, 1, Y, Y, 0, 5, C.black); g.box(0, 1, Y - 4, Y + 4, 2, 2, C.black); // cruciform tail
  g.box(0, 2, Y - 2, Y + 2, 1, 3, C.hullEDark);                         // pump-jet shroud
  g.set(30, Y, 8, C.steel); g.set(30, Y, 9, C.steel);
  for (let x = 4; x <= 40; x += 4) g.set(x, Y, 2, TEAM_DARK);
  return g;
}
// ---------- Hovercraft: Zubr-style, three big propellers on pylons, side deckhouses ----------
function hoverAx() {
  const g = grid(), L = 34, B = 17, Y = 9;
  for (let x = 0; x < L; x++) for (let y = 0; y <= B; y++) {
    const dx = Math.max(0, Math.abs(x - 16.5) - 13), dy = Math.max(0, Math.abs(y - 8.5) - 5.5);
    if (dx * dx + dy * dy > 9) continue;
    g.box(x, x, y, y, 0, 2, C.skirt);
    g.set(x, y, 3, C.hullEDark);
  }
  g.box(4, 30, Y - 4, Y + 4, 3, 3, C.deckE);
  for (const s of [-1, 1]) { blockHouse(g, 6, 28, Y + s * 6 - (s > 0 ? 1 : 0), Y + s * 6 + (s > 0 ? 0 : 1), 4, 8); for (let x = 7; x <= 27; x++) g.set(x, Y + s * 6, 6, TEAM); }
  blockHouse(g, 22, 27, Y - 3, Y + 3, 4, 10); g.box(27, 27, Y - 2, Y + 2, 9, 9, C.glassDark); // central bridge
  g.box(31, 32, Y - 3, Y + 3, 3, 5, C.hazard);                          // bow ramp
  for (const y of [Y - 6, Y, Y + 6]) {                                  // three propellers on pylons
    g.box(4, 5, y, y, 4, 10, C.steelDark);
    for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; g.set(3, Math.round(y + Math.cos(t) * 2.6), Math.round(12 + Math.sin(t) * 2.6), C.gunDark); }
    g.box(3, 3, y, y, 10, 14, C.steel); g.box(3, 3, y - 2, y + 2, 12, 12, C.steel);
  }
  for (const s of [-1, 1]) g.box(24, 25, Y + s * 2, Y + s * 2, 10, 12, C.gunDark);   // AK-630 mounts
  return g;
}

// ======== ultimate units, Mk I to Mk IV (each tier keeps the one before and adds more) ========
const TIERS = [1, 2, 3, 4];
const tname = (base, tier, part = '') => `${base}_ax${tier > 1 ? '_t' + tier : ''}${part}.vox`;

// ---------- Goliath: hulking riveted walker-suit with a drum-fed autocannon ----------
function goliathAx(tier, frame) {
  const g = grid(), X = 2, Y = 10;
  const step = [[0, 0], [2, -2], [-2, 2]][frame];
  for (const [s, dx] of [[-1, step[0]], [1, step[1]]]) {
    const y = Y + s * 4;
    g.box(X + 1 + dx, X + 6 + dx, y - 1, y + 1, 0, 1, C.steelDark);    // wide feet
    g.box(X + 2 + dx, X + 5 + dx, y - 1, y + 1, 2, 7, camoEast(X, y, 4, 2) === C.camo ? C.camoDark : C.camo); // pillar legs
    g.box(X + 2 + dx, X + 5 + dx, y - 1, y + 1, 4, 4, C.steel);
  }
  for (let z = 8; z <= 18; z++) {                                       // barrel-chested torso, wider at the shoulders
    const w = z > 14 ? 5 : 4;
    for (let x = X; x <= X + 7; x++) for (let y = Y - w; y <= Y + w; y++) g.set(x, y, z, camoEast(x, y, z, 31));
  }
  g.box(X + 7, X + 7, Y - 2, Y + 2, 13, 15, C.glassDark);              // vision slit
  g.box(X + 7, X + 7, Y - 3, Y + 3, 16, 16, C.steelDark);
  g.box(X + 2, X + 5, Y - 2, Y + 2, 19, 19, C.steelDark);              // flat hatch instead of a head
  for (let x = X; x <= X + 7; x += 3) for (const y of [Y - 5, Y + 5]) g.set(x, y, 16, C.grille); // rivets
  g.box(X - 1, X - 1, Y - 3, Y + 3, 9, 17, TEAM);                      // engine pack
  g.box(X - 1, X - 1, Y - 1, Y + 1, 18, 21, C.grille);                 // exhaust
  g.box(X + 2, X + 6, Y + 6, Y + 7, 10, 14, C.camoDark);               // right arm: autocannon with a drum
  g.box(X + 6, X + 14, Y + 6, Y + 7, 12, 12, C.gunDark);
  g.box(X + 3, X + 5, Y + 8, Y + 9, 10, 13, C.olive);
  g.box(X + 2, X + 6, Y - 7, Y - 6, 10, 14, C.camoDark);               // left arm: hydraulic claw
  g.box(X + 6, X + 8, Y - 8, Y - 6, 9, 10, C.steel);
  starY(g, X + 4, Y - 6, 16);
  if (tier >= 2) {
    g.box(X + 8, X + 8, Y - 4, Y + 4, 9, 14, C.steel);                 // bolted front plate
    for (let y = Y - 4; y <= Y + 4; y += 2) g.set(X + 8, y, 12, C.grille);
    g.box(X + 1, X + 6, Y + 6, Y + 8, 15, 18, C.olive);                // RPO rocket box on the right shoulder
    for (const y of [Y + 6, Y + 8]) for (const z of [16, 18]) g.set(X + 6, y, z, C.gunDark);
  }
  if (tier >= 3) {
    for (const s of [-1, 1]) g.box(X + 6, X + 6, Y + s * 4 - 1, Y + s * 4 + 1, 2, 7, C.steel); // shin armour
    g.box(X + 3, X + 3, Y - 4, Y - 4, 20, 27, C.steelDark); g.set(X + 3, Y - 4, 28, C.red); // radio whip with a red lamp
    g.box(X - 2, X - 2, Y - 2, Y + 2, 10, 15, C.olive);                // spare drum magazines
  }
  if (tier >= 4) {
    g.box(X - 1, X + 15, Y - 7, Y - 6, 18, 19, C.gun);                 // heavy twin barrel over the left shoulder
    g.box(X - 1, X + 15, Y - 9, Y - 8, 18, 19, C.gun);
    g.box(X + 13, X + 15, Y - 9, Y - 6, 17, 20, C.gunDark);
    g.box(X - 1, X + 3, Y - 9, Y - 6, 17, 20, C.steelDark);
    for (let x = X; x <= X + 7; x++) { g.set(x, Y - 5, 9, TEAM); g.set(x, Y + 5, 9, TEAM); } // team trim
    g.box(X + 2, X + 5, Y - 2, Y + 2, 20, 20, TEAM_LIGHT);
  }
  return g;
}

// ---------- Behemoth: six-tracked land fortress, triple-gun turret, rear command tower ----------
function behemothAxHull(tier) {
  const h = grid();
  for (const [y0, y1] of [[0, 4], [6, 10], [25, 29], [31, 35]]) eTrack(h, 1, 47, y0, y1, 5, 8);
  for (let x = 1; x <= 47; x++) for (const y of [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35]) h.set(x, y, 6, camoEast(x, y, 6, 51));
  for (let x = 1; x <= 47; x++) { h.set(x, 0, 6, TEAM_DARK); h.set(x, 35, 6, TEAM_DARK); }
  h.camoE(2, 46, 5, 30, 2, 11, 53);
  slopeFront(h, 36, 46, 5, 30, 11);
  for (let x = 37; x <= 45; x++) for (let y = 5; y <= 30; y++) { const top = 11 - (x - 36); if (top >= 2 && (x + y) % 3 === 0) h.set(x, y, top, C.steel); } // brick armour on the glacis
  h.box(3, 13, 9, 26, 12, 12, C.grille);
  for (let x = 4; x <= 13; x += 3) h.box(x, x, 9, 26, 12, 12, C.steelDark);
  for (const [y0, y1] of [[6, 9], [11, 14], [21, 24], [26, 29]]) drum(h, 2, 13, y0, y1);   // a rack of fuel drums
  h.box(1, 2, 11, 24, 4, 9, TEAM); starX(h, 1, 17, 7); starX(h, 1, 18, 7);
  for (const y of [7, 28]) h.set(46, y, 3, C.light);
  if (tier >= 2) for (const y of [0, 35]) for (let x = 3; x <= 45; x++) for (let z = 1; z <= 5; z++) h.set(x, y, z, z === 3 ? C.grille : x % 4 === 0 ? C.steelDark : C.steel); // slab side armour
  if (tier >= 3) {
    for (const y of [5, 29]) { h.box(33, 37, y - 1, y + 2, 12, 14, C.steelDark); h.box(38, 43, y, y + 1, 13, 13, C.gunDark); } // twin MG sponsons
    h.box(47, 49, 3, 32, 1, 5, C.steel); for (let y = 4; y <= 31; y += 2) h.set(50, y, 1, C.hazard); // mine plough
  }
  if (tier >= 4) {
    for (let x = 3; x <= 34; x++) { h.set(x, 5, 12, TEAM); h.set(x, 30, 12, TEAM); }
    h.box(14, 19, 12, 23, 12, 15, C.steelDark); for (let y = 13; y <= 22; y += 3) h.set(19, y, 15, C.red); // ammunition hoist
  }
  return h;
}
const BAO = 16;
function behemothAxTurret(tier) {
  const t = grid(), O = BAO;
  castDome(t, O, 13, 12, 8, 57, { front: 0.85 });
  for (const e of t.v.values()) if (e[2] === 2 && (Math.abs(e[1] - O) >= 10 || e[0] - O <= -11)) e[3] = TEAM;
  t.box(O + 9, O + 12, O - 7, O + 7, 1, 6, C.steelDark);
  for (const y of [O - 5, O, O + 5]) { t.box(O + 12, O + 33, y, y, 3, 4, C.gun); for (const x of [O + 18, O + 25]) t.box(x, x, y, y, 2, 5, C.gunDark); t.box(O + 33, O + 34, y, y, 3, 4, C.gunDark); } // three 152 mm guns
  for (const s of [-1, 1]) t.box(O + 6, O + 6, O + s * 5, O + s * 5, 7, 7, C.red);
  t.box(O - 9, O - 5, O + 3, O + 7, 9, 10, C.steelDark); t.box(O - 5, O - 1, O + 5, O + 5, 10, 10, C.gunDark);
  if (tier >= 2) for (const y0 of [O - 16, O + 13]) {                  // rocket racks either side
    t.box(O - 9, O + 3, y0, y0 + 3, 2, 6, C.olive);
    for (let y = y0; y <= y0 + 3; y++) for (const z of [3, 5]) t.set(O + 3, y, z, C.gunDark);
  }
  if (tier >= 3) {
    for (let x = O + 3; x <= O + 10; x++) for (let y = O - 9; y <= O + 9; y++) { const z = 6; if (t.get(x, y, z - 1) && (x + y) % 2 === 0) t.set(x, y, z, C.steel); }
    t.box(O - 13, O - 12, O - 6, O + 6, 2, 6, C.olive);                // stowage
    t.box(O + 1, O + 4, O - 9, O - 6, 8, 9, C.steelDark); t.set(O + 4, O - 7, 9, C.red);
  }
  if (tier >= 4) {
    t.box(O - 8, O + 30, O - 1, O, 10, 11, C.gun);                     // roof-mounted coil gun
    for (let x = O - 4; x <= O + 28; x += 4) for (let y = O - 2; y <= O + 1; y++) t.set(x, y, 12, C.rail);
    t.box(O + 28, O + 30, O - 2, O + 1, 9, 12, C.gunDark);
    t.box(O - 10, O - 4, O - 3, O + 2, 9, 11, C.steelDark);
  }
  return t;
}

// ---------- Valkyrie: twin-rotor flying fortress (rotors drawn as discs on top) ----------
function valkyrieAx(tier) {
  const g = grid(), Y = 16;
  for (let x = 2; x <= 40; x++) {                                      // long box fuselage with a glazed nose
    const half = x > 37 ? 2 : 4, top = x > 37 ? 7 : 10, bot = x > 38 ? 3 : 2;
    for (let y = Y - half; y <= Y + half; y++) for (let z = bot; z <= top; z++) g.set(x, y, z, camoEast(x, y, z, 61));
  }
  g.box(38, 40, Y - 2, Y + 2, 4, 6, C.glassDark); g.box(34, 37, Y - 3, Y + 3, 9, 10, C.glassDark);
  for (const [cx, cz] of [[34, 11], [6, 14]]) {                          // twin rotor pylons, the rear one tall
    g.box(cx - 3, cx + 3, Y - 3, Y + 3, 10, cz, C.camoDark);
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; g.set(Math.round(cx + Math.cos(t) * 13), Math.round(Y + Math.sin(t) * 13), cz + 1, C.steelDark); }
    for (let i = -13; i <= 13; i++) { g.set(cx + i, Y, cz + 1, C.gunDark); g.set(cx, Y + i, cz + 1, C.gunDark); }
    g.box(cx - 1, cx + 1, Y - 1, Y + 1, cz + 1, cz + 2, TEAM);
  }
  for (let x = 4; x <= 36; x++) { g.set(x, Y - 4, 6, TEAM_DARK); g.set(x, Y + 4, 6, TEAM_DARK); }
  starY(g, 20, Y + 4, 8); starY(g, 20, Y - 4, 8);
  for (const s of [-1, 1]) { g.box(12, 18, Y + s * 5, Y + s * 5, 4, 7, C.gunDark); g.box(18, 22, Y + s * 5, Y + s * 5, 5, 5, C.gunDark); } // side door guns
  g.box(40, 43, Y, Y, 2, 2, C.gunDark);                                 // nose cannon
  if (tier >= 2) for (const s of [-1, 1]) {                             // stub wings with rocket pods
    g.box(20, 25, Y + s * 5, Y + s * 9, 6, 6, C.camoDark);
    for (const y of [Y + s * 7, Y + s * 9]) g.box(19, 26, y, y, 4, 5, C.olive);
  }
  if (tier >= 3) {
    for (let x = 6; x <= 36; x++) for (let z = 3; z <= 9; z++) for (const y of [Y - 5, Y + 5]) if (!g.get(x, y, z) && z % 3 !== 0) g.set(x, y, z, x % 4 === 0 ? C.grille : C.steel);
    for (const s of [-1, 1]) g.box(2, 4, Y + s * 4, Y + s * 4, 2, 4, C.hazard);
  }
  if (tier >= 4) {
    g.box(14, 40, Y + 3, Y + 4, 0, 1, C.gunDark); g.box(38, 41, Y + 2, Y + 5, 0, 2, C.steelDark); // belly howitzer
    g.box(14, 20, Y + 1, Y + 5, 0, 2, C.steelDark);
    for (let x = 4; x <= 36; x++) { g.set(x, Y - 4, 10, TEAM); g.set(x, Y + 4, 10, TEAM); }
  }
  return g;
}

// ---------- Leviathan: arsenal battleship, three triple turrets, pyramid superstructure ----------
const LEV_AX = { L: 84, B: 21, H: 6, turrets: [66, 53, 17] };
function leviathanAxHull(tier) {
  const g = grid(), Y = shipHull(g, LEV_AX.L, LEV_AX.B, LEV_AX.H, { bow: 0.3 });
  for (let z = 7; z <= 22; z++) {                                       // stepped pyramid superstructure
    const k = Math.floor((z - 7) / 4);
    const x0 = 28 + k * 2, x1 = 46 - k * 2, w = 6 - k;
    if (x1 <= x0 || w < 2) continue;
    g.box(x0, x1, Y - w, Y + w, z, z, z % 4 === 2 ? C.hullEDark : C.hullE);
    if (z % 4 === 1) { for (let y = Y - w + 1; y < Y + w; y += 2) g.set(x1, y, z, C.glassDark); for (let x = x0 + 1; x < x1; x += 2) g.set(x, Y + w, z, C.glassDark); }
  }
  radarMast(g, 38, Y, 23, 32, 4);
  g.box(30, 33, Y - 3, Y + 3, 7, 19, C.hullEDark); g.box(30, 33, Y - 3, Y + 3, 19, 19, TEAM); g.box(31, 32, Y - 2, Y + 2, 19, 19, C.black); // single big stack
  for (const x of LEV_AX.turrets) for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; g.set(Math.round(x + Math.cos(t) * 5.5), Math.round(Y + Math.sin(t) * 5.5), 7, C.hullEDark); }
  for (const x of [26, 48]) for (const s of [-1, 1]) g.box(x, x + 2, Y + s * 8, Y + s * 8, 7, 8, C.gunDark);
  if (tier >= 2) {
    for (let x = 5; x <= 11; x++) for (let y = Y - 4; y <= Y + 4; y++) g.set(x, y, 7, (x + y) % 2 ? C.black : C.deckE); // missile cells
    for (const s of [-1, 1]) for (let x = 58; x <= 62; x++) g.box(x, x, Y + s * 6, Y + s * 6, 7, 8 + (x % 2), C.hullEDark); // canister racks forward
  }
  if (tier >= 3) {
    for (const [x, s] of [[27, -1], [27, 1], [47, -1], [47, 1]]) g.box(x, x + 1, Y + s * 6, Y + s * 6, 11, 12, C.gunDark); // CIWS gatlings
    for (const e of [...g.v.values()]) if ((e[2] === 2 || e[2] === 3) && e[3] === C.hullE && e[0] > 6 && e[0] < 76) e[3] = C.steel; // armour belt
  }
  if (tier >= 4) {
    for (let x = 8; x <= 72; x++) if (!LEV_AX.turrets.some(t => Math.abs(x - t) < 7)) { g.set(x, Y - 7, 7, C.rail); g.set(x, Y + 7, 7, C.rail); }
    for (const e of [...g.v.values()]) if (e[2] === LEV_AX.H - 1 && e[3] === TEAM_DARK) e[3] = TEAM;
    g.box(38, 38, Y - 6, Y - 4, 31, 31, TEAM);
  }
  return g;
}
const LAO = 6;
function leviathanAxTurret(tier) {
  const t = grid(), O = LAO, r = 5, h = 4;
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = 0; z <= h; z++) {
    if (x > r - 3 && z >= h - (x - (r - 3))) continue;                 // sloped face
    if (x < -r + 1 && Math.abs(y) >= r - 1) continue;
    t.set(O + x, O + y, z, z === 1 ? TEAM : z === h ? C.hullEDark : C.hullE);
  }
  for (const dy of [-2, 0, 2]) t.box(O + r - 1, O + r + 13, O + dy, O + dy, 2, 2, C.gunDark);
  t.box(O - 3, O - 1, O - 4, O - 2, h + 1, h + 1, C.steelDark);       // rangefinder hood
  if (tier >= 3) for (let x = -r; x <= r - 3; x++) for (const y of [O - r - 1, O + r + 1]) t.set(O + x, y, 2, C.steel);
  if (tier >= 4) {
    for (const dy of [-2, 0, 2]) { t.box(O + r, O + r + 16, O + dy, O + dy, 2, 2, C.gun); t.set(O + r + 16, O + dy, 2, C.gunDark); }
    for (let x = O + r + 2; x <= O + r + 14; x += 3) for (let y = O - 3; y <= O + 3; y++) t.set(x, y, 3, C.rail);
  }
  return t;
}

// ======== write the units ========
const VEH_UP = (name, g, opts) => { out(name + '.vox', g); out(name + '_up.vox', era(shifted(g, 1, 1), opts)); };
if (want('tank')) { VEH_UP('tank_ax_hull', tankAx(), { zMin: 2 }); VEH_UP('tank_ax_turret', tankAxTurret(), { zMin: 0, top: true, belt: 4 }); }
if (want('railtank')) { VEH_UP('railtank_ax_hull', railAx(), { zMin: 2 }); VEH_UP('railtank_ax_turret', railAxTurret(), { zMin: 0, top: true, belt: 4 }); }
if (want('recovery')) { VEH_UP('recovery_ax_hull', recoveryAx(), { zMin: 2 }); VEH_UP('recovery_ax_turret', recoveryAxTurret(), { zMin: 0, top: true, belt: 4 }); }
if (want('harvester')) { out('harvester_ax.vox', harvesterAx(false)); out('harvester_ax_full.vox', harvesterAx(true)); }
if (want('mcv')) out('mcv_ax.vox', mcvAx());
if (want('heli')) out('heli_ax.vox', heliAx());
if (want('jet')) out('jet_ax.vox', jetAx());
if (want('bomber')) out('bomber_ax.vox', bomberAx());
for (const kind of ['rifle', 'rocket', 'engineer', 'medic']) if (want(kind)) for (let f = 0; f < 3; f++) {
  const g = soldierAx(kind, f);
  out(`${kind}_ax_${f}.vox`, g);
  out(`${kind}_ax_${f}_up.vox`, vest(soldierAx(kind, f)));
}
// Axis-only soldiers (they had no Allied twin) take the Axis body directly
for (const kind of ['shock', 'hacker']) if (want(kind)) for (let f = 0; f < 3; f++) { out(`${kind}_${f}.vox`, soldierAx(kind, f)); out(`${kind}_${f}_up.vox`, vest(soldierAx(kind, f))); }
if (want('patrol')) { out('patrol_ax_hull.vox', patrolAx()); out('patrol_ax_turret.vox', boxTurret(2, 5, 2, 2)); }
if (want('destroyer')) { out('destroyer_ax_hull.vox', destroyerAx()); out('destroyer_ax_turret.vox', boxTurret(3, 7, 3, 2)); }
if (want('sub')) out('sub_ax.vox', subAx());
if (want('hover')) out('hover_ax.vox', hoverAx());
for (const t of TIERS) {
  if (want('goliath')) for (let f = 0; f < 3; f++) out(tname('goliath', t, '_' + f), goliathAx(t, f));
  if (want('behemoth')) { out(tname('behemoth', t, '_hull'), behemothAxHull(t)); out(tname('behemoth', t, '_turret'), behemothAxTurret(t)); }
  if (want('valkyrie')) out(tname('valkyrie', t), valkyrieAx(t));
  if (want('leviathan')) { out(tname('leviathan', t, '_hull'), leviathanAxHull(t)); out(tname('leviathan', t, '_turret'), leviathanAxTurret(t)); }
}

module.exports = { DESTROYER_AX, LEV_AX };
require('./voxel_east_buildings');
