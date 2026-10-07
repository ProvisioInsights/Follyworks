// End-to-end check of the on-canvas rotate and resize handles and the in-room goal tags,
// driven through real mouse input against a production build.
//   npm run build && npx vite preview --port 4173 &   then   node e2e/transform.mjs [url]
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
const toScreen = async (p) => {
  const s = await app(([x, y]) => window.__follyworks.scene.worldToScreen(x, y), [p.x, p.y]);
  const c = await page.locator('canvas').first().boundingBox();
  return { x: c.x + s.x, y: c.y + s.y };
};
const drag = async (a, b) => {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.mouse.up();
  await wait(200);
};
const obj = () => app(() => window.__follyworks.play.ctl.session.build.objects[0]);
const handles = () => app(() => window.__follyworks.play.ctl.editor.handles());

await page.goto(url);
await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
await page.evaluate(() => window.__follyworks.updateSettings({ difficultyChosen: true })); // skip the one-time difficulty chooser
await wait(600);

// ---- sandbox: place a plank, then rotate and stretch it with the handles
await app(() => window.__follyworks.openSandbox());
await wait(900);
const bin = await page.locator('.bin-list [data-type="plank"]').first().boundingBox();
await drag({ x: bin.x + bin.width / 2, y: bin.y + bin.height / 2 }, await toScreen({ x: 560, y: 320 }));
check((await app(() => window.__follyworks.play.ctl.session.build.objects.length)) === 1, 'a plank is placed from the bin');
let h = await handles();
check(!!h?.rotate && h.resize.length === 2, 'the selected plank shows a rotate knob and two resize grips');
await shot('transform-handles');

// rotate: drag the knob a quarter turn round to the right of the plank
const c = await toScreen(h.center);
const knob = await toScreen(h.rotate.pos);
const r = Math.hypot(knob.x - c.x, knob.y - c.y);
const a = -Math.PI / 2 + Math.PI / 6; // 30° clockwise
await drag(knob, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
let o = await obj();
check(Math.abs((o.angle * 180) / Math.PI - 30) < 0.01, `dragging the knob rotates the plank, snapped to 5° steps (${((o.angle * 180) / Math.PI).toFixed(2)}°)`);
await app(() => window.__follyworks.play.ctl.session.undo());
await wait(150);
check((await obj()).angle === 0, 'one undo puts the rotation back');

// resize: drag the right grip 100 world units outwards; the left end stays put
h = await handles();
const right = h.resize.find((q) => q.sign === 1);
const len0 = (await obj()).props.length;
const leftEnd0 = (await obj()).x - len0 / 2;
await drag(await toScreen(right.pos), await toScreen({ x: right.pos.x + 100, y: right.pos.y }));
o = await obj();
check(o.props.length === len0 + 100, `dragging the right grip stretches the plank (${len0} -> ${o.props.length})`);
check(Math.abs(o.x - o.props.length / 2 - leftEnd0) < 0.5, 'the opposite end stays where it was');
await shot('transform-stretched');

// resize into a wall is refused
await app(() => {
  const s = window.__follyworks.play.ctl.session;
  s.addObject(s.makeObject('crate', 820, 320));
});
await wait(200);
await app(() => {
  const ed = window.__follyworks.play.ctl.editor;
  ed.selected = new Set([window.__follyworks.play.ctl.session.build.objects[0].id]);
});
await wait(150);
h = await handles();
const r2 = h.resize.find((q) => q.sign === 1);
const before = (await obj()).props.length;
await drag(await toScreen(r2.pos), await toScreen({ x: r2.pos.x + 200, y: r2.pos.y }));
check((await obj()).props.length === before, 'stretching a plank through a crate is refused');

// ---- a campaign mission: numbered goal tags in the room match the chips
await app(() => window.__follyworks.playCampaign(Number(6)));
await wait(900);
const tags = await page.locator('.goal-tag').count();
const goals = await app(() => window.__follyworks.play.ctl.session.level.goals.length);
check(tags === goals, `one goal tag per goal (${tags}/${goals})`);
await page.keyboard.press('Escape');
await wait(400);
await shot('transform-goal-tags');

check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
