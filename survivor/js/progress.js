/* Last Foxhole: everything that carries over between runs. Ranks unlock classes, weapons and gear;
   each class has its own mastery track; medals pay scrap; winning a Night unlocks a harder one.
   All of it is earned by playing and stored on the device. Nothing here can be bought. */
(function (root) {
  'use strict';
  var LL = root.LL, D = LL.DATA, P = LL.Progress = {};

  P.RANKS = ['Recruit', 'Private', 'Private First Class', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Sergeant First Class', 'Master Sergeant',
    'Second Lieutenant', 'First Lieutenant', 'Captain', 'Major', 'Lieutenant Colonel', 'Colonel', 'Brigadier', 'General'];
  function need(n) { return 250 + 150 * n * n; }   /* service XP to go from rank n to n + 1 */
  /* the rank at which each thing becomes available; anything not listed is there from the start */
  P.UNLOCK = {
    classes: { gunner: 1, medic: 2, sapper: 4, sniper: 6, flamer: 8 },
    weapons: { gas: 1, ricochet: 2, planes: 3, atrifle: 4, dog: 5, bazooka: 6, mortar: 7, flame: 8 },
    passives: { armor: 2, reach: 3, growth: 5, luck: 7 }
  };
  P.MAX_NIGHT = 5; P.MAX_MASTERY = 10;
  /* what a class earns at each mastery level */
  P.PERKS = { 2: '+3% damage', 3: '+10 max health', 4: '+3% damage', 5: 'Starting weapon begins at level 2', 6: '+10 max health', 7: '+1 reroll each run', 8: '+4% damage', 9: '+10 max health', 10: 'Starts with signature gear' };
  P.SIGNATURE = { rifleman: 'haste', gunner: 'vital', medic: 'regen', sapper: 'magnet', sniper: 'swift', flamer: 'might' };

  P.defaults = function (s) {
    if (s.xp == null) s.xp = 0;
    s.mast = s.mast || {}; s.medals = s.medals || {}; s.classWins = s.classWins || {};
    s.stats = s.stats || { kills: 0, runs: 0, wins: 0, bosses: 0, time: 0, evos: 0, chests: 0, elites: 0, scrap: 0, maxLvl: 0 };
    s.tal = s.tal || {}; s.inv = s.inv || []; s.eq = s.eq || {}; s.sup = s.sup || {}; if (!s.itemSeq) s.itemSeq = 1;
    if (!s.night) s.night = 1; if (!s.nightSel || s.nightSel > s.night) s.nightSel = s.night;
    return s;
  };
  P.rank = function (s) {
    var n = 0, left = s.xp;
    while (n < P.RANKS.length - 1 && left >= need(n)) { left -= need(n); n++; }
    return { idx: n, name: P.RANKS[n], into: left, need: n < P.RANKS.length - 1 ? need(n) : 0 };
  };
  P.reqRank = function (type, id) { return (P.UNLOCK[type] && P.UNLOCK[type][id]) || 0; };
  P.unlocked = function (s, type, id) { return P.rank(s).idx >= P.reqRank(type, id); };
  P.mastery = function (s, cls) {
    var lvl = 1, left = s.mast[cls] || 0;
    while (lvl < P.MAX_MASTERY && left >= 300 * lvl) { left -= 300 * lvl; lvl++; }
    return { lvl: lvl, into: left, need: lvl < P.MAX_MASTERY ? 300 * lvl : 0 };
  };
  /* what the run starts with, given the save */
  P.runOptions = function (s, cls) {
    var r = P.rank(s).idx, m = P.mastery(s, cls).lvl, allow = { weapons: {}, passives: {} }, id;
    for (id in D.weapons) if (r >= P.reqRank('weapons', id)) allow.weapons[id] = true;
    for (id in D.passives) if (r >= P.reqRank('passives', id)) allow.passives[id] = true;
    var o = { night: s.nightSel, allow: allow, bonus: {
      dmg: (m >= 2 ? 0.03 : 0) + (m >= 4 ? 0.03 : 0) + (m >= 8 ? 0.04 : 0), maxHp: (m >= 3 ? 10 : 0) + (m >= 6 ? 10 : 0) + (m >= 9 ? 10 : 0),
      startLvl: m >= 5 ? 2 : 1, reroll: m >= 7 ? 1 : 0, passive: m >= 10 ? P.SIGNATURE[cls] : null } };
    P.applyBuild(s, o.bonus);
    return o;
  };
  P.nightText = function (n) { return n <= 1 ? 'The standard fight.' : 'Enemies +' + (n - 1) * 35 + '% tougher, +' + (n - 1) * 15 + '% damage. +' + (n - 1) * 25 + '% scrap and service XP.'; };

  /* r is the run just finished, or null when checking lifetime medals only */
  var CLS = Object.keys(D.classes);
  P.MEDALS = [
    { id: 'blood1', name: 'First Blood', desc: 'Put down 100 enemies in total.', scrap: 30, test: function (s) { return s.stats.kills >= 100; } },
    { id: 'blood2', name: 'Butcher', desc: 'Put down 5,000 enemies in total.', scrap: 150, test: function (s) { return s.stats.kills >= 5000; } },
    { id: 'blood3', name: 'One-Man Army', desc: 'Put down 50,000 enemies in total.', scrap: 600, test: function (s) { return s.stats.kills >= 50000; } },
    { id: 'hold5', name: 'Dug In', desc: 'Hold out for five minutes.', scrap: 50, test: function (s, r) { return r && r.t >= 300; } },
    { id: 'bull', name: 'Bullfighter', desc: 'Destroy The Iron Bull.', scrap: 75, test: function (s, r) { return r && r.bosses >= 1; } },
    { id: 'kennel', name: 'Dog Catcher', desc: 'Destroy The Kennel Wagon.', scrap: 120, test: function (s, r) { return r && r.bosses >= 2; } },
    { id: 'dawn', name: 'Dawn Patrol', desc: 'Hold the line until dawn.', scrap: 250, test: function (s, r) { return r && r.won; } },
    { id: 'clean', name: 'Untouchable', desc: 'Reach 3:00 without being hit.', scrap: 120, test: function (s, r) { return r && r.t >= 180 && (r.hitT < 0 || r.hitT >= 180); } },
    { id: 'lvl30', name: 'Battle Hardened', desc: 'Reach level 30 in one run.', scrap: 100, test: function (s, r) { return r && r.lvl >= 30; } },
    { id: 'evo1', name: 'Field Modification', desc: 'Upgrade a weapon to its final form.', scrap: 60, test: function (s, r) { return r && r.evos >= 1; } },
    { id: 'evo3', name: 'Armoury', desc: 'Carry three final-form weapons in one run.', scrap: 200, test: function (s, r) { return r && r.evos >= 3; } },
    { id: 'full', name: 'Loaded for Bear', desc: 'Carry six weapons at once.', scrap: 60, test: function (s, r) { return r && r.weapons >= 6; } },
    { id: 'crates', name: 'Quartermaster\'s Friend', desc: 'Open 25 supply crates in total.', scrap: 120, test: function (s) { return s.stats.chests >= 25; } },
    { id: 'elites', name: 'Headhunter', desc: 'Put down 50 elite enemies in total.', scrap: 150, test: function (s) { return s.stats.elites >= 50; } },
    { id: 'scrap', name: 'Scrap Baron', desc: 'Bank 2,000 scrap in total.', scrap: 200, test: function (s) { return s.stats.scrap >= 2000; } },
    { id: 'runs', name: 'Veteran', desc: 'Finish 25 runs.', scrap: 150, test: function (s) { return s.stats.runs >= 25; } },
    { id: 'night3', name: 'Night Owl', desc: 'Win on Night 3.', scrap: 400, test: function (s, r) { return r && r.won && r.night >= 3; } },
    { id: 'night5', name: 'The Longest Night', desc: 'Win on Night 5.', scrap: 1000, test: function (s, r) { return r && r.won && r.night >= 5; } },
    { id: 'all', name: 'Combined Arms', desc: 'Win with every class.', scrap: 800, test: function (s) { for (var i = 0; i < CLS.length; i++) if (!s.classWins[CLS[i]]) return false; return true; } },
    { id: 'master', name: 'Specialist', desc: 'Bring any class to mastery 10.', scrap: 500, test: function (s) { for (var i = 0; i < CLS.length; i++) if (P.mastery(s, CLS[i]).lvl >= P.MAX_MASTERY) return true; return false; } }
  ];
  function unlockName(type, id) { return type === 'classes' ? 'Class: ' + D.classes[id].name : type === 'weapons' ? 'Weapon: ' + D.weapons[id].name : 'Gear: ' + D.passives[id].name; }
  P.unlocksAt = function (rank) {
    var out = [], type, id;
    for (type in P.UNLOCK) for (id in P.UNLOCK[type]) if (P.UNLOCK[type][id] === rank) out.push(unlockName(type, id));
    for (id in D.shop) if (D.shop[id].rank === rank) out.push('Quartermaster: ' + D.shop[id].name);
    return out;
  };

  /* bank a finished run into the save; returns what to show on the debrief */
  P.finish = function (s, g, scrap) {
    var r = { t: g.t, kills: g.kills, lvl: g.lvl, won: g.won, cls: g.clsId, night: g.night, bosses: g.bossKills, evos: g.evos, weapons: g.weapons.length, hitT: g.hitT };
    var out = { xp: 0, ranks: [], unlocks: [], medals: [], mastery: 0, perks: [], night: 0 }, st = s.stats, before = P.rank(s).idx, mb = P.mastery(s, r.cls).lvl, i;
    out.xp = Math.floor((r.t + r.kills * 0.2 + r.bosses * 150 + (r.won ? 500 : 0)) * (1 + 0.25 * (r.night - 1)));
    s.xp += out.xp; s.mast[r.cls] = (s.mast[r.cls] || 0) + out.xp;
    st.kills += r.kills; st.runs++; st.bosses += r.bosses; st.time += r.t; st.evos += r.evos; st.chests += g.chestsOpened; st.elites += g.eliteKills; st.scrap += scrap; st.maxLvl = Math.max(st.maxLvl, r.lvl);
    if (r.won) { st.wins++; s.classWins[r.cls] = true; if (r.night === s.night && s.night < P.MAX_NIGHT) { s.night++; s.nightSel = s.night; out.night = s.night; } }
    var after = P.rank(s).idx;
    for (i = before + 1; i <= after; i++) { out.ranks.push(P.RANKS[i]); out.unlocks = out.unlocks.concat(P.unlocksAt(i)); }
    var ma = P.mastery(s, r.cls).lvl;
    if (ma > mb) { out.mastery = ma; for (i = mb + 1; i <= ma; i++) out.perks.push(P.PERKS[i]); }
    P.MEDALS.forEach(function (m) { if (!s.medals[m.id] && m.test(s, r)) { s.medals[m.id] = true; s.coins += m.scrap; out.medals.push(m); } });
    P.rollLoot(s, g, out);
    return out;
  };

  /* ================================================================ talents
     One point per rank, plus one for every two medals. Three branches; deeper talents need points spent in their branch. */
  P.BRANCHES = ['Assault', 'Survival', 'Logistics'];
  P.TALENTS = [
    { id: 'marksman', b: 0, name: 'Marksman', max: 3, req: 0, stat: 'dmg', add: 0.04, per: '+4% damage' },
    { id: 'rapid', b: 0, name: 'Rapid Fire', max: 3, req: 0, stat: 'cd', add: -0.03, per: 'Weapons fire 3% faster' },
    { id: 'deadeye', b: 0, name: 'Deadeye', max: 3, req: 3, stat: 'crit', add: 0.04, per: '+4% chance to hit twice as hard' },
    { id: 'bigbang', b: 0, name: 'Bigger Bang', max: 3, req: 3, stat: 'area', add: 0.06, per: '+6% area' },
    { id: 'overkill', b: 0, name: 'Overkill', max: 3, req: 6, stat: 'overkill', add: 0.06, per: '6% of kills set off a small explosion' },
    { id: 'thick', b: 1, name: 'Thick Skin', max: 3, req: 0, stat: 'maxHp', add: 10, per: '+10 max health' },
    { id: 'dressing', b: 1, name: 'Field Dressing', max: 3, req: 0, stat: 'regen', add: 0.15, per: '+0.15 health per second' },
    { id: 'adrenaline', b: 1, name: 'Adrenaline', max: 3, req: 3, stat: 'speed', add: 0.04, per: '+4% move speed' },
    { id: 'grit', b: 1, name: 'Grit', max: 2, req: 3, stat: 'armor', add: 1, per: 'Take 1 less damage per hit' },
    { id: 'laststand', b: 1, name: 'Last Stand', max: 3, req: 6, stat: 'lastStand', add: 0.12, per: '+12% damage while below 30% health' },
    { id: 'scrounger', b: 2, name: 'Scrounger', max: 3, req: 0, stat: 'coin', add: 0.1, per: '+10% scrap' },
    { id: 'study', b: 2, name: 'Quick Study', max: 3, req: 0, stat: 'xp', add: 0.04, per: '+4% experience in a run' },
    { id: 'reach', b: 2, name: 'Long Reach', max: 3, req: 3, stat: 'magnet', add: 0.1, per: '+10% pickup range' },
    { id: 'lucky', b: 2, name: 'Lucky Find', max: 3, req: 3, stat: 'luck', add: 0.05, per: '+5% drops from enemies' },
    { id: 'salvage', b: 2, name: 'Salvage Rights', max: 3, req: 6, stat: 'salvage', add: 0.08, per: 'Elites drop gear 8% more often' }
  ];
  P.talentPoints = function (s) {
    var total = P.rank(s).idx + Math.floor(Object.keys(s.medals).length / 2), spent = 0, branch = [0, 0, 0];
    P.TALENTS.forEach(function (t) { var n = s.tal[t.id] || 0; spent += n; branch[t.b] += n; });
    return { total: total, spent: spent, free: total - spent, branch: branch };
  };
  P.canLearn = function (s, t) { var p = P.talentPoints(s); return p.free > 0 && (s.tal[t.id] || 0) < t.max && p.branch[t.b] >= t.req; };

  /* ================================================================ equipment
     Six slots. Gear drops from bosses and elites and at the end of a run; it has a rarity, a main stat and
     random extra stats, and can be upgraded or broken down for scrap. */
  P.SLOTS = { gun: 'Weapon kit', helmet: 'Helmet', vest: 'Vest', boots: 'Boots', pack: 'Pack', charm: 'Keepsake' };
  P.SLOT_ICON = { gun: 'rifle', helmet: 'armor', vest: 'vital', boots: 'swift', pack: 'magnet', charm: 'luck' };
  P.RARITY = [
    { name: 'Standard', col: '#b9b6a8', aff: 0, mul: 1 }, { name: 'Improved', col: '#8fbf5a', aff: 1, mul: 1.25 }, { name: 'Fine', col: '#59a7d9', aff: 2, mul: 1.5 },
    { name: 'Elite', col: '#b77bd9', aff: 3, mul: 1.8 }, { name: 'Legendary', col: '#e8b84a', aff: 4, mul: 2.2 }
  ];
  var BASE = { gun: ['dmg', 0.04], helmet: ['maxHp', 8], vest: ['maxHp', 14], boots: ['speed', 0.03], pack: ['magnet', 0.12], charm: ['luck', 0.05] };
  var AFFIX = { dmg: 0.02, cd: -0.015, speed: 0.015, maxHp: 5, regen: 0.08, magnet: 0.06, area: 0.03, luck: 0.03, xp: 0.025, coin: 0.04, crit: 0.02 };
  var NAMES = { gun: ['Cleaning Kit', 'Match Barrel', 'Hair Trigger', 'Sling and Sights'], helmet: ['Steel Pot', 'Para Helmet', 'Tanker Helmet'], vest: ['Web Gear', 'Flak Jacket', 'Assault Vest'],
    boots: ['Jump Boots', 'Trench Boots', 'Mountain Boots'], pack: ['Haversack', 'Rucksack', 'Musette Bag'], charm: ['Lucky Coin', 'Dog Tags', 'Photo from Home', "Rabbit's Foot", 'Trench Lighter'] };
  var ODDS = [[60, 28, 9, 2.5, 0.5], [35, 38, 19, 6, 2], [10, 35, 33, 16, 6]];   /* by source: end of run, elite, boss */
  P.MAX_INV = 30; P.MAX_ITEM_LVL = 10;
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  P.makeItem = function (s, quality, night) {
    var w = ODDS[quality].slice(), total = 0, i, r, rar = 0, slot = pick(Object.keys(P.SLOTS)), keys = Object.keys(AFFIX), aff = [];
    for (i = 2; i < w.length; i++) w[i] *= 1 + 0.3 * (night - 1);
    for (i = 0; i < w.length; i++) total += w[i];
    r = Math.random() * total; for (i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { rar = i; break; } }
    keys = keys.filter(function (k) { return k !== BASE[slot][0]; });
    for (i = 0; i < P.RARITY[rar].aff; i++) { var k = keys.splice((Math.random() * keys.length) | 0, 1)[0]; aff.push([k, AFFIX[k] * (0.8 + Math.random() * 0.5)]); }
    return { id: s.itemSeq++, slot: slot, rar: rar, lvl: 1, name: pick(NAMES[slot]), aff: aff };
  };
  /* every stat an item gives at its current level */
  P.itemStats = function (it) {
    var f = 1 + 0.1 * (it.lvl - 1), out = [[BASE[it.slot][0], BASE[it.slot][1] * P.RARITY[it.rar].mul * f]];
    it.aff.forEach(function (a) { out.push([a[0], a[1] * f]); });
    return out;
  };
  var FMT = { dmg: ['%', ' damage'], cd: ['%', ' faster fire'], speed: ['%', ' speed'], maxHp: ['', ' health'], regen: ['', ' health/s'], magnet: ['%', ' pickup range'], area: ['%', ' area'],
    luck: ['%', ' drops'], xp: ['%', ' experience'], coin: ['%', ' scrap'], crit: ['%', ' heavy hits'] };
  P.statText = function (k, v) {
    var f = FMT[k], n = Math.abs(v);
    return '+' + (f[0] === '%' ? Math.round(n * 1000) / 10 + '%' : Math.round(n * 100) / 100) + f[1];
  };
  P.itemText = function (it) { return P.itemStats(it).map(function (a) { return P.statText(a[0], a[1]); }).join(', '); };
  P.upgradeCost = function (it) { return 25 * (it.rar + 1) * it.lvl; };
  P.scrapValue = function (it) { return 8 * (it.rar + 1) * it.lvl; };
  P.item = function (s, id) { for (var i = 0; i < s.inv.length; i++) if (s.inv[i].id === id) return s.inv[i]; return null; };
  P.equipped = function (s, it) { return s.eq[it.slot] === it.id; };
  P.addItem = function (s, it) {   /* returns scrap paid out instead when the pack is full */
    if (s.inv.length >= P.MAX_INV) { var v = P.scrapValue(it); s.coins += v; return v; }
    s.inv.push(it); if (!s.eq[it.slot]) s.eq[it.slot] = it.id; return 0;
  };
  P.removeItem = function (s, it) { s.inv = s.inv.filter(function (q) { return q !== it; }); if (s.eq[it.slot] === it.id) delete s.eq[it.slot]; };

  /* ================================================================ supplies: used up by the run they are taken on */
  P.SUPPLIES = {
    ration: { name: 'Field Ration', per: '+25 max health for one run', cost: 40, icon: 'vital', stats: { maxHp: 25 } },
    flares: { name: 'Flare Bundle', per: '+15% area and a wider light for one run', cost: 60, icon: 'glow', stats: { area: 0.15 } },
    ammo: { name: 'Ammo Crate', per: 'Starting weapon begins one level higher', cost: 80, icon: 'might', startLvl: 1 },
    medkit: { name: "Surgeon's Kit", per: 'Get back up once in the run', cost: 120, icon: 'heal', revive: 1 }
  };

  /* fold talents, equipped gear and the chosen supply into what the run starts with */
  P.applyBuild = function (s, bonus) {
    var st = bonus.stats = {}, slot, it, sup = s.supSel && s.sup[s.supSel] > 0 ? P.SUPPLIES[s.supSel] : null, k;
    function add(key, v) { st[key] = (st[key] || 0) + v; }
    P.TALENTS.forEach(function (t) { if (s.tal[t.id]) add(t.stat, t.add * s.tal[t.id]); });
    for (slot in P.SLOTS) { it = s.eq[slot] && P.item(s, s.eq[slot]); if (it) P.itemStats(it).forEach(function (a) { add(a[0], a[1]); }); }
    if (sup) { for (k in sup.stats) add(k, sup.stats[k]); bonus.startLvl += sup.startLvl || 0; bonus.revive = sup.revive || 0; }
  };
  P.useSupply = function (s) { if (s.supSel && s.sup[s.supSel] > 0) { s.sup[s.supSel]--; if (!s.sup[s.supSel]) s.supSel = null; } };
  P.rollLoot = function (s, g, out) {
    var list = [], i;
    out.items = []; out.supply = null;
    for (i = 0; i < g.gear.length; i++) list.push(g.gear[i]);
    if (g.t >= 120) list.push(0);
    if (g.won) list.push(2);
    list.forEach(function (q) { var it = P.makeItem(s, q, g.night), paid = P.addItem(s, it); out.items.push({ it: it, paid: paid }); });
    if (g.t >= 120 && Math.random() < 0.3) { var id = pick(Object.keys(P.SUPPLIES)); s.sup[id] = (s.sup[id] || 0) + 1; out.supply = P.SUPPLIES[id]; }
  };
})(typeof window !== 'undefined' ? window : this);
