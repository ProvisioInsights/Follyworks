// Difficulty and tiered hints, driven by real clicks against a production build.
//   npm run build && npx vite preview --port 4173 &   then   node e2e/difficulty.mjs [url]
// Walks: settings (unlock all) -> campaign map -> a mission briefing (Normal by default) -> pick
// Easy (briefing, HUD badge, bin, pre-placed part) -> step through every hint tier (nudges, parts
// list, ghosts) -> drag a part onto its ghost (the ghost goes) -> solve -> "Solved with hints" and
// no ELEGANT -> Easy badge on the map -> reload (choice and badge persist) -> Hard (lean bin, part
// cap, shorter clock) -> solve without hints -> Hard badge. Exits non-zero on any failed check.
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
const tile = () => page.locator(`.level-tile[aria-label^="${LEVEL} "]`);
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

await page.goto(url);
await ready();
await page.evaluate(() => localStorage.clear());
await page.reload();
await ready();

// ---- unlock all puzzles through Settings
await page.getByRole('button', { name: /Settings/ }).click();
await wait(300);
await page.locator('.settings-grid span', { hasText: 'Unlock all puzzles' }).locator('xpath=following-sibling::label[1]').locator('input').check();
await page.getByRole('button', { name: 'Done' }).click();
await wait(200);

// ---- campaign map -> briefing (Normal by default)
await page.getByRole('button', { name: /Puzzles/ }).click();
await wait(500);
check((await tile().locator('.diff-dot').count()) === 3, 'map tile shows three difficulty badges');
check((await tile().locator('.diff-dot.on').count()) === 0, 'no difficulty is beaten yet');
await tile().click();
await wait(800);
check(await page.locator('.diff-btn.normal.on').isVisible(), 'briefing offers three difficulties with Normal selected by default');
const normalTime = await app(() => window.__follyworks.play.ctl.session.level.restrictions.timeLimit);
const normalStarts = await app(() => window.__follyworks.play.ctl.session.level.startingObjects.length);
await shot('diff-brief-normal');

// ---- pick Easy
await page.locator('.diff-btn.easy').click();
await wait(900);
check(await page.locator('.diff-btn.easy.on').isVisible(), 'clicking Easy reopens the briefing with Easy selected');
check((await app(() => window.__follyworks.settings.difficulty)) === 'easy', 'the choice is remembered in settings');
const easy = await app(() => {
  const l = window.__follyworks.play.ctl.session.level;
  return { time: l.restrictions.timeLimit, starts: l.startingObjects.length };
});
check(easy.time > normalTime, `Easy has more time (${easy.time}s vs ${normalTime}s)`);
check(easy.starts === normalStarts + 1, 'Easy pre-places one part');
check(await page.locator('.brief-meta', { hasText: `${easy.time}s time limit` }).isVisible(), 'briefing shows the Easy time limit');
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

// ---- solve with hints: stars kept, ELEGANT withheld, "Solved with hints"
check(await solveAndWait(), 'the Easy mission solves');
check(await page.locator('.hint-note', { hasText: 'Solved with hints' }).isVisible(), 'results card says "Solved with hints"');
check(await page.locator('.stamp.s.on').isVisible(), 'SOLVED stamp is kept');
check(!(await page.locator('.stamp.e.on').isVisible()), 'ELEGANT is withheld after a ghost hint');
check(/ghost/i.test(await page.locator('.stamp.e').innerText()), 'ELEGANT stamp explains why');
await shot('diff-results-easy');
const prog = await app(() => JSON.parse(JSON.stringify(window.__follyworks.store.data.progress['g2-pull-the-other-one'])));
check(prog?.byDifficulty?.easy?.solved && !prog.byDifficulty.easy.noHints && !prog.byDifficulty.normal.solved, 'progress is recorded for Easy only, with hints');

// ---- map badge, then reload: choice and badge persist
await page.keyboard.press('Escape');
await wait(200);
await page.locator('.topbar .btn', { hasText: 'Puzzles' }).click();
await wait(500);
check(await tile().locator('.diff-dot.easy.on').isVisible(), 'map shows Easy beaten');
check(!(await tile().locator('.diff-dot.hard.on').isVisible()), 'map does not show Hard beaten');
await shot('diff-map-easy');
await page.reload();
await ready();
await page.getByRole('button', { name: /Puzzles/ }).click();
await wait(500);
check(await tile().locator('.diff-dot.easy.on').isVisible(), 'Easy badge survives a reload');
await tile().click();
await wait(800);
check(await page.locator('.diff-btn.easy.on').isVisible(), 'the last difficulty choice survives a reload');

// ---- Hard
await page.locator('.diff-btn.hard').click();
await wait(1000);
const hard = await app(() => {
  const l = window.__follyworks.play.ctl.session.level;
  return { time: l.restrictions.timeLimit, cap: l.restrictions.maxParts, starts: l.startingObjects.length };
});
check(hard.time < normalTime, `Hard has less time (${hard.time}s vs ${normalTime}s)`);
check(hard.starts === normalStarts, 'Hard pre-places nothing');
check(await page.locator('.brief-meta', { hasText: `at most ${hard.cap} parts` }).isVisible(), 'Hard briefing shows the part cap');
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
await page.keyboard.press('Escape');
await wait(200);
await page.locator('.topbar .btn', { hasText: 'Puzzles' }).click();
await wait(500);
check(await tile().locator('.diff-dot.hard.on').isVisible() && (await tile().locator('.diff-dot.easy.on').isVisible()), 'map shows Easy and Hard beaten');
check(!(await tile().locator('.diff-dot.normal.on').isVisible()), 'Normal not beaten yet');
await shot('diff-map-both');

check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all difficulty checks passed');
process.exit(failures ? 1 : 0);
