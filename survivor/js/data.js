/* Last Foxhole: game data. Classes, weapons, gear, enemies and the shop are plain tables so new ones are cheap to add.
   Weapon stats at a level = base + every entry of `ups` up to that level (+ evo.patch once upgraded to its final form).
   `col` is a colour: a hex value, or a slot the skin resolves (accent, xp, hp, t0..t7 enemy tints, g0..g2 star tints).
   The enemy is a fictional army: no real nations, units, insignia or people appear anywhere in the game. */
(function (root) {
  'use strict';
  var LL = root.LL = root.LL || {};
  var BRASS = '#ffd27a', FIRE = '#ff8a3c', BLAST = '#ffb347', STEEL = '#cfd6dc', GAS = '#b8d66a';

  LL.DATA = {
    maxWeaponSlots: 6, maxPassiveSlots: 6, maxLevel: 5,

    /* mods are added to the base stats; start is the weapon the class always carries */
    classes: {
      rifleman: { name: 'Rifleman', start: 'rifle', role: 'All-rounder', desc: 'Steady and adaptable. Learns faster and gets an extra reroll.', mods: { xp: 0.1, reroll: 1 } },
      gunner: { name: 'Machine Gunner', start: 'mg', role: 'Tank', desc: 'Slow and tough. Rakes the crowd and shrugs off hits.', mods: { maxHp: 40, speed: -0.12, dmg: 0.1 } },
      medic: { name: 'Field Medic', start: 'gas', role: 'Survivor', desc: 'Heals over time, doubles medkits and gets back up once. Weak start.', mods: { regen: 0.8, healMul: 1, revive: 1, magnet: 0.3, dmg: -0.1 }, also: 'rifle' },
      sapper: { name: 'Sapper', start: 'mines', role: 'Trapper', desc: 'Fights with mines and charges. Bigger blasts, faster fuses.', mods: { area: 0.25, cd: -0.08 } },
      sniper: { name: 'Sniper', start: 'atrifle', role: 'Glass cannon', desc: 'Fast and fragile. One shot in four hits twice as hard.', mods: { speed: 0.15, maxHp: -30, crit: 0.25 } },
      flamer: { name: 'Flame Trooper', start: 'flame', role: 'Brawler', desc: 'Armoured and up close. Burns whatever is closest.', mods: { maxHp: 20, armor: 2, speed: -0.05 } }
    },

    weapons: {
      rifle: { name: 'Service Rifle', kind: 'bolt', col: BRASS, desc: 'Aimed shots at the nearest enemy.',
        base: { dmg: 10, cd: 0.9, count: 1, speed: 520, pierce: 1, size: 5 },
        ups: [{ count: 1 }, { dmg: 5, pierce: 1 }, { count: 1 }, { dmg: 8, cd: -0.2 }],
        evo: { name: 'Sharpshooter Rifle', needs: 'haste', patch: { count: 3, pierce: 3, cd: -0.25, dmg: 6 } } },
      mg: { name: 'Machine Gun', kind: 'chain', col: BRASS, desc: 'Rakes from one enemy to the next.',
        base: { dmg: 11, cd: 1.5, jumps: 3, range: 250 },
        ups: [{ jumps: 2 }, { dmg: 6 }, { jumps: 2, cd: -0.25 }, { dmg: 9, jumps: 2 }],
        evo: { name: 'Buzzsaw', needs: 'haste', patch: { jumps: 7, dmg: 12, cd: -0.45 } } },
      shotgun: { name: 'Trench Gun', kind: 'fan', col: BRASS, desc: 'A spread of buckshot at close range.',
        base: { dmg: 8, cd: 1.1, count: 3, speed: 560, pierce: 1, size: 4 },
        ups: [{ count: 1 }, { dmg: 4 }, { count: 2, pierce: 1 }, { dmg: 6, cd: -0.2 }],
        evo: { name: 'Street Sweeper', needs: 'luck', patch: { count: 6, pierce: 2, dmg: 5 } } },
      atrifle: { name: 'Anti-Tank Rifle', kind: 'beam', col: STEEL, desc: 'One heavy round that goes through a whole line.',
        base: { dmg: 18, cd: 2.0, count: 1, len: 340, width: 14 },
        ups: [{ dmg: 9 }, { width: 5, cd: -0.3 }, { count: 1 }, { dmg: 13, len: 60 }],
        evo: { name: 'Tank Buster', needs: 'might', patch: { count: 2, width: 10, dmg: 30 } } },
      ricochet: { name: 'Ricochet Rounds', kind: 'bounce', col: STEEL, desc: 'A round that skips from enemy to enemy.',
        base: { dmg: 11, cd: 1.7, count: 1, speed: 400, bounces: 3, size: 6 },
        ups: [{ bounces: 2 }, { dmg: 6 }, { count: 1 }, { bounces: 3, dmg: 6 }],
        evo: { name: 'Trick Shot', needs: 'growth', patch: { bounces: 9, dmg: 14, count: 1 } } },
      bayonet: { name: 'Fixed Bayonet', kind: 'aura', col: STEEL, desc: 'Cuts anything that gets close to you.',
        base: { dmg: 4, radius: 66, tick: 0.5 },
        ups: [{ radius: 14 }, { dmg: 3 }, { radius: 16, tick: -0.1 }, { dmg: 5, radius: 12 }],
        evo: { name: 'Trench Raider', needs: 'regen', patch: { radius: 42, dmg: 10, tick: -0.1 } } },
      flame: { name: 'Flamethrower', kind: 'sweep', col: FIRE, desc: 'A cone of fire at whatever is closest.',
        base: { dmg: 7, cd: 0.5, count: 1, range: 100, arc: 1.1 },
        ups: [{ dmg: 3 }, { range: 18 }, { arc: 0.4, dmg: 2 }, { dmg: 4, range: 18 }],
        evo: { name: "Dragon's Breath", needs: 'swift', text: 'also burns behind you, +40 range, +8 damage', patch: { count: 1, range: 40, dmg: 8 } } },
      molotov: { name: 'Fire Bottle', kind: 'lob', col: FIRE, desc: 'Lobbed at the enemy. Leaves a burning pool.',
        base: { dmg: 7, cd: 2.8, count: 1, radius: 46, dur: 2.6, tick: 0.4 },
        ups: [{ radius: 10, dmg: 2 }, { count: 1 }, { dur: 1, dmg: 3 }, { count: 1, radius: 10 }],
        evo: { name: 'Firestorm', needs: 'reach', patch: { count: 2, dur: 2, radius: 18, dmg: 6 } } },
      dynamite: { name: 'Dynamite', kind: 'nova', col: BLAST, desc: 'A blast at your feet that hurls enemies back.',
        base: { dmg: 14, cd: 3.4, radius: 140, knock: 260 },
        ups: [{ radius: 25 }, { dmg: 10, cd: -0.4 }, { radius: 30 }, { dmg: 16, cd: -0.6 }],
        evo: { name: 'Demolition Charge', needs: 'might', patch: { radius: 80, dmg: 40, cd: -0.4 } } },
      gas: { name: 'Smoke Canister', kind: 'nova', col: GAS, desc: 'Choking smoke that slows everything around you.',
        base: { dmg: 6, cd: 3.6, radius: 130, knock: 0, slow: 2 },
        ups: [{ radius: 25 }, { slow: 1, dmg: 4 }, { cd: -0.7 }, { radius: 30, dmg: 8 }],
        evo: { name: 'Choking Fog', needs: 'vital', patch: { radius: 65, slow: 2, dmg: 12, cd: -0.6 } } },
      shrapnel: { name: 'Shrapnel Charge', kind: 'burst', col: STEEL, desc: 'Fragments fly out in every direction.',
        base: { dmg: 7, cd: 2.5, count: 8, speed: 340, pierce: 1, size: 4 },
        ups: [{ count: 4 }, { dmg: 4, pierce: 1 }, { count: 4, cd: -0.4 }, { dmg: 6, pierce: 1 }],
        evo: { name: 'Flak Storm', needs: 'armor', patch: { count: 12, pierce: 2, dmg: 6, cd: -0.4 } } },
      mines: { name: 'Landmines', kind: 'mine', col: BLAST, desc: 'Laid behind you. They go off when stepped on.',
        base: { dmg: 26, cd: 1.8, radius: 60, max: 5 },
        ups: [{ dmg: 10 }, { max: 2, cd: -0.3 }, { radius: 15 }, { dmg: 18, max: 2 }],
        evo: { name: 'Minefield', needs: 'magnet', patch: { cd: -0.6, radius: 32, dmg: 24, max: 6 } } },
      bazooka: { name: 'Bazooka', kind: 'seeker', col: FIRE, desc: 'Rockets that curve toward a target and explode.',
        base: { dmg: 20, cd: 2.4, count: 1, speed: 300, pierce: 1, blast: 55 },
        ups: [{ dmg: 8 }, { count: 1 }, { blast: 15, cd: -0.3 }, { count: 1, dmg: 10 }],
        evo: { name: 'Rocket Battery', needs: 'growth', patch: { count: 3, dmg: 12, blast: 15 } } },
      mortar: { name: 'Mortar Barrage', kind: 'strike', col: BLAST, desc: 'Shells dropped on the enemy. Slow, but huge.',
        base: { dmg: 40, cd: 3.2, count: 1, radius: 62 },
        ups: [{ dmg: 15 }, { count: 1 }, { radius: 14, cd: -0.4 }, { count: 1, dmg: 20 }],
        evo: { name: 'Creeping Barrage', needs: 'luck', patch: { count: 3, radius: 26, dmg: 35 } } },
      planes: { name: 'Air Cover', kind: 'orbit', col: BRASS, desc: 'Fighters circle you and strafe what they pass.',
        base: { dmg: 8, count: 2, radius: 70, speed: 2.8, size: 10, tick: 0.35 },
        ups: [{ count: 1 }, { dmg: 5, radius: 10 }, { count: 1 }, { dmg: 7, speed: 0.7, count: 1 }],
        evo: { name: 'Fighter Squadron', needs: 'reach', patch: { count: 3, radius: 26, dmg: 12, size: 2 } } },
      dog: { name: 'War Dog', kind: 'boomerang', col: STEEL, desc: 'Runs out through the enemy and comes back to you.',
        base: { dmg: 12, cd: 2.3, count: 1, speed: 400, size: 11, range: 250 },
        ups: [{ dmg: 6 }, { count: 1 }, { range: 60, size: 2 }, { count: 1, dmg: 8 }],
        evo: { name: 'K-9 Pack', needs: 'swift', patch: { count: 3, dmg: 12, size: 2 } } }
    },

    passives: {
      might: { name: 'Armour-Piercing Rounds', col: 'hp', per: '+12% damage', stat: 'dmg', add: 0.12 },
      haste: { name: 'Quick Reload', col: 'accent', per: 'Weapons fire 8% faster', stat: 'cd', add: -0.08 },
      swift: { name: 'Jump Boots', col: 'xp', per: '+8% move speed', stat: 'speed', add: 0.08 },
      vital: { name: 'Field Rations', col: 'hp', per: '+20 max health', stat: 'maxHp', add: 20 },
      magnet: { name: 'Scavenger Kit', col: STEEL, per: '+30% pickup range', stat: 'magnet', add: 0.3 },
      reach: { name: 'Signal Flares', col: 'accent', per: '+10% area and a wider light', stat: 'area', add: 0.1 },
      regen: { name: 'First Aid Kit', col: 'xp', per: '+0.4 health per second', stat: 'regen', add: 0.4 },
      armor: { name: 'Steel Helmet', col: STEEL, per: 'Take 1 less damage per hit', stat: 'armor', add: 1 },
      luck: { name: 'Lucky Coin', col: 'accent', per: '+15% drops from enemies', stat: 'luck', add: 0.15 },
      growth: { name: 'Field Manual', col: 'xp', per: '+8% experience', stat: 'xp', add: 0.08 }
    },

    /* arch = which body the art draws; tint = colour slot */
    enemies: {
      infantry: { arch: 'soldier', tint: 0, r: 12, sp: 42, hp: 9, dmg: 5, xp: 0 },
      dog: { arch: 'dog', tint: 1, r: 10, sp: 88, hp: 6, dmg: 4, xp: 0 },
      bike: { arch: 'bike', tint: 2, r: 11, sp: 70, hp: 10, dmg: 5, xp: 0, flies: true },
      grenadier: { arch: 'soldier', tint: 3, r: 13, sp: 40, hp: 22, dmg: 7, xp: 1, ranged: true },
      trooper: { arch: 'soldier', tint: 6, r: 16, sp: 36, hp: 34, dmg: 8, xp: 1 },
      car: { arch: 'tank', tint: 4, r: 24, sp: 30, hp: 130, dmg: 14, xp: 2 },
      bull: { arch: 'tank', tint: 5, r: 42, sp: 44, hp: 2400, dmg: 22, xp: 2, boss: true, name: 'The Iron Bull', ai: { chargeCd: 4 } },
      kennel: { arch: 'truck', tint: 3, r: 40, sp: 48, hp: 5000, dmg: 20, xp: 2, boss: true, name: 'The Kennel Wagon',
        ai: { summon: 'dog', summonN: 3, summonCd: 4, ring: 12, ringCd: 5 } },
      behemoth: { arch: 'tank', tint: 7, r: 52, sp: 46, hp: 20000, dmg: 28, xp: 2, boss: true, final: true, name: 'The Behemoth',
        ai: { chargeCd: 6, ring: 18, ringCd: 3.2, summon: 'bike', summonN: 5, summonCd: 6 } }
    },
    /* which enemies may arrive from a given minute onward, with weights */
    waves: [
      { from: 0, mix: { infantry: 1 } },
      { from: 0.6, mix: { infantry: 6, dog: 2 } },
      { from: 1.5, mix: { infantry: 5, dog: 3, bike: 2 } },
      { from: 2.5, mix: { infantry: 4, dog: 3, bike: 2, grenadier: 1 } },
      { from: 3.5, mix: { infantry: 4, dog: 3, bike: 2, trooper: 3, grenadier: 1 } },
      { from: 5, mix: { infantry: 2, dog: 3, bike: 3, trooper: 4, car: 1, grenadier: 2 } },
      { from: 8, mix: { dog: 3, bike: 3, trooper: 5, car: 2, grenadier: 2 } }
    ],
    bosses: [{ at: 180, id: 'bull' }, { at: 360, id: 'kennel' }, { at: 600, id: 'behemoth' }],
    gemValue: [1, 5, 25],

    /* permanent upgrades bought with scrap found in play. There is no way to buy scrap. */
    shop: {
      might: { name: 'Better Ammunition', per: '+5% damage', max: 5, cost: 40 },
      vigor: { name: 'Hot Meals', per: '+10 max health', max: 5, cost: 40 },
      swift: { name: 'Broken-in Boots', per: '+3% move speed', max: 5, cost: 30 },
      recover: { name: 'Bandages', per: '+0.1 health per second', max: 5, cost: 50 },
      greed: { name: 'Deep Pockets', per: '+10% scrap', max: 5, cost: 60 },
      reroll: { name: 'Second Thoughts', per: '+1 reroll each run', max: 3, cost: 100 },
      magnet: { name: 'Long Arms', per: '+8% pickup range', max: 5, cost: 30 },
      xp: { name: 'Drill Practice', per: '+4% experience in a run', max: 5, cost: 60 },
      luck: { name: 'Sharp Eyes', per: '+5% drops from enemies', max: 5, cost: 50, rank: 3 },
      head: { name: 'Head Start', per: 'Begin each run with a free promotion', max: 3, cost: 200, rank: 4 },
      armor: { name: 'Flak Vest', per: 'Take 1 less damage per hit', max: 2, cost: 250, rank: 5 },
      choice: { name: 'Friends in Supply', per: 'A fourth option on every promotion', max: 1, cost: 600, rank: 6 },
      revive: { name: 'Stubborn', per: 'Get back up once per run', max: 1, cost: 400, rank: 2 }
    },
    shopIcon: { might: 'might', vigor: 'vital', swift: 'swift', recover: 'regen', greed: 'coin', reroll: 'luck', revive: 'armor', magnet: 'magnet', xp: 'growth', luck: 'luck', head: 'haste', armor: 'armor', choice: 'reach' }
  };
})(typeof window !== 'undefined' ? window : this);
