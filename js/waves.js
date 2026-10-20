// Cold War 2: 2030 — defense mode: waves of attackers march on the player's base from the
// map's other corners. Survive them all to win.
'use strict';

class WaveDirector {
  constructor(team, difficulty) {
    this.team = team;
    this.mult = (DIFFICULTY[difficulty] || DIFFICULTY.normal).income;
    this.total = DEFENSE.waves;
    this.wave = 0;                 // waves launched so far
    this.next = DEFENSE.firstWave; // game time of the next wave
    this.paid = 0;                 // last wave whose clearing bounty was paid
    this.warned = 0;
    this.thinkT = 0;
    this.won = false;
  }

  // seconds until the next wave, or null once the last one is out
  get countdown() { return this.wave < this.total ? Math.max(0, this.next - G.time) : null; }
  units() { return G.entities.filter(e => e.kind === 'unit' && e.team === this.team.id && !e.dead); }

  update(dt) {
    if (this.won) return;
    if (this.wave < this.total) {
      const left = this.next - G.time;
      if (left <= 10 && this.warned < this.wave + 1) { this.warned = this.wave + 1; G.eva('Enemy forces approaching', G.player); }
      if (left <= 0) this.launch();
    }
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 1;
    const units = this.units();
    if (!units.length && this.wave > this.paid) {
      // the field is clear: pay out for every wave beaten since the last payout
      let bounty = 0;
      for (let n = this.paid + 1; n <= this.wave; n++) bounty += DEFENSE.bounty + n * 100;
      this.paid = this.wave;
      G.playerTeam.credits += bounty;
      if (this.wave >= this.total) { this.won = true; return; }
      G.eva('Wave repelled', G.player);
    }
    // units that have run out of things to do push on to the nearest target
    for (const u of units) {
      if (u.order || u.target) continue;
      const tgt = this.targetNear(u.x, u.y);
      if (tgt) G.commandMove([u], Math.floor(tgt.x / TILE), Math.floor(tgt.y / TILE), true, true);
    }
  }

  // send the next wave now, for a bonus of the seconds skipped (button in the HUD)
  callEarly() {
    if (this.wave >= this.total) return;
    const left = Math.max(0, this.next - G.time);
    G.playerTeam.credits += Math.round(left * 10);
    this.launch();
  }

  launch() {
    const n = ++this.wave;
    const t = this.team;
    this.next = G.time + DEFENSE.interval;
    let budget = (1000 + n * 650 + n * n * 35) * this.mult;
    const keys = [];
    // every fifth wave is led by super tanks
    if (n % 5 === 0) {
      const boss = t.pkg === 'tech' ? 'railtank' : 'titan';
      for (let i = 0; i < n / 5 + 1; i++) { keys.push(boss); budget -= t.costOf(boss); }
    }
    const pool = DEFENSE.pool.map(([k, from, w]) => [sideKey(k, t.faction), from, w]).filter(([k, from]) => n >= from && inRoster(k, t.faction));
    const sum = pool.reduce((s, [, , w]) => s + w, 0);
    while (budget > 0 && keys.length < 40) {
      let r = Math.random() * sum, k = pool[0][0];
      for (const [key, , w] of pool) { r -= w; if (r <= 0) { k = key; break; } }
      keys.push(k);
      budget -= t.costOf(k);
    }
    // they come in from one corner at first, two from wave 4 and all three from wave 10
    const entries = G.map.starts.filter((s, i) => i !== G.player).sort(() => Math.random() - 0.5);
    const nE = Math.min(entries.length, n >= 10 ? 3 : n >= 4 ? 2 : 1);
    const groups = Array.from({ length: nE }, () => []);
    keys.forEach((k, i) => {
      const [sx, sy] = entries[i % nE];
      const spot = G.findFreeTile(sx + Math.floor(Math.random() * 5) - 2, sy + Math.floor(Math.random() * 5) - 2) || [sx, sy];
      const u = G.spawnUnit(k, t.id, spot[0] * TILE + TILE / 2, spot[1] * TILE + TILE / 2);
      u.rank = n >= 13 ? 2 : n >= 8 ? 1 : 0;
      t.stats.built++;
      groups[i % nE].push(u);
    });
    groups.forEach((g, i) => {
      const [sx, sy] = entries[i];
      const tgt = this.targetNear(sx * TILE, sy * TILE);
      if (tgt && g.length) G.commandMove(g, Math.floor(tgt.x / TILE), Math.floor(tgt.y / TILE), true, true);
    });
    G.eva(n === this.total ? 'Final wave incoming' : 'Wave ' + n + ' incoming', G.player);
  }

  // the player's nearest structure (or unit, once the base is gone)
  targetNear(x, y) {
    let best = null, bd = 1e9;
    for (const e of G.entities) {
      if (e.dead || !G.hostile(e.team, this.team.id)) continue;
      const d = Math.hypot(e.x - x, e.y - y) + (e.kind === 'unit' ? 800 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
}
