// ColdWarning — core simulation.
'use strict';

let G = null;
let NEXT_ID = 1;

const RANK_DMG = [1, 1.25, 1.5];
const RANK_ARMOR = [1, 0.85, 0.7];
const RANK_KILLS = [3, 7];

// ---------------- Teams & production ----------------
class ProdQueue {
  constructor(team, type) {
    this.team = team; this.type = type;
    this.items = []; this.progress = 0; this.spent = 0;
    this.paused = false; this.ready = false; this.broke = false;
  }
  get head() { return this.items[0]; }
  isStructure() { return this.type === 'structure' || this.type === 'defense'; }

  add(key) {
    if (this.isStructure()) {
      if (this.items.length) return false;
    } else if (this.items.length >= 15) return false;
    this.items.push(key);
    return true;
  }

  // remove one instance of key (last queued first); refunds spent credits if it was in progress
  cancel(key) {
    const i = this.items.lastIndexOf(key);
    if (i < 0) return false;
    if (i === 0) {
      this.team.credits += this.spent;
      this.progress = 0; this.spent = 0; this.ready = false; this.paused = false;
    }
    this.items.splice(i, 1);
    return true;
  }

  clear() {
    this.team.credits += this.spent;
    this.items = []; this.progress = 0; this.spent = 0; this.ready = false; this.paused = false;
  }

  update(dt) {
    if (!this.items.length || this.ready || this.paused) return;
    const t = this.team;
    const producers = t.countOf(PRODUCER_OF[this.type === 'defense' ? 'structure' : this.type]);
    if (!producers) { this.clear(); return; }
    const key = this.items[0], def = defOf(key);
    if (!t.canBuild(key)) { this.cancel(key); return; }
    const speed = (t.lowPower ? 0.5 : 1) * Math.min(2.5, 1 + 0.5 * (producers - 1)) * t.buildMult * t.bonus('speed', this.type);
    const rate = speed / def.time;
    const step = t.costOf(key) * rate * dt;
    if (t.credits < step) {
      if (!this.broke) { this.broke = true; G.eva('Insufficient funds', t.id); }
      return;
    }
    this.broke = false;
    t.credits -= step; this.spent += step;
    this.progress += rate * dt;
    if (this.progress >= 1) {
      this.progress = 1;
      if (this.isStructure()) {
        this.ready = true;
        G.eva('Construction complete', t.id);
        G.sound('ready');
      } else {
        this.items.shift();
        this.progress = 0; this.spent = 0;
        t.spawnProduced(key);
      }
    }
  }
}

class Team {
  constructor(id, faction, isAI, difficulty, useAlt) {
    this.id = id; this.faction = faction; this.isAI = isAI;
    const f = FACTIONS[faction];
    const pal = useAlt ? f.alt : f;
    this.color = pal.color; this.dark = pal.dark; this.light = pal.light; this.name = f.name;
    this.pkg = f.pkg; this.camo = f.camo;
    this.credits = START_CREDITS;
    this.powerOut = 0; this.powerIn = 0; this.lowPower = false;
    this.buildMult = 1; this.incomeMult = 1;
    if (isAI) { const d = DIFFICULTY[difficulty]; this.buildMult = d.build; this.incomeMult = d.income; }
    this.queues = {};
    for (const tab of TABS) this.queues[tab.id] = new ProdQueue(this, tab.id);
    this.superTimer = 0; this.superReady = false;
    this.defeated = false;
    this.counts = {};
    this.stats = { built: 0, lost: 0, kills: 0, structuresBuilt: 0, structuresLost: 0, structuresKilled: 0, harvested: 0 };
    this.rally = {};
  }

  countOf(key) { return this.counts[key] || 0; }

  // faction bonus multiplier of a kind ('hp', 'dmg', 'cost', 'speed') for a category
  bonus(kind, cat) {
    const b = FACTIONS[this.faction].bonus[kind];
    return (b && b[cat]) || 1;
  }
  costOf(key) { return Math.round(defOf(key).cost * this.bonus('cost', categoryOf(key))); }

  canBuild(key) {
    const def = defOf(key);
    if (!def || def.buildable === false) return false;
    if (def.pkg && def.pkg !== this.pkg) return false;
    for (const r of def.req || []) if (!this.countOf(r)) return false;
    if (UNITS[key] && !this.countOf(def.from)) return false;
    if (BUILDINGS[key] && !this.countOf('cc')) return false;
    return true;
  }

  superKey() { return this.pkg === 'tech' ? 'super_lance' : 'super_silo'; }

  recount() {
    const c = {};
    let out = 0, use = 0;
    for (const e of G.entities) {
      if (e.team !== this.id || e.dead) continue;
      c[e.key] = (c[e.key] || 0) + 1;
      if (e.kind === 'building') {
        const p = e.def.power;
        if (p > 0) out += p * Math.max(0.3, e.hp / e.maxHp); else use -= p;
      }
    }
    this.counts = c;
    this.powerOut = Math.round(out); this.powerIn = use;
    const low = use > out;
    if (low && !this.lowPower) G.eva('Low power', this.id);
    this.lowPower = low;
  }

  primaryProducer(type) {
    let best = null;
    for (const e of G.entities) {
      if (e.team === this.id && !e.dead && e.kind === 'building' && e.key === type) {
        if (!best || e.primary || (!best.primary && e.id > best.id)) best = e;
      }
    }
    return best;
  }

  spawnProduced(key) {
    const def = UNITS[key];
    const b = this.primaryProducer(def.from);
    if (!b) return;
    let u;
    if (def.air) {
      u = G.spawnUnit(key, this.id, b.x, b.y);
    } else {
      const ex = b.tx + Math.floor(b.w / 2), ey = b.ty + b.h;
      const spot = G.findFreeTile(ex, ey, b);
      u = G.spawnUnit(key, this.id, b.x, (b.ty + b.h) * TILE - 6);
      u.facing = Math.PI / 2;
      if (spot) { u.order = { type: 'move', tx: spot[0], ty: spot[1] }; u.path = [[spot[0], spot[1]]]; u.pathI = 0; }
    }
    this.stats.built++;
    G.eva(def.cat === 'infantry' ? 'Unit ready' : def.air ? 'Drone ready' : 'Unit ready', this.id);
    if (def.harvester) { u.order = null; u.hstate = 'seek'; return; }
    if (b.rally && !def.mcv) G.commandMove([u], b.rally[0], b.rally[1], false, true);
    if (this.isAI && G.ai[this.id]) G.ai[this.id].onUnitBuilt(u);
  }

  update(dt) {
    for (const q of Object.values(this.queues)) q.update(dt);
    if (this.countOf(this.superKey())) {
      const sw = BUILDINGS[this.superKey()].superweapon;
      if (!this.superReady) {
        if (!this.lowPower) this.superTimer += dt;
        if (this.superTimer >= sw.charge) {
          this.superReady = true;
          G.eva(BUILDINGS[this.superKey()].name + ' ready', this.id);
        }
      }
    } else { this.superTimer = 0; this.superReady = false; }
  }
}

// ---------------- Entities ----------------
class Unit {
  constructor(key, team, x, y) {
    this.id = NEXT_ID++; this.kind = 'unit';
    this.key = key; this.def = UNITS[key]; this.team = team;
    this.x = x; this.y = y;
    this.hp = this.maxHp = this.def.hp;
    this.facing = Math.random() * Math.PI * 2; this.turret = this.facing;
    this.air = !!this.def.air; this.alt = this.air ? 26 : 0;
    this.order = null; this.path = null; this.pathI = 0;
    this.target = null; this.cool = Math.random() * 0.5; this.cool2 = 0;
    this.burst = 0; this.burstT = 0;
    this.kills = 0; this.rank = 0;
    this.cargo = 0; this.hstate = null;
    this.scanT = Math.random() * 0.5;
    this.moving = false; this.anim = Math.random() * 10;
    this.stuckT = 0; this.lastX = x; this.lastY = y;
  }
  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor(this.y / TILE); }
}

class Building {
  constructor(key, team, tx, ty) {
    this.id = NEXT_ID++; this.kind = 'building';
    this.key = key; this.def = BUILDINGS[key]; this.team = team;
    this.tx = tx; this.ty = ty; this.w = this.def.w; this.h = this.def.h;
    this.x = (tx + this.w / 2) * TILE; this.y = (ty + this.h / 2) * TILE;
    this.hp = this.maxHp = this.def.hp;
    this.built = 0; this.turret = -Math.PI / 2;
    this.cool = 0; this.target = null; this.scanT = 0; this.burst = 0; this.burstT = 0;
    this.repairing = false; this.rally = null; this.seen = false;
    this.anim = Math.random() * 10;
  }
}

// bonus category of a unit or structure key
function categoryOf(key) {
  if (BUILDINGS[key]) return BUILDINGS[key].cat === 'defense' ? 'defense' : 'structure';
  return UNITS[key].cat;
}

function armorOf(e) { return e.kind === 'building' ? 'building' : e.def.armor; }

// distance in pixels from point to entity (edge for buildings)
function distTo(px, py, e) {
  if (e.kind === 'building') {
    const x0 = e.tx * TILE, y0 = e.ty * TILE, x1 = x0 + e.w * TILE, y1 = y0 + e.h * TILE;
    const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
    return Math.hypot(dx, dy);
  }
  return Math.hypot(e.x - px, e.y - py);
}

function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function turnToward(a, b, max) {
  const d = angDiff(a, b);
  if (Math.abs(d) <= max) return b;
  return a + Math.sign(d) * max;
}

// ---------------- Game ----------------
class Game {
  constructor(opts) {
    G = this;
    NEXT_ID = 1;
    this.opts = opts;
    this.time = 0;
    this.map = new GameMap(opts.mapSize || 88, opts.seed, opts.theater || 'temperate');
    this.pf = new PathFinder(this.map);
    this.entities = []; this.byId = new Map();
    this.projectiles = []; this.effects = []; this.decals = [];
    this.messages = [];
    this.pendingStrikes = [];
    this.shake = 0;
    const pf = opts.faction;
    let ef = opts.enemy;
    if (!ef || !FACTIONS[ef]) {
      const others = Object.keys(FACTIONS).filter(k => k !== pf);
      ef = others[Math.floor(Math.random() * others.length)];
    }
    // give the enemy its alternate colours when both sides share a colour family
    const clash = FACTIONS[pf].side === FACTIONS[ef].side;
    this.teams = [new Team(0, pf, !!opts.autoplay, opts.difficulty), new Team(1, ef, true, opts.difficulty, clash)];
    this.player = 0;
    this.ai = {};
    this.over = null;
    const N = this.map.w;
    this.visible = new Uint8Array(N * N);
    this.explored = new Uint8Array(N * N);
    this.fogT = 0; this.fogDirty = true;
    this.cellSize = 4 * TILE;
    this.cols = Math.ceil(N * TILE / this.cellSize);
    this.cells = Array.from({ length: this.cols * this.cols }, () => []);
    this.evaLast = {};
    this.listeners = { eva: [], sound: [] };

    // starting forces
    this.teams.forEach((t, i) => {
      const [sx, sy] = this.map.starts[i];
      const c = (v) => v * TILE + TILE / 2;
      const mcv = this.spawnUnit('mcv', i, c(sx), c(sy));
      mcv.facing = 0;
      const extras = ['rifle', 'rifle', 'rifle', 'rocket', 'ifv', 'tank'];
      extras.forEach((k, j) => {
        const a = j / extras.length * Math.PI * 2;
        this.spawnUnit(k, i, c(sx + Math.round(Math.cos(a) * 3)), c(sy + Math.round(Math.sin(a) * 3)));
      });
    });
    for (const t of this.teams) t.recount();
    if (opts.autoplay) this.ai[0] = new AI(this.teams[0], opts.difficulty);
    this.ai[1] = new AI(this.teams[1], opts.difficulty);
    this.updateFog();
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  eva(msg, team) {
    if (team !== this.player) return;
    const now = this.time;
    if (this.evaLast[msg] !== undefined && now - this.evaLast[msg] < (msg.includes('attack') ? 25 : 2.5)) return;
    this.evaLast[msg] = now;
    this.messages.push({ text: msg, t: now });
    if (this.messages.length > 6) this.messages.shift();
    for (const f of this.listeners.eva) f(msg);
  }
  sound(name, x, y) { for (const f of this.listeners.sound) f(name, x, y); }

  get playerTeam() { return this.teams[this.player]; }

  // ---------- entity management ----------
  spawnUnit(key, team, x, y) {
    const u = new Unit(key, team, x, y);
    u.hp = u.maxHp = Math.round(u.def.hp * this.teams[team].bonus('hp', u.def.cat));
    this.entities.push(u); this.byId.set(u.id, u);
    this.fogDirty = true;
    return u;
  }

  placeBuilding(key, team, tx, ty) {
    const b = new Building(key, team, tx, ty);
    b.hp = b.maxHp = Math.round(b.def.hp * this.teams[team].bonus('hp', categoryOf(key)));
    this.entities.push(b); this.byId.set(b.id, b);
    for (let y = ty; y < ty + b.h; y++) for (let x = tx; x < tx + b.w; x++) {
      const i = this.map.idx(x, y);
      this.map.bld[i] = b.id;
      this.map.ore[i] = 0; this.map.oreMax[i] = 0;
    }
    // push ground units out of the footprint
    for (const e of this.entities) {
      if (e.kind !== 'unit' || e.air || e.dead) continue;
      if (e.tx >= tx && e.tx < tx + b.w && e.ty >= ty && e.ty < ty + b.h) {
        const s = this.findFreeTile(e.tx, e.ty);
        if (s) { e.x = s[0] * TILE + TILE / 2; e.y = s[1] * TILE + TILE / 2; e.path = null; }
      }
    }
    // re-path anyone whose route crosses the new footprint
    for (const e of this.entities) if (e.kind === 'unit' && e.path) e.repath = true;
    const t = this.teams[team];
    t.stats.structuresBuilt++;
    t.recount();
    if (key === 'refinery') {
      const spot = this.findFreeTile(tx + 1, ty + b.h);
      const h = this.spawnUnit('harvester', team, b.x, (ty + b.h) * TILE - 4);
      if (spot) { h.x = spot[0] * TILE + TILE / 2; h.y = spot[1] * TILE + TILE / 2; }
      h.hstate = 'seek';
    }
    if (b.def.superweapon) {
      for (const o of this.teams) if (o.id !== team) this.eva('Warning: enemy ' + b.def.name + ' detected', o.id);
    }
    this.fogDirty = true;
    return b;
  }

  removeBuildingTiles(b) {
    for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) {
      const i = this.map.idx(x, y);
      if (this.map.bld[i] === b.id) this.map.bld[i] = -1;
    }
  }

  // nearest passable, building-free tile to (tx,ty)
  findFreeTile(tx, ty, avoid) {
    for (let r = 0; r < 12; r++) {
      let best = null, bd = 1e9;
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
        if (!this.map.passable(x, y)) continue;
        const d = Math.hypot(x - tx, y - ty);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return null;
  }

  canPlace(key, team, tx, ty) {
    const def = BUILDINGS[key], m = this.map;
    for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) {
      if (!m.terrainPassable(x, y) || m.bld[m.idx(x, y)] >= 0) return false;
      if (team === this.player && !this.teams[team].isAI && !this.explored[m.idx(x, y)]) return false;
    }
    // must be near an existing friendly structure
    for (const e of this.entities) {
      if (e.kind !== 'building' || e.team !== team || e.dead) continue;
      const dx = Math.max(e.tx - (tx + def.w - 1), 0, tx - (e.tx + e.w - 1));
      const dy = Math.max(e.ty - (ty + def.h - 1), 0, ty - (e.ty + e.h - 1));
      if (Math.max(dx, dy) <= BUILD_RADIUS) {
        // block if an enemy ground unit stands there
        for (const u of this.entities) {
          if (u.kind === 'unit' && !u.air && !u.dead && u.team !== team &&
              u.tx >= tx && u.tx < tx + def.w && u.ty >= ty && u.ty < ty + def.h) return false;
        }
        return true;
      }
    }
    return false;
  }

  // player/AI places the ready structure from a queue
  tryPlace(team, qtype, tx, ty) {
    const q = this.teams[team].queues[qtype];
    if (!q.ready) return false;
    const key = q.head;
    if (!this.canPlace(key, team, tx, ty)) return false;
    q.items.shift(); q.ready = false; q.progress = 0; q.spent = 0;
    this.placeBuilding(key, team, tx, ty);
    this.sound('place', (tx + 1) * TILE, (ty + 1) * TILE);
    return true;
  }

  sell(b) {
    if (b.dead || b.kind !== 'building') return;
    const t = this.teams[b.team];
    t.credits += Math.round(t.costOf(b.key) * 0.5 * b.hp / b.maxHp);
    this.spawnSurvivors(b, 2);
    this.removeEntity(b);
    t.recount();
    this.eva('Structure sold', b.team);
    this.sound('sell', b.x, b.y);
  }

  deploy(u) {
    if (!u.def.mcv || u.dead) return false;
    const tx = u.tx - 1, ty = u.ty - 1, m = this.map;
    for (let y = ty; y < ty + 3; y++) for (let x = tx; x < tx + 3; x++) {
      if (!m.terrainPassable(x, y) || m.bld[m.idx(x, y)] >= 0) {
        this.eva('Cannot deploy here', u.team); return false;
      }
    }
    this.removeEntity(u);
    this.placeBuilding('cc', u.team, tx, ty);
    this.sound('place', u.x, u.y);
    return true;
  }

  spawnSurvivors(b, n) {
    for (let i = 0; i < n; i++) {
      const s = this.findFreeTile(b.tx + Math.floor(b.w / 2), b.ty + b.h);
      if (!s) return;
      const u = this.spawnUnit('rifle', b.team, s[0] * TILE + 6 + Math.random() * 20, s[1] * TILE + 6 + Math.random() * 20);
      u.hp = u.maxHp * 0.6;
    }
  }

  removeEntity(e) {
    e.dead = true;
    if (e.kind === 'building') this.removeBuildingTiles(e);
  }

  // ---------- damage ----------
  damage(target, amount, warhead, attacker) {
    if (target.dead) return;
    const mult = WARHEADS[warhead][armorOf(target)];
    if (!mult) return;
    let dmg = amount * mult;
    if (target.kind === 'unit') dmg *= RANK_ARMOR[target.rank];
    target.hp -= dmg;
    target.hitT = this.time;
    if (attacker && !attacker.dead && attacker.team !== target.team) {
      target.lastAttacker = attacker;
      if (target.team === this.player) {
        this.eva(target.kind === 'building' ? 'Our base is under attack' : 'Unit under attack', target.team);
        if (target.kind === 'building') this.alertPos = { x: target.x, y: target.y, t: this.time };
      }
      const ai = this.ai[target.team];
      if (ai) ai.onAttacked(target, attacker);
      // retaliate if idle
      if (target.kind === 'unit' && !target.target && !target.order && this.canHit(target, attacker)) {
        target.target = attacker;
        target.guard = [target.x, target.y];
      }
    }
    if (target.hp <= 0) this.kill(target, attacker);
  }

  kill(e, attacker) {
    if (e.dead) return;
    this.removeEntity(e);
    const t = this.teams[e.team];
    if (attacker && attacker.team !== e.team) {
      const at = this.teams[attacker.team];
      if (e.kind === 'building') at.stats.structuresKilled++; else at.stats.kills++;
      if (attacker.kind === 'unit' && !attacker.dead) {
        attacker.kills++;
        const r = attacker.kills >= RANK_KILLS[1] ? 2 : attacker.kills >= RANK_KILLS[0] ? 1 : 0;
        if (r > attacker.rank) {
          attacker.rank = r;
          this.eva(r === 2 ? 'Unit promoted to elite' : 'Unit promoted', attacker.team);
        }
      }
    }
    if (e.kind === 'building') {
      t.stats.structuresLost++;
      this.explosion(e.x, e.y, 30 + e.w * 12, true);
      for (let i = 0; i < e.w * e.h; i++) {
        this.explosion(e.tx * TILE + Math.random() * e.w * TILE, e.ty * TILE + Math.random() * e.h * TILE, 18, false, Math.random() * 0.6);
      }
      this.decal(e.x, e.y, e.w * TILE * 0.7);
      if (Math.random() < 0.6) this.spawnSurvivors(e, 1);
      if (e.team === this.player) this.eva('Structure lost', e.team);
      t.recount();
    } else {
      t.stats.lost++;
      if (e.def.cat === 'infantry') {
        this.effects.push({ type: 'corpse', x: e.x, y: e.y, t: 0, life: 6, color: t.color });
      } else {
        this.explosion(e.x, e.y - e.alt, e.def.radius * 2.2, true);
        if (!e.air) this.decal(e.x, e.y, e.def.radius * 1.6);
        else this.effects.push({ type: 'falling', x: e.x, y: e.y, alt: e.alt, t: 0, life: 0.6 });
      }
      if (e.team === this.player) this.eva('Unit lost', e.team);
      if (e.def.mcv || e.def.harvester) t.recount();
    }
  }

  explosion(x, y, size, big, delay = 0) {
    this.effects.push({ type: 'explosion', x, y, size, t: -delay, life: 0.7 + size / 120 });
    const n = big ? 10 : 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * size * 1.6;
      this.effects.push({ type: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 0, vz: 40 + Math.random() * 80, t: -delay, life: 0.9 });
    }
    if (delay === 0) this.sound(big ? 'boom' : 'pop', x, y);
    if (big && size > 60) this.shake = Math.min(12, this.shake + size / 25);
  }

  decal(x, y, r) {
    this.decals.push({ x, y, r, a: Math.random() * 6 });
    if (this.decals.length > 160) this.decals.shift();
  }

  // ---------- spatial queries ----------
  rebuildCells() {
    for (const c of this.cells) c.length = 0;
    const cs = this.cellSize, cols = this.cols;
    for (const e of this.entities) {
      if (e.dead || e.kind !== 'unit') continue;
      const cx = Math.min(cols - 1, Math.max(0, (e.x / cs) | 0)), cy = Math.min(cols - 1, Math.max(0, (e.y / cs) | 0));
      this.cells[cy * cols + cx].push(e);
    }
  }

  unitsNear(x, y, r, out = []) {
    const cs = this.cellSize, cols = this.cols;
    const x0 = Math.max(0, ((x - r) / cs) | 0), x1 = Math.min(cols - 1, ((x + r) / cs) | 0);
    const y0 = Math.max(0, ((y - r) / cs) | 0), y1 = Math.min(cols - 1, ((y + r) / cs) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (const e of this.cells[cy * cols + cx]) if (!e.dead) out.push(e);
    }
    return out;
  }

  weaponsOf(e) {
    const d = e.def, w = [];
    if (d.weapon) w.push(d.weapon);
    if (d.weapon2) w.push(d.weapon2);
    return w;
  }

  canHit(e, target) {
    if (!target || target.dead) return false;
    for (const w of this.weaponsOf(e)) if (target.air ? w.air : w.ground) return true;
    return false;
  }

  weaponFor(e, target) {
    for (const w of this.weaponsOf(e)) if (target.air ? w.air : w.ground) return w;
    return null;
  }

  maxRange(e) {
    let r = 0;
    for (const w of this.weaponsOf(e)) r = Math.max(r, w.range);
    return r;
  }

  findTarget(e, radiusTiles) {
    const R = radiusTiles * TILE;
    let best = null, bs = 1e9;
    const cand = this.unitsNear(e.x, e.y, R + 32);
    for (const o of cand) {
      if (o.team === e.team || o.dead) continue;
      if (!this.canHit(e, o)) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d > R) continue;
      let s = d;
      if (o.def.weapon) s -= 64;
      if (s < bs) { bs = s; best = o; }
    }
    if (best) return best;
    for (const o of this.entities) {
      if (o.kind !== 'building' || o.team === e.team || o.dead || !o.built) continue;
      if (!this.canHit(e, o)) continue;
      const d = distTo(e.x, e.y, o);
      if (d > R) continue;
      let s = d + (o.def.weapon ? -64 : 96);
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }

  // ---------- commands ----------
  commandMove(units, tx, ty, attackMove, quiet) {
    const ground = units.filter(u => !u.air), air = units.filter(u => u.air);
    // spread destination tiles around the click
    const spots = this.formationSpots(tx, ty, ground.length);
    ground.sort((a, b) => Math.hypot(a.x - tx * TILE, a.y - ty * TILE) - Math.hypot(b.x - tx * TILE, b.y - ty * TILE));
    ground.forEach((u, i) => {
      const s = spots[i] || [tx, ty];
      this.setMove(u, s[0], s[1], attackMove);
    });
    air.forEach((u, i) => {
      const a = i * 2.4, r = Math.sqrt(i) * 1.1;
      this.setMove(u, tx + Math.cos(a) * r, ty + Math.sin(a) * r, attackMove);
    });
    if (!quiet && units.length && units[0].team === this.player) this.sound('ack');
  }

  formationSpots(tx, ty, n) {
    const spots = [];
    const m = this.map;
    for (let r = 0; spots.length < n && r < 10; r++) {
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
        if (m.passable(x, y)) spots.push([x, y]);
      }
    }
    return spots;
  }

  setMove(u, tx, ty, attackMove) {
    u.order = { type: attackMove ? 'amove' : 'move', tx, ty };
    u.target = null; u.path = null; u.pathI = 0;
    if (u.def.harvester) u.hstate = null;
    if (!u.air) this.computePath(u, Math.round(tx), Math.round(ty), 0);
  }

  commandAttack(units, target) {
    for (const u of units) {
      if (u.def.engineer && target.kind === 'building') { this.commandCapture(u, target); continue; }
      if (!this.canHit(u, target)) continue;
      u.order = { type: 'attack', target };
      u.target = target; u.path = null; u.repathT = 0;
    }
    if (units.length && units[0].team === this.player) this.sound('ack');
  }

  commandCapture(u, b) {
    u.order = { type: 'capture', target: b };
    u.path = null; u.repathT = 0;
  }

  commandStop(units) {
    for (const u of units) { u.order = null; u.target = null; u.path = null; if (u.def.harvester) u.hstate = null; }
  }

  commandHarvest(u, tx, ty) {
    if (!u.def.harvester) return;
    u.order = null; u.target = null;
    u.oreTarget = [tx, ty];
    u.hstate = 'toOre';
    this.computePath(u, tx, ty, 0);
  }

  commandDock(u, ref) {
    if (!u.def.harvester) return;
    u.order = null; u.hstate = 'toRef'; u.dockRef = ref; u.path = null;
  }

  computePath(u, tx, ty, range) {
    const p = this.pf.find(u.tx, u.ty, Math.max(0, Math.min(this.map.w - 1, tx)), Math.max(0, Math.min(this.map.h - 1, ty)), range);
    u.path = p; u.pathI = 0; u.repath = false; u.stuckT = 0;
    u.goal = [tx, ty, range];
    return p;
  }

  // path to get within weapon range of an entity
  pathToEntity(u, e, range) {
    let gx = Math.floor(e.x / TILE), gy = Math.floor(e.y / TILE);
    if (e.kind === 'building') {
      gx = Math.max(e.tx, Math.min(e.tx + e.w - 1, u.tx));
      gy = Math.max(e.ty, Math.min(e.ty + e.h - 1, u.ty));
    }
    this.computePath(u, gx, gy, Math.max(1, range));
  }

  // ---------- main update ----------
  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.rebuildCells();
    for (const t of this.teams) t.update(dt);
    for (const id in this.ai) this.ai[id].update(dt);
    const ents = this.entities;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.dead) continue;
      if (e.kind === 'unit') this.updateUnit(e, dt); else this.updateBuilding(e, dt);
    }
    this.separate(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.updateStrikes(dt);
    this.map.regrow(dt * 0.25);

    // cleanup
    if (ents.some(e => e.dead)) {
      this.entities = ents.filter(e => !e.dead);
      for (const e of ents) if (e.dead) this.byId.delete(e.id);
      for (const t of this.teams) t.recount();
      this.fogDirty = true;
    }
    this.fogT -= dt;
    if (this.fogT <= 0 || this.fogDirty) { this.updateFog(); this.fogT = 0.2; this.fogDirty = false; }
    this.shake = Math.max(0, this.shake - dt * 20);
    if (((this.time * 2) | 0) !== (((this.time - dt) * 2) | 0)) this.checkVictory();
  }

  checkVictory() {
    for (const t of this.teams) {
      if (t.defeated) continue;
      const alive = this.entities.some(e => e.team === t.id && !e.dead && (e.kind === 'building' || e.def.mcv));
      if (!alive) {
        t.defeated = true;
        // remaining units self-destruct
        for (const e of this.entities) if (e.team === t.id && !e.dead) this.kill(e, null);
      }
    }
    const p = this.playerTeam;
    if (p.defeated) this.over = { win: false, time: this.time };
    else if (this.teams.every(t => t.id === this.player || t.defeated)) this.over = { win: true, time: this.time };
    if (this.over) this.eva(this.over.win ? 'Mission accomplished' : 'Mission failed', this.player);
  }

  // ---------- fog of war ----------
  updateFog() {
    const N = this.map.w, vis = this.visible, exp = this.explored;
    vis.fill(0);
    const pid = this.player;
    for (const e of this.entities) {
      if (e.team !== pid || e.dead) continue;
      const r = e.def.sight;
      const cx = e.x / TILE, cy = e.y / TILE;
      const rr = r + (e.kind === 'building' ? Math.max(e.w, e.h) / 2 : 0);
      const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(N - 1, Math.ceil(cx + rr));
      const y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(N - 1, Math.ceil(cy + rr));
      const r2 = rr * rr;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) { const i = y * N + x; vis[i] = 1; exp[i] = 1; }
      }
    }
    for (const e of this.entities) if (e.kind === 'building' && e.team !== pid && this.isVisibleBld(e)) e.seen = true;
    this.fogVersion = (this.fogVersion || 0) + 1;
  }

  isVisibleTile(tx, ty) {
    if (!this.map.inside(tx, ty)) return false;
    return this.visible[ty * this.map.w + tx] === 1;
  }
  isVisibleBld(b) {
    for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) if (this.visible[y * this.map.w + x]) return true;
    return false;
  }
  isVisibleTo(e, team) {
    if (team !== this.player || this.teams[team].isAI) return true;
    if (e.team === team) return true;
    if (e.kind === 'building') return e.seen;
    return this.isVisibleTile(e.tx, e.ty);
  }

  // ---------- unit behaviour ----------
  updateUnit(u, dt) {
    u.cool -= dt; u.cool2 -= dt; u.anim += dt;
    u.moving = false;
    if (u.def.selfHeal && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.def.selfHeal * dt);
    if (u.rank === 2 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.01 * dt);
    if (u.burst > 0) {
      u.burstT -= dt;
      if (u.burstT <= 0 && u.burstTarget && !u.burstTarget.dead) {
        this.fire(u, u.burstW, u.burstTarget); u.burst--; u.burstT = 0.18;
      } else if (!u.burstTarget || u.burstTarget.dead) u.burst = 0;
    }

    if (u.def.harvester) { this.updateHarvester(u, dt); return; }
    if (u.def.jet) { this.updateJet(u, dt); return; }
    const o = u.order;

    if (o && o.type === 'capture') {
      const b = o.target;
      if (b.dead) { u.order = null; return; }
      if (distTo(u.x, u.y, b) < 14) {
        if (b.team === u.team) { b.hp = b.maxHp; this.eva('Structure repaired', u.team); }
        else {
          const old = b.team;
          b.team = u.team;
          b.repairing = false; b.rally = null;
          this.eva('Structure captured', u.team);
          this.eva('Structure lost', old);
          this.teams[old].recount();
          this.teams[u.team].recount();
        }
        this.removeEntity(u);
        this.sound('capture', b.x, b.y);
        return;
      }
      u.repathT = (u.repathT || 0) - dt;
      if (!u.path || u.repathT <= 0 || u.repath) { this.pathToEntity(u, b, 1); u.repathT = 1.5; }
      this.moveAlong(u, dt);
      return;
    }

    // engage current target
    if (u.target && (u.target.dead || (u.target.team === u.team))) u.target = null;
    if (u.target && !this.canHit(u, u.target)) u.target = null;
    if (u.target && u.order && u.order.type === 'move') u.target = null;

    // auto-acquire when idle / attack-moving / guarding
    u.scanT -= dt;
    if (!u.target && u.def.weapon && u.scanT <= 0 && (!u.order || u.order.type === 'amove' || u.order.type === 'guard')) {
      u.scanT = 0.4;
      const t = this.findTarget(u, u.order && u.order.type === 'amove' ? u.def.sight : Math.max(this.maxRange(u), u.def.sight - 1));
      if (t) { u.target = t; u.guard = u.order ? null : [u.x, u.y]; }
    }

    if (u.target) {
      u.needPath = true;
      const t = u.target;
      const w = this.weaponFor(u, t);
      const d = distTo(u.x, u.y, t);
      const range = w.range * TILE + (t.kind === 'unit' ? 4 : 8);
      const minR = (w.minRange || 0) * TILE;
      // idle units shouldn't wander off chasing forever
      if (!u.order && u.guard && Math.hypot(u.x - u.guard[0], u.y - u.guard[1]) > (u.def.sight + 3) * TILE) {
        u.target = null; this.setMove(u, Math.floor(u.guard[0] / TILE), Math.floor(u.guard[1] / TILE), false);
        return;
      }
      if (d <= range && d >= minR) {
        u.path = null;
        const a = Math.atan2(t.y - (t.alt || 0) - u.y, t.x - u.x);
        const hasTurret = u.def.cat === 'vehicle';
        if (hasTurret) u.turret = turnToward(u.turret, a, 8 * dt); else u.facing = a;
        if (u.air) { u.facing = turnToward(u.facing, a, 5 * dt); this.hover(u, dt); }
        const aimed = !hasTurret || Math.abs(angDiff(u.turret, a)) < 0.15;
        const isW2 = w === u.def.weapon2;
        if (aimed && (isW2 ? u.cool2 : u.cool) <= 0 && u.burst <= 0) {
          this.fire(u, w, t);
          const cd = w.cooldown * (u.rank === 2 ? 0.8 : 1);
          if (isW2) u.cool2 = cd; else u.cool = cd;
          if (w.burst > 1) { u.burst = w.burst - 1; u.burstT = 0.18; u.burstW = w; u.burstTarget = t; }
        }
        return;
      }
      if (d < minR) {
        // too close for artillery: back off
        const a = Math.atan2(u.y - t.y, u.x - t.x);
        const nx = Math.round((u.x + Math.cos(a) * TILE * 3) / TILE), ny = Math.round((u.y + Math.sin(a) * TILE * 3) / TILE);
        if (!u.path) this.computePath(u, nx, ny, 0);
        this.moveAlong(u, dt);
        return;
      }
      // chase
      if (u.air) { this.flyToward(u, t.x, t.y, dt); return; }
      u.repathT = (u.repathT || 0) - dt;
      if (!u.path || u.repathT <= 0 || u.repath || u.pathI >= u.path.length) {
        this.pathToEntity(u, t, Math.max(1, w.range - 0.7));
        u.repathT = 1.0;
      }
      this.moveAlong(u, dt);
      return;
    }

    if (o && o.type === 'attack') { u.order = null; return; }

    if (o && (o.type === 'move' || o.type === 'amove')) {
      if (u.air) {
        if (this.flyToward(u, o.tx * TILE + TILE / 2, o.ty * TILE + TILE / 2, dt)) u.order = null;
        return;
      }
      if (u.repath || u.needPath) { this.computePath(u, Math.round(o.tx), Math.round(o.ty), 0); u.needPath = false; }
      if (this.moveAlong(u, dt)) u.order = null;
      return;
    }

    if (u.air) this.hover(u, dt);
  }

  // Jets never hover: they fly at speed, make attack runs and orbit when idle.
  updateJet(u, dt) {
    const o = u.order;
    if (u.target && (u.target.dead || u.target.team === u.team || !this.canHit(u, u.target))) u.target = null;
    if (u.target && o && o.type === 'move') u.target = null;
    u.scanT -= dt;
    if (!u.target && u.scanT <= 0 && (!o || o.type === 'amove')) {
      u.scanT = 0.4;
      u.target = this.findTarget(u, u.def.sight);
    }
    let gx, gy, sp = u.def.speed;
    if (u.target) {
      const t = u.target;
      gx = t.x; gy = t.y;
      const w = this.weaponFor(u, t);
      const a = Math.atan2(t.y - (t.alt || 0) - u.y, t.x - u.x);
      const d = distTo(u.x, u.y, t);
      const isW2 = w === u.def.weapon2;
      if (d < w.range * TILE && Math.abs(angDiff(u.facing, a)) < 0.4 && (isW2 ? u.cool2 : u.cool) <= 0) {
        this.fire(u, w, t);
        if (isW2) u.cool2 = w.cooldown; else u.cool = w.cooldown;
      }
      // pull out past the target before looping back for the next run
      if (d < TILE * 1.5) u.passT = 0.8;
    } else if (o && (o.type === 'move' || o.type === 'amove')) {
      gx = o.tx * TILE + TILE / 2; gy = o.ty * TILE + TILE / 2;
      if (Math.hypot(gx - u.x, gy - u.y) < TILE * 1.5) { u.order = null; u.orbit = [gx, gy]; }
    } else {
      if (!u.orbit) u.orbit = [u.x, u.y];
      [gx, gy] = u.orbit;
      sp *= 0.55;
    }
    u.passT = (u.passT || 0) - dt;
    if (u.passT <= 0) u.facing = turnToward(u.facing, Math.atan2(gy - u.y, gx - u.x), 2.4 * dt);
    const W = this.map.w * TILE, H = this.map.h * TILE;
    u.x = Math.max(TILE, Math.min(W - TILE, u.x + Math.cos(u.facing) * sp * TILE * dt));
    u.y = Math.max(TILE, Math.min(H - TILE, u.y + Math.sin(u.facing) * sp * TILE * dt));
    u.moving = true;
  }

  hover(u, dt) {
    u.facing += dt * 0.3;
  }

  flyToward(u, x, y, dt) {
    const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    u.facing = turnToward(u.facing, a, 4 * dt);
    const sp = u.def.speed * TILE * dt;
    if (d <= sp) { u.x = x; u.y = y; return true; }
    u.x += Math.cos(a) * sp; u.y += Math.sin(a) * sp;
    u.moving = true;
    return false;
  }

  // follow the current path; returns true when finished
  moveAlong(u, dt) {
    if (!u.path || u.pathI >= u.path.length) return true;
    const [tx, ty] = u.path[u.pathI];
    if (!this.map.passable(tx, ty) && u.goal) {
      this.computePath(u, u.goal[0], u.goal[1], u.goal[2]);
      if (!u.path.length) return true;
      return false;
    }
    const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
    const dx = px - u.x, dy = py - u.y, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    let sp = u.def.speed * TILE * dt;
    if (u.def.cat === 'vehicle') {
      u.facing = turnToward(u.facing, a, (u.def.turn || 4) * dt);
      const diff = Math.abs(angDiff(u.facing, a));
      if (diff > 1.0) sp *= 0.1; else if (diff > 0.4) sp *= 0.5;
      if (!u.target) u.turret = turnToward(u.turret, u.facing, 4 * dt);
    } else u.facing = a;
    u.moving = true;
    if (d <= sp) {
      u.x = px; u.y = py; u.pathI++;
      return u.pathI >= u.path.length;
    }
    const nx = u.x + Math.cos(a) * sp, ny = u.y + Math.sin(a) * sp;
    u.x = nx; u.y = ny;
    // stuck detection
    u.stuckT += dt;
    if (u.stuckT > 1.5) {
      if (Math.hypot(u.x - u.lastX, u.y - u.lastY) < TILE * 0.5 && u.goal) {
        this.computePath(u, u.goal[0], u.goal[1], u.goal[2]);
        if (++u.stuckCount > 3) { u.path = null; u.stuckCount = 0; return true; }
      } else u.stuckCount = 0;
      u.stuckT = 0; u.lastX = u.x; u.lastY = u.y;
    }
    return false;
  }

  separate(dt) {
    const near = [];
    for (const u of this.entities) {
      if (u.dead || u.kind !== 'unit') continue;
      near.length = 0;
      this.unitsNear(u.x, u.y, 28, near);
      for (const o of near) {
        if (o.id <= u.id || o.dead || o.air !== u.air) continue;
        const dx = o.x - u.x, dy = o.y - u.y;
        const min = (u.def.radius + o.def.radius) * (u.air ? 1.2 : 0.9);
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        // tanks crush enemy infantry
        if (!u.air && u.team !== o.team) {
          const crusher = u.def.armor === 'heavy' && u.moving ? u : o.def.armor === 'heavy' && o.moving ? o : null;
          const victim = crusher === u ? o : u;
          if (crusher && victim.def.cat === 'infantry') { this.kill(victim, crusher); this.sound('crush', victim.x, victim.y); continue; }
        }
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) * 0.5 * Math.min(1, dt * 12);
        const nx = dx / d, ny = dy / d;
        const wu = u.moving && !o.moving ? 0.3 : o.moving && !u.moving ? 0.7 : 0.5;
        this.nudge(u, -nx * push * 2 * wu, -ny * push * 2 * wu);
        this.nudge(o, nx * push * 2 * (1 - wu), ny * push * 2 * (1 - wu));
      }
    }
  }

  nudge(u, dx, dy) {
    const nx = u.x + dx, ny = u.y + dy;
    if (u.air || this.map.passable(Math.floor(nx / TILE), Math.floor(ny / TILE))) { u.x = nx; u.y = ny; }
  }

  // ---------- harvesting ----------
  updateHarvester(u, dt) {
    const m = this.map, t = this.teams[u.team];
    const cap = u.def.capacity;
    if (u.order && u.order.type === 'move') {
      if (this.moveAlong(u, dt)) { u.order = null; }
      return;
    }
    switch (u.hstate) {
      case 'seek': {
        const spot = this.findOre(u.oreTarget ? u.oreTarget[0] : u.tx, u.oreTarget ? u.oreTarget[1] : u.ty, u);
        if (!spot) { u.hstate = u.cargo > 0 ? 'toRef' : null; break; }
        u.oreTarget = spot;
        this.computePath(u, spot[0], spot[1], 0);
        u.hstate = 'toOre';
        break;
      }
      case 'toOre': {
        if (u.repath) this.computePath(u, u.oreTarget[0], u.oreTarget[1], 0);
        if (this.moveAlong(u, dt)) {
          if (m.ore[m.idx(u.tx, u.ty)] > 1) { u.hstate = 'mine'; u.mineT = 0; }
          else u.hstate = 'seek';
        }
        break;
      }
      case 'mine': {
        const i = m.idx(u.tx, u.ty);
        u.mineT -= dt;
        u.anim += dt * 3;
        if (u.mineT <= 0) {
          u.mineT = 0.25;
          const take = Math.min(m.ore[i], 28, cap - u.cargo);
          m.ore[i] -= take; u.cargo += take;
          if (take > 0) this.effects.push({ type: 'spark', x: u.x + Math.cos(u.facing) * 12, y: u.y + Math.sin(u.facing) * 12, t: 0, life: 0.3, color: m.oreType[i] === GEM ? '#7ff' : '#fc4' });
        }
        if (u.cargo >= cap - 0.5) { u.hstate = 'toRef'; u.path = null; }
        else if (m.ore[i] <= 1) {
          u.oreTarget = [u.tx, u.ty];
          const spot = this.findOre(u.tx, u.ty, u, 4);
          if (spot) { u.oreTarget = spot; this.computePath(u, spot[0], spot[1], 0); u.hstate = 'toOre'; }
          else { u.hstate = u.cargo > 0 ? 'toRef' : 'seek'; u.path = null; }
        }
        break;
      }
      case 'toRef': {
        let ref = u.dockRef && !u.dockRef.dead && u.dockRef.team === u.team ? u.dockRef : null;
        if (!ref) {
          let bd = 1e9;
          for (const e of this.entities) {
            if (e.kind === 'building' && e.key === 'refinery' && e.team === u.team && !e.dead) {
              const d = Math.hypot(e.x - u.x, e.y - u.y);
              if (d < bd) { bd = d; ref = e; }
            }
          }
          u.dockRef = ref;
        }
        if (!ref) { u.hstate = null; break; }
        if (distTo(u.x, u.y, ref) < TILE * 0.9) { u.hstate = 'dock'; u.path = null; break; }
        if (!u.path || u.repath) this.computePath(u, ref.tx + 1, ref.ty + ref.h, 0);
        if (this.moveAlong(u, dt)) {
          if (distTo(u.x, u.y, ref) >= TILE * 0.9) {
            // dock tile blocked; get as close as possible
            this.pathToEntity(u, ref, 1);
            if (!u.path.length) u.hstate = 'dock';
          }
        }
        break;
      }
      case 'dock': {
        const ref = u.dockRef;
        if (!ref || ref.dead || ref.team !== u.team) { u.hstate = 'toRef'; u.dockRef = null; break; }
        u.facing = turnToward(u.facing, Math.atan2(ref.y - u.y, ref.x - u.x), 3 * dt);
        const amt = Math.min(u.cargo, 400 * dt);
        u.cargo -= amt;
        const v = amt * t.incomeMult;
        t.credits += v; t.stats.harvested += v;
        if (u.cargo <= 0.5) { u.cargo = 0; u.hstate = 'seek'; }
        break;
      }
      default:
        // idle harvester: auto-resume after a while
        u.idleT = (u.idleT || 0) + dt;
        if (u.idleT > 4 && !u.order) { u.idleT = 0; u.hstate = u.cargo >= cap * 0.5 ? 'toRef' : 'seek'; }
    }
  }

  findOre(cx, cy, u, maxR = 40) {
    const m = this.map;
    const taken = new Set();
    for (const e of this.entities) {
      if (e !== u && e.kind === 'unit' && e.def.harvester && e.oreTarget && (e.hstate === 'toOre' || e.hstate === 'mine')) taken.add(e.oreTarget[0] + e.oreTarget[1] * m.w);
    }
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (!m.inside(x, y)) continue;
        const i = m.idx(x, y);
        if (m.ore[i] < 20 || m.bld[i] >= 0 || taken.has(i)) continue;
        const d = Math.hypot(x - cx, y - cy) - m.ore[i] / 2000;
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------- buildings ----------
  updateBuilding(b, dt) {
    b.anim += dt;
    if (b.built < 1) { b.built = Math.min(1, b.built + dt / 1.2); return; }
    const t = this.teams[b.team];
    if (b.repairing) {
      if (b.hp >= b.maxHp) b.repairing = false;
      else {
        const hp = Math.min(b.maxHp - b.hp, b.maxHp * 0.05 * dt);
        const cost = hp * t.costOf(b.key) * 0.4 / b.maxHp;
        if (t.credits >= cost) { t.credits -= cost; b.hp += hp; }
      }
    }
    const w = b.def.weapon;
    if (!w) return;
    if (b.def.needsPower && t.lowPower) { b.target = null; return; }
    b.cool -= dt;
    if (b.burst > 0) {
      b.burstT -= dt;
      if (b.burstT <= 0 && b.target && !b.target.dead) { this.fire(b, w, b.target); b.burst--; b.burstT = 0.2; }
    }
    if (b.target && (b.target.dead || b.target.team === b.team || distTo(b.x, b.y, b.target) > w.range * TILE + 8)) b.target = null;
    b.scanT -= dt;
    if (!b.target && b.scanT <= 0) { b.scanT = 0.3; b.target = this.findTarget(b, w.range); }
    if (b.target) {
      const a = Math.atan2(b.target.y - (b.target.alt || 0) - b.y, b.target.x - b.x);
      b.turret = turnToward(b.turret, a, 6 * dt);
      if (Math.abs(angDiff(b.turret, a)) < 0.12 && b.cool <= 0) {
        this.fire(b, w, b.target);
        b.cool = w.cooldown;
        if (w.burst > 1) { b.burst = w.burst - 1; b.burstT = 0.2; }
      }
    }
  }

  // ---------- weapons ----------
  fire(s, w, t) {
    const dmg = w.damage * (s.kind === 'unit' ? RANK_DMG[s.rank] : 1) * this.teams[s.team].bonus('dmg', s.kind === 'unit' ? s.def.cat : categoryOf(s.key));
    s.recoil = 1;
    const ang = s.def.cat === 'vehicle' || s.kind === 'building' ? s.turret : s.facing;
    const len = s.kind === 'building' ? 12 : (s.def.radius || 6) + 2;
    const sx = s.x + Math.cos(ang) * len, sy = s.y - (s.alt || 0) - (s.kind === 'building' ? s.def.height * 0.5 : 0) + Math.sin(ang) * len;
    const tx = t.x, ty = t.y - (t.alt || 0);
    const vis = s.team === this.player || this.isVisibleTile(Math.floor(s.x / TILE), Math.floor(s.y / TILE));
    switch (w.proj) {
      case 'tracer': {
        const jx = (Math.random() - 0.5) * 8, jy = (Math.random() - 0.5) * 8;
        this.effects.push({ type: 'tracer', x: sx, y: sy, x2: tx + jx, y2: ty + jy, t: 0, life: 0.08 });
        this.effects.push({ type: 'flash', x: sx, y: sy, t: 0, life: 0.06, size: 5 });
        this.damage(t, dmg, w.warhead, s);
        if (vis) this.sound(w.warhead === 'flak' ? 'flak' : 'gun', sx, sy);
        break;
      }
      case 'rail': {
        const a = Math.atan2(ty - sy, tx - sx);
        const L = w.range * TILE + 16;
        const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
        this.effects.push({ type: 'rail', x: sx, y: sy, x2: w.pierce ? ex : tx, y2: w.pierce ? ey : ty, t: 0, life: 0.45 });
        if (w.pierce) {
          const hit = this.unitsNear((sx + ex) / 2, (sy + ey) / 2, L / 2 + 20);
          for (const o of hit) {
            if (o.team === s.team || o.air) continue;
            const px = o.x - sx, py = o.y - sy;
            const along = px * Math.cos(a) + py * Math.sin(a);
            const perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a));
            if (along > 0 && along < L && perp < o.def.radius + 6) this.damage(o, dmg, w.warhead, s);
          }
          if (t.kind === 'building') this.damage(t, dmg, w.warhead, s);
        } else this.damage(t, dmg, w.warhead, s);
        this.effects.push({ type: 'flash', x: tx, y: ty, t: 0, life: 0.15, size: 10, color: '#8ff' });
        if (vis) this.sound('rail', sx, sy);
        break;
      }
      case 'shell': case 'rocket': case 'arty': {
        const p = {
          type: w.proj, x: sx, y: sy, sx, sy, target: t, tx, ty, team: s.team, src: s,
          dmg, warhead: w.warhead, splash: w.splash || 0, speed: (w.speed || 12) * TILE, t: 0,
          ang: Math.atan2(ty - sy, tx - sx),
        };
        if (w.proj === 'arty') {
          p.tx += (Math.random() - 0.5) * TILE * 1.5; p.ty += (Math.random() - 0.5) * TILE * 1.5;
          p.dur = Math.hypot(p.tx - sx, p.ty - sy) / p.speed + 0.4;
          p.target = null;
        }
        this.projectiles.push(p);
        this.effects.push({ type: 'flash', x: sx, y: sy, t: 0, life: 0.08, size: w.proj === 'shell' ? 9 : 6 });
        if (vis) this.sound(w.proj === 'shell' ? 'cannon' : 'rocket', sx, sy);
        break;
      }
    }
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.type === 'arty') {
        const k = Math.min(1, p.t / p.dur);
        p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
        p.z = Math.sin(k * Math.PI) * Math.min(160, p.dur * 90);
        if (Math.random() < 0.5) this.effects.push({ type: 'smoke', x: p.x, y: p.y - p.z, t: 0, life: 0.6, size: 3 });
        if (k >= 1) { this.impact(p); continue; }
        keep.push(p); continue;
      }
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y - (p.target.alt || 0); }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      p.ang = p.type === 'rocket' ? turnToward(p.ang, desired, 9 * dt) : desired;
      const sp = p.speed * dt;
      if (d <= sp + 4 || p.t > 4) { this.impact(p); continue; }
      p.x += Math.cos(p.ang) * sp; p.y += Math.sin(p.ang) * sp;
      if (p.type === 'rocket' && Math.random() < 0.7) this.effects.push({ type: 'smoke', x: p.x, y: p.y, t: 0, life: 0.5, size: 2.5 });
      keep.push(p);
    }
    this.projectiles = keep;
  }

  impact(p) {
    if (p.splash > 0) {
      const R = p.splash * TILE;
      for (const o of this.unitsNear(p.tx, p.ty, R + 16)) {
        if (o.team === p.team || o.air) continue;
        const d = Math.hypot(o.x - p.tx, o.y - p.ty);
        if (d < R) this.damage(o, p.dmg * (1 - d / R * 0.6), p.warhead, p.src);
      }
      for (const o of this.entities) {
        if (o.kind !== 'building' || o.team === p.team || o.dead) continue;
        if (distTo(p.tx, p.ty, o) < R * 0.6) this.damage(o, p.dmg, p.warhead, p.src);
      }
      this.explosion(p.tx, p.ty, 22, false);
      this.decal(p.tx, p.ty, 10);
    } else if (p.target && !p.target.dead) {
      this.damage(p.target, p.dmg, p.warhead, p.src);
      this.effects.push({ type: 'explosion', x: p.tx, y: p.ty, size: p.type === 'shell' ? 12 : 10, t: 0, life: 0.4 });
    } else {
      this.effects.push({ type: 'explosion', x: p.tx, y: p.ty, size: 8, t: 0, life: 0.35 });
    }
  }

  // ---------- superweapons ----------
  fireSuper(team, x, y) {
    const t = this.teams[team];
    if (!t.superReady) return false;
    const def = BUILDINGS[t.superKey()];
    t.superReady = false; t.superTimer = 0;
    this.pendingStrikes.push({ team, x, y, t: 0, delay: 3.5, sw: def.superweapon });
    for (const o of this.teams) this.eva(o.id === team ? def.name + ' launched' : 'Warning: ' + def.name + ' launch detected', o.id);
    this.sound('siren');
    return true;
  }

  updateStrikes(dt) {
    for (const s of this.pendingStrikes) {
      s.t += dt;
      if (!s.done && s.t >= s.delay) {
        s.done = true;
        const R = s.sw.radius * TILE;
        for (const o of [...this.unitsNear(s.x, s.y, R + 32)]) {
          const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (d < R) this.damage(o, s.sw.damage * (1 - d / R * 0.5), 'blast', null);
        }
        for (const o of this.entities) {
          if (o.kind !== 'building' || o.dead) continue;
          const d = distTo(s.x, s.y, o);
          if (d < R) this.damage(o, s.sw.damage * (1 - d / R * 0.4), 'blast', null);
        }
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * R;
          this.explosion(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 30 + Math.random() * 30, true, Math.random() * 0.8);
        }
        this.explosion(s.x, s.y, 120, true);
        this.decal(s.x, s.y, R);
        this.shake = 20;
      }
    }
    this.pendingStrikes = this.pendingStrikes.filter(s => s.t < s.delay + 2);
  }

  updateEffects(dt) {
    for (const f of this.effects) {
      f.t += dt;
      if (f.type === 'debris' && f.t > 0) {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vz -= 250 * dt; f.z = Math.max(0, (f.z || 0) + f.vz * dt);
        f.vx *= 0.96; f.vy *= 0.96;
      }
      if (f.type === 'smoke') f.y -= 10 * dt;
      if (f.type === 'falling') f.alt = Math.max(0, f.alt - 60 * dt);
    }
    this.effects = this.effects.filter(f => f.t < f.life);
    if (this.effects.length > 1500) this.effects.splice(0, this.effects.length - 1500);
  }
}
