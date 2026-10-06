# Follyworks

*Build the unnecessary.*

Follyworks is a 2D physics contraption puzzle game for the browser. Each puzzle asks for one small, specific thing ("get the crate into the shipping bay", "wake the cat"). You drag parts from a limited parts bin into a cutaway workshop, press RUN, and watch your machine succeed, fail, or do something you did not expect. Then you rewind, nudge a ramp, and try again.

- **25 puzzles**: 5 tutorial levels plus 20 campaign levels across 10 chapters, from basic gravity through ropes, gears, air, heat, electricity, sensors and logic, to multi-domain "ridiculous machines".
- **31 parts** plus three connectors (rope, drive belt, wire): balls, dominoes, planks, seesaws, trampolines, buckets, pulleys, gears, motors, conveyors, fans, balloons, candles, rockets, cannons, dynamite, magnets, batteries, switches, pressure plates, timers, logic gates, light bulbs, a boxing glove, a cactus and a small walking robot called Bolt.
- **Three results per puzzle**: SOLVED, ELEGANT (few parts or a quick finish) and ABSURD (a long chain reaction). The results card explains each one.
- **Rewind and timeline scrub**, pause, frame step, half-speed and quarter-speed slow motion, and exact reset.
- **Undo/redo**, copy/paste, duplicate, rotate, flip, grid snap, pan and zoom.
- **Sandbox** with every part and no rules, plus named save slots.
- **Level editor** with fixed and starting objects, inventory, goals, instant test-and-return, local saves, and JSON import and export.
- All art, music and sound are generated procedurally at runtime. There are no asset files.

## Requirements

- Node.js 20 or newer (developed on Node 22) and npm.
- A desktop browser with WebGL (Chrome, Edge, Firefox or Safari). Phaser falls back to Canvas when WebGL is unavailable.

## Run it (development)

```sh
npm install
npm run dev
```

Then open the URL Vite prints (normally http://localhost:5173/).

## Production build

```sh
npm install
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serves dist/ at http://localhost:4173/
```

`dist/` is a self-contained static site. Any static web host can serve it.

## Tests

```sh
npm test                     # unit, simulation and level tests (Vitest, headless)
npm run typecheck            # TypeScript only
```

The browser tests need a production build served on port 4173 (`npm run build && npm run preview`) and Playwright's Chromium:

```sh
node e2e/smoke.mjs           # the main loop with real mouse and keyboard: place, undo, run, solve, rewind, editor, sandbox
node e2e/acceptance.mjs      # move/rotate/duplicate/delete, pan/zoom, slow motion, frame step, exact reset,
                             # level rename/duplicate/import/delete, test-and-return, saves surviving reload, corrupt save
node e2e/campaign.mjs        # plays every level with its reference solution in the real browser
```

Each takes an optional URL argument and exits non-zero on failure. Set `SHOTS=<dir>` to save screenshots. Set `CHROMIUM=<path>` if Chromium is not at `/opt/pw-browsers/chromium`.

## Controls

| Action | Mouse / key |
| --- | --- |
| Place a part | Drag from the parts bin, or click it then click the stage |
| Move / select | Drag a part; drag on empty space to box-select |
| Rotate | `Q` / `E` (hold `Shift` for fine steps), or Alt + wheel |
| Flip | `F` |
| Duplicate, copy, paste | `Ctrl+D`, `Ctrl+C`, `Ctrl+V` |
| Delete | `Del` or `Backspace` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`) |
| Nudge | Arrow keys (`Shift` for 10 px) |
| Pan / zoom | Middle- or right-drag / mouse wheel; `0` resets the view |
| Grid snap | `G` |
| Run / reset | `Space` |
| Pause, frame step | `P`, `.` |
| Speed | `1` normal, `2` slow, `3` super slow (while running) |
| Rewind | Hold `←` or the rewind button, or drag the timeline |
| Hint | `H` |
| Mute | `M` |

Ropes, belts and wires are tools in the parts bin: pick one, then click the two things to join. Glowing sockets show where a connection can go.

## Debug URL parameters

- `?renderer=canvas` forces the Canvas renderer.
- `?maxtex=N` overrides how many textures Phaser batches together (default 1; see DECISIONS.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): how the code is organised and how a run works.
- [DECISIONS.md](DECISIONS.md): material design and engineering decisions, with reasons.
- [FINAL_REPORT.md](FINAL_REPORT.md): scope, testing, known defects, compromises, risks and next steps.
- [docs/ART_SPEC.md](docs/ART_SPEC.md): the art direction the procedural painters follow.

## License

Copyright (c) 2026 Provisio Insights. All rights reserved. The source is public to read, but no license is granted to reuse it. See [LICENSE](LICENSE).
