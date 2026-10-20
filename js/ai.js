// ColdWarning — computer opponent.
'use strict';

class AI {
  constructor(team, difficulty) {
    this.team = team;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.thinkT = 1 + team.id * 0.35;
    const sup = team.superKey();
    this.plan = ['power', 'refinery', 'barracks', 'power', 'factory', 'turret', 'refinery', 'radar', 'power', 'railturret',
      'airfield', 'power', 'tech', 'sam', 'power', 'turret', 'railturret', sup, 'power', 'sam', 'refinery', 'power',
      'railturret', 'factory', 'turret', 'sam', 'power'];
    this.nextAttack = this.d.firstAttack;
    this.wave = 0;
    this.attackers = new Set();
    this.lastDefend = -10;
  }

  myUnits() { return G.entities.filter(e => e.kind === 'unit' && e.team === this.team.id && !e.dead); }
  myBuildings() { return G.entities.filter(e => e.kind === 'building' && e.team === this.team.id && !e.dead); }
  enemyOf() { return G.teams.find(t => t.id !== this.team.id && !t.defeated); }

  home() {
    const cc = this.myBuildings().find(b => b.key === 'cc');
    if (cc) return [cc.x, cc.y];
    const s = G.map.starts[this.team.id];
    return [s[0] * TILE, s[1] * TILE];
  }

  enemyHome() {
    const e = this.enemyOf();
    if (!e) return this.home();
    const s = G.map.starts[e.id];
    return [s[0] * TILE, s[1] * TILE];
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
      const next = this.nextFromPlan('defense');
      if (next) dq.add(next);
    }
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
    const [ex, ey] = this.enemyHome();
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

  pick(weights) {
    const opts = Object.entries(weights).filter(([k]) => this.team.canBuild(k));
    const sum = opts.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * sum;
    for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
    return opts.length ? opts[0][0] : null;
  }

  produceUnits(units) {
    const t = this.team, Q = t.queues;
    const building = Q.structure.items.length && !Q.structure.ready;
    const reserve = building ? 800 : 0;
    const harvs = units.filter(u => u.def.harvester).length;
    const want = Math.min(t.countOf('refinery') * 2, 6);
    if (harvs < want && t.canBuild('harvester') && !Q.vehicle.items.length && t.credits > 1400) Q.vehicle.add('harvester');
    const army = units.filter(u => u.def.weapon).length;
    const cap = 18 + this.wave * 4 + Math.floor(t.credits / 2500) * 3; // spend surplus
    if (army > cap) return;
    if (Q.infantry.items.length < 2 && t.credits > 500 + reserve && t.canBuild('rifle')) {
      const k = this.pick({ rifle: 5, rocket: 5 });
      if (k) Q.infantry.add(k);
    }
    if (Q.vehicle.items.length < 2 && t.credits > 1100 + reserve && t.canBuild('tank')) {
      const k = this.pick({ ifv: 2, tank: 5, mlrs: 1.5, railtank: 3, titan: 3 });
      if (k) Q.vehicle.add(k);
    }
    if (Q.air.items.length < 1 && t.credits > 2200 + reserve && t.canBuild('heli')) {
      const k = this.pick({ heli: 6, jet: 4 });
      if (k) Q.air.add(k);
    }
  }

  manageArmy(units) {
    const army = units.filter(u => u.def.weapon && !u.def.harvester);
    for (const id of [...this.attackers]) { const u = G.byId.get(id); if (!u || u.dead) this.attackers.delete(id); }
    const [hx, hy] = this.home(), [ex, ey] = this.enemyHome();
    const a = Math.atan2(ey - hy, ex - hx);
    const rx = Math.round(hx / TILE + Math.cos(a) * 7), ry = Math.round(hy / TILE + Math.sin(a) * 7);

    const home = army.filter(u => !this.attackers.has(u.id));
    for (const u of home) {
      if (u.order || u.target) continue;
      if (Math.hypot(u.x / TILE - rx, u.y / TILE - ry) > 6) G.commandMove([u], rx, ry, true, true);
    }

    const waveSize = Math.min(24, this.d.waveBase + this.wave * this.d.waveGrow);
    if (G.time >= this.nextAttack && home.length >= waveSize) {
      const tgt = this.pickTarget(hx, hy);
      if (tgt) {
        G.commandMove(home, Math.floor(tgt.x / TILE), Math.floor(tgt.y / TILE), true, true);
        for (const u of home) this.attackers.add(u.id);
        this.wave++;
        this.nextAttack = G.time + 70 + Math.random() * 40;
      }
    }
    // attackers that have run out of things to do push on to the next target
    for (const id of this.attackers) {
      const u = G.byId.get(id);
      if (!u || u.order || u.target) continue;
      const tgt = this.pickTarget(u.x, u.y);
      if (tgt) G.commandMove([u], Math.floor(tgt.x / TILE), Math.floor(tgt.y / TILE), true, true);
    }
  }

  pickTarget(x, y) {
    let best = null, bd = 1e9;
    for (const e of G.entities) {
      if (e.dead || e.team === this.team.id) continue;
      const d = Math.hypot(e.x - x, e.y - y) + (e.kind === 'unit' ? 600 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  useSuper() {
    let best = null, bv = 0;
    const foes = G.entities.filter(e => e.team !== this.team.id && !e.dead);
    for (const e of foes) {
      if (e.kind !== 'building') continue;
      let v = 0;
      for (const o of foes) if (Math.hypot(o.x - e.x, o.y - e.y) < 4 * TILE) v += o.kind === 'building' ? o.def.cost : o.def.cost * 0.5;
      if (v > bv) { bv = v; best = e; }
    }
    if (best) G.fireSuper(this.team.id, best.x, best.y);
  }

  onUnitBuilt(u) { /* rally handled in manageArmy */ }

  onAttacked(target, attacker) {
    if (G.time - this.lastDefend < 3) return;
    if (target.kind !== 'building' && !target.def.harvester) return;
    this.lastDefend = G.time;
    const defenders = this.myUnits().filter(u => u.def.weapon && !this.attackers.has(u.id) &&
      Math.hypot(u.x - target.x, u.y - target.y) < 30 * TILE && G.canHit(u, attacker));
    if (defenders.length) G.commandAttack(defenders, attacker);
  }
}
