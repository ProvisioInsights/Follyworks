// Dev helper: open the game in headless Chromium, run a script of steps, save screenshots,
// print console errors. Usage: node e2e/shot.mjs <url> <steps.json|inline-js>
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const script = process.argv[3] ?? '';
const out = process.env.SHOTS ?? '/tmp/claude-0/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1600), height: Number(process.env.H ?? 900) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url);
await page.waitForFunction(() => !!window.__follyworks, null, { timeout: 30000 });
await page.waitForTimeout(800);
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const app = () => page.evaluate(() => window.__follyworks);
const wait = (ms) => page.waitForTimeout(ms);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction('page', 'shot', 'wait', 'app', script)(page, shot, wait, app);
console.log(errors.length ? errors.slice(0, 30).join('\n') : 'no console errors');
await browser.close();
