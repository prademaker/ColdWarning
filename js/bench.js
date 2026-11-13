'use strict';
// Speed test: index.html?bench starts a fixed battle and times the frame rate with each part of
// the drawing switched off in turn, then shows a table (with a copy button) of what it found.
// Nothing here runs in a normal game.
const Bench = {
  on: new URLSearchParams(location.search).has('bench'),
  rows: [],

  // parts of the frame that can be switched off: [label, [object, method] pairs]
  PARTS: [
    ['Cloud shadows + vignette', [['FX', 'drawAtmosphere']]],
    ['Fog of war', [['Render', 'updateFogCanvas']]],
    ['Lights', [['Light', 'draw']]],
    ['Map edge slab', [['FX', 'drawSlab']]],
    ['Building ground + shadows', [['FX', 'drawBuildingGround'], ['FX', 'drawBuildingShadows']]],
    ['Unit shadows', [['window', 'drawUnitShadow']]],
    ['Hit flash / wear', [['Combat', 'overlay']]],
    ['Ore', [['Render', 'drawOre'], ['Render', 'drawOreDeposits']]],
    ['Minimap', [['UI', 'drawMinimap']]],
    ['Sidebar', [['UI', 'update']]],
    ['Whole battlefield', [['Render', 'draw']]],
  ],

  start() {
    if (!this.on) return;
    const box = document.createElement('div');
    box.id = 'bench';
    box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99;background:rgba(5,11,20,.92);color:#dfe;font:13px/1.4 monospace;padding:12px 14px;border:1px solid #3a6;max-width:560px;white-space:pre-wrap';
    box.textContent = 'Speed test: starting a battle...';
    document.body.appendChild(box);
    this.box = box;
    Main.start(Object.assign({}, Main.settings, { lineup: '1v1', mapSize: 'medium', theater: 'temperate', seed: 4242, difficulty: 'normal', hints: false, ceasefire: 0, autoplay: true }));
    this.run().catch(e => { box.textContent += '\nFailed: ' + e.message; });
  },

  wait(ms) { return new Promise(r => setTimeout(r, ms)); },

  // frames per second and the slowest frame over a stretch of real frames
  async measure(ms = 3000) {
    let n = 0, worst = 0, last = performance.now(), js = 0;
    const t0 = last, f0 = Main.frame;
    Main.frame = function (now) { const a = performance.now(); f0.call(Main, now); js += performance.now() - a; };
    await new Promise(res => {
      const tick = () => {
        const now = performance.now();
        worst = Math.max(worst, now - last); last = now; n++;
        if (now - t0 < ms) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    Main.frame = f0;
    const secs = (performance.now() - t0) / 1000;
    return { fps: n / secs, worst, js: js / Math.max(1, n) };
  },

  off(pairs) {
    const undo = [];
    for (const [o, k] of pairs) {
      const obj = window[o] || eval(o);
      const fn = obj[k];
      if (typeof fn !== 'function') continue;
      obj[k] = k === 'drawUnitShadow' ? () => false : () => {};
      undo.push(() => { obj[k] = fn; });
    }
    return () => undo.forEach(u => u());
  },

  line(s) { this.box.textContent += '\n' + s; },

  async run() {
    const box = this.box;
    // let the sprite sheets and ground photographs arrive, then fast-forward into the game
    const t0 = performance.now();
    while (performance.now() - t0 < 60000) {
      await this.wait(500);
      const pending = Object.values(SHEETS).some(s => !sheetLoaded(s));
      if (!pending && G && G.time > 1) break;
    }
    const loadS = ((performance.now() - t0) / 1000).toFixed(1);
    for (let i = 0; i < 20 * 150; i++) G.update(TICK);
    const mine = G.entities.find(e => !e.dead && e.team === G.player && e.kind === 'building');
    if (mine) UI.centerOn(mine.x, mine.y);
    await this.wait(1500);
    const gl = (() => { try { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c ? 'webgl' : 'no webgl'; } catch (e) { return '?'; } })();
    let cacheMB = 0;
    for (const v of Art.cache.values()) { const c = v && (v.c || v); if (c && c.width) cacheMB += c.width * c.height * 4 / 1e6; }
    box.textContent = `Speed test (${new Date().toISOString().slice(0, 16)})\n${navigator.userAgent}\nGPU: ${gl}\nview ${UI.canvas.width}x${UI.canvas.height} zoom ${UI.zoom.toFixed(2)} dpr ${devicePixelRatio}  load ${loadS}s  sprite cache ${cacheMB | 0} MB\n`;
    const fmt = (label, r, base) => `${label.padEnd(28)} ${r.fps.toFixed(1).padStart(5)} fps  worst ${String(r.worst | 0).padStart(4)} ms  js ${r.js.toFixed(1).padStart(5)} ms${base ? '  ' + (r.fps / base.fps >= 1.25 ? '<-- faster' : '') : ''}`;
    const base = await this.measure();
    this.line(fmt('Everything on', base));
    for (const [label, pairs] of this.PARTS) {
      const undo = this.off(pairs);
      await this.wait(300);
      const r = await this.measure();
      undo();
      this.line(fmt('without ' + label, r, base));
    }
    this.line(fmt('Everything on (again)', await this.measure(), null));
    // zoomed out to the widest view
    UI.setZoom(UI.minZoom());
    await this.wait(300);
    this.line(fmt('Zoomed out ' + UI.canvas.width + 'x' + UI.canvas.height, await this.measure(), null));
    UI.setZoom(1);
    this.line('\nDone. Press Copy and paste the result into the chat.');
    const b = document.createElement('button');
    b.textContent = 'Copy'; b.style.cssText = 'margin-top:8px;font:inherit;padding:4px 14px';
    b.onclick = () => { navigator.clipboard.writeText(box.textContent).then(() => { b.textContent = 'Copied'; }); };
    box.appendChild(b);
  },
};
