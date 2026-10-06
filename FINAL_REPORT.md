# Final report

## Summary

Follyworks is playable from first launch to the last campaign puzzle:

- a menu, a 25-level campaign (5 tutorials plus 20 campaign levels in 10 chapters), a sandbox and a level editor;
- 31 parts plus rope, belt and wire connectors;
- deterministic physics with rewind, scrub, slow motion and frame step;
- SOLVED / ELEGANT / ABSURD scoring with explanations;
- versioned local saves;
- procedural art, music and sound.

Every level is verified solvable both by headless tests and by playing it in a real browser. The core loop works: read the goal, drag in a few parts, run, watch it fail, rewind or reset, adjust, try again. The best evidence for whether it is fun is the "whether it is fun" section below; it has not yet had a human playtester.

## Implemented scope

**Campaign**
- 5 tutorial levels (place, redirect, trigger, connect, a tiny machine).
- 20 campaign levels: Cause & Effect, Gravity, Momentum, Springs & Levers, Ropes & Pulleys, Mechanical Power, Air/Heat/Energy, Electricity, Sensors & Logic, Ridiculous Machines.
- Each level has a briefing, goals shown in the top bar, progressive hints, a time limit, ELEGANT targets (parts and/or time) and an ABSURD chain target.
- Unlocking is soft: a level opens when it is within 3 of your solved count, or with "unlock all" in settings.

**Parts (31)**
- Physics: rubber ball, bowling ball, crate (wood/steel), domino, plank, seesaw, trampoline, bucket, pulley, hook.
- Mechanical: gear, motor, conveyor.
- Air and heat: fan, balloon, candle, rocket.
- Chaos: cannon (and cannonball), dynamite, boxing glove, cactus.
- Electric and logic: battery, light bulb, toggle switch, pressure plate, timer, logic box (AND, OR, NOT, XOR, toggle), magnet.
- Creature: Bolt the walking robot.
- Editor-only scenery walls.
- Connectors: ropes that wrap pulleys, burn and snap; drive belts; wires.

**Build tools**
- Drag from the bin, click-to-place, move, box-select, rotate (snapped or fine), flip, duplicate, copy/paste, delete, nudge.
- Undo/redo, grid snap, pan, zoom.
- Valid and invalid placement shown live using real collision geometry.
- Connection sockets glow while a connector tool is active.

**Run tools**
- Run/reset (exact), pause, single-frame step, ½× and ¼× speed.
- Hold-to-rewind and a draggable timeline over up to 90 s.
- Ghost trails of the previous run, floating stage labels, and a chain counter.
- An early "everything's stopped" banner when a run stalls.

**Scoring**
- SOLVED.
- ELEGANT when either the parts target or the time target is met.
- ABSURD when the chain of distinct events reaches the level's target. Each of the 20 campaign levels has its own target, proven reachable by an authored over-the-top build; the tutorials have no ABSURD bonus.
- The results card shows a "work order" receipt listing every stage and goal with its time, plus a stamp for each result with the reason it was or wasn't earned.

**Sandbox**
- Every part, unlimited, no goals, any of the six environments.
- Autosave plus named save slots; rewind works as in puzzles.

**Level editor**
- New, rename, duplicate, delete.
- Fixed objects (scenery) and starting objects.
- Inventory counts, including unlimited.
- Goals: reach a zone (with hold time), contact, activate, container count, height, destroyed. Zones are dragged and resized on the stage.
- Time limit and bonus targets.
- Instant test with exact return to the edit state.
- Autosave; export as text or file; import with validation and repair.

**Persistence**
- One versioned JSON document in localStorage holding settings, progress, builds per level, custom levels and sandbox slots.
- Malformed data is repaired field by field. An unreadable save is kept aside and replaced with defaults.

**Audio**
- Synthesised impacts by material pair and speed, continuous machine loops, UI sounds and a generative music bed.
- Master, effects and music volume, plus mute.
- Voice limits and an impact rate limiter keep big chain reactions from becoming noise.

**Presentation**
- Six painted cutaway workshop environments with parallax foregrounds and light passes.
- Procedural part art.
- A warm industrial UI with brass, stencil type and hazard stripes.

## What was actually tested

All numbers are from the final state of the code.

- **Unit and simulation tests (Vitest)**: 666 pass, plus 2 expected failures that document a Matter limitation (see Known defects). They cover:
  - level parsing and repair;
  - session undo/redo and inventory rules;
  - placement validation;
  - scoring rules and wording;
  - save loading, corruption and migration;
  - rewind history, including that a resumed run matches the original;
  - component behaviour;
  - physics "feel": dominoes topple at 30–50 px gaps, a ball keeps rolling, nothing tunnels through a seesaw, a bucket holds a rubber ball, the robot climbs kerbs, turns at walls and brakes;
  - stalled-run detection never firing on a working machine.
- **Level tests**: for every campaign level:
  - it parses cleanly;
  - an empty build does not solve it;
  - every reference solution solves it within the time limit, using only parts from its inventory and without overlapping scenery;
  - the solution still works when parts are nudged a few pixels;
  - listed tempting shortcuts fail;
  - the ABSURD reference build reaches the level's ABSURD target.
- **Browser tests (Playwright, production build, headless Chromium with software WebGL)**:
  - `e2e/smoke.mjs` uses real mouse and keyboard to cover the menu, dragging a part in, undo/redo, solving tutorial 1, the saved result, scrubbing back to 0 and re-solving, the editor (new level, placing, Goals tab, saving, export), the sandbox and settings. It also checks for console errors.
  - `e2e/acceptance.mjs` covers:
    - moving, rotating, duplicating and deleting parts; wheel zoom; middle-drag pan;
    - slow motion at the right rate; pause; frame step exactly one tick; reset to the exact pre-run state;
    - settings and progress surviving a reload;
    - the editor's test-and-return; level rename, duplicate, import (including bad JSON) and delete;
    - a corrupt save booting cleanly and being kept aside.
  - `e2e/campaign.mjs` loads all 25 levels in the browser, plays a reference solution and records the SOLVED/ELEGANT/ABSURD stamps and any console errors. It was run twice: with the simplest solutions, all 25 solve and none earns ABSURD; with the ABSURD builds, all 25 solve and all 20 campaign levels earn ABSURD. Neither run had console errors.
  - Final runs: smoke 16/16 checks, acceptance 24/24 checks.
- **A fast-bounce bug found while authoring ABSURD builds.** A contact that began and ended inside one tick was missed, so a trampoline could act as a plain block depending on sub-pixel placement. It is fixed and covered by a regression test.
- **Visual inspection**: screenshots of every screen and of all levels, reviewed by me during development. They found and drove fixes for:
  - torn sprites;
  - a foreground pipe hiding a battery;
  - the properties panel covering machines;
  - a translucent-panel seam;
  - a stale time-up banner;
  - duplicate level names.
- **Playtesting**: I played through levels by hand-placing parts and by perturbing the reference solutions. This drove these changes:
  - physics changes: substeps, real rolling inertia, the domino assist, bucket damping, seesaw lips, the robot stepping and braking;
  - level retunes: chute widths, ball positions, trampoline angles;
  - rule fixes: the wire loophole, ELEGANT semantics, gear placement;
  - the stalled-run banner.

**Not tested:**
- Real GPUs: all browser runs used software rendering. The run clock is wall-time based, so slow software rendering made runs look slower in screenshots, not wrong.
- Firefox and Safari.
- Touch devices.
- Audio by ear: sound runs without errors in the browser, but nobody has listened to the mix.
- Real human players.

## Known defects and rough edges

- **Parts read small on smaller screens.** The world is 1600×900 and is fitted between the HUD panels; at 1440×860 the zoom is about 0.75 in puzzles and lower in the editor. Zoom fixes it, but first impressions would be better with larger parts.
- **Some goal zones are bare dashed rectangles** rather than visible bins or bays painted into the environment.
- **The domino assist is not physics.** It gives believable chains, but a deliberately odd domino arrangement can behave "too helpfully".
- **Rewind display is approximate between snapshots.** Snapshots are every 2 ticks, so a scrub lands on even ticks. Resuming is exact (see `RunController.resync`).
- **Placement constraints** are only partly visible: the 600 px conveyor length cap and similar prop limits appear only as slider ranges.
- **ABSURD targets are tuned against one authored build per level.** Players will find other ways, but a target could still feel steep on levels whose best authored build only just reaches it (1-1, 3-1, 7-1). There is no ABSURD bonus in the five tutorials: their parts bins can't beat the plain solution, so none is shown.
- **Two `it.fails` tests** in `tests/history.test.ts` document that Matter cannot resume bit-exactly from a restored snapshot. This is a known engine limitation that the game works around.

## Compromised requirements

- **Mobile and touch**: not supported. The game is designed for mouse and keyboard on desktop.
- **Painted art**: all art is procedural Canvas 2D in the target style, not hand-painted assets. `TextureBank` is the replacement boundary.
- **Physics realism**: we made deliberate concessions for fun and readability. They include the domino assist, robot kerb-stepping, no restitution for gentle contacts, buckets absorbing bounces, ropes as constraints rather than chains, and a kinematic gear network. See DECISIONS.md.
- **Rendering performance mode**: `maxTextures: 1` trades a few draw calls for correctness on software WebGL. It has not been profiled on real GPUs.

## Five highest-value next improvements

1. **Human playtests** of the tutorial and chapters 1–4 with 3–5 people, watching for where they stall. Tune hints, briefings and time limits from that.
2. **Larger, more readable parts and goal props.** Raise the default zoom by cropping the room margins, and paint real bins, bays and pockets for goal zones.
3. **A failure explainer.** After a stalled or timed-out run, point at the last thing that happened and the goal that was missed ("the ball stopped here, 140 px short"). The data already exists in the chain log and the goal state.
4. **A real-GPU performance pass and a cross-browser check** (Firefox, Safari), including a frame-time budget for the largest levels and particle bursts.
5. **More campaign content per chapter** (3–4 levels each), plus level sharing by URL so custom levels travel without file handling.

## Architecture risks

- **Matter.js internals**: we patch `Pair.update` and depend on Phaser's bundled Matter fork. A Phaser upgrade could change contact behaviour and silently retune every level. The level tests would catch that, which is why they matter.
- **Determinism across browsers**: runs are deterministic within one JS engine. Floating-point differences between engines could make a borderline solution behave differently on another browser. That affects replays and sharing, not normal play.
- **Rewind cost on long runs**: `resync()` replays from tick 0. That is cheap now (about 30–90 µs per tick), but a heavy sandbox machine near the 90 s cap could make resuming take a noticeable moment.
- **Large procedural art files**: `render/art/parts.ts` and `environment.ts` are large. They are isolated behind `TextureBank`, but they are the slowest code to change.
- **localStorage**: one document per browser. Clearing site data loses custom levels unless they were exported.

## Is it fun?

**Yes, in the way this genre is fun, with one honest caveat: no human other than the builder has played it yet.**

What works, from playing it repeatedly while tuning:

- **The retry loop is fast and cheap.** One key runs and resets. The reset is exact, and the previous run's ghost trail stays on screen. Holding ← rewinds to the moment it went wrong. When a machine stalls, the game says so within two seconds and says what missed ("the rubber ball ended up just short of the goal zone"). Fixing a near miss usually takes seconds, which is exactly what makes "one more try" compelling.
- **Machines fail in readable, often funny ways.** A ball skids off a too-steep plank. A domino line stops at a gap. Bolt marches proudly past the switch. A balloon drifts into the cactus. Floating labels ("Bolt hit the crate", "Timer went DING") narrate the chain, and the receipt on the results card turns a solution into a little story.
- **There is usually more than one answer.** Reference solutions include alternatives, and nudge tests show the intended ideas tolerate imprecise placement, so puzzles reward the idea rather than pixel hunting.
- **ABSURD gives finished levels a second life.** Every campaign level has a reachable chain target and an authored over-the-top machine proving it. "Now do it the stupid way" is the best part of the genre.

Where it falls short today:

- **The first impression undersells it.** Parts look small at the default zoom and some goal zones are bare dashed boxes, so the workshop looks prettier than the machine inside it.
- **A few late levels lean on precise timing** (fan cut-off times, trampoline angles). These are the levels most likely to feel like guesswork to a new player, and only playtests will show it.
- **25 levels is a short campaign.** The sandbox and editor extend it, but the difficulty curve between chapters is my judgement, not measured.

Bottom line: a player can enter a puzzle, understand the goal from the briefing and top bar, place a few silly parts, run it, see why it failed, rewind or reset, change it and want to go again. That is the central Follyworks experience, and it is in place. The next most valuable step is watching real people play the first ten levels.
