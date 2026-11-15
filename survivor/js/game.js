/* Last Foxhole: the simulation. No drawing and no DOM in here, so it can be tested headless. */
(function (root) {
  'use strict';
  var LL = root.LL, D = LL.DATA, TAU = Math.PI * 2, CELL = 64;

  function Game() { this.reset({}); }
  var G = Game.prototype;

  /* meta = levels of the permanent shop upgrades, e.g. { might: 2, revive: 1 }; cls = a key of DATA.classes */
  G.reset = function (meta, cls) {
    this.meta = meta || {};
    this.clsId = D.classes[cls] ? cls : 'rifleman'; this.cls = D.classes[this.clsId];
    var mods = this.cls.mods;
    this.t = 0;
    this.p = { x: 0, y: 0, r: 14, face: 1, ang: -Math.PI / 2, look: -Math.PI / 2, moving: false, hurt: false, hurtT: 0, hp: 100, inv: 0, lightMul: 1, cls: this.clsId };
    this.en = []; this.shots = []; this.gems = []; this.fx = []; this.zones = []; this.mines = []; this.strikes = []; this.eshots = []; this.picks = [];
    this.parts = []; this.decals = []; this.cause = null; this.gore = this.gore !== false;
    this.weapons = []; this.passives = [];
    this.xp = 0; this.lvl = 1; this.next = 6; this.kills = 0; this.coins = 0;
    this.pending = 0; this.chests = 0; this.over = false; this.won = false;
    this.rerolls = 1 + (this.meta.reroll || 0) + (mods.reroll || 0); this.revives = (this.meta.revive || 0) + (mods.revive || 0);
    this.spawnAcc = 0; this.ringT = 40; this.eliteT = 75; this.bossIdx = 0; this.boss = null;
    this.view = { w: 420, h: 800 };
    this.grid = new Map();
    this.stats = {}; this.ev = {};
    this.take({ type: 'w', id: this.cls.start });
    if (this.cls.also) this.take({ type: 'w', id: this.cls.also });
    this.p.hp = this.stats.maxHp;
  };

  /* ---------------------------------------------------------------- build: weapons, passives, level-ups */
  function weaponStats(w) {
    var def = w.def, s = {}, k, i;
    for (k in def.base) s[k] = def.base[k];
    for (i = 0; i < w.lvl - 1 && i < def.ups.length; i++) for (k in def.ups[i]) s[k] = (s[k] || 0) + def.ups[i][k];
    if (w.evo) for (k in def.evo.patch) s[k] = (s[k] || 0) + def.evo.patch[k];
    if (s.cd != null) s.cd = Math.max(0.25, s.cd);
    if (s.tick != null) s.tick = Math.max(0.15, s.tick);
    return s;
  }
  var LABEL = { count: ['+', ' projectile'], dmg: ['+', ' damage'], pierce: ['+', ' pierce'], jumps: ['+', ' jumps'], radius: ['+', ' reach'], range: ['+', ' range'],
    len: ['+', ' range'], dur: ['+', 's burn time'], max: ['+', ' mines'], bounces: ['+', ' bounces'], slow: ['+', 's slow'], blast: ['+', ' blast'] };
  function describe(patch) {
    var out = [], k;
    for (k in patch) {
      if (LABEL[k]) out.push(LABEL[k][0] + patch[k] + LABEL[k][1] + (k === 'count' && patch[k] > 1 ? 's' : ''));
      else if (k === 'cd') out.push(Math.abs(patch[k]) + 's faster');
      else if (k === 'tick') out.push('hits more often');
      else if (k === 'speed') out.push('spins faster');
      else if (k === 'size' || k === 'width') out.push('bigger');
      else if (k === 'arc') out.push('wider cone');
    }
    return out.join(', ');
  }
  G.recalc = function () {
    var m = this.meta, i;
    var s = this.stats = { dmg: 1 + 0.05 * (m.might || 0), cd: 1, speed: 1 + 0.03 * (m.swift || 0), maxHp: 100 + 10 * (m.vigor || 0), magnet: 1, area: 1,
      regen: 0.1 * (m.recover || 0), armor: 0, luck: 1, xp: 1, coin: 1 + 0.1 * (m.greed || 0), crit: 0, healMul: 1 };
    for (var k in this.cls.mods) if (k in s) s[k] += this.cls.mods[k];
    for (i = 0; i < this.passives.length; i++) { var q = this.passives[i]; s[q.def.stat] += q.def.add * q.lvl; }
    s.cd = Math.max(0.4, s.cd);
    for (i = 0; i < this.weapons.length; i++) this.weapons[i].s = weaponStats(this.weapons[i]);
    this.p.lightMul = 1 + (s.area - 1) * 0.8;
  };
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* every upgrade currently available, shuffled. Each is {type, id, name, lvl, text, col, isNew, isEvo} */
  G.pool = function () {
    var pool = [], id, own, def;
    for (id in D.weapons) {
      def = D.weapons[id]; own = find(this.weapons, id);
      if (own) {
        if (own.lvl < D.maxLevel) pool.push({ type: 'w', id: id, name: def.name, lvl: own.lvl + 1, text: describe(def.ups[own.lvl - 1]), col: def.col });
        else if (!own.evo && find(this.passives, def.evo.needs)) pool.push({ type: 'e', id: id, name: def.evo.name, lvl: 0, text: 'Upgrades ' + def.name + ': ' + (def.evo.text || describe(def.evo.patch)), col: def.col, isEvo: true });
      } else if (this.weapons.length < D.maxWeaponSlots) pool.push({ type: 'w', id: id, name: def.name, lvl: 1, text: def.desc, col: def.col, isNew: true });
    }
    for (id in D.passives) {
      def = D.passives[id]; own = find(this.passives, id);
      if (own) { if (own.lvl < D.maxLevel) pool.push({ type: 'p', id: id, name: def.name, lvl: own.lvl + 1, text: def.per, col: def.col }); }
      else if (this.passives.length < D.maxPassiveSlots) pool.push({ type: 'p', id: id, name: def.name, lvl: 1, text: def.per, col: def.col, isNew: true });
    }
    for (var i = pool.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    pool.sort(function (a, b) { return (b.isEvo ? 1 : 0) - (a.isEvo ? 1 : 0); });   /* an evolution is always offered */
    return pool;
  };
  var HEAL = { type: 'heal', id: 'heal', name: 'Hot Meal', lvl: 0, text: 'Restore 40 health', col: 'hp' };
  G.choices = function () { var pool = this.pool(); return pool.length ? pool.slice(0, 3) : [HEAL]; };
  G.take = function (c) {
    if (c.type === 'heal') { this.p.hp = Math.min(this.stats.maxHp, this.p.hp + 40); return; }
    var list = c.type === 'p' ? this.passives : this.weapons, table = c.type === 'p' ? D.passives : D.weapons, own = find(list, c.id);
    if (c.type === 'e') own.evo = true;
    else if (own) own.lvl++;
    else list.push({ id: c.id, def: table[c.id], lvl: 1, evo: false, timer: 0.3, ang: 0, s: null });
    var before = this.stats.maxHp || 0;
    this.recalc();
    if (before && this.stats.maxHp > before) this.p.hp += this.stats.maxHp - before;
  };
  /* a chest upgrades things you already carry: 1, 3 or 5 of them, evolutions first */
  G.openChest = function () {
    var r = Math.random(), n = r < 0.06 ? 5 : r < 0.3 ? 3 : 1, got = [];
    for (var i = 0; i < n; i++) {
      var pool = this.pool().filter(function (c) { return !c.isNew; });
      if (!pool.length) break;
      this.take(pool[0]); got.push(pool[0]);
    }
    if (!got.length) { this.coins += 25; got.push({ type: 'coin', id: 'coin', name: '25 scrap', lvl: 0, text: 'Everything you carry is already at its best.', col: 'accent' }); }
    return got;
  };

  /* ---------------------------------------------------------------- helpers */
  function key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
  G.buildGrid = function () {
    var g = this.grid; g.clear();
    for (var i = 0; i < this.en.length; i++) {
      var e = this.en[i], k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL)), c = g.get(k);
      if (c) c.push(e); else g.set(k, [e]);
    }
  };
  G.query = function (x, y, r, fn) {
    var x0 = Math.floor((x - r - 56) / CELL), x1 = Math.floor((x + r + 56) / CELL), y0 = Math.floor((y - r - 56) / CELL), y1 = Math.floor((y + r + 56) / CELL);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var c = this.grid.get(key(cx, cy)); if (!c) continue;
      for (var i = 0; i < c.length; i++) {
        var e = c[i]; if (e.dead) continue;
        var dx = e.x - x, dy = e.y - y, m = r + e.r;
        if (dx * dx + dy * dy < m * m) fn(e);
      }
    }
  };
  G.nearest = function (x, y, maxR, skip) {
    var best = null, bd = maxR * maxR;
    for (var i = 0; i < this.en.length; i++) {
      var e = this.en[i]; if (e.dead || (skip && skip.indexOf(e) >= 0)) continue;
      var dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  G.addFx = function (f) { if (this.fx.length < 280) this.fx.push(f); };
  G.hit = function (e, dmg, fromX, fromY, knock) {
    if (e.dead) return;
    var crit = this.stats.crit > 0 && Math.random() < this.stats.crit;
    dmg = Math.max(1, Math.round(dmg * this.stats.dmg * (crit ? 2 : 1)));
    e.hp -= dmg; e.hit = 0.1; this.ev.hit = true;
    if (e.arch === 'soldier' || e.arch === 'dog') { if (this.gore) this.blood(e.x, e.y, e.x - fromX, e.y - fromY, 2, 0.22); }
    else this.sparks(e.x, e.y, 2);
    if (knock && !e.def.boss) {
      var dx = e.x - fromX, dy = e.y - fromY, l = Math.hypot(dx, dy) || 1, kk = e.elite ? knock * 0.4 : knock;
      e.kx += dx / l * kk; e.ky += dy / l * kk;
    }
    this.addFx({ k: 'n', x: e.x, y: e.y - e.r, txt: crit ? dmg + '!' : dmg, life: 0.5, max: 0.5 });
    if (e.hp <= 0) this.kill(e);
  };
  G.kill = function (e) {
    var def = e.def, i, a;
    e.dead = true; this.kills++; this.ev.kill = true;
    this.death(e);
    if (def.boss) {
      for (i = 0; i < 16; i++) this.dropGem(e.x + (Math.random() - 0.5) * 110, e.y + (Math.random() - 0.5) * 110, 2);
      this.picks.push({ kind: 'chest', x: e.x, y: e.y }, { kind: 'coin', x: e.x + 30, y: e.y + 10, v: 40 });
      if (this.boss === e) this.boss = null;
      this.ev.banner = def.name + ' is destroyed'; this.ev.bossDown = true;
      if (def.final) { this.won = true; this.over = true; }
    } else if (e.elite) {
      for (i = 0; i < 3; i++) this.dropGem(e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40, 2);
      this.picks.push({ kind: 'chest', x: e.x, y: e.y }, { kind: 'coin', x: e.x + 24, y: e.y, v: 10 });
    } else {
      this.dropGem(e.x, e.y, def.xp);
      var r = Math.random() / this.stats.luck;
      if (r < 0.05) this.picks.push({ kind: 'coin', x: e.x, y: e.y, v: 1 });
      else if (r < 0.057) this.picks.push({ kind: 'heal', x: e.x, y: e.y });
      else if (r < 0.0595) this.picks.push({ kind: 'magnet', x: e.x, y: e.y });
      else if (r < 0.0615) this.picks.push({ kind: 'bomb', x: e.x, y: e.y });
    }
  };
  /* ---------------------------------------------------------------- the mess: particles in the air and stains on the ground */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  G.part = function (o) { if (this.parts.length < 560) { o.max = o.life; if (o.drag == null) o.drag = 0.9; this.parts.push(o); } };
  G.decal = function (o) { o.age = 0; if (!o.life) o.life = 80; o.v = (Math.random() * 6) | 0; if (this.decals.length > 460) this.decals.shift(); this.decals.push(o); };
  G.blood = function (x, y, dx, dy, n, stain) {
    var l = Math.hypot(dx, dy) || 1, base = Math.atan2(dy, dx), i, a, sp;
    for (i = 0; i < n; i++) { a = base + rnd(-0.8, 0.8); sp = rnd(60, 250); this.part({ k: 'blood', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.18, 0.42), r: rnd(1.5, 3.6), stain: Math.random() < 0.45 }); }
    if (Math.random() < stain) this.decal({ k: 'blood', x: x + dx / l * 10, y: y + dy / l * 10, r: rnd(5, 12), rot: rnd(0, TAU), life: 50 });
  };
  G.sparks = function (x, y, n) { for (var i = 0; i < n; i++) { var a = rnd(0, TAU), sp = rnd(120, 330); this.part({ k: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.1, 0.26), drag: 0.88 }); } };
  G.boom = function (x, y, R) {
    var i, a, sp;
    this.part({ k: 'boom', x: x, y: y, vx: 0, vy: 0, r: R, life: 0.32 });
    for (i = 0; i < 5; i++) this.part({ k: 'smoke', x: x + rnd(-0.3, 0.3) * R, y: y + rnd(-0.3, 0.3) * R, vx: rnd(-18, 18), vy: rnd(-40, -12), r: R * rnd(0.28, 0.5), life: rnd(0.9, 1.7), drag: 0.97 });
    for (i = 0; i < 8; i++) { a = rnd(0, TAU); sp = rnd(110, 320); this.part({ k: 'dirt', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.25, 0.55), r: rnd(1.4, 3.2) }); }
    this.decal({ k: 'scorch', x: x, y: y, r: R * 0.6, rot: rnd(0, TAU) });
    this.ev.boom = true;
  };
  /* damage in a radius, with the fireball. Anything on foot killed this way comes apart. */
  G.explode = function (x, y, R, dmg, knock, skip) {
    var g = this; this.cause = 'blast';
    this.query(x, y, R, function (e) { if (e !== skip) g.hit(e, dmg, x, y, knock); });
    this.cause = null; this.boom(x, y, R);
  };
  G.muzzle = function (a) {
    var p = this.p; p.look = a;
    this.part({ k: 'muzzle', x: p.x + Math.cos(a) * 19 - Math.sin(a) * 2, y: p.y + Math.sin(a) * 19 + Math.cos(a) * 2, vx: 0, vy: 0, a: a, life: 0.05 });
    this.part({ k: 'case', x: p.x, y: p.y, vx: -Math.sin(a) * rnd(60, 110) - Math.cos(a) * 30, vy: Math.cos(a) * rnd(60, 110) - Math.sin(a) * 30, life: 0.4 });
  };
  G.death = function (e) {
    var arch = e.arch, i, a, sp;
    if (arch === 'soldier' || arch === 'dog') {
      if (!this.gore) { for (i = 0; i < 4; i++) { a = rnd(0, TAU); this.part({ k: 'dirt', x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.3, r: 2 }); } return; }
      this.blood(e.x, e.y, e.kx || rnd(-1, 1), e.ky || rnd(-1, 1), 10, 0);
      if (this.cause === 'blast') {
        for (i = 0; i < 6; i++) { a = rnd(0, TAU); sp = rnd(130, 380); this.part({ k: 'gib', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.3, 0.6), r: rnd(1.8, 4) * e.r / 12, rot: a, vr: rnd(-14, 14), stain: true }); }
        this.decal({ k: 'blood', x: e.x, y: e.y, r: e.r * 1.6, rot: rnd(0, TAU) });
      } else this.decal({ k: 'corpse', arch: arch, tint: e.tint, x: e.x, y: e.y, r: e.r, rot: e.ang + rnd(-0.7, 0.7), pool: true });
    } else {
      this.boom(e.x, e.y, e.r * (arch === 'bike' ? 1.5 : 2));
      this.sparks(e.x, e.y, 6);
      this.decal({ k: 'wreck', arch: arch, tint: e.tint, x: e.x, y: e.y, r: e.r, rot: e.ang, burn: arch === 'bike' ? 2.5 : 6, pool: arch === 'bike' && this.gore });
    }
  };

  G.dropGem = function (x, y, tier) {
    if (this.gems.length > 320) { var old = this.gems.shift(); this.gems.push({ x: x, y: y, tier: Math.max(tier, old.tier), v: D.gemValue[tier] + old.v }); }
    else this.gems.push({ x: x, y: y, tier: tier, v: D.gemValue[tier] });
  };
  G.hurt = function (dmg) {
    var p = this.p;
    if (p.inv > 0 || this.over) return;
    p.hp -= Math.max(1, dmg - this.stats.armor); p.inv = 0.45; p.hurtT = 0.15; this.ev.hurt = true;
    if (p.hp > 0) return;
    if (this.revives > 0) {
      this.revives--; p.hp = this.stats.maxHp * 0.5; p.inv = 2.5; this.blast(300, 60); this.ev.banner = 'Back on your feet'; this.ev.revive = true;
    } else { p.hp = 0; this.over = true; }
  };
  /* a burst of light around the player: bombs and revives */
  G.blast = function (R, bossDmg) {
    var p = this.p, list = this.en.slice();
    this.cause = 'blast';
    for (var i = 0; i < list.length; i++) {
      var e = list[i]; if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > R + e.r) continue;
      if (e.def.boss) this.hit(e, bossDmg, p.x, p.y, 0); else if (e.elite) this.hit(e, bossDmg * 2, p.x, p.y, 400); else { e.hp = 0; this.kill(e); }
    }
    this.cause = null; this.eshots.length = 0; this.boom(p.x, p.y, R * 0.45);
    this.addFx({ k: 'r', x: p.x, y: p.y, R: R, life: 0.5, max: 0.5, col: 'accent' });
    this.ev.bomb = true;
  };

  /* ---------------------------------------------------------------- spawning: always just off-screen, on every side */
  G.edgePoint = function (pad) {
    var hw = this.view.w / 2 + pad, hh = this.view.h / 2 + pad, r = Math.random() * (hw + hh) * 2, x, y;
    if (r < hw * 2) { x = r - hw; y = Math.random() < 0.5 ? -hh : hh; }
    else { y = r - hw * 2 - hh; x = Math.random() < 0.5 ? -hw : hw; }
    return { x: this.p.x + x, y: this.p.y + y };
  };
  G.spawn = function (id, x, y, elite) {
    var def = D.enemies[id], scale = 1 + this.t / 110 + Math.pow(this.t / 400, 2), hp = def.boss ? def.hp : def.hp * scale * (elite ? 9 : 1);
    var e = { def: def, arch: def.arch, tint: def.tint, x: x, y: y, r: Math.round(def.r * (elite ? 1.55 : 1)), sp: def.sp * (0.9 + Math.random() * 0.2) * (elite ? 0.85 : 1),
      hp: hp, maxHp: hp, dmg: def.dmg * (elite ? 1.5 : 1) * (1 + this.t / 400), seed: Math.random() * 1000, hit: 0, oc: 0, kx: 0, ky: 0, face: 1, ang: 0, dead: false,
      slow: 0, elite: !!elite, t1: 1 + Math.random() * 2, t2: 2, t3: 3, st: 'walk', cx: 0, cy: 0, rot: 0 };
    this.en.push(e); return e;
  };
  G.pickEnemy = function () {
    var min = this.t / 60, wave = D.waves[0], i, id, total = 0;
    for (i = 0; i < D.waves.length; i++) if (D.waves[i].from <= min) wave = D.waves[i];
    for (id in wave.mix) total += wave.mix[id];
    var r = Math.random() * total;
    for (id in wave.mix) { r -= wave.mix[id]; if (r <= 0) return id; }
    return 'infantry';
  };
  G.spawner = function (dt) {
    var cap = Math.min(320, 30 + this.t * 0.7), pt, i, id;
    this.spawnAcc += dt * (0.8 + this.t / 34);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.en.length < cap) { pt = this.edgePoint(40); this.spawn(this.pickEnemy(), pt.x, pt.y); }
    }
    this.ringT -= dt;
    if (this.ringT <= 0) {   /* the horde closes in from all sides at once */
      this.ringT = 45; var n = Math.min(40, 14 + Math.floor(this.t / 20)), rad = Math.hypot(this.view.w, this.view.h) / 2 + 50;
      do { id = this.pickEnemy(); } while (D.enemies[id].ranged);
      for (i = 0; i < n; i++) this.spawn(id, this.p.x + Math.cos(i * TAU / n) * rad, this.p.y + Math.sin(i * TAU / n) * rad);
      this.ev.banner = 'They are closing in';
    }
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = 70; pt = this.edgePoint(60);
      do { id = this.pickEnemy(); } while (D.enemies[id].ranged || D.enemies[id].flies);
      this.spawn(id, pt.x, pt.y, true);
    }
    var b = D.bosses[this.bossIdx];
    if (b && this.t >= b.at) {
      this.bossIdx++; pt = this.edgePoint(90); this.boss = this.spawn(b.id, pt.x, pt.y);
      this.ev.banner = D.enemies[b.id].name + ' approaches'; this.ev.boss = true;
    }
  };
  G.eshot = function (x, y, a, sp, dmg) { if (this.eshots.length < 160) this.eshots.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: dmg, life: 6 }); };

  /* ---------------------------------------------------------------- weapons */
  function shot(g, w, k, a, s, extra) {
    var p = g.p, o = { k: k, x: p.x, y: p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, sp: s.speed, r: s.size || 5, dmg: s.dmg, pierce: s.pierce || 1, life: 1.3, seen: [], col: w.def.col };
    if (extra) for (var q in extra) o[q] = extra[q];
    g.shots.push(o);
  }
  var FIRE = {
    bolt: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, 430); if (!t) return false;
      var a = Math.atan2(t.y - p.y, t.x - p.x); g.muzzle(a);
      for (var i = 0; i < s.count; i++) shot(g, w, 'bolt', a + (i - (s.count - 1) / 2) * 0.14, s);
      return true;
    },
    fan: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, 300), a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.ang; g.muzzle(a);
      for (var i = 0; i < s.count; i++) shot(g, w, 'knife', a + (i - (s.count - 1) / 2) * 0.13, s, { life: 0.55 });
      return true;
    },
    burst: function (g, w, s) {
      w.ang += 0.4;
      for (var i = 0; i < s.count; i++) shot(g, w, 'needle', w.ang + i * TAU / s.count, s, { life: 0.9 });
      return true;
    },
    seeker: function (g, w, s) {
      for (var i = 0; i < s.count; i++) shot(g, w, 'rocket', g.p.ang + (Math.random() - 0.5) * 1.6, s, { life: 3.2, r: 6, blast: s.blast * g.stats.area });
      return true;
    },
    bounce: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, 430); if (!t) return false;
      var a = Math.atan2(t.y - p.y, t.x - p.x); g.muzzle(a);
      for (var i = 0; i < s.count; i++) shot(g, w, 'orb', a + i * 0.5, s, { pierce: s.bounces + 1, life: 4 });
      return true;
    },
    boomerang: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, 380), a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.random() * TAU;
      for (var i = 0; i < s.count; i++) shot(g, w, 'glaive', a + i * TAU / s.count, s, { r: s.size * g.stats.area, pierce: 1e9, life: 6, far: s.range * g.stats.area, gone: 0, back: false });
      return true;
    },
    nova: function (g, w, s) {
      var p = g.p, R = s.radius * g.stats.area, i, a, sp;
      if (!s.slow) { g.explode(p.x, p.y, R, s.dmg, s.knock); return true; }
      g.query(p.x, p.y, R, function (e) { e.slow = s.slow; g.hit(e, s.dmg, p.x, p.y, 0); });
      for (i = 0; i < 18; i++) { a = i / 18 * TAU + rnd(0, 0.3); sp = R * rnd(2.2, 4.4); g.part({ k: 'gas', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R * 0.32, life: rnd(1.2, 1.9), drag: 0.93 }); }
      return true;
    },
    lob: function (g, w, s) {
      var p = g.p;
      for (var i = 0; i < s.count; i++) {
        var t = g.en.length ? g.en[(Math.random() * g.en.length) | 0] : null, tx, ty;
        if (t && Math.hypot(t.x - p.x, t.y - p.y) < 300) { tx = t.x; ty = t.y; }
        else { var a = Math.random() * TAU, d = 80 + Math.random() * 120; tx = p.x + Math.cos(a) * d; ty = p.y + Math.sin(a) * d; }
        g.shots.push({ k: 'flask', x: p.x, y: p.y, sx: p.x, sy: p.y, tx: tx, ty: ty, u: 0, r: 6, life: 9, col: w.def.col,
          zone: { x: tx, y: ty, r: s.radius * g.stats.area, life: s.dur, max: s.dur, tick: s.tick, timer: 0, dmg: s.dmg, col: w.def.col } });
      }
      return true;
    },
    chain: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, s.range); if (!t) return false;
      var seen = [], x = p.x, y = p.y; g.muzzle(Math.atan2(t.y - p.y, t.x - p.x));
      for (var i = 0; i <= s.jumps && t; i++) {
        g.addFx({ k: 'z', x: x, y: y, x2: t.x, y2: t.y, life: 0.18, max: 0.18, col: w.def.col });
        seen.push(t); x = t.x; y = t.y; g.hit(t, s.dmg, p.x, p.y, 30);
        t = g.nearest(x, y, 150, seen);
      }
      return true;
    },
    beam: function (g, w, s) {
      var p = g.p, len = s.len * g.stats.area, t = g.nearest(p.x, p.y, len), a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.ang;
      for (var i = 0; i < s.count; i++) {
        var b = a + (i - (s.count - 1) / 2) * 0.4, ex = Math.cos(b), ey = Math.sin(b); g.muzzle(b);
        for (var j = 0; j < g.en.length; j++) {
          var e = g.en[j]; if (e.dead) continue;
          var dx = e.x - p.x, dy = e.y - p.y, along = dx * ex + dy * ey;
          if (along > -e.r && along < len + e.r && Math.abs(dx * ey - dy * ex) < s.width / 2 + e.r) g.hit(e, s.dmg, p.x, p.y, 40);
        }
        g.addFx({ k: 'b', x: p.x, y: p.y, x2: p.x + ex * len, y2: p.y + ey * len, w: s.width, life: 0.25, max: 0.25, col: w.def.col });
      }
      return true;
    },
    mine: function (g, w, s) {
      var p = g.p, n = 0;
      for (var i = 0; i < g.mines.length; i++) if (g.mines[i].w === w) n++;
      if (n >= s.max) return false;
      g.mines.push({ w: w, x: p.x, y: p.y, blast: s.radius * g.stats.area, dmg: s.dmg, life: 16, arm: 0.5, col: w.def.col });
      return true;
    },
    strike: function (g, w, s) {
      var p = g.p, any = false;
      for (var i = 0; i < s.count; i++) {
        var t = g.en.length ? g.en[(Math.random() * g.en.length) | 0] : null;
        if (!t || Math.hypot(t.x - p.x, t.y - p.y) > 380) t = g.nearest(p.x, p.y, 380);
        if (!t) continue;
        any = true; g.strikes.push({ x: t.x, y: t.y, r: s.radius * g.stats.area, dmg: s.dmg, life: 0.6, max: 0.6, col: w.def.col });
      }
      return any;
    },
    sweep: function (g, w, s) {   /* count 1 = in front, count 2 = in front and behind */
      var p = g.p, R = s.range * g.stats.area, t = g.nearest(p.x, p.y, R * 1.6), aim = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.ang;
      for (var i = 0; i < s.count; i++) (function (dir) {
        g.query(p.x, p.y, R, function (e) {
          var d = Math.atan2(e.y - p.y, e.x - p.x) - dir; d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(d) < s.arc / 2 + 0.2) g.hit(e, s.dmg, p.x, p.y, 25);
        });
        for (var q = 0; q < 11; q++) { var fa = dir + rnd(-0.5, 0.5) * s.arc, sp = R * rnd(2.6, 4.6); g.part({ k: 'flame', x: p.x + Math.cos(dir) * 17, y: p.y + Math.sin(dir) * 17, vx: Math.cos(fa) * sp, vy: Math.sin(fa) * sp, r: rnd(4, 9), life: rnd(0.32, 0.55), drag: 0.93 }); }
        p.look = dir;
      })(aim + i * Math.PI);
      return true;
    }
  };
  G.updateWeapons = function (dt) {
    var g = this, p = this.p, i, j;
    for (i = 0; i < this.weapons.length; i++) {
      var w = this.weapons[i], s = w.s, kind = w.def.kind;
      if (kind === 'orbit') {
        w.ang += s.speed * dt;
        var R = s.radius * this.stats.area;
        for (j = 0; j < s.count; j++) {
          var a = w.ang + j * TAU / s.count;
          this.query(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, s.size, function (e) { if (e.oc <= 0) { e.oc = s.tick; g.hit(e, s.dmg, p.x, p.y, 70); } });
        }
      } else if (kind === 'aura') {
        w.timer -= dt;
        if (w.timer <= 0) { w.timer = s.tick; this.query(p.x, p.y, s.radius * this.stats.area, function (e) { g.hit(e, s.dmg, p.x, p.y, 0); }); this.addFx({ k: 'sl', a: rnd(0, TAU), R: s.radius * this.stats.area, life: 0.14, max: 0.14 }); }
      } else {
        w.timer -= dt;
        if (w.timer <= 0) {
          if (FIRE[kind](this, w, s)) { w.timer = s.cd * this.stats.cd; if (kind === 'bolt' || kind === 'fan' || kind === 'chain' || kind === 'beam' || kind === 'bounce') this.ev.shot = true; }
          else w.timer = 0.15;
        }
      }
    }
  };
  G.updateShots = function (dt) {
    var g = this, p = this.p, i, dx, dy, d, t;
    for (i = 0; i < this.shots.length; i++) {
      var s = this.shots[i]; s.life -= dt;
      if (s.k === 'flask') {
        s.u += dt / 0.55; s.x = s.sx + (s.tx - s.sx) * s.u; s.y = s.sy + (s.ty - s.sy) * s.u;
        if (s.u >= 1) { s.life = 0; this.zones.push(s.zone); this.decal({ k: 'scorch', x: s.tx, y: s.ty, r: s.zone.r * 0.9, rot: 0 }); this.sparks(s.tx, s.ty, 5); this.ev.boom = true; }
        continue;
      }
      if (s.k === 'glaive') {
        s.gone += s.sp * dt;
        if (!s.back && s.gone > s.far) { s.back = true; s.seen.length = 0; }
        if (s.back) {
          dx = p.x - s.x; dy = p.y - s.y; d = Math.hypot(dx, dy) || 1;
          s.vx = dx / d * s.sp * 1.2; s.vy = dy / d * s.sp * 1.2;
          if (d < 18) { s.life = 0; continue; }
        }
      } else if (s.k === 'rocket') {
        if (Math.random() < dt * 28) this.part({ k: 'smoke', x: s.x, y: s.y, vx: rnd(-8, 8), vy: rnd(-14, 0), r: rnd(3, 5), life: rnd(0.4, 0.7), drag: 0.96 });
        t = this.nearest(s.x, s.y, 320, s.seen);
        if (t) { dx = t.x - s.x; dy = t.y - s.y; d = Math.hypot(dx, dy) || 1; s.vx += (dx / d * s.sp - s.vx) * Math.min(1, dt * 6); s.vy += (dy / d * s.sp - s.vy) * Math.min(1, dt * 6); }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      this.query(s.x, s.y, s.r, function (e) {
        if (s.pierce <= 0 || s.seen.indexOf(e) >= 0) return;
        s.seen.push(e); s.pierce--; g.hit(e, s.dmg, s.x - s.vx, s.y - s.vy, 50);
        if (s.blast) g.explode(s.x, s.y, s.blast, s.dmg * 0.7, 120, e);
        if (s.pierce <= 0) { s.life = 0; return; }
        if (s.k === 'orb') {
          g.sparks(s.x, s.y, 3);
          var n = g.nearest(s.x, s.y, 260, s.seen);
          if (!n) { s.life = 0; return; }
          var a = Math.atan2(n.y - s.y, n.x - s.x); s.vx = Math.cos(a) * s.sp; s.vy = Math.sin(a) * s.sp; s.life = Math.max(s.life, 1.2);
        }
      });
    }
    for (i = 0; i < this.zones.length; i++) {
      var z = this.zones[i]; z.life -= dt; z.timer -= dt;
      if (z.timer <= 0) { z.timer = z.tick; this.query(z.x, z.y, z.r, function (e) { g.hit(e, z.dmg, z.x, z.y, 0); }); }
    }
    for (i = 0; i < this.mines.length; i++) (function (m) {
      m.life -= dt; m.arm -= dt;
      if (m.arm > 0) return;
      var trip = false; g.query(m.x, m.y, 12, function () { trip = true; });
      if (!trip) return;
      g.explode(m.x, m.y, m.blast, m.dmg, 140); m.life = 0;
    })(this.mines[i]);
    for (i = 0; i < this.strikes.length; i++) (function (k) {
      k.life -= dt;
      if (k.life > 0) return;
      g.explode(k.x, k.y, k.r, k.dmg, 160);
    })(this.strikes[i]);
    for (i = 0; i < this.eshots.length; i++) {
      var q = this.eshots[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r - 3) { q.life = 0; this.hurt(q.dmg); }
    }
  };

  /* ---------------------------------------------------------------- one step */
  G.update = function (dt, input) {
    if (this.over) return;
    var p = this.p, st = this.stats, g = this, i, e, dx, dy, d, k;
    this.t += dt;

    var mag = Math.hypot(input.x, input.y);
    p.moving = mag > 0.08;
    if (p.moving) {
      k = Math.min(1, mag) / mag * 150 * st.speed * dt;
      p.x += input.x * k; p.y += input.y * k;
      if (Math.abs(input.x) > 0.1) p.face = input.x > 0 ? 1 : -1;
      p.ang = Math.atan2(input.y, input.x);
    }
    var tg = this.nearest(p.x, p.y, 260), want = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : p.ang, turn = Math.atan2(Math.sin(want - p.look), Math.cos(want - p.look));
    p.look += turn * Math.min(1, dt * 10);
    p.inv -= dt; p.hurtT -= dt; p.hurt = p.hurtT > 0;
    p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);

    this.spawner(dt);
    this.buildGrid();

    var far = Math.hypot(this.view.w, this.view.h) * 0.9;
    for (i = 0; i < this.en.length; i++) {
      e = this.en[i]; if (e.dead) continue;
      dx = p.x - e.x; dy = p.y - e.y; d = Math.hypot(dx, dy) || 1;
      if (d > far && !e.def.boss && !e.elite) { var pt = this.edgePoint(40); e.x = pt.x; e.y = pt.y; continue; }   /* left behind: rejoin the horde ahead */
      var mx = dx / d, my = dy / d, spd = e.sp * (e.slow > 0 ? 0.45 : 1), ai = e.def.ai;
      e.slow -= dt; e.tele = false;
      if (e.def.ranged) {
        e.t1 -= dt;
        if (d < 190) { k = mx; mx = -my * 0.6; my = k * 0.6; }
        if (e.t1 <= 0 && d < 430) { e.t1 = 2.6; this.eshot(e.x, e.y, Math.atan2(dy, dx), 150, e.dmg); }
      }
      if (ai) {
        if (ai.ringCd && (e.t1 -= dt) <= 0) {
          e.t1 = ai.ringCd; e.rot += 0.35;
          for (k = 0; k < ai.ring; k++) this.eshot(e.x, e.y, e.rot + k * TAU / ai.ring, 130, e.dmg * 0.6);
        }
        if (ai.summonCd && (e.t2 -= dt) <= 0 && this.en.length < 330) {
          e.t2 = ai.summonCd;
          for (k = 0; k < ai.summonN; k++) this.spawn(ai.summon, e.x + (Math.random() - 0.5) * 90, e.y + (Math.random() - 0.5) * 90);
        }
        if (ai.chargeCd) {
          e.t3 -= dt;
          if (e.st === 'walk' && e.t3 <= 0 && d < 420) { e.st = 'wind'; e.t3 = 0.85; }
          else if (e.st === 'wind') { spd = 0; e.tele = true; if (e.t3 > 0.25) { e.cx = mx; e.cy = my; } if (e.t3 <= 0) { e.st = 'dash'; e.t3 = 0.65; } }
          else if (e.st === 'dash') { mx = e.cx; my = e.cy; spd = 460; if (e.t3 <= 0) { e.st = 'walk'; e.t3 = ai.chargeCd; } }
        }
      }
      e.x += (mx * spd + e.kx) * dt; e.y += (my * spd + e.ky) * dt;
      e.kx *= 0.86; e.ky *= 0.86; e.hit -= dt; e.oc -= dt;
      if (e.st !== 'dash') { e.ang = Math.atan2(dy, dx); e.face = dx >= 0 ? 1 : -1; }
      if (d < e.r + p.r - 2) { this.hurt(e.dmg); if (this.over) return; }
    }
    /* enemies shoulder each other apart so the horde spreads into a ring instead of stacking */
    for (i = 0; i < this.en.length; i++) {
      e = this.en[i]; if (e.dead || e.def.flies) continue;
      this.query(e.x, e.y, e.r, function (o) {
        if (o === e || o.def.flies) return;
        var ex = o.x - e.x, ey = o.y - e.y, ed = Math.hypot(ex, ey) || 1, push = (e.r + o.r - ed) * 0.5;
        if (push <= 0) return;
        var we = o.def.boss ? 1 : e.def.boss ? 0 : 0.5;
        ex /= ed; ey /= ed; e.x -= ex * push * we; e.y -= ey * push * we; o.x += ex * push * (1 - we); o.y += ey * push * (1 - we);
      });
    }

    this.updateWeapons(dt);
    this.updateShots(dt);
    if (this.over) return;

    var mr = 72 * st.magnet;
    for (i = 0; i < this.gems.length; i++) {
      var gem = this.gems[i]; dx = p.x - gem.x; dy = p.y - gem.y; d = Math.hypot(dx, dy) || 1;
      if (gem.pull || d < mr) { gem.pull = true; k = Math.min(d, 520 * dt); gem.x += dx / d * k; gem.y += dy / d * k; }
      if (d < 16) { gem.dead = true; this.xp += gem.v * st.xp; this.ev.gem = true; }
    }
    for (i = 0; i < this.picks.length; i++) {
      var c = this.picks[i]; dx = p.x - c.x; dy = p.y - c.y; d = Math.hypot(dx, dy) || 1;
      if (c.kind === 'coin' && (c.pull || d < mr)) { c.pull = true; k = Math.min(d, 520 * dt); c.x += dx / d * k; c.y += dy / d * k; }
      if (d > 24) continue;
      c.dead = true; this.ev.pick = c.kind;
      if (c.kind === 'coin') this.coins += c.v * st.coin;
      else if (c.kind === 'heal') p.hp = Math.min(st.maxHp, p.hp + 30 * st.healMul);
      else if (c.kind === 'magnet') { for (k = 0; k < this.gems.length; k++) this.gems[k].pull = true; for (k = 0; k < this.picks.length; k++) this.picks[k].pull = true; }
      else if (c.kind === 'bomb') this.blast(460, 150);
      else if (c.kind === 'chest') this.chests++;
    }
    while (this.xp >= this.next) { this.xp -= this.next; this.lvl++; this.next = Math.round(5 + this.lvl * 4 + this.lvl * this.lvl * 0.4); this.pending++; }

    for (i = 0; i < this.fx.length; i++) { var f = this.fx[i]; f.life -= dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; } else if (f.k === 'n') f.y -= 40 * dt; }
    for (i = 0; i < this.parts.length; i++) {
      var q = this.parts[i], dr = Math.pow(q.drag, dt * 60); q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= dr; q.vy *= dr;
      if (q.life <= 0 && q.stain) this.decal({ k: 'blood', x: q.x, y: q.y, r: q.k === 'gib' ? rnd(6, 11) : rnd(2.5, 6), rot: rnd(0, TAU), life: 45 });
    }
    for (i = 0; i < this.decals.length; i++) {
      var dc = this.decals[i]; dc.age += dt; dc.life -= dt;
      if (dc.burn > 0) { dc.burn -= dt; if (Math.random() < dt * 9) this.part({ k: 'smoke', x: dc.x + rnd(-0.4, 0.4) * dc.r, y: dc.y + rnd(-0.4, 0.4) * dc.r, vx: rnd(-10, 10), vy: rnd(-45, -20), r: dc.r * rnd(0.3, 0.55), life: rnd(0.7, 1.3), drag: 0.98, fire: Math.random() < 0.5 }); }
    }
    this.parts = this.parts.filter(living); this.decals = this.decals.filter(living);
    this.en = this.en.filter(alive); this.gems = this.gems.filter(alive); this.picks = this.picks.filter(alive);
    this.shots = this.shots.filter(living); this.zones = this.zones.filter(living); this.fx = this.fx.filter(living);
    this.mines = this.mines.filter(living); this.strikes = this.strikes.filter(living); this.eshots = this.eshots.filter(living);
  };
  function alive(q) { return !q.dead; }
  function living(q) { return q.life > 0; }

  LL.Game = Game;
})(typeof window !== 'undefined' ? window : this);
