# Architecture

Follyworks is a single-page TypeScript app: Phaser 4 for rendering, the Matter.js build bundled inside Phaser for physics, plain DOM for the interface, and Web Audio for procedurally generated sound. Vite builds it into a static site.

The central rule is that **the simulation is pure data in, data out**. A level and a player build (both plain JSON) go into a `Simulation`. The simulation knows nothing about Phaser, the DOM or audio. Everything visible or audible is derived from it, and the same code runs headless in Vitest.

```
            ┌──────────── app/App.ts (routing, settings, audio, Phaser game) ─────────────┐
            │                                                                             │
  ui/screens.ts                         ui/PlayScreen.ts (HUD)                             │
  menu · campaign map · levels ·        bin · tools · dock/timeline · properties ·         │
  settings · import/export              briefing · hints · results · EditorPanel           │
                                             │                                             │
                                  game/PlayController.ts                                   │
                         ┌───────────────────┴───────────────────┐                         │
              game/EditorController.ts                 game/RunController.ts               │
              (build mode input)                       (run mode: clock, rewind, fx, sfx)  │
                         │                                       │                         │
                 editor/Session.ts                         sim/Simulation.ts ◄── sim/history.ts
                 (document + undo)                               │
                         │                     components/registry.ts + defs/*  ──  sim/power,
                         └──── core/types.ts, core/level.ts ─────┘               rotation, ropes, goals
                                                                 │
                                         render/WorkshopScene.ts (draws whatever sim it is given)
                                         render/views.ts · Overlays.ts · Fx.ts · Environment.ts
                                         render/art/* (procedural Canvas 2D painters) · TextureBank
```

## Source layout

| Folder | Responsibility |
| --- | --- |
| `src/core` | JSON data types (`LevelDef`, `BuildDef`, `ObjectDef`, `GoalDef`…), level parsing, validation and migration (`parseLevel` never throws; it repairs and reports problems). |
| `src/components` | The component registry and every part definition (`defs/basic, mechanical, force, chaos, control, creature`). `kit.ts` holds shared body builders. |
| `src/sim` | `Simulation`, `Entity`, and the subsystems: electricity (`power.ts`), the gear/belt rotation network (`rotation.ts`), ropes and pulleys (`ropes.ts`), goal evaluation (`goals.ts`), rewind snapshots (`history.ts`) and the Matter import and patch (`matter.ts`). |
| `src/editor` | `Session` (the editable document plus undo/redo) and inventory rules. |
| `src/game` | Controllers (`PlayController`, `EditorController`, `RunController`), placement validation, scoring, tutorial guidance logic (`guide.ts`), and the campaign (`levels/tutorial.ts`, `levels/group1.ts`–`group5.ts`). |
| `src/render` | The Phaser scene, entity views, overlays (ropes, wires, sockets, goal zones, selection, ghost trails), particles and labels, environments, and the procedural art painters. |
| `src/ui` | DOM screens and the in-game HUD. |
| `src/audio` | The audio engine: one-shot effects, continuous machine loops and generative music, all synthesised. |
| `src/persistence` | Versioned save document in `localStorage`. |

## Data model

- **LevelDef** — world size and gravity, environment, `fixedObjects` (immovable scenery and machinery), `startingObjects` (part of the puzzle, not editable by the player), level `connections` (ropes, belts, wires), `inventory` (what the player may place, `-1` = unlimited), `goals`, `restrictions` (time limit, part cap) and `bonus` (ELEGANT and ABSURD targets).
- **BuildDef** — what the player added: `objects` and `connections`. It is stored per level, separately from the level.
- **ObjectDef** — `{ id, type, x, y, angle?, flip?, props? }`. `type` is a stable registry key; levels never refer to code.
- **GuideStep** (optional `guide` on a level) — text, an optional pointer (a world point, a parts-bin entry or a HUD control), an optional ghost part, and an `until` trigger (`place`, `connect`, `run` or `ack`). The current step is the first whose trigger is not met, so guidance follows the build rather than a script, and it never restricts what the player can do.
- **GoalDef** — generic primitives: `enterRegion` (with optional hold time), `contact`, `activate`, `containerCount`, `height` and `destroyed`. Selectors pick targets by id, type or tag. The engine checks whether things happened and has no idea of an "intended solution".

Campaign levels are TypeScript files that export plain data plus `solutions`: reference builds used by tests, and in the game only to derive Easy and Hard (`game/difficulty.ts`, a pure `applyDifficulty(entry, d)`) and to feed the hint ladder (`game/hints.ts`: nudge, parts list, then ghost outlines drawn through `PlayController.hintGhosts` alongside the tutorial guide overlay). Every campaign level uses the standard room (`STANDARD_WORLD`, 1120×630).

## Components

Each part is one `ComponentDef` (`src/components/registry.ts`):

- **Static description** — name, category, domain, props with ranges, ports (electric in/out), anchors (rope attach points), rotor (gear/belt wheel), footprint and art key.
- **Behaviour hooks**, all optional:
  - `build` creates Matter bodies.
  - `logic` is pure signal pass-through, run to a fixed point.
  - `step` runs before physics; `afterStep` runs after it.
  - `rotorSource` / `onRotor` belong to the rotation network.
  - `onCollide`, `onHeat`, `onBlast` and `onRopePull` react to events.
  - `interior` is used by container goals; `isActive` feeds visuals and activate goals.

Adding a part means adding one definition plus its art in `render/art/parts.ts` and a view in `render/views.ts`. Nothing else switches on part type.

## One simulation tick (60 Hz)

`Simulation.step()`:

1. Capture each body's previous pose and velocity (used for interpolation and for impact speed).
2. Propagate electricity: batteries → wires → switches/plates/logic → devices, iterated to a fixed point.
3. Solve the rotation network: motors drive their rotor, toothed rotors mesh with neighbours (opposite direction, radius ratio), belts link rotors (same direction), and conflicting drives jam the group.
4. Run each component's `step` (fans push, balloons lift, robots walk, timers count).
5. Run two Matter substeps of 1/120 s each, re-applying component forces for the second.
6. Solve ropes (four velocity iterations), then report rope tension to the parts at each end.
7. Collect contacts and fire `onCollide` (with the pre-step approach speed). The first meaningful activation of each part becomes a chain-reaction stage.
8. Run each `afterStep` (sensors), spread heat, and cull anything that fell out of the world.
9. Advance the clock and evaluate goals.

The simulation is deterministic for a given (level, build): the same inputs give the same run, tick for tick. Tests rely on this, and so does rewind.

## Build mode vs run mode

- **Build mode** — `PlayController` owns a `Session`, the authored document. The scene renders a never-stepped "build simulation" made from it, so what you see while editing is the exact geometry that will collide. `EditorController` turns pointer and keyboard input into `Session.commit(...)` calls; each commit snapshots the document for undo and redo, and the screen autosaves through it. Placement is validated by building the candidate into a throwaway mini-simulation and checking real Matter overlap (`game/placement.ts`).
- **Run mode** — RUN creates a fresh `Simulation` from deep copies of the level and build. `RunController` steps it with a fixed-timestep accumulator (scaled for ½× and ¼× speed), records history, and turns simulation events into sounds, particles and floating labels. RESET discards the simulation; the document was never touched, so the reset is exact.

## Rewind

- `sim/history.ts` stores a full snapshot every 2 ticks: body kinematics, every entity's flat `state` bag, signals and rotor state, and rope state. It keeps at most 2700 snapshots (90 s of run time).
- Scrubbing restores the nearest snapshot for display.
- Matter keeps internal solver state (contact caches, warm-starting impulses) that no snapshot can carry, so a restored world would drift slightly if stepped forward. Before stepping on from a scrubbed point, `RunController.resync()` therefore builds a fresh `Simulation` and fast-forwards it to the scrubbed tick, which costs about 30–90 µs per tick. That makes "rewind, then resume" replay exactly the same machine.

## Rendering

- `WorkshopScene` draws whatever simulation it is handed. It interpolates poses between ticks and manages the camera (fit to the world inside the HUD insets, plus user pan and zoom).
- Entity sprites are layered textures from `TextureBank`, which paints each texture once with Canvas 2D (`render/art/*`) and caches it by key and parameters.
- Environments are three layers: a painted far wall, an additive light pass, and a near-layer silhouette frame kept outside the play area.
- Particles and labels (`Fx.ts`) are pooled and hard-capped.
- Phaser runs with `maxTextures: 1` (see DECISIONS.md).

## Interface

- The HUD is DOM layered over the canvas, so text is crisp and accessible, and the canvas never has to lay out UI.
- `PlayScreen` is shared by campaign, sandbox, level editor and test play; `cfg.kind` switches features on and off.
- `GuideCoach` draws tutorial guidance: a DOM card and arrow, plus the ghost outline through `PlayController.guideOverlay`.
- The level editor adds `EditorPanel` with three tabs: level settings, parts bin (inventory) and goals.

## Persistence

`persistence/save.ts` keeps one JSON document, `follyworks.save`, with a `version` field. It holds settings, per-level progress, the autosaved build for each level, custom levels, sandbox slots and the level last open in the editor.

- Progress is kept per difficulty (`byDifficulty.easy/normal/hard`) beside the aggregate fields; saves from before difficulties load as Normal. Builds for Easy and Hard autosave under `<id>@easy` / `<id>@hard`.
- Loading never throws. Unknown or broken fields fall back to defaults field by field.
- An unreadable document is copied aside to `follyworks.save.corrupt-<time>` before defaults are used.
- Writes are debounced and flushed on page unload.

## Audio

- `AudioEngine` builds a small Web Audio graph (effects, loops and music buses into a compressor) and synthesises everything: impacts chosen by material pair and speed, continuous loops for motors, fans, conveyors, rockets and flames, and a generative Markov-chord music bed.
- Voices are limited and rate-limited per sound, so a domino avalanche stays pleasant.

## Tests

- `tests/*.test.ts` — unit tests for level parsing, session and undo, placement, scoring, saves and history; component behaviour tests; and "feel" tests (dominoes topple at realistic gaps, balls keep rolling, the robot climbs kerbs and turns at walls).
- `tests/levels/difficulty.test.ts` — for every campaign mission, Easy and Hard parse, the (adjusted) reference solution solves them within their time limits, Easy is never harder than Normal and Hard never easier. `tests/hints.test.ts` covers the hint ladder and the ELEGANT penalty.
- `tests/levels/campaign.test.ts` — every campaign level is solvable with its reference solutions, unsolved with an empty build, and protected against known shortcuts. It also checks the campaign shape (tutorial size, ten-ish missions per group) and that difficulty ramps within and across groups.
- `e2e/*.mjs` — Playwright scripts against the production build: smoke, acceptance, and a full campaign play-through.
