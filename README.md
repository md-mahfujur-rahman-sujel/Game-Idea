# Little Batch Works

A cozy 3D conveyor-routing tycoon. Build a food workshop, route the belts, serve the market, and grow a town through an ongoing saga. The shared Vite + Three.js codebase builds for web, Windows Electron, and Android Capacitor.

The seven-stage opening campaign teaches basic production, split routing, merging, and a wheat-to-tart bakery chain before Town mode unlocks. Town mode keeps the workshop layout and progress, grows through an uncapped level track, and continues with repeatable saga chapters. Weekly goals, fast-delivery bonuses, and optional Rush Hour add variety without order failure. Story progress, weekly goals, the active saga chapter, and Rush Hour timers are stored in the local save.

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

## Native builds

```bash
npm run build:windows   # Windows x64 NSIS installer and portable .exe in release/
npm run build:android   # APK in release/Little-Batch-Works.apk
```

The Android build needs Android Studio's SDK and a Java 21+ JDK installed. On Windows, the script detects the usual Android SDK folder and a modern JDK under `Program Files`; on other systems, configure `ANDROID_HOME` and `JAVA_HOME`. With no signing variables set, it produces a debug-signed APK for sideloading. To make a release-signed APK, set `LBW_ANDROID_KEYSTORE`, `LBW_ANDROID_STORE_PASSWORD`, `LBW_ANDROID_KEY_ALIAS`, and `LBW_ANDROID_KEY_PASSWORD` before running the same command. Android and Windows keep a JSON mirror of the shared save document in their app-private data folders.

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
| Pan | Arrow keys outside the focused world, touch drag, right/middle mouse drag, or the camera cluster |
| Move the keyboard world cursor | Arrow keys when the world canvas is focused |
| Place / select at keyboard cursor | `Enter`; focus the world with `G` |
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
prd.md                canonical product requirements (v4.7)
```

## Save data

Progress is stored locally in one versioned document: IndexedDB first, with a localStorage fallback. The active level and Town workshop layout are saved separately so leaving Town mode does not erase its layout. Ordered v1-to-v5 migrations preserve existing progress and add Town goals, router buffers, fruit-tart tracking, and Rush Hour state. A previous-good backup slot is kept, and saved state is sanitised before it is trusted. There is no account and no network sync.

## Internal reference material

`reference/` is an internal mood reference only. It is never bundled, published, or shipped in any build, installer, or store listing, and packaging must exclude that directory. Artists must not trace it. All names, characters, buildings, layouts, signage, iconography, and branding in the game are original.
