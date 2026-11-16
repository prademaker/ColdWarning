// ColdWarning — skirmish extras: supply crates, oil derricks and king of the hill.
// Each is a menu option (skirmish and defense; the hill only in skirmish). Campaign missions
// never get them. All state lives in plain fields on the Game so save/load keeps it.
'use strict';

Object.assign(Game.prototype, {
  // called once from the Game constructor, after the map and its civilian buildings are down
  initExtras(opts, md) {
    this.crateOn = !md && opts.crates !== false;
    this.crates = [];          // { id, x, y, t }: what is inside is only decided when one is opened
    this.crateT = CRATES.first;
    if (!md && opts.oil !== false) for (const o of this.map.oil || []) this.placeBuilding('oil', NEUTRAL, o.tx, o.ty).built = 1;
    this.hill = !md && this.mode === 'skirmish' && opts.victory === 'koth' ? this.makeHill() : null;
  },

  updateExtras(dt) {
    if (this.crateOn && this.crates) this.updateCrates(dt);
    if (this.hill) this.updateHill(dt);
  },

  // ---------- supply crates ----------
  updateCrates(dt) {
    this.crateT -= dt;
    if (this.crateT <= 0) {
      this.crateT = CRATES.every * (0.8 + Math.random() * 0.4);
      if (this.crates.length < CRATES.max + this.teams.length) this.dropCrate();
    }
    const reach = CRATES.reach * TILE;
    for (const c of this.crates) {
      if (this.time - c.t > CRATES.life) { c.gone = true; continue; }
      for (const u of this.unitsNear(c.x, c.y, reach)) {
        if (u.kind !== 'unit' || u.air || u.team === NEUTRAL || u.inside || u.aboard || this.teams[u.team].waves) continue;
        if (Math.hypot(u.x - c.x, u.y - c.y) > reach) continue;
        this.openCrate(c, u);
        break;
      }
    }
    if (this.crates.some(c => c.gone)) this.crates = this.crates.filter(c => !c.gone);
  },

  // a random spot on open ground any army can walk to, away from the bases and other crates
  dropCrate() {
    const m = this.map, N = m.w, reach = m.flood(m.starts[0]);
    for (let k = 0; k < 80; k++) {
      const tx = 4 + Math.floor(Math.random() * (N - 8)), ty = 4 + Math.floor(Math.random() * (N - 8)), i = m.idx(tx, ty);
      if (!reach[i] || !m.terrainPassable(tx, ty) || m.bld[i] >= 0) continue;
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      if (this.crates.some(c => Math.hypot(c.x - x, c.y - y) < 8 * TILE)) continue;
      if (this.entities.some(e => e.kind === 'building' && !e.dead && e.team !== NEUTRAL && distTo(x, y, e) < 7 * TILE)) continue;
      if (this.teams.some((t, id) => !t.defeated && !t.waves && m.starts[id] && Math.hypot(m.starts[id][0] - tx, m.starts[id][1] - ty) < 12)) continue;
      this.crates.push({ id: NEXT_ID++, x, y, t: this.time });
      return true;
    }
    return false;
  },

  // weighted pick of what is inside, leaving out what would do nothing for whoever found it
  crateKind(u) {
    const K = CRATES.kinds, near = (r, f) => this.unitsNear(u.x, u.y, r * TILE).some(o => o.kind === 'unit' && o.team === u.team && f(o));
    const w = {};
    for (const k in K) w[k] = K[k].w;
    if (!near(K.repair.radius, o => o.hp < o.maxHp * 0.8)) w.repair = 0;
    if (!near(K.promote.radius, o => this.promotable(o))) w.promote = 0;
    if (u.team !== this.player) w.map = 0;           // only the player has a map to uncover
    else if (this.explored.every(v => v)) w.map = 0;
    let sum = 0;
    for (const k in w) sum += w[k];
    let r = Math.random() * sum;
    for (const k in w) { r -= w[k]; if (r < 0) return k; }
    return 'cash';
  },

  promotable(o) { return o.rank < 2 && o.def.weapon && !o.def.ultimate && !o.def.harvester && !o.def.mcv; },

  openCrate(c, u) {
    c.gone = true;
    const team = this.teams[u.team], K = CRATES.kinds, kind = this.crateKind(u);
    let text = K[kind].text, color = '#ffe36a';
    team.stats.crates = (team.stats.crates || 0) + 1;
    if (kind === 'cash') {
      const n = 500 * (2 + Math.floor(Math.random() * 3));
      team.credits += n;
      text = text.replace('{n}', n.toLocaleString());
      this.sound('sell', c.x, c.y);
    } else if (kind === 'repair') {
      for (const o of this.unitsNear(u.x, u.y, K.repair.radius * TILE)) if (o.kind === 'unit' && o.team === u.team && Math.hypot(o.x - u.x, o.y - u.y) <= K.repair.radius * TILE) o.hp = o.maxHp;
      color = '#7dff8a';
      this.sound('capture', c.x, c.y);
    } else if (kind === 'promote') {
      for (const o of this.unitsNear(u.x, u.y, K.promote.radius * TILE)) {
        if (o.kind !== 'unit' || o.team !== u.team || !this.promotable(o) || Math.hypot(o.x - u.x, o.y - u.y) > K.promote.radius * TILE) continue;
        o.rank++;
        o.kills = Math.max(o.kills, RANK_KILLS[o.rank - 1]);
        if (typeof Combat !== 'undefined' && o.team === this.player) Combat.note(o, o.rank === 2 ? 'ELITE' : 'PROMOTED', '#ffe36a');
      }
      this.sound('ready', c.x, c.y);
    } else if (kind === 'unit') {
      const pool = K.unit.pool.map(k => sideKey(k, team.faction)).filter(k => UNITS[k] && inRoster(k, team.faction));
      const key = pool[Math.floor(Math.random() * pool.length)] || 'tank';
      const n = UNITS[key].cat === 'infantry' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const s = this.findFreeTile(Math.floor(c.x / TILE) + i, Math.floor(c.y / TILE));
        if (s) this.spawnUnit(key, u.team, s[0] * TILE + TILE / 2, s[1] * TILE + TILE / 2);
      }
      team.recount();
      text += ': ' + (n > 1 ? n + ' × ' : '') + nameOf(key, team.faction);
      this.sound('ready', c.x, c.y);
    } else if (kind === 'map') {
      this.explored.fill(1);
      this.fogDirty = true;
      this.sound('ready', c.x, c.y);
    } else if (kind === 'trap') {
      const R = K.trap.radius * TILE;
      this.explosion(c.x, c.y, 70, true);
      this.decal(c.x, c.y, R * 0.7);
      for (const o of this.unitsNear(c.x, c.y, R)) {
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (o.kind === 'unit' && !o.air && d <= R) this.damage(o, K.trap.damage * (1 - d / R * 0.5), 'blast', null);
      }
      color = '#ff7a6a';
      this.sound('boom', c.x, c.y);
    }
    this.effects.push({ type: 'flash', x: c.x, y: c.y, z: 6, t: 0, life: 0.3, size: 14, color: '#ffe8a0' });
    this.eva(text, u.team);
    if (typeof Combat !== 'undefined' && u.team === this.player && !u.dead) Combat.note(u, K[kind].note || kind.toUpperCase(), color);
  },

  // ---------- oil derricks ----------
  // credits once a second for the holder (none while it burns)
  pumpOil(b, dt) {
    if (b.team === NEUTRAL || b.burnT > this.time) return;
    b.oilT = (b.oilT || 0) - dt;
    if (b.oilT > 0) return;
    b.oilT = OIL.per;
    const t = this.teams[b.team], v = OIL.rate * OIL.per * t.incomeMult;
    t.credits += v; t.stats.harvested += v; t.stats.oil = (t.stats.oil || 0) + v;
  },

  derrickBurning(b) { return b.burnT > this.time; },

  // an Engineer takes it over, patches it up and banks the bonus
  captureDerrick(b, u) {
    const old = b.team, t = this.teams[u.team];
    b.team = u.team; b.hp = b.maxHp; b.target = null; b.oilT = OIL.per;
    t.credits += OIL.bonus;
    t.recount();
    if (old !== NEUTRAL) { this.teams[old].recount(); this.eva('Oil derrick lost', old); }
    this.eva('Oil derrick captured', u.team);
    if (typeof Combat !== 'undefined' && u.team === this.player) Combat.note(b, '+$' + OIL.bonus, '#ffe36a');
    this.removeEntity(u);
    this.sound('capture', b.x, b.y);
    this.fogDirty = true;
  },

  // shot down: it doesn't fall, it catches fire and nobody holds it until the fire is out
  knockOutDerrick(b, attacker) {
    const old = b.team;
    b.team = NEUTRAL; b.target = null;
    b.hp = b.maxHp * 0.35;
    b.burnT = this.time + OIL.burn;
    this.explosion(b.x, b.y, 50, true);
    for (let i = 0; i < 3; i++) this.explosion(b.tx * TILE + Math.random() * b.w * TILE, b.ty * TILE + Math.random() * b.h * TILE, 18, false, Math.random() * 0.5);
    if (old !== NEUTRAL) {
      this.teams[old].recount();
      this.eva('Oil derrick lost', old);
      if (attacker && attacker.team !== NEUTRAL) this.eva('Enemy oil derrick destroyed', attacker.team);
    }
    // anyone still on their way to take it waits for the fire to go out
    this.fogDirty = true;
  },

  // ---------- king of the hill ----------
  makeHill() {
    const c = this.map.w >> 1;
    return { x: (c + 0.5) * TILE, y: (c + 0.5) * TILE, r: KOTH.radius * TILE, hold: KOTH.hold, score: {}, holder: null, contested: false, warned: {}, last: null };
  },

  // alliances with armed ground units (or warships) inside the circle right now
  hillPresence() {
    const h = this.hill, out = {};
    for (const u of this.unitsNear(h.x, h.y, h.r)) {
      if (u.kind !== 'unit' || u.air || !u.def.weapon || u.team === NEUTRAL || u.inside || u.aboard) continue;
      if (Math.hypot(u.x - h.x, u.y - h.y) > h.r) continue;
      const t = this.teams[u.team];
      if (t.defeated) continue;
      out[t.ally] = (out[t.ally] || 0) + (u.def.cost || 100);
    }
    return out;
  },

  updateHill(dt) {
    const h = this.hill;
    if (this.time < this.hillOpens()) return;
    const here = Object.keys(this.hillPresence()).map(Number);
    const holder = here.length === 1 ? here[0] : null;
    h.contested = here.length > 1;
    const mine = this.playerTeam.ally;
    // the announcer calls the changes, not every tick
    const state = holder !== null ? 'h' + holder : h.contested ? 'c' : 'n';
    if (state !== h.last) {
      if (holder === mine) this.eva('We hold the hill', this.player);
      else if (holder !== null) this.eva('The enemy holds the hill', this.player);
      else if (h.contested && h.last === 'h' + mine) this.eva('The hill is contested', this.player);
      else if (h.last === 'h' + mine) this.eva('We have lost the hill', this.player);
      h.last = state;
    }
    h.holder = holder;
    if (holder === null) return;
    h.score[holder] = (h.score[holder] || 0) + dt;
    const left = h.hold - h.score[holder];
    if (left <= 60 && !h.warned[holder]) {
      h.warned[holder] = true;
      this.eva(holder === mine ? 'One minute more on the hill wins it' : 'Enemy one minute from taking the hill', this.player);
    }
  },

  // when the hill starts to count: a while into the match, and not before any ceasefire ends
  hillOpens() { return Math.max((this.opts.ceasefire || 0) * 60, KOTH.opens); },

  // checked with the other victory conditions: whoever held the hill long enough wins
  hillWinner() {
    const h = this.hill;
    if (!h) return null;
    for (const a in h.score) if (h.score[a] >= h.hold) return +a;
    return null;
  },
});
