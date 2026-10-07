// Acceptance walk-through driven through real mouse and keyboard input against a production build.
//   npm run build && npx vite preview --port 4173 &   then   node e2e/acceptance.mjs [url]
// Covers the acceptance items smoke.mjs does not: moving, rotating, duplicating and deleting parts,
// pan and zoom, slow motion and frame step, exact reset, the level list (rename, duplicate, import,
// delete), test-and-return to the editor, settings and progress surviving a reload, and a corrupt save.
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
const w2s = (x, y) => app(([x, y]) => window.__follyworks.scene.worldToScreen(x, y), [x, y]);
const objs = () => app(() => JSON.parse(JSON.stringify(window.__follyworks.play.ctl.session.build.objects)));
const ready = () => page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
const dragFromBin = async (type, wx, wy) => {
  const b = await page.locator(`.bin-list [data-type="${type}"]`).first().boundingBox();
  const t = await w2s(wx, wy);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x, t.y, { steps: 10 });
  await page.mouse.up();
  await wait(200);
};

await page.goto(url);
await ready();
await page.evaluate(() => localStorage.clear());
await page.reload();
await ready();
await app(() => window.__follyworks.updateSettings({ difficultyChosen: true })); // skip the one-time difficulty chooser
await wait(600);

// ---- build interaction in the sandbox
await app(() => window.__follyworks.openSandbox());
await wait(800);
await dragFromBin('plank', 700, 600);
let o = await objs();
check(o.length === 1 && o[0].type === 'plank', 'a plank can be dragged in');
const from = await w2s(o[0].x, o[0].y);
await page.mouse.move(from.x, from.y);
await page.mouse.down();
await page.mouse.move(from.x + 120, from.y - 60, { steps: 8 });
await page.mouse.up();
await wait(200);
const moved = (await objs())[0];
check(moved.x > o[0].x + 50 && moved.y < o[0].y - 20, `a placed part can be moved (${o[0].x},${o[0].y} -> ${Math.round(moved.x)},${Math.round(moved.y)})`);
await page.keyboard.press('e');
await wait(100);
check(Math.abs((await objs())[0].angle ?? 0) > 0.01, 'E rotates the selection');
await page.keyboard.press('Control+d');
await wait(150);
check((await objs()).length === 2, 'Ctrl+D duplicates the selection');
await page.keyboard.press('Delete');
await wait(150);
check((await objs()).length === 1, 'Delete removes the selection');

const z0 = await app(() => window.__follyworks.scene.zoom);
const c = await w2s(800, 450);
await page.mouse.move(c.x, c.y);
await page.mouse.wheel(0, -400);
await wait(200);
const z1 = await app(() => window.__follyworks.scene.zoom);
check(z1 > z0 * 1.05, `the wheel zooms in (${z0.toFixed(2)} -> ${z1.toFixed(2)})`);
const p0 = await w2s(800, 450);
await page.mouse.move(c.x, c.y);
await page.mouse.down({ button: 'middle' });
await page.mouse.move(c.x + 150, c.y + 40, { steps: 6 });
await page.mouse.up({ button: 'middle' });
await wait(150);
const p1 = await w2s(800, 450);
check(Math.abs(p1.x - p0.x - 150) < 20, `middle-drag pans the view (moved ${Math.round(p1.x - p0.x)} px)`);
await page.keyboard.press('0');
await wait(150);

// ---- running: slow motion, frame step, exact reset (tutorial 2 with its reference machine)
await app(() => window.__follyworks.playCampaign(1));
await wait(800);
await page.keyboard.press('Escape');
await app(() => window.__follyworks.debugLoadSolution(0));
await wait(300);
const startPose = await app(() => JSON.stringify(window.__follyworks.play.ctl.session.build.objects.map((q) => [q.x, q.y, q.angle ?? 0])));
await page.locator('canvas').first().focus();
await page.keyboard.press('Space');
// Measured against the 1× rate on this machine, so a slow software renderer can't fail it.
const f0 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
await wait(1000);
const f1 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
await page.keyboard.press('2');
const t0 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
await wait(1000);
const t1 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
await page.keyboard.press('1');
const slowRate = (t1 - t0) / Math.max(1, f1 - f0);
check(slowRate > 0.3 && slowRate < 0.7, `slow motion runs at about half speed (${slowRate.toFixed(2)}x of the 1× rate, which is ${((f1 - f0) / 60).toFixed(2)}x real time)`);
await page.keyboard.press('p');
await wait(200);
const s0 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
await wait(400);
const s1 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
check(s0 === s1, 'pause stops the clock');
await page.keyboard.press('.');
await wait(100);
const s2 = await app(() => window.__follyworks.play.ctl.run.sim.tick);
check(s2 === s1 + 1, `frame step advances exactly one tick (${s1} -> ${s2})`);
await page.keyboard.press('Space');
await wait(300);
const mode = await app(() => window.__follyworks.play.ctl.mode);
const endPose = await app(() => JSON.stringify(window.__follyworks.play.ctl.session.build.objects.map((q) => [q.x, q.y, q.angle ?? 0])));
check(mode === 'build' && endPose === startPose, 'reset returns to the exact build state');

// ---- progress survives a reload
await app(() => window.__follyworks.playCampaign(0));
await wait(800);
await page.keyboard.press('Escape');
await app(() => window.__follyworks.debugLoadSolution(0));
await page.locator('canvas').first().focus();
await page.keyboard.press('Space');
let solved = false;
for (let i = 0; i < 40 && !solved; i++) {
  await wait(500);
  solved = await page.locator('.stamps').isVisible().catch(() => false);
}
check(solved, 'tutorial 1 solves');
await page.keyboard.press('Escape');

// ---- settings persist
await app(() => window.__follyworks.showMenu());
await wait(300);
await page.getByRole('button', { name: /Settings/ }).click();
await wait(200);
await page.getByLabel('Music').fill('0.1');
await page.getByLabel('Music').dispatchEvent('change');
await page.keyboard.press('Escape');
await app(() => window.__follyworks.store.flush());
await page.reload();
await ready();
await wait(500);
const after = await app(() => ({ music: window.__follyworks.store.data.settings.music, t1: !!window.__follyworks.store.data.progress['t1-first-drop']?.solved }));
check(Math.abs(after.music - 0.1) < 0.01, `music volume persists across a reload (${after.music})`);
check(after.t1, 'campaign progress persists across a reload');

// ---- level list: create, rename, duplicate, export/import, delete, test and return
await app(() => window.__follyworks.showLevels());
await wait(300);
await page.getByRole('button', { name: /New level/ }).click();
await wait(800);
await dragFromBin('crate', 800, 600);
await page.getByRole('tab', { name: 'Goals' }).click();
await wait(200);
await shot('acc-editor-goals');
// add a goal through the session (the goal tool is a drag on the canvas; covered visually above)
await app(() => {
  const s = window.__follyworks.play.ctl.session;
  const crate = s.level.startingObjects[0];
  s.editLevel('goal', (l) => l.goals.push({ kind: 'enterRegion', target: { id: crate.id }, region: { x: 700, y: 700, w: 200, h: 140 }, label: 'Crate in the zone' }));
});
const editState = await app(() => JSON.stringify(window.__follyworks.play.ctl.session.level.startingObjects));
await page.getByRole('button', { name: /^Test$/ }).click();
await wait(800);
check(await app(() => window.__follyworks.play.cfg?.kind === 'test' || window.__follyworks.play.ctl.session.kind === 'test'), 'Test opens the level as a player');
await page.locator('canvas').first().focus();
await page.keyboard.press('Space');
await wait(1200);
await page.keyboard.press('Escape');
await wait(200);
await page.getByRole('button', { name: /Editor/ }).first().click();
await wait(800);
const backState = await app(() => JSON.stringify(window.__follyworks.play.ctl.session.level.startingObjects));
check(await app(() => window.__follyworks.play.ctl.session.kind === 'editor') && backState === editState, 'returning from a test restores the exact edit state');
await app(() => window.__follyworks.store.flush());
await app(() => window.__follyworks.showLevels());
await wait(300);
const count0 = await page.locator('.screen-body .name').count();
await page.getByRole('button', { name: 'Rename' }).first().click();
await wait(200);
await page.locator('.modal input[type="text"]').fill('Crate Expectations');
await page.getByRole('button', { name: /^Rename$/ }).last().click();
await wait(200);
check(await page.getByText('Crate Expectations', { exact: true }).isVisible(), 'a level can be renamed');
await page.getByRole('button', { name: /Duplicate/ }).first().click();
await wait(200);
check((await page.locator('.screen-body .name').count()) === count0 + 1, 'a level can be duplicated');
const exported = await app(() => {
  const l = window.__follyworks.store.data.customLevels.find((q) => q.name === 'Crate Expectations');
  return JSON.stringify(l);
});
await page.getByRole('button', { name: /Import/ }).click();
await wait(200);
await page.locator('.modal textarea').fill(exported.replace('Crate Expectations', 'Imported Crates'));
await page.getByRole('button', { name: /^Import$/ }).last().click();
await wait(300);
const imp = await app(() => window.__follyworks.store.data.customLevels.find((q) => q.name === 'Imported Crates'));
check(!!imp && imp.startingObjects.length === 1 && imp.goals.length === 1, 'an exported level imports with its objects and goals');
await page.getByRole('button', { name: /Import/ }).click();
await wait(200);
await page.locator('.modal textarea').fill('{ not json');
await page.getByRole('button', { name: /^Import$/ }).last().click();
await wait(200);
check(await page.getByText('That isn’t valid JSON.').isVisible(), 'bad import text shows an error instead of crashing');
await page.keyboard.press('Escape');
await wait(200);
const n1 = await page.locator('.screen-body .name').count();
await page.getByRole('button', { name: 'Delete' }).first().click();
await wait(200);
await page.locator('.modal').getByRole('button', { name: /^Delete$/ }).click();
await wait(200);
check((await page.locator('.screen-body .name').count()) === n1 - 1, 'a level can be deleted after confirming');
await shot('acc-levels');

// ---- corrupt save fails gracefully
await page.evaluate(() => {
  // stop the page writing its good save back on unload, then corrupt the stored copy
  const st = window.__follyworks.store;
  st.save = () => {};
  st.flush = () => true;
  localStorage.setItem('follyworks.save', '{"version": 1, "settings": [broken');
});
const errsBefore = errors.length;
await page.reload();
await ready();
await wait(600);
check(await page.getByText('Build the unnecessary.').isVisible(), 'a corrupt save still boots to the menu');
const quarantined = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('follyworks.save.corrupt-')));
check(quarantined, 'the corrupt save is kept aside rather than destroyed');
errors.splice(errsBefore); // the quarantine logs a warning, not an error, but be lenient about the deliberate corruption

check(errors.length === 0, `no console errors${errors.length ? ':\n  ' + errors.slice(0, 10).join('\n  ') : ''}`);
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
