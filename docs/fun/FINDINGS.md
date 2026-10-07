# How playable is Follyworks? (2026-10-07)

First fun audit of all 66 missions and 9 Physics Lab lessons, from main at d597d2a. Full table:
[fun-audit.md](fun-audit.md). No human playtests yet, so everything here is predicted, not observed.

## What is in good shape

- **Spectacle is strong.** The median solve sets off 14 chain stages across 4 kinds of physics, and
  Ridiculous Machines averages 90/100, the best group. The Rube Goldberg rebuild did what it was meant to.
- **The machine answers quickly.** Only 4 levels take over 3 s to show a first reaction after RUN.
- **The player matters.** In every campaign mission at least half of the chain only happens
  because of what the player placed; in most it is nearly all of it.

## What will hurt

1. **Planks are fiddly (biggest issue).** 29 levels have a part that stops working when placed one
   grid cell off, and in 19 of them it is a plank. Planks are long, so a small offset or one 5° step
   changes where a ball lands. Lasers & Light has the same problem with mirrors (6 of 10 missions).
   Three levels (2-6 Pull the Cord, 2-9 Toast of the Town, 6-6 Make A Wish) can't be solved with default snapping at all near the
   intended spot; players would have to find Alt-drag.
2. **Dead air in Moving Parts.** 9 levels have a stretch of 6 s or more where nothing new happens,
   6 of them in Moving Parts, mostly Bolt walking or a conveyor carrying something. Worst:
   3-5 Zig and Zag (15 s), 3-7 Double Shift (11 s), 4-9 Special Delivery (10 s), 3-2 Strike, Bolt! (9 s).
3. **All-or-nothing failures.** In 22 levels a slightly wrong build reaches less than 30% of the
   player's part of the chain, so a near miss looks like "nothing happened" instead of "almost".
   This is where the failure explainer from FINAL_REPORT.md would pay off most.
4. **Physics Lab is the weakest set** (66 average). L2 Height into Speed has no chain events at all
   and 7 s of rolling before anything happens; L4 and L6 work wherever the parts are dropped.

Informational: 32 levels do nothing when RUN is pressed on an empty build. Classic contraption games
let the machine try first; whether that matters here is a question for playtests.

## Suggested fixes, in order

1. Widen the catches around plank landings (wider buckets and shelves, backstops) on the flagged
   levels, starting with the lowest scores, and rerun the audit until no plank is under ±12 px.
2. Shorten Bolt's walks and conveyor runs in the dead-air levels, or put something that happens on
   the way (a bell, a squawk) so the wait has a beat in it.
3. Snap the three "needs fine control" levels so a grid spot works.
4. Playtest the tutorial and first two groups with 3 to 5 people using the playtest log, then
   compare against this audit and re-tune its thresholds.
