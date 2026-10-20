// ColdWarning — computer opponent.
// The AI only acts on what it (or an ally) has actually seen: scouts look for enemy bases,
// the unit mix adapts to the enemy's army, raiders hunt harvesters, attack waves gather before
// they strike, pull back when they are losing, and bring engineers to capture key structures.
'use strict';

// how much the AI wants a known enemy structure gone (or captured)
const AI_TARGET_VALUE = {
  super_lance: 14, super_silo: 14, factory: 10, refinery: 9, tech: 8, power: 7, cc: 7,
  airfield: 6, hub: 6, barracks: 5, radar: 5, laser: 3, railturret: 3, turret: 3, bunker: 3, sam: 2,
};
const AI_RAIDERS = ['heli', 'drone'];
const AI_CAPTURE = ['super_lance', 'super_silo', 'cc', 'factory', 'tech', 'hub', 'refinery', 'airfield', 'radar'];

function aiWorth(e) {
  const base = e.def.cost * Math.max(0.2, e.hp / e.maxHp);
  if (e.kind !== 'building') return e.def.weapon ? base : 0;
  let w = e.def.weapon ? base * 1.5 : 0;
  if (e.garrison) for (const u of e.garrison) w += u.def.cost * 1.5; // soldiers behind walls count extra
  return w;
}
function aiArmed(e) { return !!(e.def.weapon || (e.garrison && e.garrison.length)); }

class AI {
  constructor(team, difficulty) {
    this.team = team;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.thinkT = 1 + team.id * 0.35;
    const sup = team.superKey();
    // nation-only structures (Support Hub, Laser Tower) drop out for everyone else
    this.plan = ['power', 'refinery', 'barracks', 'power', 'factory', 'turret', 'refinery', 'radar', 'power', 'railturret', 'bunker',
      'hub', 'airfield', 'power', 'tech', 'laser', 'sam', 'power', 'turret', 'bunker', 'railturret', sup, 'power', 'sam', 'refinery', 'power',
      'laser', 'railturret', 'factory', 'turret', 'sam', 'power'].filter(k => inRoster(k, team.faction));
    this.nextAttack = this.d.firstAttack;
    this.waves = 0;
    this.wave = null;          // the attack wave in the field: { ids, foe, state, stage, t, start, target }
    this.raid = null;          // harvester raiding party: { ids, target, t, start }
    this.nextRaid = 150;
    this.scout = null;         // { id, route, t }
    this.nextScout = 4;
    this.intel = new Map();    // id -> { e, x, y, t } for every enemy entity we have seen
    this.startSeen = {};       // team id -> time we last had eyes on its start area
    this.grudge = {};          // team id -> time it last hit us
    this.lastDefend = -10;
  }

  myUnits() { return G.entities.filter(e => e.kind === 'unit' && e.team === this.team.id && !e.dead); }
  myBuildings() { return G.entities.filter(e => e.kind === 'building' && e.team === this.team.id && !e.dead); }
  unit(id) { const u = G.byId.get(id); return u && !u.dead && u.team === this.team.id ? u : null; }
  units(ids) { const out = []; for (const id of ids) { const u = this.unit(id); if (u) out.push(u); else ids.delete(id); } return out; }
  startPx(id) { const s = G.map.starts[id]; return [s[0] * TILE + TILE / 2, s[1] * TILE + TILE / 2]; }

  // opponents still in the game that have a base to attack (defense-mode wave teams have none)
  foes() { return G.teams.filter(t => !t.defeated && !t.waves && G.hostile(t.id, this.team.id)); }

  // The opponent to go after: one our allies are already fighting, else whoever hit us last,
  // else the nearest, discounting bases we know are heavily fortified.
  chooseFoe() {
    const foes = this.foes();
    if (!foes.length) return null;
    const focus = G.aiFocus && G.aiFocus[this.team.ally];
    if (focus && foes.includes(focus) && Math.random() < 0.75) return focus;
    const [hx, hy] = this.startPx(this.team.id);
    let best = null, bs = 1e9;
    for (const t of foes) {
      const [sx, sy] = this.startPx(t.id);
      let s = Math.hypot(sx - hx, sy - hy) / TILE;
      for (const r of this.intel.values()) if (r.e.team === t.id && r.e.kind === 'building') s += aiWorth(r.e) / 400;
      if (G.time - (this.grudge[t.id] || -1e9) < 90) s -= 25;
      s += Math.random() * 8;
      if (s < bs) { bs = s; best = t; }
    }
    return best;
  }

  nearestFoe() {
    const [hx, hy] = this.startPx(this.team.id);
    let best = null, bd = 1e9;
    for (const t of this.foes()) {
      const [sx, sy] = this.startPx(t.id), d = Math.hypot(sx - hx, sy - hy);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  home() {
    const cc = this.myBuildings().find(b => b.key === 'cc');
    return cc ? [cc.x, cc.y] : this.startPx(this.team.id);
  }

  // where the army waits: a few tiles out from the base toward the likely threat
  rallyTile() {
    const [hx, hy] = this.home();
    const foe = (this.wave && this.wave.foe) || this.nearestFoe();
    const [ex, ey] = foe ? this.startPx(foe.id) : [G.map.w * TILE / 2, G.map.h * TILE / 2];
    const a = Math.atan2(ey - hy, ex - hx);
    return [Math.round(hx / TILE + Math.cos(a) * 7), Math.round(hy / TILE + Math.sin(a) * 7)];
  }

  update(dt) {
    if (this.team.defeated) return;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.8;
    this.think();
  }

  think() {
    const t = this.team;
    this.updateIntel();
    const units = this.myUnits();
    const blds = this.myBuildings();

    // deploy MCVs
    for (const u of units) {
      if (!u.def.mcv || (u.order && u.order.type === 'move')) continue;
      if (!G.deploy(u)) {
        const a = Math.random() * Math.PI * 2;
        G.setMove(u, u.tx + Math.round(Math.cos(a) * 3), u.ty + Math.round(Math.sin(a) * 3), false);
      }
    }
    if (!t.countOf('cc')) {
      if (!t.countOf('mcv') && t.canBuild('mcv') && !t.queues.vehicle.items.includes('mcv')) t.queues.vehicle.add('mcv');
      this.manageArmy(units);
      return;
    }

    this.buildStructures();
    this.produceUnits(units);
    this.manageArmy(units);

    for (const b of blds) if (b.hp < b.maxHp * 0.6 && t.credits > 400) b.repairing = true;
    if (t.superReady) this.useSuper();
  }

  // ---------- intel ----------
  // Record every enemy entity inside the sight of our own or an ally's units and structures.
  // Units are remembered where they were last seen for a while; structures until destroyed.
  updateIntel() {
    const me = this.team.id, src = [], foes = [];
    for (const e of G.entities) {
      if (e.dead) continue;
      if (G.allied(e.team, me)) src.push(e); else if (e.team !== NEUTRAL) foes.push(e);
    }
    for (const e of foes) {
      const pad = e.kind === 'building' ? Math.max(e.w, e.h) * TILE / 2 : 0;
      for (const s of src) {
        const r = s.def.sight * TILE + pad, dx = e.x - s.x, dy = e.y - s.y;
        if (dx > r || dx < -r || dy > r || dy < -r || dx * dx + dy * dy > r * r) continue;
        this.intel.set(e.id, { e, x: e.x, y: e.y, t: G.time });
        break;
      }
    }
    for (const [id, r] of this.intel) {
      if (r.e.dead || !G.hostile(r.e.team, me) || (r.e.kind === 'unit' && G.time - r.t > 300)) this.intel.delete(id);
    }
    for (const t of G.teams) {
      if (!G.hostile(t.id, me)) continue;
      const [sx, sy] = this.startPx(t.id);
      if (src.some(s => s.kind === 'unit' && Math.hypot(s.x - sx, s.y - sy) < 7 * TILE)) this.startSeen[t.id] = G.time;
    }
  }

  known(filter) { const out = []; for (const r of this.intel.values()) if (filter(r)) out.push(r); return out; }

  // known enemy firepower (units seen lately and armed structures) within r tiles of a point
  threatNear(x, y, r, unitsOnly) {
    let s = 0;
    for (const rec of this.intel.values()) {
      if (rec.e.kind === 'unit' && G.time - rec.t > 30) continue;
      if (unitsOnly && rec.e.kind !== 'unit') continue;
      if (Math.hypot(rec.x - x, rec.y - y) < r * TILE) s += aiWorth(rec.e);
    }
    return s;
  }

  // what an attack on a team would run into: its base defenses and the army we last saw
  foeStrength(foe) {
    const [sx, sy] = this.startPx(foe.id);
    let s = 0;
    for (const r of this.intel.values()) {
      if (r.e.team !== foe.id) continue;
      const w = r.e.def.weapon, armed = (w && w.ground) || (r.e.garrison && r.e.garrison.length);
      if (r.e.kind === 'unit' || (armed && Math.hypot(r.x - sx, r.y - sy) < 16 * TILE)) s += aiWorth(r.e);
    }
    return s;
  }

  // ---------- base ----------
  buildStructures() {
    const t = this.team;
    const sq = t.queues.structure, dq = t.queues.defense;
    if (sq.ready) { if (!this.placeReady('structure')) sq.cancel(sq.head); }
    if (dq.ready) { if (!this.placeReady('defense')) dq.cancel(dq.head); }

    const margin = t.powerOut - t.powerIn;
    if (!sq.items.length) {
      if (margin < 40 && t.canBuild('power')) { sq.add('power'); return; }
      const next = this.nextFromPlan('structure');
      if (next) sq.add(next);
      else if (t.credits > 4000 && margin < 120) sq.add('power');
    }
    if (!dq.items.length && t.credits > 1200) {
      const next = this.reactiveDefense() || this.nextFromPlan('defense');
      if (next) dq.add(next);
    }
  }

  // extra SAM sites when scouts report a large air force
  reactiveDefense() {
    if (!this.d.counter || !this.team.canBuild('sam')) return null;
    const mix = this.enemyMix();
    const want = Math.min(6, Math.floor(mix.air / 2500));
    return this.team.countOf('sam') < want ? 'sam' : null;
  }

  nextFromPlan(qtype) {
    const t = this.team, need = {};
    for (const key of this.plan) {
      need[key] = (need[key] || 0) + 1;
      if (queueTypeOf(key) !== qtype) {
        // defenses follow the plan's pacing: wait until earlier structures exist
        if (qtype === 'defense' && t.countOf(key) < need[key]) return null;
        continue;
      }
      if (t.countOf(key) >= need[key]) continue;
      if (t.canBuild(key)) return key;
      if (qtype === 'structure') return null; // wait for prerequisites instead of skipping ahead
    }
    return null;
  }

  placeReady(qtype) {
    const t = this.team, q = t.queues[qtype], key = q.head, def = BUILDINGS[key];
    const blds = this.myBuildings();
    if (!blds.length) return false;
    const [hx, hy] = this.home();
    const foe = this.nearestFoe();
    const [ex, ey] = foe ? this.startPx(foe.id) : [G.map.w * TILE / 2, G.map.h * TILE / 2];
    const toE = Math.atan2(ey - hy, ex - hx);
    const cx = Math.floor(hx / TILE), cy = Math.floor(hy / TILE);
    const m = G.map;
    let best = null, bs = 1e9;
    const R = 16;
    for (let ty = cy - R; ty <= cy + R; ty++) for (let tx = cx - R; tx <= cx + R; tx++) {
      if (tx < 1 || ty < 1 || tx + def.w >= m.w - 1 || ty + def.h >= m.h - 1) continue;
      // keep a one-tile gap around every structure so units can always path
      let ok = true;
      for (let y = ty - 1; y <= ty + def.h && ok; y++) for (let x = tx - 1; x <= tx + def.w; x++) {
        if (m.bld[m.idx(x, y)] >= 0 || (!m.terrainPassable(x, y) && y >= ty && y < ty + def.h && x >= tx && x < tx + def.w)) { ok = false; break; }
      }
      if (!ok) continue;
      // don't block producer exits
      let blocksExit = false;
      for (const b of blds) {
        if (!b.def.produces || b.def.produces === 'air' || b.def.produces === 'structure') continue;
        const exX = b.tx + Math.floor(b.w / 2), exY = b.ty + b.h;
        if (exX >= tx - 1 && exX <= tx + def.w && exY >= ty - 1 && exY <= ty + def.h + 1) { blocksExit = true; break; }
      }
      if (blocksExit) continue;
      const px = (tx + def.w / 2) * TILE, py = (ty + def.h / 2) * TILE;
      const dHome = Math.hypot(px - hx, py - hy) / TILE;
      let score;
      if (def.cat === 'defense') {
        const along = ((px - hx) * Math.cos(toE) + (py - hy) * Math.sin(toE)) / TILE;
        score = Math.abs(dHome - 9) * 1.5 - along * 0.8 + Math.random() * 3;
      } else if (key === 'refinery') {
        score = this.oreDist(tx + 1, ty + 1) * 2 + dHome * 0.3;
      } else {
        score = dHome + Math.random() * 2;
      }
      if (score >= bs) continue;
      if (!G.canPlace(key, t.id, tx, ty)) continue;
      bs = score; best = [tx, ty];
    }
    if (!best) return false;
    return G.tryPlace(t.id, qtype, best[0], best[1]);
  }

  oreDist(cx, cy) {
    const m = G.map;
    for (let r = 0; r < 20; r++) {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !m.inside(x, y)) continue;
        if (m.ore[m.idx(x, y)] > 50) return r;
      }
    }
    return 30;
  }

  // ---------- production ----------
  pick(weights) {
    const opts = Object.entries(weights).filter(([k]) => this.team.canBuild(k));
    const sum = opts.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * sum;
    for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
    return opts.length ? opts[0][0] : null;
  }

  // what the enemy fields, by credits, from what we have seen
  enemyMix() {
    const mix = { infantry: 0, light: 0, heavy: 0, air: 0, defense: 0, total: 0 };
    for (const r of this.intel.values()) {
      const e = r.e;
      if (e.kind === 'building') { if (aiArmed(e)) mix.defense += e.def.cost + aiWorth(e) / 1.5; continue; }
      if (!e.def.weapon) continue;
      const a = e.def.armor;
      mix[a] += e.def.cost; mix.total += e.def.cost;
    }
    return mix;
  }

  produceUnits(units) {
    const t = this.team, Q = t.queues, d = this.d;
    const building = Q.structure.items.length && !Q.structure.ready;
    const reserve = building ? 800 : 0;
    const harvs = units.filter(u => u.def.harvester).length;
    const want = Math.min(t.countOf('refinery') * 2, 6);
    if (harvs < want && t.canBuild('harvester') && !Q.vehicle.items.length && t.credits > 1400) Q.vehicle.add('harvester');

    // engineers to ride along with attack waves
    const engs = units.filter(u => u.def.engineer).length + Q.infantry.items.filter(k => k === 'engineer').length;
    if (engs < d.engineers && this.waves >= 1 && t.countOf('factory') && t.credits > 500 + reserve && t.canBuild('engineer')) {
      Q.infantry.add('engineer');
    }

    // always keep a few of the nation's signature unit in the field
    const sig = FACTIONS[t.faction].signature, sq = UNITS[sig] && Q[queueTypeOf(sig)];
    if (sq && t.canBuild(sig) && !sq.items.length && t.credits > 800 + reserve &&
      units.filter(u => u.key === sig).length < 2 + Math.floor(this.waves / 2)) sq.add(sig);

    const army = units.filter(u => u.def.weapon).length;
    const cap = 18 + this.waves * 4 + Math.floor(t.credits / 2500) * 3; // spend surplus
    if (army > cap) return;

    // lean the mix toward whatever counters the enemy army we have seen
    // (pick() skips whatever this nation can't build, so both blocs share one table)
    let inf = { rifle: 5, rocket: 5, sniper: 1.5, shock: 2.5 };
    let veh = { ifv: 2, flak: 2, tank: 5, mlrs: 1.5, tos: 1.5, railtank: 3, titan: 3, iskander: 1 };
    let air = { heli: 6, drone: 4, kirov: 3, jet: 4 };
    const mix = this.enemyMix();
    if (d.counter && mix.total > 1500) {
      const f = k => mix[k] / mix.total, armor = f('light') + f('heavy');
      const def = Math.min(1, mix.defense / 6000);
      inf = { rifle: 2 + f('infantry') * 8, rocket: 2 + (armor + f('air')) * 8, sniper: f('infantry') * 4, shock: 1 + f('infantry') * 4 + def * 2 };
      veh = { ifv: 1 + f('air') * 5 + f('infantry') * 2, flak: 1 + f('air') * 7 + f('infantry') * 2, tank: 3 + f('light') * 4 + f('heavy') * 2,
        mlrs: 1 + f('infantry') * 3 + def * 3, tos: 1 + f('infantry') * 3 + def * 3, railtank: 2 + f('heavy') * 4, titan: 2 + f('heavy') * 3 + f('air') * 3,
        iskander: def * 3 };
      air = { heli: 3 + armor * 6, drone: 3 + armor * 4, kirov: 2 + def * 3 + f('infantry') * 2, jet: 2 + f('air') * 10 };
    }
    // helicopters (or Reaper drones) for the raiding party: they fly over defenses and don't hold up the war factory
    if (d.raid && units.filter(u => AI_RAIDERS.includes(u.key)).length < d.raid) { air.heli += 5; air.drone += 5; }
    // with a factory up and money in the bank, armour is a better buy than another trooper
    const armyUnits = units.filter(u => u.def.weapon && !u.def.harvester);
    const infShare = armyUnits.filter(u => u.def.cat === 'infantry').length / Math.max(1, armyUnits.length);
    const heavy = d.counter && t.countOf('factory') && infShare > 0.45;
    if (heavy) { veh.tank *= 2; veh.railtank *= 2; veh.titan *= 2; }
    // empty bunker slots get riflemen first
    let slots = 0;
    for (const b of G.entities) if (b.team === t.id && !b.dead && b.key === 'bunker') slots += b.def.garrison - (b.garrison ? b.garrison.length : 0);
    slots -= units.filter(u => u.def.cat === 'infantry' && u.def.weapon && (!u.order || u.order.type === 'garrison')).length;
    if (slots > 0 && !heavy && Q.infantry.items.length < 2 && t.credits > 300 + reserve && t.canBuild('rifle')) Q.infantry.add('rifle');
    else if (!(heavy && t.credits < 2500) && Q.infantry.items.length < 2 && t.credits > 500 + reserve && t.canBuild('rifle')) {
      const k = this.pick(inf);
      if (k) Q.infantry.add(k);
    }
    if (Q.vehicle.items.length < 2 && t.credits > 1100 + reserve && t.canBuild('tank')) {
      const k = this.pick(veh);
      if (k) Q.vehicle.add(k);
    }
    if (Q.air.items.length < 1 && t.credits > 1600 + reserve && t.canBuild('heli')) {
      const k = this.pick(air);
      if (k) Q.air.add(k);
    }
  }

  // ---------- army ----------
  manageArmy(units) {
    const busy = new Set();
    if (this.wave) for (const id of this.wave.ids) busy.add(id);
    if (this.raid) for (const id of this.raid.ids) busy.add(id);
    if (this.scout) busy.add(this.scout.id);

    const home = units.filter(u => (u.def.weapon || u.def.engineer) && !u.def.harvester && !busy.has(u.id));
    const fighters = home.filter(u => u.def.weapon);
    const [rx, ry] = this.rallyTile();
    const [hx, hy] = this.home();
    for (const u of home) {
      if (u.order || u.target || u.def.engineer) continue;
      if (Math.hypot(u.x / TILE - rx, u.y / TILE - ry) > 6) G.commandMove([u], rx, ry, true, true);
      else if (u.def.dig && !u.dug && !u.digging) G.digIn(u); // riflemen waiting at the rally point dig in
    }
    for (const u of home) if (u.def.engineer && !u.order && Math.hypot(u.x / TILE - rx, u.y / TILE - ry) > 6) G.commandMove([u], rx, ry, false, true);

    this.manageScout(fighters);
    this.manageRaid(fighters);
    this.manageGarrisons(fighters);

    const waveSize = Math.min(24, this.d.waveBase + this.waves * this.d.waveGrow);
    const pool = fighters.filter(u => !(this.scout && u.id === this.scout.id) && !(this.raid && this.raid.ids.has(u.id)) &&
      !(u.order && u.order.type === 'garrison'));
    // hold the army at home while enemies are known to be near the base
    // (a garrisoned building nearby doesn't count: it isn't going anywhere)
    if (G.time >= this.nextAttack && pool.length >= waveSize && this.threatNear(hx, hy, 22, true) < 1500) {
      if (this.wave && this.wave.state !== 'retreat') this.reinforce(pool);
      else if (!this.wave) {
        // only attack with the odds in our favour, unless the army is as big as it gets
        const foe = this.chooseFoe(), mine = pool.reduce((s, u) => s + aiWorth(u), 0);
        const ratio = this.d.counter ? 1.5 : 0;
        if (foe && (mine >= this.foeStrength(foe) * ratio || pool.length >= 32 || G.time - this.nextAttack > 240)) {
          this.launch(foe, pool, home.filter(u => u.def.engineer));
        }
      }
    }
    if (this.wave) this.manageWave();
  }

  launch(foe, fighters, engineers) {
    G.aiFocus = G.aiFocus || {};
    G.aiFocus[this.team.ally] = foe;
    const ids = new Set([...fighters, ...engineers].map(u => u.id));
    // stage short of the enemy base so the wave arrives together
    const [hx, hy] = this.home(), [ex, ey] = this.startPx(foe.id);
    const dist = Math.hypot(ex - hx, ey - hy);
    const back = Math.min(26 * TILE, dist * 0.45);
    const sx = Math.round((ex + (hx - ex) / dist * back) / TILE), sy = Math.round((ey + (hy - ey) / dist * back) / TILE);
    this.wave = { ids, foe, state: 'stage', stage: [sx, sy], t: G.time, start: 0, target: null };
    G.commandMove(fighters, sx, sy, true, true);
    if (engineers.length) G.commandMove(engineers, sx, sy, false, true);
    this.waves++;
    this.nextAttack = G.time + 70 + Math.random() * 40;
  }

  reinforce(fighters) {
    const w = this.wave;
    const live = this.units(w.ids);
    if (!live.length) return;
    const cx = live.reduce((s, u) => s + u.x, 0) / live.length, cy = live.reduce((s, u) => s + u.y, 0) / live.length;
    G.commandMove(fighters, Math.floor(cx / TILE), Math.floor(cy / TILE), true, true);
    for (const u of fighters) w.ids.add(u.id);
    w.start += fighters.reduce((s, u) => s + aiWorth(u), 0);
    this.nextAttack = G.time + 60 + Math.random() * 30;
  }

  manageWave() {
    const w = this.wave;
    const live = this.units(w.ids);
    if (!live.length) { this.wave = null; return; }
    const fighters = live.filter(u => u.def.weapon), engineers = live.filter(u => u.def.engineer);
    if (!fighters.length) {
      for (const e of engineers) G.commandMove([e], ...this.rallyTile(), false, true);
      this.wave = null;
      return;
    }
    const cx = fighters.reduce((s, u) => s + u.x, 0) / fighters.length, cy = fighters.reduce((s, u) => s + u.y, 0) / fighters.length;
    const strength = fighters.reduce((s, u) => s + aiWorth(u), 0);
    if (w.foe.defeated) { w.foe = this.chooseFoe() || w.foe; w.target = null; }

    if (w.state === 'stage') {
      const [sx, sy] = w.stage;
      const ground = fighters.filter(u => !u.air);
      const near = ground.filter(u => Math.hypot(u.x / TILE - sx, u.y / TILE - sy) < 8).length;
      if (near >= ground.length * 0.8 || G.time - w.t > 30) {
        w.state = 'assault'; w.t = G.time; w.start = strength;
        this.retarget(w, fighters, cx, cy, true);
      } else {
        // stragglers that got distracted keep heading for the staging point
        for (const u of fighters) if (!u.order && !u.target) G.commandMove([u], sx, sy, true, true);
      }
      return;
    }

    if (w.state === 'assault') {
      // losing badly: fall back and rebuild rather than feed units in one at a time
      if (this.d.retreat && strength < w.start * this.d.retreat && this.threatNear(cx, cy, 10) > strength * 1.2) {
        this.retreat(live);
        return;
      }
      if (!w.target || w.target.dead || !G.hostile(w.target.team, this.team.id)) this.retarget(w, fighters, cx, cy, true);
      else this.retarget(w, fighters.filter(u => !u.order && !u.target), cx, cy, false);
      this.useEngineers(engineers, cx, cy);
      this.seizeCover(w, fighters, cx, cy);
      return;
    }

    if (w.state === 'retreat') {
      const [rx, ry] = this.rallyTile();
      if (Math.hypot(cx / TILE - rx, cy / TILE - ry) < 8 || G.time - w.t > 40) this.wave = null;
    }
  }

  retreat(live) {
    const w = this.wave;
    const [rx, ry] = this.rallyTile();
    G.commandMove(live, rx, ry, false, true);
    w.state = 'retreat'; w.t = G.time;
    this.nextAttack = Math.max(this.nextAttack, G.time + 45);
  }

  // Send the wave at the most valuable known structure, or at the enemy's start if we know nothing.
  retarget(w, units, cx, cy, fresh) {
    if (fresh) w.target = this.pickTarget(cx, cy, w.foe);
    let tx, ty;
    if (w.target) { tx = Math.floor(w.target.x / TILE); ty = Math.floor(w.target.y / TILE); }
    else {
      const [sx, sy] = this.startPx(w.foe.id);
      // already there and found nothing: fall back to any known enemy at all
      const near = Math.hypot(cx - sx, cy - sy) < 6 * TILE;
      const any = near ? this.pickTarget(cx, cy, null) : null;
      if (any) { w.target = any; tx = Math.floor(any.x / TILE); ty = Math.floor(any.y / TILE); }
      else { tx = Math.floor(sx / TILE); ty = Math.floor(sy / TILE); }
    }
    if (units.length) G.commandMove(units, tx, ty, true, true);
  }

  pickTarget(x, y, foe) {
    let best = null, bs = 1e9;
    for (const r of this.intel.values()) {
      const e = r.e;
      if (foe && e.team !== foe.id) continue;
      let s = Math.hypot(r.x - x, r.y - y) / TILE;
      if (e.kind === 'building') s -= (AI_TARGET_VALUE[e.key] || 3) * 2;
      else s += 20; // units come to us anyway; prefer the base
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  // Engineers pick a structure worth stealing near the wave and walk in once it is unguarded.
  useEngineers(engineers, cx, cy) {
    for (const eng of engineers) {
      if (eng.order && eng.order.type === 'capture') continue;
      let best = null, bs = 1e9;
      for (const r of this.intel.values()) {
        const b = r.e;
        if (b.kind !== 'building' || !AI_CAPTURE.includes(b.key)) continue;
        const d = Math.hypot(b.x - cx, b.y - cy) / TILE;
        if (d > 14) continue;
        const s = d + AI_CAPTURE.indexOf(b.key) * 2;
        if (s < bs) { bs = s; best = b; }
      }
      if (!best) {
        if (!eng.order) G.commandMove([eng], Math.floor(cx / TILE), Math.floor(cy / TILE), false, true);
        continue;
      }
      // walk in once nothing much guards it; the wave keeps fighting nearby
      if (this.threatNear(best.x, best.y, 6) < 800) G.commandCapture(eng, best);
      else if (!eng.order) G.commandMove([eng], Math.floor(cx / TILE), Math.floor(cy / TILE), false, true);
    }
  }

  // ---------- garrisons ----------
  // Keep our bunkers manned, hold a civilian building or two on our side of the map as
  // outposts, and get out of any that are about to come down.
  manageGarrisons(fighters) {
    const me = this.team.id, [hx, hy] = this.home(), [rx, ry] = this.rallyTile();
    const held = [], free = [];
    for (const b of G.entities) {
      if (b.dead || !b.def.garrison) continue;
      if (b.team === me) held.push(b); else if (b.team === NEUTRAL) free.push(b);
    }
    for (const b of held) {
      if (b.def.cat === 'civilian' && b.garrison.length && b.hp < b.maxHp * 0.2) G.evacuate(b);
    }
    // too many outposts (waves leave some behind): give up the quietest one far from home
    const outposts = held.filter(b => b.def.cat === 'civilian' && b.garrison.length);
    const maxOutposts = this.d.counter && this.waves ? 2 : 1;
    if (outposts.length > maxOutposts) {
      const quiet = outposts.filter(b => this.threatNear(b.x, b.y, 12) === 0)
        .sort((a, b) => Math.hypot(b.x - hx, b.y - hy) - Math.hypot(a.x - hx, a.y - hy));
      if (quiet[0]) G.evacuate(quiet[0]);
    }
    // the field army comes first: only spare troops go behind walls
    if (fighters.length < 8) return;
    const idle = fighters.filter(u => u.def.cat === 'infantry' && !u.order && !u.target && Math.hypot(u.x / TILE - rx, u.y / TILE - ry) < 10);
    const fill = (b, n) => {
      const pick = idle.filter(u => G.canGarrison(u, b))
        .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y)).slice(0, n);
      for (const u of G.commandGarrison(pick, b)) idle.splice(idle.indexOf(u), 1);
    };
    for (const b of held) if (b.def.cat !== 'civilian' && (b.garrison ? b.garrison.length : 0) < b.def.garrison) fill(b, b.def.garrison);
    if (idle.length < 4 || fighters.length < 12 || outposts.length >= maxOutposts) return;
    // a free building on our side of the map, near the rally point
    const foe = this.nearestFoe();
    const [ex, ey] = foe ? this.startPx(foe.id) : [G.map.w * TILE / 2, G.map.h * TILE / 2];
    let best = null, bs = 1e9;
    for (const b of free.concat(held.filter(b => b.def.cat === 'civilian'))) {
      const dHome = Math.hypot(b.x - hx, b.y - hy);
      if (dHome > 22 * TILE || dHome > Math.hypot(b.x - ex, b.y - ey)) continue;
      if (this.threatNear(b.x, b.y, 10) > 1500) continue;
      const s = Math.hypot(b.x / TILE - rx, b.y / TILE - ry) - b.def.garrison;
      if (s < bs) { bs = s; best = b; }
    }
    if (best) fill(best, Math.min(4, best.def.garrison));
  }

  // An attack wave fighting next to an empty building sends a few riflemen in to hold it.
  seizeCover(w, fighters, cx, cy) {
    if (G.time - (w.coverT || -1e9) < 20) return;
    const inf = fighters.filter(u => u.def.cat === 'infantry' && !u.air);
    if (inf.length < 4 || this.threatNear(cx, cy, 10) === 0) return;
    let best = null, bd = 8 * TILE;
    for (const b of G.entities) {
      if (b.dead || b.team !== NEUTRAL || !b.def.garrison) continue;
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    w.coverT = G.time;
    const pick = inf.sort((a, c) => Math.hypot(a.x - best.x, a.y - best.y) - Math.hypot(c.x - best.x, c.y - best.y)).slice(0, 3);
    G.commandGarrison(pick, best);
  }

  // An early scout looks at every enemy start; later ones refresh whichever is stalest.
  manageScout(fighters) {
    let s = this.scout;
    if (s) {
      const u = this.unit(s.id);
      if (!u) { this.scout = null; this.nextScout = G.time + 60; return; }
      if (u.order && G.time - s.t < 45) return;
      if (s.route.length) {
        const [tx, ty] = s.route.shift();
        G.commandMove([u], tx, ty, false, true);
        s.t = G.time;
        return;
      }
      this.scout = null;
      this.nextScout = G.time + 60;
      return;
    }
    if (G.time < this.nextScout) return;
    const stale = G.teams.filter(t => G.hostile(t.id, this.team.id) && !t.defeated && !t.waves &&
      G.time - (this.startSeen[t.id] ?? -1e9) > 100);
    if (!stale.length) { this.nextScout = G.time + 30; return; }
    const cand = fighters.filter(u => ['ifv', 'flak', 'drone', 'heli', 'rifle'].includes(u.key))
      .sort((a, b) => b.def.speed - a.def.speed);
    const u = cand[0];
    if (!u) { this.nextScout = G.time + 20; return; }
    const [hx, hy] = this.home();
    stale.sort((a, b) => {
      const [ax, ay] = this.startPx(a.id), [bx, by] = this.startPx(b.id);
      return Math.hypot(ax - hx, ay - hy) - Math.hypot(bx - hx, by - hy);
    });
    const route = stale.map(t => G.map.starts[t.id].slice());
    route.push(this.rallyTile());
    this.scout = { id: u.id, route, t: G.time };
    const [tx, ty] = route.shift();
    G.commandMove([u], tx, ty, false, true);
  }

  // A small party of fast units hunts down harvesters away from enemy defenses.
  manageRaid(fighters) {
    const size = this.d.raid;
    if (!size) return;
    if (this.raid) {
      const r = this.raid, live = this.units(r.ids);
      const strength = live.reduce((s, u) => s + aiWorth(u), 0);
      const done = !live.length || !r.target || r.target.dead || G.time - r.t > 70;
      if (done || strength < r.start * 0.5) {
        if (live.length) G.commandMove(live, ...this.rallyTile(), false, true);
        this.raid = null;
        this.nextRaid = G.time + (done && r.target && r.target.dead ? 40 : 80);
        return;
      }
      const idle = live.filter(u => !u.target || u.target !== r.target);
      if (idle.length) G.commandAttack(idle.filter(u => G.canHit(u, r.target)), r.target);
      return;
    }
    if (G.time < this.nextRaid) return;
    const fast = fighters.filter(u => AI_RAIDERS.includes(u.key) && (!this.scout || u.id !== this.scout.id));
    if (fast.length < Math.min(2, size)) return;
    const party = fast.slice(0, size);
    const px = party[0].x, py = party[0].y;
    let best = null, bs = 1e9;
    for (const r of this.intel.values()) {
      if (!r.e.def.harvester) continue; // harvesters keep working the same ore field, so old sightings will do
      const defense = this.threatNear(r.x, r.y, 8);
      const s = Math.hypot(r.x - px, r.y - py) / TILE + defense / 150;
      if (defense < 3000 && s < bs) { bs = s; best = r.e; }
    }
    if (!best) { this.nextRaid = G.time + 15; return; }
    this.raid = { ids: new Set(party.map(u => u.id)), target: best, t: G.time, start: party.reduce((s, u) => s + aiWorth(u), 0) };
    G.commandAttack(party.filter(u => G.canHit(u, best)), best);
  }

  useSuper() {
    let best = null, bv = 0;
    const known = [...this.intel.values()];
    for (const r of known) {
      if (r.e.kind !== 'building') continue;
      let v = 0;
      for (const o of known) if (Math.hypot(o.x - r.x, o.y - r.y) < 4 * TILE) v += o.e.kind === 'building' ? o.e.def.cost : o.e.def.cost * 0.5;
      if (v > bv) { bv = v; best = r; }
    }
    if (best) G.fireSuper(this.team.id, best.x, best.y);
  }

  onUnitBuilt(u) { /* rally handled in manageArmy */ }

  onAttacked(target, attacker) {
    this.grudge[attacker.team] = G.time;
    this.intel.set(attacker.id, { e: attacker, x: attacker.x, y: attacker.y, t: G.time });
    // harvesters run for the nearest refinery
    if (target.def.harvester && target.hp < target.maxHp * 0.65 && target.hstate !== 'toRef') {
      const refs = this.myBuildings().filter(b => b.key === 'refinery');
      refs.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
      if (refs[0]) G.commandDock(target, refs[0]);
    }
    if (G.time - this.lastDefend < 3) return;
    if (target.kind !== 'building' && !target.def.harvester) return;
    this.lastDefend = G.time;
    const busy = new Set([...(this.wave ? this.wave.ids : []), ...(this.raid ? this.raid.ids : [])]);
    const mine = this.myUnits().filter(u => u.def.weapon && !busy.has(u.id) && G.canHit(u, attacker) && !(u.order && u.order.type === 'garrison'));
    const defenders = mine.filter(u => Math.hypot(u.x - target.x, u.y - target.y) < 30 * TILE);
    // attack-move rather than all chasing the one attacker, so defenders engage whatever is closest
    const idle = defenders.filter(u => !u.target);
    if (idle.length) G.commandMove(idle, Math.floor(attacker.x / TILE), Math.floor(attacker.y / TILE), true, true);
    // a big assault on the base calls the attack wave home
    if (target.kind === 'building' && target.def.cat !== 'civilian' && this.wave && this.wave.state !== 'retreat') {
      const threat = G.entities.filter(e => !e.dead && e.kind === 'unit' && G.hostile(e.team, this.team.id) &&
        Math.hypot(e.x - target.x, e.y - target.y) < 10 * TILE).reduce((s, e) => s + aiWorth(e), 0);
      const guard = defenders.reduce((s, u) => s + aiWorth(u), 0) +
        this.myBuildings().filter(b => b.def.weapon && Math.hypot(b.x - target.x, b.y - target.y) < 10 * TILE).reduce((s, b) => s + aiWorth(b), 0);
      if (threat > 4000 && threat > guard * 1.5) {
        // fight our way home rather than run, so the wave hits the raiders from behind
        const live = this.units(this.wave.ids);
        G.commandMove(live.filter(u => u.def.weapon), Math.floor(target.x / TILE), Math.floor(target.y / TILE), true, true);
        this.wave.state = 'retreat'; this.wave.t = G.time;
      }
    }
  }
}
