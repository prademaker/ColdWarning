/* Last Lantern: the simulation. No drawing and no DOM in here, so it can be tested headless. */
(function (root) {
  'use strict';
  var LL = root.LL, D = LL.DATA, TAU = Math.PI * 2, CELL = 64;

  function Game() { this.reset(); }
  var G = Game.prototype;

  G.reset = function () {
    this.t = 0;
    this.p = { x: 0, y: 0, r: 14, face: 1, ang: -Math.PI / 2, moving: false, hurt: false, hurtT: 0, hp: 100, inv: 0 };
    this.en = []; this.shots = []; this.gems = []; this.fx = []; this.zones = [];
    this.weapons = []; this.passives = [];
    this.xp = 0; this.lvl = 1; this.next = 6; this.kills = 0; this.pending = 0; this.over = false;
    this.spawnAcc = 0; this.ringT = 40; this.bossT = 180; this.bosses = 0;
    this.view = { w: 420, h: 800 };
    this.grid = new Map();
    this.stats = {};
    this.take({ type: 'w', id: 'spark' });
  };

  /* ---------------------------------------------------------------- build: weapons, passives, level-ups */
  function weaponStats(def, lvl) {
    var s = {}, k, i;
    for (k in def.base) s[k] = def.base[k];
    for (i = 0; i < lvl - 1 && i < def.ups.length; i++) for (k in def.ups[i]) s[k] = (s[k] || 0) + def.ups[i][k];
    return s;
  }
  var LABEL = { count: ['+', ' projectile'], dmg: ['+', ' damage'], pierce: ['+', ' pierce'], jumps: ['+', ' jumps'], radius: ['+', ' reach'], range: ['+', ' range'], dur: ['+', 's burn time'] };
  function describe(patch) {
    var out = [], k;
    for (k in patch) {
      if (LABEL[k]) out.push(LABEL[k][0] + patch[k] + LABEL[k][1] + (k === 'count' && patch[k] > 1 ? 's' : ''));
      else if (k === 'cd') out.push(Math.abs(patch[k]) + 's faster');
      else if (k === 'tick') out.push('hits more often');
      else if (k === 'speed') out.push('spins faster');
      else if (k === 'size') out.push('bigger');
    }
    return out.join(', ');
  }
  G.recalc = function () {
    var s = this.stats = { dmg: 1, cd: 1, speed: 1, maxHp: 100, magnet: 1, area: 1, regen: 0, armor: 0 }, i;
    for (i = 0; i < this.passives.length; i++) { var q = this.passives[i]; s[q.def.stat] += q.def.add * q.lvl; }
    s.cd = Math.max(0.4, s.cd);
    for (i = 0; i < this.weapons.length; i++) this.weapons[i].s = weaponStats(this.weapons[i].def, this.weapons[i].lvl);
  };
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* three random offers; each is {type, id, name, lvl, text, col, isNew} */
  G.choices = function () {
    var pool = [], id, own, def;
    for (id in D.weapons) {
      def = D.weapons[id]; own = find(this.weapons, id);
      if (own) { if (own.lvl < D.maxLevel) pool.push({ type: 'w', id: id, name: def.name, lvl: own.lvl + 1, text: describe(def.ups[own.lvl - 1]), col: def.col }); }
      else if (this.weapons.length < D.maxWeaponSlots) pool.push({ type: 'w', id: id, name: def.name, lvl: 1, text: def.desc, col: def.col, isNew: true });
    }
    for (id in D.passives) {
      def = D.passives[id]; own = find(this.passives, id);
      if (own) { if (own.lvl < D.maxLevel) pool.push({ type: 'p', id: id, name: def.name, lvl: own.lvl + 1, text: def.per, col: def.col }); }
      else if (this.passives.length < D.maxPassiveSlots) pool.push({ type: 'p', id: id, name: def.name, lvl: 1, text: def.per, col: def.col, isNew: true });
    }
    for (var i = pool.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    if (!pool.length) return [{ type: 'heal', id: 'heal', name: 'Warm Meal', lvl: 0, text: 'Restore 40 health', col: 'hp' }];
    return pool.slice(0, 3);
  };
  G.take = function (c) {
    if (c.type === 'heal') { this.p.hp = Math.min(this.stats.maxHp, this.p.hp + 40); return; }
    var list = c.type === 'w' ? this.weapons : this.passives, table = c.type === 'w' ? D.weapons : D.passives, own = find(list, c.id);
    if (own) own.lvl++; else list.push({ id: c.id, def: table[c.id], lvl: 1, timer: 0.3, ang: 0, s: null });
    var before = this.stats.maxHp || 100;
    this.recalc();
    if (this.stats.maxHp > before) this.p.hp += this.stats.maxHp - before;
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
    var x0 = Math.floor((x - r - 48) / CELL), x1 = Math.floor((x + r + 48) / CELL), y0 = Math.floor((y - r - 48) / CELL), y1 = Math.floor((y + r + 48) / CELL);
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
  G.addFx = function (f) { if (this.fx.length < 260) this.fx.push(f); };
  G.hit = function (e, dmg, fromX, fromY, knock) {
    if (e.dead) return;
    dmg = Math.max(1, Math.round(dmg * this.stats.dmg));
    e.hp -= dmg; e.hit = 0.1;
    if (knock && !e.def.boss) {
      var dx = e.x - fromX, dy = e.y - fromY, l = Math.hypot(dx, dy) || 1;
      e.kx += dx / l * knock; e.ky += dy / l * knock;
    }
    this.addFx({ k: 'n', x: e.x, y: e.y - e.r, txt: dmg, life: 0.5, max: 0.5 });
    if (e.hp <= 0) {
      e.dead = true; this.kills++;
      var n = e.def.boss ? 14 : 1;
      for (var i = 0; i < n; i++) this.dropGem(e.x + (n > 1 ? (Math.random() - 0.5) * 80 : 0), e.y + (n > 1 ? (Math.random() - 0.5) * 80 : 0), e.def.xp);
      for (i = 0; i < 5; i++) { var a = Math.random() * TAU; this.addFx({ k: 'p', x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.35, max: 0.35, col: 't' + e.tint }); }
    }
  };
  G.dropGem = function (x, y, tier) {
    if (this.gems.length > 320) { var old = this.gems.shift(); this.gems.push({ x: x, y: y, tier: Math.max(tier, old.tier), v: D.gemValue[tier] + old.v }); }
    else this.gems.push({ x: x, y: y, tier: tier, v: D.gemValue[tier] });
  };

  /* ---------------------------------------------------------------- spawning: always just off-screen, on every side */
  G.edgePoint = function (pad) {
    var hw = this.view.w / 2 + pad, hh = this.view.h / 2 + pad, r = Math.random() * (hw + hh) * 2, x, y;
    if (r < hw * 2) { x = r - hw; y = Math.random() < 0.5 ? -hh : hh; }
    else { y = r - hw * 2 - hh; x = Math.random() < 0.5 ? -hw : hw; }
    return { x: this.p.x + x, y: this.p.y + y };
  };
  G.spawn = function (id, x, y) {
    var def = D.enemies[id], scale = 1 + this.t / 150;
    this.en.push({ def: def, arch: def.arch, tint: def.tint, x: x, y: y, r: def.r, sp: def.sp * (0.9 + Math.random() * 0.2),
      hp: def.hp * (def.boss ? 1 + this.bosses * 0.8 : scale), dmg: def.dmg, seed: Math.random() * 1000, hit: 0, oc: 0, kx: 0, ky: 0, face: 1, ang: 0, dead: false });
  };
  G.pickEnemy = function () {
    var min = this.t / 60, wave = D.waves[0], i, id, total = 0;
    for (i = 0; i < D.waves.length; i++) if (D.waves[i].from <= min) wave = D.waves[i];
    for (id in wave.mix) total += wave.mix[id];
    var r = Math.random() * total;
    for (id in wave.mix) { r -= wave.mix[id]; if (r <= 0) return id; }
    return 'mote';
  };
  G.spawner = function (dt) {
    var cap = Math.min(320, 30 + this.t * 0.7), pt, i;
    this.spawnAcc += dt * (0.8 + this.t / 40);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.en.length < cap) { pt = this.edgePoint(40); this.spawn(this.pickEnemy(), pt.x, pt.y); }
    }
    this.ringT -= dt;
    if (this.ringT <= 0) {   /* the horde closes in from all sides at once */
      this.ringT = 45; var n = Math.min(40, 14 + Math.floor(this.t / 20)), rad = Math.hypot(this.view.w, this.view.h) / 2 + 50, id = this.pickEnemy();
      for (i = 0; i < n; i++) this.spawn(id, this.p.x + Math.cos(i * TAU / n) * rad, this.p.y + Math.sin(i * TAU / n) * rad);
    }
    this.bossT -= dt;
    if (this.bossT <= 0) { this.bossT = 180; pt = this.edgePoint(80); this.spawn('boss', pt.x, pt.y); this.bosses++; }
  };

  /* ---------------------------------------------------------------- weapons */
  var FIRE = {
    bolt: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, 430); if (!t) return false;
      var a = Math.atan2(t.y - p.y, t.x - p.x);
      for (var i = 0; i < s.count; i++) {
        var b = a + (i - (s.count - 1) / 2) * 0.14;
        g.shots.push({ k: 'bolt', x: p.x, y: p.y, vx: Math.cos(b) * s.speed, vy: Math.sin(b) * s.speed, r: s.size, dmg: s.dmg, pierce: s.pierce, life: 1.3, seen: [], col: w.def.col });
      }
      return true;
    },
    burst: function (g, w, s) {
      var p = g.p; w.ang += 0.4;
      for (var i = 0; i < s.count; i++) {
        var b = w.ang + i * TAU / s.count;
        g.shots.push({ k: 'needle', x: p.x, y: p.y, vx: Math.cos(b) * s.speed, vy: Math.sin(b) * s.speed, r: s.size, dmg: s.dmg, pierce: s.pierce, life: 0.9, seen: [], col: w.def.col });
      }
      return true;
    },
    boomerang: function (g, w, s) {
      var p = g.p, t = g.nearest(p.x, p.y, 380), a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.random() * TAU;
      for (var i = 0; i < s.count; i++) {
        var b = a + i * TAU / s.count;
        g.shots.push({ k: 'glaive', x: p.x, y: p.y, vx: Math.cos(b) * s.speed, vy: Math.sin(b) * s.speed, sp: s.speed, r: s.size * g.stats.area, dmg: s.dmg, pierce: 1e9, life: 6, far: s.range * g.stats.area, gone: 0, back: false, seen: [], col: w.def.col });
      }
      return true;
    },
    nova: function (g, w, s) {
      var p = g.p, R = s.radius * g.stats.area;
      g.query(p.x, p.y, R, function (e) { g.hit(e, s.dmg, p.x, p.y, s.knock); });
      g.addFx({ k: 'r', x: p.x, y: p.y, R: R, life: 0.35, max: 0.35, col: w.def.col });
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
      var seen = [], x = p.x, y = p.y;
      for (var i = 0; i <= s.jumps && t; i++) {
        g.addFx({ k: 'z', x: x, y: y, x2: t.x, y2: t.y, life: 0.18, max: 0.18, col: w.def.col });
        seen.push(t); x = t.x; y = t.y; g.hit(t, s.dmg, p.x, p.y, 30);
        t = g.nearest(x, y, 150, seen);
      }
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
        if (w.timer <= 0) { w.timer = s.tick; this.query(p.x, p.y, s.radius * this.stats.area, function (e) { g.hit(e, s.dmg, p.x, p.y, 0); }); }
      } else {
        w.timer -= dt;
        if (w.timer <= 0) w.timer = FIRE[kind](this, w, s) ? s.cd * this.stats.cd : 0.15;
      }
    }
  };
  G.updateShots = function (dt) {
    var g = this, p = this.p;
    for (var i = 0; i < this.shots.length; i++) {
      var s = this.shots[i]; s.life -= dt;
      if (s.k === 'flask') {
        s.u += dt / 0.55; s.x = s.sx + (s.tx - s.sx) * s.u; s.y = s.sy + (s.ty - s.sy) * s.u;
        if (s.u >= 1) { s.life = 0; this.zones.push(s.zone); }
        continue;
      }
      if (s.k === 'glaive') {
        s.gone += s.sp * dt;
        if (!s.back && s.gone > s.far) { s.back = true; s.seen.length = 0; }
        if (s.back) {
          var dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
          s.vx = dx / d * s.sp * 1.2; s.vy = dy / d * s.sp * 1.2;
          if (d < 18) { s.life = 0; continue; }
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      this.query(s.x, s.y, s.r, function (e) {
        if (s.pierce <= 0 || s.seen.indexOf(e) >= 0) return;
        s.seen.push(e); s.pierce--; g.hit(e, s.dmg, s.x - s.vx, s.y - s.vy, 50);
        if (s.pierce <= 0) s.life = 0;
      });
    }
    for (i = 0; i < this.zones.length; i++) {
      var z = this.zones[i]; z.life -= dt; z.timer -= dt;
      if (z.timer <= 0) { z.timer = z.tick; this.query(z.x, z.y, z.r, function (e) { g.hit(e, z.dmg, z.x, z.y, 0); }); }
    }
  };

  /* ---------------------------------------------------------------- one step */
  G.update = function (dt, input) {
    if (this.over) return;
    var p = this.p, st = this.stats, i, e, dx, dy, d;
    this.t += dt;

    var mag = Math.hypot(input.x, input.y);
    p.moving = mag > 0.08;
    if (p.moving) {
      var k = Math.min(1, mag) / mag * 150 * st.speed * dt;
      p.x += input.x * k; p.y += input.y * k;
      if (Math.abs(input.x) > 0.1) p.face = input.x > 0 ? 1 : -1;
      p.ang = Math.atan2(input.y, input.x);
    }
    p.inv -= dt; p.hurtT -= dt; p.hurt = p.hurtT > 0;
    p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);

    this.spawner(dt);
    this.buildGrid();

    var far = Math.hypot(this.view.w, this.view.h) * 0.9;
    for (i = 0; i < this.en.length; i++) {
      e = this.en[i]; if (e.dead) continue;
      dx = p.x - e.x; dy = p.y - e.y; d = Math.hypot(dx, dy) || 1;
      if (d > far && !e.def.boss) { var pt = this.edgePoint(40); e.x = pt.x; e.y = pt.y; continue; }   /* left behind: rejoin the horde ahead */
      e.x += (dx / d * e.sp + e.kx) * dt; e.y += (dy / d * e.sp + e.ky) * dt;
      e.kx *= 0.86; e.ky *= 0.86; e.ang = Math.atan2(dy, dx); e.face = dx >= 0 ? 1 : -1; e.hit -= dt; e.oc -= dt;
      if (d < e.r + p.r - 2 && p.inv <= 0) {
        p.hp -= Math.max(1, e.dmg - st.armor); p.inv = 0.45; p.hurtT = 0.15;
        if (p.hp <= 0) { p.hp = 0; this.over = true; return; }
      }
    }
    /* monsters shoulder each other apart so the horde spreads into a ring instead of stacking */
    var g = this;
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

    var mr = 72 * st.magnet;
    for (i = 0; i < this.gems.length; i++) {
      var gem = this.gems[i]; dx = p.x - gem.x; dy = p.y - gem.y; d = Math.hypot(dx, dy) || 1;
      if (gem.pull || d < mr) { gem.pull = true; var sp = Math.min(d, 520 * dt); gem.x += dx / d * sp; gem.y += dy / d * sp; }
      if (d < 16) { gem.dead = true; this.xp += gem.v; }
    }
    while (this.xp >= this.next) { this.xp -= this.next; this.lvl++; this.next = Math.round(5 + this.lvl * 3 + this.lvl * this.lvl * 0.3); this.pending++; }

    for (i = 0; i < this.fx.length; i++) { var f = this.fx[i]; f.life -= dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; } else if (f.k === 'n') f.y -= 40 * dt; }
    this.en = this.en.filter(alive); this.gems = this.gems.filter(alive);
    this.shots = this.shots.filter(living); this.zones = this.zones.filter(living); this.fx = this.fx.filter(living);
  };
  function alive(q) { return !q.dead; }
  function living(q) { return q.life > 0; }

  LL.Game = Game;
})(typeof window !== 'undefined' ? window : this);
