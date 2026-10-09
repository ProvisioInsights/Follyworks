// Playtest report: `npm run fun:playtests` reads every exported playtest log in playtests/
// (or the folder in FUN_LOGS; `npm run playtests:pull` fills it from the live site), merges them
// and writes docs/fun/playtest-report.md, with the headless audit's score beside each level so
// predictions can be checked against real players, and what players wrote on the rating card.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { CAMPAIGN, levelCode } from '../../src/game/campaign';
import { LAB } from '../../src/game/levels/lab';
import { summarize, type PlaytestLog } from '../../src/telemetry/playtest';

const dir = process.env.FUN_LOGS ?? 'playtests';

it('summarizes playtest logs', () => {
  const logs: PlaytestLog[] = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
        .filter((l) => l?.v === 1 && Array.isArray(l.sessions))
    : [];
  const audit = existsSync('docs/fun/fun-audit.json') ? JSON.parse(readFileSync('docs/fun/fun-audit.json', 'utf8')) : { levels: [] };
  const scoreOf = new Map<string, number>(audit.levels.map((l: any) => [l.id, l.score]));
  const order = [...CAMPAIGN.map((e, i) => [e.level.id, levelCode(i)] as const), ...LAB.map((e, i) => [e.level.id, `L${i + 1}`] as const)];
  const code = new Map(order);
  const rank = new Map(order.map(([id], i) => [id, i]));
  const rows = summarize(logs).sort((a, b) => (rank.get(a.level) ?? 999) - (rank.get(b.level) ?? 999));

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const n1 = (x: number | null) => (x === null ? '–' : x.toFixed(1));
  const out = ['# Playtest report', '', `${logs.length} player log${logs.length === 1 ? '' : 's'} from \`${dir}/\`. How to collect them and read this: [MEASURING_FUN.md](MEASURING_FUN.md).`, ''];
  out.push('| Level | Players | Solved | Gave up | Runs to solve | Min to solve | s per try | s to first run | Ghost hints | Replayed | ABSURD | Rating | Audit score | Flags |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows)
    out.push(
      `| ${code.get(r.level) ?? ''} ${r.level} | ${r.players} | ${pct(r.solveRate)} | ${pct(r.quitRate)} | ${n1(r.runsToSolve)} | ${n1(r.minutesToSolve)} | ${n1(r.secondsPerTry)} | ${n1(r.secondsToFirstRun)} | ${pct(r.ghostRate)} | ${pct(r.replayRate)} | ${pct(r.absurdRate)} | ${n1(r.rating)} | ${scoreOf.get(r.level) ?? '–'} | ${r.flags.join('; ')} |`,
    );
  out.push('');
  const said = rows.filter((r) => r.comments.length);
  if (said.length) {
    out.push('## What players said', '');
    for (const r of said) out.push(`**${[code.get(r.level), r.level].filter(Boolean).join(' ')}**`, '', ...r.comments.map((c) => `- ${c}`), '');
  }
  mkdirSync('docs/fun', { recursive: true });
  writeFileSync('docs/fun/playtest-report.md', out.join('\n'));
});
