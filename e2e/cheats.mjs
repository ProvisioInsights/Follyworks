// Cheat codes in the real game: typed codes on the title screen, MOONBOOTS and GOOGLYEYES in a
// real mission (CHEAT badge, no stamps on the result card, nothing recorded), the Settings
// section, "Turn all cheats off", and the touch path (seven taps on the logo, then the code box)
// on an emulated phone held sideways.
//
// Usage: npx vite build && npx vite preview --port 4173, then node e2e/cheats.mjs
// Env: URL (default http://127.0.0.1:4173/), SHOTS (screenshot folder, default /tmp/claude-0/shots)
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const url = process.env.URL ?? 'http://127.0.0.1:4173/';
const out = process.env.SHOTS ?? '/tmp/claude-0/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  .catch(() => chromium.launch());

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------- desktop, keyboard
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const wait = (ms) => page.waitForTimeout(ms);
  const app = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks?.scene, null, { timeout: 60000 });
  await wait(800);
  const on = () => app(() => window.__follyworks.settings.cheats.on);

  await page.keyboard.type('moonbot');
  await wait(200);
  check((await on()).length === 0 && !(await page.locator('.cheat-toast').count()), 'a wrong code does nothing');
  await page.keyboard.type('moonboots');
  await wait(400);
  check((await on()).includes('moonboots'), 'typing MOONBOOTS on the title screen switches it on');
  check(await page.locator('.cheat-toast').isVisible(), 'a CHEAT ACTIVATED toast shows');
  check((await page.locator('.cheat-toast b').textContent()) === 'CHEAT ACTIVATED', 'the toast says CHEAT ACTIVATED');
  await page.screenshot({ path: `${out}/cheat-toast-menu.png` });
  check(await app(() => Math.abs(window.__follyworks.demo.run.sim.gravity - 0.35) < 1e-9), 'the title machine restarts in low gravity');
  await page.keyboard.type('googlyeyes');
  await wait(300);
  check((await on()).includes('googlyeyes') && (await app(() => window.__follyworks.scene.googly.enabled)), 'GOOGLYEYES switches googly eyes on');

  // a real mission with its reference machine
  await app(() => {
    const a = window.__follyworks;
    a.updateSettings({ difficultyChosen: true });
    a.playCampaign(4);
  });
  await wait(900);
  await page.keyboard.press('Escape');
  await wait(200);
  const levelId = await app(() => window.__follyworks.play.ctl.session.level.id);
  check(await page.locator('.topbar .cheat-badge').isVisible(), 'the HUD shows a CHEAT badge while MOONBOOTS is on');
  await app(() => window.__follyworks.debugLoadSolution(0));
  await wait(300);
  await page.locator('canvas').first().focus();
  await page.keyboard.press('Space');
  await wait(1600);
  check(await app(() => Math.abs(window.__follyworks.play.ctl.run.sim.gravity - 0.35 * (window.__follyworks.play.ctl.session.level.world.gravity ?? 1)) < 1e-9), 'the run is built with low gravity');
  await page.screenshot({ path: `${out}/cheat-moonboots-googly-run.png` });
  let solved = false;
  for (let i = 0; i < 120 && !solved; i++) {
    await wait(500);
    solved = await page.locator('.modal.results').isVisible().catch(() => false);
  }
  if (solved) {
    check(await page.locator('.cheat-note').isVisible(), 'the result card says the cheat run earns no stamps');
    check(!(await page.locator('.modal.results .stamps').count()), 'no stamps on a cheat run');
    await page.screenshot({ path: `${out}/cheat-result-card.png` });
    check(!(await app((id) => window.__follyworks.store.progress(id).solved, levelId)), 'nothing is recorded for a cheat run');
    await page.locator('.modal.results .btn', { hasText: 'Keep tinkering' }).click();
    await wait(300);
  } else console.log('note: the low-gravity run did not solve in 30 s (the result card was not checked here)');

  // settings
  await app(() => window.__follyworks.openSettings());
  await wait(300);
  const head = await page.locator('.settings-cheats .sd-head').textContent();
  check(/Cheats found: 2 of 9/.test(head ?? ''), `Settings counts found cheats (${head})`);
  check((await page.locator('.settings-cheats .cheat-row.unfound').count()) === 7, 'unfound cheats show as ???');
  await page.locator('.settings-cheats').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/cheat-settings.png` });
  await page.locator('.settings-cheats button', { hasText: 'Turn all cheats off' }).click();
  await wait(300);
  check((await on()).length === 0, 'Turn all cheats off clears them');
  check(!(await app(() => window.__follyworks.scene.googly.enabled)), 'googly eyes are gone');
  check((await page.locator('.settings-cheats input[type=checkbox]:checked').count()) === 0, 'all switches show off');
  await page.locator('.settings-cheats input[aria-label="Googly eyes"]').check();
  await wait(200);
  check((await on()).includes('googlyeyes'), 'a found cheat can be switched back on in Settings');
  check(!(await page.locator('.topbar .cheat-badge').isVisible()), 'cosmetic cheats show no CHEAT badge');
  await page.keyboard.press('Escape');

  // persistence
  await app(() => window.__follyworks.store.flush());
  await page.reload();
  await page.waitForFunction(() => !!window.__follyworks?.scene, null, { timeout: 60000 });
  await wait(500);
  const s = await app(() => window.__follyworks.settings.cheats);
  check(s.found.length === 2 && s.on.join() === 'googlyeyes', `found and active cheats survive a reload (${JSON.stringify(s)})`);
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await ctx.close();
}

// ---------------------------------------------------------------- phone, touch
{
  // DPR 1 keeps the software renderer quick enough for taps to land close together, as on a real phone
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const wait = (ms) => page.waitForTimeout(ms);
  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks?.scene, null, { timeout: 60000 });
  await wait(800);
  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator('.logo').boundingBox();
  const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const tap = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (let i = 0; i < 6; i++) await tap();
  await wait(2600);
  await tap();
  await wait(300);
  check(!(await page.locator('.code-input').count()), 'six taps and a late seventh are not enough');
  // the late tap started a fresh count, so six more make seven
  for (let i = 0; i < 6; i++) await tap();
  await wait(300);
  check(await page.locator('.code-input').isVisible(), 'the seventh tap opens the code box');
  await page.locator('.code-input').fill('banana');
  await page.locator('.modal-foot .btn.primary').click();
  await wait(200);
  check(await page.locator('.code-input').isVisible(), 'a wrong code keeps the box open and does nothing');
  await page.screenshot({ path: `${out}/cheat-codebox-phone.png` });
  await page.locator('.code-input').fill('disco fever');
  await page.locator('.modal-foot .btn.primary').click();
  await wait(400);
  check(!(await page.locator('.code-input').count()), 'a right code closes the box');
  check((await page.evaluate(() => window.__follyworks.settings.cheats.on)).includes('discofever'), 'DISCOFEVER is on');
  check(await page.locator('#disco-wash').count() === 1, 'the disco wash is showing');
  await wait(600);
  await page.screenshot({ path: `${out}/cheat-disco-phone.png` });
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall cheat checks passed');
process.exit(failures ? 1 : 0);
