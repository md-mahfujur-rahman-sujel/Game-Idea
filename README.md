# Little Batch Works

A cozy 3D voxel conveyor-routing game. Build a wide food workshop, route the belts, and serve the market. This repository contains the **web build** (Vite + Three.js, vanilla JavaScript).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build and preview

```bash
npm run build      # static output in dist/
npm run preview    # serve the production build
```

The build is fully offline: voxel models are built from Three.js geometry, all audio is synthesised with WebAudio, and there are no network requests or third-party assets.

## Test and validate

```bash
npm test             # unit tests for the simulation, state, objectives and saves
npm run check:levels # validate levels, recipes, reachability and budget headroom
npm run check        # tests, level validation and a production build in one pass
```

The suite uses Node's built-in test runner, so it needs no extra dependencies. The level checker reads the same authored data the game ships and fails on unknown items or buildings, overlapping preplaced pieces, broken fixed-belt lines, unreachable orders, and levels whose required buildings cost more than their starting coins. CI runs the same commands on every push and pull request.

## Controls

| Action | Input |
| --- | --- |
| Place / select | Click or tap |
| Rotate placement | `R` or the rotate button |
| Cancel placement | `Esc` |
| Pan | Arrow keys, touch drag, right/middle mouse drag, or the camera cluster |
| Rotate the 3D world around its vertical axis | Horizontal left-drag; two-finger twist on touch |
| Zoom | `+` / `-`, mouse wheel, or the camera cluster |
| Pause / resume | `Space` or `P` |
| Simulation speed | `1`, `2` |
| Mute | `M` |
| Toggle hints | `H` |
| Workshop report | `I` or the chart button in the top bar / mobile rail |

Touch controls are available through the on-screen HUD. On short landscape screens the three panels collapse into a bottom sheet rail.

## Project layout

```
index.html            app shell (#game canvas, #ui overlay, rotate prompt)
public/               static files copied into the build (robots.txt)
src/main.js           controller: boot, save lifecycle, fixed tick, input, routing
src/core/             grid directions, level state, deterministic simulation, objectives, save, audio, diagnostics
src/data/             buildings/recipes, items, authored levels
src/render/           Three.js voxel world and model builder
src/ui/               DOM menus, HUD, dialogs, original SVG icon set
src/styles.css        design system and responsive layout
tests/                Node unit tests for simulation, state, objectives, reports and saves
scripts/              authored-content validator
.github/workflows/    CI: test, validate and build
prd.md                canonical product requirements (v3.7)
```

## Save data

Progress is stored locally in one versioned document: IndexedDB first, with a localStorage fallback. A previous-good backup slot is kept, and saved state is sanitised before it is trusted. There is no account and no network sync.

## Internal reference material

`reference/` is an internal mood reference only. It is never bundled, published, or shipped in any build, installer, or store listing, and packaging must exclude that directory. Artists must not trace it. All names, characters, buildings, layouts, signage, iconography, and branding in the game are original.
