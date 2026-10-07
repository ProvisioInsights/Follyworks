// Plays every campaign level in a real browser: opens it, loads verified solution #0, runs it
// through the actual game loop and waits for the results stamp. Screenshots build + result.
// Usage: [SOL=k] node e2e/campaign.mjs [url] [fromIndex] [toIndex]
// SOL picks the reference solution (default 0; -1 = the last one, which is the ABSURD build).
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const from = Number(process.argv[3] ?? 0);
const to = Number(process.argv[4] ?? 99);
const out = process.env.SHOTS ?? '/tmp/claude-0/shots/levels';
const SOL = Number(process.env.SOL ?? 0);
let failed = 0;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
const n = await page.evaluate(() => window.__follyworks.campaignLength);
await page.evaluate(() => window.__follyworks.updateSettings({ difficultyChosen: true })); // skip the one-time difficulty chooser
const rows = [];
for (let i = from; i < Math.min(n, to + 1); i++) {
  await page.evaluate((i) => window.__follyworks.playCampaign(i), i);
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  const name = await page.evaluate(() => document.querySelector('.topbar .title, .title')?.textContent ?? '');
  const ok = await page.evaluate((k) => window.__follyworks.debugLoadSolution(k), SOL);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}-build.png` });
  const t0 = Date.now();
  await page.evaluate(() => window.__follyworks.play.ctl.startRun());
  let solved = false;
  while (Date.now() - t0 < 90000) {
    await page.waitForTimeout(500);
    solved = await page.evaluate(() => !!document.querySelector('.stamps'));
    if (solved) break;
    const timeUp = await page.evaluate(() => !!document.querySelector('.timeup, .time-up'));
    if (timeUp) break;
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}-result.png` });
  const stamps = await page.evaluate(() => [...document.querySelectorAll('.stamp')].map((s) => s.className.replace('stamp ', '')).join(' '));
  if (!solved) failed++;
  rows.push(`${i} ${name.trim()} loaded=${ok} solved=${solved} wall=${((Date.now() - t0) / 1000).toFixed(0)}s ${stamps}`);
  console.log(rows[rows.length - 1]);
  await page.keyboard.press('Escape');
}
console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no console errors');
await browser.close();
console.log(failed || errors.length ? `${failed} level(s) unsolved` : 'all levels solved');
process.exit(failed || errors.length ? 1 : 0);
