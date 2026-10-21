// Renders 3D models (glTF/.glb) into isometric sprite sheets for the game.
//
//   cd tools/sprites && npm install
//   node render.js /path/to/Separate_Assets_glb
//
// The model files themselves are not part of this repository (their licence forbids
// redistribution); only the rendered sheets in assets/sprites/ are.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Which model plays which unit. k = game pixels per model unit (sets the on-screen size).
// mask: per-material rule for the paintable area ('paint' = coloured body panels,
// 'dark' = dark grey bodies, 'all' = everything).
const MODELS = {
  tank: { file: 'Tank_006.glb', k: 3.6, cell: 112, turret: 'Tank_tower_006', mask: { Picture_2: 'all', Color: 'paint' } },
  ifv: { file: 'Hummer_003.glb', k: 6.4, cell: 88, mask: { Color: 'paint' } },
  // RA2-style voxel tank made for this game (tools/sprites/voxel_tank.js)
  tank_vox: { vox: { hull: 'tank_hull.vox', turret: 'tank_turret.vox' }, pivot: [15.5, 10], turretPivot: [8.5, 8.5], mount: [14, 10, 8], turret: 'turret', k: 1.0, cell: 104 },
  // the rest of the voxel roster (tools/sprites/voxel_units.js)
  ifv_vox: { vox: { hull: 'ifv_hull.vox', turret: 'ifv_turret.vox' }, pivot: [13, 8], turretPivot: [6.5, 6.5], mount: [13, 8, 9], turret: 'turret', k: 1.0, cell: 60 },
  mlrs_vox: { vox: { hull: 'mlrs_hull.vox', turret: 'mlrs_turret.vox' }, pivot: [14, 7], turretPivot: [9.5, 9.5], mount: [10, 7, 6], turret: 'turret', k: 1.0, cell: 64 },
  railtank_vox: { vox: { hull: 'railtank_hull.vox', turret: 'railtank_turret.vox' }, pivot: [15.5, 10], turretPivot: [8.5, 8.5], mount: [14, 10, 7], turret: 'turret', k: 1.0, cell: 80 },
  titan_vox: { vox: { hull: 'titan_hull.vox', turret: 'titan_turret.vox' }, pivot: [19, 14], turretPivot: [10.5, 10.5], mount: [17, 14, 10], turret: 'turret', k: 1.0, cell: 96 },
  harvester_vox: { vox: { hull: 'harvester.vox' }, pivot: [17, 11], k: 1.0, cell: 72 },
  harvester_vox_full: { vox: { hull: 'harvester_full.vox' }, pivot: [17, 11], k: 1.0, cell: 72 },
  mcv_vox: { vox: { hull: 'mcv.vox' }, pivot: [18, 11], k: 1.0, cell: 84, anchor: 0.72 },
  heli_vox: { vox: { hull: 'heli.vox' }, pivot: [17.5, 9.5], k: 1.05, cell: 72, rotor: { z: 11.5, r: 17 } },
  jet_vox: { vox: { hull: 'jet.vox' }, pivot: [16, 12.5], k: 1.0, cell: 72 },
  // bloc and nation specials
  flak_vox: { vox: { hull: 'flak_hull.vox', turret: 'flak_turret.vox' }, pivot: [13.5, 8.5], turretPivot: [7, 7], mount: [12, 8.5, 8], turret: 'turret', k: 1.0, cell: 64 },
  tos_vox: { vox: { hull: 'tos_hull.vox', turret: 'tos_turret.vox' }, pivot: [16, 10.5], turretPivot: [9, 10], mount: [13, 10.5, 8], turret: 'turret', k: 1.0, cell: 80 },
  iskander_vox: { vox: { hull: 'iskander_hull.vox', turret: 'iskander_turret.vox' }, pivot: [17, 7.5], turretPivot: [13, 4], mount: [13, 7.5, 7], turret: 'turret', k: 1.0, cell: 88 },
  drone_vox: { vox: { hull: 'drone.vox' }, pivot: [11, 14], k: 1.0, cell: 72 },
  kirov_vox: { vox: { hull: 'kirov.vox' }, pivot: [23, 10.5], k: 1.5, cell: 160 },
  aegis_vox: { vox: { hull: 'aegis_hull.vox', turret: 'aegis_turret.vox' }, pivot: [13.5, 8], turretPivot: [6, 6], mount: [12, 8, 9], turret: 'turret', k: 1.0, cell: 64 },
  raijin_vox: { vox: { hull: 'raijin_hull.vox', turret: 'raijin_turret.vox' }, pivot: [6.5, 7.5], turretPivot: [7, 7], mount: [6.5, 7.5, 13], turret: 'turret', k: 1.15, cell: 72 },
  demotruck_vox: { vox: { hull: 'demotruck.vox' }, pivot: [13.5, 7], k: 1.0, cell: 64 },
  // the navy (tools/sprites/voxel_naval.js); the waterline is z = 0
  patrol_vox: { vox: { hull: 'patrol_hull.vox', turret: 'patrol_turret.vox' }, pivot: [15, 4.5], turretPivot: [3.5, 3.5], mount: [22, 4.5, 4], turret: 'turret', k: 1.0, cell: 64 },
  destroyer_vox: { vox: { hull: 'destroyer_hull.vox', turret: 'destroyer_turret.vox' }, pivot: [22, 6.5], turretPivot: [4.5, 4.5], mount: [35, 6.5, 5], turret: 'turret', k: 1.2, cell: 96 },
  sub_vox: { vox: { hull: 'sub.vox' }, pivot: [20, 4.5], k: 1.1, cell: 72 },
  hover_vox: { vox: { hull: 'hover.vox' }, pivot: [15, 8], k: 1.0, cell: 64 },
  cruiser_vox: { vox: { hull: 'cruiser_hull.vox', turret: 'cruiser_turret.vox' }, pivot: [26, 7.5], turretPivot: [4.5, 4.5], mount: [44, 7.5, 5], turret: 'turret', k: 1.25, cell: 112 },
  battleship_vox: { vox: { hull: 'battleship_hull.vox', turret: 'battleship_turret.vox' }, pivot: [30, 8.5], turretPivot: [5.5, 5.5], mount: [45.5, 8.5, 6], turret: 'turret', k: 1.25, cell: 128 },
  carrier_vox: { vox: { hull: 'carrier.vox' }, pivot: [36, 11], k: 1.3, cell: 160 },
  maya_vox: { vox: { hull: 'maya_hull.vox', turret: 'maya_turret.vox' }, pivot: [23, 6.5], turretPivot: [4.5, 4.5], mount: [37, 6.5, 5], turret: 'turret', k: 1.2, cell: 96 },
  ...Object.fromEntries(['rifle', 'rocket', 'engineer', 'sniper', 'shock', 'commando', 'sas', 'hacker'].flatMap(kind => [0, 1, 2].map(f =>
    [`${kind}_vox_${f}`, { vox: { hull: `${kind}_${f}.vox` }, pivot: [2.5, 3.5], k: 1.25, cell: 40, anchor: 0.75 }]))),
  // structures (tools/sprites/voxel_buildings.js): 1 voxel = 2 game px, one facing, pivot at the footprint centre
  ...Object.fromEntries(Object.entries({
    cc: [3, 3], power: [2, 2], refinery: [3, 3], barracks: [2, 2], factory: [3, 3], radar: [2, 2], airfield: [3, 2],
    tech: [2, 2], hub: [2, 2], laser: [1, 1], thaad: [2, 2], koksan: [2, 2], gchq: [2, 2], robotics: [2, 2], krasukha: [2, 2], propaganda: [1, 1], super_lance: [3, 3], super_silo: [3, 3], super_silo_open: [3, 3], turret: [1, 1], railturret: [1, 1], sam: [1, 1], shipyard: [3, 3],
  }).map(([key, [w, h]]) => {
    const W = w * 16, H = h * 16, span = (W + H) * 2, cell = span + 24;
    return [`b_${key}`, { vox: { hull: `b_${key}.vox` }, pivot: [W / 2, H / 2], k: 2, cell, anchor: (cell - 12 - span / 4) / cell, facings: 1 }];
  })),
  // rotating weapons of defences (pivot at the gun's centre, lifted onto the base)
  b_turret_gun: { vox: { hull: 'b_turret_gun.vox' }, pivot: [4.5, 4.5], lift: 3.5, k: 2, cell: 64, anchor: 0.62 },
  b_railturret_gun: { vox: { hull: 'b_railturret_gun.vox' }, pivot: [5.5, 5.5], lift: 5, k: 2, cell: 80, anchor: 0.62 },
  b_sam_gun: { vox: { hull: 'b_sam_gun.vox' }, pivot: [5.5, 5.5], lift: 3, k: 2, cell: 64, anchor: 0.62 },
  b_laser_gun: { vox: { hull: 'b_laser_gun.vox' }, pivot: [5.5, 5.5], lift: 10, k: 2, cell: 72, anchor: 0.62 },
  b_thaad_gun: { vox: { hull: 'b_thaad_gun.vox' }, pivot: [7, 7], lift: 2, k: 2, cell: 80, anchor: 0.62 },
  b_koksan_gun: { vox: { hull: 'b_koksan_gun.vox' }, pivot: [6, 6], lift: 4, k: 2, cell: 112, anchor: 0.6 },
  heli: { file: 'Helicopter_001.glb', k: 2.8, cell: 120, anchor: 0.7, hide: ['Blade_001'], rotor: 'Blade_001', mask: { Color: 'dark' } },
};

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets', 'sprites');

function serve(modelDir) {
  const types = { '.vox': 'application/octet-stream', '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const roots = { '/three/': path.join(__dirname, 'node_modules', 'three') + '/', '/models/': modelDir + '/', '/vox/': path.join(ROOT, 'assets', 'voxels') + '/', '/': __dirname + '/' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const prefix = Object.keys(roots).find(p => url.startsWith(p));
    const file = path.normalize(roots[prefix] + url.slice(prefix.length));
    if (!file.startsWith(roots[prefix]) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const modelDir = path.resolve(process.argv[2] || '');
  if (!process.argv[2] || !fs.existsSync(modelDir)) { console.error('usage: node render.js <folder with .glb files>'); process.exit(1); }
  const only = process.argv.slice(3);
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve(modelDir);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/render.html`);
  await page.waitForFunction(() => window.ready);

  const metaFile = path.join(OUT, 'sprites.js');
  let meta = {};
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile, 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''));
  for (const [key, cfg] of Object.entries(MODELS)) {
    if (only.length && !only.includes(key)) continue;
    const r = await page.evaluate(c => window.renderSheet(c), cfg);
    for (const [part, imgs] of Object.entries(r.images)) {
      for (const [pass, url] of Object.entries(imgs)) {
        fs.writeFileSync(path.join(OUT, `${key}_${part}${pass === 'base' ? '' : '_' + pass}.png`), Buffer.from(url.split(',')[1], 'base64'));
      }
    }
    meta[key] = r.meta;
    console.log('rendered', key, cfg.file || Object.values(cfg.vox).join(' + '));
  }
  fs.writeFileSync(metaFile, '// Generated by tools/sprites/render.js — sprite sheet layout per unit.\nconst SPRITE_META = ' + JSON.stringify(meta, null, 2) + ';\n');
  await browser.close();
  server.close();
})();
