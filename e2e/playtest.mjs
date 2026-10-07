// Checks the playtest log in a real browser: plays a mission the way a person would (a failed
// run, a reset, a hint, the working build, a solve, a bit of tinkering), leaves, and reads the
// recorded session back. Usage: node e2e/playtest.mjs [url]
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => !!window.__follyworks && !!window.__follyworksPlaytest, null, { timeout: 30000 });
await page.evaluate(() => {
  window.__follyworksPlaytest.clear();
  window.__follyworks.updateSettings({ difficultyChosen: true });
  window.__follyworks.playCampaign(1);
});
await page.waitForTimeout(700);
await page.keyboard.press('Escape');
const fw = (fn) => page.evaluate(fn);
// a run with nothing placed settles without solving
await fw(() => window.__follyworks.play.ctl.startRun());
await page.waitForFunction(() => window.__follyworksPlaytest.current.runs[0]?.end !== 'reset', null, { timeout: 60000 });
await fw(() => window.__follyworks.play.ctl.reset());
await page.locator('button', { hasText: /hint/i }).first().click().catch(() => {});
await fw(() => window.__follyworks.debugLoadSolution(0));
await fw(() => window.__follyworks.play.ctl.startRun());
await page.waitForFunction(() => window.__follyworksPlaytest.current.solvedAt !== null, null, { timeout: 60000 });
await page.keyboard.press('Escape');
await fw(() => window.__follyworks.showMenu());
await page.waitForTimeout(300);
const log = await fw(() => window.__follyworksPlaytest.log);
const s = log.sessions[log.sessions.length - 1];
console.log(JSON.stringify(s));
const ok = s && s.kind === 'campaign' && s.runs.length >= 2 && s.runs[0].end !== 'solved' && s.runs.some((r) => r.end === 'solved') && s.solvedAt !== null && s.edits > 0 && !s.open;
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
console.log(ok && !errors.length ? 'playtest log OK' : 'playtest log WRONG');
process.exit(ok && !errors.length ? 0 : 1);
