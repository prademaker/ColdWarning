/* Last Lantern: game data. Weapons, passives, monsters and the shop are plain tables so new ones are cheap to add.
   Weapon stats at a level = base + every entry of `ups` up to that level (+ evo.patch once evolved).
   `col` names a colour slot the skin resolves (accent, xp, hp, t0..t5 monster tints, g0..g2 gem tints). */
(function (root) {
  'use strict';
  var LL = root.LL = root.LL || {};

  LL.DATA = {
    maxWeaponSlots: 6, maxPassiveSlots: 6, maxLevel: 5,

    weapons: {
      spark: { name: 'Spark Bolt', kind: 'bolt', col: 'xp', desc: 'Fires at the nearest monster.',
        base: { dmg: 10, cd: 0.9, count: 1, speed: 470, pierce: 1, size: 5 },
        ups: [{ count: 1 }, { dmg: 5, pierce: 1 }, { count: 1 }, { dmg: 8, cd: -0.2 }],
        evo: { name: 'Starfall Volley', needs: 'haste', patch: { count: 3, pierce: 3, cd: -0.25, dmg: 6 } } },
      halo: { name: 'Ember Halo', kind: 'orbit', col: 'accent', desc: 'Embers circle you and burn what they touch.',
        base: { dmg: 8, count: 2, radius: 62, speed: 3.2, size: 9, tick: 0.35 },
        ups: [{ count: 1 }, { dmg: 5, radius: 10 }, { count: 1 }, { dmg: 7, speed: 0.8, count: 1 }],
        evo: { name: 'Sun Crown', needs: 'reach', patch: { count: 3, radius: 26, dmg: 12, size: 3 } } },
      glow: { name: 'Lantern Glow', kind: 'aura', col: 'g2', desc: 'Your light sears everything close to you.',
        base: { dmg: 4, radius: 68, tick: 0.5 },
        ups: [{ radius: 14 }, { dmg: 3 }, { radius: 16, tick: -0.1 }, { dmg: 5, radius: 12 }],
        evo: { name: 'Hearthfire', needs: 'regen', patch: { radius: 45, dmg: 10, tick: -0.1 } } },
      pulse: { name: 'Shockwave', kind: 'nova', col: 't5', desc: 'A blast that hurls monsters back.',
        base: { dmg: 14, cd: 3.4, radius: 140, knock: 260 },
        ups: [{ radius: 25 }, { dmg: 10, cd: -0.4 }, { radius: 30 }, { dmg: 16, cd: -0.6 }],
        evo: { name: 'Earthshaker', needs: 'might', patch: { radius: 80, dmg: 40, cd: -0.4 } } },
      flask: { name: 'Fire Flask', kind: 'lob', col: 't1', desc: 'Lobs a flask that leaves a burning pool.',
        base: { dmg: 7, cd: 2.8, count: 1, radius: 46, dur: 2.6, tick: 0.4 },
        ups: [{ radius: 10, dmg: 2 }, { count: 1 }, { dur: 1, dmg: 3 }, { count: 1, radius: 10 }],
        evo: { name: 'Wildfire', needs: 'reach', patch: { count: 2, dur: 2, radius: 18, dmg: 6 } } },
      arc: { name: 'Storm Arc', kind: 'chain', col: 't2', desc: 'Lightning that jumps from monster to monster.',
        base: { dmg: 13, cd: 1.9, jumps: 3, range: 240 },
        ups: [{ jumps: 2 }, { dmg: 7 }, { jumps: 2, cd: -0.3 }, { dmg: 10, jumps: 2 }],
        evo: { name: 'Tempest', needs: 'haste', patch: { jumps: 7, dmg: 14, cd: -0.5 } } },
      glaive: { name: 'Moon Glaive', kind: 'boomerang', col: 'g1', desc: 'Flies out through the horde and returns.',
        base: { dmg: 12, cd: 2.3, count: 1, speed: 430, size: 11, range: 250 },
        ups: [{ dmg: 6 }, { count: 1 }, { range: 60, size: 3 }, { count: 1, dmg: 8 }],
        evo: { name: 'Eclipse Blades', needs: 'swift', patch: { count: 3, dmg: 12, size: 4 } } },
      thorns: { name: 'Thorn Burst', kind: 'burst', col: 't3', desc: 'Needles fly out in every direction.',
        base: { dmg: 7, cd: 2.5, count: 8, speed: 340, pierce: 1, size: 4 },
        ups: [{ count: 4 }, { dmg: 4, pierce: 1 }, { count: 4, cd: -0.4 }, { dmg: 6, pierce: 1 }],
        evo: { name: 'Briar Storm', needs: 'armor', patch: { count: 12, pierce: 2, dmg: 6, cd: -0.4 } } },
      lance: { name: 'Sun Lance', kind: 'beam', col: 'g2', desc: 'A beam of light that pierces a whole line.',
        base: { dmg: 16, cd: 2.2, count: 1, len: 330, width: 16 },
        ups: [{ dmg: 8 }, { width: 6, cd: -0.3 }, { count: 1 }, { dmg: 12, len: 60 }],
        evo: { name: 'Dawnbreaker', needs: 'might', patch: { count: 2, width: 12, dmg: 28 } } },
      mines: { name: 'Bramble Trap', kind: 'mine', col: 't0', desc: 'Leaves traps behind you that burst when stepped on.',
        base: { dmg: 26, cd: 1.8, radius: 60, max: 5 },
        ups: [{ dmg: 10 }, { max: 2, cd: -0.3 }, { radius: 15 }, { dmg: 18, max: 2 }],
        evo: { name: 'Thornfield', needs: 'magnet', patch: { cd: -0.6, radius: 32, dmg: 24, max: 6 } } },
      wisp: { name: 'Hunting Wisp', kind: 'seeker', col: 'xp', desc: 'Wisps that chase monsters down.',
        base: { dmg: 9, cd: 1.6, count: 1, speed: 260, pierce: 2 },
        ups: [{ count: 1 }, { dmg: 5 }, { count: 1, pierce: 1 }, { dmg: 7, cd: -0.3 }],
        evo: { name: 'Wisp Court', needs: 'growth', patch: { count: 3, dmg: 9, pierce: 2 } } },
      frost: { name: 'Frost Ring', kind: 'nova', col: 'xp', desc: 'A cold pulse that slows everything it touches.',
        base: { dmg: 6, cd: 4, radius: 130, knock: 0, slow: 2 },
        ups: [{ radius: 25 }, { slow: 1, dmg: 4 }, { cd: -0.7 }, { radius: 30, dmg: 8 }],
        evo: { name: 'Deep Winter', needs: 'vital', patch: { radius: 65, slow: 2, dmg: 12, cd: -0.6 } } },
      meteor: { name: 'Falling Star', kind: 'strike', col: 't1', desc: 'Calls a star down on a monster. Slow, but huge.',
        base: { dmg: 40, cd: 3.2, count: 1, radius: 62 },
        ups: [{ dmg: 15 }, { count: 1 }, { radius: 14, cd: -0.4 }, { count: 1, dmg: 20 }],
        evo: { name: 'Cataclysm', needs: 'luck', patch: { count: 3, radius: 26, dmg: 35 } } },
      whip: { name: 'Chain Lash', kind: 'sweep', col: 't5', desc: 'Sweeps a wide arc in front of you.',
        base: { dmg: 15, cd: 1.3, count: 1, range: 105, arc: 1.9 },
        ups: [{ dmg: 7 }, { range: 20 }, { count: 1 }, { dmg: 10, cd: -0.25 }],
        evo: { name: 'Storm Lash', needs: 'swift', patch: { range: 55, dmg: 22, cd: -0.35 } } },
      fan: { name: 'Scatter Knives', kind: 'fan', col: 't5', desc: 'Throws a fan of knives the way you are walking.',
        base: { dmg: 8, cd: 1.1, count: 3, speed: 560, pierce: 1, size: 4 },
        ups: [{ count: 1 }, { dmg: 4 }, { count: 2, pierce: 1 }, { dmg: 6, cd: -0.2 }],
        evo: { name: 'Thousand Knives', needs: 'luck', patch: { count: 6, pierce: 2, dmg: 5 } } },
      bounce: { name: 'Ricochet Orb', kind: 'bounce', col: 't2', desc: 'An orb that bounces from monster to monster.',
        base: { dmg: 11, cd: 1.7, count: 1, speed: 380, bounces: 3, size: 7 },
        ups: [{ bounces: 2 }, { dmg: 6 }, { count: 1 }, { bounces: 3, dmg: 6 }],
        evo: { name: 'Soul Orb', needs: 'growth', patch: { bounces: 9, dmg: 14, count: 1 } } }
    },

    passives: {
      might: { name: 'Whetstone', col: 'hp', per: '+12% damage', stat: 'dmg', add: 0.12 },
      haste: { name: 'Quick Hands', col: 'accent', per: 'Weapons fire 8% faster', stat: 'cd', add: -0.08 },
      swift: { name: 'Trail Boots', col: 'g1', per: '+8% move speed', stat: 'speed', add: 0.08 },
      vital: { name: 'Stout Heart', col: 'hp', per: '+20 max health', stat: 'maxHp', add: 20 },
      magnet: { name: 'Lodestone', col: 'xp', per: '+30% pickup range', stat: 'magnet', add: 0.3 },
      reach: { name: 'Wide Wick', col: 'g2', per: '+10% area and a wider light', stat: 'area', add: 0.1 },
      regen: { name: 'Herb Pouch', col: 'g1', per: '+0.4 health per second', stat: 'regen', add: 0.4 },
      armor: { name: 'Patched Cloak', col: 't5', per: 'Take 1 less damage per hit', stat: 'armor', add: 1 },
      luck: { name: 'Four-leaf Charm', col: 'g1', per: '+15% drops from monsters', stat: 'luck', add: 0.15 },
      growth: { name: 'Old Journal', col: 'xp', per: '+8% experience', stat: 'xp', add: 0.08 }
    },

    /* arch = which body the skin draws; tint = colour slot */
    enemies: {
      mote: { arch: 'blob', tint: 0, r: 12, sp: 42, hp: 9, dmg: 5, xp: 0 },
      skitter: { arch: 'dart', tint: 1, r: 10, sp: 88, hp: 6, dmg: 4, xp: 0 },
      wing: { arch: 'bat', tint: 2, r: 9, sp: 66, hp: 10, dmg: 5, xp: 0, flies: true },
      spitter: { arch: 'blob', tint: 1, r: 13, sp: 40, hp: 22, dmg: 7, xp: 1, ranged: true },
      husk: { arch: 'blob', tint: 3, r: 16, sp: 36, hp: 34, dmg: 8, xp: 1 },
      ogre: { arch: 'brute', tint: 4, r: 24, sp: 30, hp: 130, dmg: 14, xp: 2 },
      gravehorn: { arch: 'brute', tint: 5, r: 42, sp: 44, hp: 2400, dmg: 22, xp: 2, boss: true, name: 'Gravehorn', ai: { chargeCd: 4 } },
      brood: { arch: 'dart', tint: 1, r: 38, sp: 48, hp: 5000, dmg: 20, xp: 2, boss: true, name: 'The Broodmother',
        ai: { summon: 'skitter', summonN: 3, summonCd: 4, ring: 12, ringCd: 5 } },
      umbral: { arch: 'blob', tint: 5, r: 50, sp: 46, hp: 20000, dmg: 28, xp: 2, boss: true, final: true, name: 'The Umbral',
        ai: { chargeCd: 6, ring: 18, ringCd: 3.2, summon: 'wing', summonN: 6, summonCd: 6 } }
    },
    /* which monsters may spawn from a given minute onward, with weights */
    waves: [
      { from: 0, mix: { mote: 1 } },
      { from: 0.6, mix: { mote: 6, skitter: 2 } },
      { from: 1.5, mix: { mote: 5, skitter: 3, wing: 2 } },
      { from: 2.5, mix: { mote: 4, skitter: 3, wing: 2, spitter: 1 } },
      { from: 3.5, mix: { mote: 4, skitter: 3, wing: 2, husk: 3, spitter: 1 } },
      { from: 5, mix: { mote: 2, skitter: 3, wing: 3, husk: 4, ogre: 1, spitter: 2 } },
      { from: 8, mix: { skitter: 3, wing: 3, husk: 5, ogre: 2, spitter: 2 } }
    ],
    bosses: [{ at: 180, id: 'gravehorn' }, { at: 360, id: 'brood' }, { at: 600, id: 'umbral' }],
    gemValue: [1, 5, 25],

    /* permanent upgrades bought with coins earned in play. There is no way to buy coins. */
    shop: {
      might: { name: 'Sharpened Edge', per: '+5% damage', max: 5, cost: 40 },
      vigor: { name: 'Hearty Meals', per: '+10 max health', max: 5, cost: 40 },
      swift: { name: 'Light Feet', per: '+3% move speed', max: 5, cost: 30 },
      recover: { name: 'Bandages', per: '+0.1 health per second', max: 5, cost: 50 },
      greed: { name: 'Deep Pockets', per: '+10% coins', max: 5, cost: 60 },
      reroll: { name: 'Second Thoughts', per: '+1 reroll each run', max: 3, cost: 100 },
      revive: { name: 'Spare Wick', per: 'Relight once per run when you fall', max: 1, cost: 400 }
    },
    shopIcon: { might: 'might', vigor: 'vital', swift: 'swift', recover: 'regen', greed: 'coin', reroll: 'luck', revive: 'glow' }
  };
})(typeof window !== 'undefined' ? window : this);
