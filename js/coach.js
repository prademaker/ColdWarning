// Cold War 2: 2030 — the field guide: step-by-step hints for a new player in skirmish and defense.
// It reads the game state each second, shows the first basic step not yet done in the box at the
// top-left (where a mission shows its objectives) and drops in a one-off tip when something needs
// attention (low power, the first attack on the base, credits piling up). Turn it off on the menu.
'use strict';

const COACH_ARMY = 10; // fighting units before the guide says to attack

// The basic steps, in order. done(t) is checked against the player's team; text and tip take
// touch = true on a phone or tablet, where the keys don't exist.
const COACH_STEPS = [
  { id: 'deploy', text: 'Deploy your MCV',
    done: t => t.countOf('cc') > 0,
    tip: touch => touch ? 'Tap the MCV (the big truck), then tap Deploy ⤓ on the left. It unfolds into your Command Center.'
      : 'Click the MCV (the big truck) and press D, or click it again. It unfolds into your Command Center.' },
  { id: 'power', text: 'Build a Power Plant',
    done: t => t.countOf('power') > 0,
    tip: touch => touch ? 'Open the Base tab and tap Power Plant. When it says READY, tap it, tap the map next to your base, then tap the outline to place it.'
      : 'On the Base tab (B), click Power Plant. When it says READY, click it again and place it next to your Command Center.' },
  { id: 'refinery', text: 'Build an Ore Refinery',
    done: t => t.countOf('refinery') > 0,
    tip: () => 'Refineries come with a free Harvester that turns ore into credits. Place it close to an ore field.' },
  { id: 'barracks', text: 'Build a Barracks',
    done: t => t.countOf('barracks') > 0,
    tip: () => 'Riflemen hold ground and rocket soldiers kill tanks. A few of each will stop early raids.' },
  { id: 'factory', text: 'Build a War Factory',
    done: t => t.countOf('factory') > 0,
    tip: () => 'Tanks are the backbone of an army. A second Refinery after this keeps the credits coming.' },
  { id: 'army', text: `Train an army of ${COACH_ARMY}`,
    done: t => coachArmy(t).length >= COACH_ARMY,
    progress: t => `${Math.min(COACH_ARMY, coachArmy(t).length)}/${COACH_ARMY}`,
    tip: touch => touch ? 'Queue tanks on the Armor tab and infantry on the Infantry tab. Tap a button several times to queue more.'
      : 'Queue tanks on the Armor tab (V) and infantry on Infantry (C). Shift+click queues five at once.' },
  { id: 'radar', text: 'Build a Radar Station',
    done: t => t.countOf('radar') > 0,
    tip: () => 'Radar turns on the minimap, so you see attacks coming and can watch the whole battlefield.' },
  { id: 'attack', text: 'Destroy an enemy structure', skirmishOnly: true,
    done: t => t.stats.structuresKilled > 0,
    tip: touch => touch ? 'Tap Army ⚑ to select every fighter, tap Attack ⌖, then tap near the enemy base (it flashed on the radar).'
      : 'Ctrl+A selects your whole army. Press A and click near the enemy base (it flashed on the radar): units fight everything on the way.' },
];

function coachArmy(t) {
  return G.entities.filter(e => e.kind === 'unit' && e.team === t.id && !e.dead && e.def.weapon && !e.def.harvester && !e.def.mcv);
}

class Coach {
  constructor() {
    this.done = {};      // step id -> true
    this.tip = null;     // a one-off tip on screen: { text, until }
    this.told = {};      // tip id -> true once shown
    this.finished = 0;   // game time the last step was done
    this.thinkT = 0;
    this.pinged = false;
  }

  steps() { return COACH_STEPS.filter(s => !(s.skirmishOnly && G.mode !== 'skirmish')); }
  current() { return this.steps().find(s => !this.done[s.id]) || null; }
  get over() { return this.finished && G.time - this.finished > 12; }

  update(dt) {
    if (this.over) return;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.5;
    const t = G.playerTeam;
    if (!t || t.defeated) return;
    for (const s of this.steps()) {
      if (this.done[s.id] || !s.done(t)) continue;
      this.done[s.id] = true;
      if (s.id !== 'deploy') Sfx.play('click');
    }
    const cur = this.current();
    if (!cur && !this.finished) this.finished = G.time;
    // show where the enemy is when it's time to go and find them
    if (cur && cur.id === 'attack' && !this.pinged) {
      this.pinged = true;
      const foe = G.teams.find(o => o.id !== t.id && G.hostile(o.id, t.id) && !o.defeated && !o.waves);
      if (foe) { const [sx, sy] = G.map.starts[foe.id]; G.ping(sx * TILE + TILE / 2, sy * TILE + TILE / 2, 'info'); }
    }
    this.situational(t);
  }

  // one-off tips for things a new player tends to miss
  situational(t) {
    if (this.tip && G.time > this.tip.until) this.tip = null;
    const say = (id, text) => { if (this.told[id] || this.tip) return; this.told[id] = true; this.tip = { text, until: G.time + 12 }; };
    const touch = typeof Touch !== 'undefined' && Touch.on;
    if (G.messages.some(m => m.text === 'Our base is under attack' && G.time - m.t < 3)) {
      say('attacked', touch ? 'Your base is under attack! Tap ! on the left to jump to it.' : 'Your base is under attack! Press Space to jump to it.');
    }
    if (t.lowPower && t.countOf('cc')) say('power', 'Low power slows building and shuts down defenses. Build another Power Plant.');
    const busy = Object.values(t.queues).some(q => q.items.length);
    if (t.credits > 5000 && G.time > 240 && !busy) say('credits', 'Credits are piling up. Spend them: queue more units or build a second War Factory.');
    if (G.time > 300 && t.countOf('refinery') === 1 && this.done.factory) say('eco', 'A second Ore Refinery roughly doubles your income.');
  }
}
