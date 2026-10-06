# Decisions

Material design and architecture decisions, with the reason for each. Newest last within each section.

## Stack

- **Phaser 4 + its bundled Matter.js, TypeScript, Vite, Vitest, Playwright.** Phaser gives a fast WebGL 2D renderer and camera; Matter is the rigid-body engine Phaser already ships, so there is one physics build for the browser and for headless tests (imported through the `follyworks-matter` alias, see `src/sim/matter.ts`).
- **No external art or audio files.** All part art, environments, particles and sound are generated procedurally at runtime (`src/render/art/*`, `src/audio/*`). The texture bank (`src/render/TextureBank.ts`) is the replacement boundary if painted assets arrive later.
- **Fonts are bundled via `@fontsource`** so the game works offline.

## Simulation

- **The simulation is pure and deterministic at a fixed 60 Hz tick.** It knows nothing about Phaser. RUN builds a fresh `Simulation` from (level, build); RESET throws it away. That gives exact reset, reproducible runs, and headless level tests that use the very same code as the game.
- **Rewind/scrub by snapshots** (`src/sim/history.ts`): a full snapshot every 2 ticks, capped at 2700 entries (90 s of run time). Scrubbing restores a snapshot for display.
- **Resuming after a rewind replays from scratch instead of from the snapshot.** Matter keeps solver state (contact caches, warm-start impulses) that a snapshot cannot hold, so a restored world drifts from the original within a second or two and "rewind, resume" could change the outcome. `RunController.resync()` builds a fresh simulation and fast-forwards it to the scrubbed tick before stepping on. Ticks cost 30–90 µs, so even a 20 s fast-forward is imperceptible, and the replay is exact.
- **Two Matter substeps per tick.** Without them a bowling ball dropped from ceiling height (~18 px per tick) tunnels through a 12 px plank or seesaw. Component forces are re-applied for the second substep because Matter clears them after each update.
- **Round bodies use real disc inertia; dominoes use real rectangle inertia.** Matter inflates inertia 4x for stacking stability. On a ball that meant two thirds of its speed turned into spin the moment it touched the floor, so balls stopped after half a metre. Round bodies are built as 32+ sided polygons for the same reason (Matter otherwise caps a 14 px ball at 14 sides).
- **Gentle contacts never bounce, and buckets absorb bounces.** `Pair.update` is wrapped once so contacts approaching slower than 1.2 px/tick get zero restitution (rolling balls stop chattering on their facets) and bodies flagged `plugin.absorb` (the bucket) use the less bouncy of the two materials instead of Matter's default "bounciest wins", so rubber balls stay in buckets.
- **A contact that starts and ends inside one tick still counts.** With two substeps, a fast ball can touch a trampoline and leave it before the end-of-tick contact list is built, and the trampoline would act like a plain block, depending on sub-pixel placement. New contacts are also noted after the first substep and reported if they vanished by the end of the tick.
- **Impact speed is measured from pre-step velocities.** By the time contacts are reported the solver has already resolved the bounce, so impact sounds, trampolines and fragile parts read the velocity captured at the start of the tick.
- **Domino assist.** A domino tilted past ~11° that touches a standing neighbour on its falling side hands on its spin (at least 0.035 rad/tick) and pivots the neighbour about its foot. Pure rigid-body contact shoved neighbours sideways or let the chain stall leaning; players expect dominoes to just work.
- **Seesaw ends have small lips** so a ball parked on the low end waits to be launched instead of rolling off as soon as the plank tilts.
- **Bolt (the robot) steps over low kerbs and brakes when unpowered.** He climbs anything no taller than his ankles that has free space above it (a plank lying on the floor, a ramp's end, ramps up to ~11°) and still turns around at real walls. His feet have no friction (so he walks smoothly), so he now brakes explicitly when power is cut instead of skating on for a metre.

## Rules

- **Wires are free; ropes and belts come from the parts bin.** Wiring is about logic, not scarcity.
- **A player may not add a wire into an input socket the level already feeds.** Otherwise a pre-wired battery could be run straight to the device and skip the level's switch. Wiring a level's battery output to more things is allowed (tutorial 5 depends on wiring two level parts together).
- **ELEGANT is earned by meeting either authored target: few parts (`elegantParts`) or a quick finish (`elegantTime`).** The spec frames elegance as "economy, fewer components, or efficient completion", and levels are small enough that "either" can't be gamed by a huge fast machine. The briefing shows both targets.
- **ABSURD counts distinct stages of the chain reaction** (each part's first activation, including two loose things knocking into each other) up to the moment of solving. The default target is 7, with a per-level override `bonus.absurdStages`.
- **Every campaign level has a hand-tuned ABSURD target, set just above its simplest solution and proven by an authored over-the-top build.** A flat 7 turned out to be unreachable on most levels (verified solutions reached 0–6 stages). `tests/levels/absurd.test.ts` checks that the simplest solution misses ABSURD and the elaborate one earns it.
- **Tutorials have no ABSURD bonus (`absurdStages: 0`).** Their parts bins are too small for any build to beat the plain solution, so showing a target there would only advertise something impossible.
- **Level walls can be as thin as 6 px** (the minimum was 20), so authors can build chutes, lips and racks without fat masonry.
- **Gears may overlap the hub of any fixed, non-moving part that has a rotor** (a motor, a pulley, another gear's axle). Meshing needs the rims to touch, which the overlap rule otherwise forbade.
- **A stalled run says so early.** When a level with goals has had nothing moving, burning, counting down or part-way through a hold goal for 2 s, a banner offers "Back to building" instead of making the player wait out the time limit. It is a read-only check, so it cannot change a run, and every reference solution is tested never to trigger it before solving.
- **Campaign unlocking is soft:** a level is open if it is within 3 of the number solved, already solved, or "unlock all" is on in settings. Nobody gets stuck behind one puzzle.

## Rendering

- **The renderer interpolates between ticks** using the pose captured at the start of each step, and measures frame time itself with `performance.now()` (Phaser's smoothed delta under-reports at low frame rates, which made runs play in slow motion).
- **Environment art is three layers** (far, light, near). The near layer is a parallax foreground restricted to the margins so it never hides machine parts.
- **Floating stage labels scale with 1/zoom** so they stay readable at any camera zoom.
- **Phaser renders with `maxTextures: 1`.** With four or more textures batched together, the software WebGL used in testing (SwiftShader) drew some quads torn in half (a plank as a thin wedge). One texture per batch costs a few extra draw calls, which a scene of this size does not notice. `?maxtex=N` overrides it for comparison.
- **The near foreground layer is cleared over the whole world rectangle**, not just its middle, after a pipe in the maintenance room hid a battery.
- **The properties panel lives under the parts bin in the left column.** As a floating panel at the top right it covered machines in levels whose action happens there.
