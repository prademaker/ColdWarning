// Shared helpers for the game's voxel models: palette, camouflage, voxel grids and the
// MagicaVoxel .vox writer.
//
// Palette convention used by render.js: indices 1-8 are the TEAM COLOUR ramp (stored as
// greys so they read well in an editor); the game recolours them per player.
// Indices 9-11 are CAMOUFLAGE (stored as neutral greys); the game paints them in the faction's colours.
'use strict';
const fs = require('fs');
const path = require('path');

const PALETTE = [];
for (let i = 0; i < 8; i++) { const v = 70 + i * 22; PALETTE.push([v, v, v]); } // 1-8 team ramp
const C = {}; // named colours -> palette index
function col(name, rgb) { PALETTE.push(rgb); C[name] = PALETTE.length; }
col('camo', [214, 214, 214]); col('camoDark', [150, 150, 150]); col('camoLight', [246, 246, 246]); // 9-11, neutral: painted per faction
col('track', [44, 44, 40]); col('link', [64, 63, 57]); col('wheel', [96, 94, 86]); col('hub', [140, 136, 122]);
col('steel', [92, 96, 92]); col('steelDark', [58, 60, 58]); col('grille', [40, 42, 40]);
col('gun', [74, 76, 72]); col('gunDark', [44, 46, 44]); col('light', [255, 236, 160]);
col('glass', [90, 160, 210]); col('olive', [104, 110, 74]);
// added for the full roster (appended so earlier indices never move)
col('rubber', [32, 32, 30]); col('skin', [198, 160, 124]); col('ore', [226, 176, 62]); col('oreDark', [168, 120, 34]);
col('hazard', [214, 172, 44]); col('glassDark', [40, 74, 104]); col('rail', [96, 232, 255]); col('jetGrey', [150, 157, 164]);
col('jetDark', [104, 110, 118]); col('vest', [222, 182, 46]); col('flame', [255, 168, 64]); col('white', [228, 230, 228]);
col('red', [190, 40, 34]);
const TEAM = 6, TEAM_LIGHT = 7, TEAM_DARK = 4;

// three-tone camouflage: soft blobs in 3D so the pattern wraps over edges
const BLOBS = Array.from({ length: 40 }, (_, i) => {
  const r = Math.sin(i * 12.9898) * 43758.5453, f = n => (Math.sin(r * (n + 1)) * 0.5 + 0.5);
  return [f(1) * 40 - 2, f(2) * 28 - 2, f(3) * 14, 2.2 + f(4) * 2.6, i % 3 === 0 ? 'camoLight' : 'camoDark'];
});
function camoAt(x, y, z, shift = 0) {
  for (const [bx, by, bz, r, c] of BLOBS) {
    const dx = x - bx - shift, dy = y - by, dz = (z - bz) * 0.6;
    if (dx * dx + dy * dy + dz * dz < r * r) return C[c];
  }
  return C.camo;
}

function grid() {
  const v = new Map();
  return {
    v,
    set(x, y, z, c) { if (x >= 0 && y >= 0 && z >= 0) v.set(`${x},${y},${z}`, [x, y, z, c]); },
    get(x, y, z) { const e = v.get(`${x},${y},${z}`); return e ? e[3] : 0; },
    del(x, y, z) { v.delete(`${x},${y},${z}`); },
    box(x0, x1, y0, y1, z0, z1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, c); },
    // box painted with camouflage (seed shifts the pattern between models)
    camo(x0, x1, y0, y1, z0, z1, seed = 0) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, camoAt(x, y, z, seed)); },
    clear(x0, x1, y0, y1, z0, z1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.del(x, y, z); },
    // recolour the outer ring of a horizontal layer (team bands)
    band(z, c) { for (const e of this.v.values()) if (e[2] === z && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !this.v.has(`${e[0] + dx},${e[1] + dy},${z}`))) e[3] = c; },
  };
}

function chunk(id, content, children = Buffer.alloc(0)) {
  const h = Buffer.alloc(12);
  h.write(id, 0, 'ascii'); h.writeUInt32LE(content.length, 4); h.writeUInt32LE(children.length, 8);
  return Buffer.concat([h, content, children]);
}

const OUT = path.join(__dirname, '..', '..', 'assets', 'voxels');
function writeVox(name, g) {
  const vox = [...g.v.values()];
  const sx = Math.max(...vox.map(v => v[0])) + 1, sy = Math.max(...vox.map(v => v[1])) + 1, sz = Math.max(...vox.map(v => v[2])) + 1;
  const size = Buffer.alloc(12); size.writeUInt32LE(sx, 0); size.writeUInt32LE(sy, 4); size.writeUInt32LE(sz, 8);
  const xyzi = Buffer.alloc(4 + vox.length * 4);
  xyzi.writeUInt32LE(vox.length, 0);
  vox.forEach(([x, y, z, c], i) => { xyzi[4 + i * 4] = x; xyzi[5 + i * 4] = y; xyzi[6 + i * 4] = z; xyzi[7 + i * 4] = c; });
  const rgba = Buffer.alloc(256 * 4);
  PALETTE.forEach(([r, g2, b], i) => { rgba[i * 4] = r; rgba[i * 4 + 1] = g2; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255; });
  const children = Buffer.concat([chunk('SIZE', size), chunk('XYZI', xyzi), chunk('RGBA', rgba)]);
  const head = Buffer.alloc(8); head.write('VOX ', 0, 'ascii'); head.writeUInt32LE(150, 4);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([head, chunk('MAIN', Buffer.alloc(0), children)]));
  console.log('wrote', name, `${sx}x${sy}x${sz}`, vox.length, 'voxels');
}

module.exports = { PALETTE, C, TEAM, TEAM_LIGHT, TEAM_DARK, camoAt, grid, writeVox };
