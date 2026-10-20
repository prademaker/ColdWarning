# Cold War 2: 2030

*Same rivals. New world.* A base-building real-time strategy game in the spirit of *Command & Conquer: Red Alert 2*, set in the year 2030.

Two factions, the Allies and the Axis, fight over rare-earth ore fields with four countries each. Each faction
fields its own special infantry, light vehicle and artillery:

| Faction | Special infantry | Light vehicle | Artillery |
| --- | --- | --- | --- |
| Allies | Sniper: out-ranges infantry, useless vs armor | Recon IFV: fast scout, hits air and ground | MLRS: long-range rocket barrages |
| Axis | Flame Trooper: short-range, burns infantry and structures | Flak Track: shreds aircraft and infantry | Thermobaric Launcher: armored, huge blast |

Every country adds a unit with a special ability (◆) and an edge structure (■) that nobody else can build:

| Country | Faction | Bonus | ◆ Special unit | ■ Edge structure | Special tank / superweapon |
| --- | --- | --- | --- | --- | --- |
| USA | Allies | Aircraft +25% armor | MQ-9 Reaper: targets it hits take 25% more damage for 6 s | THAAD Battery: shoots down incoming artillery, missiles and rockets | Railgun Tank / Orbital Lance |
| EU | Allies | Defenses +30% armor, +20% firepower | Aegis Shield Carrier: nearby friendly units take 35% less damage | Laser Defense Tower: hits ground and air | Railgun Tank / Orbital Lance |
| United Kingdom | Allies | Infantry +25% armor | SAS Operative: hidden until it fires, C4 on structures | GCHQ Listening Post: shows every enemy unit on the map | Railgun Tank / Orbital Lance |
| Japan | Allies | Vehicles +15% armor | Raijin EMP Walker: EMP bolts shut down vehicles, helicopters and defenses | Robotics Plant: vehicles and aircraft build 50% faster | Railgun Tank / Orbital Lance |
| Russia | Axis | Armor +15% firepower | Iskander-M: missile strikes from 16 tiles | Krasukha EW Station: enemies nearby move and fire 35% slower | Titan Tank / Hypersonic Silo |
| China | Axis | Structures build 25% faster | Cyber Warfare Unit: hacks enemy vehicles over to your side | Support Hub: heals nearby units | Railgun Tank / Orbital Lance |
| Soviet Union | Axis | Infantry 25% cheaper | Kirov Airship: armored flying bomber | Propaganda Tower: nearby friendly units fire 30% faster | Titan Tank / Hypersonic Silo |
| North Korea | Axis | Defenses 25% cheaper | Demolition Truck: drives in and detonates, also blows up when destroyed | Koksan Gun Emplacement: 15-tile artillery, needs no power | Titan Tank / Hypersonic Silo |

Battles take place in five theaters: Temperate, Desert, Arctic, Steppe and Jungle, on land maps with lakes or on
naval maps (*Inland sea*, *Islands*) built around a big sea.

Both factions put to sea from a Naval Shipyard built out on the water:

| Ship | Who | Role |
| --- | --- | --- |
| Patrol Boat | everyone | fast gunboat, keeps helicopters off |
| Destroyer | everyone | deck gun, SAMs and anti-submarine torpedoes |
| Attack Submarine | everyone | hidden while submerged, torpedoes sink ships; only destroyers and submarines can hit it down there |
| Hovercraft | everyone | amphibious transport for 6 infantry or 2 vehicles |
| Missile Cruiser | Allies | cruise missiles strike structures 15 tiles inland |
| Battlecruiser | Axis | heavily armored, twin turrets shell the coast from 13 tiles |
| HMS Queen Elizabeth | United Kingdom | aircraft carrier: F-35B strikes on anything within 16 tiles; air defenses can shoot the jets down |
| Maya-class Aegis Destroyer | Japan | shoots down incoming missiles, rockets and artillery around the fleet |

## Play

No build step or install. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
If your browser blocks local files, serve the folder: `npx http-server .` and open the printed URL.

## Features

- Deploy your MCV into a Command Center and grow a base with a classic sidebar: build queues, hold/cancel, READY-to-place structures.
- Economy: harvesters mine gold ore and lithium crystals; fields slowly regrow.
- Power grid: low power slows production, disables the radar minimap and shuts off powered defenses.
- 31 unit types: infantry, engineers (capture buildings), faction-specific infantry, scouts and artillery, main battle tanks, super-tanks, a special unit for every country, attack helicopters, fighter jets and warships.
- Defenses: gatling turrets, rail turrets, SAM sites, battle bunkers. Superweapons on a five-minute charge.
- Navy: a shipyard that launches and repairs warships, submarines that run hidden, hovercraft landings (right-click a
  hovercraft with troops to board, beach it and press D to unload), carrier strikes and ships trailing wakes. The computer
  builds a navy when the sea near its base reaches the enemy: it extends its base to the shore, gathers a fleet off its
  shipyard, sails it at enemy ships and at whatever valuable structure lies within reach of the water, scouts the
  enemy coast when it knows nothing, and pulls a mauled fleet back for repairs.
- Garrisons, Red Alert 2 style: villages of civilian buildings dot the map, and infantry can move into them (or into your own
  Battle Bunker) to fire out of the windows with extra range and punch, untouchable until the building falls. A held building
  changes hands with its occupants; flamethrowers, thermobaric rockets and bombs burn the occupants out.
- Riflemen dig in behind sandbags: half the damage taken and a longer-ranged gun, but they can't move until they get up again.
- Veterancy (Veteran / Elite), tanks crushing infantry, fog of war, rally points, control groups, attack-move.
- Computer opponent that builds a base, harvests, defends, attacks in growing waves and fires its superweapon. Easy / Normal / Brutal.
  It plays by what it has seen: scouts look for enemy bases, the unit mix adapts to your army, waves gather before
  they strike and wait until the odds look good, losing waves pull back, raiders hunt harvesters, and on Normal and
  Brutal engineers ride along to capture key structures. Computer allies pick the same target. Riflemen waiting at the
  rally point dig in, bunkers get manned, a civilian building on its side of the map becomes an outpost, and attack waves
  send a few troopers into cover when they fight next to one.
- Skirmish line-ups for up to four players: 1v1, 1v2, 2v2, 2v1 (with a computer ally) and free-for-all for three or four. Allies share vision.
- Defense mode: no enemy base, just 15 waves marching on you from the other corners of the map, with super tanks every fifth wave. Clearing a wave pays a bounty, and *Send now* calls the next one early for bonus credits.
- Campaign, *Operation Northwind*: four missions with briefings, radio chatter, objectives and a mission select screen
  (each mission unlocks when you win the one before; add `?unlock` to the URL to open them all, or `?mission=<id>` to jump straight in).
  The Allies take on General Volkov's revived Soviet Union:
  1. **Thin Ice** (Arctic): Raven alone with a few Marines sneaks into a listening post, blows up its radar and runs for extraction.
  2. **Holdfast** (Temperate): as the EU, deploy, garrison the village and hold out against 8 waves. Raven arrives as reinforcement; the last wave brings a Kirov.
  3. **Countdown** (Steppe): a Russian base guards a Hypersonic Silo on a launch clock. Destroy it, steal it with an Engineer, or cut their power to stall the clock.
  4. **Red Storm** (Arctic, large): with an EU ally against Volkov's base and the Russian Expeditionary Force, Kirov vanguard included.
- Campaign hero, Commando **Raven**: enemies can't pick her out from more than 3 tiles away unless she fired in the last few seconds, her rifle drops a
  soldier with each shot at long range, she heals when out of combat, and right-clicking an enemy structure with her plants a C4 charge that destroys it
  (and anyone garrisoned inside). Tanks can't crush her. When her survival is an objective, losing her loses the mission.
- Procedurally generated maps (seeded) in three sizes.
- Audio is all synthesized in the browser, with no sound files:
  - Layered weapon and explosion effects, panned to where they happen on screen, with reverb and theater wind ambience.
  - Spoken announcer and unit replies (via the browser's speech engine).
  - A generative soundtrack of seven tracks in an industrial/military rock style. Calm stretches play drums, bass, pads and arpeggios; when your forces are in combat, distorted guitars, brass stabs and a lead come in.

## Controls

| Action | Input |
| --- | --- |
| Select / box select | Left click / drag (Shift adds) |
| Select all of a type on screen | Double-click |
| Move / attack / harvest / capture / garrison | Right click |
| Attack-move | `A` then click, or Ctrl + right click |
| Stop / deploy MCV | `S` / `D` (or click a selected MCV) |
| Dig riflemen in or out / empty a garrison | `D` with them (or the building) selected |
| Control groups | Ctrl+`1-9` to assign, `1-9` to recall (twice to jump) |
| Build tabs / hotkeys | `Tab`, `Q` `W` `E` `R` `T` `Y` `U` `I` |
| Sell / repair / superweapon | `Z` / `X` / `F` |
| Set rally point | Select a Barracks/Factory/Airfield, right click on the map |
| Primary production building | Double-click it |
| Jump to base / last alert | `H` / `Space` |
| Scroll | Arrow keys, screen edges, middle-mouse drag, minimap |
| Pause / mute / next music track | `P` / `M` / `N` |

## Code layout

| File | Purpose |
| --- | --- |
| `js/config.js` | Factions, unit and structure stats, damage tables |
| `js/map.js` | Seeded terrain and ore generation, A* pathfinding |
| `js/game.js` | Simulation: units, combat, harvesting, production, power, fog |
| `js/ai.js` | Computer opponent |
| `js/waves.js` | Defense mode waves |
| `js/campaign.js` | Campaign missions (data plus a small script each) and the mission runtime: objectives, radio, markers, timers |
| `js/art.js` | 3D prism models for units, structures and scenery; sprite caches; sidebar cameos |
| `js/render.js` | Isometric draw loop: terrain chunks, depth-sorted sprites, effects, fog, overlays |
| `js/flags.js` | Faction flags as SVG |
| `js/ui.js` | Input, camera, sidebar, minimap |
| `js/audio.js` | Synthesized sound effects, ambience, announcer and unit voices |
| `js/music.js` | Generative soundtrack that follows the battle |
| `js/main.js` | Menu and main loop |

`index.html?autoplay` runs an AI-vs-AI match, which is handy for testing balance
(add `&faction=russia&enemy=eu&theater=arctic&seed=42` to pick the setup, `&lineup=2v2` or `ffa4` for more players,
`&map=small|medium|large`, `&mode=defense`, `&difficulty=easy|normal|hard`).

## Art

The visual style follows the concept sheet in `assets/source/mock.webp`. Sidebar cameos, theater previews,
the logo and menu banners are cut from it by `tools/extract_assets.py` (needs Pillow):

```
python3 tools/extract_assets.py
```

The battlefield uses a Red Alert 2 style isometric view. Units, structures, trees and rocks are small
3D models built from shaded prisms in `js/art.js` (camouflage, team colours, lit windows), rendered
in 32 facings and cached as sprites. The game logic still runs on a square tile grid; only the view
is projected.

### Model sprites

Units can also use real 3D models. `tools/sprites/render.js` renders glTF/.glb models with three.js
into 32-facing sprite sheets at the game's camera angle, plus a mask of the paintable hull that the
game tints with the faction camouflage and team colour. The tank, IFV and attack helicopter currently
use models from ITHappy Studios' free *Military Free* pack.

```
cd tools/sprites && npm install
node render.js /path/to/Separate_Assets_glb    # writes assets/sprites/
```

The model files are not in this repository: the pack's licence allows using them in a game but not
redistributing the files. Keep your download elsewhere and point the tool at it. Which model plays
which unit (and its size) is configured at the top of `render.js`.

All units are voxel models in the style of Red Alert 2, painted in a middle ground between the two
looks: camouflaged armour in each faction's colours with team-coloured accents (fender stripes, turret
bands, tail fins, backpacks). The renderer reads MagicaVoxel `.vox` files; palette indices 1-8 are the
team colour ramp and 9-11 the camouflage, both stored as greys and painted per player and faction.
`assets/voxels/` holds the models, generated by `tools/sprites/voxel_tank.js` and
`tools/sprites/voxel_units.js` and `tools/sprites/voxel_naval.js` (open them in MagicaVoxel to refine them, then re-run
`node render.js <models> <key>...`, e.g. `tank_vox`). Infantry have three walk frames and the harvester
has an empty and a loaded model. Structures are voxel models too (`tools/sprites/voxel_buildings.js`,
one voxel = 2 game pixels): concrete and steel with team-coloured roofs, while flags, lights, the radar
dish and superweapon effects are drawn live on top. Defences have separately rotating guns. Open the game with `?style=model` to use the ITHappy tank, IFV and
helicopter instead.
