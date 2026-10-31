// Axis structures (run through voxel_east.js): brutalist concrete and brick, stepped towers,
// sawtooth roofs, cooling towers and smokestacks. Written as b_<key>_ax.vox, b_<key>_ax_gun.vox
// for the turning weapons, and b_<key>_ax_up(.._gun).vox for the Mk II refits.
//
// Same footprint convention as voxel_buildings.js: one voxel is 2 game px, the footprint starts at
// (0, 0), and the faces toward the viewer are the y = max and x = max faces. Live details (lights,
// flags, the radar dish) are drawn by the game; the Axis spots are in BLD_LIVE_AX in js/art.js.
//
// This file also repaints the models only the Axis field (Titan, Flak Track, the Battlecruiser,
// the Flame Tower, the Axis countries' specials...) in the Axis splinter camouflage and materials,
// so the whole faction shares one look.
'use strict';
const fs = require('fs');
const path = require('path');
const { C, TEAM, TEAM_LIGHT, TEAM_DARK, camoEast, grid, writeVox } = require('./voxel_lib');
const { readVox, defenseKit, gunKit, chevrons } = require('./voxel_upgrades');

const ONLY = process.argv.slice(2);
const want = k => !ONLY.length || ONLY.includes(k) || ONLY.includes('buildings');
const DIR = path.join(__dirname, '..', '..', 'assets', 'voxels');

const M = { con: C.concreteE, conDark: C.concreteEDark, brick: C.brick, brickDark: C.brickDark, roof: C.roofE, dark: C.grille, win: C.glassDark, lit: C.light };

function foundation(g, W, H) {
  g.box(0, W - 1, 0, H - 1, 0, 0, M.conDark);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (x % 6 === 0 || y % 6 === 0) g.set(x, y, 0, C.steelDark); // slab joints
}
// a precast-panel block: horizontal panel seams on the visible faces, a flat roof with a team edge
function block(g, x0, x1, y0, y1, z0, z1, { wall = M.con, roof = M.roof, edge = TEAM_DARK } = {}) {
  g.box(x0, x1, y0, y1, z0, z1, wall);
  for (let z = z0 + 2; z < z1; z += 3) { for (let x = x0; x <= x1; x++) g.set(x, y1, z, wall === M.brick ? M.brickDark : M.conDark); for (let y = y0; y <= y1; y++) g.set(x1, y, z, wall === M.brick ? M.brickDark : M.conDark); }
  g.box(x0, x1, y0, y1, z1, z1, roof);
  if (edge) { for (let x = x0; x <= x1; x++) { g.set(x, y0, z1, edge); g.set(x, y1, z1, edge); } for (let y = y0; y <= y1; y++) { g.set(x0, y, z1, edge); g.set(x1, y, z1, edge); } }
}
// rows of small square windows on the two visible faces
function windows(g, x0, x1, y0, y1, z, step = 3, c = M.win) {
  for (let x = x0 + 1; x < x1; x += step) g.set(x, y1, z, c);
  for (let y = y0 + 1; y < y1; y += step) g.set(x1, y, z, c);
}
function cylinder(g, cx, cy, r, z0, z1, c, rTop = r) {
  for (let z = z0; z <= z1; z++) {
    const rr = typeof r === 'function' ? r(z) : r + (rTop - r) * (z1 === z0 ? 0 : (z - z0) / (z1 - z0));
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
function hazardX(g, x0, x1, y, z) { for (let x = x0; x <= x1; x++) g.set(x, y, z, (x >> 1) % 2 ? C.hazard : M.dark); }
function hazardY(g, y0, y1, x, z) { for (let y = y0; y <= y1; y++) g.set(x, y, z, (y >> 1) % 2 ? C.hazard : M.dark); }
// a tall brick smokestack with red-and-white bands at the top (the bands take the team colour)
function stack(g, cx, cy, r, z0, z1) {
  cylinder(g, cx, cy, r, z0, z1, (x, y, z) => z > z1 - 7 ? (Math.floor((z1 - z) / 2) % 2 ? C.white : TEAM) : M.brick, r * 0.8);
  cylinder(g, cx, cy, Math.max(0.6, r * 0.8 - 1), z1, z1, C.black);
}
// a team roundel painted on a horizontal roof (seen from above)
function roofStar(g, cx, cy, z, r = 3) {
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) { const d = x * x + y * y; if (d <= r * r + 1) g.set(cx + x, cy + y, z, d <= (r - 1.5) ** 2 ? TEAM : TEAM_LIGHT); }
}
function lattice(g, x0, x1, y0, y1, z0, z1, c = C.steelDark) {
  for (let z = z0; z <= z1; z++) {
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) g.set(x, y, z, c);
    if ((z - z0) % 3 === 0) { for (let x = x0; x <= x1; x++) { g.set(x, y0, z, c); g.set(x, y1, z, c); } for (let y = y0; y <= y1; y++) { g.set(x0, y, z, c); g.set(x1, y, z, c); } }
  }
}

const B = {};      // key -> builder(up) returning a grid
const GUNS = {};   // key -> builder() for the turning weapon

// ---------- Command Center (3x3): stepped "wedding cake" tower with a starred spire ----------
B.cc = up => {
  const g = grid(); foundation(g, 48, 48);
  block(g, 3, 44, 5, 44, 1, 9);
  for (let x = 5; x <= 43; x += 4) g.box(x, x, 44, 44, 1, 8, M.conDark);   // pilasters along the front
  for (let y = 7; y <= 43; y += 4) g.box(44, 44, y, y, 1, 8, M.conDark);
  windows(g, 3, 44, 5, 44, 5, 2); windows(g, 3, 44, 5, 44, 7, 2, M.lit);
  g.box(22, 29, 44, 44, 1, 6, M.dark); hazardX(g, 22, 29, 44, 7);          // main gate
  cylinder(g, 8, 35, 4.6, 9, 9, M.dark); cylinder(g, 8, 35, 3.6, 9, 9, M.roof); // helipad
  block(g, 15, 40, 11, 38, 10, 17, { wall: M.brick });
  windows(g, 15, 40, 11, 38, 12, 2, M.lit); windows(g, 15, 40, 11, 38, 15, 2);
  g.box(26, 29, 38, 38, 10, 16, TEAM); g.box(40, 40, 23, 26, 10, 16, TEAM);  // hanging banners
  block(g, 21, 35, 17, 32, 18, 25);
  windows(g, 21, 35, 17, 32, 20, 2); windows(g, 21, 35, 17, 32, 23, 2, M.lit);
  for (let z = 26; z <= 34; z++) { const r = z < 30 ? 2 : z < 33 ? 1 : 0; g.box(28 - r, 28 + r, 24 - r, 25 + r, z, z, z % 3 ? M.conDark : M.con); } // spire
  starY(g, 28, 25, 36); starX(g, 28, 24, 36);
  for (const [x, y] of [[4, 6], [43, 6]]) g.box(x, x, y, y, 10, 13, C.steelDark); // roof aerials
  if (up) {
    block(g, 4, 13, 6, 14, 10, 13, { wall: M.conDark, roof: M.dark });     // roof flak post
    g.box(10, 14, 9, 10, 14, 14, C.gunDark); g.box(10, 14, 12, 13, 14, 14, C.gunDark);
    chevrons(g, 31, 30, 18);
  }
  return g;
};
function starY(g, x, y, z) { for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x + dx, y, z + dz, dx || dz ? TEAM : TEAM_LIGHT); }
function starX(g, x, y, z) { for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x, y + dy, z + dz, dy || dz ? TEAM : TEAM_LIGHT); }

// ---------- Power Plant (2x2): hyperboloid cooling tower, turbine hall, banded stack ----------
B.power = up => {
  const g = grid(); foundation(g, 32, 32);
  const hyper = z => 5.2 * Math.sqrt(1 + ((z - 13) / 7) ** 2);
  cylinder(g, 11, 12, hyper, 1, 19, (x, y, z) => z >= 15 && z <= 16 ? TEAM : z === 19 || z <= 2 ? M.conDark : M.con);
  cylinder(g, 11, 12, z => hyper(z) - 1.3, 3, 19, 0);
  for (const k of [...g.v.keys()]) if (g.v.get(k)[3] === 0) g.v.delete(k);
  cylinder(g, 11, 12, 4.2, 3, 3, C.black);                                  // dark interior
  for (let a = 0; a < 10; a++) { const t = a / 10 * Math.PI * 2; g.box(Math.round(11 + Math.cos(t) * 7.6), Math.round(11 + Math.cos(t) * 7.6), Math.round(12 + Math.sin(t) * 7.6), Math.round(12 + Math.sin(t) * 7.6), 1, 2, M.conDark); } // splayed legs
  block(g, 19, 30, 15, 30, 1, 9, { wall: M.brick });
  windows(g, 19, 30, 15, 30, 5, 2, M.lit);
  for (let x = 20; x <= 29; x += 3) g.box(x, x, 16, 29, 9, 9, TEAM);         // striped roof
  stack(g, 26, 6, 2.2, 1, 26);
  g.box(13, 19, 21, 22, 3, 4, C.steelDark); g.box(22, 26, 9, 10, 2, 3, C.steelDark); // pipes
  if (up) {
    stack(g, 22, 4, 1.6, 1, 21);
    for (const [x, y] of [[4, 25], [8, 25], [4, 29]]) { g.box(x, x + 2, y, y + 2, 1, 4, C.steel); g.box(x + 1, x + 1, y + 1, y + 1, 5, 7, C.white); } // transformer yard
    chevrons(g, 25, 24, 10);
  }
  return g;
};

// ---------- Ore Refinery (3x3): sawtooth brick hall, three tall silos with conical tops ----------
B.refinery = up => {
  const g = grid(); foundation(g, 48, 48);
  block(g, 2, 28, 3, 29, 1, 11, { wall: M.brick, edge: 0 });
  windows(g, 2, 28, 3, 29, 6, 3, M.lit);
  for (let x = 2; x <= 28; x++) { const k = (x - 2) % 7; for (let z = 12; z <= 12 + Math.min(4, k); z++) for (let y = 3; y <= 29; y++) g.set(x, y, z, k === 6 ? C.glassDark : z === 12 + Math.min(4, k) ? (k % 2 ? TEAM : M.roof) : M.brick); } // sawtooth roof
  const silos = up ? [8, 19, 30, 41] : [9, 21, 33];
  for (const y of silos) {
    cylinder(g, 38, y, 4.6, 1, 18, (x, yy, z) => z >= 13 && z <= 14 ? TEAM : (z % 4 === 0 ? M.conDark : M.con));
    cylinder(g, 38, y, 4.6, 19, 22, M.conDark, 0.8);
    g.set(38, y, 23, C.steelDark);
  }
  g.box(37, 39, silos[0], silos[silos.length - 1], 19, 19, C.steelDark);       // catwalk across the silo tops
  for (let i = 0; i <= 9; i++) g.box(28 + i, 28 + i, 15, 17, 4 + i, 4 + i, C.steelDark); // conveyor up to the silos
  stack(g, 5, 6, 1.8, 12, 26);
  g.box(14, 33, 33, 46, 0, 0, C.track); hazardX(g, 14, 33, 33, 1);            // ore dump apron
  for (let y = 35; y <= 45; y += 5) g.box(15, 32, y, y, 0, 0, C.hazard);
  if (up) { g.box(10, 20, 10, 20, 16, 18, M.conDark); g.box(12, 18, 12, 18, 19, 19, C.rail); chevrons(g, 8, 24, 13); }
  return g;
};

// ---------- Barracks (2x2): semi-buried bunker hall with an earth berm and a watchtower ----------
B.barracks = up => {
  const g = grid(); foundation(g, 32, 32);
  for (let z = 1; z <= 6; z++) { const i = z - 1; g.box(1 + i, 30, 2 + i, 6, z, z, C.camoDark); g.box(1 + i, 4, 2 + i, 28, z, z, C.camoDark); } // earth berms on the far sides
  block(g, 4, 28, 6, 26, 1, 8);
  for (let x = 6; x <= 26; x += 4) g.box(x, x + 1, 26, 26, 4, 4, M.dark);      // firing slits
  for (let y = 8; y <= 24; y += 4) g.box(28, 28, y, y + 1, 4, 4, M.dark);
  g.box(13, 18, 26, 26, 1, 5, M.dark); g.box(12, 19, 26, 26, 6, 6, TEAM);       // entrance with a team lintel
  for (let i = 0; i < 3; i++) g.box(12, 19, 27 + i, 27 + i, 0, 2 - i, M.con);   // steps
  for (let y = 7; y <= 25; y += 3) g.box(5, 27, y, y, 8, 8, TEAM);              // striped roof
  roofStar(g, 16, 16, 9, 3);
  lattice(g, 24, 28, 2, 6, 1, 13);                                             // watchtower
  block(g, 23, 29, 1, 7, 14, 17, { wall: C.wood, roof: M.roof });
  g.box(23, 29, 7, 7, 15, 16, M.dark);
  for (let x = 6; x <= 26; x++) g.box(x, x, 29, 30, 0, 1, (x % 2) ? C.camoDark : C.camo); // sandbags
  if (up) {
    for (let y = 9; y <= 26; y++) g.box(30, 31, y, y, 0, 2, (y % 2) ? C.camoDark : C.camo);
    g.box(23, 29, 1, 7, 18, 18, C.steel); g.box(26, 30, 4, 4, 19, 19, C.gunDark);   // armoured roof + MG on the tower
    chevrons(g, 12, 20, 9);
  }
  return g;
};

// ---------- War Factory (3x3): sawtooth hall with glazed teeth, chimneys, huge gate ----------
B.factory = up => {
  const g = grid(); foundation(g, 48, 48);
  block(g, 2, 45, 4, 44, 1, 13, { wall: M.brick, edge: 0 });
  for (let x = 4; x <= 44; x += 5) g.box(x, x, 44, 44, 1, 12, M.con);           // concrete pilasters
  for (let y = 6; y <= 43; y += 5) g.box(45, 45, y, y, 1, 12, M.con);
  windows(g, 2, 45, 4, 44, 9, 2, M.lit);
  for (let y = 4; y <= 44; y++) { const k = (y - 4) % 8; for (let z = 14; z <= 14 + Math.floor(k * 0.7); z++) for (let x = 2; x <= 45; x++) g.set(x, y, z, k === 7 ? C.glassDark : z === 14 + Math.floor(k * 0.7) ? ((y >> 3) % 2 ? TEAM : M.roof) : M.brick); } // sawtooth roof, glazing toward the viewer
  g.box(13, 34, 44, 44, 1, 10, M.dark); hazardX(g, 13, 34, 44, 11);            // vehicle gate
  for (let x = 14; x <= 33; x += 2) g.box(x, x, 44, 44, 1, 10, C.steelDark);
  for (const x of [6, 13]) stack(g, x, 7, 1.8, 14, 30);
  if (up) { block(g, 30, 42, 8, 18, 20, 23); for (const y of [10, 15]) g.box(39, 41, y, y + 1, 24, 26, C.steelDark); chevrons(g, 34, 13, 24); }
  return g;
};

// ---------- Radar (2x2): concrete block, lattice tower carrying the dish, side radome ----------
B.radar = up => {
  const g = grid(); foundation(g, 32, 32);
  block(g, 3, 28, 13, 29, 1, 7);
  windows(g, 3, 28, 13, 29, 4, 2);
  lattice(g, 13, 18, 13, 18, 8, 17);
  g.box(12, 19, 12, 19, 18, 18, C.steelDark);
  g.box(3, 28, 29, 29, 6, 6, TEAM);
  cylinder(g, 7, 7, 4.4, 1, 6, M.con); dome(g, 7, 7, 6, 4.4, C.white);
  for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; g.set(Math.round(7 + Math.cos(t) * 4.4), Math.round(7 + Math.sin(t) * 4.4), 5, TEAM); }
  return g;
};

// ---------- Airfield (3x2): concrete slab runway, earth-covered hardened shelter, tower ----------
B.airfield = up => {
  const g = grid();
  g.box(0, 47, 0, 31, 0, 0, M.con);
  for (let x = 0; x < 48; x++) for (let y = 0; y < 32; y++) if (x % 6 === 0 || y % 6 === 0) g.set(x, y, 0, M.conDark);
  for (let x = 4; x <= 42; x += 6) g.box(x, x + 3, 15, 16, 0, 0, C.white);
  g.box(2, 45, 11, 11, 0, 0, TEAM); g.box(2, 45, 20, 20, 0, 0, TEAM);
  const shelter = (x0, x1, yc) => {                                         // arched shelter along x
    for (let x = x0; x <= x1; x++) for (let y = yc - 6; y <= yc + 6; y++) for (let z = 1; z <= 8; z++) {
      const r = Math.sqrt(((y - yc) / 6.5) ** 2 + ((z - 1) / 8) ** 2);
      if (r <= 1) g.set(x, y, z, r > 0.8 ? (x === x1 ? M.conDark : C.camoDark) : 0);
    }
    for (const k of [...g.v.keys()]) if (g.v.get(k)[3] === 0) g.v.delete(k);
    for (let y = yc - 4; y <= yc + 4; y++) for (let z = 1; z <= 6; z++) if (((y - yc) / 6.5) ** 2 + ((z - 1) / 8) ** 2 <= 0.62) g.set(x1, y, z, M.dark);
    for (let y = yc - 5; y <= yc + 5; y++) g.set(x1, y, 7, TEAM);
  };
  shelter(31, 46, 6);
  if (up) shelter(31, 46, 26);
  block(g, 2, 8, 2, 8, 1, 10);                                              // control tower
  g.box(1, 9, 1, 9, 11, 12, C.glass); g.box(1, 9, 1, 9, 13, 13, TEAM);
  g.box(5, 5, 5, 5, 14, 18, C.steelDark);
  // parked twin-tail fighter
  for (let x = 8; x <= 26; x++) { const h = x > 23 ? 0 : 1; g.box(x, x, 16 - h, 16 + h, 1, 2, C.jetBlue); }
  for (let x = 11; x <= 20; x++) { const s = Math.round((20 - x) * 0.7); g.box(x, x, 13 - s, 19 + s, 1, 1, C.jetGrey); }
  for (const y of [13, 19]) g.box(8, 10, y, y, 2, 5, TEAM);
  g.box(21, 23, 16, 16, 3, 3, C.glassDark);
  if (up) chevrons(g, 5, 5, 14);
  return g;
};

// ---------- Tech Center (2x2): finned brutalist institute with an observatory sphere ----------
B.tech = up => {
  const g = grid(); foundation(g, 32, 32);
  block(g, 3, 28, 6, 28, 1, 10);
  for (let x = 5; x <= 27; x += 3) g.box(x, x, 28, 28, 1, 9, M.conDark);      // vertical fins
  for (let y = 8; y <= 27; y += 3) g.box(28, 28, y, y, 1, 9, M.conDark);
  for (const z of [4, 7]) windows(g, 3, 28, 6, 28, z, 3, C.glass);
  cylinder(g, 18, 17, 5, 10, 11, M.conDark);
  dome(g, 18, 17, 9, 6.2, (x, y, z) => z === 12 ? TEAM : M.con);
  g.box(18, 23, 17, 17, 14, 15, M.dark);                                      // telescope slit
  lattice(g, 5, 8, 8, 11, 11, 21);
  g.box(6, 7, 9, 10, 22, 22, C.red);
  return g;
};

// ---------- Orbital Lance (China, 3x3): stepped concrete base, lattice-held dish and emitter ----------
B.super_lance = up => {
  const g = grid(); foundation(g, 48, 48);
  block(g, 3, 44, 5, 44, 1, 5); block(g, 8, 40, 10, 40, 6, 8, { wall: M.brick });
  g.box(5, 42, 44, 44, 3, 4, TEAM);
  cylinder(g, 24, 25, 6.5, 8, 11, M.con, 15);
  cylinder(g, 24, 25, 12, 11, 11, M.conDark);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const x = Math.round(24 + Math.cos(a) * 10), y = Math.round(25 + Math.sin(a) * 10); g.box(x, x, y, y, 11, 21, C.steelDark); }
  cylinder(g, 24, 25, 1.4, 11, 22, C.steelDark);
  cylinder(g, 24, 25, 2, 22, 24, C.rail);
  for (const [x, y] of [[6, 8], [41, 8]]) stack(g, x, y, 1.6, 6, 18);
  return g;
};

// ======== defences ========
const pill = (g, r, z1, wall = M.con) => {               // octagonal concrete pillbox, slits facing out
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
    if (dx > r || dy > r || dx + dy > r * 1.35) continue;
    for (let z = 0; z <= z1; z++) g.set(x, y, z, z === z1 ? M.conDark : wall);
    if ((dx + dy > r * 1.35 - 1.2 || dx > r - 1 || dy > r - 1) && z1 >= 3 && (x + y) % 3 === 0) g.set(x, y, z1 - 1, M.dark);
  }
};
B.turret = up => { const g = grid(); pill(g, 6.5, 3); return g; };
GUNS.turret = () => {
  const t = grid(), O = 4;
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = 0; z <= 2; z++) if (!(x === 3 && z === 2)) t.set(O + x, O + y, z, z === 2 ? TEAM_LIGHT : TEAM);
  for (const y of [O - 1, O + 1]) { t.box(O + 3, O + 10, y, y, 1, 1, C.gunDark); t.box(O + 10, O + 10, y, y, 1, 1, C.gun); }
  t.box(O - 2, O - 1, O + 1, O + 2, 3, 3, C.steelDark);
  return t;
};
B.railturret = up => { const g = grid(); pill(g, 7, 4, M.brick); g.box(2, 13, 13, 13, 1, 1, C.hazard); return g; };
GUNS.railturret = () => {
  const t = grid(), O = 5;
  t.box(O - 4, O + 2, O - 3, O + 3, 0, 3, TEAM); t.box(O - 3, O + 1, O - 2, O + 2, 4, 4, TEAM_LIGHT);
  for (let x = O + 2; x <= O + 13; x++) for (let y = O - 1; y <= O + 1; y++) for (let z = 0; z <= 2; z++) if (Math.abs(y - O) === 1 || z !== 1) t.set(x, y, z, x % 3 === 0 ? C.rail : C.steelDark);
  t.box(O + 2, O + 13, O, O, 1, 1, C.gunDark);
  return t;
};
B.sam = up => {
  const g = grid();
  g.box(1, 14, 1, 14, 0, 0, M.conDark); hazardX(g, 1, 14, 14, 1);
  cylinder(g, 8, 8, 3, 1, 2, M.con);
  g.box(1, 4, 10, 14, 1, 4, C.camoDark); g.box(1, 4, 10, 14, 5, 5, TEAM);     // launch control cabin
  return g;
};
GUNS.sam = () => {
  const t = grid(), O = 5;
  t.box(O - 4, O + 3, O - 4, O + 4, 0, 1, TEAM);
  for (const y of [O - 3, O - 1, O + 1, O + 3]) for (let i = 0; i <= 8; i++) t.box(O - 4 + i, O - 4 + i, y, y, 2 + Math.floor(i * 0.6), 3 + Math.floor(i * 0.6), i === 8 ? M.dark : C.olive); // four raised canisters
  t.box(O - 5, O - 4, O - 4, O + 4, 1, 3, C.steelDark);
  return t;
};
B.mortar = up => {
  const g = grid();
  cylinder(g, 8, 8, 7, 0, 3, M.con); cylinder(g, 8, 8, 5.2, 1, 3, 0);
  for (const k of [...g.v.keys()]) if (g.v.get(k)[3] === 0) g.v.delete(k);
  cylinder(g, 8, 8, 5.2, 0, 0, M.conDark);
  for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; g.set(Math.round(8 + Math.cos(t) * 7), Math.round(8 + Math.sin(t) * 7), 3, a % 2 ? TEAM_DARK : M.conDark); }
  for (const [x, y] of [[3, 11], [4, 12], [3, 12]]) g.box(x, x, y, y, 1, 2, C.wood); // ammo crates
  return g;
};
GUNS.mortar = () => {
  const t = grid(), O = 4;
  t.box(O - 2, O + 2, O - 2, O + 2, 0, 0, C.steelDark);
  for (let i = 0; i <= 7; i++) t.box(O + i - 1, O + i, O - (i < 2 ? 1 : 0), O, 1 + i, 1 + i, i === 7 ? C.gunDark : C.gun); // heavy 120 mm tube
  for (const y of [O - 3, O + 3]) { t.box(O + 1, O + 2, y, y, 0, 2, C.rubber); t.set(O + 1, y, 1, C.hub); } // carriage wheels
  t.set(O - 2, O + 2, 1, TEAM); t.set(O - 2, O - 2, 1, TEAM); t.box(O - 2, O - 2, O - 1, O + 1, 1, 1, TEAM);
  return t;
};
B.sensor = up => {
  const g = grid();
  g.box(2, 13, 2, 13, 0, 0, M.conDark);
  for (let z = 1; z <= 20; z++) { const r = z < 8 ? 3 : z < 15 ? 2 : 2; g.box(8 - r, 7 + r, 8 - r, 7 + r, z, z, z === 18 ? TEAM : z % 4 === 0 ? M.conDark : M.con); } // concrete shaft
  g.box(4, 11, 4, 11, 21, 21, TEAM_DARK);
  dome(g, 7.5, 7.5, 22, 4, C.white);
  for (const [x, y] of [[11, 3], [3, 11]]) g.box(x, x + 1, y, y + 1, 1, 3, M.brick);
  return g;
};
B.wall = up => {
  const g = grid();
  g.box(0, 15, 0, 15, 0, 6, M.con);
  for (let x = 0; x <= 15; x += 5) for (let z = 1; z <= 6; z++) { g.set(x, 15, z, M.conDark); g.set(15, x, z, M.conDark); }
  for (let z = 2; z <= 6; z += 2) for (let x = 0; x <= 15; x++) { g.set(x, 15, z, (x + z) % 5 ? M.con : M.conDark); }
  g.box(0, 15, 0, 15, 7, 7, M.brick);
  g.box(1, 14, 1, 14, 7, 7, M.brickDark);
  g.box(6, 9, 6, 9, 7, 7, TEAM);
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) g.box(x, x, y, y, 8, 8, C.steelDark); // rebar stubs
  return g;
};

// ---------- Ore Drill (2x2): striped A-frame derrick, brick pump house, concrete hopper ----------
B.drill = up => {
  const g = grid(); foundation(g, 32, 32);
  block(g, 2, 13, 18, 29, 1, 8, { wall: M.brick });
  windows(g, 2, 13, 18, 29, 5, 3, M.lit);
  cylinder(g, 23, 22, 6, 1, 7, M.con, 4); cylinder(g, 23, 22, 3.5, 7, 8, C.ore);
  for (let z = 1; z <= 26; z++) {                                            // A-frame derrick, red and white
    const k = Math.round((z - 1) / 26 * 5);
    const c = Math.floor(z / 3) % 2 ? C.white : C.red;
    for (const [x, y] of [[4 + k, 10], [16 - k, 10]]) g.set(x, y, z, c);
    if (z % 6 === 0) for (let i = 4 + k; i <= 16 - k; i++) g.set(i, 10, z, C.steelDark);
  }
  g.box(8, 12, 8, 12, 27, 28, M.conDark);
  g.box(9, 11, 9, 11, 1, 3, C.steelDark);
  g.box(12, 18, 10, 11, 2, 2, C.steel); g.box(18, 19, 10, 18, 2, 2, C.steel);
  if (up) { block(g, 21, 29, 2, 8, 1, 6, { wall: M.con }); stack(g, 27, 4, 1.2, 7, 15); chevrons(g, 23, 5, 7); }
  return g;
};

// ---------- Naval Shipyard (3x3): concrete piers, hammerhead crane, brick control block ----------
B.shipyard = up => {
  const g = grid();
  const pier = (y0, y1) => {
    g.box(1, 46, y0, y1, 0, 2, M.conDark); g.box(1, 46, y0, y1, 3, 3, M.con);
    for (let x = 2; x <= 45; x += 5) g.set(x, y1, 3, C.hazard);
    for (let x = 4; x <= 44; x += 8) g.box(x, x, y0, y0, 0, 1, C.rubber);
  };
  pier(1, 12); pier(35, 46);
  g.box(1, 4, 13, 34, 0, 2, M.conDark); g.box(1, 4, 13, 34, 3, 3, M.con);
  g.box(5, 5, 14, 33, 1, 2, C.hazard);
  block(g, 30, 44, 37, 45, 4, 12, { wall: M.brick });
  windows(g, 30, 44, 37, 45, 9, 2, M.lit);
  roofStar(g, 37, 41, 13, 3);
  const crane = (x, y, dir) => {                                             // hammerhead crane: tower + jib over the slip
    lattice(g, x - 1, x + 1, y - 1, y + 1, 4, 24, C.red);
    for (let i = -6; i <= 22; i++) g.set(x, y + dir * i, 25, i < 0 ? C.concreteEDark : (i >> 1) % 2 ? C.red : C.white);
    g.box(x - 1, x + 1, y - dir * 6, y - dir * 4, 23, 25, M.conDark);          // counterweight
    g.box(x, x, y + dir * 16, y + dir * 16, 14, 24, C.black);
    g.box(x - 1, x + 1, y + dir * 16, y + dir * 16, 13, 13, C.hazard);
    g.box(x - 1, x + 1, y - 1, y + 1, 26, 26, TEAM_DARK);
  };
  crane(22, 9, 1);
  if (up) { crane(36, 38, -1); chevrons(g, 34, 41, 14); }
  for (const [x, c] of [[8, C.red], [12, C.olive]]) g.box(x, x + 3, 3, 9, 4, 6, c);
  for (let x = 8; x <= 44; x += 9) { g.set(x, 12, 4, C.black); g.set(x, 35, 4, C.black); }
  g.set(46, 12, 4, C.light); g.set(46, 35, 4, C.light);
  return g;
};

// ======== write the structures ========
const DEF_SIZE = { turret: 1, railturret: 1, sam: 1, mortar: 1, sensor: 1 };
const KIT_UP = ['power', 'refinery', 'barracks', 'factory', 'airfield', 'shipyard', 'drill'];
for (const [key, build] of Object.entries(B)) {
  if (!want(key)) continue;
  writeVox(`b_${key}_ax.vox`, build(false));
  if (KIT_UP.includes(key)) writeVox(`b_${key}_ax_up.vox`, build(true));
  if (DEF_SIZE[key]) writeVox(`b_${key}_ax_up.vox`, defenseKit(build(false), DEF_SIZE[key] * 16, DEF_SIZE[key] * 16));
  if (GUNS[key]) { writeVox(`b_${key}_ax_gun.vox`, GUNS[key]()); writeVox(`b_${key}_ax_up_gun.vox`, gunKit(GUNS[key]())); }
}

// ======== Axis-only models: repaint in the Axis camouflage and materials ========
// vehicles: the soft camouflage blobs become splinter bands; ships: darker hulls and red decks;
// structures: warm concrete instead of cool grey panels
const isCamo = c => c === C.camo || c === C.camoDark || c === C.camoLight;
const SHIP = { [C.hull]: C.hullE, [C.hullDark]: C.hullEDark, [C.deck]: C.deckE, [C.deckLight]: C.deckE };
const BLD = { [C.jetGrey]: C.concreteE, [C.jetDark]: C.concreteEDark };
function repaint(file, f) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) return;
  const g = readVox(file);
  for (const e of g.v.values()) e[3] = f(e[0], e[1], e[2], e[3]);
  writeVox(file, g);
}
if (want('repaint')) {
  const camoFiles = ['titan_hull', 'titan_turret', 'flak_hull', 'flak_turret', 'tos_hull', 'tos_turret', 'iskander_hull', 'iskander_turret', 'demotruck', 'minelayer', 'kirov'];
  for (const n of camoFiles) for (const s of ['', '_up']) repaint(`${n}${s}.vox`, (x, y, z, c) => isCamo(c) ? camoEast(x, y, z, n.length) : c);
  for (const n of ['battleship_hull', 'battleship_turret']) repaint(`${n}.vox`, (x, y, z, c) => SHIP[c] || c);
  for (const n of ['b_flametower', 'b_super_silo', 'b_super_silo_open', 'b_krasukha', 'b_propaganda', 'b_koksan', 'b_hub', 'b_flametower_up', 'b_koksan_up'])
    repaint(`${n}.vox`, (x, y, z, c) => BLD[c] || (c === C.white && z === 0 ? C.concreteEDark : c));
}
