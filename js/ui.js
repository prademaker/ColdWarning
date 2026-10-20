// ColdWarning — input handling, camera, sidebar, minimap.
'use strict';

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
    this.selection = []; this.placing = null; this.mode = null; this.superTargeting = false; this.groups = {};
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
    G.on('eva', msg => { Sfx.say(msg); this.flashMessages(); });
    G.on('sound', (name, x, y) => {
      if (x !== undefined) {
        const m = 100;
        if (x < this.cam.x - m || y < this.cam.y - m || x > this.cam.x + this.canvas.width + m || y > this.cam.y + this.canvas.height + m) return;
      }
      Sfx.play(name);
    });
  },

  resize() {
    const sb = document.getElementById('sidebar');
    this.canvas.width = window.innerWidth - sb.offsetWidth;
    this.canvas.height = window.innerHeight;
    this.clampCam();
  },

  centerOn(x, y) {
    this.cam.x = x - this.canvas.width / 2;
    this.cam.y = y - this.canvas.height / 2;
    this.clampCam();
  },

  clampCam() {
    if (!G) return;
    const W = G.map.w * TILE, H = G.map.h * TILE;
    this.cam.x = Math.max(-40, Math.min(W - this.canvas.width + 40, this.cam.x));
    this.cam.y = Math.max(-40, Math.min(H - this.canvas.height + 40, this.cam.y));
  },

  toWorld(sx, sy) { return { x: sx + this.cam.x, y: sy + this.cam.y }; },

  // ---------- picking ----------
  entityAt(wx, wy) {
    let best = null, bd = 1e9;
    for (const e of G.entities) {
      if (e.dead || e.kind !== 'unit') continue;
      if (!G.isVisibleTo(e, G.player)) continue;
      const d = Math.hypot(e.x - wx, e.y - (e.alt || 0) - wy);
      if (d < e.def.radius + 5 && d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (!G.map.inside(tx, ty)) return null;
    const id = G.map.bld[G.map.idx(tx, ty)];
    if (id >= 0) {
      const b = G.byId.get(id);
      if (b && !b.dead && G.isVisibleTo(b, G.player)) return b;
    }
    return null;
  },

  ownSelected() { return this.selection.filter(e => !e.dead && e.team === G.player); },
  ownUnits() { return this.ownSelected().filter(e => e.kind === 'unit'); },

  select(list, add) {
    if (!add) this.selection = [];
    for (const e of list) if (!this.selection.includes(e)) this.selection.push(e);
    if (list.length) Sfx.play('click');
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
    this.minimap.addEventListener('mousedown', e => this.onMinimap(e, true));
    this.minimap.addEventListener('mousemove', e => { if (e.buttons & 1) this.onMinimap(e, false); });
    this.minimap.addEventListener('contextmenu', e => e.preventDefault());
    for (const [id, fn] of [['btn-repair', () => this.toggleMode('repair')], ['btn-sell', () => this.toggleMode('sell')],
      ['btn-super', () => this.startSuper()], ['btn-pause', () => Main.togglePause()], ['btn-sound', () => this.toggleSound()]]) {
      document.getElementById(id).addEventListener('click', () => { Sfx.resume(); fn(); });
    }
  },

  toggleSound() {
    Sfx.muted = !Sfx.muted;
    if (Sfx.muted && window.speechSynthesis) speechSynthesis.cancel();
    document.getElementById('btn-sound').classList.toggle('off', Sfx.muted);
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
    else if (this.mode === 'repair') cur = 'help';
    else if (this.mode === 'amove' || this.superTargeting) cur = 'crosshair';
    else if (this.hover && this.hover.team !== G.player && this.ownUnits().length) cur = 'crosshair';
    else if (this.hover && this.hover.team === G.player) cur = 'pointer';
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
    if (this.drag) { const w = this.toWorld(this.mouse.x, this.mouse.y); this.drag.x1 = w.x; this.drag.y1 = w.y; }
  },

  onDown(e) {
    if (!G || G.over) return;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    if (e.button === 1) { this.pan = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y }; e.preventDefault(); return; }
    if (e.button === 2) { this.onRight(w, e); return; }
    if (e.button !== 0) return;
    if (this.placing) {
      const ok = G.tryPlace(G.player, this.placing.qtype, this.placing.tx, this.placing.ty);
      if (ok) this.placing = null; else { Sfx.play('error'); G.eva('Cannot deploy here', G.player); }
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
    if (this.mode === 'amove') {
      const units = this.ownUnits();
      if (ent && ent.team !== G.player) G.commandAttack(units, ent);
      else G.commandMove(units, Math.floor(w.x / TILE), Math.floor(w.y / TILE), true);
      this.mark(w.x, w.y, '#f84');
      this.mode = null; this.updateCursor();
      return;
    }
    this.drag = { x0: w.x, y0: w.y, x1: w.x, y1: w.y, shift: e.shiftKey, ent };
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
          const q = { cc: 'structure', barracks: 'infantry', factory: 'vehicle', airfield: 'air' }[ent.key];
          if (q) this.setTab(q);
        }
      } else if (!d.shift) this.selection = [];
      return;
    }
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    const list = G.entities.filter(e => e.kind === 'unit' && !e.dead && e.team === G.player &&
      e.x >= x0 && e.x <= x1 && e.y - (e.alt || 0) >= y0 && e.y - (e.alt || 0) <= y1);
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
    const cx = this.cam.x, cy = this.cam.y, W = this.canvas.width, H = this.canvas.height;
    const list = G.entities.filter(o => o.kind === 'unit' && !o.dead && o.team === G.player && o.key === ent.key &&
      o.x >= cx && o.x <= cx + W && o.y >= cy && o.y <= cy + H);
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
    if (ent && ent.team !== G.player) {
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

  onMinimap(e, down) {
    if (!G || !this.radarOn()) return;
    const r = this.minimap.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * G.map.w * TILE, my = (e.clientY - r.top) / r.height * G.map.h * TILE;
    if (e.button === 2 && down) {
      const units = this.ownUnits();
      if (units.length) { G.commandMove(units, Math.floor(mx / TILE), Math.floor(my / TILE), false); this.mark(mx, my, '#7f7'); }
      return;
    }
    if (e.buttons & 1) this.centerOn(mx, my);
  },

  onKey(e, down) {
    if (!G || document.getElementById('game').hidden) return;
    const k = e.key;
    this.keys[k] = down;
    if (!down) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (k === 'Escape') { if (!this.cancelModes()) this.selection = []; return; }
    if (k === 'p' || k === 'P') { Main.togglePause(); return; }
    if (k === 'm' || k === 'M') { this.toggleSound(); return; }
    if (G.over || Main.paused) return;
    if (/^[0-9]$/.test(k)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.groups[k] = this.ownSelected().filter(x => x.kind === 'unit'); G.eva('Team ' + k + ' assigned', G.player); }
      else {
        const g = (this.groups[k] || []).filter(x => !x.dead && x.team === G.player);
        this.groups[k] = g;
        if (!g.length) return;
        if (this.lastGroupKey === k && performance.now() - this.lastGroupT < 400) {
          const cx = g.reduce((s, u) => s + u.x, 0) / g.length, cy = g.reduce((s, u) => s + u.y, 0) / g.length;
          this.centerOn(cx, cy);
        }
        this.lastGroupKey = k; this.lastGroupT = performance.now();
        this.select(g, e.shiftKey);
      }
      return;
    }
    const lower = k.toLowerCase();
    if (lower === 'a' && this.ownUnits().length) { this.mode = 'amove'; this.placing = null; this.updateCursor(); return; }
    if (lower === 's' && !e.ctrlKey) { G.commandStop(this.ownUnits()); return; }
    if (lower === 'd') { for (const u of this.ownUnits()) if (u.def.mcv) G.deploy(u); return; }
    if (lower === 'h') { const cc = G.entities.find(b => b.key === 'cc' && b.team === G.player); if (cc) this.centerOn(cc.x, cc.y); return; }
    if (k === ' ') { e.preventDefault(); if (G.alertPos) this.centerOn(G.alertPos.x, G.alertPos.y); return; }
    if (k === 'Tab') {
      e.preventDefault();
      const i = TABS.findIndex(t => t.id === this.tab);
      this.setTab(TABS[(i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length].id);
      return;
    }
    if (lower === 'z') { this.toggleMode('sell'); return; }
    if (lower === 'x') { this.toggleMode('repair'); return; }
    if (lower === 'f') { this.startSuper(); return; }
    // build hotkeys within current tab
    const tab = TABS.find(t => t.id === this.tab);
    for (const key of tab.list) {
      const def = defOf(key);
      if (def.key && def.key.toLowerCase() === lower && (!def.pkg || def.pkg === G.playerTeam.pkg)) { this.clickBuild(key, false, e.shiftKey); return; }
    }
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
    if (this.drag) { this.drag.x1 = this.mouseWorld.x; this.drag.y1 = this.mouseWorld.y; }
    if (this.placing) {
      const def = BUILDINGS[this.placing.key];
      this.placing.tx = Math.floor(this.mouseWorld.x / TILE - def.w / 2 + 0.5);
      this.placing.ty = Math.floor(this.mouseWorld.y / TILE - def.h / 2 + 0.5);
      const q = G.playerTeam.queues[this.placing.qtype];
      if (!q.ready) this.placing = null;
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

  radarOn() { const t = G.playerTeam; return t.countOf('radar') > 0 && !t.lowPower; },

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
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(m.miniCanvas, 0, 0, W, H);
    const sx = W / m.w, sy = H / m.h;
    ctx.fillStyle = '#d9a830';
    for (let i = 0; i < m.ore.length; i++) {
      if (m.ore[i] > 30 && G.explored[i]) {
        ctx.fillStyle = m.oreType[i] === GEM ? '#5ee' : '#d9a830';
        ctx.fillRect((i % m.w) * sx, Math.floor(i / m.w) * sy, sx + 0.5, sy + 0.5);
      }
    }
    for (const e of G.entities) {
      if (e.dead || !G.isVisibleTo(e, G.player)) continue;
      ctx.fillStyle = G.teams[e.team].color;
      if (e.kind === 'building') ctx.fillRect(e.tx * sx, e.ty * sy, e.w * sx, e.h * sy);
      else ctx.fillRect(e.x / TILE * sx - 1, e.y / TILE * sy - 1, 2.5, 2.5);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(Render.fogCanvas, 0, 0, W, H);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(this.cam.x / TILE * sx + 0.5, this.cam.y / TILE * sy + 0.5, this.canvas.width / TILE * sx, this.canvas.height / TILE * sy);
    if (G.alertPos && G.time - G.alertPos.t < 4) {
      const r = 6 + ((G.time - G.alertPos.t) * 10) % 10;
      ctx.strokeStyle = '#f33'; ctx.beginPath(); ctx.arc(G.alertPos.x / TILE * sx, G.alertPos.y / TILE * sy, r, 0, Math.PI * 2); ctx.stroke();
    }
  },

  // ---------- sidebar ----------
  buildTabs() {
    const el = document.getElementById('tabs');
    el.innerHTML = '';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.className = 'tab'; b.dataset.tab = t.id; b.textContent = t.label;
      b.addEventListener('click', () => { Sfx.resume(); this.setTab(t.id); Sfx.play('click'); });
      el.appendChild(b);
    }
  },

  setTab(id) { this.tab = id; this.buildGridKey = null; this.updateSidebar(); },

  icon(key, team = G.playerTeam) {
    const k = key + team.faction + team.color;
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
    const list = tab.list.filter(k => !defOf(k).pkg || defOf(k).pkg === t.pkg);
    const grid = document.getElementById('build-grid');
    grid.innerHTML = '';
    this.buttons = {};
    for (const key of list) {
      const def = defOf(key);
      const b = document.createElement('div');
      b.className = 'bitem';
      b.appendChild(this.cameo(key));
      const name = document.createElement('div'); name.className = 'bname'; name.textContent = nameOf(key, t.faction); b.appendChild(name);
      const cost = document.createElement('div'); cost.className = 'bcost'; cost.textContent = '$' + t.costOf(key); b.appendChild(cost);
      if (def.key) { const hk = document.createElement('div'); hk.className = 'bkey'; hk.textContent = def.key; b.appendChild(hk); }
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
    if (BUILDINGS[key]) stats = `Power: ${def.power > 0 ? '+' : ''}${def.power}`;
    else if (def.weapon) stats = `HP ${def.hp} · Speed ${def.speed} · Range ${def.weapon.range}`;
    else stats = `HP ${def.hp} · Speed ${def.speed}`;
    const role = nameOf(key, t.faction) !== def.name ? `<div class="trole">${def.name}</div>` : '';
    tip.innerHTML = `<b>${nameOf(key, t.faction)}</b> <span class="tcost">$${t.costOf(key)}</span>${role}<div>${def.desc}</div><div class="tstat">${stats}</div>` +
      (reqs.length ? `<div class="treq">Requires: ${[...new Set(reqs)].join(', ')}</div>` : '') +
      `<div class="thelp">Left: build${BUILDINGS[key] ? ' / place' : ' (Shift ×5)'} · Right: hold / cancel</div>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, r.top) + 'px';
    tip.style.left = (r.left - tip.offsetWidth - 10) + 'px';
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
    const gridKey = this.tab + '|' + t.faction;
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
      if (isHead && q.ready) st = 'READY';
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
    const foe = G.teams.find(o => o.id !== G.player && o.countOf(o.superKey()) > 0 &&
      G.entities.some(e => e.team === o.id && e.key === o.superKey() && e.seen));
    if (foe) {
      const sw = BUILDINGS[foe.superKey()].superweapon;
      const left = Math.max(0, sw.charge - foe.superTimer);
      ebox.hidden = false;
      ebox.textContent = 'Enemy ' + BUILDINGS[foe.superKey()].name + ': ' + (foe.superReady ? 'READY' : Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'));
    } else ebox.hidden = true;
    document.getElementById('btn-sell').classList.toggle('on', this.mode === 'sell');
    document.getElementById('btn-repair').classList.toggle('on', this.mode === 'repair');
    this.updateSelInfo();
  },

  updateSelInfo() {
    const el = document.getElementById('sel-info');
    const sel = this.selection.filter(e => !e.dead);
    if (!sel.length) { this.selKey = null; el.innerHTML = '<div class="hint">Drag to select units · Right-click to command<br>A attack-move · S stop · D deploy · Ctrl+# group</div>'; return; }
    if (sel.length === 1) {
      const e = sel[0];
      const tm = G.teams[e.team];
      let extra = '';
      if (e.kind === 'unit') {
        if (e.rank) extra += `<span class="rank">${e.rank === 2 ? 'ELITE' : 'VETERAN'}</span> `;
        if (e.def.harvester) extra += `Cargo: ${Math.round(e.cargo)}/${e.def.capacity}`;
        else if (e.def.mcv) extra += 'Press D or click it again to deploy';
        else if (e.def.engineer) extra += 'Right-click enemy structure to capture';
        else extra += `Kills: ${e.kills}`;
      } else {
        extra = `Power ${e.def.power > 0 ? '+' : ''}${e.def.power}`;
        if (e.def.produces && e.def.produces !== 'structure' && e.team === G.player) extra += ' · Right-click map to set rally';
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
    for (const e of sel) { const n = nameOf(e.key, G.teams[e.team].faction); counts[n] = (counts[n] || 0) + 1; }
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
