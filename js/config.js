// Cold War 2: 2030 — game data: factions, units, structures, damage tables.
'use strict';

const TILE = 32;
const TICK = 1 / 60;

// Each faction has a theme colour, an alternate used when both sides would look alike,
// a vehicle camouflage palette, display names for its line units and a small bonus.
// pkg selects the faction's special tank and superweapon: 'tech' (railgun + Orbital Lance)
// or 'heavy' (Titan + Hypersonic Silo). side puts the country with the Allies or the Axis,
// which decides part of its roster (see SIDES). Every country also has a signature unit with
// a special ability and an edge structure that only it can build.
const FACTIONS = {
  usa: {
    name: 'USA', tagline: 'Technology / Mobility / Air Power', pkg: 'tech', side: 'allies',
    color: '#3d8bff', dark: '#1d4e9e', light: '#9cc6ff',
    alt: { color: '#24b8a4', dark: '#126b5f', light: '#93ecdf' },
    camo: ['#a08f68', '#7a6b4b', '#c2b088'],
    names: { rifle: 'Rifleman', tank: 'M1A3 Abrams', ifv: 'Stryker IFV', mlrs: 'M142 HIMARS', sniper: 'Marine Sniper', heli: 'AH-64E Apache', jet: 'F-35 Lightning II', sam: 'Patriot SAM', patrol: 'Mk VI Patrol Boat', destroyer: 'Arleigh Burke Destroyer', sub: 'Virginia-class Submarine', cruiser: 'Ticonderoga Cruiser', bomber: 'B-21 Raider' },
    bonus: { hp: { air: 1.25 } }, bonusText: 'Aircraft +25% armor', signature: 'drone', edge: 'thaad',
  },
  eu: {
    name: 'EU', tagline: 'Cooperation / Sustainability / Advanced Defense', pkg: 'tech', side: 'allies',
    color: '#4a72ff', dark: '#22379c', light: '#a9bcff',
    alt: { color: '#24b8a4', dark: '#126b5f', light: '#93ecdf' },
    camo: ['#5f6a55', '#454d3e', '#7b8670'],
    names: { rifle: 'Special Forces', tank: 'Leopard 2A7', ifv: 'Boxer IFV', mlrs: 'MARS II', sniper: 'Designated Marksman', heli: 'NH90 TTH', jet: 'Eurofighter Typhoon', sam: 'IRIS-T SLM', patrol: 'Combattante Patrol Boat', destroyer: 'Horizon Frigate', sub: 'Type 212 Submarine', cruiser: 'FREMM Missile Frigate', bomber: 'Tornado IDS' },
    bonus: { hp: { defense: 1.3 }, dmg: { defense: 1.2 } }, bonusText: 'Defenses +30% armor, +20% firepower', signature: 'aegis', edge: 'laser',
  },
  uk: {
    name: 'United Kingdom', tagline: 'Intelligence / Special Forces / Resolve', pkg: 'tech', side: 'allies',
    color: '#5b6ee8', dark: '#2a358c', light: '#b3bcff',
    alt: { color: '#24b8a4', dark: '#126b5f', light: '#93ecdf' },
    camo: ['#8a8466', '#655f48', '#a8a282'],
    names: { rifle: 'Royal Marine', tank: 'Challenger 3', ifv: 'Ajax Recon', mlrs: 'M270A2 MLRS', sniper: 'Royal Marines Sniper', heli: 'Apache AH-64E', jet: 'F-35B Lightning', sam: 'Sky Sabre', patrol: 'River-class Patrol Ship', destroyer: 'Type 45 Destroyer', sub: 'Astute-class Submarine', cruiser: 'Type 26 Frigate', bomber: 'Tempest Strike' },
    bonus: { hp: { infantry: 1.25 } }, bonusText: 'Infantry +25% armor', signature: 'sas', edge: 'gchq',
  },
  japan: {
    name: 'Japan', tagline: 'Precision / Robotics / Self-Defense', pkg: 'tech', side: 'allies',
    color: '#3ea8d8', dark: '#1b5a85', light: '#a3d6f7',
    alt: { color: '#24b8a4', dark: '#126b5f', light: '#93ecdf' },
    camo: ['#5b6b4a', '#3f4c33', '#788a64'],
    names: { rifle: 'JGSDF Infantry', tank: 'Type 10', ifv: 'Type 16 MCV', mlrs: 'Type 19 MLRS', sniper: 'JGSDF Marksman', heli: 'AH-64DJ Apache', jet: 'Mitsubishi F-X', sam: 'Type 03 Chu-SAM', patrol: 'Hayabusa Patrol Boat', destroyer: 'Mogami Frigate', sub: 'Taigei-class Submarine', cruiser: 'Atago Destroyer', bomber: 'F-2B Strike' },
    bonus: { hp: { vehicle: 1.15 } }, bonusText: 'Vehicles +15% armor', signature: 'raijin', edge: 'robotics',
  },
  russia: {
    name: 'Russia', tagline: 'Power / Endurance / Heavy Firepower', pkg: 'heavy', side: 'axis',
    color: '#e8413a', dark: '#8c1f1b', light: '#ff9e98',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#6e7048', '#4f5134', '#8c8d60'],
    names: { rifle: 'Spetsnaz', tank: 'T-14 Armata', flak: 'Pantsir-SM', tos: 'TOS-2 Tosochka', heli: 'Mi-28 Havoc', jet: 'Su-57 Felon', sam: 'S-400 Triumf', patrol: 'Raptor Patrol Boat', destroyer: 'Admiral Gorshkov Frigate', sub: 'Yasen-class Submarine', battleship: 'Pyotr Velikiy', bomber: 'Tu-160M Blackjack' },
    bonus: { dmg: { vehicle: 1.15 } }, bonusText: 'Armor +15% firepower', signature: 'iskander', edge: 'krasukha',
  },
  china: {
    name: 'China', tagline: 'Expansion / Innovation / Discipline', pkg: 'tech', side: 'axis',
    color: '#e5322d', dark: '#86160f', light: '#ff9a92',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#566f48', '#3e5235', '#71895e'],
    names: { rifle: 'PLA Trooper', tank: 'Type 99A', flak: 'PGZ-09 SPAAG', tos: 'PCH-191 Thermobaric', heli: 'Z-10 Attack Helicopter', jet: 'J-20 Mighty Dragon', sam: 'HQ-9 SAM', patrol: 'Type 022 Missile Boat', destroyer: 'Type 055 Destroyer', sub: 'Type 093 Submarine', battleship: 'Type 055B Battlecruiser', bomber: 'H-20 Stealth Bomber' },
    bonus: { speed: { structure: 1.25, defense: 1.25 } }, bonusText: 'Structures build 25% faster', signature: 'hacker', edge: 'hub',
  },
  soviet: {
    name: 'Soviet Union', tagline: 'Tradition / Strength / Revival', pkg: 'heavy', side: 'axis',
    color: '#d92b2b', dark: '#7d1212', light: '#ff9a9a',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#6a6a3e', '#4c4c2c', '#86865a'],
    names: { rifle: 'Motor Rifle', tank: 'T-90M', flak: '2S6 Tunguska', tos: 'TOS-1A Solntsepyok', heli: 'Mi-24 Super Hind', jet: 'Su-57', sam: 'S-400 SAM', patrol: 'Osa Missile Boat', destroyer: 'Sovremenny Destroyer', sub: 'Akula-class Submarine', battleship: 'Orlan Battlecruiser', bomber: 'Tu-22M3 Backfire' },
    bonus: { cost: { infantry: 0.75 } }, bonusText: 'Infantry 25% cheaper', signature: 'kirov', edge: 'propaganda',
  },
  northkorea: {
    name: 'North Korea', tagline: 'Juche / Fortification / Defiance', pkg: 'heavy', side: 'axis',
    color: '#c8302f', dark: '#701616', light: '#f59a95',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#5f6640', '#444a2c', '#7b8358'],
    names: { rifle: 'KPA Rifleman', tank: 'Chonma-20', flak: 'M1992 SPAAG', tos: 'KN-25 Launcher', heli: 'Mi-24 Hind', jet: 'MiG-29 Fulcrum', sam: 'Pongae-5 SAM', patrol: 'Nampo Patrol Boat', destroyer: 'Choe Hyon Destroyer', sub: 'Sinpo Submarine', battleship: 'Juche Battlecruiser', bomber: 'Il-28 Beagle' },
    bonus: { cost: { defense: 0.75 } }, bonusText: 'Defenses 25% cheaper', signature: 'demotruck', edge: 'koksan',
  },
};

function nameOf(key, faction) {
  const f = FACTIONS[faction];
  return (f && f.names[key]) || defOf(key).name;
}

// map theaters; each previews with artwork cut from the style mock
const THEATERS = {
  temperate: { name: 'Temperate', art: 'forest' },
  desert: { name: 'Desert', art: 'desert' },
  arctic: { name: 'Arctic', art: 'snow' },
  steppe: { name: 'Steppe', art: 'steppe' },
  jungle: { name: 'Jungle', art: 'jungle' },
};

// Damage multipliers: warhead vs armor class. 'ship' is the armor of warships; torpedoes only
// hurt what floats (the hovercraft rides on light armor).
const WARHEADS = {
  bullet:    { infantry: 1.0,  light: 0.45, heavy: 0.25, building: 0.25, air: 0.6,  ship: 0.2 },
  cannon:    { infantry: 0.35, light: 1.0,  heavy: 0.85, building: 0.8,  air: 0,    ship: 0.8 },
  rocket:    { infantry: 0.35, light: 1.0,  heavy: 0.9,  building: 0.7,  air: 1.25, ship: 0.85 },
  artillery: { infantry: 1.1,  light: 0.7,  heavy: 0.5,  building: 1.0,  air: 0,    ship: 0.75 },
  rail:      { infantry: 0.8,  light: 1.1,  heavy: 1.0,  building: 0.7,  air: 0,    ship: 1.0 },
  flak:      { infantry: 0.1,  light: 0.1,  heavy: 0.05, building: 0,    air: 1.0,  ship: 0.05 },
  blast:     { infantry: 1.0,  light: 1.0,  heavy: 1.0,  building: 1.0,  air: 1.0,  ship: 1.0 },
  sniper:    { infantry: 1.0,  light: 0.12, heavy: 0.06, building: 0.04, air: 0,    ship: 0.02 },
  fire:      { infantry: 1.25, light: 0.55, heavy: 0.3,  building: 0.9,  air: 0,    ship: 0.3 },
  thermo:    { infantry: 1.2,  light: 0.9,  heavy: 0.55, building: 1.1,  air: 0,    ship: 0.6 },
  laser:     { infantry: 0.9,  light: 1.0,  heavy: 0.75, building: 0,    air: 1.2,  ship: 0.6 },
  missile:   { infantry: 0.8,  light: 0.9,  heavy: 0.8,  building: 1.2,  air: 0,    ship: 1.1 },
  emp:       { infantry: 0.4,  light: 1.0,  heavy: 0.9,  building: 0.6,  air: 1.0,  ship: 0.9 },
  hack:      { infantry: 0,    light: 0,    heavy: 0,    building: 0,    air: 0,    ship: 0 },
  torpedo:   { infantry: 0,    light: 0.8,  heavy: 0.8,  building: 0,    air: 0,    ship: 1.25 },
};

// speed & ranges are in tiles (per second), times in seconds.
const UNITS = {
  rifle: {
    name: 'Rifle Trooper', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'],
    cost: 200, time: 4, hp: 125, speed: 1.25, sight: 6, radius: 5, key: 'Q',
    weapon: { warhead: 'bullet', damage: 16, range: 5, cooldown: 0.9, proj: 'tracer', ground: true, air: true },
    dig: { weapon: { warhead: 'bullet', damage: 24, range: 6.5, cooldown: 0.8, proj: 'tracer', ground: true, air: true }, armor: 0.5, time: 0.8, pack: 0.5 },
    desc: 'Cheap all-purpose infantry. Good against infantry. Press D to dig in behind sandbags.',
  },
  rocket: {
    name: 'Rocket Trooper', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'],
    cost: 300, time: 5, hp: 110, speed: 1.15, sight: 6, radius: 5, key: 'W',
    weapon: { warhead: 'rocket', damage: 42, range: 6, cooldown: 1.9, proj: 'rocket', speed: 9, ground: true, air: true },
    desc: 'Shoulder-launched missiles. Strong vs vehicles and drones.',
  },
  engineer: {
    name: 'Combat Engineer', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'],
    cost: 500, time: 6, hp: 80, speed: 1.4, sight: 5, radius: 5, key: 'E', engineer: true,
    desc: 'Captures enemy structures. Fully repairs friendly ones.',
  },
  sniper: {
    name: 'Sniper', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'], side: 'allies',
    cost: 600, time: 7, hp: 90, speed: 1.2, sight: 10, radius: 5, key: 'R',
    weapon: { warhead: 'sniper', damage: 110, range: 9, cooldown: 2.4, proj: 'tracer', ground: true, air: false },
    desc: 'Allies only. Picks off infantry from far beyond their range. Useless against armor.',
  },
  shock: {
    name: 'Flame Trooper', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'], side: 'axis',
    cost: 350, time: 5, hp: 170, speed: 1.3, sight: 6, radius: 5, key: 'R',
    weapon: { warhead: 'fire', damage: 20, range: 3, cooldown: 0.3, proj: 'flame', ground: true, air: false },
    desc: 'Axis only. Short-range flamethrower that clears infantry and burns down structures.',
  },
  sas: {
    name: 'SAS Operative', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks', 'radar'], nation: 'uk',
    cost: 1000, time: 10, hp: 160, speed: 1.5, sight: 8, radius: 5, key: 'T', stealth: 3,
    demo: { plant: 1.2, fuse: 5, damage: 2200 },
    weapon: { warhead: 'bullet', damage: 45, range: 6, cooldown: 1.0, proj: 'tracer', ground: true, air: false },
    desc: 'UK only. Stays hidden until it opens fire and blows up structures with C4.',
  },
  hacker: {
    name: 'Cyber Warfare Unit', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks', 'radar'], nation: 'china',
    cost: 900, time: 9, hp: 140, speed: 1.3, sight: 8, radius: 5, key: 'T',
    weapon: { warhead: 'hack', damage: 0, range: 7, cooldown: 2, proj: 'hack', only: ['vehicle'], ground: true, air: false },
    desc: 'China only. Hacks into enemy vehicles: a few seconds of uplink and the vehicle joins your side.',
  },
  // Campaign hero: never on a build list, she arrives with the mission. Enemies can't pick her out
  // beyond stealth tiles unless she fired lately, and she blows up structures with C4 (demo).
  commando: {
    name: 'Commando "Raven"', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'], buildable: false, hero: true,
    cost: 2000, time: 0, hp: 600, speed: 1.6, sight: 9, radius: 5, selfHeal: 6, stealth: 3,
    demo: { plant: 0.8, fuse: 4, damage: 9000 },
    weapon: { warhead: 'bullet', damage: 120, range: 7, cooldown: 1.0, proj: 'tracer', ground: true, air: true },
    desc: 'Campaign hero. Hard to spot until she opens fire, drops a soldier with every shot and plants C4 on structures. Heals when out of combat. When her survival is an objective, losing her loses the mission.',
  },
  ifv: {
    name: 'Recon IFV', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory'], side: 'allies',
    cost: 600, time: 7, hp: 260, speed: 3.3, sight: 8, radius: 9, turn: 7, key: 'Q',
    weapon: { warhead: 'rocket', damage: 26, range: 6, cooldown: 1.1, proj: 'rocket', speed: 11, ground: true, air: true },
    desc: 'Allies only. Fast scout with dual missiles. Hits air and ground.',
  },
  flak: {
    name: 'Flak Track', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory'], side: 'axis',
    cost: 700, time: 7, hp: 320, speed: 2.8, sight: 8, radius: 10, turn: 6, key: 'Q',
    weapon: { warhead: 'flak', damage: 45, range: 7, cooldown: 0.9, proj: 'tracer', burst: 2, ground: false, air: true },
    weapon2: { warhead: 'bullet', damage: 18, range: 5, cooldown: 0.35, proj: 'tracer', ground: true, air: false },
    desc: 'Axis only. Tracked twin autocannons: shreds aircraft and chews through infantry.',
  },
  tank: {
    name: 'Battle Tank', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory'],
    cost: 900, time: 9, hp: 450, speed: 2.2, sight: 7, radius: 11, turn: 4, key: 'W',
    weapon: { warhead: 'cannon', damage: 62, range: 5.5, cooldown: 1.5, proj: 'shell', speed: 16, ground: true, air: false },
    desc: 'Main battle tank. The backbone of any assault.',
  },
  mlrs: {
    name: 'MLRS Artillery', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory', 'radar'], side: 'allies',
    cost: 1100, time: 11, hp: 220, speed: 1.9, sight: 7, radius: 11, turn: 4, key: 'E',
    weapon: { warhead: 'artillery', damage: 70, range: 11, minRange: 3, cooldown: 4, proj: 'arty', speed: 8, splash: 1.4, burst: 3, ground: true, air: false },
    desc: 'Allies only. Long-range saturation rockets. Devastating vs infantry and bases.',
  },
  tos: {
    name: 'Thermobaric Launcher', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory', 'radar'], side: 'axis',
    cost: 1200, time: 12, hp: 420, speed: 1.6, sight: 7, radius: 12, turn: 3, key: 'E',
    weapon: { warhead: 'thermo', damage: 120, range: 8, minRange: 2, cooldown: 6, proj: 'arty', speed: 9, splash: 2.2, burst: 2, ground: true, air: false },
    desc: 'Axis only. Armored launcher whose thermobaric rockets flatten everything in a wide blast.',
  },
  iskander: {
    name: 'Iskander-M', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory', 'tech'], nation: 'russia',
    cost: 1600, time: 16, hp: 360, speed: 1.8, sight: 7, radius: 12, turn: 3, key: 'U',
    weapon: { warhead: 'missile', damage: 420, range: 16, minRange: 5, cooldown: 12, proj: 'arty', speed: 11, splash: 1.5, ground: true, air: false },
    desc: 'Russia only. Ballistic missile launcher that hits structures from far outside their range.',
  },
  aegis: {
    name: 'Aegis Shield Carrier', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory', 'radar'], nation: 'eu',
    cost: 1100, time: 11, hp: 460, speed: 2.4, sight: 8, radius: 11, turn: 5, key: 'U',
    weapon: { warhead: 'rocket', damage: 24, range: 6, cooldown: 1.2, proj: 'rocket', speed: 11, ground: true, air: true },
    aura: { radius: 4.5, ally: { armor: 0.6 } },
    desc: 'EU only. Projects an energy shield: friendly units within 4 tiles take 40% less damage.',
  },
  raijin: {
    name: 'Raijin EMP Walker', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory', 'radar'], nation: 'japan',
    cost: 1300, time: 12, hp: 520, speed: 2.0, sight: 8, radius: 11, turn: 5, key: 'U',
    weapon: { warhead: 'emp', damage: 34, range: 6, cooldown: 2.0, proj: 'emp', ground: true, air: true },
    onHit: { stun: 3 },
    desc: 'Japan only. Walking mech whose EMP bolts shut down vehicles, helicopters and defenses for 3 seconds.',
  },
  demotruck: {
    name: 'Demolition Truck', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory'], nation: 'northkorea',
    cost: 900, time: 9, hp: 300, speed: 2.6, sight: 6, radius: 10, turn: 5, key: 'U', volatile: true,
    weapon: { warhead: 'blast', damage: 900, range: 0.9, cooldown: 1, proj: 'self', splash: 2.6, ground: true, air: false },
    desc: 'North Korea only. Packed with explosives: it drives into the enemy and detonates, levelling everything nearby. It also goes off when destroyed.',
  },
  railtank: {
    name: 'Railgun Tank', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory', 'tech'], pkg: 'tech',
    cost: 1500, time: 14, hp: 600, speed: 2.0, sight: 8, radius: 12, turn: 4, key: 'R',
    weapon: { warhead: 'rail', damage: 160, range: 7, cooldown: 2.6, proj: 'rail', pierce: true, ground: true, air: false },
    desc: 'Electromagnetic railgun that pierces through every target in a line.',
  },
  titan: {
    name: 'Titan Tank', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory', 'tech'], pkg: 'heavy',
    cost: 1750, time: 15, hp: 1000, speed: 1.4, sight: 7, radius: 14, turn: 3, key: 'R', selfHeal: 6,
    weapon: { warhead: 'cannon', damage: 75, range: 6, cooldown: 1.6, proj: 'shell', speed: 16, burst: 2, ground: true, air: false },
    weapon2: { warhead: 'rocket', damage: 35, range: 7, cooldown: 1.6, proj: 'rocket', speed: 10, ground: false, air: true },
    desc: 'Twin-cannon behemoth with AA missile pods. Slowly self-repairs.',
  },
  harvester: {
    name: 'Harvester', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory', 'refinery'],
    cost: 1400, time: 10, hp: 900, speed: 1.6, sight: 5, radius: 12, turn: 4, key: 'T', harvester: true, capacity: 700,
    desc: 'Collects rare-earth ore and lithium crystals.',
  },
  mcv: {
    name: 'Mobile Construction Vehicle', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory', 'radar'],
    cost: 3000, time: 20, hp: 1000, speed: 1.3, sight: 6, radius: 13, turn: 3, key: 'Y', mcv: true,
    desc: 'Deploys into a Command Center. Press D to deploy.',
  },
  heli: {
    name: 'Attack Helicopter', cat: 'air', armor: 'air', from: 'airfield', req: ['airfield'],
    cost: 1000, time: 10, hp: 260, speed: 3.8, sight: 8, radius: 13, key: 'Q', air: true,
    weapon: { warhead: 'rocket', damage: 42, range: 5, cooldown: 1.3, proj: 'rocket', speed: 12, ground: true, air: false },
    desc: 'Hovers over the battlefield firing anti-armor missiles. Crosses water and cliffs.',
  },
  drone: {
    name: 'MQ-9 Reaper', cat: 'air', armor: 'air', from: 'airfield', req: ['airfield', 'radar'], nation: 'usa',
    cost: 800, time: 9, hp: 260, speed: 4.6, sight: 13, radius: 12, key: 'E', air: true,
    weapon: { warhead: 'rocket', damage: 60, range: 7, cooldown: 2.8, proj: 'rocket', speed: 13, ground: true, air: false },
    onHit: { mark: 6 },
    desc: 'USA only. Long-endurance drone that sees far and strikes with Hellfire missiles. Whatever it hits is laser-designated and takes 25% more damage from everyone for 6 seconds.',
  },
  kirov: {
    name: 'Kirov Airship', cat: 'air', armor: 'air', from: 'airfield', req: ['airfield', 'tech'], nation: 'soviet',
    cost: 2500, time: 24, hp: 2400, speed: 0.9, sight: 8, radius: 20, key: 'E', air: true, alt: 44,
    weapon: { warhead: 'blast', damage: 170, range: 1.4, cooldown: 1.6, proj: 'bomb', splash: 1.8, ground: true, air: false },
    desc: 'Soviet only. Slow, massively armored airship that carpet-bombs whatever it floats over.',
  },
  jet: {
    name: 'Fighter Jet', cat: 'air', armor: 'air', from: 'airfield', req: ['airfield', 'radar'],
    cost: 1400, time: 12, hp: 240, speed: 7.5, sight: 9, radius: 13, key: 'W', air: true, jet: true,
    weapon: { warhead: 'flak', damage: 70, range: 6, cooldown: 1.1, proj: 'rocket', speed: 18, ground: false, air: true },
    weapon2: { warhead: 'cannon', damage: 55, range: 5, cooldown: 1.6, proj: 'rocket', speed: 16, ground: true, air: false },
    desc: 'Supersonic multirole fighter. Wins the skies, strafes ground targets.',
  },
  // ---- support and specialist units ----
  // mend: patches up friendly units of the listed categories within range (no weapon of its own)
  medic: {
    name: 'Field Medic', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'],
    cost: 400, time: 5, hp: 100, speed: 1.35, sight: 6, radius: 5, key: 'Y',
    mend: { rate: 16, range: 3.5, cats: ['infantry'] },
    desc: 'Unarmed. Treats wounded infantry nearby, and walks over to anyone hurt within sight when idle.',
  },
  recovery: {
    name: 'Recovery Vehicle', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory'],
    cost: 900, time: 9, hp: 520, speed: 2.4, sight: 7, radius: 11, turn: 5, key: 'I',
    mend: { rate: 28, range: 3.5, cats: ['vehicle'] },
    desc: 'Unarmed armored workshop. Repairs damaged vehicles nearby while the fighting goes on.',
  },
  phantom: {
    name: 'Phantom Stealth Tank', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory', 'radar'], side: 'allies',
    cost: 1100, time: 11, hp: 340, speed: 2.9, sight: 8, radius: 10, turn: 6, key: 'O', stealth: 2.5,
    weapon: { warhead: 'rocket', damage: 46, range: 6, cooldown: 2.4, proj: 'rocket', speed: 12, burst: 2, ground: true, air: false },
    desc: 'Allies only. Adaptive camouflage keeps it hidden until it fires or an enemy comes within 2 tiles. Twin missiles for ambushes on armor and harvesters.',
  },
  minelayer: {
    name: 'Mine Layer', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory'], side: 'axis',
    cost: 800, time: 8, hp: 400, speed: 2.5, sight: 7, radius: 10, turn: 5, key: 'O',
    weapon: { warhead: 'bullet', damage: 14, range: 4.5, cooldown: 0.45, proj: 'tracer', ground: true, air: true },
    mines: { carry: 6, reload: 12, damage: 360, splash: 1.3, trigger: 0.7 },
    desc: 'Axis only. Press D to drop an anti-tank mine (carries 6, reloads one every 12 s). Mines stay hidden and blow up under enemy vehicles; infantry walking over one defuses it.',
  },
  bomber: {
    name: 'Strike Bomber', cat: 'air', armor: 'air', from: 'airfield', req: ['airfield', 'tech'],
    cost: 1800, time: 16, hp: 480, speed: 5.2, sight: 8, radius: 16, key: 'R', air: true, jet: true, prefer: 'structures',
    weapon: { warhead: 'blast', damage: 210, range: 1.6, cooldown: 7, proj: 'bomb', splash: 1.5, burst: 4, ground: true, air: false },
    desc: 'Heavy bomber that drops a stick of four bombs on each pass, then circles round for the next. Built to flatten structures; easy prey for fighters and SAMs.',
  },
  // ---- navy: built at a Naval Shipyard, sail only on water (the hovercraft also drives on land) ----
  patrol: {
    name: 'Patrol Boat', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard'], naval: true,
    cost: 700, time: 7, hp: 420, speed: 3.8, sight: 9, radius: 11, turn: 5, key: 'Q',
    weapon: { warhead: 'cannon', damage: 32, range: 6, cooldown: 1.0, proj: 'shell', speed: 16, ground: true, air: false },
    weapon2: { warhead: 'flak', damage: 32, range: 6.5, cooldown: 0.8, proj: 'tracer', ground: false, air: true },
    desc: 'Fast gunboat. Shells boats and the shoreline, and its autocannon keeps helicopters off.',
  },
  destroyer: {
    name: 'Destroyer', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard', 'radar'], naval: true,
    cost: 1500, time: 13, hp: 950, speed: 2.7, sight: 10, radius: 15, turn: 3, key: 'W',
    weapon: { warhead: 'cannon', damage: 58, range: 8, cooldown: 1.4, proj: 'shell', speed: 16, ground: true, air: false },
    weapon2: { warhead: 'flak', damage: 48, range: 9, cooldown: 1.2, proj: 'rocket', speed: 15, burst: 2, ground: false, air: true },
    weapon3: { warhead: 'torpedo', damage: 70, range: 6, cooldown: 2.0, proj: 'torpedo', speed: 8, only: ['naval'], asw: true, ground: true, air: false },
    desc: 'Escort warship: a deck gun, surface-to-air missiles and anti-submarine torpedoes. The fleet\'s answer to submarines.',
  },
  sub: {
    name: 'Attack Submarine', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard'], naval: true, submarine: true, stealth: 3,
    cost: 1200, time: 11, hp: 560, speed: 2.9, sight: 8, radius: 11, turn: 4, key: 'E',
    weapon: { warhead: 'torpedo', damage: 160, range: 6.5, cooldown: 2.6, proj: 'torpedo', speed: 7, only: ['naval'], asw: true, ground: true, air: false },
    desc: 'Runs submerged: hidden until it fires or an enemy comes within 3 tiles, and only torpedoes can reach it down there. Its torpedoes sink ships.',
  },
  hover: {
    name: 'Hovercraft', cat: 'naval', armor: 'light', from: 'shipyard', req: ['shipyard'], naval: true, amphib: true, transport: 6,
    cost: 900, time: 8, hp: 480, speed: 3.6, sight: 7, radius: 13, turn: 5, key: 'T',
    weapon: { warhead: 'bullet', damage: 14, range: 5, cooldown: 0.3, proj: 'tracer', ground: true, air: true },
    desc: 'Amphibious landing craft for 6 infantry or 2 vehicles. Right-click it with troops to board, drive it onto a beach and press D to unload.',
  },
  cruiser: {
    name: 'Missile Cruiser', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard', 'tech'], side: 'allies', naval: true,
    cost: 2400, time: 20, hp: 1500, speed: 2.1, sight: 10, radius: 18, turn: 2.5, key: 'R',
    weapon: { warhead: 'missile', damage: 230, range: 15, minRange: 4, cooldown: 6.5, proj: 'arty', speed: 11, splash: 1.2, burst: 2, ground: true, air: false },
    weapon2: { warhead: 'flak', damage: 55, range: 9, cooldown: 1.0, proj: 'rocket', speed: 15, burst: 2, ground: false, air: true },
    desc: 'Allies only. Vertical-launch cruise missiles strike structures 15 tiles inland, and its SAMs guard the fleet. Blind to submarines.',
  },
  battleship: {
    name: 'Battlecruiser', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard', 'tech'], side: 'axis', naval: true,
    cost: 2600, time: 22, hp: 2200, speed: 1.6, sight: 10, radius: 19, turn: 2, key: 'R', turrets: 2,
    weapon: { warhead: 'artillery', damage: 135, range: 13, minRange: 3, cooldown: 4.5, proj: 'arty', speed: 10, splash: 1.8, burst: 3, ground: true, air: false },
    weapon2: { warhead: 'flak', damage: 40, range: 7, cooldown: 0.8, proj: 'tracer', burst: 2, ground: false, air: true },
    desc: 'Axis only. Heavily armored gunship whose twin turrets shell the coast from 13 tiles out. Blind to submarines.',
  },
  carrier: {
    name: 'HMS Queen Elizabeth', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard', 'tech'], nation: 'uk', naval: true,
    cost: 3000, time: 24, hp: 1900, speed: 1.7, sight: 12, radius: 22, turn: 2, key: 'U',
    weapon: { warhead: 'rocket', damage: 75, range: 16, cooldown: 5, proj: 'sortie', speed: 9, burst: 3, ground: true, air: true },
    desc: 'UK only. Aircraft carrier: launches F-35B strikes at anything, ground or air, within 16 tiles. Enemy air defenses can shoot the jets down.',
  },
  maya: {
    name: 'Maya-class Aegis Destroyer', cat: 'naval', armor: 'ship', from: 'shipyard', req: ['shipyard', 'radar'], nation: 'japan', naval: true,
    cost: 1800, time: 15, hp: 1050, speed: 2.7, sight: 11, radius: 16, turn: 3, key: 'U',
    intercept: { range: 8, cooldown: 0.8 },
    weapon: { warhead: 'flak', damage: 62, range: 10, cooldown: 0.9, proj: 'rocket', speed: 16, burst: 2, ground: false, air: true },
    weapon2: { warhead: 'cannon', damage: 48, range: 7, cooldown: 1.4, proj: 'shell', speed: 16, ground: true, air: false },
    desc: 'Japan only. SM-3 interceptors shoot down incoming missiles, rockets and artillery within 8 tiles, guarding the fleet and the coast. Long-range air defense.',
  },
};

const BUILDINGS = {
  cc: {
    name: 'Command Center', cat: 'building', w: 3, h: 3, hp: 2500, cost: 3000, time: 30, power: 20, sight: 8, height: 90,
    desc: 'Constructs all base structures.', buildable: false, produces: 'structure',
  },
  power: {
    name: 'Power Plant', cat: 'building', w: 2, h: 2, hp: 800, cost: 600, time: 6, power: 150, sight: 5, height: 58, req: [], key: 'Q',
    desc: 'Fusion reactor providing 150 power. Keep your grid supplied!',
  },
  refinery: {
    name: 'Ore Refinery', cat: 'building', w: 3, h: 3, hp: 1200, cost: 2000, time: 12, power: -50, sight: 6, height: 40, req: ['power'], key: 'W',
    desc: 'Processes ore into credits. Comes with a free Harvester.',
  },
  barracks: {
    name: 'Barracks', cat: 'building', w: 2, h: 2, hp: 900, cost: 500, time: 6, power: -20, sight: 5, height: 34, req: ['power'], key: 'E', produces: 'infantry',
    desc: 'Trains infantry.',
  },
  factory: {
    name: 'War Factory', cat: 'building', w: 3, h: 3, hp: 1500, cost: 2000, time: 14, power: -40, sight: 6, height: 56, req: ['refinery', 'barracks'], key: 'R', produces: 'vehicle',
    desc: 'Builds vehicles.',
  },
  radar: {
    name: 'Radar Station', cat: 'building', w: 2, h: 2, hp: 1000, cost: 1000, time: 8, power: -60, sight: 10, height: 44, req: ['factory'], key: 'T',
    desc: 'Enables the tactical minimap. Unlocks advanced tech.',
  },
  airfield: {
    name: 'Airfield', cat: 'building', w: 3, h: 2, hp: 900, cost: 1000, time: 8, power: -40, sight: 6, height: 40, req: ['radar'], key: 'Y', produces: 'air',
    desc: 'Builds helicopters and fighter jets.',
  },
  tech: {
    name: 'Tech Lab', cat: 'building', w: 2, h: 2, hp: 1200, cost: 1800, time: 14, power: -100, sight: 6, height: 46, req: ['radar'], key: 'U',
    desc: 'Unlocks faction super-units and the superweapon.',
  },
  super_lance: {
    name: 'Orbital Lance', cat: 'building', w: 3, h: 3, hp: 2000, cost: 5000, time: 30, power: -150, sight: 6, height: 60, req: ['tech'], pkg: 'tech', key: 'I',
    superweapon: { charge: 300, damage: 1400, radius: 3.5, kind: 'lance' },
    desc: 'Satellite uplink. Calls down an orbital laser strike every 5 minutes.',
  },
  super_silo: {
    name: 'Hypersonic Silo', cat: 'building', w: 3, h: 3, hp: 2000, cost: 5000, time: 30, power: -150, sight: 6, height: 40, req: ['tech'], pkg: 'heavy', key: 'I',
    superweapon: { charge: 300, damage: 1600, radius: 4, kind: 'missile' },
    desc: 'Launches a hypersonic warhead every 5 minutes.',
  },
  turret: {
    name: 'Gatling Turret', cat: 'defense', w: 1, h: 1, hp: 700, cost: 500, time: 5, power: 0, sight: 7, height: 16, req: ['barracks'], key: 'Q',
    weapon: { warhead: 'bullet', damage: 13, range: 6, cooldown: 0.22, proj: 'tracer', ground: true, air: true },
    desc: 'Rapid-fire anti-infantry defense. Needs no power.',
  },
  railturret: {
    name: 'Rail Turret', cat: 'defense', w: 1, h: 1, hp: 1000, cost: 1000, time: 9, power: -50, sight: 8, height: 22, req: ['factory'], key: 'W', needsPower: true,
    weapon: { warhead: 'rail', damage: 110, range: 7.5, cooldown: 2.2, proj: 'rail', ground: true, air: false },
    desc: 'Anti-armor railgun emplacement. Requires power.',
  },
  laser: {
    name: 'Laser Defense Tower', cat: 'defense', w: 1, h: 1, hp: 950, cost: 1300, time: 11, power: -80, sight: 9, height: 30, req: ['radar'], key: 'R', needsPower: true, nation: 'eu',
    weapon: { warhead: 'laser', damage: 40, range: 8.5, cooldown: 0.8, proj: 'laser', ground: true, air: true },
    desc: 'EU only. High-energy laser that burns down vehicles and aircraft alike. Requires power.',
  },
  hub: {
    name: 'Support Hub', cat: 'building', w: 2, h: 2, hp: 1100, cost: 1200, time: 10, power: -40, sight: 7, height: 38, req: ['factory'], key: 'O', nation: 'china',
    heal: { rate: 14, radius: 7 },
    desc: 'China only. Field hospital and repair yard: nearby units heal over time.',
  },
  thaad: {
    name: 'THAAD Battery', cat: 'defense', w: 2, h: 2, hp: 900, cost: 1500, time: 12, power: -60, sight: 9, height: 30, req: ['radar'], key: 'R', needsPower: true, nation: 'usa',
    intercept: { range: 9, cooldown: 0.7 },
    desc: 'USA only. Shoots down incoming artillery, ballistic missiles and rockets within 9 tiles. Requires power.',
  },
  koksan: {
    name: 'Koksan Gun Emplacement', cat: 'defense', w: 2, h: 2, hp: 1400, cost: 1600, time: 13, power: 0, sight: 8, height: 22, req: ['factory'], key: 'R', nation: 'northkorea',
    weapon: { warhead: 'artillery', damage: 110, range: 15, minRange: 4, cooldown: 5, proj: 'arty', speed: 9, splash: 1.6, ground: true, air: false },
    desc: 'North Korea only. Dug-in 170mm gun that shells anything within 15 tiles. Needs no power.',
  },
  gchq: {
    name: 'GCHQ Listening Post', cat: 'building', w: 2, h: 2, hp: 1000, cost: 1500, time: 12, power: -60, sight: 8, height: 40, req: ['radar'], key: 'O', needsPower: true, nation: 'uk',
    reveal: true,
    desc: 'UK only. Signals intelligence: every enemy unit on the map shows up, wherever it is. Requires power.',
  },
  robotics: {
    name: 'Robotics Plant', cat: 'building', w: 2, h: 2, hp: 1200, cost: 1600, time: 12, power: -60, sight: 6, height: 44, req: ['factory'], key: 'O', nation: 'japan',
    boost: { vehicle: 1.5, air: 1.5 },
    desc: 'Japan only. Automated assembly lines: vehicles and aircraft build 50% faster.',
  },
  krasukha: {
    name: 'Krasukha EW Station', cat: 'building', w: 2, h: 2, hp: 1000, cost: 1400, time: 11, power: -80, sight: 9, height: 36, req: ['radar'], key: 'O', needsPower: true, nation: 'russia',
    aura: { radius: 9, enemy: { speed: 0.65, rof: 0.65 } },
    desc: 'Russia only. Jams everything nearby: enemy units and defenses within 9 tiles move and fire 35% slower. Requires power.',
  },
  propaganda: {
    name: 'Propaganda Tower', cat: 'building', w: 1, h: 1, hp: 700, cost: 1000, time: 8, power: -30, sight: 7, height: 50, req: ['barracks'], key: 'O', needsPower: true, nation: 'soviet',
    aura: { radius: 7, ally: { rof: 1.3 } },
    desc: 'Soviet only. Loudspeakers rally the troops: friendly units within 7 tiles fire 30% faster. Requires power.',
  },
  bunker: {
    name: 'Battle Bunker', cat: 'defense', w: 1, h: 1, hp: 1100, cost: 500, time: 6, power: 0, sight: 7, height: 18, req: ['barracks'], key: 'T', garrison: 4,
    desc: 'Concrete bunker for up to 4 infantry, who fire out of it with extra range. Needs no power.',
  },
  wall: {
    name: 'Concrete Wall', cat: 'defense', w: 1, h: 1, hp: 1400, cost: 100, time: 1.5, power: 0, sight: 2, height: 14, req: ['barracks'], key: 'Y', wall: true,
    desc: 'Blocks the way for everything on the ground. Placement stays active so you can lay a line; right-click or Esc to stop.',
  },
  mortar: {
    name: 'Mortar Pit', cat: 'defense', w: 1, h: 1, hp: 800, cost: 700, time: 7, power: 0, sight: 9, height: 10, req: ['barracks'], key: 'U',
    weapon: { warhead: 'artillery', damage: 48, range: 9.5, minRange: 2.5, cooldown: 3.2, proj: 'arty', speed: 7, splash: 1.3, ground: true, air: false },
    desc: 'Sandbagged mortar that lobs shells over walls and buildings. Breaks up infantry pushes; can\'t hit anything right next to it. Needs no power.',
  },
  missilenest: {
    name: 'Missile Nest', cat: 'defense', w: 1, h: 1, hp: 750, cost: 1100, time: 9, power: -40, sight: 9, height: 18, req: ['factory'], key: 'I', needsPower: true, side: 'allies',
    weapon: { warhead: 'rocket', damage: 80, range: 8.5, cooldown: 2.6, proj: 'rocket', speed: 12, ground: true, air: true },
    desc: 'Allies only. Fire-and-forget missiles that outrange tanks and also bring down aircraft. Requires power.',
  },
  flametower: {
    name: 'Flame Tower', cat: 'defense', w: 1, h: 1, hp: 1150, cost: 800, time: 7, power: 0, sight: 6, height: 24, req: ['barracks'], key: 'I', side: 'axis',
    weapon: { warhead: 'fire', damage: 24, range: 4, cooldown: 0.3, proj: 'flame', ground: true, air: false },
    desc: 'Axis only. Armored flamethrower post: roasts infantry, burns troops out of buildings and scorches anything that gets close. Needs no power.',
  },
  sensor: {
    name: 'Sensor Tower', cat: 'defense', w: 1, h: 1, hp: 600, cost: 600, time: 6, power: -20, sight: 12, height: 40, req: ['radar'], key: 'O', needsPower: true,
    detect: 8,
    desc: 'Sees far, and reveals stealth units, submarines and mines within 8 tiles, so your forces can open fire on hidden units. Requires power.',
  },
  drill: {
    name: 'Ore Drill', cat: 'building', w: 2, h: 2, hp: 900, cost: 1500, time: 10, power: -30, sight: 5, height: 36, req: ['refinery'], key: 'L', nearOre: 3,
    drill: { rate: 6, radius: 3 },
    desc: 'Pumps ore straight out of a nearby field: a steady 6 credits a second while there is ore within 3 tiles. Must be built next to an ore field.',
  },
  // Civilian buildings stand on the map from the start. They belong to nobody until infantry
  // garrison them, then to whoever holds them until the last occupant leaves.
  civ_house: {
    name: 'Farmhouse', cat: 'civilian', w: 2, h: 2, hp: 900, cost: 0, time: 0, power: 0, sight: 6, height: 40, buildable: false, garrison: 4,
    desc: 'Civilian building. Infantry can garrison it.',
  },
  civ_flats: {
    name: 'Apartment Block', cat: 'civilian', w: 2, h: 2, hp: 1400, cost: 0, time: 0, power: 0, sight: 7, height: 66, buildable: false, garrison: 6,
    desc: 'Civilian building. Infantry can garrison it.',
  },
  civ_office: {
    name: 'Office Building', cat: 'civilian', w: 3, h: 2, hp: 1800, cost: 0, time: 0, power: 0, sight: 7, height: 54, buildable: false, garrison: 8,
    desc: 'Civilian building. Infantry can garrison it.',
  },
  shipyard: {
    name: 'Naval Shipyard', cat: 'building', w: 3, h: 3, hp: 1500, cost: 1500, time: 12, power: -40, sight: 8, height: 30, req: ['factory'], key: 'G', produces: 'naval', water: true,
    heal: { rate: 24, radius: 4, naval: true },
    desc: 'Builds warships and repairs them alongside. Must be built out on the water, within reach of your base.',
  },
  sam: {
    name: 'SAM Site', cat: 'defense', w: 1, h: 1, hp: 650, cost: 750, time: 7, power: -30, sight: 9, height: 20, req: ['radar'], key: 'E', needsPower: true,
    weapon: { warhead: 'flak', damage: 55, range: 9, cooldown: 1.1, proj: 'rocket', speed: 14, ground: false, air: true, burst: 2 },
    desc: 'Surface-to-air missiles. Requires power.',
  },
};

// ---- research ----
// Bought on a production tab like a unit (that production line waits while it runs), once per
// match. From then on it applies to every unit of its kind the team fields, even after the
// structure that researched it is gone. hp / dmg multiply by unit category; vet: new units of
// those categories roll out as Veterans; evade: share of damage aircraft still take from those
// warheads; regen: share of max HP warships patch up each second when not under fire; hot: the
// category's shots glow green. show is the unit the sidebar picture shows wearing the upgrade.
const UPGRADES = {
  up_armor: {
    name: 'Ballistic Armor', research: true, cat: 'infantry', from: 'barracks', req: ['barracks', 'radar'],
    cost: 1200, time: 25, show: 'rifle', hp: { infantry: 1.3 },
    desc: 'Plate carriers, shoulder guards and heavier helmets for every soldier: infantry take 30% more punishment. Your troops wear the new kit.',
  },
  up_training: {
    name: 'Combat Training', research: true, cat: 'infantry', from: 'barracks', req: ['barracks', 'tech'],
    cost: 1500, time: 30, show: 'rifle', vet: ['infantry'],
    desc: 'Live-fire drills: new infantry leave the barracks as Veterans, with 25% more firepower and tougher hides.',
  },
  up_era: {
    name: 'Reactive Armor', research: true, cat: 'vehicle', from: 'factory', req: ['factory', 'radar'],
    cost: 1500, time: 30, show: 'tank', hp: { vehicle: 1.25 },
    desc: 'Explosive reactive armor bricks bolted onto every hull and turret: vehicles get 25% more armor. Your vehicles show the bricks.',
  },
  up_du: {
    name: 'Depleted Uranium Rounds', research: true, cat: 'vehicle', from: 'factory', req: ['factory', 'tech'],
    cost: 2000, time: 35, show: 'tank', dmg: { vehicle: 1.2 }, hot: ['vehicle'],
    desc: 'Denser penetrators for every vehicle weapon: they hit 20% harder, and their tracers and shells burn green.',
  },
  up_flares: {
    name: 'Countermeasures', research: true, cat: 'air', from: 'airfield', req: ['airfield', 'radar'],
    cost: 1200, time: 25, show: 'heli', evade: { rocket: 0.6, flak: 0.6 },
    desc: 'Flare and chaff dispensers: aircraft take 40% less damage from missiles and flak, popping flares as the missiles come in.',
  },
  up_damage: {
    name: 'Damage Control', research: true, cat: 'naval', from: 'shipyard', req: ['shipyard', 'radar'],
    cost: 1200, time: 25, show: 'destroyer', hp: { naval: 1.15 }, regen: 0.01,
    desc: 'Damage-control parties on every warship: 15% more armor, and ships patch themselves up when out of the fight. Watch for the welding sparks.',
  },
};

// ---- Mk II structures ----
// Select one of your structures and press Upgrade (or ' and click it). Paid up front; the refit
// takes a while (half speed on low power) and the structure keeps working meanwhile. Needs a
// Radar Station. hp multiplies max HP; power a plant's output; income what a refinery pays per
// load; prod: the structure counts double for production speed; rate an Ore Drill's pumping;
// dmg / range the weapon; detect a Sensor Tower's reach; reload a THAAD battery's.
const MK2_DEFENSE = { hp: 1.5, dmg: 1.25, range: 1.15, text: '+50% armor, +25% damage, +15% range' };
const STRUCTURE_UPGRADES = {
  power: { hp: 1.25, power: 1.6, text: 'Second turbine: +60% power' },
  refinery: { hp: 1.25, income: 1.25, text: 'Ore purifier: +25% credits from every load' },
  barracks: { hp: 1.25, prod: true, text: 'Second training hall: trains like two barracks' },
  factory: { hp: 1.25, prod: true, text: 'Second assembly line: builds like two war factories' },
  airfield: { hp: 1.25, prod: true, text: 'Extra hangar: builds like two airfields' },
  shipyard: { hp: 1.25, prod: true, text: 'Second slipway: builds like two shipyards' },
  drill: { hp: 1.25, rate: 1.6, text: 'Second pump: +60% ore pumped' },
  turret: MK2_DEFENSE, railturret: MK2_DEFENSE, sam: MK2_DEFENSE, laser: MK2_DEFENSE, mortar: MK2_DEFENSE,
  missilenest: MK2_DEFENSE, flametower: MK2_DEFENSE, koksan: MK2_DEFENSE,
  thaad: { hp: 1.5, reload: 0.65, range: 1.15, text: '+50% armor, faster interceptors with 15% more reach' },
  sensor: { hp: 1.5, detect: 1.5, text: '+50% armor, spots hidden units 50% farther out' },
};
const STRUCTURE_UPGRADE_REQ = 'radar';
function upgradeCostOf(key) { return Math.round(BUILDINGS[key].cost * 0.6 / 50) * 50; }
function upgradeTimeOf(key) { return BUILDINGS[key].time * 1.5; }

// Infantry inside a structure fire out of it with extra reach and punch, and take no damage
// until the structure falls. Flame and thermobaric weapons burn them out: each hit has this
// chance to kill one occupant.
const GARRISON = { range: 1, dmg: 1.25, clear: { fire: 0.2, thermo: 0.7, blast: 0.5 }, civilian: ['civ_house', 'civ_flats', 'civ_office'] };
const NEUTRAL = -1;

const PRODUCER_OF = { structure: 'cc', infantry: 'barracks', vehicle: 'factory', air: 'airfield', naval: 'shipyard' };

const TABS = [
  { id: 'structure', label: 'Base', list: ['power', 'refinery', 'barracks', 'factory', 'radar', 'airfield', 'tech', 'hub', 'gchq', 'robotics', 'krasukha', 'propaganda', 'drill', 'shipyard', 'super_lance', 'super_silo'] },
  { id: 'defense', label: 'Defense', list: ['turret', 'railturret', 'sam', 'laser', 'thaad', 'koksan', 'bunker', 'wall', 'mortar', 'missilenest', 'flametower', 'sensor'] },
  { id: 'infantry', label: 'Infantry', list: ['rifle', 'rocket', 'sniper', 'shock', 'sas', 'hacker', 'medic', 'engineer', 'up_armor', 'up_training'] },
  { id: 'vehicle', label: 'Armor', list: ['ifv', 'flak', 'tank', 'mlrs', 'tos', 'railtank', 'titan', 'iskander', 'aegis', 'raijin', 'demotruck', 'phantom', 'minelayer', 'recovery', 'harvester', 'mcv', 'up_era', 'up_du'] },
  { id: 'air', label: 'Air', list: ['heli', 'drone', 'kirov', 'jet', 'bomber', 'up_flares'] },
  { id: 'naval', label: 'Navy', list: ['patrol', 'destroyer', 'sub', 'cruiser', 'battleship', 'carrier', 'maya', 'hover', 'up_damage'] },
];

// The two factions. Each fields its own scout vehicle, artillery and special infantry; SIDE_SWAP
// maps an Allied unit to its Axis counterpart where code needs "the light vehicle" of either side.
const SIDES = {
  allies: { name: 'Allies', tagline: 'Precision and mobility', units: ['sniper', 'ifv', 'mlrs'] },
  axis: { name: 'Axis', tagline: 'Mass and firepower', units: ['shock', 'flak', 'tos'] },
};
const SIDE_SWAP = { axis: { sniper: 'shock', ifv: 'flak', mlrs: 'tos' }, allies: { shock: 'sniper', flak: 'ifv', tos: 'mlrs' } };
function sideKey(key, faction) { const sw = SIDE_SWAP[FACTIONS[faction].side]; return (sw && sw[key]) || key; }

function defOf(key) { return UNITS[key] || BUILDINGS[key] || UPGRADES[key]; }

// whether a faction's roster includes a unit or structure at all (tech package, side, country)
function inRoster(key, faction) {
  const def = defOf(key), f = FACTIONS[faction];
  if (!def || !f) return false;
  if (def.pkg && def.pkg !== f.pkg) return false;
  if (def.side && def.side !== f.side) return false;
  if (def.nation && def.nation !== faction) return false;
  return true;
}

function queueTypeOf(key) {
  if (BUILDINGS[key]) return BUILDINGS[key].cat === 'defense' ? 'defense' : 'structure';
  const u = UNITS[key] || UPGRADES[key];
  return u.cat === 'infantry' ? 'infantry' : u.cat === 'air' ? 'air' : u.cat === 'naval' ? 'naval' : 'vehicle';
}

// AI tactics per difficulty: counter = adapt unit mix to what scouts have seen,
// raid = harvester raiding party size, engineers = how many ride along with attack waves,
// retreat = pull a wave back once it drops below this share of its starting strength.
const DIFFICULTY = {
  easy:   { label: 'Easy',   build: 0.7, income: 0.8, firstAttack: 420, waveBase: 5, waveGrow: 1, counter: false, raid: 0, engineers: 0, retreat: 0 },
  normal: { label: 'Normal', build: 1.0, income: 1.0, firstAttack: 300, waveBase: 7, waveGrow: 2, counter: true, raid: 3, engineers: 1, retreat: 0.35 },
  hard:   { label: 'Brutal', build: 1.35, income: 1.35, firstAttack: 200, waveBase: 9, waveGrow: 3, counter: true, raid: 4, engineers: 2, retreat: 0.4 },
};

const START_CREDITS = 10000;
const BUILD_RADIUS = 5; // tiles from an existing structure

// Skirmish line-ups: one alliance number per player, the human first.
const LINEUPS = {
  '1v1':  { label: '1 vs 1', teams: [0, 1] },
  '1v2':  { label: '1 vs 2', teams: [0, 1, 1] },
  '2v2':  { label: '2 vs 2', teams: [0, 0, 1, 1] },
  '2v1':  { label: '2 vs 1', teams: [0, 0, 1] },
  'ffa3': { label: 'Free for all (3)', teams: [0, 1, 2] },
  'ffa4': { label: 'Free for all (4)', teams: [0, 1, 2, 3] },
};

// How much water a skirmish map has. Lakes is the classic land map; on the sea maps a large
// sea fills the middle with a bay reaching toward every base, and the land route runs round
// the rim (on Islands only along narrow causeways).
const MAP_WATER = {
  lakes: { label: 'Lakes' },
  sea: { label: 'Inland sea', edge: 0.2 },    // land left at the middle of each edge, share of the map
  islands: { label: 'Islands', edge: 0.075 },
};

const MAP_SIZES = {
  small: { label: 'Small', tiles: 72 },
  medium: { label: 'Medium', tiles: 88 },
  large: { label: 'Large', tiles: 112 },
};

// Extra team colours for when the faction colours and their alternates are all taken.
const EXTRA_COLORS = [
  { color: '#a35cff', dark: '#552a9e', light: '#d6b8ff' },
  { color: '#e8c22a', dark: '#8a7010', light: '#fff09a' },
  { color: '#e65fb4', dark: '#8c2a68', light: '#ffb8e3' },
];

// Defense mode: hold out against waves that march in from the map's other corners.
const DEFENSE = {
  waves: 15,
  firstWave: 150,   // seconds to build up before the first wave
  interval: 60,     // seconds between waves
  bounty: 400,      // credits for clearing a wave, plus 100 per wave number
  // units a wave can field, by the wave they first appear in
  pool: [
    ['rifle', 1, 1], ['rocket', 1, 1], ['ifv', 2, 1.2], ['tank', 3, 2], ['heli', 4, 0.8],
    ['mlrs', 5, 0.7], ['phantom', 6, 0.6], ['railtank', 7, 1], ['titan', 7, 1], ['jet', 9, 0.6], ['bomber', 10, 0.4],
  ],
};
