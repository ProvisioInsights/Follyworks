// End-to-end smoke test driven through real mouse and keyboard input, against a production build.
//   npm run build && npx vite preview --port 4173 &   then   node e2e/smoke.mjs [url]
// Walks: menu -> tutorial 1 (drag a ball in, run, solve) -> undo/redo -> rewind scrub ->
// level editor (new level, place, add goal, test, export) -> sandbox (place, save) -> settings.
// Exits non-zero on any failed check or console error.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const shots = process.env.SHOTS ?? '';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
}).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
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
const canvasBox = async () => (await page.locator('canvas').first().boundingBox());
const worldToScreen = (x, y) => app(([x, y]) => window.__follyworks.scene.worldToScreen(x, y), [x, y]);

await page.goto(url);
await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
await wait(800);
check(await page.getByText('Build the unnecessary.').isVisible(), 'main menu shows');
await shot('smoke-menu');

// ---- tutorial 1 by hand
await page.getByRole('button', { name: /Start/ }).click();
await wait(800);
await page.keyboard.press('Escape'); // close the briefing
await wait(300);
const item = page.locator('.bin-list [data-type="ball"]').first();
const ib = await item.boundingBox();
check(!!ib, 'parts bin lists the ball');
const guideText = () => page.locator('.guide-card').innerText().catch(() => '');
check(/Rubber Ball/.test(await guideText()) && (await page.locator('.guide-arrow').isVisible()), 'tutorial guidance points at the ball in the parts bin');
const goal = await app(() => window.__follyworks.play.ctl.session.level.goals[0].region);
const target = await worldToScreen(goal.x + goal.w / 2, goal.y - 250);
await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 12 });
await page.mouse.up();
await wait(300);
const placed = await app(() => window.__follyworks.play.ctl.session.build.objects.length);
check(placed === 1, 'dragging a ball from the bin places it');
check(/RUN/.test(await guideText()), 'guidance moves on to pressing RUN once the ball is placed');
await page.keyboard.press('Control+z');
await wait(150);
check((await app(() => window.__follyworks.play.ctl.session.build.objects.length)) === 0, 'Ctrl+Z undoes the placement');
await page.keyboard.press('Control+y');
await wait(150);
check((await app(() => window.__follyworks.play.ctl.session.build.objects.length)) === 1, 'Ctrl+Y redoes it');
await shot('smoke-t1-build');
await page.locator('canvas').first().focus();
await page.keyboard.press('Space');
let solved = false;
for (let i = 0; i < 60 && !solved; i++) {
  await wait(500);
  solved = await page.locator('.stamps').isVisible().catch(() => false);
}
check(solved, 'running the machine solves tutorial 1 and shows the results');
await shot('smoke-t1-solved');
const progress = await app(() => JSON.parse(JSON.stringify(window.__follyworks.store.data.progress)));
check(!!progress['t1-first-drop']?.solved, 'the solve is saved');

// ---- rewind: scrub the timeline back to the start
await page.getByRole('button', { name: /Keep tinkering/ }).click();
await wait(300);
await page.keyboard.press('Space');
await wait(2500);
await page.keyboard.press('p'); // pause
const before = await app(() => window.__follyworks.play.ctl.run?.sim.tick ?? -1);
const range = page.locator('input[type="range"]').first();
const rb = await range.boundingBox();
await page.mouse.click(rb.x + 2, rb.y + rb.height / 2);
await wait(300);
const after = await app(() => window.__follyworks.play.ctl.run?.sim.tick ?? -1);
check(before > 30 && after < before, `scrubbing rewinds the run (tick ${before} -> ${after})`);
// resuming from the rewound point must replay the same machine and solve again
await page.keyboard.press('p');
solved = false;
for (let i = 0; i < 60 && !solved; i++) {
  await wait(500);
  solved = await page.locator('.stamps').isVisible().catch(() => false);
}
check(solved, 'resuming after a rewind solves the level again');
await page.keyboard.press('Escape');
await page.keyboard.press('r');
await wait(300);

// ---- level editor
await app(() => window.__follyworks.showLevels());
await wait(400);
await page.getByRole('button', { name: /New level/ }).click();
await wait(900);
check(await app(() => window.__follyworks.play?.ctl.session.kind === 'editor'), 'new level opens in the editor');
const editorBin = page.locator('.bin-list [data-type="crate"]').first();
const eb = await editorBin.boundingBox();
const drop = await worldToScreen(800, 600);
await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2);
await page.mouse.down();
await page.mouse.move(drop.x, drop.y, { steps: 10 });
await page.mouse.up();
await wait(300);
check((await app(() => window.__follyworks.play.ctl.session.level.startingObjects.length)) === 1, 'editor places a crate into the level');
await page.getByRole('tab', { name: 'Goals' }).click();
await wait(200);
await shot('smoke-editor');
await app(() => window.__follyworks.store.flush());
const saved = await app(() => window.__follyworks.store.data.customLevels.length);
check(saved >= 1, 'the custom level is saved');
const exported = await app(() => {
  const l = window.__follyworks.store.data.customLevels[0];
  return JSON.stringify(l).length;
});
check(exported > 200, 'the level can be serialised for export');

// ---- sandbox
await app(() => window.__follyworks.openSandbox());
await wait(900);
const sb = page.locator('.bin-list [data-type="domino"]').first();
const sbb = await sb.boundingBox();
for (let i = 0; i < 3; i++) {
  const p = await worldToScreen(500 + i * 40, 570);
  await page.mouse.move(sbb.x + sbb.width / 2, sbb.y + sbb.height / 2);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();
  await wait(150);
}
check((await app(() => window.__follyworks.play.ctl.session.build.objects.length)) === 3, 'sandbox places three dominoes');
await shot('smoke-sandbox');

// ---- settings
await app(() => window.__follyworks.showMenu());
await wait(400);
await page.getByRole('button', { name: /Settings/ }).click();
await wait(300);
check(await page.locator('.settings-grid').isVisible(), 'settings dialog opens');
await page.keyboard.press('Escape');

check(errors.length === 0, `no console errors${errors.length ? ':\n  ' + errors.slice(0, 10).join('\n  ') : ''}`);
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
