// One global difficulty and tiered hints, driven by real clicks against a production build.
//   npm run build && npx vite preview --port 4173 &   then   node e2e/difficulty.mjs [url]
// Walks: fresh save -> settings (unlock all; the Difficulty control is there, but looking is not
// choosing) -> campaign map -> the first mission shows the one-time "How tricky do you like it?"
// chooser (Normal recommended) -> pick Normal -> the briefing has a read-only badge and no picker
// -> "change" opens Settings at Difficulty -> pick Easy: the open mission stays Normal until it is
// entered again -> re-enter: Easy (briefing, HUD badge, bin, pre-placed part), no chooser -> every
// hint tier -> drag a part onto its ghost -> solve -> "Solved with hints", one star -> Easy badge
// on the map -> reload (choice and badge persist, no chooser) -> HUD badge -> Settings -> Hard ->
// "Restart it on Hard" -> lean bin, part cap, shorter clock -> solve without hints -> Hard badge
// -> another mission opens on Hard too. Exits non-zero on any failed check.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const shots = process.env.SHOTS ?? '';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
}).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};
const shot = async (name) => shots && (await page.screenshot({ path: `${shots}/${name}.png` }));
const wait = (ms) => page.waitForTimeout(ms);
const app = (fn, arg) => page.evaluate(fn, arg);
const ready = async () => {
  await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
  await wait(800);
};
const LEVEL = '2-4'; // Pull the Other One: bucket + rope + bowling ball, three authored hints
const tile = (code = LEVEL) => page.locator(`.level-tile[aria-label^="${code} "]`);
const solveAndWait = async () => {
  await app(() => window.__follyworks.debugLoadSolution(0));
  await wait(300);
  await page.locator('.run-btn').click();
  for (let i = 0; i < 60; i++) {
    await wait(500);
    if (await page.locator('.stamps').isVisible().catch(() => false)) return true;
  }
  return false;
};
const level = () =>
  app(() => {
    const l = window.__follyworks.play.ctl.session.level;
    return { time: l.restrictions.timeLimit, cap: l.restrictions.maxParts, starts: l.startingObjects.length };
  });
const settings = () => app(() => ({ ...window.__follyworks.settings }));
const chooserShown = () => page.locator('.diff-choose').isVisible().catch(() => false);
const toPuzzles = async () => {
  await page.keyboard.press('Escape');
  await wait(200);
  await page.locator('.topbar .btn', { hasText: 'Puzzles' }).click();
  await wait(500);
};

await page.goto(url);
await ready();
await page.evaluate(() => localStorage.clear());
await page.reload();
await ready();

// ---- Settings, then unlock all puzzles; the Difficulty control is there, but looking is not choosing
await page.getByRole('button', { name: /Settings/ }).click();
await wait(300);
check(await page.locator('.settings-diff .diff-btn.normal.on').isVisible(), 'Settings has a Difficulty control, Normal by default');
check((await page.locator('.settings-diff .diff-btn small').count()) === 3, 'each difficulty has a one-line blurb');
await page.getByRole('button', { name: 'Done' }).click();
// unlocking every puzzle is the SKELETONKEY cheat code now (typed on the title screen)
await page.keyboard.type('skeletonkey');
await wait(200);
check((await settings()).difficultyChosen === false, 'opening Settings does not count as choosing a difficulty');

// ---- campaign map -> first mission: the one-time chooser
await page.getByRole('button', { name: /Puzzles/ }).click();
await wait(500);
check((await tile().locator('.diff-dot').count()) === 3, 'map tile shows three difficulty badges');
check((await tile().locator('.diff-dot.on').count()) === 0, 'no difficulty is beaten yet');
await tile().click();
await wait(900);
check(await chooserShown(), 'the first mission asks "How tricky do you like it?"');
check((await page.locator('.diff-choose .diff-card').count()) === 3, 'three big cards: Easy, Normal, Hard');
check(await page.locator('.diff-choose .diff-card.normal.recommended').isVisible(), 'Normal is highlighted as recommended');
check(!(await app(() => !!window.__follyworks.play)), 'no mission is open behind the chooser');
await shot('diff-chooser');
await page.locator('.diff-choose .diff-card.normal').click();
await wait(900);
check(!(await chooserShown()), 'picking closes the chooser and opens the mission');
const s1 = await settings();
check(s1.difficulty === 'normal' && s1.difficultyChosen, 'the choice is saved in settings');
const normal = await level();

// ---- briefing: read-only badge, no picker
check((await page.locator('.diff-btn').count()) === 0, 'the briefing has no difficulty picker');
check(await page.locator('.brief-diff .diff-badge.normal').isVisible(), 'the briefing shows a Normal badge');
await shot('diff-brief-normal');

// ---- "change" opens Settings at Difficulty; a change applies when the mission is next entered
await page.locator('.brief-diff .linkish', { hasText: 'change' }).click();
await wait(400);
check(await page.locator('.settings-diff.flash').isVisible(), '"change" opens Settings at the Difficulty control');
await page.locator('.settings-diff .diff-btn.easy').click();
await wait(200);
check((await settings()).difficulty === 'easy', 'picking Easy in Settings changes the global difficulty');
check(await page.locator('.settings-diff .sd-note', { hasText: 'still on Normal' }).isVisible(), 'Settings says the open puzzle stays on Normal until restarted');
await shot('diff-settings-change');
await page.keyboard.press('Escape');
await wait(300);
check(await page.locator('.brief-diff').isVisible(), 'Esc closes Settings only; the briefing is still there');
check((await level()).time === normal.time, 'the open mission is unchanged');
await page.getByRole('button', { name: /Let’s build/ }).click();
await wait(300);
check(await page.locator('.topbar .diff-badge.normal').isVisible(), 'HUD still shows Normal for this visit');

// ---- re-enter: Easy, and no chooser again
await toPuzzles();
await tile().click();
await wait(900);
check(!(await chooserShown()), 'the chooser never shows again');
const easy = await level();
check(easy.time > normal.time, `Easy has more time (${easy.time}s vs ${normal.time}s)`);
check(easy.starts === normal.starts + 1, 'Easy pre-places one part');
check(await page.locator('.brief-meta', { hasText: `${easy.time}s time limit` }).isVisible(), 'briefing shows the Easy time limit');
check(await page.locator('.brief-diff .diff-badge.easy').isVisible(), 'briefing shows the Easy badge');
await shot('diff-brief-easy');
await page.getByRole('button', { name: /Let’s build/ }).click();
await wait(400);
check((await page.locator('.topbar .diff-badge.easy').innerText()).toUpperCase() === 'EASY', 'HUD shows the Easy badge');
check((await page.locator('.bin-list [data-type="bucket"] .count').innerText()) === '2', 'Easy bin has a spare bucket');

// ---- step through every hint tier
const hintBtn = page.locator('.topbar [data-tip^="Hint"]');
const kinds = [];
for (let i = 0; i < 8; i++) {
  await hintBtn.click();
  await wait(250);
  kinds.push(await page.locator('.tipbar').getAttribute('data-kind'));
  if (i === 0) await shot('diff-hint-nudge');
  if (kinds[i] === 'parts' && kinds.indexOf('parts') === i) {
    check((await page.locator('.tipbar .hint-part').count()) >= 1, 'tier 2 lists the parts with icons');
    check((await page.locator('.tipbar .hint-part canvas').count()) >= 1, 'parts list has part icons');
    await shot('diff-hint-parts');
  }
  if (kinds[i] === 'ghost' && kinds.indexOf('ghost') === i) {
    check((await app(() => window.__follyworks.play.ctl.hintGhosts.length)) === 1, 'tier 3 shows one ghost outline in the room');
    await shot('diff-hint-ghost');
  }
}
console.log('      hint kinds:', kinds.join(' > '));
check(kinds[0] === 'nudge' && kinds.includes('parts') && kinds.indexOf('ghost') > kinds.indexOf('parts'), 'hints climb nudge > parts > ghost');
check(kinds[kinds.length - 1] === 'done', 'the ladder ends once every part is outlined');
const preplaced = await app(() => window.__follyworks.play.ctl.session.level.startingObjects.slice(-1)[0].id);
const ghostIds = await app(() => window.__follyworks.play.ctl.hintGhosts.map((e) => e.id));
check(!ghostIds.includes(preplaced), 'the pre-placed part is never ghosted');
await shot('diff-hint-all');

// ---- drag the bucket from the bin onto its ghost: that ghost goes away
const g = await app(() => {
  const e = window.__follyworks.play.ctl.hintGhosts.find((x) => x.type === 'bucket');
  return e ? { x: e.x, y: e.y } : null;
});
check(!!g, 'the bucket has a ghost');
if (g) {
  const before = await app(() => window.__follyworks.play.ctl.hintGhosts.length);
  const target = await app(([x, y]) => window.__follyworks.scene.worldToScreen(x, y), [g.x, g.y]);
  const ib = await page.locator('.bin-list [data-type="bucket"]').boundingBox();
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.keyboard.down('Alt');
  await page.mouse.move(target.x, target.y, { steps: 14 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  let after = before;
  for (let i = 0; i < 15 && after !== before - 1; i++) {
    await wait(200);
    after = await app(() => window.__follyworks.play.ctl.hintGhosts.length);
  }
  if (after !== before - 1) console.log('      ghost', JSON.stringify(g), 'placed', JSON.stringify(await app(() => window.__follyworks.play.ctl.session.build.objects.map((o) => [o.type, o.x, o.y, o.angle]))));
  check(after === before - 1, `placing a part on its ghost removes that ghost (${before} -> ${after})`);
  await shot('diff-ghost-placed');
}

// ---- solve with hints: SOLVED kept, ELEGANT withheld, "Solved with hints", one star
check(await solveAndWait(), 'the Easy mission solves');
check(await page.locator('.hint-note', { hasText: 'Solved with hints' }).isVisible(), 'results card says "Solved with hints"');
check(await page.locator('.stamp.s.on').isVisible(), 'SOLVED stamp is kept');
check(!(await page.locator('.stamp.e.on').isVisible()), 'ELEGANT is withheld after a ghost hint');
check(/ghost/i.test(await page.locator('.stamp.e').innerText()), 'ELEGANT stamp explains why');
check((await page.locator('.result-hero .stars .star.on').count()) === 1, 'one star (solved; ELEGANT withheld)');
check(await page.locator('.result-hero .diff-badge.easy').isVisible(), 'results card shows the Easy badge');
check(/next puzzle/i.test(await page.locator('.modal.results .modal-foot .btn').first().innerText()), 'Next puzzle is the first button on the results card');
await shot('diff-results-easy');
const prog = await app(() => JSON.parse(JSON.stringify(window.__follyworks.store.data.progress['g2-pull-the-other-one'])));
check(prog?.byDifficulty?.easy?.solved && !prog.byDifficulty.easy.noHints && !prog.byDifficulty.normal.solved, 'progress is recorded for Easy only, with hints');

// ---- map badge, then reload: choice and badge persist, still no chooser
await toPuzzles();
check(await tile().locator('.diff-dot.easy.on').isVisible(), 'map shows Easy beaten');
check(!(await tile().locator('.diff-dot.hard.on').isVisible()), 'map does not show Hard beaten');
await shot('diff-map-easy');
await page.reload();
await ready();
await page.getByRole('button', { name: /Puzzles/ }).click();
await wait(500);
check(await tile().locator('.diff-dot.easy.on').isVisible(), 'Easy badge survives a reload');
await tile().click();
await wait(900);
check(!(await chooserShown()), 'no chooser after a reload');
check(await page.locator('.brief-diff .diff-badge.easy').isVisible(), 'the difficulty survives a reload');

// ---- HUD badge -> Settings -> Hard -> restart the open mission on Hard
await page.getByRole('button', { name: /Let’s build/ }).click();
await wait(300);
await page.locator('.topbar .diff-badge').click();
await wait(400);
check(await page.locator('.settings-diff.flash').isVisible(), 'the HUD badge opens Settings at Difficulty');
await page.locator('.settings-diff .diff-btn.hard').click();
await wait(200);
await page.locator('.settings-diff .sd-restart', { hasText: 'Restart it on Hard' }).click();
await wait(1000);
const hard = await level();
check(hard.time < normal.time, `Hard has less time (${hard.time}s vs ${normal.time}s)`);
check(hard.starts === normal.starts, 'Hard pre-places nothing');
check(await page.locator('.brief-meta', { hasText: `at most ${hard.cap} parts` }).isVisible(), 'Hard briefing shows the part cap');
check(await page.locator('.brief-diff .diff-badge.hard').isVisible(), 'briefing shows the Hard badge');
await shot('diff-brief-hard');
await page.getByRole('button', { name: /Let’s build/ }).click();
await wait(400);
check(await page.locator('.topbar .diff-badge.hard').isVisible(), 'HUD shows the Hard badge');
check((await page.locator('.bin-foot').innerText()).includes(`/ ${hard.cap}`), 'bin footer shows the Hard part cap');
check((await page.locator('.bin-list [data-type="bucket"] .count').innerText()) === '1', 'Hard bin is trimmed');
await shot('diff-hud-hard');
check(await solveAndWait(), 'the Hard mission solves with the reference machine inside the shorter clock');
check(!(await page.locator('.hint-note').isVisible().catch(() => false)), 'no hints used: no "Solved with hints" note');
await shot('diff-results-hard');
await toPuzzles();
check(await tile().locator('.diff-dot.hard.on').isVisible() && (await tile().locator('.diff-dot.easy.on').isVisible()), 'map shows Easy and Hard beaten');
check(!(await tile().locator('.diff-dot.normal.on').isVisible()), 'Normal not beaten yet');
await shot('diff-map-both');

// ---- the setting is global: another mission opens on Hard too, with no question asked
await tile('2-5').click();
await wait(900);
check(!(await chooserShown()) && (await page.locator('.brief-diff .diff-badge.hard').isVisible()), 'another mission opens on Hard with no question asked');

check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all difficulty checks passed');
process.exit(failures ? 1 : 0);
