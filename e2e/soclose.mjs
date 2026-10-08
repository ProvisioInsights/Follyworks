// "So close!" failure explainer in the real game: open missions the fun audit flags as
// all-or-nothing, load the reference build with one part nudged off its spot (or nothing at all),
// run it, and check the banner appears with its marks, then goes away on rewind and on reset.
// Also runs one mission on a phone held sideways (touch). Screenshots go to SHOTS.
//
// Usage: npx vite build && npx vite preview --port 4173, then node e2e/soclose.mjs [url]
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

// campaign index (T1..T6 are 0..5, then ten per group), part to nudge (null = empty build), dx
const CASES = [
  { code: '1-4', index: 9, part: 'dom-b', dx: -30 },
  { code: '2-6', index: 21, part: 's-bridge', dx: 30 },
  { code: '3-2', index: 27, part: 's-ramp', dx: 30 },
  { code: '1-1', index: 6, part: null, dx: 0 },
];

async function session(name, ctxOpts, cases, settings = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 120000 });
  await page.evaluate((st) => window.__follyworks.updateSettings({ difficultyChosen: true, guidance: false, ...st }), settings);
  for (const c of cases) {
    await page.evaluate((i) => window.__follyworks.playCampaign(i), c.index);
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.evaluate(({ part, dx }) => {
      const fw = window.__follyworks;
      const s = fw.play.ctl.session;
      if (part === null) return s.replace(s.level, { objects: [], connections: [] });
      fw.debugLoadSolution(0);
      const b = JSON.parse(JSON.stringify(s.build));
      const o = typeof part === 'number' ? b.objects[part] : b.objects.find((q) => q.id === part);
      o.x += dx;
      s.replace(s.level, b);
    }, c);
    await page.waitForTimeout(300);
    // headless rendering is slow: let the machine run several ticks per frame
    await page.evaluate(() => {
      window.__follyworks.play.ctl.startRun();
      window.__follyworks.play.ctl.run.speed = 4;
    });
    const t0 = Date.now();
    let text = null;
    while (Date.now() - t0 < 180000) {
      await page.waitForTimeout(400);
      text = await page.evaluate(() => document.querySelector('.so-close .sc-text')?.textContent ?? null);
      if (text || (await page.evaluate(() => !!document.querySelector('.stamps')))) break;
    }
    check(!!text, `${name} ${c.code}: banner "${text}"`);
    const marks = await page.evaluate(() => window.__follyworks.play.ctl.explainMarks);
    console.log('     marks', JSON.stringify(marks));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/so-close-${name}-${c.code}.png` });
    if (!text) continue;
    // rewinding puts the banner away; the marks wait for the end of the run again
    await page.evaluate(() => {
      const run = window.__follyworks.play.ctl.run;
      run.setPaused(true);
      run.scrubTo(Math.floor(window.__follyworks.play.ctl.explainMarks.tick / 2));
      window.__follyworks.play.ctl.emit();
    });
    // headless frames can take a while on a busy machine: allow a few seconds for the HUD to redraw
    const gone = await page.waitForFunction(() => !document.querySelector('.so-close'), null, { timeout: 10000, polling: 200 }).then(() => true, () => false);
    check(gone, `${name} ${c.code}: banner goes on rewind`);
    await page.evaluate(() => window.__follyworks.play.ctl.reset());
    await page.waitForTimeout(200);
    check(!(await page.evaluate(() => window.__follyworks.play.ctl.explainMarks)), `${name} ${c.code}: marks cleared on reset`);
    await page.keyboard.press('Escape');
  }
  check(errors.length === 0, `${name}: no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  await ctx.close();
}

await session('desktop', { viewport: { width: 1600, height: 900 } }, CASES);
await session('reduced', { viewport: { width: 1280, height: 800 } }, [CASES[0]], { reducedMotion: true });
const phone = devices['iPhone 13 landscape'] ?? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };
await session('phone', phone, [CASES[0], CASES[3]]);
await session('tablet', devices['iPad (gen 7) landscape'] ?? { viewport: { width: 1080, height: 810 }, hasTouch: true }, [CASES[2]]);

await browser.close();
console.log(failures ? `${failures} failure(s)` : 'all good');
process.exit(failures ? 1 : 0);
