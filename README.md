# Follyworks

*Build the unnecessary.*

Follyworks is a 2D physics contraption puzzle game for the browser. Each puzzle asks for one small, specific thing ("get the crate into the shipping bay", "wake the cat"). You drag parts from a limited parts bin into a cutaway workshop, press RUN, and watch your machine succeed, fail, or do something you did not expect. Then you rewind, nudge a ramp, and try again. Rooms are bright and sunny, and a solved machine gets confetti.

- **66 missions**: a 6-mission guided tutorial, then six groups of 10 (Workshop Basics, Levers & Lines, Moving Parts, Hot Air & Sparks, Ridiculous Machines, Lasers & Light). Every mission is a big, mostly built Rube Goldberg contraption with a few gaps for you to fill, ending in a goofy goal: sink a basket, ring the bell, knock down the pins, wake Whiskers the cat, pop the balloons, launch the toast. Each group mixes gravity, springs, ropes, gears, air, heat, magnets and electricity, and machines get longer (up to 24 pre-built parts) and need more of your parts (up to 12) as you go.
- **One difficulty, chosen once**: the first campaign mission asks "How tricky do you like it?" (Easy / Normal / Hard) and every mission uses that until you change it in Settings. Easy adds time, spare parts and one part already in place; Hard cuts the clock, trims the bin and caps parts at the simplest known solution. Beaten difficulties show on the campaign map.
- **Tiered hints**: a nudge, then the parts you'll need, then glowing outlines of where parts go, one at a time. Ghost outlines withhold ELEGANT.
- **Optional on-screen guidance** in the tutorial: a step card, an arrow at the right part or button, and a glowing outline of one good spot. Hide it from the card, the compass button, or Settings.
- **47 parts** plus three connectors (rope, drive belt, wire): balls, dominoes, planks, seesaws, trampolines, buckets, pulleys, gears, motors, conveyors, fans, balloons, candles, rockets, cannons, dynamite, magnets, batteries, switches, pressure plates, timers, logic gates, light bulbs, a boxing glove, a cactus, a small walking robot called Bolt, a goofy gang (a squawking rubber chicken, a mousetrap catapult, a toaster that fires toast, a whistling teapot, bowling pins, Whiskers the cat, a bell, and a basketball with its hoop), and a light lab of lasers, mirrors, beam splitters, prisms, colour filters, lenses and light sensors.
- **Physics Lab**: 9 short lesson missions, one real idea each (gravity, energy, buoyancy, momentum, levers, pulleys, gears, logic, electromagnets), each opening with an intro card: the idea, a picture in words, and the challenge.
- **"How it works" cards**: select a part to read the real physics behind it, and the results card lists the physics your machine actually used. Where the game simplifies, the card says so.
- **Three results per puzzle**: SOLVED, ELEGANT (few parts or a quick finish) and ABSURD (a long chain reaction). The results card explains each one.
- **Rewind and timeline scrub**, pause, frame step, half-speed and quarter-speed slow motion, and exact reset.
- **Undo/redo**, copy/paste, duplicate, flip, grid snap, pan and zoom, and modern on-part handles: swing a plank by its end, turn a part from its corners or knob, and a floating toolbar by the selection.
- **Numbered goals** in the top bar, each with a matching tag in the room on the thing it is about, a live count or hold timer, and a highlight when you point at it.
- **Sandbox** with every part and no rules, plus named save slots.
- **Level editor** with fixed and starting objects, inventory, goals, instant test-and-return, local saves, and JSON import and export.
- **Six visual themes**: Retro Toolbox, Stone Age, Steam & Brass, Modern Workshop, Comic Heroics and Far Future. By default each mission group uses the theme of its era (shown on its card in Puzzles). Settings can fix one theme everywhere, and the sandbox and editor have their own theme picker. A theme changes the room, the look of the parts and the music, and never the physics. The interface itself is a clean modern HUD by default; Settings > Interface style can dress it to match each era instead. (Old arcade fans may want to try a certain code on the title screen.)
- **Sunny rooms**: every room has daylight, a window or skylight, bunting, plants and silly doodles, all kept soft so nothing behind the machine looks like a part. Modern adds a Sunny Backyard Workshop and a Birthday Playroom (pick them in the level editor or sandbox).
- **Celebrations**: each goal pops a sparkle where it was met, and a solved machine gets confetti cannons, streamers and a happy hop from the parts that took part, in time with the solve stinger. Rewinding cancels it.
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
npm run fun:audit            # measures every level for pacing, spectacle, agency and pixel hunting (several minutes)
npm run fun:playtests        # summarizes exported player logs in playtests/ (see docs/fun/MEASURING_FUN.md)
```

The browser tests need a production build served on port 4173 (`npm run build && npm run preview`) and Playwright's Chromium:

```sh
node e2e/smoke.mjs           # the main loop with real mouse and keyboard: place, undo, run, solve, rewind, editor, sandbox
node e2e/acceptance.mjs      # move/rotate/duplicate/delete, pan/zoom, slow motion, frame step, exact reset,
                             # level rename/duplicate/import/delete, test-and-return, saves surviving reload, corrupt save
node e2e/campaign.mjs        # plays every level with its reference solution in the real browser
node e2e/transform.mjs       # knob, end swing, corner turn, R reset, selection toolbar by mouse; overlap refusal; goal tags
node e2e/playtest.mjs        # the local playtest log records a real session: runs, solve, edits
node e2e/difficulty.mjs      # first-time chooser, Settings change + restart, badges, every hint tier, per-difficulty progress and map badges
node e2e/touch.mjs           # real touch input on an emulated iPad and iPhone: drag from the bin, tap, move, knob, twist, pinch, tap-to-place, phone-upright prompt
```

Each takes an optional URL argument and exits non-zero on failure. Set `SHOTS=<dir>` to save screenshots. Set `CHROMIUM=<path>` if Chromium is not at `/opt/pw-browsers/chromium`.

## Controls

| Action | Mouse / key |
| --- | --- |
| Place a part | Drag from the parts bin, or click it then click the stage |
| Move / select | Drag a part; drag on empty space to box-select |
| Rotate | Drag the round knob above the selected part, or grab just outside any corner of it (the cursor turns into a curved arrow); `Q` / `E` (hold `Shift` for fine steps), or Alt + wheel. Drags snap to the part's step (5° if it has none); hold `Alt` for any angle. A badge by the pointer shows the angle |
| Swing an end | Drag the round grip on an end of a plank or conveyor (a wall's long ends in the level editor): the other end stays put while the part turns and stretches to follow, like the end of a line. `Shift` keeps the length, `Alt` frees the angle |
| Resize | Drag the square grips on a seesaw's ends or a wall's short edges; the far side stays put |
| Straighten | `R`, or double-click the knob |
| Selection toolbar | Floats beside the selected part: turn 15° left / right, flip, duplicate, delete |
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

### Touch (tablets and phones)

Parts stay their normal size; fingers get a longer reach instead (handles and small parts respond from about twice as far as a mouse pointer, and handles draw a size up).

| Action | Touch |
| --- | --- |
| Place a part | Drag it out of the parts bin (it rides just above your finger so you can see where it lands), or tap it in the bin and then tap the stage |
| Select / move | Tap a part / drag it; tap empty floor to deselect |
| Rotate | Drag the knob, or put a second finger down while holding the part and twist |
| Swing / resize, straighten | Drag the end grips; double-tap the knob |
| Turn 15°, flip, duplicate, delete | The toolbar that floats beside the selected part |
| Zoom / pan | Pinch / two-finger drag anywhere off the part you hold |

On a phone held sideways the controls move into the side gutters so the room uses the full height: a strip of parts on the left, and leave, hint, a "more" menu and a round Run button on the right. Part settings open from the wrench on the selection toolbar. Held upright, it asks to be turned sideways. On tablets the parts bin is one slim column.

## Debug URL parameters

- `?renderer=canvas` forces the Canvas renderer.
- `?maxtex=N` overrides how many textures Phaser batches together (default 1; see DECISIONS.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): how the code is organised and how a run works.
- [DECISIONS.md](DECISIONS.md): material design and engineering decisions, with reasons.
- [FINAL_REPORT.md](FINAL_REPORT.md): scope, testing, known defects, compromises, risks and next steps.
- [docs/ART_SPEC.md](docs/ART_SPEC.md): the art direction the procedural painters follow.
- [docs/fun/FINDINGS.md](docs/fun/FINDINGS.md): the first playability findings.
- [docs/fun/MEASURING_FUN.md](docs/fun/MEASURING_FUN.md): how fun is measured, from the levels (the fun audit) and from players (the playtest log); [fun-audit.md](docs/fun/fun-audit.md) is the latest audit.

## License

MIT. Copyright (c) 2026 Provisio Insights. See [LICENSE](LICENSE).
