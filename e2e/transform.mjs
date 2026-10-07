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
// camera changes reach worldToScreen (and the DOM overlays) on the next rendered frames
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
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

// ---- modern manipulation: swing an end, turn from a corner, R / double-click reset, toolbar
await app(() => {
  const s = window.__follyworks.play.ctl.session;
  s.deleteObjects(s.build.objects.map((q) => q.id));
});
await wait(200);
await drag({ x: bin.x + bin.width / 2, y: bin.y + bin.height / 2 }, await toScreen({ x: 520, y: 330 }));
const deg = (rad) => (rad * 180) / Math.PI;
const ends = (q) => {
  const u = { x: Math.cos(q.angle || 0), y: Math.sin(q.angle || 0) };
  const L = q.props.length;
  return { a: { x: q.x - (u.x * L) / 2, y: q.y - (u.y * L) / 2 }, b: { x: q.x + (u.x * L) / 2, y: q.y + (u.y * L) / 2 } };
};
const near = (p, q, tol = 1) => Math.hypot(p.x - q.x, p.y - q.y) < tol;
const press = async (p) => {
  const s = await toScreen(p);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
};
const moveTo = async (p, steps = 16) => {
  const s = await toScreen(p);
  await page.mouse.move(s.x, s.y, { steps });
};
const undo = () => app(() => window.__follyworks.play.ctl.session.undo());
o = await obj();
h = await handles();
check(h.resize.every((q) => q.swing) && h.corners.length === 4, 'plank end grips swing and its corners turn it');

// 1) grab the right end and swing it down to 30°, 60 longer: the left end is the pivot
let fixed = ends(o).a;
let L1 = o.props.length + 60;
let grip = h.resize.find((q) => q.sign === 1);
await press(grip.pos);
await moveTo({ x: fixed.x + Math.cos(Math.PI / 6) * L1, y: fixed.y + Math.sin(Math.PI / 6) * L1 });
await wait(120);
await settle();
const badge = (await page.locator('.manip-badge').textContent().catch(() => '')) ?? '';
check(/30°/.test(badge) && /220 cm/.test(badge), `a badge by the pointer reads the angle and length while swinging ("${badge}")`);
check((await page.locator('.sel-bar').isVisible()) === false, 'the toolbar steps aside during a drag');
await shot('manip-swing-badge');
await page.mouse.up();
await wait(200);
o = await obj();
check(Math.abs(deg(o.angle) - 30) < 0.01 && o.props.length === L1, `swinging an end turns and stretches the plank (${deg(o.angle).toFixed(1)}°, ${o.props.length})`);
check(near(ends(o).a, fixed), 'the opposite end stays put as the pivot');
await undo();
await wait(150);
o = await obj();
check(o.angle === 0 && o.props.length === L1 - 60, 'one undo puts the whole swing back');

// 2) a snapped 45° swing of the left end shows the guide line
h = await handles();
grip = h.resize.find((q) => q.sign === -1);
fixed = ends(o).b;
await press(grip.pos);
await moveTo({ x: fixed.x - Math.cos(Math.PI / 4) * 150 + 2, y: fixed.y - Math.sin(Math.PI / 4) * 150 - 1 });
await wait(120);
check(!!(await app(() => window.__follyworks.play.ctl.editor.manip?.guide)), 'swinging onto 45° shows a snap guide');
await shot('manip-snap-guide');
await page.mouse.up();
await wait(200);
o = await obj();
check(Math.abs(deg(o.angle) - 45) < 0.01 && o.props.length === 150 && near(ends(o).b, fixed), `the left end swings about the right end (${deg(o.angle).toFixed(1)}°, ${o.props.length})`);
await undo();
await wait(150);

// 3) Shift keeps the length; Alt frees the angle
o = await obj();
h = await handles();
grip = h.resize.find((q) => q.sign === 1);
fixed = ends(o).a;
await page.keyboard.down('Shift');
await drag(await toScreen(grip.pos), await toScreen({ x: fixed.x + Math.cos(-0.35) * 400, y: fixed.y + Math.sin(-0.35) * 400 }));
await page.keyboard.up('Shift');
o = await obj();
check(o.props.length === 160 && Math.abs(deg(o.angle) + 20) < 0.01 && near(ends(o).a, fixed), `Shift only turns the plank (${deg(o.angle).toFixed(1)}°, ${o.props.length})`);
await undo();
await wait(150);
o = await obj();
h = await handles();
grip = h.resize.find((q) => q.sign === 1);
fixed = ends(o).a;
const a33 = (33 * Math.PI) / 180;
await page.keyboard.down('Alt');
await drag(await toScreen(grip.pos), await toScreen({ x: fixed.x + Math.cos(a33) * 200, y: fixed.y + Math.sin(a33) * 200 }));
await page.keyboard.up('Alt');
o = await obj();
check(Math.abs(deg(o.angle) - 33) < 0.6 && Math.round(deg(o.angle)) % 5 !== 0, `Alt gives a free angle (${deg(o.angle).toFixed(1)}°)`);
await undo();
await wait(150);

// 4) turn from just outside a corner, about the centre
o = await obj();
h = await handles();
const cs = await toScreen(h.corners[1]); // top right
const cc = await toScreen(h.center);
const zone = { x: cs.x + 9, y: cs.y - 9 };
await page.mouse.move(zone.x, zone.y, { steps: 3 });
await wait(80);
const cur = await app(() => document.querySelector('canvas').style.cursor);
check(cur.startsWith('url('), 'hovering just outside a corner shows a turn cursor');
await shot('manip-corner-hover');
const ra = Math.atan2(zone.y - cc.y, zone.x - cc.x);
const rr = Math.hypot(zone.x - cc.x, zone.y - cc.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  const t = ra + ((Math.PI / 4) * i) / 12;
  await page.mouse.move(cc.x + Math.cos(t) * rr, cc.y + Math.sin(t) * rr);
}
await page.mouse.up();
await wait(200);
const o2 = await obj();
check(Math.abs(deg(o2.angle) - 45) < 0.01 && near(o2, o, 0.01), `dragging a corner turns the plank about its centre (${deg(o2.angle).toFixed(1)}°)`);

// 5) R straightens it, double-clicking the knob too, each one undo step
await page.keyboard.press('r');
await wait(150);
check((await obj()).angle === 0, 'R resets the angle to 0');
await undo();
await wait(150);
check(Math.abs(deg((await obj()).angle) - 45) < 0.01, 'one undo brings the angle back');
h = await handles();
const ks = await toScreen(h.rotate.pos);
await page.mouse.dblclick(ks.x, ks.y);
await wait(200);
check((await obj()).angle === 0, 'double-clicking the knob resets the angle to 0');

// 6) the floating toolbar sits by the part, clear of the HUD, and follows the camera
await settle();
const bar = page.locator('.sel-bar');
check(await bar.isVisible(), 'a toolbar floats by the selected part');
const box = (sel) => page.locator(sel).first().boundingBox();
const overlaps = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
let bb = await bar.boundingBox();
o = await obj();
const pa = await toScreen(ends(o).a);
const pb = await toScreen(ends(o).b);
const partBox = { x: Math.min(pa.x, pb.x), y: Math.min(pa.y, pb.y) - 8, width: Math.abs(pb.x - pa.x), height: Math.abs(pb.y - pa.y) + 16 };
check(!overlaps(bb, partBox), 'the toolbar does not cover the part');
check(!overlaps(bb, await box('.leftcol')) && !overlaps(bb, await box('.topbar')) && !overlaps(bb, await box('.dock')), 'the toolbar stays clear of the parts bin, top bar and dock');
await shot('manip-toolbar');
await app(() => window.__follyworks.scene.panBy(-120, 40));
await settle();
await wait(150);
const bb2 = await bar.boundingBox();
check(Math.abs(bb2.x - bb.x + 120) < 2 && Math.abs(bb2.y - bb.y - 40) < 2, `the toolbar follows a camera pan (${(bb2.x - bb.x).toFixed(0)}, ${(bb2.y - bb.y).toFixed(0)})`);
await app(() => window.__follyworks.scene.zoomAt(1.4, { x: 700, y: 400 }));
await settle();
await wait(150);
bb = await bar.boundingBox();
const kz = await toScreen((await handles()).rotate.pos);
check(bb.y + bb.height <= kz.y, 'after zooming the toolbar still sits above the knob');
await app(() => window.__follyworks.scene.resetView());
await settle();
await wait(150);
await bar.locator('button[aria-label^="Turn right"]').click();
await wait(150);
check(Math.abs(deg((await obj()).angle) - 15) < 0.01, 'the toolbar turns the part 15°');
check((await bar.locator('button[aria-label^="Flip"]').isVisible()) === false, 'no flip button for a part that cannot flip');
await bar.locator('button[aria-label^="Duplicate"]').click();
await wait(200);
check((await app(() => window.__follyworks.play.ctl.session.build.objects.length)) === 2, 'the toolbar duplicates the part');
await bar.locator('button[aria-label^="Delete"]').click();
await wait(200);
check((await app(() => window.__follyworks.play.ctl.session.build.objects.length)) === 1, 'the toolbar deletes the part');
await app(() => {
  const ed = window.__follyworks.play.ctl.editor;
  ed.selected = new Set([window.__follyworks.play.ctl.session.build.objects[0].id]);
  ed.rebuild();
});
await wait(150);
await page.keyboard.press('Space');
await wait(300);
await settle();
check((await bar.isVisible()) === false, 'the toolbar hides during a run');
await page.keyboard.press('Space');
await wait(300);

// 7) swinging an end into a crate is refused on release, in one piece
await app(() => {
  const s = window.__follyworks.play.ctl.session;
  const p = s.build.objects[0];
  s.reshapeObject(p.id, { x: 520, y: 330, angle: 0, props: { length: 160 } });
  s.addObject(s.makeObject('crate', 560, 240));
  window.__follyworks.play.ctl.editor.selected = new Set([p.id]);
  window.__follyworks.play.ctl.editor.rebuild();
});
await wait(200);
o = await obj();
h = await handles();
grip = h.resize.find((q) => q.sign === 1);
fixed = ends(o).a;
await drag(await toScreen(grip.pos), await toScreen({ x: fixed.x + 130, y: fixed.y - 130 }));
const o3 = await obj();
check(o3.angle === 0 && o3.props.length === 160, 'swinging an end through a crate is refused');

// 8) another theme, for the screenshots
await app(() => window.__follyworks.setSessionTheme('future'));
await wait(600);
h = await handles();
grip = h.resize.find((q) => q.sign === 1);
await press(grip.pos);
await moveTo({ x: grip.pos.x + 40, y: grip.pos.y + 70 }, 8);
await wait(150);
await shot('manip-future-drag');
await page.mouse.up();
await wait(250);
await shot('manip-future-toolbar');
await app(() => window.__follyworks.setSessionTheme('retro'));
await wait(600);
await shot('manip-retro-toolbar');

// ---- a seesaw can't turn: its end grips only stretch it along its own axis
await app(() => window.__follyworks.setSessionTheme('auto'));
await app(() => {
  const s = window.__follyworks.play.ctl.session;
  s.deleteObjects(s.build.objects.map((q) => q.id));
  const sw = s.makeObject('seesaw', 520, 420);
  s.addObject(sw);
  window.__follyworks.play.ctl.editor.selected = new Set([sw.id]);
  window.__follyworks.play.ctl.editor.rebuild();
});
await wait(300);
h = await handles();
check(!h.rotate && h.resize.every((q) => !q.swing), 'a seesaw has no knob and its end grips do not swing');
o = await obj();
grip = h.resize.find((q) => q.sign === 1);
await drag(await toScreen(grip.pos), await toScreen({ x: grip.pos.x + 40, y: grip.pos.y + 90 }));
const sw2 = await obj();
check((sw2.angle || 0) === 0 && sw2.props.length === o.props.length + 40 && Math.abs(sw2.x - sw2.props.length / 2 - (o.x - o.props.length / 2)) < 0.5, `dragging a seesaw end only stretches it (${sw2.props.length})`);

// ---- level editor: a wall's long-axis ends swing, its short edges stretch; grips stay grabbable zoomed out
await app(() => window.__follyworks.showLevels());
await wait(300);
await page.getByRole('button', { name: /New level/ }).click();
await wait(800);
const wallId = await app(() => {
  const s = window.__follyworks.play.ctl.session;
  const w = s.makeObject('wall', 560, 330);
  s.addObject(w);
  window.__follyworks.play.ctl.editor.selected = new Set([w.id]);
  window.__follyworks.play.ctl.editor.rebuild();
  return w.id;
});
await wait(300);
const wall = () => app((id) => window.__follyworks.play.ctl.session.find(id), wallId);
h = await handles();
check(h.resize.filter((q) => q.swing).every((q) => q.axis === 'w') && h.resize.some((q) => q.axis === 'h' && !q.swing), 'a wide wall swings by its left/right ends and stretches by its top/bottom edges');
let w0 = await wall();
grip = h.resize.find((q) => q.axis === 'w' && q.sign === 1);
fixed = { x: w0.x - w0.props.w / 2, y: w0.y };
await drag(await toScreen(grip.pos), await toScreen({ x: fixed.x + Math.cos(-Math.PI / 6) * 260, y: fixed.y + Math.sin(-Math.PI / 6) * 260 }));
let w1 = await wall();
const wl = { x: w1.x - (Math.cos(w1.angle) * w1.props.w) / 2, y: w1.y - (Math.sin(w1.angle) * w1.props.w) / 2 };
check(Math.abs(deg(w1.angle) + 30) < 0.01 && w1.props.w === 260 && near(wl, fixed), `swinging a wall end turns it about the other end (${deg(w1.angle).toFixed(1)}°, ${w1.props.w})`);
await shot('manip-editor-wall');
await app(() => window.__follyworks.scene.zoomAt(0.55, { x: 700, y: 400 }));
await settle();
await wait(200);
h = await handles();
grip = h.resize.find((q) => q.axis === 'w' && q.sign === 1);
const gs = await toScreen(grip.pos);
await page.mouse.move(gs.x, gs.y + 11, { steps: 2 });
await wait(80);
check((await app(() => document.querySelector('canvas').style.cursor)) === 'crosshair', 'zoomed out, an end grip still answers 11 px from its centre (24 px target)');
await app(() => window.__follyworks.scene.resetView());
await settle();
await wait(150);

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
