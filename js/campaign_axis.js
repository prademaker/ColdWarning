// Cold War 2: 2030 — the second campaign, Operation Polar Dawn: the same war played from the
// Axis side, where the Polar Pact holds. Missions follow the same shape as campaign.js (data,
// setup, named objectives and events, script state in M.vars) and run on the same Mission runtime.
'use strict';

// minutes the silo has to stay standing in Zero Hour, by difficulty (longer is harder)
const LAUNCH_MINUTES = { recruit: 9, easy: 11, normal: 13, hard: 15 };

// the Allied commando as an enemy: hidden like the player's hero, and not counted as one
function enemyRaven(M, team, tx, ty) {
  const r = M.spawn('commando', team, tx, ty)[0];
  r.rank = 1;
  return r;
}

// the closest structure of the player's that Raven would want to blow up
function ravenTarget(r, keys) {
  let best = null, bd = 1e9;
  for (const b of G.entities) {
    if (b.kind !== 'building' || b.dead || b.team !== G.player || (keys && !keys.includes(b.key)) || G.charges.some(c => c.b === b)) continue;
    const d = Math.hypot(b.x - r.x, b.y - r.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// keep her busy: once a charge is down she picks the next target
function ravenRaid(M, keys) {
  const r = M.vars.raven;
  if (!r || r.dead || r.order) return;
  const b = ravenTarget(r, keys) || ravenTarget(r, null);
  if (b) G.commandDemolish(r, b);
}

const AXIS_CAMPAIGN = {
  id: 'axis', name: 'Operation Polar Dawn', side: 'axis', hero: 'Sokol',
  sub: 'Campaign · the Polar Pact takes the High North · 2030',
  missions: [
    // ------------------------------------------------------------------ 1
    {
      id: 'first_light', title: 'First Light', place: 'Hopen Island, Svalbard', date: 'February 2030',
      theater: 'arctic', map: 'small', seed: 30877, starts: 2, radar: true,
      teams: [
        { faction: 'soviet', ally: 0, credits: 0, noBase: true },
        { faction: 'uk', ally: 1, ai: null, noBase: true, name: 'Allied listening station' },
      ],
      features: 'Play the Soviet Union. Captain Sokol stays hidden until she opens fire and plants C4, but while the British GCHQ post has power it sees every one of your soldiers.',
      briefing: [
        "The Polar Pact is three weeks old. General Arkady Volkov has declared the Soviet Union reborn, and Moscow, Beijing and Pyongyang have signed on. The Allies answered by sailing a convoy fleet into the Barents Sea.",
        "Every one of our submarines out there is being tracked. The source is a British GCHQ listening post on Hopen Island, feeding the convoys our positions. Volkov wants it gone before the fleet arrives, quietly, and he is sending his best: Captain Katya Sokolova, callsign Sokol.",
        "While the post has power it sees everything we move and sends patrols straight at us. Its power plants stand apart from the main compound. Cut them and the British go blind, then put C4 on the GCHQ and get Sokol to the extraction point.",
      ],
      goals: ['Destroy the GCHQ Listening Post', 'Get Sokol to the extraction point', 'Sokol must survive'],
      win: "Hopen Island goes dark. The Allied convoys sail on blind, and our submarines slip in behind them. Volkov sends Sokol a single word: 'Good.'",
      setup(M) {
        const [px, py] = M.start(0), [ex, ey] = M.start(1);
        M.focusOn(px, py);
        M.hero(0, px, py);
        M.spawn('shock', 0, px + 1, py - 1, 2);
        M.spawn('rifle', 0, px + 2, py + 1, 3);
        // the compound: the GCHQ in the middle, guns facing the ice, a barracks at the back
        M.vars.gchq = M.build(1, 'gchq', ...M.rel(1, 1, 0));
        M.build(1, 'barracks', ...M.rel(1, -5, 0));
        M.defenses(1, ['turret', 'railturret'], 5);
        // the power station sits off to one side with a single gun and a couple of sentries
        M.vars.power = [M.build(1, 'power', ...M.rel(1, 11, 14)), M.build(1, 'power', ...M.rel(1, 8, 16))].filter(Boolean);
        M.build(1, 'turret', ...M.rel(1, 12, 12));
        M.squad('rifle', 1, ...M.rel(1, 10, 13), 2);
        M.squad('rifle', 1, ...M.rel(1, 7, 0), 3);
        M.squad('rifle', 1, ...M.rel(1, 3, 3), 1);
        M.squad('rifle', 1, ...M.rel(1, 3, -3), 1);
        // the hunters: when the post has power it sends them wherever Sokol is
        M.vars.hunters = [...M.spawn('rifle', 1, ...M.toward([ex, ey], M.centre(), 9), 2), ...M.spawn('sas', 1, ...M.toward([ex, ey], M.centre(), 10))];
        for (const b of M.civNear(ex, ey).slice(0, 1)) M.garrison(b, 1, 'rifle', 2);
        M.vars.lz = M.freeCorner([px, py], [ex, ey]);
        M.vars.huntT = 110;
        M.objective('gchq', 'Destroy the GCHQ Listening Post');
        M.objective('power', 'Cut the power to the listening post', { optional: true });
        M.survive();
        M.say('volkov', 'Sokol. The British are listening to every one of my submarines. Make them stop.', 1);
        M.say('sokol', 'Understood, General. They will hear nothing more.');
        M.say('volkov', 'While that post has power it will see your squad, and they will come for you. The power plants stand apart from the compound.');
        M.say('sokol', 'Nobody sees me coming until I fire. Right-click a structure with me to plant C4.');
      },
      objectives: {
        gchq: {
          check: M => !M.vars.gchq || M.vars.gchq.dead,
          done(M) {
            M.say('sokol', 'The listening post is rubble. Heading for the pickup.');
            M.say('harker', "Something's hit Hopen Island. Find whoever did it and don't let them off the ice.");
            M.marker('lz', ...M.vars.lz, 'EXTRACTION');
            M.objective('lz', 'Get Sokol to the extraction point');
            const [hx, hy] = M.rel(1, 12, 0);
            const hunters = [...M.spawn('rifle', 1, hx, hy, 4), ...M.spawn('sas', 1, hx + 1, hy, 2)];
            G.commandMove(hunters, ...M.vars.lz, true, true);
          },
        },
        lz: { check: M => M.heroNear(...M.vars.lz, 2.5) },
        power: {
          check: M => M.vars.power.every(b => b.dead),
          done: M => M.say('sokol', 'Their power is out. The post is deaf and blind, and so is their rail gun.'),
        },
      },
      tick(M, dt) {
        const gchq = M.vars.gchq;
        if (!gchq || gchq.dead || G.teams[1].lowPower) return;
        // the post can see everything: every so often its hunters close in on the squad
        M.vars.huntT -= dt;
        if (M.vars.huntT > 0) return;
        M.vars.huntT = 45;
        const prey = M.heroes.find(u => !u.dead) || G.entities.find(u => u.kind === 'unit' && u.team === 0 && !u.dead);
        const h = M.alive(M.vars.hunters).filter(u => !u.dead && !u.order && !u.target);
        if (!prey || !h.length) return;
        G.commandMove(h, prey.tx, prey.ty, true, true);
        if (!M.vars.huntSaid) {
          M.vars.huntSaid = true;
          M.say('sokol', "A British patrol is heading straight for us. That post knows exactly where we are.");
        }
      },
      onDamage(M, target, attacker) {
        if (target.team !== 1 || attacker.team !== 0) return;
        M.alarm(1, target, attacker, 10);
      },
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'red_tide', title: 'Red Tide', place: 'Vardholm, Finnmark', date: 'April 2030',
      theater: 'temperate', map: 'medium', seed: 42611, starts: 2,
      teams: [
        { faction: 'soviet', ally: 0, credits: 9000 },
        { faction: 'eu', ally: 1, ai: -1, credits: 3000, name: 'EU Northern Brigade' },
      ],
      features: 'Base building and assault as the Soviet Union: cheap infantry, Flame Troopers and a Kirov airship against EU Laser Towers, an Aegis Shield Carrier and garrisoned houses.',
      briefing: [
        "With the Allied convoys blind, Volkov's 3rd Guards Army rolls west along the coast road. One town stands in the way: Vardholm, where Brigadier Anders Lund's EU Northern Brigade has dug in.",
        "Lund has Laser Defense Towers on the approaches and an Aegis Shield Carrier that makes everything near it harder to hurt. His infantry have moved into the houses on the edge of town.",
        "Deploy, build up and break the brigade. Soviet infantry is cheap: use it. Flame Troopers burn soldiers out of buildings. Volkov has promised a Kirov airship once you have proved the road can be taken.",
      ],
      goals: ['Deploy your base', 'Destroy the EU Northern Brigade'],
      win: "Vardholm falls in the rain. Lund's brigade pulls back across the border and the coast road belongs to the Pact. Volkov drives through the town square himself.",
      lose: 'The 3rd Guards Army is broken on the coast road. Vardholm holds.',
      setup(M) {
        const [px, py] = M.start(0), [ex, ey] = M.start(1);
        M.focusOn(px, py);
        M.startingForces(0);
        M.spawn('shock', 0, px + 2, py - 2, 2);
        M.base(1, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power']);
        M.defenses(1, ['turret', 'laser', 'bunker', 'laser', 'turret'], 8);
        for (const b of G.entities) if (b.key === 'bunker' && b.team === 1) M.garrison(b, 1, 'rifle', 3);
        // the houses on the edge of town are full of Lund's infantry
        M.vars.town = M.civNear(ex, ey).filter(b => Math.hypot(b.tx - ex, b.ty - ey) < 22).slice(0, 3);
        for (const b of M.vars.town) M.garrison(b, 1, 'rifle', 2);
        M.squad('aegis', 1, ...M.toward([ex, ey], M.centre(), 7), 1);
        M.squad('tank', 1, ...M.toward([ex, ey], M.centre(), 8), 2);
        M.squad('rifle', 1, ...M.toward([ex, ey], M.centre(), 5), 3);
        // Lund waits for the Allies to come to him, at first
        if (G.ai[1]) G.ai[1].nextAttack = 360;
        M.objective('deploy', 'Deploy the MCV to set up a base');
        M.objective('base', 'Destroy the EU Northern Brigade');
        if (M.vars.town.length) M.objective('town', 'Clear the houses on the edge of Vardholm', { optional: true });
        M.say('volkov', 'Commander, the coast road is yours. Deploy, build, and take Vardholm.', 1);
        M.say('volkov', 'Lund has filled the houses with soldiers. Flame Troopers will burn them out.');
        M.say('lund', 'This is the EU Northern Brigade. You will not pass this town.');
        M.after(420, 'kirov');
      },
      objectives: {
        deploy: { check: () => G.playerTeam.countOf('cc') > 0 },
        base: {
          check: () => G.teams[1].defeated,
          done: M => M.say('lund', 'All units, fall back across the border. Vardholm is lost.'),
        },
        town: {
          check: M => M.vars.town.every(b => b.dead || b.team !== 1),
          done: M => M.say('volkov', 'The houses are ours. Lund is running out of places to hide.'),
        },
      },
      events: {
        // the promised airship arrives at the map edge behind the player's base
        kirov(M) {
          if (G.over || G.teams[1].defeated) return;
          const [x, y] = M.edgeNear(...M.start(0));
          M.spawn('kirov', 0, x, y);
          M.focusOn(x, y);
          M.say('volkov', 'You have earned this. A Kirov is yours, Commander. Point it at Lund.');
          M.say('lund', 'Kirov in the air! Get the lasers on it!');
        },
      },
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'zero_hour', title: 'Zero Hour', place: 'Kola tundra', date: 'July 2030',
      theater: 'steppe', map: 'medium', seed: 56023, starts: 2,
      teams: [
        { faction: 'russia', ally: 0, credits: 7000 },
        { faction: 'usa', ally: 1, ai: -1, credits: 3000, name: 'Allied JTF Northwind' },
      ],
      features: 'Play Russia and defend a Hypersonic Silo until it launches, with Krasukha jammers and Iskander missiles. Raven comes for your power plants: if your power fails, the countdown stalls.',
      briefing: [
        "Moscow has kept its promise to the Pact. General Yuri Orlov's expeditionary force has brought a Hypersonic Silo to the Kola tundra, and the warhead is aimed at the Allied headquarters at Northwind.",
        "The Americans know. Colonel Mara Hale is throwing everything at the silo before it can launch. Hold it until the countdown ends. If it is destroyed or captured, the mission fails.",
        "The launch sequence draws heavy power: if your power runs low, the countdown stalls. Expect Hale to send her commando, Raven, after your power plants. Sokol is with you, and it takes a commando to catch one. A Krasukha EW Station slows everything near it.",
      ],
      goals: ['Keep the Hypersonic Silo standing until it launches', 'Do not let your power fail'],
      win: "The warhead lifts off the tundra at dawn and Northwind headquarters goes off the air. The Allied offensive in the north stops dead, and Orlov's force holds the Kola Peninsula.",
      lose: 'The silo is gone, and with it the Pact’s best chance to end the war in the north.',
      setup(M) {
        const [px, py] = M.start(0), [ex, ey] = M.start(1);
        M.focusOn(px, py);
        M.base(0, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power', 'tech', 'super_silo', 'power', 'power']);
        M.defenses(0, ['turret', 'railturret', 'sam', 'railturret', 'turret'], 9);
        M.vars.silo = G.entities.find(b => b.key === 'super_silo' && b.team === 0);
        M.hero(0, ...M.rel(0, 3, 3));
        M.spawn('tank', 0, ...M.rel(0, 6, 0), 3);
        M.spawn('rifle', 0, ...M.rel(0, 6, -3), 4);
        M.spawn('rocket', 0, ...M.rel(0, 6, 3), 2);
        M.spawn('iskander', 0, ...M.rel(0, -2, 2));
        M.spawn('engineer', 0, ...M.rel(0, 1, -2));
        M.base(1, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power', 'airfield']);
        M.defenses(1, ['turret', 'railturret', 'thaad', 'sam', 'turret'], 8);
        M.squad('tank', 1, ...M.toward([ex, ey], M.centre(), 7), 2);
        M.squad('rifle', 1, ...M.toward([ex, ey], M.centre(), 5), 4);
        if (G.ai[1]) G.ai[1].nextAttack = 240;
        const mins = LAUNCH_MINUTES[M.opts.difficulty] || LAUNCH_MINUTES.normal;
        M.countdown('Silo launch', mins * 60);
        M.objective('launch', 'Keep the Hypersonic Silo standing until it launches');
        M.objective('ghost', 'Stop Raven', { optional: true });
        M.say('orlov', 'Commander, Orlov. The silo is fuelled and the clock is running. Nothing touches it until launch.', 1);
        M.say('orlov', 'The launch sequence eats power. If the grid fails, the countdown stops. Keep it green.');
        M.say('hale', 'All Northwind units: that silo must not launch. Whatever it takes.');
        M.say('sokol', 'If they send Raven, leave her to me.');
        M.after(150, 'strike');
        M.after(300, 'raven');
      },
      objectives: {
        launch: { check: M => M.vars.launched && G.time >= M.vars.launchT + 5 },
        ghost: {
          check: M => M.vars.raven && M.vars.raven.dead,
          done: M => { M.say('hale', "Raven's down! Medevac, get her out of there."); M.say('sokol', 'Not so hard to find after all.'); },
        },
      },
      events: {
        // American strike groups drive for the silo every couple of minutes, bigger each time
        strike(M) {
          if (!M.clock || G.teams[1].defeated) return;
          const n = M.vars.strike = (M.vars.strike || 0) + 1, silo = M.vars.silo;
          const at = M.toward(M.start(1), M.centre(), 6);
          const group = [...M.spawn('tank', 1, ...at, Math.min(1 + n, 5)), ...M.spawn('rifle', 1, ...at, 2), ...M.spawn('ifv', 1, ...at, 1)];
          if (n >= 2) group.push(...M.spawn('heli', 1, ...at, Math.min(3, n >> 1)));
          G.commandMove(group, silo.tx + 1, silo.ty + 1, true, true);
          G.ping(at[0] * TILE + TILE / 2, at[1] * TILE + TILE / 2, 'unit');
          if (n === 1) M.say('orlov', 'American armour on the move. They are heading for the silo.');
          if (n === 3) M.say('hale', 'Hit that silo with everything we have left!');
          M.after(140, 'strike');
        },
        // Raven slips in from the flank and goes for the power plants
        raven(M) {
          if (!M.clock) return;
          const [x, y] = M.edgeNear(...M.rel(0, 0, 12));
          M.vars.raven = enemyRaven(M, 1, x, y);
          ravenRaid(M, ['power']);
          G.ping(x * TILE + TILE / 2, y * TILE + TILE / 2, 'unit');
          M.say('orlov', 'Sensors picked up a single soldier on the flank, then lost her. It is Raven. She is going for the power plants!');
          M.say('sokol', 'She only shows up close. Keep troops by the power plants and I will hunt her.');
        },
      },
      tick(M, dt) {
        const me = G.teams[0], silo = M.vars.silo;
        if (!silo || silo.dead || silo.team !== 0) {
          M.lose(silo && !silo.dead ? 'The Americans have captured the silo. The launch is off.' : 'The silo is destroyed. The launch is off.');
          return;
        }
        ravenRaid(M, ['power']);
        if (!M.clock) return;
        // the silo fires on the mission clock, never on its own charge: its sidebar timer just
        // follows the clock through the last five minutes
        const charge = silo.def.superweapon.charge;
        me.superTimer = Math.max(0, Math.min(charge - 0.5, charge - (M.clock.end - G.time))); me.superReady = false;
        M.clock.paused = me.lowPower;
        if (me.lowPower) {
          M.clock.end += dt;
          if (!M.vars.stallSaid) { M.vars.stallSaid = true; M.say('orlov', 'Power is down! The launch sequence has stalled. Get the grid back up!'); }
        } else M.vars.stallSaid = false;
        const left = M.clock.end - G.time;
        for (const [t, line] of [[300, 'Five minutes to launch.'], [120, 'Two minutes. Hold them off!'], [30, 'Thirty seconds!']]) {
          if (left <= t && !M.vars['warn' + t]) { M.vars['warn' + t] = true; M.say('orlov', line); }
        }
        if (left <= 0) {
          M.clock = null;
          M.vars.launched = true; M.vars.launchT = G.time;
          const hq = G.entities.find(e => e.team === 1 && !e.dead && e.key === 'cc') || G.entities.find(e => e.team === 1 && !e.dead && e.kind === 'building');
          M.say('orlov', 'Launch!');
          if (hq) { me.superReady = true; G.fireSuper(0, hq.x, hq.y); }
        }
      },
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'beachhead', title: 'Beachhead', place: 'Wakkanai, Hokkaido', date: 'September 2030',
      theater: 'temperate', map: 'medium', seed: 64211, starts: 4,
      teams: [
        { faction: 'northkorea', ally: 0, credits: 9000 },
        { faction: 'japan', ally: 1, waves: true, name: 'JGSDF Northern Army' },
      ],
      waves: { team: 1, total: 8, first: 240, interval: 85 },
      features: 'Defend a beachhead as North Korea: dug-in Koksan guns, cheap defenses and Demolition Trucks against Japanese Raijin EMP Walkers.',
      briefing: [
        "While the Allies reel from the loss of Northwind, General Pak Chol-su's landing corps has come ashore at the northern tip of Hokkaido. If the beachhead holds, Japan will have to keep its army at home.",
        "Colonel Ren Okabe is gathering the JGSDF Northern Army to throw us back into the sea. Their columns will come from three directions, and their Raijin EMP Walkers shut down vehicles and guns for a few seconds at a time.",
        "Our defenses cost a quarter less than anyone else's, and a Koksan Gun Emplacement shells anything within fifteen tiles. Dig in, build a gun line and hold until the second wave of landing craft arrives.",
      ],
      goals: ['Deploy your base', 'Hold out against all 8 attack waves'],
      win: "The beachhead holds. Japan keeps its army at home to watch Hokkaido, and the Allies in the north are on their own.",
      lose: 'The landing corps has been pushed back into the sea.',
      setup(M) {
        const [px, py] = M.start(0);
        M.focusOn(px, py);
        M.startingForces(0);
        M.spawn('engineer', 0, px + 2, py - 2);
        M.spawn('demotruck', 0, px - 2, py + 2, 2);
        M.objective('deploy', 'Deploy the MCV to set up a base');
        M.objective('hold', `Hold out against all ${G.waves.total} attack waves`);
        M.objective('guns', 'Build 3 Koksan Gun Emplacements', { optional: true });
        M.say('pak', 'Commander, Pak. Deploy and dig in. Okabe will be here in four minutes.', 1);
        M.say('pak', 'Koksan guns need no power and outrange anything Japan has on the ground. Build a line of them.');
        M.say('pak', 'Demolition Trucks go off when they die. Drive them into the enemy, never park them by your own base.');
      },
      objectives: {
        deploy: { check: () => G.playerTeam.countOf('cc') > 0 },
        hold: { check: () => G.waves.won },
        guns: {
          check: () => G.playerTeam.countOf('koksan') >= 3,
          done: M => M.say('pak', 'The gun line is up. Let them come.'),
        },
      },
      onWave(M, n, units) {
        if (n === 1) M.say('okabe', 'Northern Army, advance. Push them back into the sea.');
        if (n === 3) {
          const [x, y] = M.edgeNear(...M.start(0));
          const u = M.spawn('commando', 0, x, y)[0];
          u.rank = 1;
          M.focusOn(u.tx, u.ty);
          M.say('volkov', 'General Pak, Moscow sends a gift. Sokol is yours until the beachhead holds.');
          M.say('sokol', 'Show me where they are coming from.');
        }
        if (n === 5) M.say('okabe', 'They are dug in deep. Bring up the Raijins.');
        if (n === G.waves.total) {
          const near = units.length ? units[0] : null;
          const [sx, sy] = near ? [near.tx, near.ty] : M.start(1);
          const walkers = M.spawn('raijin', 1, sx, sy, 3);
          G.waves.team.stats.built += walkers.length;
          const cc = M.playerHQ();
          if (cc) G.commandMove(walkers, cc.tx + 1, cc.ty + 1, true, true);
          M.say('pak', 'Raijin walkers! Kill them before they reach the guns!');
        }
      },
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'polar_dawn', title: 'Polar Dawn', place: 'Tromsø, Norway', date: 'November 2030',
      theater: 'arctic', map: 'large', seed: 78123, starts: 4,
      teams: [
        { faction: 'china', ally: 0, credits: 12000 },
        { faction: 'soviet', ally: 0, ai: 0, name: "Volkov's Red Guard" },
        { faction: 'usa', ally: 1, ai: 0, credits: 4000, name: 'Allied JTF Northwind' },
        { faction: 'uk', ally: 1, ai: -1, credits: 3000, name: 'British Joint Force' },
      ],
      features: 'The final battle: China with a Soviet ally and Sokol against the USA and the United Kingdom. Cyber Warfare Units hack vehicles, a Support Hub repairs, and Raven is out there somewhere.',
      briefing: [
        "This ends here. After Northwind headquarters was lost, the Allies regrouped at Tromsø, their last base above the Arctic Circle. If it falls, the High North belongs to the Pact.",
        "General Zhao Lin's PLA Northern Theatre leads the assault, with Volkov's Red Guard landing alongside. Hale's Americans hold one side of the fjord and the British the other, with THAAD batteries against our missiles and a GCHQ post that sees our every move.",
        "Cyber Warfare Units take over enemy vehicles, and a Support Hub patches up anything parked near it. Expect American bombers early: get anti-air up. Sokol goes in with you, and Raven will be waiting for her.",
      ],
      goals: ['Destroy the American base', 'Drive out the British', 'Sokol must survive'],
      win: "Tromsø falls at dawn. The Allies sign a ceasefire in Narvik, and the Polar Pact holds the High North. Sokol files her last report from Hale's empty office: 'Area secure. Requesting leave.'",
      setup(M) {
        const [px, py] = M.start(0);
        M.focusOn(px, py);
        // the landing went up overnight
        M.base(0, ['cc', 'power', 'refinery', 'barracks', 'power']);
        M.startingForces(0, true);
        M.hero(0, ...M.rel(0, 4, 0));
        M.spawn('hacker', 0, ...M.rel(0, 4, 2), 2);
        M.base(1, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory']);
        M.startingForces(1, true);
        // the Allies sit tight behind their defenses at first, the British even longer
        if (G.ai[2]) G.ai[2].nextAttack = 420;
        if (G.ai[3]) G.ai[3].nextAttack = 540;
        M.base(2, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power', 'airfield', 'tech', 'power', 'refinery']);
        M.defenses(2, ['turret', 'railturret', 'sam', 'thaad', 'bunker', 'turret', 'railturret', 'sam'], 9);
        M.base(3, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'gchq', 'tech']);
        M.defenses(3, ['turret', 'railturret', 'bunker', 'sam', 'turret', 'railturret'], 8);
        for (const b of G.entities) if (b.key === 'bunker' && b.team > 1) M.garrison(b, b.team, 'rifle', 3);
        for (const id of [2, 3]) {
          const [sx, sy] = M.start(id);
          M.squad('tank', id, ...M.toward([sx, sy], M.centre(), 7), 3);
          M.squad('rifle', id, ...M.toward([sx, sy], M.centre(), 5), 4);
        }
        M.squad('sas', 3, ...M.toward(M.start(3), M.centre(), 6), 2);
        M.squad('railtank', 2, ...M.toward(M.start(2), M.centre(), 9), 2);
        M.objective('usa', 'Destroy the American base');
        M.objective('uk', 'Drive out the British');
        M.survive();
        M.say('zhao', 'All units, Operation Polar Dawn begins. Tromsø falls today.', 1);
        M.say('volkov', 'The Red Guard is landing on your flank, General. Leave some of them for us.');
        M.say('hale', 'Everyone hold the line. There is nowhere left to fall back to.');
        M.say('harker', "Raven's out there somewhere, Sokol. She has been waiting for you.");
        M.after(240, 'bombers');
        M.after(360, 'raven');
      },
      objectives: {
        usa: {
          check: () => G.teams[2].defeated,
          done: M => { M.say('hale', 'Northwind is gone. All units, fall back to the boats.'); M.say('zhao', 'The Americans are finished!'); },
        },
        uk: {
          check: () => G.teams[3].defeated,
          done: M => { M.say('harker', "That's it for us. Get everyone home."); M.say('zhao', 'The British are pulling out!'); },
        },
        bombers: { check: M => M.vars.bombers.every(u => u.dead) },
        ghost: {
          check: M => M.vars.raven && M.vars.raven.dead,
          done: M => { M.say('sokol', 'Raven is down. It is over, old friend.'); M.say('harker', "We've lost Raven..."); },
        },
      },
      events: {
        // bomber raids on the player's base, the first one a bonus objective, then every five minutes
        bombers(M) {
          if (G.teams[2].defeated) return;
          const n = M.vars.raids = (M.vars.raids || 0) + 1;
          const [x, y] = M.start(2), hq = M.playerHQ();
          const raid = M.spawn('bomber', 2, x, y, Math.min(4, 1 + n));
          if (hq) G.commandMove(raid, hq.tx + 1, hq.ty + 1, true, true);
          if (n === 1) {
            M.vars.bombers = raid;
            M.say('zhao', 'American bombers inbound! Anti-air, now!');
            M.objective('bombers', 'Shoot down the bomber raid', { optional: true });
          } else M.say('zhao', 'Another bomber raid is on the way!');
          M.after(300, 'bombers');
        },
        // Raven slips in from the British side and goes for the player's base
        raven(M) {
          if (G.teams[3].defeated) return;
          const at = M.toward(M.start(3), M.centre(), 8);
          M.vars.raven = enemyRaven(M, 3, ...at);
          ravenRaid(M, ['power', 'refinery', 'factory']);
          M.objective('ghost', 'Eliminate Raven', { optional: true });
          M.say('sokol', 'I know that walk. Raven is coming for our base. She only shows up close: keep troops round the power plants.');
        },
      },
      tick(M) { if (M.vars.raven) ravenRaid(M, ['power', 'refinery', 'factory']); },
    },
  ],
};
