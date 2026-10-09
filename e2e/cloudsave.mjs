// Cloud save end to end: two separate browsers (own storage each) against a server with the API.
//   npm run build && npm run preview &   then   node e2e/cloudsave.mjs   (preview emulates the API in memory)
// or the real Worker and a local D1:
//   npm run build && npx wrangler d1 migrations apply follyworks --local && npx wrangler dev &
//   node e2e/cloudsave.mjs http://127.0.0.1:8787/
// A solves mission 1, B links to A's code from Settings and gets it; B solves mission 2, A reloads
// and gets that too; a phone-sized touch browser loads a save code. Exits non-zero on failure.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const shots = process.env.SHOTS ?? '';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let failures = 0;
const errors = [];
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

const open = async (name, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'], ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`[${name}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${name}] [pageerror] ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 120000, polling: 250 });
  await page.evaluate(() => window.__follyworks.updateSettings({ difficultyChosen: true }));
  return page;
};
const shot = async (page, name) => shots && (await page.screenshot({ path: `${shots}/${name}.png` }));
const status = (page) => page.evaluate(() => window.__follyworks.cloud.status);
const waitSaved = (page, ms = 90000) => page.waitForFunction(() => window.__follyworks.cloud.status === 'saved', null, { timeout: ms, polling: 250 });
const solvedIds = (page) => page.evaluate(() => Object.entries(window.__follyworks.store.data.progress).filter(([, p]) => p.solved).map(([k]) => k).sort());

/** Play campaign mission i with its verified solution, through the real run loop. */
const solve = async (page, i) => {
  await page.evaluate((i) => window.__follyworks.playCampaign(i), i);
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__follyworks.debugLoadSolution(0));
  await page.evaluate(() => window.__follyworks.play.ctl.startRun());
  await page.waitForSelector('.stamps', { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__follyworks.showMenu());
};

const openSettings = async (page) => {
  await page.evaluate(() => window.__follyworks.openSettings());
  await page.waitForSelector('.cloud-box');
  await page.locator('.cloud-box').scrollIntoViewIfNeeded();
};
const closeModals = (page) => page.evaluate(() => document.querySelectorAll('.modal-back').forEach((m) => m.querySelector('.modal-head button')?.click()));

// ---- device A: solve mission 1, let it reach the cloud on its own
const a = await open('A');
check((await solvedIds(a)).length === 0, 'A starts with no progress');
await solve(a, 0);
const idsA = await solvedIds(a);
check(idsA.length === 1, `A solved mission 1 (${idsA})`);
await waitSaved(a);
check((await status(a)) === 'saved', 'A pushed to the cloud by itself (status "Saved to cloud")');
await openSettings(a);
const code = await a.locator('.cloud-box input.cloud-code').first().inputValue();
check(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code), `A shows its code ${code}`);
check((await a.locator('.cloud-status').innerText()) === 'Saved to cloud', 'Settings shows "Saved to cloud"');
await shot(a, 'cloud-settings-A');
await a.locator('.cloud-box button', { hasText: /^Copy$/ }).click();
check((await a.evaluate(() => navigator.clipboard.readText())) === code, 'Copy puts the code on the clipboard');
await closeModals(a);

// ---- device B: separate browser, link with A's code from Settings
const b = await open('B');
check((await solvedIds(b)).length === 0, 'B starts with no progress');
check((await b.evaluate(() => window.__follyworks.cloud.code)) !== code, 'B has its own code');
await openSettings(b);
await b.getByRole('button', { name: 'Use a code from another device' }).click();
await b.locator('.cloud-link input').fill(code.toLowerCase().replace(/-/g, ' '));
await shot(b, 'cloud-link-B');
await b.locator('.cloud-link button', { hasText: 'Link' }).click();
await b.waitForFunction(() => !document.querySelector('.cloud-box'), null, { timeout: 60000 });
check((await solvedIds(b)).join() === idsA.join(), 'after linking, B has A\'s solved mission');
check((await b.evaluate(() => window.__follyworks.cloud.code)) === code, 'B now shares A\'s code');
await b.evaluate(() => window.__follyworks.showCampaign());
await b.waitForTimeout(600);
await shot(b, 'cloud-campaign-B');

// ---- B makes progress; A picks it up on its next start
await solve(b, 1);
const idsB = await solvedIds(b);
check(idsB.length === 2, `B solved mission 2 (${idsB})`);
await waitSaved(b);
await a.reload();
await a.waitForFunction(() => !!window.__follyworks, null, { timeout: 120000, polling: 250 });
await a.waitForFunction((n) => Object.values(window.__follyworks.store.data.progress).filter((p) => p.solved).length >= n, 2, { timeout: 60000 });
check((await solvedIds(a)).join() === idsB.join(), 'A, reloaded, has B\'s new mission too');

// ---- hiding the tab pushes right away (keepalive)
await a.evaluate(() => {
  const p = window.__follyworks.store.data.progress;
  const id = Object.keys(p)[0];
  p[id] = { ...p[id], attempts: p[id].attempts + 5 };
  window.__follyworks.store.save();
});
const attemptsA = await a.evaluate(() => Object.values(window.__follyworks.store.data.progress)[0].attempts);
await a.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await a.waitForTimeout(1500);
const remote = await a.evaluate(async (id) => (await fetch(`/api/save/${id}`, { cache: 'no-store' })).json(), code.replace(/-/g, ''));
check(Object.values(remote.progress).some((p) => p.attempts === attemptsA), 'hiding the tab pushed the latest save at once');

// ---- save code into a phone-sized touch browser that never touches the cloud code
await openSettings(b);
await b.getByRole('button', { name: 'Copy save code' }).click();
await b.waitForTimeout(300);
const saveCode = await b.evaluate(() => navigator.clipboard.readText());
check(saveCode.startsWith('FW1.'), `Copy save code gives an FW1. code (${saveCode.length} chars)`);
await closeModals(b);
await a.context().close(); // three game instances at once are slow under swiftshader
await b.context().close();
const phone = await open('phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await openSettings(phone);
await shot(phone, 'cloud-settings-phone');
await phone.getByRole('button', { name: 'Load save code' }).tap();
await phone.locator('textarea.cloud-savecode').fill(saveCode);
await phone.waitForFunction(() => /This code has/.test(document.querySelector('.cloud-load-msg')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
const sentence = await phone.locator('.cloud-load-msg').innerText();
check(/^This code has 2 solved puzzles\. Loading adds them to this device’s 0 solved puzzles/.test(sentence), `Load shows what it will do: "${sentence}"`);
await shot(phone, 'cloud-savecode-phone');
await phone.locator('.modal-foot .btn', { hasText: 'Load' }).tap();
await phone.waitForTimeout(500);
check((await solvedIds(phone)).join() === idsB.join(), 'loading the save code on the phone merges both missions in');
check((await phone.evaluate(() => window.__follyworks.cloud.code)) !== code, 'a save code does not link devices');

console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no console errors');
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
