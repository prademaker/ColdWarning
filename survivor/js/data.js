/* Last Lantern: game data. Weapons, passives and monsters are plain tables so new ones are cheap to add.
   Weapon stats at a level = base + every entry of `ups` up to that level. `col` names a colour slot the
   active skin resolves (accent, xp, hp, t0..t5 enemy tints, g0..g2 gem tints). */
(function (root) {
  'use strict';
  var LL = root.LL = root.LL || {};

  LL.DATA = {
    maxWeaponSlots: 6, maxPassiveSlots: 6,

    weapons: {
      spark: { name: 'Spark Bolt', kind: 'bolt', col: 'xp', desc: 'Fires at the nearest monster.',
        base: { dmg: 10, cd: 0.9, count: 1, speed: 470, pierce: 1, size: 5 },
        ups: [{ count: 1 }, { dmg: 5, pierce: 1 }, { count: 1 }, { dmg: 8, cd: -0.2 }] },
      halo: { name: 'Ember Halo', kind: 'orbit', col: 'accent', desc: 'Embers circle you and burn what they touch.',
        base: { dmg: 8, count: 2, radius: 62, speed: 3.2, size: 9, tick: 0.35 },
        ups: [{ count: 1 }, { dmg: 5, radius: 10 }, { count: 1 }, { dmg: 7, speed: 0.8, count: 1 }] },
      glow: { name: 'Lantern Glow', kind: 'aura', col: 'g2', desc: 'Your light sears everything close to you.',
        base: { dmg: 4, radius: 68, tick: 0.5 },
        ups: [{ radius: 14 }, { dmg: 3 }, { radius: 16, tick: -0.1 }, { dmg: 5, radius: 12 }] },
      pulse: { name: 'Shockwave', kind: 'nova', col: 't5', desc: 'A blast that hurls monsters back.',
        base: { dmg: 14, cd: 3.4, radius: 140, knock: 260 },
        ups: [{ radius: 25 }, { dmg: 10, cd: -0.4 }, { radius: 30 }, { dmg: 16, cd: -0.6 }] },
      flask: { name: 'Fire Flask', kind: 'lob', col: 't1', desc: 'Lobs a flask that leaves a burning pool.',
        base: { dmg: 7, cd: 2.8, count: 1, radius: 46, dur: 2.6, tick: 0.4 },
        ups: [{ radius: 10, dmg: 2 }, { count: 1 }, { dur: 1, dmg: 3 }, { count: 1, radius: 10 }] },
      arc: { name: 'Storm Arc', kind: 'chain', col: 't2', desc: 'Lightning that jumps from monster to monster.',
        base: { dmg: 13, cd: 1.9, jumps: 3, range: 240 },
        ups: [{ jumps: 2 }, { dmg: 7 }, { jumps: 2, cd: -0.3 }, { dmg: 10, jumps: 2 }] },
      glaive: { name: 'Moon Glaive', kind: 'boomerang', col: 'g1', desc: 'Flies out through the horde and returns.',
        base: { dmg: 12, cd: 2.3, count: 1, speed: 430, size: 11, range: 250 },
        ups: [{ dmg: 6 }, { count: 1 }, { range: 60, size: 3 }, { count: 1, dmg: 8 }] },
      thorns: { name: 'Thorn Burst', kind: 'burst', col: 't3', desc: 'Needles fly out in every direction.',
        base: { dmg: 7, cd: 2.5, count: 8, speed: 340, pierce: 1, size: 4 },
        ups: [{ count: 4 }, { dmg: 4, pierce: 1 }, { count: 4, cd: -0.4 }, { dmg: 6, pierce: 1 }] }
    },

    passives: {
      might: { name: 'Whetstone', col: 'hp', per: '+12% damage', stat: 'dmg', add: 0.12 },
      haste: { name: 'Quick Hands', col: 'accent', per: 'Weapons fire 8% faster', stat: 'cd', add: -0.08 },
      swift: { name: 'Trail Boots', col: 'g1', per: '+8% move speed', stat: 'speed', add: 0.08 },
      vital: { name: 'Stout Heart', col: 't4', per: '+20 max health', stat: 'maxHp', add: 20 },
      magnet: { name: 'Lodestone', col: 'xp', per: '+30% pickup range', stat: 'magnet', add: 0.3 },
      reach: { name: 'Wide Wick', col: 'g2', per: '+10% area', stat: 'area', add: 0.1 },
      regen: { name: 'Herb Pouch', col: 't0', per: '+0.4 health per second', stat: 'regen', add: 0.4 },
      armor: { name: 'Patched Cloak', col: 't5', per: 'Take 1 less damage per hit', stat: 'armor', add: 1 }
    },
    maxLevel: 5,

    /* arch = which body the skin draws; tint = colour slot */
    enemies: {
      mote: { arch: 'blob', tint: 0, r: 12, sp: 42, hp: 9, dmg: 5, xp: 0 },
      skitter: { arch: 'dart', tint: 1, r: 10, sp: 88, hp: 6, dmg: 4, xp: 0 },
      wing: { arch: 'bat', tint: 2, r: 9, sp: 66, hp: 10, dmg: 5, xp: 0, flies: true },
      husk: { arch: 'blob', tint: 3, r: 16, sp: 36, hp: 34, dmg: 8, xp: 1 },
      ogre: { arch: 'brute', tint: 4, r: 24, sp: 30, hp: 130, dmg: 14, xp: 2 },
      boss: { arch: 'brute', tint: 5, r: 44, sp: 38, hp: 1400, dmg: 22, xp: 2, boss: true }
    },
    /* which monsters may spawn from a given minute onward, with weights */
    waves: [
      { from: 0, mix: { mote: 1 } },
      { from: 0.6, mix: { mote: 6, skitter: 2 } },
      { from: 1.5, mix: { mote: 5, skitter: 3, wing: 2 } },
      { from: 3, mix: { mote: 4, skitter: 3, wing: 2, husk: 3 } },
      { from: 5, mix: { mote: 2, skitter: 3, wing: 3, husk: 4, ogre: 1 } },
      { from: 8, mix: { skitter: 3, wing: 3, husk: 5, ogre: 2 } }
    ],
    gemValue: [1, 5, 25]
  };
})(typeof window !== 'undefined' ? window : this);
