// Renders scanned scenery into sprites for the game: assets/props/<name>.webp (+ <name>_s.webp
// ground shadow) and assets/props/props.js (sizes and anchors).
//
//   python3 fetch_assets.py models && node props.js cache [name ...]
//
// The models are public domain (CC0, https://polyhaven.com): each one in its own folder as
// downloaded (<id>/<id>.gltf + textures/), the sky in hdri/<HDRI>.hdr. They are large, so only the
// rendered sprites are kept in the repository.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HDRI = 'kloofendal_48d_partly_cloudy_puresky.hdr';
const YAW3 = [0, 115, 235], YAW4 = [0, 80, 170, 260];
// name -> { id (Poly Haven model), h: height in game px, yaw: one sprite per turn, ... }
const PROPS = {
  // broadleaf trees (temperate, jungle, steppe)
  oak: { id: 'tree_small_02', h: 60, yaw: YAW4, sat: 0.95, gain: 1.35 },
  elm: { id: 'island_tree_02', h: 50, yaw: YAW3, sat: 0.95, gain: 1.35 },
  ash: { id: 'island_tree_01', h: 56, yaw: YAW3, sat: 0.95, gain: 1.35 },
  karee: { id: 'searsia_lucida', pick: ['searsia_lucida_a_LOD0', 'searsia_lucida_b_LOD0', 'searsia_lucida_d_LOD0', 'searsia_lucida_e_LOD0'], h: 40, yaw: [0], sat: 0.9, gain: 1.3 },
  // conifers (arctic): young firs stand in for full-grown ones at this scale
  fir: { id: 'fir_sapling_medium', pick: ['fir_sapling_medium_a_LOD0', 'fir_sapling_medium_b_LOD0', 'fir_sapling_medium_c_LOD0'], h: 62, yaw: [0, 150], sat: 0.75, gain: 1.45 },
  log: { id: 'dead_tree_trunk', h: 34, flat: true, yaw: YAW3, sat: 0.7, gain: 1.2 },
  // dry country
  quiver: { id: 'quiver_tree_01', h: 44, yaw: YAW3, gain: 1.2 },
  quiver2: { id: 'quiver_tree_02', h: 38, yaw: YAW3, gain: 1.2 },
  // shrubs
  shrub2: { id: 'shrub_02', pick: ['shrub_02_a', 'shrub_02_b', 'shrub_02_c', 'shrub_02_d'], h: 13, yaw: [0], sat: 0.9, gain: 1.3 },
  shrub3: { id: 'shrub_03', pick: ['shrub_03_a', 'shrub_03_b', 'shrub_03_c', 'shrub_03_d'], h: 11, yaw: [0], sat: 0.9, gain: 1.3 },
  shrub_dry: { id: 'shrub_02', pick: ['shrub_02_a', 'shrub_02_b', 'shrub_02_c', 'shrub_02_d'], h: 12, yaw: [0], tint: [1.5, 1.2, 0.7], sat: 0.6, gain: 1.3 },
  // boulders: warm granite for dry and temperate country, grey for the north
  boulder1: { id: 'boulder_01', h: 22, yaw: YAW4 }, boulder2: { id: 'namaqualand_boulder_02', h: 22, yaw: YAW3 },
  boulder3: { id: 'namaqualand_boulder_03', h: 20, yaw: YAW3 }, boulder4: { id: 'namaqualand_boulder_04', h: 22, yaw: YAW3 },
  boulder5: { id: 'namaqualand_boulder_05', h: 24, yaw: YAW3 }, boulder6: { id: 'namaqualand_boulder_06', h: 20, yaw: YAW3 },
  rock9: { id: 'rock_09', h: 18, yaw: YAW3 },
  grey1: { id: 'boulder_01', h: 22, yaw: YAW4, sat: 0.25, gain: 1.05 }, grey3: { id: 'namaqualand_boulder_03', h: 20, yaw: YAW3, sat: 0.2, gain: 0.95 },
  grey4: { id: 'namaqualand_boulder_04', h: 22, yaw: YAW3, sat: 0.2, gain: 0.95 }, grey6: { id: 'namaqualand_boulder_06', h: 20, yaw: YAW3, sat: 0.2, gain: 0.95 },
  // ore: rubble of gold-bearing rock, and blue-green mineral outcrops (the game's two resources), in four sizes
  ...Object.fromEntries([1, 2, 3, 4].flatMap(n => [
    [`ore${n}`, { id: 'namaqualand_stones_01', pick: ['namaqualand_stones_01_a', 'namaqualand_stones_01_b', 'namaqualand_stones_01_c'], h: 2.6 + n * 0.9, yaw: [0, 130], tint: [1.3, 1.0, 0.55], sat: 1.0, gain: 1.15 }],
    [`gem${n}`, { id: 'namaqualand_stones_01', pick: ['namaqualand_stones_01_d', 'namaqualand_stones_01_e', 'namaqualand_stones_01_b'], h: 3.2 + n * 1.2, yaw: [0, 130], tint: [0.62, 0.95, 1.15], sat: 0.95, gain: 1.25 }],
  ])),
};

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets', 'props');

function serve(dir) {
  const roots = { '/three/': path.join(__dirname, 'node_modules', 'three') + '/', '/models/': dir + '/', '/hdri/': path.join(dir, 'hdri') + '/', '/': __dirname + '/' };
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gltf': 'model/gltf+json', '.jpg': 'image/jpeg', '.png': 'image/png' };
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
  const dir = path.resolve(process.argv[2] || '');
  if (!process.argv[2] || !fs.existsSync(dir)) { console.error('usage: node props.js <models folder> [name ...]'); process.exit(1); }
  const only = process.argv.slice(3);
  fs.mkdirSync(OUT, { recursive: true });
  const metaFile = path.join(OUT, 'props.js');
  let meta = {};
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile, 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''));
  const server = await serve(dir);
  for (const [name, cfg] of Object.entries(PROPS)) {
    if (only.length && !only.includes(name)) continue;
    // a fresh browser per model: the big scans would otherwise pile up in memory
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('page error:', e.message));
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/props.html`);
      await page.waitForFunction(() => window.ready);
      // a scan may hold several plants side by side: one page load per picked one
      const r = [];
      for (const pick of [].concat(cfg.pick || [null])) {
        if (r.length) { await page.reload(); await page.waitForFunction(() => window.ready); }
        r.push(...await page.evaluate(c => window.renderProp(c), { ...cfg, pick, file: `${cfg.id}/${cfg.id}.gltf`, hdri: HDRI }));
      }
      meta[name] = r.map((v, i) => {
        const base = path.join(OUT, `${name}_${i}`);
        const save = (url, file) => { fs.writeFileSync(file + '.png', Buffer.from(url.split(',')[1], 'base64')); };
        save(v.img, base); if (v.shadow) save(v.shadow, base + '_s');
        return { w: v.w, h: v.h, ox: v.ox, oy: v.oy, sw: v.sw, sh: v.sh, sox: v.sox, soy: v.soy };
      });
      console.log('rendered', name, r.map(v => `${v.w}x${v.h}`).join(' '));
    } catch (e) { console.error('FAILED', name, e.message.split('\n')[0]); }
    await browser.close();
  }
  server.close();
  // PNG -> WebP (small, keeps alpha)
  execFileSync('python3', ['-c', `
import glob, os
from PIL import Image
for f in glob.glob(os.path.join(${JSON.stringify(OUT)}, '*.png')):
    Image.open(f).save(f[:-4] + '.webp', quality=88, method=6); os.remove(f)
`], { stdio: 'inherit' });
  fs.writeFileSync(metaFile, '// Generated by tools/sprites/props.js: scenery sprites (size and anchor in game px, per variant).\nconst PROP_META = ' + JSON.stringify(meta) + ';\n');
})();
