// Cold War 2: 2030 — game data: factions, units, structures, damage tables.
'use strict';

const TILE = 32;
const TICK = 1 / 60;

// Each faction has a theme colour, an alternate used when both sides would look alike,
// a vehicle camouflage palette, display names for its line units and a small bonus.
// pkg selects the faction's special tank and superweapon: 'tech' (railgun + Orbital Lance)
// or 'heavy' (Titan + Hypersonic Silo).
const FACTIONS = {
  usa: {
    name: 'USA', tagline: 'Technology / Mobility / Air Power', pkg: 'tech', side: 'west',
    color: '#3d8bff', dark: '#1d4e9e', light: '#9cc6ff',
    alt: { color: '#24b8a4', dark: '#126b5f', light: '#93ecdf' },
    camo: ['#a08f68', '#7a6b4b', '#c2b088'],
    names: { rifle: 'Rifleman', tank: 'M1A3 Abrams', ifv: 'Stryker IFV', heli: 'AH-64E Apache', jet: 'F-35 Lightning II', sam: 'Patriot SAM' },
    bonus: { hp: { air: 1.25 } }, bonusText: 'Aircraft +25% armor',
  },
  russia: {
    name: 'Russia', tagline: 'Power / Endurance / Heavy Firepower', pkg: 'heavy', side: 'east',
    color: '#e8413a', dark: '#8c1f1b', light: '#ff9e98',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#6e7048', '#4f5134', '#8c8d60'],
    names: { rifle: 'Spetsnaz', tank: 'T-14 Armata', ifv: 'BMP-3', heli: 'Mi-28 Havoc', jet: 'Su-57 Felon', sam: 'S-400 Triumf' },
    bonus: { dmg: { vehicle: 1.15 } }, bonusText: 'Armor +15% firepower',
  },
  china: {
    name: 'China', tagline: 'Expansion / Innovation / Discipline', pkg: 'tech', side: 'east',
    color: '#e5322d', dark: '#86160f', light: '#ff9a92',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#566f48', '#3e5235', '#71895e'],
    names: { rifle: 'PLA Trooper', tank: 'Type 99A', ifv: 'ZBD-09 IFV', heli: 'Z-10 Attack Helicopter', jet: 'J-20 Mighty Dragon', sam: 'HQ-9 SAM' },
    bonus: { speed: { structure: 1.25, defense: 1.25 } }, bonusText: 'Structures build 25% faster',
  },
  eu: {
    name: 'EU', tagline: 'Cooperation / Sustainability / Advanced Defense', pkg: 'tech', side: 'west',
    color: '#4a72ff', dark: '#22379c', light: '#a9bcff',
    alt: { color: '#24b8a4', dark: '#126b5f', light: '#93ecdf' },
    camo: ['#5f6a55', '#454d3e', '#7b8670'],
    names: { rifle: 'Special Forces', tank: 'Leopard 2A7', ifv: 'Boxer IFV', heli: 'NH90 TTH', jet: 'Eurofighter Typhoon', sam: 'IRIS-T SLM' },
    bonus: { hp: { defense: 1.3 }, dmg: { defense: 1.2 } }, bonusText: 'Defenses +30% armor, +20% firepower',
  },
  soviet: {
    name: 'Soviet Union', tagline: 'Tradition / Strength / Revival', pkg: 'heavy', side: 'east',
    color: '#d92b2b', dark: '#7d1212', light: '#ff9a9a',
    alt: { color: '#ef9a2a', dark: '#93590f', light: '#ffd59a' },
    camo: ['#6a6a3e', '#4c4c2c', '#86865a'],
    names: { rifle: 'Motor Rifle', tank: 'T-90M', ifv: 'BTR-82A IFV', heli: 'Mi-24 Super Hind', jet: 'Su-57', sam: 'S-400 SAM' },
    bonus: { cost: { infantry: 0.75 } }, bonusText: 'Infantry 25% cheaper',
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

// Damage multipliers: warhead vs armor class.
const WARHEADS = {
  bullet:    { infantry: 1.0,  light: 0.45, heavy: 0.25, building: 0.25, air: 0.6 },
  cannon:    { infantry: 0.35, light: 1.0,  heavy: 0.85, building: 0.8,  air: 0 },
  rocket:    { infantry: 0.35, light: 1.0,  heavy: 0.9,  building: 0.7,  air: 1.25 },
  artillery: { infantry: 1.1,  light: 0.7,  heavy: 0.5,  building: 1.0,  air: 0 },
  rail:      { infantry: 0.8,  light: 1.1,  heavy: 1.0,  building: 0.7,  air: 0 },
  flak:      { infantry: 0.1,  light: 0.1,  heavy: 0.05, building: 0,    air: 1.0 },
  blast:     { infantry: 1.0,  light: 1.0,  heavy: 1.0,  building: 1.0,  air: 1.0 },
};

// speed & ranges are in tiles (per second), times in seconds.
const UNITS = {
  rifle: {
    name: 'Rifle Trooper', cat: 'infantry', armor: 'infantry', from: 'barracks', req: ['barracks'],
    cost: 200, time: 4, hp: 125, speed: 1.25, sight: 6, radius: 5, key: 'Q',
    weapon: { warhead: 'bullet', damage: 16, range: 5, cooldown: 0.9, proj: 'tracer', ground: true, air: true },
    desc: 'Cheap all-purpose infantry. Good against infantry.',
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
  ifv: {
    name: 'Recon IFV', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory'],
    cost: 600, time: 7, hp: 260, speed: 3.3, sight: 8, radius: 9, turn: 7, key: 'Q',
    weapon: { warhead: 'rocket', damage: 26, range: 6, cooldown: 1.1, proj: 'rocket', speed: 11, ground: true, air: true },
    desc: 'Fast scout with dual missiles. Hits air and ground.',
  },
  tank: {
    name: 'Battle Tank', cat: 'vehicle', armor: 'heavy', from: 'factory', req: ['factory'],
    cost: 900, time: 9, hp: 450, speed: 2.2, sight: 7, radius: 11, turn: 4, key: 'W',
    weapon: { warhead: 'cannon', damage: 62, range: 5.5, cooldown: 1.5, proj: 'shell', speed: 16, ground: true, air: false },
    desc: 'Main battle tank. The backbone of any assault.',
  },
  mlrs: {
    name: 'MLRS Artillery', cat: 'vehicle', armor: 'light', from: 'factory', req: ['factory', 'radar'],
    cost: 1100, time: 11, hp: 220, speed: 1.9, sight: 7, radius: 11, turn: 4, key: 'E',
    weapon: { warhead: 'artillery', damage: 70, range: 11, minRange: 3, cooldown: 4, proj: 'arty', speed: 8, splash: 1.4, burst: 3, ground: true, air: false },
    desc: 'Long-range saturation rockets. Devastating vs infantry and bases.',
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
  jet: {
    name: 'Fighter Jet', cat: 'air', armor: 'air', from: 'airfield', req: ['airfield', 'radar'],
    cost: 1400, time: 12, hp: 240, speed: 7.5, sight: 9, radius: 13, key: 'W', air: true, jet: true,
    weapon: { warhead: 'flak', damage: 70, range: 6, cooldown: 1.1, proj: 'rocket', speed: 18, ground: false, air: true },
    weapon2: { warhead: 'cannon', damage: 55, range: 5, cooldown: 1.6, proj: 'rocket', speed: 16, ground: true, air: false },
    desc: 'Supersonic multirole fighter. Wins the skies, strafes ground targets.',
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
  sam: {
    name: 'SAM Site', cat: 'defense', w: 1, h: 1, hp: 650, cost: 750, time: 7, power: -30, sight: 9, height: 20, req: ['radar'], key: 'E', needsPower: true,
    weapon: { warhead: 'flak', damage: 55, range: 9, cooldown: 1.1, proj: 'rocket', speed: 14, ground: false, air: true, burst: 2 },
    desc: 'Surface-to-air missiles. Requires power.',
  },
};

const PRODUCER_OF = { structure: 'cc', infantry: 'barracks', vehicle: 'factory', air: 'airfield' };

const TABS = [
  { id: 'structure', label: 'Base', list: ['power', 'refinery', 'barracks', 'factory', 'radar', 'airfield', 'tech', 'super_lance', 'super_silo'] },
  { id: 'defense', label: 'Defense', list: ['turret', 'railturret', 'sam'] },
  { id: 'infantry', label: 'Infantry', list: ['rifle', 'rocket', 'engineer'] },
  { id: 'vehicle', label: 'Armor', list: ['ifv', 'tank', 'mlrs', 'railtank', 'titan', 'harvester', 'mcv'] },
  { id: 'air', label: 'Air', list: ['heli', 'jet'] },
];

function defOf(key) { return UNITS[key] || BUILDINGS[key]; }

function queueTypeOf(key) {
  if (BUILDINGS[key]) return BUILDINGS[key].cat === 'defense' ? 'defense' : 'structure';
  const u = UNITS[key];
  return u.cat === 'infantry' ? 'infantry' : u.cat === 'air' ? 'air' : 'vehicle';
}

const DIFFICULTY = {
  easy:   { label: 'Easy',   build: 0.7, income: 0.8, firstAttack: 420, waveBase: 5, waveGrow: 1 },
  normal: { label: 'Normal', build: 1.0, income: 1.0, firstAttack: 300, waveBase: 7, waveGrow: 2 },
  hard:   { label: 'Brutal', build: 1.35, income: 1.35, firstAttack: 200, waveBase: 9, waveGrow: 3 },
};

const START_CREDITS = 10000;
const BUILD_RADIUS = 5; // tiles from an existing structure
