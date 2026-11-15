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
    return { night: s.nightSel, allow: allow, bonus: {
      dmg: (m >= 2 ? 0.03 : 0) + (m >= 4 ? 0.03 : 0) + (m >= 8 ? 0.04 : 0), maxHp: (m >= 3 ? 10 : 0) + (m >= 6 ? 10 : 0) + (m >= 9 ? 10 : 0),
      startLvl: m >= 5 ? 2 : 1, reroll: m >= 7 ? 1 : 0, passive: m >= 10 ? P.SIGNATURE[cls] : null } };
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
    return out;
  };
})(typeof window !== 'undefined' ? window : this);
