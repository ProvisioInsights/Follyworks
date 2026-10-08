// Playtest mode end to end in a real browser: ?playtest turns it on (and is remembered), a solved
// mission asks for a face rating inside the results card, a mission left unsolved asks with a small
// card, and "Finish playtest" sends the log (POST mocked to 204 on desktop) or, with no API (the
// preview server answers 404), saves it as a file. The phone pass uses real touch on an emulated
// iPhone held sideways.
//
// Usage: npx vite build && npx vite preview --port 4173, then node e2e/playtestKit.mjs [url]
// Env: SHOTS (screenshot folder, default /tmp/claude-0/shots)
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = process.env.SHOTS ?? '/tmp/claude-0/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader'] });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};

async function open(ctxOpts) {
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?playtest`);
  await page.waitForFunction(() => !!window.__follyworks?.scene && !!window.__follyworksPlaytest, null, { timeout: 90000 });
  await page.evaluate(() => window.__follyworks.updateSettings({ difficultyChosen: true, unlockAll: true }));
  return { ctx, page, errors };
}

const fw = (page, fn, arg) => page.evaluate(fn, arg);
const lastSession = (page) => fw(page, () => window.__follyworksPlaytest.log.sessions.at(-1));

/** Open a mission, close its briefing, load the reference build and run it until solved. */
async function solve(page, index) {
  await fw(page, (i) => window.__follyworks.playCampaign(i), index);
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await fw(page, () => window.__follyworks.debugLoadSolution(0));
  await fw(page, () => window.__follyworks.play.ctl.startRun());
  await page.waitForSelector('.modal.results', { timeout: 60000 });
  await page.waitForTimeout(400);
}

/** Open a mission and do one empty run that does not solve it. */
async function tryAndFail(page, index) {
  await fw(page, (i) => window.__follyworks.playCampaign(i), index);
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await fw(page, () => window.__follyworks.play.ctl.startRun());
  await page.waitForFunction(() => window.__follyworksPlaytest.current?.runs[0]?.end !== 'reset', null, { timeout: 60000 });
  await fw(page, () => window.__follyworks.play.ctl.reset());
}

// ------------------------------------------------------------------ desktop

{
  console.log('\n== desktop');
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  check(await page.locator('.pt-tag').isVisible(), 'the Playtest tag shows');
  check(!page.url().includes('playtest'), 'the ?playtest switch is dropped from the address bar');

  await solve(page, 1);
  const inline = page.locator('.modal.results .pt-inline');
  check(await inline.isVisible(), 'a solved mission asks for a rating inside the results card');
  await inline.locator('.pt-face').nth(3).click();
  await inline.locator('.pt-comment').fill('loved the bounce');
  await page.screenshot({ path: `${out}/playtest-results-desktop.png` });
  await inline.locator('.pt-comment').press('Enter');
  let s = await lastSession(page);
  check(s.rating === 4 && s.comment === 'loved the bounce', `rating and comment saved (${s.rating}, ${s.comment})`);

  // leave a mission unsolved: a small card asks on the next screen
  await page.keyboard.press('Escape');
  await tryAndFail(page, 2);
  await fw(page, () => window.__follyworks.showCampaign());
  await page.waitForTimeout(300);
  const card = page.locator('.pt-card');
  check(await card.isVisible(), 'leaving a mission unsolved shows the rating card');
  await card.locator('.pt-q b').click(); // touched: keeps it past its 30 s untouched timeout on a slow machine
  await page.screenshot({ path: `${out}/playtest-card-desktop.png` });
  await card.locator('.pt-face').nth(1).click();
  await card.locator('.pt-comment').fill('no idea what to do');
  await card.locator('button', { hasText: 'Done' }).click();
  await page.waitForTimeout(1200);
  check(!(await card.isVisible()), 'the card goes away after Done');
  s = await lastSession(page);
  check(s.rating === 2 && s.comment === 'no idea what to do' && s.solvedAt === null, 'unsolved session rated');

  // the same mission is not asked about twice, and a skipped card stays skipped
  await tryAndFail(page, 3);
  await fw(page, () => window.__follyworks.showMenu());
  await page.waitForTimeout(300);
  await page.locator('.pt-card .pt-x').click();
  check(!(await page.locator('.pt-card').isVisible()), 'the card can be skipped');

  // remembered across a reload without ?playtest
  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks?.scene, null, { timeout: 30000 });
  check(await page.locator('.pt-tag').isVisible(), 'playtest mode is remembered after a reload');
  const sessions = await fw(page, () => window.__follyworksPlaytest.log.sessions.length);
  check(sessions >= 3, `the log survived the reload (${sessions} sessions)`);

  // finish from Settings: POST mocked to 204
  let posted = null;
  await page.route('**/api/playtest', async (route) => {
    posted = { method: route.request().method(), body: JSON.parse(route.request().postData() ?? '{}') };
    await route.fulfill({ status: 204 });
  });
  await fw(page, () => window.__follyworks.openSettings());
  await page.locator('.pt-settings button').click();
  await page.locator('.pt-name').fill('Sam');
  await page.screenshot({ path: `${out}/playtest-finish-desktop.png` });
  await page.locator('.modal .btn', { hasText: 'Send to John' }).click();
  await page.waitForFunction(() => !document.querySelector('.pt-tag'), null, { timeout: 5000 }).catch(() => {});
  check(posted?.method === 'POST' && posted.body.note === 'Sam' && posted.body.log?.v === 1 && posted.body.log.name === 'Sam', 'Finish POSTs { log, note }');
  check(posted?.body.log.sessions.some((x) => x.comment === 'loved the bounce'), 'the sent log carries the comments');
  check(!(await page.locator('.pt-tag').isVisible()), 'the tag is gone after finishing');
  check(await page.locator('.toast', { hasText: 'Sent to John' }).isVisible(), 'the player is thanked');
  const after = await fw(page, () => ({ on: localStorage.getItem('follyworks.playtestMode'), n: window.__follyworksPlaytest.log.sessions.length }));
  check(after.on === null && after.n === 0, 'mode off and a fresh log for the next tester');
  check(!errors.length, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

// ------------------------------------------------------------------ phone (touch)

{
  console.log('\n== phone, held sideways');
  const { ctx, page, errors } = await open({ ...devices['iPhone 13 landscape'] });
  check(await page.locator('.pt-tag').isVisible(), 'the Playtest tag shows on the phone');

  await solve(page, 1);
  const inline = page.locator('.modal.results .pt-inline');
  check(await inline.isVisible(), 'rating inside the results card on the phone');
  await inline.locator('.pt-face').nth(4).tap();
  await page.screenshot({ path: `${out}/playtest-results-phone.png` });
  check((await lastSession(page)).rating === 5, 'one tap rates it');
  const next = page.locator('.modal.results .modal-foot .btn.primary');
  check(await next.isVisible(), 'Next puzzle stays reachable');
  await next.tap();
  await page.waitForTimeout(600);
  check(!(await page.locator('.pt-card').isVisible()), 'no second prompt for a mission already rated');

  // leave this one unsolved straight into the next mission: the card sits over the play screen
  await page.keyboard.press('Escape');
  await fw(page, () => window.__follyworks.play.ctl.startRun());
  await page.waitForFunction(() => window.__follyworksPlaytest.current?.runs[0]?.end !== 'reset', null, { timeout: 60000 });
  await fw(page, () => window.__follyworks.play.ctl.reset());
  await fw(page, () => window.__follyworks.playCampaign(5));
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const card = page.locator('.pt-card');
  check(await card.isVisible(), 'rating card on the phone');
  await card.locator('.pt-q b').tap();
  await page.screenshot({ path: `${out}/playtest-card-phone.png` });
  const box = await card.boundingBox();
  const run = await page.locator('.run-btn, .btn.go').first().boundingBox().catch(() => null);
  const overlaps = run && box && !(box.x + box.width <= run.x || run.x + run.width <= box.x || box.y + box.height <= run.y || run.y + run.height <= box.y);
  check(!overlaps, `the card does not cover the Run button (card ${JSON.stringify(box)}, run ${JSON.stringify(run)})`);
  await card.locator('.pt-face').nth(2).tap();
  await page.screenshot({ path: `${out}/playtest-card-phone-rated.png` });
  await card.locator('.pt-x').tap();

  // finish from the tag with no API (the preview server answers 404): the file is saved instead
  await page.locator('.pt-tag').tap();
  await page.locator('.pt-name').fill('Kim');
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.locator('.modal .btn', { hasText: 'Send to John' }).tap();
  const file = await dl;
  check(file && /^follyworks-playtest-kim-[a-z0-9]+\.json$/.test(file.suggestedFilename()), `fallback download (${file?.suggestedFilename()})`);
  await page.waitForSelector('.modal h2:has-text("Saved as a file")', { timeout: 5000 }).catch(() => {});
  check(await page.locator('.modal', { hasText: 'send it to John' }).isVisible(), 'the player is told to send the file to John');
  await page.screenshot({ path: `${out}/playtest-saved-phone.png` });
  if (file) {
    const path = await file.path();
    const { readFileSync } = await import('node:fs');
    const log = JSON.parse(readFileSync(path, 'utf8'));
    check(log.v === 1 && log.name === 'Kim' && log.sessions.some((x) => x.rating === 5), 'the saved file is a full playtest log');
  }
  check(!errors.length, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nplaytest kit OK');
process.exit(failures ? 1 : 0);
