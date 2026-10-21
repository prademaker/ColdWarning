// Cold War 2: 2030 — save and load. A save is the whole running Game written out as a graph:
// every object once, references between them by number, so units still point at their targets
// and the AI still remembers what it saw. Config tables (unit stats, factions, mission scripts)
// are stored by name, not copied, so a save picks up balance changes and only breaks where
// something it uses was removed. Saves live in localStorage, gzipped when the browser can.
'use strict';

const SAVE_VERSION = 1;

const SaveCodec = {
  // classes rebuilt on load. make() returns a fresh instance so fields added in newer code get
  // their defaults; the saved fields are then written over it.
  classes() {
    return {
      Game: { cls: Game },
      Team: { cls: Team, make: f => new Team(f.id, f.faction, f.isAI, 'normal', null, f.ally) },
      ProdQueue: { cls: ProdQueue, make: f => new ProdQueue(null, f.type) },
      Unit: { cls: Unit, make: f => new Unit(f.key, f.team, f.x, f.y) },
      Building: { cls: Building, make: f => new Building(f.key, f.team, f.tx, f.ty) },
      AI: { cls: AI },
      WaveDirector: { cls: WaveDirector, make: () => new WaveDirector({}, 'normal') },
      Mission: { cls: Mission, make: () => new Mission(null, null) },
      GameMap: { cls: GameMap },
    };
  },

  // fields that are rebuilt rather than stored (canvases, caches, listeners)
  skip: {
    Game: ['listeners', 'pf', 'cells', 'visible', 'neutral'],
    GameMap: ['terrainCanvas', 'miniCanvas', 'rng', 'decor', 'props'],
  },

  // read-only tables a save refers to by path, e.g. "UNITS/tank/weapon"
  roots() {
    const missions = {};
    for (const m of CAMPAIGN.missions) missions[m.id] = m;
    return { FACTIONS, THEATERS, WARHEADS, UNITS, ULTIMATE_TIERS, BUILDINGS, UPGRADES, STRUCTURE_UPGRADES, GARRISON, TABS, SIDES, DIFFICULTY, LINEUPS, MAP_SIZES, MAP_WATER, EXTRA_COLORS, DEFENSE, CAST, THEMES, MISSIONS: missions };
  },

  statics() {
    const out = new Map();
    const walk = (o, path, depth) => {
      if (!o || typeof o !== 'object' || out.has(o)) return;
      out.set(o, path);
      if (depth >= 4) return;
      for (const k of Object.keys(o)) walk(o[k], path + '/' + k, depth + 1);
    };
    for (const [name, table] of Object.entries(this.roots())) walk(table, name, 0);
    return out;
  },

  resolve(path) {
    let o = this.roots();
    for (const k of path.split('/')) { if (o == null) return undefined; o = o[k]; }
    return o;
  },

  encode(root) {
    const classes = this.classes(), names = new Map(Object.entries(classes).map(([n, c]) => [c.cls, n]));
    const statics = this.statics(), ids = new Map(), objs = [], todo = [], dropped = new Set();
    const SKIP = {};
    const val = (v, where) => {
      if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
      if (typeof v === 'number') return Number.isFinite(v) ? v : { $n: String(v) };
      if (typeof v !== 'object') { if (typeof v === 'function') dropped.add(where); return SKIP; }
      const s = statics.get(v);
      if (s) return { $s: s };
      let id = ids.get(v);
      if (id === undefined) {
        const proto = Object.getPrototypeOf(v);
        const plain = proto === Object.prototype || proto === null || Array.isArray(v) || v instanceof Map || v instanceof Set || ArrayBuffer.isView(v);
        if (!plain && !names.has(v.constructor)) { dropped.add(where + ':' + (v.constructor && v.constructor.name)); return SKIP; }
        id = objs.length; ids.set(v, id); objs.push(null); todo.push(v);
      }
      return { $r: id };
    };
    val(root, 'G');
    for (let i = 0; i < todo.length; i++) {
      const v = todo[i];
      let o;
      if (Array.isArray(v)) o = { a: v.map((x, k) => { const e = val(x, k); return e === SKIP ? null : e; }) };
      else if (ArrayBuffer.isView(v)) o = { t: v.constructor.name, b: this.bytesToB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
      else if (v instanceof Map) o = { m: [...v].map(([k, x]) => [val(k, 'key'), val(x, 'map')]).filter(([k, x]) => k !== SKIP && x !== SKIP) };
      else if (v instanceof Set) o = { S: [...v].map(x => val(x, 'set')).filter(x => x !== SKIP) };
      else {
        const c = names.get(v.constructor), skip = this.skip[c] || [], f = {};
        for (const k of Object.keys(v)) {
          if (skip.includes(k)) continue;
          const e = val(v[k], (c || 'obj') + '.' + k);
          if (e !== SKIP) f[k] = e;
        }
        o = c ? { c, f } : { f };
      }
      objs[ids.get(v)] = o;
    }
    return { objs, dropped: [...dropped] };
  },

  // -> { root, missing: [static paths that no longer exist] }
  decode(data) {
    const classes = this.classes(), missing = new Set();
    const raw = v => v; // primitives are stored as themselves
    const shells = data.objs.map(o => {
      if (o.a) return [];
      if (o.t) { const bytes = this.b64ToBytes(o.b); const T = self[o.t]; return new T(bytes.buffer, 0, bytes.byteLength / T.BYTES_PER_ELEMENT); }
      if (o.m) return new Map();
      if (o.S) return new Set();
      const c = o.c && classes[o.c];
      if (!c) return {};
      if (c.make) { try { return c.make(o.f); } catch (e) { /* fall through to a bare instance */ } }
      return Object.create(c.cls.prototype);
    });
    const val = v => {
      if (v === null || typeof v !== 'object') return raw(v);
      if ('$r' in v) return shells[v.$r];
      if ('$s' in v) { const s = this.resolve(v.$s); if (s === undefined) missing.add(v.$s); return s; }
      if ('$n' in v) return Number(v.$n);
      return undefined;
    };
    data.objs.forEach((o, i) => {
      const s = shells[i];
      if (o.a) for (const x of o.a) s.push(val(x));
      else if (o.m) for (const [k, x] of o.m) s.set(val(k), val(x));
      else if (o.S) for (const x of o.S) s.add(val(x));
      else if (o.f) for (const [k, x] of Object.entries(o.f)) s[k] = val(x);
    });
    return { root: shells[0], missing: [...missing] };
  },

  bytesToB64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  },
  b64ToBytes(b64) {
    const s = atob(b64), u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  },
};

const Save = {
  prefix: 'cw2030.save.',
  slots: ['quick', 'auto', '1', '2', '3', '4', '5', '6'],
  slotName(slot) { return slot === 'quick' ? 'Quicksave' : slot === 'auto' ? 'Autosave' : 'Slot ' + slot; },

  // a short description of the running match, shown in the save list
  describe() {
    const M = G.mission, pt = G.playerTeam;
    let what = M ? 'Campaign · ' + M.def.title : G.mode === 'defense' ? 'Defense · wave ' + G.waves.wave + ' of ' + G.waves.total :
      'Skirmish · ' + G.teams.length + ' players';
    if (G.superweapons === false) what += ' · no superweapons';
    if (G.ultimates === false && G.mode !== 'campaign') what += ' · no ultimates';
    return { what, faction: pt.faction, theater: G.map.theater, time: Math.round(G.time), at: Date.now() };
  },

  // The running Game as a plain object (no storage); see SaveCodec.
  snapshot() {
    const { objs, dropped } = SaveCodec.encode(G);
    return { v: SAVE_VERSION, info: this.describe(), nextId: NEXT_ID, cam: { x: UI.cam.x, y: UI.cam.y }, objs, dropped };
  },

  // Rebuild G from a snapshot. Throws an Error with a player-facing message if it can't be used.
  restore(data) {
    if (!data || !data.objs || data.v > SAVE_VERSION) throw new Error('This save was made by a newer version of the game.');
    const { root: g, missing } = SaveCodec.decode(data);
    if (!(g instanceof Game)) throw new Error('This save is damaged.');
    const gone = [...new Set(g.teams.filter(t => !FACTIONS[t.faction]).map(t => t.faction))];
    if (gone.length) throw new Error(`This save uses a faction that is no longer in the game (${gone.join(', ')}).`);
    if (g.mission && !g.mission.def) throw new Error('This save is from a campaign mission that is no longer in the game.');
    G = g;
    NEXT_ID = data.nextId;
    // rebuild what isn't stored
    const fresh = new GameMap(g.map.w, g.map.seed, g.map.theater, g.map.players, g.map.water);
    for (const k of SaveCodec.skip.GameMap) g.map[k] = fresh[k];
    if (!g.map.waterId) g.map.labelWater(); // saves from before the navy
    g.map.ensureLevels(); // saves from before hills and bridges
    if (!g.mines) g.mines = []; // saves from before mines
    g.pf = new PathFinder(g.map);
    g.neutral = Game.makeNeutral();
    g.listeners = { eva: [], sound: [], voice: [] };
    g.cells = Array.from({ length: g.cols * g.cols }, () => []);
    g.visible = new Uint8Array(g.map.w * g.map.h);
    g.fogDirty = true;
    // units or structures removed from the game since the save are left out
    const lost = g.entities.filter(e => !e.def);
    if (lost.length) {
      for (const e of lost) {
        e.dead = true; g.byId.delete(e.id);
        if (e.kind === 'building') for (let i = 0; i < g.map.bld.length; i++) if (g.map.bld[i] === e.id) g.map.bld[i] = -1;
      }
      g.entities = g.entities.filter(e => e.def);
      for (const e of g.entities) {
        if (e.target && !e.target.def) e.target = null;
        if (e.order && e.order.target && !e.order.target.def) e.order = null;
        if (e.garrison) e.garrison = e.garrison.filter(u => u.def);
        if (e.passengers) e.passengers = e.passengers.filter(u => u.def);
      }
      g.projectiles = g.projectiles.filter(p => !Object.values(p).some(x => x && x.kind && !x.def));
      for (const t of g.teams) for (const q of Object.values(t.queues)) q.items = q.items.filter(k => defOf(k));
    }
    // build queues added since the save was made (the Navy tab) start empty
    for (const t of g.teams) for (const tab of TABS) if (!t.queues[tab.id]) t.queues[tab.id] = new ProdQueue(t, tab.id);
    for (const t of g.teams) t.recount();
    g.updateFog();
    return { missing, removed: lost.length, dropped: data.dropped || [] };
  },

  // ---------- storage ----------
  async write(slot, data) {
    const json = JSON.stringify(data);
    let body = 'j' + json;
    if (self.CompressionStream) {
      try {
        const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
        body = 'z' + SaveCodec.bytesToB64(new Uint8Array(buf));
      } catch (e) { /* store it uncompressed */ }
    }
    try {
      localStorage.setItem(this.prefix + slot, body);
      localStorage.setItem(this.prefix + slot + '.info', JSON.stringify(data.info));
    } catch (e) {
      localStorage.removeItem(this.prefix + slot);
      localStorage.removeItem(this.prefix + slot + '.info');
      throw new Error(e && e.name === 'QuotaExceededError' ? 'Not enough browser storage. Delete an old save and try again.' : 'Saving is blocked in this browser.');
    }
  },

  async read(slot) {
    let body;
    try { body = localStorage.getItem(this.prefix + slot); } catch (e) { body = null; }
    if (!body) throw new Error('That save slot is empty.');
    if (body[0] === 'j') return JSON.parse(body.slice(1));
    const bytes = SaveCodec.b64ToBytes(body.slice(1));
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  },

  info(slot) {
    try { return JSON.parse(localStorage.getItem(this.prefix + slot + '.info')); } catch (e) { return null; }
  },

  remove(slot) {
    try { localStorage.removeItem(this.prefix + slot); localStorage.removeItem(this.prefix + slot + '.info'); } catch (e) { /* nothing to do */ }
  },

  canSave() { return !!G && !G.over; },

  async saveTo(slot) {
    if (!this.canSave()) throw new Error('The match is over.');
    await this.write(slot, this.snapshot());
  },

  async loadFrom(slot) {
    const data = await this.read(slot);
    const report = this.restore(data);
    Main.enter(data.cam);
    return report;
  },
};
