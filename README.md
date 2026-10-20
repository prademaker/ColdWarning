# Cold Warning

A base-building real-time strategy game in the spirit of *Command & Conquer: Red Alert 2*, set in the year 2030.

Two factions fight over rare-earth ore fields: the **Atlantic Coalition** (railgun tanks, Orbital Lance satellite strike)
and the **Eurasian Bloc** (Titan heavy tanks, Hypersonic Silo).

## Play

No build step or install. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
If your browser blocks local files, serve the folder: `npx http-server .` and open the printed URL.

## Features

- Deploy your MCV into a Command Center and grow a base with a classic sidebar: build queues, hold/cancel, READY-to-place structures.
- Economy: harvesters mine gold ore and lithium crystals; fields slowly regrow.
- Power grid: low power slows production, disables the radar minimap and shuts off powered defenses.
- 11 unit types: infantry, engineers (capture buildings), IFVs, tanks, MLRS artillery, faction super-tanks, attack drones and interceptors.
- Defenses: gatling turrets, rail turrets, SAM sites. Superweapons on a five-minute charge.
- Veterancy (Veteran / Elite), tanks crushing infantry, fog of war, rally points, control groups, attack-move.
- Computer opponent that builds a base, harvests, defends, attacks in growing waves and fires its superweapon. Easy / Normal / Brutal.
- Procedurally generated maps (seeded), synthesized sound effects, spoken announcer lines.

## Controls

| Action | Input |
| --- | --- |
| Select / box select | Left click / drag (Shift adds) |
| Select all of a type on screen | Double-click |
| Move / attack / harvest / capture | Right click |
| Attack-move | `A` then click, or Ctrl + right click |
| Stop / deploy MCV | `S` / `D` (or click a selected MCV) |
| Control groups | Ctrl+`1-9` to assign, `1-9` to recall (twice to jump) |
| Build tabs / hotkeys | `Tab`, `Q` `W` `E` `R` `T` `Y` `U` `I` |
| Sell / repair / superweapon | `Z` / `X` / `F` |
| Set rally point | Select a Barracks/Factory/Drone Hub, right click on the map |
| Primary production building | Double-click it |
| Jump to base / last alert | `H` / `Space` |
| Scroll | Arrow keys, screen edges, middle-mouse drag, minimap |
| Pause / mute | `P` / `M` |

## Code layout

| File | Purpose |
| --- | --- |
| `js/config.js` | Factions, unit and structure stats, damage tables |
| `js/map.js` | Seeded terrain and ore generation, A* pathfinding |
| `js/game.js` | Simulation: units, combat, harvesting, production, power, fog |
| `js/ai.js` | Computer opponent |
| `js/render.js` | Procedural drawing of terrain, structures, units, effects |
| `js/ui.js` | Input, camera, sidebar, minimap |
| `js/audio.js` | Synthesized sound and announcer voice |
| `js/main.js` | Menu and main loop |

`index.html?autoplay` runs an AI-vs-AI match, which is handy for testing balance.
