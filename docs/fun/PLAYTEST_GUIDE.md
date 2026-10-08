# Running a playtest

One page for running a 20–30 minute session with a friend, 3 to 5 times. The point is to see where
the game is fun and where it isn't, so the most useful thing you can do is stay quiet and watch.

## Before they start

- **Link:** <https://follyworks.provisioinsights.workers.dev/?playtest>
  Open it on their device, or on yours in a **private / incognito window** so they start with no
  saved progress. A small red-dot **Playtest** tag at the bottom means it's recording.
- Phones are fine: hold it sideways. A tablet or laptop is easier to watch over a shoulder.
- Sound on, if they don't mind.
- Have something to write on.

## What to say

> "This is a puzzle game I'm making. I want to see how it plays for someone who's never seen it,
> so I'm going to stay quiet and just watch. There are no wrong moves; if something's confusing,
> that's the game's fault, not yours. Try to think out loud: say what you're trying and what you
> expect to happen. After each puzzle it'll ask you how fun it was. Be honest, mean is useful."

## What to ask them to play

1. **The tutorial** (T1–T6, about 8 minutes). Let it guide them.
2. **Workshop Basics** from 1-1, as far as they get in about 10 minutes.
3. **Levers & Lines 2-1 Counter Culture and 2-2 Lever Your Expectations** (about 10 minutes).
   If they haven't unlocked them, open Settings and tick *Unlock all puzzles*.
4. If time's left: whatever they want to play next. What they choose is data too.

Stop at 30 minutes even if they're mid-puzzle, unless they ask to keep going (write that down: it's
the best sign there is).

## Don't help

- Don't explain controls, parts or the goal. If they're stuck, say *"What do you think it wants?"*
  or *"What would you try?"*
- Only step in if they've been stuck and unhappy for about **3 minutes**, and then only say
  *"there's a hint button"* (the light bulb). Note that you did.
- Don't apologise for bugs or explain what you meant. Just note it.
- Don't react when they solve something. Let the game do the celebrating.

## Watch for

Write the puzzle code (like 1-3) and the time next to each note.

- [ ] **Hesitation:** where they stop and stare. Before the first RUN? Picking a part? Placing it?
- [ ] **Misreads:** what they thought a part or goal did that it doesn't.
- [ ] **Laughs, "oh!", leaning in:** what caused it. These are the moments to keep.
- [ ] **Hints:** when they reached for the light bulb, and whether the hint helped.
- [ ] **Fiddling:** nudging the same part again and again by tiny amounts.
- [ ] **Sighs, "ugh", phone down, looking away:** what just happened.
- [ ] **Quitting:** which puzzle they left unsolved, and what they said as they left.
- [ ] **Keeps playing after solving:** running it again, adding silly parts. The best sign of fun.
- [ ] **Touch trouble** (phones and tablets): missed taps, parts under the finger, gestures that
      didn't do what they expected.

At the end, ask three things and write the answers down word for word:
1. *"What was the most fun bit?"*
2. *"What was the most annoying bit?"*
3. *"Would you play more of this? Honestly."*

## Sending the results

When you're done, they tap the **Playtest** tag (or Settings, *Finish playtest*), type a first name
or nickname and press **Send to John**. That's it. If it can't reach the server it saves a file
called `follyworks-playtest-<name>-….json` to their Downloads instead and tells them to send it to
you; drop any such file into the `playtests/` folder of the repo.

Next tester on the same device: open the `?playtest` link again (in a new private window).

## Reading the results

```
npm run playtests:pull     # fetches everything sent from the live site into playtests/
npm run fun:playtests      # writes docs/fun/playtest-report.md
```

`playtests:pull` needs `npx wrangler login` once. The `playtests/` folder is kept out of the repo, since it
holds people's names and comments.

The report has one row per puzzle and a *What players said* section with every rating and comment.
Look first at:

- **Gave up** (left unsolved): the strongest sign of frustration. Compare with your quit notes.
- **Replayed** and **ABSURD**: kept playing after solving. The strongest sign of fun.
- **s to first run** and **s per try**: long numbers mean they didn't know what to try, or
  placing parts was fiddly. Your hesitation notes say which.
- **Rating** and the comments, read beside your own notes.

Then compare with [fun-audit.md](fun-audit.md): where players struggled on a puzzle the audit liked
(or breezed through one it flagged), the audit is wrong and should be re-tuned. More on every
signal: [MEASURING_FUN.md](MEASURING_FUN.md).
