// ColdWarning — input handling, camera, sidebar, minimap.
'use strict';

const PING_LIFE = 6;
const PING_COLORS = { base: '#f33', unit: '#ff9a3c', info: '#ffd27a' };

const UI = {
  cam: { x: 0, y: 0 },
  selection: [], hover: null, placing: null, drag: null, mode: null, superTargeting: false,
  mouse: { x: 0, y: 0, inside: false }, mouseWorld: { x: 0, y: 0 },
  clickMarks: [], groups: {}, tab: 'structure', showBars: false, keys: {},
  sidebarT: 0, iconCache: {}, displayCredits: 0, lastGroupKey: null, lastGroupT: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.selection = []; this.placing = null; this.mode = null; this.superTargeting = false; this.groups = {}; this.groupsHtml = null;
    this.iconCache = {};
    this.displayCredits = G.playerTeam.credits;
    this.tab = 'structure';
    this.resize();
    this.centerOn(G.map.starts[G.player][0] * TILE, G.map.starts[G.player][1] * TILE);
    if (!this.bound) { this.bindEvents(); this.bound = true; }
    this.buildTabs();
    this.buildGridKey = null;
    this.selKey = null;
    const pt = G.playerTeam;
    document.getElementById('sb-flag').src = FLAGS[pt.faction];
    document.getElementById('sb-fname').textContent = pt.name;
    document.getElementById('sidebar').style.setProperty('--team', pt.color);
    document.getElementById('groups').style.setProperty('--team', pt.color);
    G.on('eva', msg => { Sfx.say(msg); this.flashMessages(); });
    document.getElementById('wave-call').onclick = () => { if (G.waves) { G.waves.callEarly(); Sfx.play('click'); } };
    G.on('sound', (name, x, y) => {
      if (x === undefined) { Sfx.play(name); return; }
      // pan by screen position; fade out with distance beyond the screen edge
      const [sx, sy] = this.toScreen(x, y), W = this.canvas.width, H = this.canvas.height;
      const out = Math.hypot(Math.max(0, -sx, sx - W), Math.max(0, -sy, sy - H));
      const big = name === 'boom' || name === 'place';
      const vol = 1 - out / (big ? 900 : 450);
      if (vol > 0.05) Sfx.play(name, vol, Math.max(-0.8, Math.min(0.8, (sx / W) * 2 - 1)));
    });
    G.on('voice', (u, kind) => Sfx.unitVoice(u, kind));
  },

  resize() {
    const sb = document.getElementById('sidebar');
    this.canvas.width = window.innerWidth - sb.offsetWidth;
    this.canvas.height = window.innerHeight;
    this.clampCam();
  },

  // The camera lives in isometric screen space: world (x, y) shows at (x - y, (x + y) / 2).
  centerOn(x, y) {
    this.cam.x = (x - y) - this.canvas.width / 2;
    this.cam.y = (x + y) / 2 - this.canvas.height / 2;
    this.clampCam();
  },

  clampCam() {
    if (!G) return;
    const W = G.map.w * TILE, m = 120;
    this.cam.x = Math.max(-W - m, Math.min(W - this.canvas.width + m, this.cam.x));
    this.cam.y = Math.max(-m, Math.min(W - this.canvas.height + m, this.cam.y));
  },

  // screen -> ground point in the world, and back
  toWorld(sx, sy) {
    const X = sx + this.cam.x, Y = sy + this.cam.y;
    return { x: Y + X / 2, y: Y - X / 2 };
  },
  toScreen(x, y, z = 0) { return [x - y - this.cam.x, (x + y) / 2 - z - this.cam.y]; },

  // ---------- picking (done in screen space so tall sprites can be clicked) ----------
  entityAt(wx, wy) {
    const [mx, my] = this.toScreen(wx, wy);
    let best = null, bd = 1e9;
    for (const e of G.entities) {
      if (e.dead || e.kind !== 'unit') continue;
      if (!G.isVisibleTo(e, G.player)) continue;
      const [sx, sy] = this.toScreen(e.x, e.y, (e.alt || 0) + (e.def.cat === 'infantry' ? 7 : 8));
      const d = Math.hypot(sx - mx, sy - my);
      if (d < e.def.radius * 1.2 + 5 && d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    // walk up the building heights: the frontmost structure under the cursor wins
    let hit = null, hd = -1e9;
    for (let z = 0; z <= 70; z += 4) {
      const w = this.toWorld(mx, my + z);
      const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
      if (!G.map.inside(tx, ty)) continue;
      const id = G.map.bld[G.map.idx(tx, ty)];
      if (id < 0) continue;
      const b = G.byId.get(id);
      if (!b || b.dead || !G.isVisibleTo(b, G.player) || z > b.def.height + 22) continue;
      if (b.x + b.y > hd) { hd = b.x + b.y; hit = b; }
    }
    return hit;
  },

  ownSelected() { return this.selection.filter(e => !e.dead && e.team === G.player); },
  ownUnits() { return this.ownSelected().filter(e => e.kind === 'unit'); },

  select(list, add) {
    if (!add) this.selection = [];
    for (const e of list) if (!this.selection.includes(e)) this.selection.push(e);
    if (list.length) Sfx.play('click');
    const u = list.find(e => e.kind === 'unit' && e.team === G.player);
    if (u) Sfx.unitVoice(u, 'select');
  },

  // ---------- events ----------
  bindEvents() {
    const c = this.canvas;
    window.addEventListener('resize', () => { if (G) this.resize(); });
    c.addEventListener('contextmenu', e => e.preventDefault());
    document.getElementById('sidebar').addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('mouseenter', e => this.onMove(e));
    c.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    c.addEventListener('mousemove', e => this.onMove(e));
    c.addEventListener('mousedown', e => { Sfx.resume(); this.onDown(e); });
    window.addEventListener('mouseup', e => this.onUp(e));
    c.addEventListener('dblclick', e => this.onDbl(e));
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    this.minimap.addEventListener('mousedown', e => { e.preventDefault(); Sfx.resume(); this.onMinimap(e, true); });
    window.addEventListener('mousemove', e => { if (this.miniDrag) this.onMinimap(e, false); });
    window.addEventListener('mouseup', () => { this.miniDrag = false; });
    this.minimap.addEventListener('contextmenu', e => e.preventDefault());
    document.getElementById('groups').addEventListener('mousedown', e => {
      const b = e.target.closest('[data-g]');
      if (!b || !G || G.over || Main.paused) return;
      e.preventDefault(); Sfx.resume();
      this.recallGroup(b.dataset.g, e.shiftKey);
    });
    // the Upgrade button on a selected structure's panel (the panel is redrawn every frame, so
    // listen on the box and act on the press)
    document.getElementById('sel-info').addEventListener('mousedown', e => {
      const b = e.target.closest('[data-upgrade]');
      if (!b || !G || G.over || Main.paused) return;
      e.preventDefault(); Sfx.resume();
      this.upgrade(G.byId.get(+b.dataset.upgrade));
    });
    for (const [id, fn] of [['btn-repair', () => this.toggleMode('repair')], ['btn-sell', () => this.toggleMode('sell')], ['btn-upgrade', () => this.toggleMode('upgrade')],
      ['btn-super', () => this.startSuper()], ['btn-pause', () => Main.togglePause()], ['btn-sound', () => this.toggleSound()], ['btn-music', () => this.toggleMusic()]]) {
      document.getElementById(id).addEventListener('click', () => { Sfx.resume(); fn(); });
    }
  },

  toggleSound() {
    Sfx.setMuted(!Sfx.muted);
    document.getElementById('btn-sound').classList.toggle('off', Sfx.muted);
  },

  toggleMusic() {
    Music.setOn(!Music.on);
    document.getElementById('btn-music').classList.toggle('off', !Music.on);
  },

  toggleMode(m) {
    this.placing = null; this.superTargeting = false;
    this.mode = this.mode === m ? null : m;
    this.updateCursor();
  },

  startSuper() {
    if (!G.playerTeam.superReady) { Sfx.play('error'); return; }
    this.placing = null; this.mode = null;
    this.superTargeting = true;
    G.eva('Select target', G.player);
    this.updateCursor();
  },

  cancelModes() {
    const any = this.placing || this.mode || this.superTargeting;
    this.placing = null; this.mode = null; this.superTargeting = false;
    this.updateCursor();
    return any;
  },

  updateCursor() {
    let cur = 'default';
    if (this.mode === 'sell') cur = 'cell';
    else if (this.mode === 'repair' || this.mode === 'upgrade') cur = 'help';
    else if (this.mode === 'amove' || this.superTargeting) cur = 'crosshair';
    else if (this.hover && G.hostile(this.hover.team, G.player) && this.ownUnits().length) cur = 'crosshair';
    else if (this.hover && this.hover.team === G.player) cur = 'pointer';
    else if (this.hover && this.hover.def.garrison && this.ownUnits().some(u => G.canGarrison(u, this.hover))) cur = 'pointer';
    this.canvas.style.cursor = cur;
  },

  onMove(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    this.mouse.inside = true;
    if (this.pan) {
      this.cam.x = this.pan.cx - (e.clientX - this.pan.x);
      this.cam.y = this.pan.cy - (e.clientY - this.pan.y);
      this.clampCam();
    }
    if (this.drag) { this.drag.x1 = this.mouse.x; this.drag.y1 = this.mouse.y; }
  },

  onDown(e) {
    if (!G || G.over) return;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    if (e.button === 1) { this.pan = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y }; e.preventDefault(); return; }
    if (e.button === 2) { this.onRight(w, e); return; }
    if (e.button !== 0) return;
    if (this.placing) {
      const pl = this.placing, q = G.playerTeam.queues[pl.qtype];
      if (pl.sticky && !q.ready) return; // the next wall section is still on its way
      const ok = G.tryPlace(G.player, pl.qtype, pl.tx, pl.ty);
      if (!ok) { Sfx.play('error'); G.eva('Cannot deploy here', G.player); return; }
      // walls: queue the next section and stay in placement, so a line can be laid click by click
      if (BUILDINGS[pl.key].wall && !q.items.length && G.playerTeam.canBuild(pl.key)) { q.add(pl.key); pl.sticky = true; }
      else this.placing = null;
      return;
    }
    if (this.superTargeting) {
      G.fireSuper(G.player, w.x, w.y);
      this.superTargeting = false; this.updateCursor();
      return;
    }
    const ent = this.entityAt(w.x, w.y);
    if (this.mode === 'sell') {
      if (ent && ent.kind === 'building' && ent.team === G.player) G.sell(ent); else Sfx.play('error');
      return;
    }
    if (this.mode === 'repair') {
      if (ent && ent.kind === 'building' && ent.team === G.player) { ent.repairing = !ent.repairing; Sfx.play('click'); }
      else Sfx.play('error');
      return;
    }
    if (this.mode === 'upgrade') {
      // stays on so several structures can be refitted in a row; right-click or Esc to stop
      this.upgrade(ent && ent.kind === 'building' && ent.team === G.player ? ent : null);
      return;
    }
    if (this.mode === 'amove') {
      const units = this.ownUnits();
      if (ent && G.hostile(ent.team, G.player)) G.commandAttack(units, ent);
      else G.commandMove(units, Math.floor(w.x / TILE), Math.floor(w.y / TILE), true);
      this.mark(w.x, w.y, '#f84');
      this.mode = null; this.updateCursor();
      return;
    }
    this.drag = { x0: this.mouse.x, y0: this.mouse.y, x1: this.mouse.x, y1: this.mouse.y, shift: e.shiftKey, ent };
  },

  onUp(e) {
    if (e.button === 1) { this.pan = null; return; }
    if (e.button !== 0 || !this.drag) return;
    const d = this.drag; this.drag = null;
    if (!G) return;
    const small = Math.abs(d.x1 - d.x0) < 6 && Math.abs(d.y1 - d.y0) < 6;
    if (small) {
      const ent = d.ent;
      // clicking a lone selected MCV deploys it (classic behaviour)
      if (ent && ent.team === G.player && ent.def.mcv && this.selection.length === 1 && this.selection[0] === ent) { G.deploy(ent); return; }
      if (ent) {
        if (d.shift && ent.team === G.player) {
          const i = this.selection.indexOf(ent);
          if (i >= 0) this.selection.splice(i, 1); else this.select([ent], true);
        } else this.select([ent], false);
        if (ent.kind === 'building' && ent.team === G.player) {
          const q = { cc: 'structure', barracks: 'infantry', factory: 'vehicle', airfield: 'air', shipyard: 'naval' }[ent.key];
          if (q) this.setTab(q);
        }
      } else if (!d.shift) this.selection = [];
      return;
    }
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    const list = G.entities.filter(e => {
      if (e.kind !== 'unit' || e.dead || e.team !== G.player) return false;
      const [sx, sy] = this.toScreen(e.x, e.y, (e.alt || 0) + 6);
      return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1;
    });
    // prefer combat units when the box catches harvesters too
    const combat = list.filter(u => !u.def.harvester);
    this.select(combat.length ? combat : list, d.shift);
  },

  onDbl(e) {
    if (!G) return;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    const ent = this.entityAt(w.x, w.y);
    if (!ent || ent.team !== G.player) return;
    if (ent.kind === 'building') {
      if (ent.def.produces && ent.def.produces !== 'structure') {
        for (const b of G.entities) if (b.kind === 'building' && b.key === ent.key && b.team === G.player) b.primary = false;
        ent.primary = true;
        G.eva('Primary building selected', G.player);
      }
      return;
    }
    // all of that type on screen, or on the whole map with Ctrl
    const W = this.canvas.width, H = this.canvas.height;
    const list = G.entities.filter(o => {
      if (o.kind !== 'unit' || o.dead || o.team !== G.player || o.key !== ent.key || o.inside || o.aboard) return false;
      if (e.ctrlKey || e.metaKey) return true;
      const [sx, sy] = this.toScreen(o.x, o.y);
      return sx >= 0 && sx <= W && sy >= 0 && sy <= H;
    });
    this.select(list, e.shiftKey);
  },

  onRight(w, e) {
    if (this.cancelModes()) return;
    const units = this.ownUnits();
    const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
    const ent = this.entityAt(w.x, w.y);
    if (!units.length) {
      // set rally point for selected production structures
      const prods = this.ownSelected().filter(b => b.kind === 'building' && b.def.produces && b.def.produces !== 'structure');
      if (prods.length) { for (const b of prods) b.rally = [tx, ty]; this.mark(w.x, w.y, '#7f7'); Sfx.play('ack'); }
      else this.selection = [];
      return;
    }
    // troops onto one of our own transports: climb aboard
    if (ent && ent.kind === 'unit' && ent.def.transport && ent.team === G.player && units.some(u => G.canBoard(u, ent))) {
      const sent = G.commandBoard(units, ent);
      const rest = units.filter(u => !sent.includes(u) && u !== ent);
      if (rest.length) G.commandMove(rest, tx, ty, false, true);
      this.mark(ent.x, ent.y, '#7f7');
      return;
    }
    // infantry onto a free civilian building or one of our own bunkers: move in
    if (ent && ent.kind === 'building' && ent.def.garrison && units.some(u => G.canGarrison(u, ent))) {
      const sent = G.commandGarrison(units, ent);
      const rest = units.filter(u => !sent.includes(u));
      if (rest.length) G.commandMove(rest, tx, ty, false, true);
      this.mark(ent.x, ent.y, '#7f7');
      return;
    }
    if (ent && G.hostile(ent.team, G.player)) {
      G.commandAttack(units, ent);
      this.mark(ent.x, ent.y, '#f44');
      return;
    }
    const harv = units.filter(u => u.def.harvester);
    const rest = units.filter(u => !u.def.harvester);
    if (ent && ent.team === G.player && ent.kind === 'building') {
      if (ent.key === 'refinery') for (const h of harv) G.commandDock(h, ent);
      else if (harv.length) G.commandMove(harv, tx, ty, false);
      const eng = rest.filter(u => u.def.engineer);
      if (eng.length && ent.hp < ent.maxHp) { for (const u of eng) G.commandCapture(u, ent); }
      const others = rest.filter(u => !(u.def.engineer && ent.hp < ent.maxHp));
      if (others.length) G.commandMove(others, tx, ty, false);
      this.mark(w.x, w.y, '#7f7');
      return;
    }
    if (G.map.inside(tx, ty) && G.map.ore[G.map.idx(tx, ty)] > 10 && harv.length) {
      for (const h of harv) G.commandHarvest(h, tx, ty);
      if (rest.length) G.commandMove(rest, tx, ty, false);
      Sfx.play('ack');
    } else {
      G.commandMove(units, tx, ty, e.ctrlKey);
    }
    this.mark(w.x, w.y, e.ctrlKey ? '#f84' : '#7f7');
  },

  mark(x, y, color) { this.clickMarks.push({ x, y, t: 0, color }); },

  // The minimap shows the map as a diamond, turned the same way as the main view.
  miniXY(x, y) {
    const m = G.map, S = m.w + m.h, c = this.minimap;
    return [((x - y) / TILE + m.h) / S * c.width, (x + y) / TILE / S * c.height];
  },
  miniWorld(px, py) {
    const m = G.map, S = m.w + m.h, c = this.minimap;
    const a = px / c.width * S - m.h, b = py / c.height * S;
    const x = Math.max(0, Math.min(m.w - 0.01, (a + b) / 2)), y = Math.max(0, Math.min(m.h - 0.01, (b - a) / 2));
    return { x: x * TILE, y: y * TILE };
  },

  onMinimap(e, down) {
    if (!G || G.over || !this.radarOn()) { this.miniDrag = false; return; }
    const r = this.minimap.getBoundingClientRect();
    const w = this.miniWorld((e.clientX - r.left) / r.width * this.minimap.width, (e.clientY - r.top) / r.height * this.minimap.height);
    const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
    if (down && e.button === 2) {
      if (this.cancelModes()) return;
      const units = this.ownUnits();
      if (units.length) { G.commandMove(units, tx, ty, e.ctrlKey); this.mark(w.x, w.y, e.ctrlKey ? '#f84' : '#7f7'); return; }
      // nothing to move: set the rally point of selected production structures
      const prods = this.ownSelected().filter(b => b.kind === 'building' && b.def.produces && b.def.produces !== 'structure');
      if (prods.length) { for (const b of prods) b.rally = [tx, ty]; this.mark(w.x, w.y, '#7f7'); Sfx.play('ack'); }
      return;
    }
    if (down && e.button === 0 && this.mode === 'amove') {
      G.commandMove(this.ownUnits(), tx, ty, true);
      this.mark(w.x, w.y, '#f84');
      this.mode = null; this.updateCursor();
      return;
    }
    if (down && e.button !== 0) return;
    if (down) this.miniDrag = true;
    this.centerOn(w.x, w.y);
  },

  onKey(e, down) {
    if (!G || document.getElementById('game').hidden) return;
    const k = e.key;
    this.keys[k] = down;
    if (!down) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (k === 'F5') { e.preventDefault(); Main.quickSave(); return; }
    if (k === 'F9') { e.preventDefault(); Main.quickLoad(); return; }
    if (k === 'F1' || k === '?') { e.preventDefault(); Main.openKeys(); return; }
    if (!document.getElementById('saves').hidden) { if (k === 'Escape') Main.closeDialog(); return; }
    if (k === 'Escape') { if (!this.cancelModes()) this.selection = []; return; }
    if (k === 'p' || k === 'P') { Main.togglePause(); return; }
    if (k === 'm' || k === 'M') { this.toggleSound(); return; }
    if (k === 'n' || k === 'N') { Music.next(); return; }
    if (G.over || Main.paused) return;
    // digits by key position, so Shift+1 still reads as 1 and not !
    const digit = /^(Digit|Numpad)[0-9]$/.test(e.code) ? e.code.slice(-1) : /^[0-9]$/.test(k) ? k : null;
    if (digit) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) this.setGroup(digit, e.shiftKey);
      else this.recallGroup(digit, e.shiftKey);
      return;
    }
    const lower = k.toLowerCase();
    if (lower === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.select(G.entities.filter(u => u.kind === 'unit' && !u.dead && u.team === G.player && this.isCombat(u)), false);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Period') { this.nextIdle(e.shiftKey); return; }
    if (lower === 'a' && this.ownUnits().length) { this.mode = 'amove'; this.placing = null; this.updateCursor(); return; }
    if (lower === 's') { G.commandStop(this.ownUnits()); return; }
    if (lower === 'd') {
      // deploy MCVs, dig riflemen in (or get them all up if they already are), empty garrisons
      const units = this.ownUnits(), diggers = units.filter(u => u.def.dig);
      for (const u of units) if (u.def.mcv) G.deploy(u);
      const dig = diggers.some(u => !u.dug && u.digging <= 0);
      for (const u of diggers) if (dig) G.digIn(u); else G.digOut(u);
      if (diggers.length) Sfx.play('ack');
      for (const b of this.ownSelected()) if (b.kind === 'building' && b.garrison && b.garrison.length) { G.evacuate(b); Sfx.play('ack'); }
      for (const u of units) if (u.passengers && u.passengers.length) { if (G.unload(u)) Sfx.play('ack'); else Sfx.play('error'); }
      for (const u of units) if (u.def.mines) { if (G.layMine(u)) Sfx.play('ack'); else Sfx.play('error'); }
      return;
    }
    if (lower === 'h') { this.jumpHome(); return; }
    if (k === ' ') { e.preventDefault(); this.jumpAlert(); return; }
    if (k === 'Tab') {
      e.preventDefault();
      const i = TABS.findIndex(t => t.id === this.tab);
      this.setTab(TABS[(i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length].id);
      return;
    }
    if (lower === 'z') { this.toggleMode('sell'); return; }
    if (lower === 'x') { this.toggleMode('repair'); return; }
    if (e.code === 'Quote') { this.toggleMode('upgrade'); return; }
    if (lower === 'f') { this.startSuper(); return; }
    const tab = Object.keys(TAB_KEYS).find(id => TAB_KEYS[id].toLowerCase() === lower);
    if (tab) { this.setTab(tab); Sfx.play('click'); return; }
    // build hotkeys within the current tab
    const ch = { ':': ';', '{': '[', '}': ']' }[k] || lower; // Shift+; still means ;
    const item = Object.keys(this.hotkeys || {}).find(key => this.hotkeys[key].toLowerCase() === ch);
    if (item) this.clickBuild(item, false, e.shiftKey);
  },

  // refit one of our structures to Mk II, explaining why not when it can't be
  upgrade(b) {
    if (!b || b.team !== G.player || !STRUCTURE_UPGRADES[b.key]) { Sfx.play('error'); return; }
    if (b.level > 1) { G.eva('Already upgraded', G.player); Sfx.play('error'); return; }
    if (b.refit !== null && b.refit !== undefined) { G.eva('Upgrade in progress', G.player); Sfx.play('error'); return; }
    if (!G.playerTeam.countOf(STRUCTURE_UPGRADE_REQ)) { G.eva('Upgrades require a ' + BUILDINGS[STRUCTURE_UPGRADE_REQ].name, G.player); Sfx.play('error'); return; }
    if (G.upgradeStructure(b)) Sfx.play('click'); else Sfx.play('error');
  },

  isCombat(u) { return !u.def.harvester && !u.def.mcv && !u.def.engineer && !u.inside && !u.aboard; },

  // control groups: Ctrl+# makes one, Ctrl+Shift+# adds to it
  setGroup(n, add) {
    const units = this.ownUnits();
    if (!units.length && !add) return;
    const g = add ? (this.groups[n] || []).filter(u => !u.dead && u.team === G.player) : [];
    for (const u of units) if (!g.includes(u)) g.push(u);
    this.groups[n] = g;
    G.eva('Team ' + n + (add ? ' reinforced' : ' assigned'), G.player);
  },

  // # selects a group, Shift+# adds it to the selection, pressing it twice jumps to it
  recallGroup(n, add) {
    const g = (this.groups[n] || []).filter(u => !u.dead && u.team === G.player);
    this.groups[n] = g;
    if (!g.length) return;
    if (this.lastGroupKey === n && performance.now() - this.lastGroupT < 400) {
      const cx = g.reduce((s, u) => s + u.x, 0) / g.length, cy = g.reduce((s, u) => s + u.y, 0) / g.length;
      this.centerOn(cx, cy);
    }
    this.lastGroupKey = n; this.lastGroupT = performance.now();
    this.select(g, add);
  },

  // the group number each unit belongs to (the lowest one if several), for the badges
  groupOf() {
    const out = new Map();
    for (let n = 9; n >= 0; n--) for (const u of this.groups[n] || []) out.set(u, n);
    return out;
  },

  // . steps through idle combat units, Shift+. selects all of them
  nextIdle(all) {
    const idle = G.entities.filter(u => u.kind === 'unit' && !u.dead && u.team === G.player && this.isCombat(u) &&
      !u.order && !u.target && !u.dug && !u.def.transport);
    if (!idle.length) { G.eva('No idle units', G.player); return; }
    if (all) { this.select(idle, false); return; }
    this.idleI = ((this.idleI || 0) + 1) % idle.length;
    const u = idle[this.idleI];
    this.select([u], false);
    this.centerOn(u.x, u.y);
  },

  // H: the Command Center, pressed again the next one
  jumpHome() {
    const ccs = G.entities.filter(b => b.kind === 'building' && !b.dead && b.team === G.player && b.def.produces === 'structure');
    const list = ccs.length ? ccs : G.entities.filter(b => b.kind === 'building' && !b.dead && b.team === G.player);
    if (!list.length) return;
    const again = performance.now() - (this.homeT || 0) < 2000;
    this.homeI = again ? ((this.homeI || 0) + 1) % list.length : 0;
    this.homeT = performance.now();
    const b = list[this.homeI];
    this.centerOn(b.x, b.y);
  },

  // Space: the latest radar alert, pressed again within a couple of seconds the one before it
  jumpAlert() {
    const pings = (G.pings || []).filter(p => G.time - p.t < 30).sort((a, b) => b.t - a.t);
    if (!pings.length) { if (G.alertPos) this.centerOn(G.alertPos.x, G.alertPos.y); return; }
    const again = performance.now() - (this.alertT || 0) < 2500;
    this.alertI = again ? ((this.alertI || 0) + 1) % pings.length : 0;
    this.alertT = performance.now();
    this.centerOn(pings[this.alertI].x, pings[this.alertI].y);
  },

  // ---------- per-frame ----------
  update(dt) {
    if (!G) return;
    // scrolling
    const sp = 900 * dt;
    let dx = 0, dy = 0;
    if (this.keys.ArrowLeft) dx -= sp; if (this.keys.ArrowRight) dx += sp;
    if (this.keys.ArrowUp) dy -= sp; if (this.keys.ArrowDown) dy += sp;
    if (this.mouse.inside && !this.drag && !this.pan && document.hasFocus()) {
      const m = 14;
      if (this.mouse.x < m) dx -= sp; if (this.mouse.x > this.canvas.width - m) dx += sp;
      if (this.mouse.y < m) dy -= sp; if (this.mouse.y > this.canvas.height - m) dy += sp;
    }
    if (dx || dy) { this.cam.x += dx; this.cam.y += dy; this.clampCam(); }
    this.mouseWorld = this.toWorld(this.mouse.x, this.mouse.y);
    this.hover = this.mouse.inside ? this.entityAt(this.mouseWorld.x, this.mouseWorld.y) : null;
    if (this.drag) { this.drag.x1 = this.mouse.x; this.drag.y1 = this.mouse.y; }
    if (this.placing) {
      const def = BUILDINGS[this.placing.key];
      this.placing.tx = Math.floor(this.mouseWorld.x / TILE - def.w / 2 + 0.5);
      this.placing.ty = Math.floor(this.mouseWorld.y / TILE - def.h / 2 + 0.5);
      const q = G.playerTeam.queues[this.placing.qtype];
      if (!q.ready && !(this.placing.sticky && q.head === this.placing.key)) this.placing = null;
    }
    this.selection = this.selection.filter(e => !e.dead && (e.team === G.player || G.isVisibleTo(e, G.player)));
    for (const c of this.clickMarks) c.t += dt;
    this.clickMarks = this.clickMarks.filter(c => c.t < 0.5);
    this.updateCursor();
    this.sidebarT -= dt;
    if (this.sidebarT <= 0) { this.sidebarT = 0.1; this.updateSidebar(); }
    // smooth credit counter like the classics
    const target = Math.floor(G.playerTeam.credits);
    const diff = target - this.displayCredits;
    this.displayCredits += Math.sign(diff) * Math.min(Math.abs(diff), Math.max(5, Math.abs(diff) * 8 * dt));
    document.getElementById('credits').textContent = '$ ' + Math.floor(this.displayCredits).toLocaleString();
    this.updateMessages();
  },

  radarOn() { const t = G.playerTeam; return (G.mission && G.mission.def.radar) || (t.countOf('radar') > 0 && !t.lowPower); },

  drawMinimap() {
    const c = this.minimap, ctx = this.mctx, W = c.width, H = c.height;
    const m = G.map;
    if (!this.radarOn()) {
      const img = ctx.createImageData(W, H);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 40; img.data[i] = v; img.data[i + 1] = v + 8; img.data[i + 2] = v; img.data[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = '#6a7'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(G.playerTeam.countOf('radar') ? 'LOW POWER' : 'NO RADAR', W / 2, H / 2 - 4);
      ctx.font = '10px monospace'; ctx.fillStyle = '#586';
      ctx.fillText(G.playerTeam.countOf('radar') ? 'Build more Power Plants' : 'Build a Radar Station', W / 2, H / 2 + 12);
      return;
    }
    // ground, ore, structures and fog go through the diamond transform, one canvas pixel per tile
    const S = m.w + m.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#03070c'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(W / S, H / S, -W / S, H / S, m.h * W / S, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(m.miniCanvas, 0, 0, m.w, m.h);
    for (let i = 0; i < m.ore.length; i++) {
      if (m.ore[i] > 30 && G.explored[i]) {
        ctx.fillStyle = m.oreType[i] === GEM ? '#5ee' : '#d9a830';
        ctx.fillRect(i % m.w, Math.floor(i / m.w), 1, 1);
      }
    }
    const units = [];
    for (const e of G.entities) {
      if (e.dead || e.aboard || !G.isVisibleTo(e, G.player)) continue;
      if (e.kind !== 'building') { units.push(e); continue; }
      ctx.fillStyle = e.team === NEUTRAL ? '#8a8f96' : G.teamOf(e.team).color;
      ctx.fillRect(e.tx, e.ty, e.w, e.h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(Render.fogHi || Render.fogCanvas, 0, 0, m.w, m.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // units on top of the fog as dots with a dark rim: ships bigger, aircraft as crosses
    for (const e of units) {
      const [x, y] = this.miniXY(e.x, e.y), col = G.teamOf(e.team).color;
      if (e.air) {
        ctx.fillStyle = '#000'; ctx.fillRect(x - 2.5, y - 1, 5, 2); ctx.fillRect(x - 1, y - 2.5, 2, 5);
        ctx.fillStyle = col; ctx.fillRect(x - 2, y - 0.5, 4, 1); ctx.fillRect(x - 0.5, y - 2, 1, 4);
      } else {
        const r = e.def.naval ? 2.5 : e.def.cat === 'infantry' ? 1.2 : 1.6;
        ctx.fillStyle = '#000'; ctx.fillRect(x - r - 0.7, y - r - 0.7, r * 2 + 1.4, r * 2 + 1.4);
        ctx.fillStyle = col; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // what the main view shows: a plain rectangle, since the minimap is turned like the view
    const [vx0, vy0] = this.miniXY(this.toWorld(0, 0).x, this.toWorld(0, 0).y);
    const br = this.toWorld(this.canvas.width, this.canvas.height), [vx1, vy1] = this.miniXY(br.x, br.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    if (G.mission) {
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2;
      for (const mk of G.mission.markers) { const [x, y] = this.miniXY(mk.x, mk.y); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke(); }
    }
    // alerts: a ring closes in on the spot, then it keeps pulsing for a few seconds
    for (const p of G.pings || []) {
      const age = G.time - p.t;
      if (age > PING_LIFE) continue;
      const [x, y] = this.miniXY(p.x, p.y);
      ctx.strokeStyle = PING_COLORS[p.kind] || '#f33';
      ctx.lineWidth = 2;
      if (age < 0.8) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 4 + 40 * (1 - age / 0.8), 0, Math.PI * 2); ctx.stroke(); }
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 1 - age / PING_LIFE;
      ctx.beginPath(); ctx.arc(x, y, 3 + (age * 12) % 9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 1;
  },

  // ---------- sidebar ----------
  buildTabs() {
    const el = document.getElementById('tabs');
    el.innerHTML = '';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.className = 'tab'; b.dataset.tab = t.id; b.textContent = t.label;
      b.title = t.label + ' (' + TAB_KEYS[t.id] + ')';
      const hk = document.createElement('span'); hk.className = 'tkey'; hk.textContent = TAB_KEYS[t.id]; b.appendChild(hk);
      b.addEventListener('click', () => { Sfx.resume(); this.setTab(t.id); Sfx.play('click'); });
      el.appendChild(b);
    }
  },

  setTab(id) { this.tab = id; this.buildGridKey = null; this.updateSidebar(); },

  icon(key, team = G.playerTeam) {
    const k = key + team.faction + team.color + '|' + Art.version + '|' + (team.upgrades ? ULTIMATES.map(u => team.upgrades[UNITS[u].refit] || 0).join('') : '');
    if (!this.iconCache[k]) this.iconCache[k] = drawIcon(key, team, 92, 81);
    return this.iconCache[k];
  },

  // cameo picture: artwork from the style guide when available, otherwise a rendered icon
  cameo(key, team = G.playerTeam) {
    const wrap = document.createElement('div');
    wrap.className = 'bpic';
    const fallback = () => {
      const ic = this.icon(key, team);
      const cv = document.createElement('canvas'); cv.width = ic.width; cv.height = ic.height;
      cv.getContext('2d').drawImage(ic, 0, 0);
      wrap.innerHTML = ''; wrap.appendChild(cv);
    };
    const url = cameoUrl(key, team.faction);
    if (url) {
      const img = new Image();
      img.draggable = false; img.onerror = fallback; img.src = url;
      wrap.appendChild(img);
    } else fallback();
    return wrap;
  },

  buildGrid() {
    const t = G.playerTeam;
    const tab = TABS.find(x => x.id === this.tab);
    const list = tab.list.filter(k => inRoster(k, t.faction) && G.allows(k));
    const grid = document.getElementById('build-grid');
    grid.innerHTML = '';
    this.buttons = {};
    this.hotkeys = buildHotkeys(list);
    for (const key of list) {
      const def = defOf(key);
      const b = document.createElement('div');
      b.className = 'bitem';
      b.appendChild(this.cameo(key));
      const name = document.createElement('div'); name.className = 'bname'; name.textContent = this.itemName(key); b.appendChild(name);
      const cost = document.createElement('div'); cost.className = 'bcost'; cost.textContent = '$' + t.costOf(key); b.appendChild(cost);
      if (this.hotkeys[key]) { const hk = document.createElement('div'); hk.className = 'bkey'; hk.textContent = this.hotkeys[key]; b.appendChild(hk); }
      const prog = document.createElement('div'); prog.className = 'bprog'; b.appendChild(prog);
      const status = document.createElement('div'); status.className = 'bstatus'; b.appendChild(status);
      const count = document.createElement('div'); count.className = 'bcount'; b.appendChild(count);
      b.addEventListener('mousedown', e => {
        Sfx.resume();
        if (e.button === 0) this.clickBuild(key, false, e.shiftKey);
        else if (e.button === 2) this.clickBuild(key, true, e.shiftKey);
      });
      b.addEventListener('mouseenter', () => this.showTip(key, b));
      b.addEventListener('mouseleave', () => this.hideTip());
      grid.appendChild(b);
      this.buttons[key] = { el: b, prog, status, count };
    }
  },

  clickBuild(key, right, shift) {
    const t = G.playerTeam;
    const qt = queueTypeOf(key);
    const q = t.queues[qt];
    if (right) {
      if (q.head === key && !q.paused && !q.ready && q.progress > 0 && q.items.filter(k => k === key).length === 1) { q.paused = true; G.eva('On hold', G.player); }
      else if (q.cancel(key)) { G.eva('Cancelled', G.player); if (this.placing && this.placing.key === key) this.placing = null; }
      Sfx.play('click');
      return;
    }
    if (!t.canBuild(key)) { Sfx.play('error'); return; }
    if (q.isStructure()) {
      if (q.head === key) {
        if (q.ready) { this.placing = { key, qtype: qt, tx: 0, ty: 0 }; this.mode = null; this.superTargeting = false; Sfx.play('click'); return; }
        if (q.paused) { q.paused = false; G.eva('Building', G.player); return; }
        return;
      }
      if (q.items.length) { G.eva('Unable to comply, building in progress', G.player); Sfx.play('error'); return; }
      q.add(key); G.eva('Building', G.player); Sfx.play('click');
      return;
    }
    if (q.head === key && q.paused) { q.paused = false; G.eva('Training', G.player); return; }
    const n = shift ? 5 : 1;
    let added = 0;
    for (let i = 0; i < n; i++) if (q.add(key)) added++;
    if (added) { G.eva(qt === 'infantry' ? 'Training' : 'Building', G.player); Sfx.play('click'); }
    else Sfx.play('error');
  },

  showTip(key, el) {
    const def = defOf(key), t = G.playerTeam;
    const tip = document.getElementById('tooltip');
    const reqs = (def.req || []).filter(r => !t.countOf(r)).map(r => BUILDINGS[r].name);
    if (UNITS[key] && !t.countOf(def.from)) reqs.unshift(BUILDINGS[def.from].name);
    let stats = '';
    const lv = t.levelOf(key);
    if (def.levels) stats = t.researched(key) ? `Fully refitted: Mk IV` : `${lv.text} · ${lv.time}s`;
    else if (UPGRADES[key]) stats = t.upgrades[key] ? 'Researched' : `Research · ${def.time}s · once per match`;
    else if (def.ultimate) {
      const u = t.ultDef(key);
      stats = `Mk ${MK[u.tier - 1]} · HP ${u.hp} · Speed ${u.speed} · Range ${Math.max(...[u.weapon, u.weapon2, u.weapon3].filter(Boolean).map(w => w.range))} · one at a time` + (t.countOf(key) ? ' · in the field' : '');
    }
    else if (BUILDINGS[key]) stats = `Power: ${def.power > 0 ? '+' : ''}${def.power}` + (STRUCTURE_UPGRADES[key] ? ` · Mk II for $${upgradeCostOf(key)}: ${STRUCTURE_UPGRADES[key].text}` : '');
    else if (def.weapon) stats = `HP ${def.hp} · Speed ${def.speed} · Range ${def.weapon.range}`;
    else stats = `HP ${def.hp} · Speed ${def.speed}`;
    const role = nameOf(key, t.faction) !== def.name ? `<div class="trole">${def.name}</div>` : '';
    tip.innerHTML = `<b>${this.itemName(key)}</b> <span class="tcost">$${t.costOf(key)}</span>${role}<div>${def.desc}</div><div class="tstat">${stats}</div>` +
      (reqs.length ? `<div class="treq">Requires: ${[...new Set(reqs)].join(', ')}</div>` : '') +
      `<div class="thelp">${this.hotkeys && this.hotkeys[key] ? `<kbd>${this.hotkeys[key]}</kbd> · ` : ''}Left: ${UPGRADES[key] ? 'research' : 'build'}${BUILDINGS[key] ? ' / place' : UPGRADES[key] ? '' : ' (Shift ×5)'} · Right: hold / cancel</div>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, r.top) + 'px';
    tip.style.left = (r.left - tip.offsetWidth - 10) + 'px';
  },
  // a build item's name; an ultimate refit says which Mk it fits next
  itemName(key) {
    const def = defOf(key), t = G.playerTeam;
    if (!def.levels) return nameOf(key, t.faction);
    return `${UNITS[def.ult].name.split(' ')[0]} Mk ${MK[Math.min(3, (t.upgrades[key] || 0) + 1)]}`;
  },
  hideTip() { document.getElementById('tooltip').hidden = true; },

  updateSidebar() {
    const t = G.playerTeam;
    // tabs
    for (const el of document.querySelectorAll('#tabs .tab')) {
      const id = el.dataset.tab;
      const prod = PRODUCER_OF[id === 'defense' ? 'structure' : id];
      el.classList.toggle('active', id === this.tab);
      el.classList.toggle('disabled', !t.countOf(prod));
      el.classList.toggle('ready', t.queues[id].ready);
    }
    const gridKey = this.tab + '|' + t.faction + '|' + Art.version + '|' + ULTIMATES.map(k => t.ultTier(k)).join('');
    if (this.buildGridKey !== gridKey) { this.buildGridKey = gridKey; this.buildGrid(); }
    const q = t.queues[this.tab];
    for (const key in this.buttons) {
      const b = this.buttons[key];
      const can = t.canBuild(key);
      b.el.classList.toggle('locked', !can);
      const isHead = q.head === key;
      const n = q.items.filter(k => k === key).length;
      b.count.textContent = n > 1 ? n : '';
      let st = '';
      if (UPGRADES[key] && t.researched(key)) st = 'DONE';
      else if (UNITS[key] && UNITS[key].ultimate && t.countOf(key)) st = 'DEPLOYED';
      else if (isHead && q.ready) st = 'READY';
      else if (isHead && q.paused) st = 'ON HOLD';
      else if (isHead && q.broke) st = 'NO FUNDS';
      b.status.textContent = st;
      b.el.classList.toggle('ready', isHead && q.ready);
      const p = isHead ? q.progress : 0;
      b.prog.style.background = isHead && !q.ready ? `conic-gradient(transparent ${p * 360}deg, rgba(0,0,0,0.65) ${p * 360}deg)` : 'none';
      b.el.classList.toggle('busy', q.isStructure() && q.items.length > 0 && !isHead);
    }
    // power
    const pb = document.getElementById('power-fill'), pu = document.getElementById('power-use');
    const max = Math.max(t.powerOut, t.powerIn, 1);
    pb.style.height = (t.powerOut / max * 100) + '%';
    pu.style.bottom = (Math.min(t.powerIn, max) / max * 100) + '%';
    pb.className = t.lowPower ? 'low' : (t.powerOut - t.powerIn < 50 ? 'warn' : '');
    document.getElementById('power-text').textContent = `${t.powerIn}/${t.powerOut}`;
    // super
    const sbtn = document.getElementById('btn-super');
    const hasSuper = t.countOf(t.superKey()) > 0;
    sbtn.hidden = !hasSuper;
    if (hasSuper) {
      const sw = BUILDINGS[t.superKey()].superweapon;
      const left = Math.max(0, sw.charge - t.superTimer);
      sbtn.textContent = t.superReady ? '⚡ ' + BUILDINGS[t.superKey()].name.toUpperCase() + ' READY' :
        BUILDINGS[t.superKey()].name + ' ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
      sbtn.classList.toggle('ready', t.superReady);
    }
    // enemy superweapon timer
    const ebox = document.getElementById('enemy-super');
    const foe = G.teams.find(o => G.hostile(o.id, G.player) && o.countOf(o.superKey()) > 0 &&
      G.entities.some(e => e.team === o.id && e.key === o.superKey() && e.seen));
    if (foe && !(G.mission && G.mission.clock)) {
      const sw = BUILDINGS[foe.superKey()].superweapon;
      const left = Math.max(0, sw.charge - foe.superTimer);
      ebox.hidden = false;
      ebox.textContent = 'Enemy ' + BUILDINGS[foe.superKey()].name + ': ' + (foe.superReady ? 'READY' : Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'));
    } else ebox.hidden = true;
    // defense mode wave counter
    const wbox = document.getElementById('wave-info'), W = G.waves;
    wbox.hidden = !W;
    if (W) {
      const left = W.countdown;
      const txt = left === null ? `Final wave · ${W.units().length} attackers left` :
        `Wave ${W.wave}/${W.total} · next in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      const el = document.getElementById('wave-text');
      if (el.textContent !== txt) el.textContent = txt;
      document.getElementById('wave-call').hidden = left === null;
    }
    this.updateMission(ebox.hidden && wbox.hidden ? 12 : 52);
    document.getElementById('btn-sell').classList.toggle('on', this.mode === 'sell');
    document.getElementById('btn-repair').classList.toggle('on', this.mode === 'repair');
    document.getElementById('btn-upgrade').classList.toggle('on', this.mode === 'upgrade');
    this.updateSelInfo();
    this.updateGroups();
  },

  // the control group strip along the bottom of the view
  updateGroups() {
    let html = '';
    for (let n = 1; n <= 10; n++) {
      const d = String(n % 10), g = (this.groups[d] || []).filter(u => !u.dead && u.team === G.player);
      if (!g.length) continue;
      const on = g.every(u => this.selection.includes(u));
      html += `<button data-g="${d}" class="${on ? 'on' : ''}" title="Group ${d}: click to select, twice to jump"><b>${d}</b>${g.length}</button>`;
    }
    if (html !== this.groupsHtml) { const el = document.getElementById('groups'); el.innerHTML = html; this.groupsHtml = html; }
  },

  // campaign: objectives (and the mission clock) top-left, radio transmissions bottom-left
  updateMission(top) {
    const M = G.mission, box = document.getElementById('objectives'), radio = document.getElementById('radio');
    box.hidden = !M; radio.hidden = !M || !M.current;
    if (!M) return;
    box.style.top = top + 'px';
    const mark = { active: '◇', done: '✓', failed: '✗' };
    let html = '<div class="ob-head">Objectives</div>';
    if (M.clock) {
      const left = Math.max(0, M.clock.end - G.time);
      html += `<div class="ob-clock${left < 60 ? ' urgent' : ''}">${M.clock.label} ${Main.clock(left)}${M.clock.paused ? ' <small>STALLED: NO POWER</small>' : ''}</div>`;
    }
    for (const o of M.objectives) html += `<div class="ob ${o.state}${o.optional ? ' bonus' : ''}">${mark[o.state]} ${o.text}${o.optional ? ' <i>bonus</i>' : ''}</div>`;
    if (html !== this.obHtml) { box.innerHTML = html; this.obHtml = html; }
    if (M.current) {
      const c = M.current, who = CAST[c.who] || { name: c.who, role: '', color: '#ddd' };
      const key = c.t + c.who;
      if (this.radioKey !== key) {
        this.radioKey = key;
        radio.style.setProperty('--who', who.color);
        radio.innerHTML = `<div class="rd-who">${who.name}<span>${who.role}</span></div><div class="rd-text">${c.text}</div>`;
        radio.classList.remove('in'); void radio.offsetWidth; radio.classList.add('in');
      }
    }
  },

  updateSelInfo() {
    const el = document.getElementById('sel-info');
    const sel = this.selection.filter(e => !e.dead);
    if (!sel.length) { this.selKey = null; el.innerHTML = '<div class="hint">Drag to select units · Right-click to command<br>A attack-move · S stop · D deploy / dig in / lay mine · Ctrl+# group · F1 all keys</div>'; return; }
    if (sel.length === 1) {
      const e = sel[0];
      const tm = G.teamOf(e.team);
      let extra = '';
      if (e.kind === 'unit') {
        if (e.rank) extra += `<span class="rank">${e.rank === 2 ? 'ELITE' : 'VETERAN'}</span> `;
        if (e.def.ultimate) {
          extra += `<span class="rank">ULTIMATE MK ${MK[e.def.tier - 1]}</span> `;
          if (e.team === G.player && e.def.tier < 4) extra += `<span class="uptag">Next refit at the ${BUILDINGS[e.def.from].name}: ${UPGRADES[e.def.refit].levels[e.def.tier - 1].text}</span><br>`;
        }
        const research = Object.keys(tm.upgrades || {}).filter(k => UPGRADES[k] && UPGRADES[k].cat === e.def.cat && !UPGRADES[k].ult).map(k => UPGRADES[k].name);
        if (research.length) extra += `<span class="uptag">${research.join(' · ')}</span><br>`;
        if (e.def.harvester) extra += `Cargo: ${Math.round(e.cargo)}/${e.def.capacity}`;
        else if (e.def.mcv) extra += 'Press D or click it again to deploy';
        else if (e.def.engineer) extra += 'Right-click enemy structure to capture';
        else if (e.def.demo) extra += `${G.stealthRange(e) < 1e9 ? 'Hidden' : 'Spotted'} · Kills: ${e.kills} · Right-click a structure for C4`;
        else if (e.def.mines) extra += `Mines ${e.minesLeft ?? e.def.mines.carry}/${e.def.mines.carry}` + (e.team === G.player ? ' · D to lay a mine' : '');
        else if (e.def.mend) extra += e.def.cat === 'infantry' ? 'Treats wounded infantry nearby' : 'Repairs damaged vehicles nearby';
        else if (e.def.transport) extra += `Carrying ${cargoUsed(e)}/${e.def.transport}` + (e.team === G.player ? (e.passengers.length ? ' · D to unload' : ' · Right-click it with troops to board') : '');
        else if (e.def.stealth && !e.def.submarine) extra += `${G.stealthRange(e) < 1e9 ? 'Hidden' : 'Revealed'} · Kills: ${e.kills}`;
        else if (e.def.submarine) extra += `${G.submerged(e) ? 'Submerged' : 'Surfaced'} · Kills: ${e.kills}`;
        else extra += `Kills: ${e.kills}`;
        if (e.def.dig && e.team === G.player) extra += e.dug ? ' · Dug in, D to get up' : ' · D to dig in';
      } else if (e.def.garrison) {
        const n = e.garrison ? e.garrison.length : 0;
        extra = `Garrison ${n}/${e.def.garrison}`;
        if (e.team === G.player && n) extra += ' · D to evacuate';
        else if (e.team === NEUTRAL || e.team === G.player) extra += ' · Right-click with infantry to garrison';
      } else {
        const p = e.def.power > 0 ? Math.round(e.def.power * (e.level > 1 ? STRUCTURE_UPGRADES[e.key].power || 1 : 1)) : e.def.power;
        extra = `Power ${p > 0 ? '+' : ''}${p}`;
        if (e.def.produces && e.def.produces !== 'structure' && e.team === G.player) extra += ' · Right-click map to set rally';
      }
      const up = e.kind === 'building' && STRUCTURE_UPGRADES[e.key];
      if (up && e.level > 1) extra = `<span class="rank">MK II</span> ${up.text} · ` + extra;
      else if (up && e.refit !== null && e.refit !== undefined) extra = `<span class="rank">UPGRADING ${Math.floor(e.refit * 100)}%</span> ` + extra;
      else if (up && e.team === G.player) {
        const ok = G.canUpgrade(e) && G.playerTeam.credits >= upgradeCostOf(e.key);
        const why = !G.playerTeam.countOf(STRUCTURE_UPGRADE_REQ) ? `Needs a ${BUILDINGS[STRUCTURE_UPGRADE_REQ].name}` : up.text;
        extra += `<button class="upbtn${ok ? '' : ' off'}" data-upgrade="${e.id}" title="${up.text} (or press ' and click a structure)">Upgrade to Mk II · $${upgradeCostOf(e.key)}</button><div class="uptext">${why}</div>`;
      }
      const html = `<div class="sname" style="color:${tm.light}">${nameOf(e.key, tm.faction)}</div>
        <div class="shp"><div style="width:${e.hp / e.maxHp * 100}%"></div></div>
        <div class="sextra">${Math.ceil(e.hp)}/${e.maxHp} · ${extra}</div>`;
      if (this.selKey !== e.id) {
        this.selKey = e.id;
        el.innerHTML = '<div class="selrow"><div class="selpic"></div><div class="seltext"></div></div>';
        el.querySelector('.selpic').appendChild(this.cameo(e.key, tm));
      }
      el.querySelector('.seltext').innerHTML = html;
      return;
    }
    this.selKey = null;
    const counts = {};
    for (const e of sel) { const n = nameOf(e.key, G.teamOf(e.team).faction); counts[n] = (counts[n] || 0) + 1; }
    el.innerHTML = `<div class="sname">${sel.length} selected</div><div class="sextra">` +
      Object.entries(counts).map(([n, c]) => `${c}× ${n}`).join('<br>') + '</div>';
  },

  flashMessages() { this.msgDirty = true; },
  updateMessages() {
    const el = document.getElementById('messages');
    const now = G.time;
    const msgs = G.messages.filter(m => now - m.t < 5);
    const html = msgs.map(m => `<div style="opacity:${Math.min(1, (5 - (now - m.t)))}">${m.text}</div>`).join('');
    if (html !== this.lastMsgHtml) { el.innerHTML = html; this.lastMsgHtml = html; }
  },
};
