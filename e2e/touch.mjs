// Touch play test: drives the built game with real touch input (Chromium's DevTools touch
// events, so the page sees genuine touch pointers) on an emulated iPad and iPhone, held
// sideways. Covers dragging a part out of the bin, tapping to select, dragging to move, the
// rotate knob, twisting with two fingers, pinch zoom, tap-to-place, and the phone-upright prompt.
//
// Usage: npx vite build && npx vite preview --port 4173, then node e2e/touch.mjs
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
const wait = (page, ms) => page.waitForTimeout(ms);

async function run(name, device) {
  console.log(`\n== ${name}`);
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) });
  /** One finger from a to b in steps. */
  const swipe = async (a, b, steps = 12) => {
    await touch('touchStart', [a]);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', [{ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }]);
      await wait(page, 16);
    }
    await touch('touchEnd', []);
    await wait(page, 120);
  };
  const tap = async (p) => {
    await touch('touchStart', [p]);
    await wait(page, 40);
    await touch('touchEnd', []);
    await wait(page, 150);
  };
  const state = () =>
    page.evaluate(() => {
      const app = window.__follyworks;
      const ed = app.play.ctl.editor;
      const objs = ed.session.build.objects.map((o) => ({ id: o.id, type: o.type, x: o.x, y: o.y, angle: o.angle || 0 }));
      return { objs, selected: [...ed.selected], zoom: app.scene.zoom, drag: ed.drag?.kind ?? null };
    });
  /** World point to page (client) coordinates. */
  const screen = (x, y) =>
    page.evaluate(
      ([x, y]) => {
        const app = window.__follyworks;
        const r = app.canvas.getBoundingClientRect();
        const s = app.scene.worldToScreen(x, y);
        return { x: r.left + s.x, y: r.top + s.y };
      },
      [x, y],
    );

  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
  await wait(page, 600);
  await page.evaluate(() => window.__follyworks.playCampaign(1));
  await wait(page, 800);
  await page.locator('.diff-card.normal').tap();
  await wait(page, 1200);
  // the briefing, if shown, goes away with its main button
  const brief = page.locator('.modal .btn.primary, .modal .btn.go').first();
  if (await brief.count()) await brief.tap().catch(() => {});
  await wait(page, 500);
  await page.screenshot({ path: `${out}/touch-${name}-start.png` });

  // the whole HUD fits: run button and parts bin inside the viewport
  const vp = page.viewportSize();
  const run = await page.locator('.run-btn').boundingBox();
  check(run && run.x >= 0 && run.x + run.width <= vp.width && run.y + run.height <= vp.height, 'Run button is on screen');
  const toolsBox = await page.locator('.tools').boundingBox();
  const dockBox = await page.locator('.dock').boundingBox();
  check(toolsBox && dockBox && toolsBox.x + toolsBox.width <= dockBox.x + 1, 'edit tools and dock do not overlap');

  // 1. drag a plank out of the bin
  const item = await page.locator('.bin-item[data-type="plank"]').boundingBox();
  const from = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  const target = await screen(560, 300);
  await swipe(from, target, 16);
  let s = await state();
  const plank = s.objs.find((o) => o.type === 'plank');
  check(!!plank, `drag from the bin places a plank (${s.objs.length} part)`);
  if (!plank) {
    await page.screenshot({ path: `${out}/touch-${name}-fail.png` });
    await ctx.close();
    return;
  }
  // the part rides above the finger, so it lands a little above where the finger lifted
  const landed = await screen(plank.x, plank.y);
  check(landed.y < target.y && target.y - landed.y < 70, `placed part sat above the fingertip (${Math.round(target.y - landed.y)}px)`);
  check(s.selected.includes(plank.id), 'the new part is selected');
  await page.screenshot({ path: `${out}/touch-${name}-placed.png` });

  // 2. tap empty space clears the selection, a tap on the part selects it
  await tap(await screen(900, 120));
  s = await state();
  check(s.selected.length === 0, 'tap on empty floor deselects');
  await tap(await screen(plank.x, plank.y));
  s = await state();
  check(s.selected.includes(plank.id), 'tap on the part selects it');
  await wait(page, 100);
  check(await page.locator('.sel-bar').isVisible(), 'selection toolbar shows');
  if (!(await page.locator('.sel-bar').isVisible())) await page.screenshot({ path: `${out}/touch-${name}-nosel.png` });

  // 3. one-finger drag moves it
  const p0 = await screen(plank.x, plank.y);
  await swipe(p0, { x: p0.x + 60, y: p0.y + 30 });
  s = await state();
  let pl = s.objs.find((o) => o.id === plank.id);
  check(Math.abs(pl.x - plank.x) > 20, `drag moves the part (${plank.x} -> ${pl.x})`);

  // 4. rotate knob, dragged sideways
  const knob = await page.evaluate(() => {
    const ed = window.__follyworks.play.ctl.editor;
    const hs = ed.handles();
    return hs?.rotate?.pos ?? null;
  });
  check(!!knob, 'rotate knob is offered');
  if (knob) {
    const k = await screen(knob.x, knob.y);
    const c = await screen(pl.x, pl.y);
    await swipe(k, { x: c.x + (c.y - k.y), y: c.y - 6 }, 14);
    s = await state();
    const after = s.objs.find((o) => o.id === plank.id);
    check(Math.abs(after.angle - pl.angle) > 0.3, `knob drag turns it (${pl.angle.toFixed(2)} -> ${after.angle.toFixed(2)})`);
    pl = after;
  }
  await page.screenshot({ path: `${out}/touch-${name}-knob.png` });

  // 5. two-finger twist on the part
  {
    const c = await screen(pl.x, pl.y);
    const r = 70;
    await touch('touchStart', [{ x: c.x, y: c.y, id: 1 }]);
    await wait(page, 30);
    await touch('touchStart', [{ x: c.x, y: c.y, id: 1 }, { x: c.x + r, y: c.y, id: 2 }]);
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 4);
      await touch('touchMove', [{ x: c.x, y: c.y, id: 1 }, { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a), id: 2 }]);
      await wait(page, 16);
    }
    s = await state();
    check(s.drag === 'pinch', 'two fingers on the part start a twist');
    await touch('touchEnd', [{ x: c.x, y: c.y, id: 1 }]);
    await touch('touchEnd', []);
    await wait(page, 150);
    s = await state();
    const after = s.objs.find((o) => o.id === plank.id);
    const turned = Math.abs(Math.atan2(Math.sin(after.angle - pl.angle), Math.cos(after.angle - pl.angle)));
    check(turned > 0.5 && turned < 1.1, `twist turns it about 45° (${((turned * 180) / Math.PI).toFixed(0)}°)`);
    check(Math.abs(after.x - pl.x) < 1 && Math.abs(after.y - pl.y) < 1, 'twist does not move it');
    pl = after;
  }
  await page.screenshot({ path: `${out}/touch-${name}-twist.png` });

  // 6. pinch on empty space zooms the board, and the parts stay put
  {
    const z0 = (await state()).zoom;
    const c = await screen(250, 380);
    await touch('touchStart', [{ x: c.x - 30, y: c.y, id: 1 }]);
    await touch('touchStart', [{ x: c.x - 30, y: c.y, id: 1 }, { x: c.x + 30, y: c.y, id: 2 }]);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', [{ x: c.x - 30 - i * 6, y: c.y, id: 1 }, { x: c.x + 30 + i * 6, y: c.y, id: 2 }]);
      await wait(page, 16);
    }
    await touch('touchEnd', []);
    await wait(page, 150);
    s = await state();
    check(s.zoom > z0 * 1.3, `pinch zooms in (${z0.toFixed(2)} -> ${s.zoom.toFixed(2)})`);
    const still = s.objs.find((o) => o.id === plank.id);
    check(still.x === pl.x && still.y === pl.y && s.objs.length === 1, 'pinch leaves the parts alone');
    await page.screenshot({ path: `${out}/touch-${name}-zoomed.png` });
    await page.evaluate(() => window.__follyworks.scene.resetView());
    await wait(page, 100);
  }

  // 7. tap a bin item, then tap the stage: the second plank lands where tapped
  {
    await page.locator('.bin-item[data-type="plank"]').tap();
    await wait(page, 150);
    const t = await screen(300, 520);
    await tap(t);
    s = await state();
    const second = s.objs.find((o) => o.type === 'plank' && o.id !== plank.id);
    check(!!second && Math.hypot(second.x - 300, second.y - 520) < 15, `tap-to-place puts a plank where tapped (${second ? `${second.x},${second.y}` : 'none'})`);
  }

  // 8. selection toolbar delete by touch
  {
    await page.locator('.sel-bar .icon-btn.danger').tap();
    await wait(page, 150);
    s = await state();
    check(s.objs.length === 1, 'delete on the selection toolbar removes the part');
  }

  await page.screenshot({ path: `${out}/touch-${name}-end.png` });
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

await run('ipad', devices['iPad (gen 7) landscape']);
await run('iphone', devices['iPhone 15 Pro landscape']);

// upright phone: the stage asks to be turned sideways
{
  console.log('\n== iphone upright');
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'] });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__follyworks.store.data.settings.difficultyChosen = true;
    window.__follyworks.playCampaign(1);
  });
  await page.waitForTimeout(800);
  check(await page.locator('.rotate-hint').isVisible(), 'upright phone shows the turn-sideways prompt');
  await page.screenshot({ path: `${out}/touch-iphone-upright.png` });
  await page.setViewportSize({ width: 852, height: 393 });
  await page.waitForTimeout(300);
  check(!(await page.locator('.rotate-hint').isVisible()), 'turning it sideways hides the prompt');
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall touch checks passed');
process.exit(failures ? 1 : 0);
