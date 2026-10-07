# Measuring fun

Fun can't be measured directly. What can be measured are the things players of contraption
puzzles reliably love or hate, from two sides:

1. **The levels themselves**, headlessly, before anyone plays (`npm run fun:audit`). This predicts
   where players will be bored, lost or frustrated.
2. **Real players**, from a local playtest log the game keeps (`npm run fun:playtests`). This is
   what actually happened, and it checks whether the predictions were right.

Neither number is "fun". Both point at the levels worth looking at, and say why.

## 1. The level audit

`npm run fun:audit` runs every campaign and Physics Lab level many times in the real simulation
and writes [fun-audit.md](fun-audit.md) (and `fun-audit.json`). It takes several minutes;
`FUN_ONLY=id,id` limits it to some levels and `FUN_SAMPLES` sets the samples per measurement
(default 12). Code: `src/analysis/funAudit.ts`.

| Measure | What it is | Why it matters | Flag |
|---|---|---|---|
| **Stages, domains** | Distinct chain-reaction stages in the reference solve, and how many kinds of physics they span. | Spectacle is the payoff of the genre: the more visibly happens, the better the "watch it go" moment. | – |
| **First reaction** | Seconds from RUN to the first stage. | Pressing RUN and seeing nothing feels broken. | over 3 s |
| **Longest lull** | Longest stretch in the solve with no new stage. | Waiting on a slow balloon or a timer kills the moment; players start doubting the machine. | over 6 s |
| **Player share** | Share of the solved chain that does *not* happen when RUN is pressed on an empty build. | If the room mostly runs itself, the player's part is a switch, not a contraption. | under 25% |
| **Forgiveness** | Solve rate when the reference parts are placed by a rough hand: offset by a random ±6 to ±48 px, snapped to the editor's 10 px grid and 5° turns, sometimes one turn step off. Measured for each part alone (the rest placed right) and for all parts together. | The genre's worst failure is pixel hunting: the right idea that only works at one exact spot. | the fiddliest part works under half the time beyond ±6 px |
| **Tolerance** | The widest offset at which the fiddliest part still works at least half the time, and which part that is. | Tells you exactly which part to widen the catch for. | under ±12 px |
| **Snapping** | Whether the reference still solves placed with default snapping. | If not, players have to discover fine placement (Alt) to solve it. | fails |
| **Near miss** | For rough placements that failed, the average share of the player-driven chain they still reached. | Failing "almost" is motivating and readable; failing with nothing happening is frustrating. | under 30% |
| **Trivial** | Every part still works dropped ±48 px off. | No idea needed means no puzzle (allowed in the tutorial). | – |
| **Silent on RUN** | An empty build does nothing at all when run. | Informational: Incredible-Machine-style puzzles usually show the machine trying first. | – |
| **New parts** | Part kinds a level adds to the campaign so far. | Long runs without anything new go stale; too many at once overwhelm. | – |

The **score** (0–100) weighs spectacle 25%, forgiveness 25%, pacing 20%, agency 15% and near
misses 15%. It is a triage aid for sorting levels, not a verdict; read the flags.

Thresholds sit in `LIMITS` in `funAudit.ts`. They were set so flags pick out outliers rather than
most levels, and should be re-tuned once real playtest data exists (see below).

## 2. Playtesting with real people

The game keeps a playtest log on the player's device only (localStorage, never sent anywhere).
Code: `src/telemetry/playtest.ts`, fed from `PlayController` and the hint ladder. Per mission
session it records time to first RUN, each run (seconds of building before it, how it ended,
chain stages, ABSURD/ELEGANT), edits, rewinds, hint tier, when it was solved and an optional
1–5 rating (`__follyworksPlaytest.rate(n)`; no rating prompt is on screen yet).

To run a playtest:

1. Give each tester a fresh browser profile (or have them run `__follyworksPlaytest.clear()` in
   the browser console) and let them play without help.
2. Afterwards, in the browser console: `__follyworksPlaytest.download()`. It saves
   `follyworks-playtest-<id>.json`.
3. Put the files in a `playtests/` folder at the repo root and run `npm run fun:playtests`. It
   writes [playtest-report.md](playtest-report.md), one row per level, with the audit score
   beside each.

What the player signals mean, best first:

| Signal | Reading |
|---|---|
| **Replayed** (kept running the machine after solving it) | The strongest sign of fun: playing with no goal left. ABSURD rate is the same thing, aimed. |
| **Gave up** (left unsolved, never came back to solve) | The strongest sign of frustration. Flag at 25%. |
| **Seconds per try** (building between runs) | The heartbeat of the loop. Short tries mean "one more go"; long ones mean planning paralysis or fiddly placement. Flag over 60 s. |
| **Seconds to first RUN** | Whether the briefing and the room make it obvious what to try. Flag over 90 s. |
| **Runs and minutes to solve** | Difficulty as people feel it. Should rise gently through a group, with no spikes. Flag over 8 min. |
| **Ghost hints** | How often people needed to be shown the answer. Flag at 50%. |
| **Rating** | What they say. Useful in aggregate; flag under 3/5. |

## 3. Closing the loop

Once a handful of players' logs exist, compare the two reports level by level. Levels the audit
scored low should show more quitting, longer tries and more ghost hints. Where they don't, the
audit's thresholds or weights are wrong and should be moved toward what players did. Where both
agree, fix the level: widen the catch for the fiddliest part, cut the lull, or give the empty
build something to do.
