// Upgraded looks: reads the finished .vox models from assets/voxels/ and writes an "_up" copy of
// each with the upgrade kit bolted on, so run it after the other voxel scripts.
//
//   node voxel_upgrades.js
//
// Vehicles get explosive reactive armour bricks (Reactive Armor research), soldiers plate
// carriers, shoulder guards and helmet brims (Ballistic Armor research), structures their Mk II
// fit-out. Vehicle kits grow the model by a voxel on every side, so their copies are shifted one
// voxel along x and y; render.js moves the pivots to match.
'use strict';
const fs = require('fs');
const path = require('path');
const { C, TEAM, TEAM_LIGHT, TEAM_DARK, grid, writeVox } = require('./voxel_lib');

const DIR = path.join(__dirname, '..', '..', 'assets', 'voxels');

function readVox(name) {
  const buf = fs.readFileSync(path.join(DIR, name)), g = grid();
  let p = 20; // past the header and the MAIN chunk header
  while (p < buf.length) {
    const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4), m = buf.readUInt32LE(p + 8), c = p + 12;
    if (id === 'XYZI') {
      const k = buf.readUInt32LE(c);
      for (let i = 0; i < k; i++) g.set(buf[c + 4 + i * 4], buf[c + 5 + i * 4], buf[c + 6 + i * 4], buf[c + 7 + i * 4]);
    }
    p = c + n + m;
  }
  return g;
}

function shifted(g, dx, dy) {
  const o = grid();
  for (const [x, y, z, c] of g.v.values()) o.set(x + dx, y + dy, z, c);
  return o;
}

const isCamo = c => c === C.camo || c === C.camoDark || c === C.camoLight;
const isTeam = c => c >= 1 && c <= 8;

// ---------- reactive armour ----------
// A layer of bricks on the camouflaged sides and front of a hull or turret (from zMin up), and
// on the top of its front half when top is set. The bricks are bare steel with dark seams
// between them, so they stand out from the camouflage and read as separate blocks.
function era(g, { zMin = 2, top = false, belt = 3 } = {}) {
  const vox = [...g.v.values()];
  const camo = vox.filter(v => isCamo(v[3]));
  if (!camo.length) return g;
  const zTop = Math.max(...camo.map(v => v[2]));
  const xs = camo.map(v => v[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const add = [];
  const brick = (x, y, z, along, up) => add.push([x, y, z, along % 3 === 0 || (up % 3 === 2) ? C.grille : C.steel]);
  for (const [x, y, z, c] of camo) {
    if (z < Math.max(zMin, zTop - belt)) continue;
    for (const dy of [-1, 1]) if (!g.get(x, y + dy, z)) brick(x, y + dy, z, x, zTop - z);
    if (!g.get(x + 1, y, z) && x > (x0 + x1) / 2) brick(x + 1, y, z, y, zTop - z);
  }
  if (top) {
    for (const [x, y, z] of camo) {
      if (z !== zTop || g.get(x, y, z + 1) || x <= (x0 + x1) / 2) continue;
      if (x % 3 === 0 || y % 3 === 0) continue; // checkered tiles with gaps
      add.push([x, y, z + 1, C.steel]);
    }
  }
  for (const [x, y, z, c] of add) if (!g.get(x, y, z)) g.set(x, y, z, c);
  return g;
}

// ---------- body armour for soldiers (see soldier() in voxel_units.js; Y = 3) ----------
function vest(g) {
  const Y = 3, helmet = g.get(1, Y, 12) || C.camoDark;
  for (let y = Y - 1; y <= Y + 1; y++) for (let z = 7; z <= 9; z++) if (!g.get(5, y, z)) g.set(5, y, z, C.olive); // chest plate
  g.set(5, Y, 8, C.steelDark);                                                                         // pouch
  for (const y of [Y - 3, Y + 3]) for (let x = 2; x <= 3; x++) for (let z = 9; z <= 10; z++) if (!g.get(x, y, z)) g.set(x, y, z, C.olive); // shoulder guards
  for (let x = 0; x <= 5; x++) for (let y = Y - 2; y <= Y + 2; y++) if (!g.get(x, y, 12)) g.set(x, y, 12, helmet); // helmet brim
  g.set(4, Y, 14, helmet); g.box(2, 3, Y - 1, Y + 1, 14, 14, helmet);                                     // higher crown
  return g;
}

// ---------- Mk II structures ----------
const M = { concrete: C.white, concreteDark: C.steel, wall: C.jetGrey, wallDark: C.jetDark, roof: C.wheel, dark: C.grille };
function cylinder(g, cx, cy, r, z0, z1, c) {
  for (let z = z0; z <= z1; z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  }
}
function block(g, x0, x1, y0, y1, z0, z1, wall = M.wall, roof = TEAM) { g.box(x0, x1, y0, y1, z0, z1, wall); g.box(x0, x1, y0, y1, z1, z1, roof); }
function chevrons(g, x, y, z) { // the Mk II mark: two gold chevrons on a roof, pointing at the viewer
  for (const k of [0, 3]) for (let i = -2; i <= 2; i++) g.set(x + k - Math.abs(i), y + i, z, C.hazard);
}

// armoured skirt for a defence: steel plating round the foot of the base, a concrete post at
// each corner of the footprint and the chevrons on top
function defenseKit(g, W, H) {
  const add = [];
  for (const [x, y, z] of g.v.values()) {
    if (z > 2) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || g.get(nx, ny, z)) continue;
      add.push([nx, ny, z]);
    }
  }
  for (const [x, y, z] of add) g.set(x, y, z, z === 2 ? C.steel : C.steelDark);
  for (const [x, y] of [[0, 0], [W - 2, 0], [0, H - 2], [W - 2, H - 2]]) { g.box(x, x + 1, y, y + 1, 0, 4, M.concrete); g.box(x, x + 1, y, y + 1, 5, 5, C.hazard); }
  return g;
}
// a defence's turning weapon: steel cheek plates on its team-coloured housing and a gold stripe
function gunKit(g) {
  const vox = [...g.v.values()].filter(v => isTeam(v[3]));
  if (!vox.length) return g;
  const zs = vox.map(v => v[2]), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const add = [];
  for (const [x, y, z] of vox) for (const dy of [-1, 1]) if (!g.get(x, y + dy, z) && y + dy >= 0) add.push([x, y + dy, z, z === z1 ? C.hazard : (x + z) % 3 ? C.steel : C.steelDark]);
  for (const [x, y, z, c] of add) if (!g.get(x, y, z)) g.set(x, y, z, c);
  for (const [x, y, z] of vox) if (z === z1 && !g.get(x, y, z + 1) && (x + y) % 2 === 0) g.set(x, y, z + 1, C.steelDark);
  return g;
}

const BUILDING_KITS = {
  // a second cooling stack and a turbine module on the hall roof
  power(g) {
    cylinder(g, 27, 13, 2.2, 1, 19, (x, y, z) => Math.floor((z - 1) / 4.5) % 2 ? M.concrete : TEAM);
    block(g, 5, 14, 20, 27, 6, 9, M.wallDark, M.dark);
    for (let x = 6; x <= 13; x += 3) g.box(x, x + 1, 21, 26, 9, 9, C.steel);           // fan housings
    g.box(15, 26, 22, 25, 6, 6, C.rail);                                             // glowing coolant run
    chevrons(g, 18, 23, 7);
  },
  // an ore purifier on the roof and a third silo by the apron
  refinery(g) {
    cylinder(g, 15, 16, 4.5, 12, 16, M.wallDark); cylinder(g, 15, 16, 3, 17, 17, C.rail);
    for (const [x, y] of [[22, 8], [24, 8], [22, 24]]) g.box(x, x, y, y, 12, 19, C.steel);         // vents
    cylinder(g, 40, 41, 4.2, 1, 12, (x, y, z) => z >= 8 && z <= 9 ? TEAM : C.hub); cylinder(g, 40, 41, 3, 13, 13, C.ore);
    chevrons(g, 8, 24, 12);
  },
  // a watchtower, a roof aerial and extra sandbag lines
  barracks(g) {
    for (const [x, y] of [[27, 1], [30, 1], [27, 4], [30, 4]]) g.box(x, x, y, y, 1, 13, M.wallDark);
    block(g, 26, 31, 0, 5, 14, 16, M.wall, TEAM);
    g.box(26, 31, 0, 5, 14, 14, M.dark);
    g.box(6, 6, 16, 16, 13, 22, C.steelDark);
    for (let y = 8; y <= 25; y++) g.box(31, 31, y, y, 0, 1, (y % 2) ? C.camoDark : C.camo);
    chevrons(g, 14, 16, 14);
  },
  // a roof annex with exhaust stacks and a second crane
  factory(g) {
    block(g, 28, 42, 12, 26, 16, 20, M.wall, TEAM);
    for (const y of [30, 36]) cylinder(g, 40, y, 1.6, 16, 24, M.wallDark);
    g.box(5, 6, 38, 39, 16, 21, C.hazard); g.box(5, 26, 38, 39, 21, 22, C.hazard);
    chevrons(g, 33, 19, 21);
  },
  // a hangar beside the runway and a radar mast on the control tower
  airfield(g) {
    block(g, 4, 22, 24, 30, 1, 7, M.wall, TEAM);
    for (let x = 4; x <= 22; x++) g.set(x, 30, 8, M.wallDark);
    g.box(8, 18, 30, 30, 1, 5, M.dark);
    g.box(41, 41, 5, 5, 16, 22, C.steel); g.box(39, 43, 5, 5, 22, 22, C.white);
    chevrons(g, 10, 27, 8);
  },
  // a second gantry over the slip and a fuel tank on the near pier
  shipyard(g) {
    for (const y of [8, 39]) g.box(34, 35, y, y + 1, 4, 18, C.hazard);
    g.box(34, 35, 8, 40, 18, 20, C.hazard); g.box(34, 35, 8, 40, 21, 21, TEAM_DARK);
    cylinder(g, 20, 41, 3.5, 4, 10, M.concrete); cylinder(g, 20, 41, 3.5, 11, 11, TEAM);
    chevrons(g, 34, 41, 13);
  },
  // a generator shed with an exhaust stack
  drill(g) {
    block(g, 21, 29, 2, 8, 1, 6, M.wall, TEAM);
    cylinder(g, 27, 4, 1.2, 7, 14, M.wallDark);
    g.box(19, 20, 5, 6, 2, 2, C.steel);
    chevrons(g, 23, 5, 7);
  },
};
// defences with a turning weapon (their bases get the skirt, their guns the plating)
const DEFENSES = { turret: 1, railturret: 1, sam: 1, laser: 1, mortar: 1, missilenest: 1, flametower: 1, thaad: 2, koksan: 2, sensor: 1 };

module.exports = { readVox, shifted, era, vest, defenseKit, gunKit, chevrons };
if (require.main !== module) return;

// ---------- write everything ----------
const VEHICLES = {
  tank: ['tank_hull', 'tank_turret'], ifv: ['ifv_hull', 'ifv_turret'], mlrs: ['mlrs_hull', 'mlrs_turret'],
  railtank: ['railtank_hull', 'railtank_turret'], titan: ['titan_hull', 'titan_turret'], flak: ['flak_hull', 'flak_turret'],
  tos: ['tos_hull', 'tos_turret'], iskander: ['iskander_hull', 'iskander_turret'], aegis: ['aegis_hull', 'aegis_turret'],
  raijin: ['raijin_hull', 'raijin_turret'], recovery: ['recovery_hull', 'recovery_turret'], phantom: ['phantom_hull', 'phantom_turret'],
  demotruck: ['demotruck'], minelayer: ['minelayer'],
};
for (const [hull, turret] of Object.values(VEHICLES)) {
  writeVox(hull + '_up.vox', era(shifted(readVox(hull + '.vox'), 1, 1), { zMin: 2, top: !turret }));
  if (turret) writeVox(turret + '_up.vox', era(shifted(readVox(turret + '.vox'), 1, 1), { zMin: 0, top: true, belt: 4 }));
}
for (const kind of ['rifle', 'rocket', 'engineer', 'sniper', 'shock', 'sas', 'hacker', 'medic']) {
  for (let f = 0; f < 3; f++) writeVox(`${kind}_${f}_up.vox`, vest(readVox(`${kind}_${f}.vox`)));
}
for (const [key, kit] of Object.entries(BUILDING_KITS)) { const g = readVox(`b_${key}.vox`); kit(g); writeVox(`b_${key}_up.vox`, g); }
for (const [key, n] of Object.entries(DEFENSES)) {
  writeVox(`b_${key}_up.vox`, defenseKit(readVox(`b_${key}.vox`), n * 16, n * 16));
  if (fs.existsSync(path.join(DIR, `b_${key}_gun.vox`))) writeVox(`b_${key}_up_gun.vox`, gunKit(readVox(`b_${key}_gun.vox`)));
}
