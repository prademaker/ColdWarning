// Cold War 2: 2030 — campaign: Operation Northwind.
// Each mission is data (map, teams, briefing) plus a small script: setup() places the forces,
// tick() runs triggers, and objectives decide victory and defeat. Objective checks and timed
// events live in the mission's objectives and events tables, looked up by id when they run, so
// a saved game (save.js) can carry them without storing functions; script state goes in M.vars. Mission is the runtime the
// scripts talk to; it knows nothing about the screen (ui.js and render.js read its state).
'use strict';

// who talks over the radio, and in which colour
const CAST = {
  hale: { name: 'Col. Mara Hale', role: 'Allied JTF Northwind', color: '#9cc6ff' },
  raven: { name: 'Raven', role: 'Commando', color: '#ffd27a' },
  harker: { name: 'Maj. Ellen Harker', role: '22 SAS', color: '#c8d0ff' },
  lund: { name: 'Brig. Anders Lund', role: 'EU Northern Brigade', color: '#b8c8ff' },
  okabe: { name: 'Col. Ren Okabe', role: 'JGSDF Northern Army', color: '#a3d6f7' },
  volkov: { name: 'Gen. Arkady Volkov', role: 'Soviet Union', color: '#ff8a80' },
  pak: { name: 'Gen. Pak Chol-su', role: "Korean People's Army", color: '#f59a95' },
  zhao: { name: 'Gen. Zhao Lin', role: 'PLA Northern Theatre', color: '#ffb199' },
};

// minutes on the silo clock in Countdown, by difficulty
const SILO_MINUTES = { easy: 20, normal: 16, hard: 13 };

// The story runs through every country: the Allies (USA, EU, UK, Japan) against the Axis
// (Soviet Union, Russia, North Korea, China), and each mission shows off a few countries'
// signature units and edge structures.
const CAMPAIGN = {
  name: 'Operation Northwind',
  missions: [
    // ------------------------------------------------------------------ 1
    {
      id: 'thin_ice', title: 'Thin Ice', place: 'Svalbard approaches', date: 'February 2030',
      theater: 'arctic', map: 'small', seed: 30211, starts: 2, radar: true,
      teams: [
        { faction: 'uk', ally: 0, credits: 0, noBase: true },
        { faction: 'soviet', ally: 1, ai: null, noBase: true, name: 'Soviet listening post' },
      ],
      features: 'Play the United Kingdom. Raven and an SAS Operative stay hidden until they open fire, and both plant C4.',
      briefing: [
        "The Axis is real. Moscow, Beijing and Pyongyang have signed the Polar Pact with General Arkady Volkov, who declared the Soviet Union reborn and took the Arctic garrisons that answered to him. Since then Allied supply convoys have been ambushed with uncanny precision.",
        'Satellites found the reason: a listening post on the ice shelf, feeding Volkov radar tracks of every ship we move. A battalion would start the war we are trying to prevent, so London is lending us Raven and a team from 22 SAS.',
        "Slip past the patrols, put C4 on the Radar Station and get Raven to the extraction point. The post's Propaganda Tower makes nearby troops fire faster, and it runs off the same power plants as the rail turret.",
      ],
      goals: ['Destroy the Radar Station', 'Get Raven to the extraction point', 'Raven must survive'],
      win: 'The listening post is dark. The convoy ambushes stop overnight, and Raven is home before the storm.',
      setup(M) {
        const [px, py] = M.start(0), [ex, ey] = M.start(1), c = M.centre();
        M.focusOn(px, py);
        M.hero(0, px, py);
        M.spawn('sas', 0, px + 1, py - 1);
        M.spawn('rifle', 0, px + 2, py + 1, 3);
        M.spawn('sniper', 0, px - 1, py + 2);
        // the outpost: radar at the heart, guns facing the shelf, the rail turret's power plants
        // round the back where a careful commando can reach them
        const [ix, iy] = M.rel(1, 1, 0);
        M.vars.radar = M.build(1, 'radar', ix, iy);
        M.vars.power = [M.build(1, 'power', ...M.rel(1, -4, 4)), M.build(1, 'power', ...M.rel(1, -4, -4))];
        M.build(1, 'barracks', ...M.rel(1, -5, 0));
        M.build(1, 'propaganda', ...M.rel(1, 3, 2));
        M.defenses(1, ['turret', 'railturret'], 5);
        M.squad('rifle', 1, ...M.rel(1, 7, 0), 3);
        M.squad('rifle', 1, ...M.rel(1, 3, 3), 2);
        M.squad('rifle', 1, ...M.rel(1, 3, -3), 2);
        M.squad('rifle', 1, ...M.rel(1, -2, 6), 1);
        M.squad('rifle', 1, ...M.rel(1, -2, -6), 1);
        // a patrol walks between the outpost and the village; civilians nearest the post are held
        M.vars.patrol = [...M.spawn('rifle', 1, ...M.toward([ex, ey], c, 12), 3), ...M.spawn('shock', 1, ...M.toward([ex, ey], c, 13))];
        M.vars.route = [M.toward([ex, ey], c, 12), M.toward(c, [px, py], 4)];
        for (const b of M.civNear(ex, ey).slice(0, 2)) M.garrison(b, 1, 'rifle', 2);
        M.vars.lz = M.freeCorner([px, py], [ex, ey]);
        M.objective('radar', 'Destroy the Radar Station');
        M.objective('power', 'Knock out both Power Plants', { optional: true });
        M.survive();
        M.say('hale', "Raven, you're on the ice. The listening post is on the far side of the shelf. The Radar Station is the target.", 1);
        M.say('raven', 'Copy. Nobody sees me until I want them to.');
        M.say('harker', "Your SAS lad is the same, Raven. Either of you can plant C4: right-click a structure.");
        M.say('hale', 'Their rail turret and that Propaganda Tower both run on power. Take out the power plants and they go dark.');
      },
      objectives: {
        radar: {
          check: M => M.vars.radar.dead,
          done(M) {
            M.say('hale', "Radar's down! Volkov is blind. Get to the extraction point, Raven.");
            M.say('volkov', 'An Allied ghost on my ice? Find her. Bring me that beret.');
            M.marker('lz', ...M.vars.lz, 'EXTRACTION');
            M.objective('lz', 'Get Raven to the extraction point');
            // a reaction force drives out of the village to cut off the extraction
            const [hx, hy] = M.rel(1, 14, 0);
            const hunters = [...M.spawn('rifle', 1, hx, hy, 4), ...M.spawn('shock', 1, hx + 1, hy, 2), ...M.spawn('flak', 1, hx - 1, hy + 1)];
            G.commandMove(hunters, ...M.vars.lz, true, true);
          },
        },
        lz: { check: M => M.heroNear(...M.vars.lz, 2.5) },
        power: { check: M => M.vars.power.every(b => b.dead), done: M => M.say('harker', 'Lights out. Their tower has gone quiet too.') },
      },
      tick(M) {
        // the patrol walks its beat
        const p = M.alive(M.vars.patrol);
        if (p.length && p.every(u => !u.order && !u.target)) {
          M.vars.leg = 1 - (M.vars.leg || 0);
          G.commandMove(p, ...M.vars.route[M.vars.leg], true, true);
        }
      },
      onDamage(M, target, attacker) {
        if (target.team !== 1 || attacker.team !== 0) return;
        if (!M.vars.spotted) { M.vars.spotted = true; M.say('raven', "They've spotted us. Keep moving!"); }
        M.alarm(1, target, attacker, 10);
      },
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'holdfast', title: 'Holdfast', place: 'Finnmark, Norway', date: 'April 2030',
      theater: 'temperate', map: 'medium', seed: 41877, starts: 4,
      teams: [
        { faction: 'eu', ally: 0, credits: 9000 },
        { faction: 'soviet', ally: 1, waves: true, name: '3rd Guards Army' },
      ],
      waves: { team: 1, total: 8, first: 240, interval: 80 },
      features: 'Base building and defense as the EU: Laser Towers, an Aegis Shield Carrier, garrisoned houses and a Kirov to finish.',
      briefing: [
        "Volkov has stopped hiding. His 3rd Guards Army is rolling west along the coast road, and the town of Vardholm stands in the way.",
        "Brigadier Anders Lund's EU Northern Brigade has one MCV, a few platoons and an Aegis Shield Carrier to stop them. Deploy, dig in and hold until the Allied relief force arrives.",
        "The columns will come from three directions. The town's houses make good strongpoints: put infantry in them. Laser Defense Towers burn down armour and aircraft alike, and anything under the Aegis shield takes less damage.",
      ],
      goals: ['Deploy your base', 'Hold out against all 8 attack waves'],
      win: "Vardholm holds. Volkov's spring offensive stalls on the coast road, and the Allies finally have a front line.",
      lose: 'Vardholm has fallen and the coast road lies open.',
      setup(M) {
        const [px, py] = M.start(0);
        M.focusOn(px, py);
        M.startingForces(0);
        M.spawn('engineer', 0, px + 2, py - 2);
        M.spawn('aegis', 0, px - 2, py + 2);
        M.objective('deploy', 'Deploy the MCV to set up a base');
        M.objective('hold', `Hold out against all ${G.waves.total} attack waves`);
        M.objective('town', 'Garrison two houses in the village', { optional: true });
        M.say('lund', 'Commander, Lund here. Deploy that MCV and get power up. Scouts give us about four minutes.', 1);
        M.say('lund', 'The village toward the crossroads is empty. Riflemen in those houses will hold anything on foot.');
        M.say('lund', "Keep the Aegis with your tanks. Once you have a Radar Station, build Laser Towers. Nothing in Volkov's army likes them.");
      },
      objectives: {
        deploy: { check: () => G.playerTeam.countOf('cc') > 0 },
        hold: { check: () => G.waves.won },
        town: {
          check: () => G.entities.filter(b => b.kind === 'building' && b.def.cat === 'civilian' && b.team === 0).length >= 2,
          done: M => M.say('lund', "Good. They'll have to dig every one of those out of the windows."),
        },
      },
      onWave(M, n, units) {
        if (n === 1) M.say('lund', 'Contact! Columns on the road.');
        if (n === 3) {
          const [x, y] = M.edgeNear(...M.start(0));
          const u = M.hero(0, x, y);
          M.focusOn(u.tx, u.ty);
          M.say('hale', "Northwind to Lund: London is lending you Raven. Try to give her back in one piece.");
          M.say('raven', 'Where do you want me?');
        }
        if (n === 5) M.say('volkov', 'Europe sends a brigade to stop an army. Admirable. Pointless.');
        if (n === G.waves.total) {
          const near = units.length ? units[0] : null;
          const [sx, sy] = near ? [near.tx, near.ty] : M.start(1);
          const k = M.spawn('kirov', 1, sx, sy)[0];
          G.waves.team.stats.built++;
          const cc = M.playerHQ();
          if (cc) G.commandMove([k], cc.tx + 1, cc.ty + 1, true, true);
          M.say('lund', "That's a Kirov! Everything that can shoot up, shoot up!");
        }
      },
      // Raven is on loan here: losing her hurts, but the town can still hold
      onKill(M, e) { if (e.def.hero) M.say('hale', "Raven's hit! Medevac is pulling her out. Hold that town, Lund."); },
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'countdown', title: 'Countdown', place: 'Kola tundra', date: 'July 2030',
      theater: 'steppe', map: 'medium', seed: 55102, starts: 2,
      teams: [
        { faction: 'usa', ally: 0, credits: 10000 },
        { faction: 'russia', ally: 1, ai: -1, credits: 3000, name: 'Russian Expeditionary Force' },
      ],
      features: 'Play the USA against Russia: a race against a Hypersonic Silo, with a Reaper drone, THAAD and an enemy Krasukha jammer. Cut the power to stall the clock, or send an Engineer to steal the silo.',
      briefing: [
        "We hoped Moscow would keep the Polar Pact on paper. It hasn't. A Russian 'expeditionary force' has crossed into Volkov's territory and brought him a gift: a Hypersonic Silo, fuelled and aimed at Northwind headquarters.",
        'Intelligence gives us minutes, not hours. Build up, punch through and destroy the silo, or get an Engineer inside and capture it. A Krasukha jamming station covers the approach: anything near it moves and fires slower.',
        'The launch sequence draws heavy power. If their grid goes down, the countdown stalls. Raven goes in with you, and an MQ-9 Reaper flies cover. Iskander missiles will come for your base: a THAAD Battery shoots them down.',
      ],
      goals: ['Destroy or capture the Hypersonic Silo before it launches', 'Raven must survive'],
      win: "The silo is out of the fight. With Moscow's gift gone, Volkov is left with what he can hold, and we are coming for it.",
      lose: 'The warhead struck Northwind headquarters. Command of the theatre is lost.',
      setup(M) {
        const [px, py] = M.start(0), [ex, ey] = M.start(1);
        M.focusOn(px, py);
        M.startingForces(0);
        M.hero(0, px - 2, py + 2);
        M.spawn('engineer', 0, px + 2, py - 2, 2);
        M.spawn('drone', 0, px, py + 3);
        M.base(1, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power', 'tech', 'super_silo', 'power', 'power']);
        M.defenses(1, ['turret', 'railturret', 'turret', 'railturret', 'sam', 'bunker', 'turret'], 9);
        M.vars.ew = M.build(1, 'krasukha', ...M.rel(1, 6, 0));
        for (const b of G.entities) if (b.key === 'bunker' && b.team === 1) M.garrison(b, 1, 'rifle', 3);
        M.squad('tank', 1, ...M.toward([ex, ey], M.centre(), 7), 3);
        M.squad('rifle', 1, ...M.toward([ex, ey], M.centre(), 5), 4);
        M.squad('iskander', 1, ex + 2, ey + 3, 1);
        M.vars.silo = G.entities.find(b => b.key === 'super_silo' && b.team === 1);
        const mins = SILO_MINUTES[M.opts.difficulty] || SILO_MINUTES.normal;
        M.countdown('Silo launch', mins * 60);
        M.objective('silo', 'Destroy or capture the Hypersonic Silo before it launches');
        M.objective('ew', 'Destroy the Krasukha jamming station', { optional: true });
        M.survive();
        M.say('hale', 'The clock is running, Commander. Every minute counts.', 1);
        M.say('raven', 'That silo eats power. Cut their power plants and the countdown freezes.');
        M.say('hale', 'Russian Iskander launchers are in the area. Get a THAAD Battery up once you have radar, and keep your base spread out.');
        M.say('hale', "Your Reaper marks whatever it hits. Everything else hits that target harder.");
      },
      objectives: {
        silo: {
          check: M => M.vars.silo.dead || M.vars.silo.team === 0,
          done(M) {
            M.clock = null;
            if (M.vars.silo.dead) M.say('hale', 'Silo destroyed! Northwind HQ breathes again.');
            else M.say('hale', 'We own their silo? Volkov is going to hate this.');
          },
        },
        ew: {
          check: M => !M.vars.ew || M.vars.ew.dead || M.vars.ew.team === 0,
          done: M => M.say('raven', 'Jammer is down. My scope just cleared up.'),
        },
      },
      events: { launched: M => M.lose() },
      tick(M, dt) {
        const foe = G.teams[1], silo = M.vars.silo;
        if (!M.clock) return;
        // the silo fires on the mission clock, not the usual charge: keep the AI's own timer idle
        foe.superTimer = 0; foe.superReady = false;
        const stalled = foe.lowPower && !silo.dead && silo.team === 1;
        M.clock.paused = stalled;
        if (stalled) {
          M.clock.end += dt;
          if (!M.vars.stallSaid) { M.vars.stallSaid = true; M.say('raven', 'Their grid is down. The countdown has stalled!'); }
        }
        const left = M.clock.end - G.time;
        for (const [t, line] of [[300, 'Five minutes to launch.'], [120, 'Two minutes! Get to that silo!'], [60, 'Sixty seconds!']]) {
          if (left <= t && !M.vars['warn' + t]) { M.vars['warn' + t] = true; M.say('hale', line); }
        }
        if (left <= 0) {
          M.clock = null;
          const hq = M.playerHQ() || G.entities.find(e => e.team === 0 && !e.dead);
          M.say('volkov', 'Launch.');
          if (hq) { foe.superReady = true; G.fireSuper(1, hq.x, hq.y); }
          M.doomed = true;
          M.after(5, 'launched');
        }
      },
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'iron_rain', title: 'Iron Rain', place: 'Wakkanai, Hokkaido', date: 'September 2030',
      theater: 'temperate', map: 'medium', seed: 63419, starts: 2,
      teams: [
        { faction: 'japan', ally: 0, credits: 10000 },
        { faction: 'northkorea', ally: 1, ai: -1, credits: 3000, name: 'KPA Northern Landing Corps' },
      ],
      features: 'Play Japan: Raijin EMP Walkers and the Robotics Plant against North Korean Koksan guns and Demolition Trucks.',
      briefing: [
        'The Axis has opened a second front. While the Allies fight for the Kola Peninsula, a North Korean landing corps has come ashore at the northern tip of Hokkaido and dug in a line of Koksan guns that can shell anything within fifteen tiles.',
        "Colonel Ren Okabe of the Japan Ground Self-Defense Force has an MCV, a few platoons and two Raijin EMP Walkers. Their bolts shut down vehicles and gun emplacements for a few seconds, long enough for your tanks to close in.",
        "Pyongyang loves its Demolition Trucks. Kill them before they reach your base, and not next to anything you want to keep: they go off when destroyed. A Robotics Plant builds your vehicles and aircraft 50% faster.",
      ],
      goals: ['Silence the Koksan gun line', 'Destroy the KPA landing base'],
      win: "The guns on the cape fall silent and the landing corps surrenders on the beach. Japan holds the north, and Pyongyang's second front collapses before it opened.",
      lose: 'Wakkanai is burning and the landing corps is moving inland.',
      setup(M) {
        const [px, py] = M.start(0), [ex, ey] = M.start(1);
        M.focusOn(px, py);
        M.startingForces(0);
        M.spawn('raijin', 0, px - 2, py + 2, 2);
        M.base(1, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power']);
        M.defenses(1, ['bunker', 'turret', 'sam', 'turret', 'bunker'], 8);
        for (const b of G.entities) if (b.key === 'bunker' && b.team === 1) M.garrison(b, 1, 'rifle', 3);
        // the gun line, dug in well forward of the base where it covers the middle of the map
        M.vars.guns = [-7, 0, 7].map(s => M.build(1, 'koksan', ...M.rel(1, 14, s))).filter(Boolean);
        M.squad('rifle', 1, ...M.rel(1, 17, 0), 4);
        M.squad('tank', 1, ...M.toward([ex, ey], M.centre(), 10), 2);
        M.squad('flak', 1, ...M.rel(1, 12, 3), 1);
        M.objective('guns', 'Silence the Koksan gun line');
        M.objective('base', 'Destroy the KPA landing base');
        M.objective('robotics', 'Build a Robotics Plant', { optional: true });
        M.say('okabe', 'Commander, Okabe. Deploy and build fast. Those Koksan guns outrange anything we have on the ground.', 1);
        M.say('okabe', 'Walk the Raijins in with your tanks. One EMP bolt and a gun stops firing long enough for us to reach it.');
        M.say('pak', 'Japan will hear our guns all the way to Tokyo.');
        M.after(200, 'trucks');
      },
      objectives: {
        guns: {
          check: M => M.vars.guns.every(b => b.dead || b.team === 0),
          done: M => M.say('okabe', "The gun line is silent! Now push them back into the sea."),
        },
        base: {
          check: () => G.teams[1].defeated,
          done: M => M.say('pak', 'The Corps... will withdraw. For now.'),
        },
        robotics: {
          check: () => G.playerTeam.countOf('robotics') > 0,
          done: M => M.say('okabe', 'Robotics Plant online. Our factory lines will run at full speed now.'),
        },
      },
      events: {
        // a few Demolition Trucks race for the player's base every couple of minutes
        trucks(M) {
          if (G.teams[1].defeated) return;
          const hq = M.playerHQ();
          if (hq) {
            const n = M.vars.truckWave = (M.vars.truckWave || 0) + 1;
            const trucks = M.spawn('demotruck', 1, ...M.rel(1, 4, 0), Math.min(3, 1 + (n >> 1)));
            G.commandMove(trucks, hq.tx, hq.ty, true, true);
            if (n === 1) M.say('okabe', 'Demolition Trucks coming in fast! Stop them short of the base!');
          }
          M.after(150, 'trucks');
        },
      },
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'red_storm', title: 'Red Storm', place: 'Polyarny, Kola Bay', date: 'November 2030',
      theater: 'arctic', map: 'large', seed: 77530, starts: 4,
      teams: [
        { faction: 'usa', ally: 0, credits: 12000 },
        { faction: 'eu', ally: 0, ai: 0, name: 'EU Northern Brigade' },
        { faction: 'soviet', ally: 1, ai: -1, credits: 3000, name: "Volkov's Red Guard" },
        { faction: 'china', ally: 1, ai: -1, credits: 2500, name: 'PLA Northern Theatre' },
      ],
      features: 'The final battle: the USA with an EU ally and SAS reinforcements against the Soviet Union, a Kirov fleet and China.',
      briefing: [
        "This ends here. After the silo, Moscow quietly called its expeditionary force home and Beijing took its place: General Zhao Lin's PLA Northern Theatre now guards Volkov's headquarters at Polyarny, under a fleet of Kirov airships.",
        "Our beachhead went up overnight and the EU Northern Brigade lands alongside you. Destroy Volkov's base and drive the Chinese out. Expect Kirovs: build SAM sites and fighters early. Chinese Cyber Warfare Units hack vehicles, so escort your armour with infantry, and their Support Hub patches up anything parked near it.",
        'Raven has one last job: make sure Volkov has nowhere left to run. London has promised more SAS once the fight starts.',
      ],
      goals: ["Destroy Volkov's base", 'Drive out the PLA Northern Theatre', 'Raven must survive'],
      win: "Polyarny falls at dawn. The restored Union lasted nine months and the Polar Pact did not outlive it. Raven files her last report from Volkov's empty office: 'Area secure. Requesting leave.'",
      setup(M) {
        const [px, py] = M.start(0);
        M.focusOn(px, py);
        // the beachhead went up overnight
        M.base(0, ['cc', 'power', 'refinery', 'barracks', 'power']);
        M.startingForces(0, true);
        M.hero(0, ...M.rel(0, 4, 0));
        M.base(1, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory']);
        // Volkov sits tight behind his defenses at first; the Chinese even longer
        G.ai[2].nextAttack = 420; G.ai[3].nextAttack = 540;
        M.startingForces(1, true);
        M.base(2, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'power', 'airfield', 'tech', 'power', 'refinery', 'propaganda']);
        M.defenses(2, ['turret', 'railturret', 'sam', 'bunker', 'turret', 'railturret', 'sam', 'turret'], 9);
        M.base(3, ['cc', 'power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'hub', 'tech']);
        M.defenses(3, ['turret', 'railturret', 'bunker', 'sam'], 8);
        for (const b of G.entities) if (b.key === 'bunker' && b.team > 1) M.garrison(b, b.team, 'rifle', 3);
        for (const id of [2, 3]) {
          const [sx, sy] = M.start(id);
          M.squad('tank', id, ...M.toward([sx, sy], M.centre(), 7), 3);
          M.squad('rifle', id, ...M.toward([sx, sy], M.centre(), 5), 4);
        }
        M.squad('kirov', 2, ...M.start(2), 1);
        M.squad('hacker', 3, ...M.toward(M.start(3), M.centre(), 6), 2);
        M.objective('volkov', "Destroy Volkov's base");
        M.objective('china', 'Drive out the PLA Northern Theatre');
        M.survive();
        M.say('hale', 'All units, Operation Northwind is go.', 1);
        M.say('lund', 'Northern Brigade landing on your flank. Good hunting, Commander.');
        M.say('volkov', 'You bring Europe to my door? I have an airship for every one of you.');
        M.say('zhao', 'Beijing keeps its promises, Colonel. Polyarny stays with the Pact.');
        M.after(240, 'vanguard');
        M.after(330, 'sas');
      },
      objectives: {
        volkov: {
          check: () => G.teams[2].defeated,
          done: M => { M.say('volkov', 'This is not... the end of the Union.'); M.say('hale', "Volkov's headquarters is rubble!"); },
        },
        china: {
          check: () => G.teams[3].defeated,
          done: M => { M.say('zhao', 'The PLA is withdrawing. This was never our war.'); M.say('hale', 'The Chinese are pulling out!'); },
        },
        kirov: { check: M => M.vars.vanguard.every(u => u.dead) },
      },
      events: {
        vanguard(M) {
          if (G.teams[2].defeated) return;
          const [sx, sy] = M.start(2), hq = M.playerHQ();
          M.vars.vanguard = M.spawn('kirov', 2, sx, sy, 2);
          if (hq) G.commandMove(M.vars.vanguard, hq.tx + 1, hq.ty + 1, true, true);
          M.say('hale', 'Kirov vanguard inbound! Get your anti-air up!');
          M.objective('kirov', 'Shoot down the Kirov vanguard', { optional: true });
        },
        // the promised SAS team drops in at the map edge nearest the player
        sas(M) {
          const [x, y] = M.edgeNear(...M.start(0));
          M.spawn('sas', 0, x, y, 3);
          M.focusOn(x, y);
          M.say('harker', 'Harker here, three of mine on the ground. Point them at a structure and stand back.');
        },
      },
    },
  ],
};

function missionDef(id) { return CAMPAIGN.missions.find(m => m.id === id) || null; }

// Which missions are done, kept in this browser. Storage can be missing or blocked, so every
// access is guarded and the campaign still plays (just without remembering) when it fails.
const CampaignProgress = {
  key: 'cw2030.campaign',
  load() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { return {}; } },
  save(p) { try { localStorage.setItem(this.key, JSON.stringify(p)); } catch (e) { /* not remembered */ } },
  record(id) { return (this.load().done || {})[id] || null; },
  // a mission opens once the one before it is won ('?unlock' in the URL opens them all); one
  // already won stays open even if a mission is added before it
  unlocked(i) {
    if (i === 0 || /[?&]unlock\b/.test(location.search)) return true;
    return !!this.record(CAMPAIGN.missions[i - 1].id) || !!this.record(CAMPAIGN.missions[i].id);
  },
  complete(id, time, difficulty) {
    const p = this.load();
    p.done = p.done || {};
    const prev = p.done[id];
    if (!prev || time < prev.time) p.done[id] = { time: Math.round(time), difficulty };
    this.save(p);
  },
};

class Mission {
  constructor(def, opts) {
    this.def = def; this.opts = opts;
    this.objectives = [];
    this.markers = [];
    this.radio = [];       // queued transmissions: { who, text, wait }
    this.current = null;   // the one on screen: { who, text, t, life }
    this.timers = [];
    this.vars = {};
    this.clock = null;     // mission countdown: { label, end, paused }
    this.heroes = [];
    this.focus = null;
    this.doomed = false;
  }

  // ---------- setup helpers ----------
  start(i) { return G.map.starts[i]; }
  centre() { return [G.map.w >> 1, G.map.h >> 1]; }
  // where the camera opens; later calls flag the spot as the latest alert (Space jumps there)
  focusOn(tx, ty) {
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    if (!this.focus) this.focus = [x, y]; else G.ping(x, y, 'info');
  }

  // the tile d tiles from a toward b
  toward(a, b, d) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [Math.round(a[0] + (b[0] - a[0]) / len * d), Math.round(a[1] + (b[1] - a[1]) / len * d)];
  }

  // a tile in a team's frame: along tiles toward the map centre (negative = behind), side tiles across
  rel(team, along, side) {
    const [sx, sy] = this.start(team), [cx, cy] = this.centre();
    const len = Math.hypot(cx - sx, cy - sy) || 1, dx = (cx - sx) / len, dy = (cy - sy) / len;
    return [Math.round(sx + dx * along - dy * side), Math.round(sy + dy * along + dx * side)];
  }

  // n units on free tiles around (tx, ty)
  spawn(key, team, tx, ty, n = 1) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, r = i ? 1 + Math.sqrt(i) : 0;
      const s = G.findFreeTile(Math.round(tx + Math.cos(a) * r), Math.round(ty + Math.sin(a) * r)) || [tx, ty];
      out.push(G.spawnUnit(key, team, s[0] * TILE + TILE / 2, s[1] * TILE + TILE / 2));
    }
    return out;
  }

  // a group that holds its ground (riflemen dig in)
  squad(key, team, tx, ty, n = 1) {
    const us = this.spawn(key, team, tx, ty, n);
    for (const u of us) if (u.def.dig) u.dug = true;
    return us;
  }

  hero(team, tx, ty) {
    const u = this.spawn('commando', team, tx, ty)[0];
    u.rank = 1;
    this.heroes.push(u);
    return u;
  }

  // what a skirmish player starts with
  startingForces(team, deploy) {
    const [sx, sy] = this.start(team), f = G.teams[team].faction;
    if (!deploy) this.spawn('mcv', team, sx, sy)[0].facing = 0;
    ['rifle', 'rifle', 'rifle', 'rocket', sideKey('ifv', f), 'tank'].forEach((k, j) => {
      const a = j / 6 * Math.PI * 2;
      this.spawn(k, team, sx + Math.round(Math.cos(a) * 4), sy + Math.round(Math.sin(a) * 4));
    });
  }

  // Place a finished structure as close to (tx, ty) as fits, keeping a one-tile walkway round it
  // and off the ore so harvesters still have fields.
  build(team, key, tx, ty, near) {
    const def = BUILDINGS[key], m = G.map;
    const fits = (x0, y0) => {
      if (x0 < 2 || y0 < 2 || x0 + def.w > m.w - 2 || y0 + def.h > m.h - 2) return false;
      for (let y = y0 - 1; y <= y0 + def.h; y++) for (let x = x0 - 1; x <= x0 + def.w; x++) {
        const i = m.idx(x, y);
        if (m.bld[i] >= 0 || !m.terrainPassable(x, y)) return false;
        if (m.ore[i] > 0 && x >= x0 && x < x0 + def.w && y >= y0 && y < y0 + def.h) return false;
      }
      return true;
    };
    for (let r = 0; r < 14; r++) {
      let best = null, bd = 1e9;
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || !fits(x, y)) continue;
        const d = near ? Math.hypot(x - near[0], y - near[1]) : Math.hypot(x - tx, y - ty);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) {
        const b = G.placeBuilding(key, team, best[0], best[1]);
        b.built = 1;
        return b;
      }
    }
    return null;
  }

  // a compact base around a team's start, Command Center first
  base(team, keys) {
    const [sx, sy] = this.start(team);
    for (const key of keys) {
      const def = BUILDINGS[key];
      this.build(team, key, sx - (def.w >> 1), sy - (def.h >> 1), [sx - (def.w >> 1), sy - (def.h >> 1)]);
    }
  }

  // defenses in an arc dist tiles out, facing the map centre
  defenses(team, keys, dist) {
    const [sx, sy] = this.start(team), [cx, cy] = this.centre();
    const a0 = Math.atan2(cy - sy, cx - sx);
    keys.forEach((key, i) => {
      const a = a0 + (i - (keys.length - 1) / 2) * Math.min(0.4, 2.2 / keys.length);
      this.build(team, key, Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist));
    });
  }

  // fill a structure with soldiers
  garrison(b, team, key, n) {
    for (const u of this.spawn(key, team, b.tx, b.ty + b.h, n)) if (G.canGarrison(u, b)) G.enterGarrison(u, b);
  }

  civNear(tx, ty) {
    return G.entities.filter(b => b.kind === 'building' && b.def.cat === 'civilian')
      .sort((a, b) => Math.hypot(a.tx - tx, a.ty - ty) - Math.hypot(b.tx - tx, b.ty - ty));
  }

  // a map corner nobody starts in that the player can walk to, preferring one far from danger
  freeCorner(from, avoid) {
    const N = G.map.w, k = 6;
    const corners = [[k, k], [N - 1 - k, k], [k, N - 1 - k], [N - 1 - k, N - 1 - k]]
      .filter(c => !G.map.starts.some(s => Math.hypot(s[0] - c[0], s[1] - c[1]) < 10))
      .map(c => G.findFreeTile(c[0], c[1]))
      .filter(c => c && G.map.reachable(from, c))
      .sort((a, b) => Math.hypot(b[0] - avoid[0], b[1] - avoid[1]) - Math.hypot(a[0] - avoid[0], a[1] - avoid[1]));
    return corners[0] || from;
  }

  // the closest open tile on the map edge, where reinforcements drive in
  edgeNear(tx, ty) {
    const N = G.map.w, e = 2;
    const opts = [[e, ty], [N - 1 - e, ty], [tx, e], [tx, N - 1 - e]];
    opts.sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty));
    for (const [x, y] of opts) { const s = G.findFreeTile(x, y); if (s && G.map.reachable(s, [tx, ty])) return s; }
    return [tx, ty];
  }

  // ---------- script helpers ----------
  alive(list) { return (list || []).filter(u => !u.dead || u.inside); }
  heroAlive() { return this.heroes.every(u => !u.dead || u.inside); }
  heroNear(tx, ty, r) { return this.heroes.some(u => !u.dead && Math.hypot(u.x / TILE - tx - 0.5, u.y / TILE - ty - 0.5) < r); }
  playerHQ() {
    return G.entities.find(e => e.team === G.player && !e.dead && e.key === 'cc') ||
      G.entities.find(e => e.team === G.player && !e.dead && e.kind === 'building');
  }

  // idle soldiers near a disturbance go and deal with it (sentries dug in stay at their posts)
  alarm(team, at, attacker, radius) {
    if (G.time - (this.vars.alarmT || -99) < 4) return;
    this.vars.alarmT = G.time;
    const near = G.entities.filter(u => u.kind === 'unit' && u.team === team && !u.dead && !u.order && !u.target && !u.dug &&
      Math.hypot(u.x - at.x, u.y - at.y) < radius * TILE);
    if (near.length) G.commandMove(near, attacker.tx, attacker.ty, true, true);
  }

  // run the mission's events[name] after sec seconds
  after(sec, name) { this.timers.push({ t: G.time + sec, name }); }
  countdown(label, sec) { this.clock = { label, end: G.time + sec, paused: false }; }
  marker(id, tx, ty, label) { this.markers = this.markers.filter(m => m.id !== id); this.markers.push({ id, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, label }); }
  unmark(id) { this.markers = this.markers.filter(m => m.id !== id); }

  // radio transmission; wait = seconds of silence before it (queued after any still playing)
  say(who, text, wait = 0.6) { this.radio.push({ who, text, wait }); }

  // ---------- objectives ----------
  // The mission's objectives[id] gives check(M) -> true when achieved and done(M), run once then.
  // Optional ones don't block victory.
  objective(id, text, opts = {}) {
    this.objectives.push({ id, text, state: 'active', optional: !!opts.optional, survive: !!opts.survive });
    if (G.time > 1) G.eva(opts.optional ? 'Bonus objective' : 'New objective', G.player);
  }

  survive() {
    if (this.objectives.some(o => o.id === 'raven')) return;
    this.objective('raven', 'Raven must survive', { survive: true });
  }

  win() { if (!G.over) this.end(true, this.def.win); }
  lose(text) { if (!G.over) this.end(false, text || this.def.lose || 'Our forces have been wiped out. Command has been lost.'); }

  end(win, text) {
    G.over = { win, time: G.time, text };
    for (const o of this.objectives) {
      if (o.state !== 'active') continue;
      if (win && o.survive) o.state = 'done';
      else if (!win && !o.optional && !o.survive) o.state = 'failed';
    }
    G.eva(win ? 'Mission accomplished' : 'Mission failed', G.player);
    if (win) CampaignProgress.complete(this.def.id, G.time, this.opts.difficulty);
  }

  // called with every victory check (twice a second)
  check() {
    if (G.over) return;
    // (a doomed mission is already lost and only playing out its ending)
    if (G.playerTeam.defeated) { this.lose(this.doomed ? null : 'Our forces have been wiped out. Command has been lost.'); return; }
    const vip = this.objectives.find(o => o.id === 'raven');
    if (vip && !this.heroAlive()) {
      vip.state = 'failed';
      this.lose('Raven is down. ' + (this.def.heroLost || 'Without her, the operation falls apart.'));
      return;
    }
    for (const o of [...this.objectives]) {
      const h = (this.def.objectives || {})[o.id];
      if (o.state !== 'active' || !h || !h.check(this)) continue;
      o.state = 'done';
      G.eva(o.optional ? 'Bonus objective complete' : 'Objective complete', G.player);
      if (h.done) h.done(this);
    }
    const left = this.objectives.filter(o => !o.optional && !o.survive && o.state !== 'done');
    if (!left.length && this.objectives.length) this.win();
  }

  // ---------- runtime ----------
  setup() {
    this.def.setup(this);
    // the starting setup isn't anyone's achievement
    for (const t of G.teams) {
      t.stats = blankStats();
      t.recount();
    }
  }

  update(dt) {
    for (const tm of this.timers) if (!tm.fired && G.time >= tm.t) { tm.fired = true; this.def.events[tm.name](this); }
    this.timers = this.timers.filter(tm => !tm.fired);
    if (this.def.tick) this.def.tick(this, dt);
    // radio: one transmission at a time, long enough to read
    if (this.current && G.time - this.current.t > this.current.life) this.current = null;
    if (!this.current && this.radio.length) {
      const r = this.radio[0];
      r.wait -= dt;
      if (r.wait <= 0) {
        this.radio.shift();
        this.current = { who: r.who, text: r.text, t: G.time, life: Math.max(4.5, r.text.length / 13) };
        G.sound('radio');
      }
    }
  }

  onDamage(target, attacker) { if (this.def.onDamage) this.def.onDamage(this, target, attacker); }
  onKill(e, attacker) { if (this.def.onKill) this.def.onKill(this, e, attacker); }
  onWave(n, units, entries) { if (this.def.onWave) this.def.onWave(this, n, units, entries); }
}
