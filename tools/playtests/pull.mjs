// `npm run playtests:pull`: fetch every playtest sent from the live site (the Worker keeps them in
// the D1 database `follyworks`, table `playtests`) and write each log into playtests/, where
// `npm run fun:playtests` reads them. Needs `npx wrangler login` once. Files already there are
// left alone. `npm run playtests:pull -- --local` reads the local dev database instead.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { filesFromD1, PULL_SQL } from './d1.mjs';

const dir = process.env.FUN_LOGS ?? 'playtests';
const where = process.argv.includes('--local') ? '--local' : '--remote';

let out;
try {
  out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'follyworks', where, '--json', '--command', PULL_SQL], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  });
} catch (e) {
  console.error('\nCould not read the playtests table. Logged in? Try `npx wrangler login`, then run this again.');
  process.exit(1);
}

const { files, skipped } = filesFromD1(out);
mkdirSync(dir, { recursive: true });
let added = 0;
for (const f of files) {
  const path = join(dir, f.file);
  if (existsSync(path)) continue;
  writeFileSync(path, JSON.stringify(f.log, null, 1));
  added++;
  console.log(`  + ${path}${f.log.name ? ` (${f.log.name})` : ''}, ${f.log.sessions.length} sessions${f.created ? `, sent ${f.created}` : ''}`);
}
console.log(`${files.length} playtest${files.length === 1 ? '' : 's'} on the server, ${added} new in ${dir}/.${skipped.length ? ` Skipped unreadable rows: ${skipped.join(', ')}.` : ''}`);
console.log('Next: npm run fun:playtests  (writes docs/fun/playtest-report.md)');
