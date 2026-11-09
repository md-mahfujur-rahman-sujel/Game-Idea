# Product Requirements Document: Little Batch Works

**Status:** Final draft for production
**Version:** 4.1 (supersedes v4.0 and all earlier drafts)
**Date:** 2026-11-09
**Product type:** 3D voxel factory tycoon, shipped for web, Windows, and Android
**Build targets:** Browser (web) · Windows 10/11 x64 (`.exe`) · Android 8.0+ (`.apk`)
**Working title:** *Little Batch Works* (alternate candidate: *Frostline Factory*; verify name availability before public use)

### Changes from v4.0

| # | Change |
|---|---|
| 1 | Added a style direction to §9 drawn from `suggestions.md`: a cute, rounded, "chibi" character language, clean pastel fills with soft shading, and shape-first readability, all stated as mood targets and translated into our 3D rounded-block look. |
| 2 | Recorded comparable titles (Two Point Campus and Hospital, Parkitect, Let's Build a Zoo, Bear & Breakfast, Littlewood) as benchmarks for charm, readability, and cozy narrative pacing in §9. They are not asset sources and nothing from them may be copied. |
| 3 | Required worker and customer characters to be original non-penguin designs with a stated species or role sheet, so the "chibi" direction cannot drift toward the source brand's mascots. |
| 4 | Extended the IP checklist (§9) so style keywords and comparable titles cannot be used to justify matching any specific artwork. |
| 5 | Marked `suggestions.md` as a reference note only. It is not a build input and never overrides this document. |

### Changes from v3.7

| # | Change |
|---|---|
| 1 | Added a long-term meta-game (§6.8a): a persistent Town mode with XP and Town Levels, an unlock tree, a rotating order board, daily goals, land expansion, and story chapters, so play extends from a 30–45 minute campaign to many hours on Windows and Android. The four authored levels become Story Chapter 1 and the tutorial for it. |
| 2 | Added a motion, physics, and effects spec (§6.11): smooth belt-item interpolation between 10 Hz ticks, a cosmetic physics layer (springs, bounces, pooled particles), and an explicit rule that none of it may affect the deterministic simulation. |
| 3 | Replaced the finite floating island with a continuous world: meadow around the board, rolling hills to the horizon, distant forest, and fog-hidden edges. No keel, rim, or visible underside (§4, §7). |
| 4 | Added a graphics upgrade target list for machines, buildings, items, belts, characters, and effects (§7). |
| 5 | Made the progression features (town mode, order board, daily streaks, offline batch) explicit requirements FR-27 to FR-34 and added save schema v2 fields. |
| 6 | Reconciled the economy: no premium currency, ads, energy limits, or pay-to-skip timers remain in force (§6.7); long-term pull comes from visible next unlocks, not pressure. |

### Changes from v3.6

| # | Change |
|---|---|
| 1 | Centered camera orbit on the island's visual center, framed the full island by default, and defined horizontal/vertical orbit ranges and momentum. |
| 2 | Disambiguated click/tap from camera orbit with a 5 CSS px drag threshold shared by mouse and touch. |
| 3 | Capped cold-chain refreezing with progressively shorter freshness so a tub cannot loop forever; spoiled goods remain visible and removable. |
| 4 | Added a validated daily local recovery snapshot and an explicit failure path when every local save copy is invalid or unavailable. |
| 5 | Added a compact, mutually exclusive panel layout for landscape viewports below 800 CSS px. |

### Changes from v3.5

| # | Change |
|---|---|
| 1 | Set the visual goal to the closest *original* match of the reference's mood, palette, camera, and scene composition: green field, pastel-blue voxel machinery, blue roller belts, orchard-to-stall flow, and a central dessert landmark. |
| 2 | Made the expression-level boundary explicit and unchanged: no wordmark or text, no penguins or lookalikes, no traced or reused pixels, no exact character or building artwork. "Identical to the reference" is not a requirement and cannot pass the IP checklist. |
| 3 | Added a side-by-side look-and-feel review (§9) that scores palette, camera, composition, and density, separate from the IP checklist. |
| 4 | Required clear belt direction markers and per-role worker tasks in the 3D scene (§6.6, §9). |
| 5 | Changed the world from blocky terrain to a smooth, round, hilly island with a rounded rim and soil-to-stone underside; blocks have rounded edges and trees are soft and rounded. "Voxel" in this document now means a modular, rounded-block build kit, and the scene must not read as Minecraft-like (§6.1, §7, §9). |
| 6 | Replaced pan-first camera controls with globe-style orbit: drag spins and tilts with momentum, right-drag or Shift-drag pans, the wheel zooms toward the pointer, and touch adds two-finger twist and pan (§4, §6.1, §8, FR-11, FR-22). |

### Changes from v3.4

| # | Change |
|---|---|
| 1 | Replaced the 2D Phaser scene with a Three.js 3D voxel world and orbit camera. |
| 2 | Expanded authored maps from 24 × 16 to 40 × 26 tiles and added more world scenery. |
| 3 | Shifted the art palette toward green terrain, pastel-blue machinery, blue conveyors, and a larger dessert landmark. |
| 4 | Updated the reference guidance to allow closer use of the requested color mood and overall food-factory composition while keeping game assets original. |

---

## 1. Summary

*Little Batch Works* is a cozy conveyor-routing tycoon. Players grow fruit and tea, route ingredients along belts through compact machines, and deliver ice cream and tea to customers. Challenge comes from layout, throughput, and a single signature mechanic — the **cold chain** — not from real-time stress.

It ships three ways from one codebase: a browser game, a Windows desktop app, and an Android app. All three run fully offline, share the same save format, and contain the same content.

The game takes visual direction from a cheerful, dense food-factory illustration, translated into an original 3D voxel world. **All names, characters, buildings, signage, voxel models, and branding are made for Little Batch Works.** The mood reference is stored at `reference/source-image.png` (internal only, never shipped); §9 records the updated visual direction.

**Player promise:** "I can build a clever little food factory, see it come alive, and keep finding ways to improve it."

### Design pillars

1. **Readable logistics:** a player can trace any item from source to order.
2. **Small, satisfying decisions:** each machine, route, or upgrade solves a visible problem.
3. **A living workshop:** machines animate, workers move with purpose, customers react.
4. **Gentle mastery:** depth without punishment; pause is always available.
5. **Short sessions:** 5–20 minutes; progress is always saved and resumable.

---

## 2. Goals and non-goals

### Goals

- Ship a polished MVP: an interactive tutorial plus three authored levels in one compact world.
- Teach belt routing and production chains through guided onboarding, then remove the training wheels.
- Make blockages and spoilage diagnosable at a glance.
- Differentiate from generic idle tycoons with one signature mechanic: the cold chain.
- Use a modular original voxel kit a small team can extend.
- Persist progress locally and recover gracefully from refreshes.
- Ship three distributable builds — web, Windows `.exe`, Android `.apk` — each fully playable offline with the same content and save format.

### Non-goals for v1

- Multiplayer, co-op, leaderboards, or user-generated content.
- A simulated market, pricing, supply contracts, or deep staff management.
- Procedural worlds, free build, or a sandbox map editor.
- iOS, macOS, and Linux builds; controller support; tablet-specific or portrait-first layouts.
- Complex physics, realistic food chemistry, or employee needs (hunger, wages, skills).
- Monetization, ads, loot boxes, premium currency, or consumables.
- Additional food businesses beyond ice cream and tea.
- Online accounts or cloud saves.
- Reproducing the source image's characters, company identity, graphic design, or layout.

---

## 3. Target audience

| Segment | Description | Needs |
|---|---|---|
| Casual tycoon / cozy players (12+) | Short sessions, low patience for dense UIs | Clear goals, quick wins, forgiving penalties |
| Light-automation fans | Enjoy Mini Motorways, Factorio-lite | Optimization depth, meaningful upgrades |
| Factory-curious newcomers | Intimidated by hardcore automation games | Icons + plain language, readable failure states |

### Accessibility and comfort requirements

- No information is conveyed by color alone: every critical state uses icon + text + shape.
- UI text is at least 14 px at the minimum viewport; scale with browser zoom without clipping.
- Pause is always reachable, including during tutorials and cutscenes; pause halts production **and** patience timers.
- Reduced-motion setting disables belt-item bobbing, screen shake, and idle animations.
- Independent music and SFX volume, plus a single mute control.
- No flashing above 3 Hz. Blockage and spoilage cues are informative, never alarm-like.
- Keyboard access covers menus, pause, pan/zoom, and build-mode exit; focus is always visible.
- Touch targets are at least 44 × 44 px, and every gesture has a visible button equivalent (pan, zoom, cancel placement).
- HTML overlay panels carry screen-reader labels; the canvas is never the sole carrier of required text.

---

## 4. Platforms and technical assumptions

| Area | Decision |
|---|---|
| Platform (v1) | Three builds from one codebase: **web** (Chrome, Firefox, Edge, Safari — current stable), **Windows 10/11 x64** desktop app, **Android 8.0+ (API 26)** app. |
| Desktop wrapper | **Electron**, yielding an NSIS per-user installer and a portable `.exe`. Tauri is an approved substitute if installer size becomes a blocker. |
| Android wrapper | **Capacitor**, packaged with Gradle in Android Studio into a signed release APK. |
| Minimum viewport | Web and Windows: 1024 × 700 CSS px. Android: 640 × 360 CSS px in landscape, with a UI scale factor. Smaller sizes show a resize or rotate prompt rather than hiding controls. |
| Mobile orientation | Landscape locked for v1; portrait shows a clear rotate prompt. |
| Compact HUD | Below 800 CSS px wide, Build, Orders, and Inspector use one mutually exclusive scrollable bottom sheet or full-screen panel at a time; do not pin all side panels simultaneously. Keep a persistent compact status bar and 44 × 44 CSS px minimum touch targets. |
| Format | HTML5 game; no backend and no network access required after install or load in any build. |
| Engine | Three.js (current stable) + JavaScript, WebGL renderer. No Canvas fallback. |
| Rendering | True 3D perspective world assembled from softly rounded blocks and modular models, set in a continuous rolling landscape (meadow, hills, distant forest) that fades into fog at the horizon. |
| Camera | Elevated three-quarter view by default, framed around the island's visual center. The orbit pivot stays fixed at the island center; horizontal drag covers 360° per canvas width, and vertical drag covers the overhead-to-underneath range per canvas height, with a small pole safety margin. Mouse or one-finger movement over 5 CSS px (|dx| + |dy|) cancels a click/tap and starts orbit; movement at or below the threshold selects or places. Right-drag, middle-drag, or Shift-drag pans; the wheel zooms toward the pointer; touch adds two-finger pinch zoom, twist rotate, and pan. A short momentum glide follows release; reduced motion disables momentum. |
| UI | Three.js world with HTML/CSS overlays for menus, settings, order panel, and text-heavy panels. Overlays are shared by all three builds. |
| Build | Vite for the shared bundle; `electron-builder` for Windows packaging; `@capacitor/android` + Gradle for the APK. One commit produces all artifacts. |
| Persistence | One versioned schema behind a `SaveStore` interface: IndexedDB on web; IndexedDB plus a JSON mirror in Electron's `userData`; IndexedDB plus a JSON mirror via Capacitor Filesystem on Android. |
| Audio | Web Audio; Howler.js optional, not required. |
| Distribution | Web on static hosting; `.exe` as direct download (installer + portable); `.apk` as signed sideload; Play Store AAB in post-MVP. |
| Reference asset | `reference/source-image.png` is an internal mood reference only. It is never bundled, published, or shipped in any build, and packaging config must exclude the `reference/` directory. |
| Permissions | Android: no dangerous permissions and no network permission required for play. Windows: per-user install, no admin rights. |
| Map bounds | Fixed authored maps, up to 40 × 26 tiles for the expanded world. |
| Simulation | Deterministic discrete ticks at 10 Hz (100 ms). Rendering is frame-based. Pause stops all progression. |
| Team assumption | Solo developer or 2–4 people, including release engineering for three targets. Scope favors a complete vertical slice over content breadth. |

### Performance and load budgets

| Metric | Target |
|---|---|
| Frame rate | 60 FPS on a typical recent laptop at the largest MVP level; 30 FPS floor on lower-end supported desktops. 60 FPS target / 30 FPS floor on a 2021-or-newer mid-range Android device. |
| First playable | Under 5 seconds: web on typical broadband, or cold app start on Windows/Android |
| Initial shell download | ≤ 1.5 MB gzipped (code + UI + tutorial art) |
| Full first-level download | ≤ 8 MB total on web; bundled inside the EXE and APK. Later levels lazy-loaded on web. |
| Windows installer | ≤ 120 MB installed (Electron baseline); portable build optional but must also run offline |
| Android APK | ≤ 50 MB universal APK; per-ABI splits optional if the universal build exceeds the cap |
| Memory | No unbounded entity creation; item meshes pooled; hard cap on simultaneously active belt items; render DPR capped at 2 on Android |
| Lifecycle | Android backgrounding and Windows window close preserve full state; relaunch restores it |

Technology versions and browser support must be rechecked at implementation start.

---

## 5. Core gameplay loop

1. **Read demand:** inspect current customer orders and required products.
2. **Gather inputs:** orchards, tea patch, pump, and dairy crate supply raw ingredients.
3. **Plan flow:** place machines and belts on the grid, connecting outputs to compatible inputs.
4. **Run production:** start, pause, or speed the simulation and watch items move.
5. **Diagnose:** follow items, read buffers, find starved or blocked machines, watch freshness.
6. **Serve:** deliver finished products to the service counter.
7. **Earn:** collect coins and reputation; orders advance the level objective.
8. **Improve:** buy machines, belts, and upgrades; unlock the next level.
9. **Repeat:** new product combinations and tighter layouts.

Target session length 5–20 minutes. No requirement to stay online or keep the tab open.

---

## 6. Systems

### 6.1 3D voxel grid and building

- The factory sits on a square build grid in a 3D world. Tile boundaries and buildable-area edges are visible in build mode.
- Footprints are 1×1 or 2×2 tiles. Footprints are shown in the placement ghost.
- Valid placement shows a filled green ghost **and** a check mark; invalid placement shows a hatched ghost, an X, and a one-line reason (e.g., "Blocked by belt", "Needs an edge tile", "Not enough coins").
- Objects can be selected, rotated where orientation matters, moved, and sold at a 70% refund. Moving is free within the same level.
- Objects cannot overlap, hang off the map, or occupy reserved tiles (level entrances, fixed decor).
- Camera orbit stays centered on the island's visual center and does not pan the world. Dragging or one-finger movement over 5 CSS px (|dx| + |dy|) cancels selection/placement and orbits; smaller movement is a click/tap. Horizontal movement orbits through 360° per canvas width; vertical movement orbits from overhead to underneath per canvas height, with a small safety margin at each pole. Right-drag, Shift-drag, arrow keys, and on-screen buttons pan; the wheel zooms toward the pointer. Zoom clamps so tiles never become smaller than 32 px on web/Windows or 24 px on Android.
- **Build mode pauses the simulation by default.** Planning while running is a post-MVP option.
- Terrain is decorative unless a level marks a tile as non-buildable; those tiles are visibly distinct in shape, not just tint.

### 6.2 Conveyors and routing

- Belts move one item per segment, one tile per second (one tile per 10 logic ticks), in a fixed direction.
- The MVP ships **straight and corner** pieces only. Splitters and mergers are post-MVP.
- Belts connect only when direction and machine ports are compatible. The placement ghost previews the connection: a lit arrow at the outgoing edge, a lit socket at the receiving port, and an explicit mismatch reason otherwise.
- **No direct port-to-port transfer.** Every transfer from a source or machine output to another machine or counter input needs at least one belt tile between the ports. Two adjacent ports never connect on their own; the placement ghost shows the missing link.
- An item advances only when the next segment or machine input socket has room. A blocked item stays visible on its segment; the segment shows a blocked icon.
- Machines accept only the item types declared for each input socket and hold limited buffers (default: 2 per input socket, 2 output). A wrong-type item is never accepted and the socket reports "wrong item type".
- **Any item on a belt can be removed:** select the item, choose Remove, and confirm. The item is discarded with no refund and the segment frees immediately. This is the guaranteed remedy for wrong-type items and spoiled goods; no belt can be permanently deadlocked.
- The inspection UI names the origin of a blockage ("Freezer output full", "Washer needs peaches") and highlights the affected belt path.
- Clicking any item shows its type and freshness if applicable.
- The MVP has no branching belts, so every belt run is a single unambiguous path from one output to one input socket.

### 6.3 Ingredients, recipes, and machines

**Sources (4):**

| Source | Output | Notes |
|---|---|---|
| Orchard (peach-apple) | Peach and Apple, on two separate output tiles | Each fruit lane has its own output buffer of 2 and pauses independently when full, so an undrained lane never blocks the other. |
| Tea Patch | Tea Leaves | 1 leaf every 6 s |
| Water Pump | Water | 1 water every 5 s |
| Dairy Crate | Cream | **Manual purchase:** 8 coins per cream, emitted on request; cap 12 per level. The crate idles until the player buys. |

Sugar is removed from the game: no recipe uses it.

**Processors (5):** Washer, Press, Brewer, Mixer, Freezer.
**Service (1):** Service Counter.

**Recipes (8, all data-driven):**

| # | Input | Machine | Output | Time |
|---|---|---|---|---|
| R1 | Peach | Washer | Washed Peach | 3 s |
| R2 | Apple | Washer | Washed Apple | 3 s |
| R3 | Washed Peach | Press | Peach Base | 4 s |
| R4 | Washed Apple | Press | Apple Base | 4 s |
| R5 | Tea Leaves (socket A) + Water (socket B) | Brewer | Brewed Tea | 6 s |
| R6 | Peach Base (socket A) + Cream (socket B) | Mixer | Peach Ice Cream Mix | 5 s |
| R7 | Apple Base (socket A) + Cream (socket B) | Mixer | Apple Ice Cream Mix | 5 s |
| R8 | Ice Cream Mix **or** Melted Mix | Freezer | Ice Cream Tub | 8 s (4 s for Melted Mix) |

**Service Counter accepts:** Washed Peach, Washed Apple, Peach Base, Apple Base, Brewed Tea, and Ice Cream Tub. Packing is a counter animation, not a recipe. The counter input buffer holds 2 items and is chilled: items inside it do not age.

#### Machine ports

Every machine port is a visible socket on a specific tile edge, labeled with the item icon it accepts. A socket accepts one **item family** — a single type, or a declared set:

| Socket family | Members |
|---|---|
| Any fruit | Peach, Apple |
| Any washed fruit | Washed Peach, Washed Apple |
| Any fruit base | Peach Base, Apple Base |
| Ice Cream Mix family | Ice Cream Mix, Melted Mix |
| Counter items | Washed Peach, Washed Apple, Peach Base, Apple Base, Brewed Tea, Ice Cream Tub |

| Machine | Input sockets | Output |
|---|---|---|
| Washer | 1 (any fruit) | 1 |
| Press | 1 (any washed fruit) | 1 |
| Brewer | 2: **A** Tea Leaves, **B** Water | 1 |
| Mixer | 2: **A** any fruit base, **B** Cream | 1 |
| Freezer | 1 (Ice Cream Mix family) | 1 |
| Service Counter | 1 (counter items) | — |

- Each input socket has its own buffer of 2 items; a full socket blocks only its own belt.
- A two-input machine starts a recipe only when both sockets hold a valid item. If one socket is empty, the machine shows a "needs <item>" status badge on that socket.
- A Mixer produces a mix of the same fruit as its base input; mixing fruits is not allowed, and a mismatched item is rejected with a clear reason.
- Because there are no mergers, each ingredient reaches a two-input machine by its own belt. The tutorial and level layouts leave room for two entry edges.

Each machine also has: base processing time, visual states (idle / working / blocked / disabled), and an inspect panel showing recipe, progress, buffers, and upgrades. All values live in content data files, never in presentation code.

**Upgrades (2 tracks maximum, MVP):**

| Track | Levels | Effect | Cost |
|---|---|---|---|
| Processing speed (per machine) | 0 → 2 | −20% processing time per level | 40 / 90 coins |
| Cooling capacity (Freezer only, if cold chain ships) | 0 → 1 | Chilled output capacity 4 → 8 tubs | 60 coins |

Upgrades never invalidate existing recipes and never change footprint.

### 6.4 Signature mechanic: Cold chain

This is the game's single differentiator. It ships as the **last cuttable P1 feature**, built only after the core belt-and-order loop is stable.

**Rules:**

- The Freezer's output buffer is **chilled** and holds **4 tubs** (8 after the cooling upgrade). Tubs inside it do not age. If the output is full, the Freezer shows "Freezer output full" and stops; nothing is lost.
- A tub's **freshness timer starts when it leaves the Freezer output onto a belt** and runs for **45 seconds** while it is on belts. Freshness pauses when the tub enters the Service Counter's chilled buffer, and a tub is consumed when an order takes it.
- The timer **keeps running while the tub is blocked on a belt** (for example, when the counter buffer is full). This is the core tension: long routes and backed-up belts cost freshness.
- At **15 seconds remaining**, the tub shows a warning icon, a distinct shape badge, and a short tooltip: "Melting — reach the counter".
- When freshness expires, the tub becomes **Melted Mix**, a salvageable item that stays on the belt. Melted Mix can be re-frozen by a Freezer in **4 seconds** (half the normal freeze). Refreezing is limited to **two cycles per tub**: the first refrozen tub gets **30 seconds** of freshness when it leaves the output; the second gets **15 seconds**. After that tub melts again, it stays as non-refreezable Melted Mix. Track the refreeze count through belts, buffers, and saves so routing a tub through a loop cannot reset its freshness forever.
- **Salvage is never a dead end.** Melted Mix that reaches the counter is reported as spoiled and is not consumed; the player can remove it from the belt at any time (§6.2), and if left untouched it auto-discards after **15 seconds** with a puff and a one-line notice. Because the goods already spoiled, this loses nothing scarce.
- **Spoilage costs time, never goods.** A final Melted Mix is never silently deleted: it remains visible and removable with the universal item-removal action; if delivered to the counter it follows the existing 15-second auto-discard rule. It cannot be sold or refrozen again, which closes the infinite-refreeze loop without a permanent belt blockage.
- The UI shows a freshness arc on each tub on a belt and a "chilled capacity" indicator (used / total) on the Freezer.

**Fallback:** if the mechanic tests as confusing or too costly to simulate, ship the freshness gauge as visual feedback only, with decay disabled. The rest of the game must be complete without it. In that case, level 3's "No tub melts" optional objective is replaced by "No machine blocked for 30 s", and the cooling upgrade is removed from the build panel.

### 6.5 Orders, customers, and service

- Customers arrive in small groups at the service counter and queue with distinct silhouettes.
- Each order contains 1–2 products from the counter's accepted list, a coin reward, a reputation value, and a patience window.
- Orders come from a small, authored pool per level (no procedural shopping behavior). A level's objective may require 3–8 fulfilled orders.
- **Delivery is automatic on intake.** The counter has a single input socket and a chilled 2-item buffer. When an item enters the buffer and matches the oldest active order, it is consumed immediately; a two-item order consumes its second matching item the same way, then pays the reward once.
- An item that matches no active order stays in the buffer, and the counter shows "no order needs this" and blocks further intake. The player can discard a buffered item from the counter's inspect panel with confirmation, freeing the slot.
- Orders consume only their listed products. A non-matching item is never consumed and never pays.
- Rewards are granted by order ID so a refresh cannot duplicate them.
- Patience is forgiving: **180 s** in the tutorial, **120 s** in the first levels, **90 s** later. Patience pauses with the game and never fails a level on its own.
- An expired order makes the customer leave with a small reputation loss (0 in the tutorial and level 1, −1 later). Reputation never drops below the value the level started with. Expiry never deletes items and never blocks progress.
- The order panel shows product icons with counts, patience as an arc plus a number, and the reward.
- **Order display names:** counter deliveries of washed fruit and bases are presented as cups — Washed Peach → *Peach Cup*, Washed Apple → *Apple Cup*, Peach Base → *Peach Puree Cup*, Apple Base → *Apple Puree Cup*. Item IDs and recipes are unchanged.

### 6.6 Workers

- Workers are cosmetic, station-bound characters with distinct original designs: a **mole gardener**, a **squirrel mechanic**, and a **rabbit shopkeeper** (subject to final art review).
- Belts perform all real transport. Workers must never become a second, hidden logistics system.
- Workers perform short animated tasks at their assigned station: tending the orchard, carrying a decorative crate, serving at the counter.
- Role assignment (reassigning a worker to a station) is P1 and the **first feature cut** if the schedule slips.
- No hunger, fatigue, wages, skill trees, or pathfinding-dependent production. If pathfinding is unreliable in the voxel world, use authored station-to-station paths.

### 6.7 Economy and resources

| Currency | Source | Sink |
|---|---|---|
| Coins | Fulfilled orders, first-completion level bonuses | Buildings, belts, upgrades, cream |
| Reputation | Fulfilled orders | Level unlocks, recipe unlocks |
| Inventory | Produced items and source output | Recipes, orders |

- No premium currency, no ads, no consumables.
- **Cream is bought manually.** The Dairy Crate's inspect panel has a "Buy cream (8 coins)" action that emits one cream when the crate output has room. The crate never spends coins on its own; the action disables with a reason when coins are short. Cap **12 cream per level**.
- **Starting coins are authored per level** (see §6.8), with some buildings pre-placed so the required build cost always fits the starting budget.
- Every cost, refund, and reward is previewed before the player commits.
- Resource shortages are explained at the machine or order that needs them, with a jump-to action.
- **Anti-soft-lock guarantee:** the game always offers a low-reward "market errand" order worth 6 coins when total coins fall below 20 and no producible goods exist, plus a one-time 60-coin recovery grant on first trigger.
- Reputation thresholds gate level unlocks, never coin purchases, so spending cannot lock progression. Reputation is never spent.

**Level budget rule (balance gate):** for every level, the cost of everything the player must build to reach the primary objective must be **at most 90% of the level's starting coins**, assuming no order income. M2 and M3 must verify this with a cost spreadsheet before levels are signed off.

### 6.8 Progression and level structure

Progress is chapter-based and saved at meaningful milestones. Each level introduces exactly one mechanic, teaches it in a safe context, then asks the player to apply it.

| # | Level | Introduces | Pre-placed | Starting coins | Primary objective | Optional objectives |
|---|---|---|---|---|---|---|
| T | **A Small Sweet Start** | Placement, a guided three-tile belt run, first order | Service Counter | 120 | Fulfill 3 Peach Cup orders | No customer leaves; finish under 4 minutes |
| 1 | **The Long Way Around** | Belt direction, corners, input/output ports, Press | Orchard, Service Counter | 165 | Fulfill 5 fruit orders (washed or base, at least 2 base) | Use no more than 12 player-placed belts; no blocked machine for 30 s |
| 2 | **A Cup of Calm** | Tea chain: leaves, water, Brewer's two sockets | Orchard, Washer, Service Counter, and the orchard→washer→counter belts | 195 | Fulfill 6 orders including 3 teas | Take no reputation loss; use no more than 12 player-placed belts |
| 3 | **Chill Factor** | Dairy Crate, Mixer, Freezer, cold chain, mild bottleneck | Orchard, Washer, Press, Service Counter, connecting belts | 300 | Fulfill 6 orders including 2 ice creams | No tub melts; complete without selling a machine |
| 4 | *Two Lines, One Shop* (post-MVP) | Space pressure across both product lines | — | — | — | — |
| 5 | *Market Day* (post-MVP capstone) | Combined demand, queues, one layout constraint | — | — | — | — |

**Cost audit against the 90% budget rule** (belts at 4 coins per tile; values from §10):

| Level | Player must build | Cost | Budget (90% of start) | Status |
|---|---|---|---|---|
| T | Orchard 40 + Washer 45 + 3 belts 12 | 97 | 108 | Pass |
| 1 | Washer 45 + Press 55 + about 10 belts 40 | 140 | 148 | Pass |
| 2 | Tea Patch 40 + Water Pump 30 + Brewer 60 + about 10 belts 40 | 170 | 175 | Pass |
| 3 | Dairy Crate 30 + Mixer 75 + Freezer 110 + about 12 belts 48 | 263 | 270 | Pass |

All four levels now pass by construction. The M2/M3 balance pass may move belt counts, pre-placed objects, or starting coins only within these bounds, and must record final values in the level data files. Cream is bought from order income in level 3; the level-3 budget does not depend on cream spend.

- Launch content: tutorial + 3 levels, roughly 30–45 minutes for core progression, replayable via optional objectives.
- No mandatory timed medals; optional objectives are badges only.
- Completion of a primary objective unlocks the next level and persists immediately.
- **v4.0:** the tutorial and levels 1–3 are Story Chapter 1. Finishing Level 3 unlocks Town mode (§6.8a). The "30–45 minutes" launch figure above describes the campaign only, not total content.

### 6.8a Long-term progression: Town mode (v4.0)

**Goal:** a cozy, fair retention loop for Windows and Android sessions of 5 to 30 minutes, with weeks of content, and no premium currency, ads, energy limits, or pay-to-wait timers.

**Core idea:** after the campaign, the player keeps one persistent workshop town. It never resets, grows through expansion, and is driven by townsfolk who post orders and tell a story.

#### Loops

| Loop | Length | What the player does | What pulls them back |
|---|---|---|---|
| Session | 2 to 5 min | Fill 1 to 3 board orders, tune a bottleneck, collect rewards | Rewards pop immediately; the next unlock is always visible |
| Daily | 10 to 15 min | Complete 3 daily goals, claim a daily gift | Streak counter that pauses, never resets, on a missed day |
| Chapter | 1 to 3 hours | Finish a townsfolk story chapter, restore a landmark stage | New character, new recipe line, new district |
| Long term | Weeks | Reach Town Level 50, expand all districts, 100% the recipe book | Collection book, landmark stages, cosmetic themes |

#### XP and Town Level

- XP sources: order served (base 10 to 40 by size), first time making a recipe (bonus), objective badge, daily goal, chapter step.
- Town Level 1 to 50. XP needed for the next level follows `40 + 25 × level` up to level 20, then `540 + 60 × (level − 20)`. Early levels arrive in minutes, later ones in a few sessions.
- Level-up always grants a visible unlock or a reward chest (coins, a permit, or a cosmetic). A level-up with nothing new is not allowed.

#### Unlock tree (launch of Town mode)

| Town Level | Unlock |
|---|---|
| 1 | Town mode, 12 × 12 starter district, order board (3 slots) |
| 3 | Speed upgrade 1; Tea Patch and Water Pump |
| 5 | Dairy Crate and Mixer; board grows to 4 slots |
| 8 | Freezer and cold chain; first land expansion |
| 10 | Splitter belt; chapter 3 story |
| 12 | Combo orders (two or three product lines in one order) |
| 15 | Merger belt; worker role assignment |
| 18 | Bakery chapter: Dough Mixer and Oven |
| 22 | Second district; board grows to 5 slots |
| 25 | Belt speed upgrade; cooling upgrade 2 |
| 30 | Market stall customization; board grows to 6 slots |
| 35 to 50 | New recipe families, cosmetic themes, landmark stages, third district |

Recipes and machines are data-driven. Each has `unlockLevel`; the build menu shows locked items with their requirement, never hides them.

#### Order board

- 3 to 6 slots by Town Level. Each slot holds one townsfolk order with a coin reward, XP reward, and an optional permit drop.
- Orders never expire into failure. An unfilled slot can be swapped for a new one once per day per slot, at no cost.
- Difficulty scales with Town Level: item count, product lines, and combo rules grow gradually. The generator guarantees every order is producible with the player's unlocked machines.
- Existing patience-based customers remain in story levels. Board orders use no timer, which suits mobile sessions.

#### Land expansion

- The town starts small and grows by buying adjacent plots. Each plot costs coins plus **Expansion Permits**, earned from chapter steps, daily goals, and chests, never purchased.
- Expanded plots can hold new machines, belts, and decorations. Existing layouts are never moved or invalidated.

#### Story chapters

- Eight original townsfolk (animals, consistent with the cosmetic workers), each with a short arc. A chapter is 5 to 8 steps, each a concrete objective such as "serve 4 teas" or "freeze a tub without melting".
- Each chapter ends by restoring a stage of the central landmark and unlocking a character, recipe line, or district.
- Dialogue is short, skippable, and fully localisable. No text is shown over the world that the player cannot dismiss.

#### Daily goals and streak

- 3 daily goals generated from unlocked content, plus a daily gift chest.
- Streak counts consecutive days played. Missing a day pauses the streak and shows a gentle message; the streak is never reduced. Streak rewards are small and cosmetic or permits.

#### Offline batch (P1)

- On return, the town yields an "overnight batch" of coins and XP equal to 50% of the throughput measured in the last 10 active minutes, capped at 4 hours of production. It is computed arithmetically, not by running the simulation, so it is deterministic and cheap.
- Android may offer an opt-in local notification when the board refreshes or the batch is full. No notification is sent without opt-in.

#### Economy for long play

- Sinks: expansion plots, machine upgrades, decorations, theme cosmetics, new recipe purchases. Sources: board orders, daily goals, chests.
- Every unlock must be reachable by play alone; the M3 balance pass sets exact numbers.
- Reputation (§6.7) still applies to the story levels only. In Town mode, XP and Town Level replace it for gating, so spending still cannot lock progression.

#### Save schema v2

Adds `townLevel`, `xp`, `unlocked` (machine, recipe, and cosmetic IDs), `districts` and `plots`, `storyChapter` and `storyStep`, `board` (slots with seeds), `daily` (goals, claimed, streak, lastPlayedDay), `permits`, `lastSeenAt`, and `collectionBook`. Migration v1 to v2 maps completed levels to Chapter 1 and starts Town Level 1. All new IDs validate against content tables as in §6.10.

#### Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-27 | Persistent Town mode unlocked after Level 3 | P1 |
| FR-28 | XP, Town Level, and unlock gating from data tables | P1 |
| FR-29 | Order board with generator that guarantees producible orders | P1 |
| FR-30 | Land expansion with permits | P1 |
| FR-31 | Story chapters with townsfolk and landmark stages | P1 |
| FR-32 | Daily goals and non-punishing streak | P1 |
| FR-33 | Offline batch, capped and opt-out | P2 |
| FR-34 | Collection book of recipes and cosmetics | P2 |

**Success hypotheses (not gates):** median Windows session 15 minutes or more; day-7 return 25% or more; at least 40% of players reach Town Level 10. Measured locally and only reported if the player opts in.

### 6.9 Difficulty and failure

- The game is built around recoverable inefficiency, not hard failure.
- Customer patience creates urgency but never a fail state; levels cannot be lost.
- A level can be reset to its authored starting state with confirmation, without losing unlocked levels or settings.
- Pause is always available. Speed is 1× at launch; 2× is a P1 stretch and only ships if the simulation stays readable.
- Tutorial prompts can be dismissed, and replayed from Help at any time.
- Onboarding never blocks pause, settings, or help.

### 6.10 Save, settings, and recovery

- **Saved:** current level, placed objects and their positions/upgrades, buffers and in-flight items (including freshness timers and refreeze count), coins, reputation, unlocked levels, completed objectives, cream used this level, settings, worker assignments.
- **Autosave triggers:** placement changes, completed orders, level completion, settings changes, and a 10-second heartbeat during active play. Writes are debounced 2 seconds.
- **Format:** one versioned JSON document, a previous-good backup slot, and one validated daily recovery snapshot, accessed through a single `SaveStore` interface. Update the daily snapshot at most once per 24 hours of active play. `SAVE_VERSION` is one constant with an explicit migration function per version bump. Every build reads and writes identical schemas.
- **Platform adapters:** web writes IndexedDB only. Windows (Electron) writes IndexedDB in the `userData` partition and mirrors the JSON under `%APPDATA%/LittleBatchWorks/saves/`. Android (Capacitor) writes IndexedDB and mirrors the JSON to the app's documents directory via the Filesystem plugin.
- **Android storage caution:** WebView storage can be evicted under memory pressure. On launch, if IndexedDB is empty but the JSON mirror exists, restore from the mirror and inform the player once.
- **Portability:** a save file copied between builds must load, since migrations and content IDs are shared.
- **Validation:** saves are untrusted input. Validate schema, types, item IDs, recipe IDs, tile bounds, and coin/reputation ranges before loading; reject unknown content IDs and clamp out-of-range values.
- **Recovery:** validate the current save, previous-good slot, daily snapshot, and native JSON mirror where available; restore the newest valid copy and explain the recovery. If every local copy is invalid or missing, show a clear explanation and offer export of the damaged save plus an explicit "Start fresh" path. Never silently wipe or claim that progress can be recovered after every local copy has been erased.
- **Manual reset** exists behind an explicit typed confirmation.
- **Settings:** music volume, SFX volume, mute, reduced motion, grid overlay, status overlay, tutorial hints on/off.
- No cloud sync in v1; a local-save notice is shown on first run.

### 6.11 Item motion, physics, and effects (v4.0)

**Principle:** the 10 Hz simulation is the only source of truth. Everything in this section is a render-time layer that reads simulation state and can never write to it, so replays, saves, and balance stay deterministic.

#### Smooth item motion

- Belt items interpolate between ticks. Render position uses `progress + beltStep × alpha`, where `alpha` is the fraction of the current tick elapsed, so items glide at a constant speed at any frame rate and at 1×, 2×, or paused.
- When an item hands off to the next belt tile, its rendered position continues from where it was; there is no snap back to zero progress. Corners follow a short arc rather than a hard turn.
- Blocked items ease to a stop at the tile edge and nudge forward when released. Queued items keep a minimum visual gap and compress smoothly.
- Machine intake and output animate: items shrink into a socket and pop out with a small hop and bounce.

#### Cosmetic physics

- A lightweight spring and gravity integrator drives item pop-outs, bounces, settle wobble, squash and stretch, and falling debris. It runs only on visual objects.
- No rigid-body engine is used in gameplay. A full physics engine would add non-deterministic behaviour, a large bundle cost on Android, and nothing the player can act on. If a physics library is later added, it is limited to cosmetic debris.
- Physics objects are pooled and capped (see budgets) and are skipped entirely when reduced motion is on.

#### Effects

| Event | Effect |
|---|---|
| Order served | Coin burst, confetti, counter bounce, short chime |
| Machine completes | Hop, puff of steam or sparkle, item pop-out |
| Building placed | Drop-in with dust ring and squash |
| Item melts | Drip particles, tint shift, warning pulse |
| Level up | Camera nudge, radial sparkle, chest bounce |
| Blocked machine | Gentle red pulse on the reason icon, no screen shake |

**Budgets:** at most 300 live particles and 60 physics bodies; pooled, no per-frame allocation; effects never obscure belts, ports, or selection outlines; all can be disabled with reduced motion, and screen shake is not used.

---

## 7. World and level design

### Setting

The game takes place in **Mosslight Market**, a fictional hillside town of footbridges and garden paths. The first production site is the **Sunbeam Workshop**, a family kitchen growing into a community food hall. This setting is original and unrelated to the source image's company or geography.

### Visual world rules

- A three-quarter camera with real height, depth, perspective, readable building footprints, and consistent sunlight. Players can orbit the camera without losing orientation.
- Soft, rounded block construction (rounded edges, smooth shading) with distinct silhouettes and material cues for fruit, liquid, metal, wood, and ice. Terrain and trees are smooth, not stepped or cubic: a first-time viewer must not describe the world as "Minecraft-like".
- The world is a continuous landscape, not a floating island: smooth meadow around the board, broad hills rising toward the horizon, a distant forest, and edges hidden in haze. There is no visible rim, cone, or underside from any camera angle. The buildable board is a slightly sunken work pad framed by raised margins, with scenery only on the margins and the meadow, never on the pad.
- **Graphics upgrade targets (v4.0):** machines get distinct silhouettes, animated working states, and level-upgrade visual tiers; buildings get roofs, awnings, and window detail; items get recognisable food shapes instead of tinted blocks; belts get rollers, side rails, and visible flow; characters get readable faces and idle, work, and celebrate animations; effects (§6.11) give every completed action visible feedback. Each target ships behind the 60 FPS budget in §4.
- Identity comes from orchard terraces, greenhouse roofs, ceramic signs, wind socks, and market awnings.
- The world is wide enough for a visible orchard edge, workshop core, market frontage, and exploration space around them.
- Background detail must never obscure belts, machine ports, customer queues, or selection outlines.
- Placeholder models are acceptable through M2; all placeholders must be replaced before public release.

### Scene composition

- Every level reads left to right: **orchard/farm edge → workshop core with a central dessert landmark → market frontage** (counter and stalls). The default camera frames the larger world; zoom reveals production detail.
- The map center holds a readable landmark that gives the wider world a visual anchor without blocking essential production routes.
- Belt lanes are wide, unobstructed corridors. Decoration fills the gaps between lanes, never the lane itself or a port.
- Target density is **busy but legible**: garden and market props make the world feel lived in, with clear space around belts, ports, queues, and selection outlines.
- Each level has recognizable silhouettes and landmarks built from original voxel models.

### Level authoring data

Each level is a data file, not code:

```
level = {
  id, name, gridW, gridH,
  preplaced: [{ type, x, y, rotation }],
  buildable: [tileMask],
  availableObjects: [typeIds],
  startingCoins, startingReputation,
  creamCap,
  objectives: { primary, optional[] },
  orderPool: [{ id, items[], reward, reputation, patience }],
  tutorialSteps: [...],
  unlocks: { levelId, recipes[] }
}
```

---

## 8. UI/UX

### Main screen

Continue / New Game, level selection with chapter progress, settings, credits, and a concise save-status line.

### In-game layout

| Region | Contents |
|---|---|
| Top bar | Coins, reputation, current objective with progress, pause/speed, settings |
| Build panel (left or bottom) | Sources, production, conveyors, service, upgrades — each item shows cost and affordability |
| World canvas | Factory, pan/zoom, selection, grid and status overlays |
| Context panel | Selected machine: recipe, progress, per-socket buffers, state, upgrade, sell |
| Order panel | Active orders, product icons, patience arc + number, reward |
| Tutorial strip | Short, dismissible, contextual instruction with "show again" |

### Interaction

- Click/tap to select; movement over 5 CSS px total (|dx| + |dy|) cancels the click and starts orbit. Right-drag or Shift-drag pans; wheel (toward the pointer) or +/− buttons zooms.
- **Touch (Android):** tap to select and place; one-finger movement over 5 CSS px total starts orbit; two-finger pinch zooms, twist rotates, and two-finger drag pans. An explicit on-screen cancel is available for placement. No action depends on hover. Selection, sell, and reset use a bottom confirm sheet with large targets.
- Build placement is click-to-place per tile; click-drag belt painting is a post-MVP enhancement.
- `Space` pauses, `Esc` closes a panel or opens pause, `B` toggles build mode, arrows pan, `+`/`−` zoom.
- Input mode is detected at startup: key hints on web/Windows, gesture hints on Android. Below 800 CSS px wide, Build, Orders, and Inspector become mutually exclusive scrollable sheets or full-screen panels instead of pinned side panels; the status bar stays compact and visible.
- Destructive actions (sell, reset level, reset save, remove item) require confirmation; selling shows the exact refund first.
- Hover is never the only access to critical explanation — everything readable on hover is also available by selecting.
- Grid overlay and production-status overlay are toggleable from the top bar.
- Tooltips use plain language plus an icon; no unexplained abbreviations.

---

## 9. Art and audio direction

### Art

- Original title treatment, logo, world map, characters, buildings, signs, UI icons, and item art.
- A modular voxel model set with idle, working, and blocked states for every production machine.
- Item silhouettes must be distinguishable at overview zoom; exaggerate shape and color slightly for clarity.
- Item icons, socket labels, and status badges stay legible at 640 × 360; UI text is at least 14 px at 1× scale.
- Real-time shadows and block highlights reinforce 3D depth without hiding tile connections.
- No penguins, no source-brand clothing, poses, or styling. Final assets are reviewed against the reference image before release.
- **Palette:** lively grass green, sky blue, pastel blue machinery, warm cream, fruit colors, and bright market accents. Mint remains the cold-chain accent.
- **Belts:** bright blue rollers with metal rails, clear direction markers, and voxel carriers.
- **Freezer:** a bold pastel-blue cold room with a clear thermometer and frost accents, designed as an original voxel building.

### Style direction and comparable titles (v4.1)

Source: `suggestions.md`, notes taken from a photograph of a third-party billboard. It is a mood reference only. It is not a build input, it does not override this document, and the reference boundary below applies in full.

**Mood target:** a clean, cute, pastel isometric food-factory town in which small round characters work inside a colourful, dense layout. We reach it through our own 3D rounded-block look, not by imitating a 2D vector illustration.

**Style keywords translated for Little Batch Works:**

| Keyword | What it means for us | How we check it |
|---|---|---|
| Isometric look | Keep the elevated three-quarter default camera; the orbit camera is an extra, not a replacement | Default-camera screenshot in the look-and-feel review |
| Chibi / kawaii characters | Large heads, short bodies, simple round faces, soft shapes, two or three colours per character; every worker and customer is an original design | Character sheet per species or role, reviewed against the IP checklist |
| Flat design, clean line art | Solid pastel fills with gentle gradients and soft shading; no noisy textures; optional thin outline or rim light on characters and machines so silhouettes read at overview zoom | Silhouette test at 640 × 360 |
| Dense but readable | Many small props and workers, but belt direction, sockets, and status badges always stay clear | Existing legibility rules above |

**Characters:** the cast must be original. Penguins and penguin-like silhouettes stay banned. Choose species and roles that suit a cozy dessert-and-tea town (for example hedgehogs, otters, foxes, or small humans), record them on a one-page character sheet before modelling, and give each role (grower, washer, presser, brewer, mixer, counter clerk, customer) a distinct silhouette and accent colour.

**Comparable titles (benchmarks only):**

| Title | What we study | What we do not take |
|---|---|---|
| Two Point Campus / Two Point Hospital | Bright isometric clarity; animated little characters that make a management screen feel alive | Characters, rooms, humour, UI |
| Parkitect | Crisp, vector-like isometric production layouts | Buildings, layouts, art |
| Let's Build a Zoo | Cute management with light narrative choices | Species, hybrid system, story |
| Bear & Breakfast | Warm cozy-management tone and story pacing | Characters, setting, art style |
| Littlewood | Relaxed town-building and attachment to townsfolk | Townsfolk, relationship system, layout |

These inform charm, readability, and cozy pacing for Town mode (§6.8a) and the graphics upgrade target list (§7). They are not licensed, shipped, or traced.

### Reference boundary (internal)

The project's mood reference is the CHAJOY Ice Cream and Tea brand illustration stored at `reference/source-image.png`. It establishes the fantasy — orchards feeding processing buildings, belts linking them, tiny staff, retail stalls, oversized food props — but its specific expression belongs to another brand.

![CHAJOY reference illustration — internal mood reference only, never shipped](reference/source-image.png)

**May be borrowed (visual direction):** elevated three-quarter view, green ground, pastel blue machinery, blue conveyors, orchard-to-store flow, small workers, oversized dessert landmarks, cheerful pastel mood, dense market stalls, and a strong left-to-right scene composition. The target is the closest match to this direction that original assets allow: someone shown the two side by side should say "same kind of world", not "same picture".

**Look-and-feel review (separate from the IP checklist):** before each milestone, compare a default-camera screenshot with the reference and score 1–5 for palette, camera angle, scene composition, prop density, and machinery colour. Anything below 4 becomes a task. Scores never require reproducing a specific building, character, sign, or arrangement from the reference.

**Keep original:** the CHAJOY wordmark and text, exact character artwork, logos, signage, and pixel-level tracing. Use original voxel characters, labels, building silhouettes, and layout details so Little Batch Works has its own assets while following the requested visual direction.

This image is internal only. It is not a game asset, it must never appear in a build, installer, store listing, or marketing material, and artists must not trace it.

### IP review checklist (release gate)

Every item must be signed off by a reviewer who has compared the final assets side by side with the reference image.

- [ ] Title, logo, and wordmark share no letterforms, colors-plus-layout combination, or tagline structure with the reference brand.
- [ ] No penguin, and no character with a matching silhouette, scarf, pose, or expression style.
- [ ] Every character has a recorded original design sheet, and the style keywords or comparable titles in this section were not used to justify matching any specific artwork.
- [ ] No source image pixels, wordmark, logos, or exact character artwork are reused.
- [ ] Signs, labels, packaging, and UI icons contain no text, symbols, or marks from the reference.
- [ ] All voxel models, character designs, signs, and scene details are original assets built for this game.
- [ ] The central dessert landmark uses custom voxel geometry and does not reproduce the source artwork pixel-for-pixel.
- [ ] The CHAJOY name has been checked as a trademark in target markets, and no marketing copy references it.
- [ ] `reference/source-image.png` is absent from every build artifact, installer, and store package.
- [ ] All fonts, sound effects, music, and third-party art have a documented license that permits redistribution in all three builds.
- [ ] The final game name has been checked for conflicts in the target stores and the relevant trademark databases.
- [ ] The checklist, reviewer name, and date are recorded in the release notes.

### Audio

- One gentle looping market/workshop track; independent music and SFX volumes.
- Distinct short cues for: placement, production complete, machine blocked, order complete, customer leave, unlock, error, melt warning.
- Ambient layer (birds, steam, distant bells) is subtle and optional.
- No persistent alarms; blockage cues are informative and quiet.
- Every sound respects mute and volume settings, including the first-run experience.

---

## 10. Content and starting balance values

These are starting values for M2, tuned during M3. All live in data files.

| Object | Cost | Footprint | Produces / notes |
|---|---|---|---|
| Orchard | 40 | 2×2 | 1 peach and 1 apple lane, each every 6 s; each lane buffers 2 and pauses independently |
| Tea Patch | 40 | 2×2 | 1 tea leaf every 6 s |
| Water Pump | 30 | 1×1 | 1 water every 5 s |
| Dairy Crate | 30 | 1×1 | Manual buy: 8 coins per cream, emits 1 when requested; cap 12 per level; idles until bought |
| Washer | 45 | 1×1 | R1 / R2, 3 s |
| Press | 55 | 1×1 | R3 / R4, 4 s |
| Brewer | 60 | 1×1 | R5, 6 s; two input sockets |
| Mixer | 75 | 1×1 | R6 / R7, 5 s; two input sockets |
| Freezer | 110 | 2×2 | R8, 8 s (4 s for Melted Mix); chilled output capacity 4 |
| Service Counter | 50 | 2×2 | Accepts the six counter items; chilled buffer of 2 |
| Belt (straight / corner) | 4 per tile | 1×1 | 1 tile/s |
| Speed upgrade | 40 then 90 | — | −20% time per level, per machine |
| Cooling upgrade | 60 | — | Chilled output capacity 4 → 8 |

| Order type | Reward | Reputation | Display name |
|---|---|---|---|
| Washed fruit | 10 | +1 | Peach Cup / Apple Cup |
| Fruit base | 14 | +2 | Peach Puree Cup / Apple Puree Cup |
| Tea | 22 | +3 | — |
| Ice cream tub | 32 | +4 | — |
| Tea + tub combo | 55 | +6 | — |
| Market errand (anti-soft-lock) | 6 | 0 | — |

| Simulation constant | Value |
|---|---|
| Logic tick | 100 ms |
| Belt speed | 1 tile per second |
| Machine buffers | 2 per input socket, 2 output (Freezer output 4, Service Counter buffer 2) |
| Cold chain freshness (on belts) | 45 s, warning at 15 s |
| Melted Mix re-freeze | 4 s |
| Melted Mix auto-discard | 15 s |
| Sell refund | 70% |
| Starting coins | Authored per level: T 120, L1 165, L2 195, L3 300 (all pass the §6.8 balance gate) |
| Cream price / cap | 8 coins per unit / 12 per level |
| Patience | 180 s tutorial / 120 s early / 90 s later |

---

## 11. Functional requirements

**P0** = required for MVP · **P1** = ships if core is stable · **P2** = post-MVP.

| ID | Pri | Requirement |
|---|---|---|
| FR-01 | P0 | New game, level select, and return to the level map |
| FR-02 | P0 | Place, select, move, rotate, and sell buildings on the 3D build grid |
| FR-03 | P0 | Straight and corner belts with visible direction and connection state |
| FR-04 | P0 | Deterministic tick simulation of items, belts, sources, and recipes |
| FR-05 | P0 | Machines display input sockets, output, progress, and idle/working/blocked states |
| FR-06 | P0 | Orders display, consume only matching items, fulfill once, and reward coins and reputation |
| FR-07 | P0 | Tutorial teaches placement, routing, production, and order fulfillment |
| FR-08 | P0 | Objectives and the level unlock flow work end to end and persist |
| FR-09 | P0 | Pause and resume at any time; production and patience halt while paused |
| FR-10 | P0 | Autosave and load restore layout and progress with no duplicated rewards |
| FR-11 | P0 | Camera orbits horizontally and vertically around the fixed visual center of the island, with momentum, pan/zoom, and a tap/drag threshold; build categories, inspection, and explainable invalid-placement feedback |
| FR-12 | P0 | Music/SFX volume and mute settings |
| FR-13 | P0 | Blockage explanation names the cause and highlights the affected path |
| FR-14 | P0 | Anti-soft-lock recovery order and one-time grant |
| FR-15 | P1 | Cold chain: belt-only freshness, melt warning, Melted Mix salvage, two-cycle refreeze cap with shorter freshness per cycle, cooling upgrade |
| FR-16 | P1 | At least one machine speed upgrade with a visible effect |
| FR-17 | P1 | Cosmetic station-bound workers with visible tasks |
| FR-18 | P1 | Worker role reassignment |
| FR-19 | P1 | Reduced-motion setting |
| FR-20 | P1 | Optional objectives and level replay |
| FR-21 | P1 | 2× simulation speed |
| FR-22 | P0 | Touch input: tap-select/place at or below the 5 CSS px threshold, one-finger orbit above it, two-finger pan/pinch/twist, and cancel — a full tutorial and level 1 playable with touch only |
| FR-23 | P0 | Windows `.exe`: per-user NSIS installer and portable build, no admin rights, fully offline, saves survive close and relaunch |
| FR-24 | P0 | Android `.apk`: signed release APK, sideloadable, Android 8.0+, landscape, fully offline, saves survive backgrounding and relaunch |
| FR-25 | P0 | One save schema and content set across web, Windows, and Android, with platform save adapters and a JSON mirror on native builds |
| FR-26 | P0 | Reproducible build pipeline producing all three artifacts from one commit, with version stamping and SHA-256 checksums |
| FR-27 | P2 | Splitters/mergers, belt painting, cloud saves, achievements, extra chapters, seasons, landmark meter |
| FR-28 | P2 | Desktop auto-update, Play Store release (AAB), iOS build, PWA install |
| FR-29 | P0 | Labeled input sockets on two-input machines (Brewer, Mixer), per-socket buffers, "needs <item>" status, and the Dairy Crate source with manual per-unit cream purchase and per-level cap |
| FR-30 | P0 | Universal item removal: any item on a belt can be discarded with confirmation, and Melted Mix auto-discards after 15 s, so no item can permanently block a line |
| FR-31 | P0 | Counter delivery: auto-match buffered items to the oldest active order, "no order needs this" state, and discard for buffered items |
| FR-32 | P0 | Orchard fruit lanes buffer and pause independently so an undrained lane never blocks the other |

---

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | 60 FPS target / 30 FPS floor; pooled meshes; capped active items; no per-frame allocation in the simulation loop |
| Reliability | No progress loss on refresh or close; guarded, versioned writes with a backup slot |
| Usability | A new player completes the tutorial's first order without outside help |
| Compatibility | Core loop runs in current Chrome, Firefox, Edge, and Safari at 1024 × 700, and on the Windows and Android builds at their minimum viewports; below 800 CSS px the compact panel rule applies |
| Compact HUD | At widths below 800 CSS px, Build, Orders, and Inspector are mutually exclusive sheets or full-screen panels with 44 × 44 CSS px touch targets; no pinned side panels overlap the world |
| Deadlock freedom | No combination of placement, item type, or order state can permanently block a line without a player-accessible remedy |
| Maintainability | Recipes, levels, machine stats, and economy values are data-driven and documented in one schema |
| Load | Budgets in §4; nonessential assets lazy-loaded per level |
| Privacy | No personal data, no third-party behavioral tracking; analytics opt-in or absent |
| Security | Saves treated as untrusted input with schema and bounds validation |
| Localization readiness | All UI strings in external string files; no text baked into art; English ships first |
| Packaging and release | Three reproducible artifacts — web bundle, signed EXE, signed APK — built from one commit with version stamping and published checksums |
| Windows compatibility | Windows 10 and 11 x64; per-user install without admin rights; runs with networking disabled; no SmartScreen-blocking malware behavior |
| Android compatibility | Android 8.0+ (API 26) on arm64-v8a and armeabi-v7a; WebGL required; no dangerous permissions requested |
| Offline | Game loop, saves, and audio work with network access disabled in every build; no CDN-hosted fonts or assets |
| Originality | Every visual and textual asset passes the IP review checklist in §9 |

---

## 13. MVP scope, milestones, and cuts

### MVP vertical slice

One authored world, tutorial + 3 levels, 8 recipes, 6 production/service building types plus 4 sources, straight/corner belts, two-input machines with labeled sockets, orders with coins and reputation, level unlocks, anti-soft-lock recovery, cosmetic workers, autosave, settings, pause, touch and mouse/keyboard input, and a complete original visual identity — delivered as three builds (web, Windows `.exe`, Android `.apk`) from one codebase.

### Milestones (target 10–12 weeks; outer bound 16 with in-house art)

| Milestone | Scope | Target |
|---|---|---|
| M0 Prototype | Grid, camera, placement, one source, one belt, one machine, one order | Week 1 |
| M1 Core systems | Data-driven recipes, deterministic tick sim, buffers and sockets, blockage feedback, save/load; **automated three-target build started** | Weeks 2–3 |
| M2 Vertical slice + shells | Tutorial + level 1, placeholder art, economy pass and **level cost audit**; Electron and Capacitor shells running the prototype on Windows and Android | Week 4 |
| M3 Content, menus, touch UI | Level 2 complete, level 3 greyboxed; touch controls and responsive panels; upgrades, workers, menus, audio pass | Weeks 5–7 |
| M4 Signature mechanic | Cold chain, cooling upgrade, Dairy Crate tuning, level 3 finalization and balance | Weeks 7–8 |
| M5 Release engineering | Signed builds, installers, save adapters and mirrors, device and browser matrix, performance pass | Weeks 9–10 |
| M6 Release candidate | Accessibility pass, IP checklist sign-off, final balance, migration checks, crash sweep, store-ready APK/AAB, checksums | Weeks 11–12 |

The two native shells are stood up in M2, not at the end, so WebView, packaging, and touch-input problems surface while the codebase is small.

### Cut order if the schedule slips

1. Worker role reassignment
2. 2× speed
3. Optional objectives
4. Decorative worker animations
5. Cooling upgrade
6. Cold chain → freshness gauge as visual feedback only

**Never cut:** blockage feedback, pause, save/load, onboarding, the anti-soft-lock path, item removal and deadlock remedies, the full ingredient-to-order loop, the three build targets, touch input, the reproducible build pipeline, or per-platform save integrity. Seasons and the landmark meter are already post-MVP.

---

## 14. Post-MVP roadmap

| Phase | Content |
|---|---|
| 1 | **Two Lines, One Shop** and **Market Day** capstone levels; seasonal fruit variants; workshop landmark meter |
| 2 | Routing tools: splitters, mergers, configurable priorities; belt path painting; belt-speed upgrades; desktop auto-update, Play Store release via AAB, PWA install |
| 3 | Bakery chapter (dough, oven, bread/pastry) with a heat-management constraint |
| 4 | Sandbox mode, map variants, cosmetic building themes, additional worker roles; iOS build, tablet layouts, cloud saves |
| 5 | Achievements, localization, and additional food businesses (preserves, noodles) |

---

## 15. Analytics and success measures

Analytics are optional, aggregate only, and collect no personal data. The game must be fully playable with analytics disabled or unavailable.

**Event set:** `session_started`, `level_started`, `level_completed`, `level_restarted`, `tutorial_step_viewed`, `tutorial_step_completed`, `tutorial_skipped`, `building_placed`, `building_moved`, `building_sold`, `machine_blocked` (reason category only), `order_completed`, `order_expired`, `upgrade_purchased`, `cream_purchased`, `item_melted`, `item_discarded`, `counter_item_discarded`, `save_loaded`, `save_recovery_shown`.

Every event carries a `platform` property (`web` / `windows` / `android`) and the app version, so build-specific issues are visible without device identifiers.

Never log free text, player names, device IDs, or persistent identifiers without a separate privacy review.

**Hypotheses to validate in a small playtest cohort** (targets, not release gates):

| Indicator | Hypothesis |
|---|---|
| Tutorial completion | ≥ 60% of playtesters |
| Median first session | ≥ 8 minutes |
| Day-1 return (playtest cohort) | ≥ 25% |
| Time to first fulfilled order | Under 2 minutes |
| Blockage diagnosis unaided | ≥ 70% of testers can name the cause |
| Level completion / restart rate | Tracked per level, no fixed target |

Qualitative questions: does it feel relaxing, understandable, and rewarding?

---

## 16. Acceptance criteria

The MVP is acceptable for public release (web, Windows, and Android) when:

1. A new player completes the tutorial's first full order without outside help.
2. Valid sources, belts, machines, and the counter form a working chain with visible item movement.
3. Invalid connections and placements are explained *before* commitment.
4. A full downstream buffer visibly blocks upstream flow and names the cause.
5. Pause stops production **and** patience timers.
6. Orders consume only matching products and pay exactly once — including across a refresh.
7. Completing a primary objective unlocks the next level and persists after refresh.
8. Refresh restores layout, in-flight items, coins, and progress without duplicated rewards.
9. The player cannot become permanently stuck: the recovery order and grant exist and trigger correctly.
10. All essential controls and status remain usable at 1024 × 700 on web/Windows and at 640 × 360 in Android landscape.
11. Mute, both volumes, and reduced motion take effect and persist.
12. (If cold chain ships) A tub's freshness starts only when it leaves the Freezer output, keeps running while blocked on a belt, pauses in the counter's chilled buffer, melts into salvageable Melted Mix at expiry, and the cooling upgrade measurably extends capacity. Refreezing takes 4 s, is limited to two cycles, and shortens freshness to 30 s then 15 s; further-melted mix remains removable but cannot be refrozen. Refreeze count survives saves, and no item can reset its freshness indefinitely or permanently block a belt.
13. No blocking errors across a full tutorial playthrough in supported browsers, on Windows, and on Android.
14. All art, text, characters, and branding are original, and every item on the §9 IP review checklist is signed off.
15. A corrupt save produces an explanation and attempts every valid local copy (previous-good, daily snapshot, and native JSON mirror where present) before offering export and an explicit reset path; recovery never silently wipes or promises recovery after all copies are erased.
16. The Windows installer runs per-user without admin rights on clean Windows 10 and 11, and the game is fully playable with networking disabled.
17. The signed APK installs on Android 8.0+ via sideload, runs fully offline, and completes the tutorial in landscape on a device with no hardware keyboard.
18. The tutorial and level 1 are completable with touch only — tap, drag, and pinch — with movement at or below 5 CSS px treated as a tap and movement above it treated as orbit; every gesture has a visible hint or control.
19. Saves survive close and relaunch on Windows and backgrounding or force-stop on Android, and a save copied between builds loads correctly.
20. The APK requests no dangerous permissions; the EXE installs and runs without elevation.
21. All three artifacts build from the same commit and version string, and published SHA-256 checksums match the downloads.
22. Every level's required build cost is at most 90% of its starting coins (§6.8), and the tutorial and level 1 can be completed using only the counter's accepted items.
23. Brewer and Mixer show two labeled input sockets, start only when both hold valid items, show "needs <item>" for a missing input, and reject a mismatched fruit at the Mixer with a clear reason.
24. The Dairy Crate spends coins only when the player presses Buy Cream, disables the action with a clear reason below 8 coins, and stops at the per-level cap of 12.
25. Any item on a belt can be removed with confirmation, freeing the segment; wrong-type items and Melted Mix can never deadlock a line.
26. The counter consumes a buffered item only when it matches an active order, shows "no order needs this" otherwise, and lets the player discard a buffered item.
27. Camera orbit remains centered on the island's visual center through a complete horizontal 360° and the full overhead-to-underneath vertical range; rotation does not pan the island, and click/tap remains distinct from orbit.
28. At 640 × 360 landscape and all widths below 800 CSS px, Build, Orders, and Inspector are mutually exclusive sheets or full-screen panels, with no overlapping pinned panels and touch targets at least 44 × 44 CSS px.
29. Save recovery chooses the newest valid available copy, including the daily snapshot; when no valid copy remains, the player sees the limitation and must explicitly choose to export or start fresh.
27. Orchard peach and apple lanes buffer and pause independently; an undrained lane never stops the other.
28. No two machine or source ports transfer items directly; every transfer includes at least one belt tile.

---

## 17. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 3D voxel belts and ports are hard to read | Players cannot plan routes | Port markers, ghost previews, zoom, camera orbit, early playtests |
| Two-input sockets confuse new players | Stalled machines, frustration | Labeled sockets with item icons, "needs <item>" badges, introduce Brewer in level 2 with a guided prompt |
| Simulation edge cases (duplicates, deadlocks) | Broken trust in the core loop | Deterministic ticks, explicit buffers, single-path belts, universal item removal |
| Cold chain confuses or frustrates | Cozy audience disengages | Introduce in level 3 only, generous timers, warning before melt, salvage instead of destruction, visual-only fallback |
| Spoiled or wrong items deadlock a line | Progress stalls | Universal removal, Melted Mix auto-discard, counter discard |
| Buffered counter items block intake | Orders stall awkwardly | Auto-match, "no order needs this" message, discard action |
| Hidden or automatic spending | Players feel cheated | All spending is player-initiated; cream is a button, never automatic |
| Levels are unaffordable or too easy | Soft lock or no challenge | Per-level budget rule (§6.8), cost spreadsheet in M2, recovery order |
| Scope creep into a full factory sim | Release slips | Hard caps on recipes, buildings, map size, levels; explicit cut list |
| Art workload exceeds capacity | Inconsistent visuals | Modular tiles, limited animation set, placeholder-to-final pipeline |
| Save incompatibility | Lost progress | Versioned schema, migration per version, backup slot |
| Time pressure alienates cozy players | Drop-off | Forgiving patience, pause halts timers, no fail state |
| Resemblance to the reference scene | IP confusion | Original world, cast, layout, naming, palette; §9 checklist before release |
| Worker animation bugs distract from routing | Wasted effort | Station-bound workers, never on the production path |
| Android WebView and GPU fragmentation | Crashes or poor frame rate on real phones | Test matrix across API 26/30/34 and two or three GPUs; cap DPR at 2; WebGL-only; avoid exotic APIs |
| Unsigned EXE triggers SmartScreen | Players abandon the install | OV code-signing certificate, or publish checksums with clear install notes |
| Android keystore loss | Cannot update the app under the same ID | Keep keystore and passwords outside the repo in a documented vault; enroll in Play App Signing when going to store |
| Two extra build targets stretch the schedule | Late, unstable releases | Shells stood up in M2; automated builds from M1; packaging is never-cut scope |
| Touch UI crowds a 640 × 360 screen | Unplayable on phones | Below 800 CSS px use mutually exclusive sheets/full-screen panels; 44 px targets; playtest on a small device |
| Re-freezing resets freshness indefinitely | Cold-chain routing loop bypasses spoilage pressure | Persist a two-cycle refreeze count and shorten the tub's freshness to 30 s then 15 s; final Melted Mix stays removable |
| All local save copies are corrupt or unavailable | Progress cannot be recovered | Validate current, previous-good, daily snapshot, and native mirror; explain the limit and require an explicit export/reset choice |
| A stray CDN asset or font breaks offline play | Blank or broken game once installed | Bundle every asset and font; CI check that the build references no external URLs |

---

## 18. Open questions and defaults

| Question | Default |
|---|---|
| Belt placement: per tile or drag-painted path? | Per tile at launch; paint if usability testing supports it |
| Orders: fixed or generated? | Fixed objectives plus a small authored pool per level |
| Free build at launch? | No; revisit after authored levels prove the loop |
| iOS and tablet support? | Post-MVP; Android phone landscape only at launch |
| Windows code-signing certificate? | Buy an OV certificate before public download if budget allows; otherwise ship clearly documented, checksummed builds |
| Play Store or sideload first? | Sideloaded signed APK at launch; AAB and store listing after the loop is validated |
| Electron or Tauri? | Electron first (JS-only, predictable); evaluate Tauri only if installer size or startup time becomes a real complaint |
| Minimum Android device? | Android 8.0+, 2 GB RAM; 2021-or-newer mid-range device as the performance floor |
| Persistence: local only? | Yes for v1; cloud saves only if cross-device need appears |
| Seasons: real-time or milestone-bound? | Milestone-bound, never real-time (post-MVP) |
| Final name, cast, and art style? | *Little Batch Works*, Mosslight Market, mole/squirrel/rabbit cast — pending creative and name-availability review |
| Art sourcing: in-house or licensed? | Decide before M2; budgets assume in-house or a small licensed set |
| Splitters/mergers at launch? | No; only if the simple loop proves too limited |
| Cream price and cap (8 coins / 12 per level)? | Tune in M3 against level-3 income; keep the purchase manual |

---

## 19. Glossary

- **Tile:** one cell in the 3D build grid.
- **Source:** a building that supplies a raw ingredient (Orchard, Tea Patch, Water Pump, Dairy Crate).
- **Machine:** a building that transforms inputs into an output.
- **Socket:** a labeled input or output connection point on a machine edge that accepts one item family.
- **Item family:** a declared set of item types a socket accepts, such as "any fruit" or "Ice Cream Mix family".
- **Buffer:** limited item space at a machine socket or output.
- **Order:** a customer request for one or more finished products.
- **Blockage:** an item cannot advance because a connection or downstream capacity is unavailable.
- **Cold chain:** the freshness and chilling system governing ice cream.
- **Chilled buffer:** a storage space (Freezer output, Service Counter buffer) where freshness does not run down.
- **Melted Mix:** the salvageable item a spoiled tub becomes.
- **Remove (item):** discard an item from a belt or buffer with confirmation; no refund.
- **Chapter:** a group of authored levels around one production theme.
- **Tick:** one deterministic simulation step (100 ms at 1× speed).
- **Build target:** one of the three deliverables — web bundle, Windows `.exe`, or Android `.apk`.
- **Wrapper:** the native shell hosting the web game (Electron on Windows, Capacitor on Android).
- **Sideload:** installing an APK directly instead of through an app store.
- **Save mirror:** the JSON backup file written alongside IndexedDB on the native builds.

---

## 20. Appendix: decision log

This document merges earlier drafts. Where they conflicted, the call below is authoritative. Version 3.1 added Windows and Android distribution (#13–#18); version 3.2 resolved the consistency gaps found in review (#19–#26); version 3.3 resolved the blocking logic gaps (#27–#33); version 3.4 added the reference boundary, scene composition, and palette rules (#34–#35); version 3.5 moved to the 3D voxel world (#36); version 3.6 set the closest-original-match goal and smooth round-world camera direction (#37–#39); version 3.7 fixed camera centering and gesture thresholds, capped refreezing, added local save recovery, and specified the compact HUD (#40–#43); version 4.0 added Town mode, the motion and physics layer, and the continuous world (#44–#47); version 4.1 added the style direction and comparable titles (#48–#49).

| # | Conflict | Decision | Why |
|---|---|---|---|
| 1 | Title: Frostline Factory vs Little Batch Works | **Little Batch Works**; Frostline kept as alternate | Most developed naming and world text; both still require availability checks |
| 2 | Platform: desktop-only vs also mobile | **Web + Windows EXE + Android APK at launch**; iOS, macOS, Linux post-MVP | Product requirement is playability on both PC and phone; APK implies Android |
| 3 | Starter fruit: strawberry/lemon vs peach/apple | **Peaches and apples**; berries and citrus as later unlocks | Matches the reference concept description and the latest reconciliation |
| 4 | Cold chain: mandatory P1 vs prototype-only | **Ship as the single differentiator, gated behind a stable core, cuttable last**, with salvage instead of deletion | Preserves the differentiator without endangering the core loop; salvage keeps the cozy promise |
| 5 | Spoilage outcome: discarded vs never destroyed | **Melted Mix salvage** | A cost in time, not goods, avoids frustration and soft locks |
| 6 | Launch levels: tutorial+5/6 vs tutorial+3 | **Tutorial + 3**; two named levels move to post-MVP | Scope realism; the three launch levels already cover every core mechanic |
| 7 | Schedule: 8 weeks vs up-to-16 | **Superseded by #16** (multi-platform scope raised the estimate) | Adding two native targets, touch UI, and signing moves the range beyond either original draft |
| 8 | Success metrics: gates vs hypotheses | **Hypotheses with targets**, not release gates | Pre-launch numbers are not validated evidence |
| 9 | Upgrades: three tracks × three levels vs one or two tracks | **Two tracks** (speed 2 levels, cooling 1 level) | Keeps the UI and balance simple at launch |
| 10 | Workers: role assignment vs purely cosmetic | **Station-bound cosmetic, role reassignment P1 and first cut** | Prevents a second hidden logistics system |
| 11 | Seasons and landmark meter: P1 vs prototype | **Post-MVP** | Both add content scope before the core loop is proven |
| 12 | Performance targets: mobile 60 FPS / 5 MB / 3 s vs desktop-only budgets | **60 FPS desktop and mid-range Android; 5 s first playable; ≤ 1.5 MB shell; ≤ 8 MB web level; ≤ 50 MB APK; ≤ 120 MB EXE** | Mobile is now in scope, so both budgets apply — with artifact sizes instead of a single 5 MB cap |
| 13 | Native packaging tech | **Electron for Windows, Capacitor for Android, one web codebase** | Electron is JS-only and mature; Capacitor packages the shared Three.js build and avoids a Rust toolchain (Tauri stays an option) |
| 14 | Touch input priority | **P0, not post-MVP** | The APK is a launch artifact, so a touch-only playthrough must work at release |
| 15 | Save persistence on native builds | **IndexedDB + JSON mirror behind one `SaveStore` interface** | Android WebView storage can be evicted; the mirror makes saves recoverable and portable between builds |
| 16 | Schedule with three targets | **10–12 weeks target, 16 outer bound** | Adds touch UI, two shells, signing, installers, and a device matrix on top of the original scope |
| 17 | Distribution model | **Direct EXE download and sideloaded signed APK at launch; stores later** | Fastest path with no review dependency; AAB and auto-update follow once the loop is validated |
| 18 | Orientation | **Landscape locked; portrait shows a rotate prompt** | The wide 3D voxel layout and HUD do not fit portrait at MVP quality |
| 19 | Counter accepted only tea and tubs, but early levels needed fruit orders | **Counter accepts washed fruit, bases, tea, and tubs; sold as cups** | Makes the tutorial and level 1 completable without adding recipes; display names keep the fiction readable |
| 20 | Cream and sugar had no way onto belts; sugar unused | **Dairy Crate source with manual, player-initiated cream purchase; sugar removed** | Keeps cream inside the belt model, removes a dead ingredient, and avoids automatic coin spend |
| 21 | Two-input machines vs single-path, merger-free belts | **Labeled input sockets A/B, per-socket buffers, one belt per socket** | Preserves the "no mergers at launch" scope while making Brewer and Mixer routable |
| 22 | Freezer holds tubs but also takes mix; unclear when freshness starts | **Freezer output is chilled (4 tubs); freshness runs only on belts, pauses in the counter's chilled buffer** | Creates the intended tension (route length, backed-up belts) with one clear rule |
| 23 | Flat 150 starting coins vs level build costs | **Authored starting coins per level, pre-placed buildings, and a 90% budget rule with a cost audit** | Makes every level affordable by construction |
| 24 | Acceptance criterion cited an IP checklist that did not exist | **Add the checklist to §9 as a release gate** | Makes the originality requirement testable |
| 25 | FR-26 was P1 but acceptance #21 required it | **FR-26 raised to P0; added to the never-cut list** | Keeps requirements and acceptance criteria consistent |
| 26 | Acceptance intro said "public browser release" | **"Public release (web, Windows, and Android)"** | Matches the three-target scope |
| 27 | Delivery was undefined: buffer vs manual serve | **Automatic match on intake, "no order needs this", discard for buffered items** | One rule covers validation, matching, and blocked-buffer recovery |
| 28 | Melted Mix could deadlock the final belt forever | **Universal item removal plus 15 s auto-discard for Melted Mix** | Guarantees no permanent blockage without destroying unspoiled goods |
| 29 | Dairy Crate spent coins automatically | **Cream is bought with an explicit button; the crate never spends on its own** | Automatic spending feels like a leak and can drain a level's budget |
| 30 | Levels 1 and 2 failed the 90% gate | **Raise starting coins to 165 and 195; all four levels pass** | The specification must satisfy its own acceptance criterion |
| 31 | Orchard's undrained lane had no rule | **Each lane buffers 2 and pauses independently** | A source must never stall because the player ignored its other product |
| 32 | Machine-to-machine handoff was never defined | **No direct port-to-port transfer; at least one belt tile required** | Matches "belts perform all transport" and makes the tutorial belt counts exact |
| 33 | Order text read oddly ("one washed peach") | **Display names: Peach Cup, Apple Cup, Peach Puree Cup, Apple Puree Cup** | Fixes the fiction without changing item IDs or recipes |
| 34 | The mood image could be copied rather than used as inspiration | **Store it in `reference/`, embed it in §9, define borrow/avoid boundaries, and keep it out of every build** | Captures the fantasy without importing another brand's expression |
| 35 | The art could drift toward the reference's green field and pastel-blue machinery | **Superseded by v3.5's requested green world, pastel voxel machinery, and blue conveyors** | Moves the game toward the user's updated visual target while retaining original assets |
| 36 | The project used flat 2D isometric art and a small map | **Three.js voxel world, 40 × 26 maps, orbit camera, expanded scenery** | Makes the workshop feel spatial, larger, and explorable |
| 37 | Request to make the game look exactly like the reference image | **Match the reference's mood, palette, camera, and composition as closely as original assets allow; never reproduce its artwork, text, characters, or arrangement** | An identical copy would fail the IP checklist and could not ship in any of the three builds; the look-and-feel review keeps the visual target measurable |
| 38 | Blocky voxel terrain and cubic trees made the world look like Minecraft | **Smooth rolling hills on a round island, rounded-edge blocks, soft trees** | Keeps the toy-like, cheerful mood of the reference and avoids resembling another well-known game |
| 39 | Pan-first controls did not suit a round world | **Globe-style orbit: drag spins and tilts, right-drag pans, wheel zooms toward the pointer** | Matches the requested rotation feel while keeping click-to-select working |
| 40 | Island orbit appeared off-center and click/drag intent was ambiguous | **Fixed the orbit pivot at the island's visual center, framed the whole island by default, and use a 5 CSS px tap/orbit threshold** | Keeps the world centered while making selection and camera gestures distinct |
| 41 | Refreezing granted a new 45-second timer on every loop | **At most two refreezes per tub, with 30 s then 15 s freshness; subsequent Melted Mix remains removable but cannot be refrozen** | Closes the infinite reset loop without silently deleting an item or creating a permanent blockage |
| 42 | Save recovery did not define a local fallback beyond the previous-good slot | **Validate and try the current save, previous-good slot, daily snapshot, and native mirror; if none survive, explain and offer export/reset** | Improves recovery while stating honestly that erased local copies cannot be restored |
| 43 | Pinned HUD panels could crowd the minimum Android landscape viewport | **Below 800 CSS px, show Build, Orders, and Inspector as mutually exclusive sheets/full-screen panels with 44 px targets** | Preserves useful world space and control access on small phones |
| 44 | The ground read as a floating spinning top (finite island with a conical keel) | **Continuous landscape: meadow, hills to the horizon, distant forest, fog-hidden edges; no keel or rim** | Removes the floating-object read from every camera angle and gives the world scale |
| 45 | Four authored levels (30 to 45 minutes) cannot support a long-term tycoon audience | **Town mode: persistent town, XP and Town Level, unlock tree, order board, land expansion, story chapters, daily goals (FR-27 to FR-34)** | Matches the Township, Hay Day, and Clash of Clans style loop the product owner asked for while keeping the no-premium-currency, no-ads rule |
| 46 | Item motion jumped in 10 Hz steps | **Render-time interpolation by tick fraction, continuous handoffs, eased blocking** | Smooth visuals without touching the deterministic simulation |
| 47 | Request for real physics | **Cosmetic spring and particle layer only; no rigid-body engine in gameplay** | Keeps determinism, saves, and Android size and battery under control while delivering the visible bounce and weight |
| 48 | New style notes (cute isometric pastel look, comparable titles) arrived in `suggestions.md` | **Adopt the mood as a style direction (chibi characters, clean pastel fills, shape-first readability) translated into our 3D rounded-block look; keep `suggestions.md` a non-binding reference** | Gives artists a concrete, checkable target without importing any source artwork or letting a loose note override the PRD |
| 49 | "Chibi" characters could drift toward the source brand's penguin mascots | **Require original non-penguin species with a design sheet per role, and add a checklist item** | Keeps the cute character direction inside the IP boundary |

**Superseded documents:** Frostline Factory v0.1, Little Batch Works v1.0, PRD 2.0, `prd-merged.md`, v3.1, v3.2, and the v3.3 state of this file. Retain for history; do not edit as sources of truth.
