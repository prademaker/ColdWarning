# Cold War 2: 2030

*Same rivals. New world.* A base-building real-time strategy game in the spirit of *Command & Conquer: Red Alert 2*, set in the year 2030.

Five factions fight over rare-earth ore fields, each with its own roster, flag, colours and a small bonus:

| Faction | Style | Bonus | Special tank / superweapon |
| --- | --- | --- | --- |
| USA | Technology / Mobility / Air Power | Aircraft +25% armor | Railgun Tank / Orbital Lance |
| Russia | Power / Endurance / Heavy Firepower | Armor +15% firepower | Titan Tank / Hypersonic Silo |
| China | Expansion / Innovation / Discipline | Structures build 25% faster | Railgun Tank / Orbital Lance |
| EU | Cooperation / Sustainability / Advanced Defense | Defenses +30% armor, +20% firepower | Railgun Tank / Orbital Lance |
| Soviet Union | Tradition / Strength / Revival | Infantry 25% cheaper | Titan Tank / Hypersonic Silo |

Battles take place in five theaters: Temperate, Desert, Arctic, Steppe and Jungle.

## Play

No build step or install. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
If your browser blocks local files, serve the folder: `npx http-server .` and open the printed URL.

## Features

- Deploy your MCV into a Command Center and grow a base with a classic sidebar: build queues, hold/cancel, READY-to-place structures.
- Economy: harvesters mine gold ore and lithium crystals; fields slowly regrow.
- Power grid: low power slows production, disables the radar minimap and shuts off powered defenses.
- 11 unit types: infantry, engineers (capture buildings), IFVs, main battle tanks, MLRS artillery, faction super-tanks, attack helicopters and fighter jets.
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
| Set rally point | Select a Barracks/Factory/Airfield, right click on the map |
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
| `js/art.js` | 3D prism models for units, structures and scenery; sprite caches; sidebar cameos |
| `js/render.js` | Isometric draw loop: terrain chunks, depth-sorted sprites, effects, fog, overlays |
| `js/flags.js` | Faction flags as SVG |
| `js/ui.js` | Input, camera, sidebar, minimap |
| `js/audio.js` | Synthesized sound and announcer voice |
| `js/main.js` | Menu and main loop |

`index.html?autoplay` runs an AI-vs-AI match, which is handy for testing balance
(add `&faction=russia&enemy=eu&theater=arctic&seed=42` to pick the setup).

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
