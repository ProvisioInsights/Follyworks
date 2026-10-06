// SOLVED / ELEGANT / ABSURD. Scoring never punishes experimentation: ELEGANT and ABSURD are
// independent bonuses, and a solution can earn both on different attempts.

import type { LevelDef } from '../core/types';
import type { Difficulty, LevelProgress } from '../persistence/save';
import type { ChainEntry } from '../sim/Simulation';

export const DEFAULT_ABSURD_STAGES = 7;

export interface AttemptResult {
  solved: boolean;
  time: number | null;
  parts: number;
  stages: number;
  domains: string[];
  chain: ChainEntry[];
  elegant: { earned: boolean; available: boolean; reason: string };
  absurd: { earned: boolean; available: boolean; reason: string; target: number };
  /** Highest hint tier used before this solve (0 = none; see game/hints.ts). Set by the HUD. */
  hintTier?: number;
}

/** Unique stages in order of first occurrence. */
export const uniqueChain = (chain: ChainEntry[]): ChainEntry[] => {
  const seen = new Set<string>();
  const out: ChainEntry[] = [];
  for (const c of chain) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
};

export const scoreAttempt = (level: LevelDef, solvedAt: number | null, parts: number, chain: ChainEntry[]): AttemptResult => {
  const solved = solvedAt !== null;
  const stagesList = uniqueChain(chain).filter((c) => solvedAt === null || c.time <= solvedAt + 0.001);
  const stages = stagesList.length;
  const domains = [...new Set(stagesList.map((c) => c.domain))];
  const bonus = level.bonus ?? {};

  // ELEGANT: few parts, or a quick finish. Either target, where authored, is enough.
  let elegant = { earned: false, available: false, reason: 'No elegance target on this level.' };
  const byParts = bonus.elegantParts !== undefined && solved && parts <= bonus.elegantParts;
  const byTime = bonus.elegantTime !== undefined && solved && solvedAt! <= bonus.elegantTime;
  if (bonus.elegantParts !== undefined || bonus.elegantTime !== undefined) {
    const ep = bonus.elegantParts;
    const et = bonus.elegantTime;
    const want = [ep !== undefined ? `Use ${ep} or fewer part${ep === 1 ? '' : 's'}` : '', et !== undefined ? `${ep !== undefined ? 'solve' : 'Solve'} it within ${et}s` : '']
      .filter(Boolean)
      .join(', or ');
    const did = !solved ? '' : [ep !== undefined ? `you used ${parts}` : '', et !== undefined ? `${ep !== undefined ? '' : 'you '}took ${solvedAt!.toFixed(1)}s` : ''].filter(Boolean).join(' and ');
    elegant = {
      earned: byParts || byTime,
      available: true,
      reason: byParts
        ? `Used ${parts} part${parts === 1 ? '' : 's'} (target: ${bonus.elegantParts} or fewer).`
        : byTime
          ? `Solved in ${solvedAt!.toFixed(1)}s (target: ${bonus.elegantTime}s).`
          : `${want}${did ? ` (${did})` : ''}.`,
    };
  }

  const target = bonus.absurdStages ?? DEFAULT_ABSURD_STAGES;
  const absurdOk = solved && target > 0 && stages >= target;
  const absurd = {
    earned: absurdOk,
    available: target > 0,
    target,
    reason: target <= 0
      ? 'No ABSURD bonus on this puzzle.'
      : absurdOk
      ? `${stages}-stage chain reaction across ${domains.length} domain${domains.length === 1 ? '' : 's'} (target: ${target}).`
      : `Chain at least ${target} distinct things happening (you had ${stages}).`,
  };

  return { solved, time: solvedAt, parts, stages, domains, chain: stagesList, elegant, absurd };
};

export const mergeProgress = (prev: LevelProgress, r: AttemptResult, difficulty: Difficulty = 'normal'): LevelProgress => {
  const p = { ...prev, attempts: prev.attempts + 1, byDifficulty: { ...prev.byDifficulty } };
  if (!r.solved) return p;
  const d = { ...p.byDifficulty[difficulty] };
  d.solved = true;
  d.elegant = d.elegant || r.elegant.earned;
  d.absurd = d.absurd || r.absurd.earned;
  d.bestTime = d.bestTime === null || (r.time !== null && r.time < d.bestTime) ? r.time : d.bestTime;
  d.noHints = d.noHints || !r.hintTier;
  p.byDifficulty[difficulty] = d;
  p.solved = true;
  p.elegant = p.elegant || r.elegant.earned;
  p.absurd = p.absurd || r.absurd.earned;
  p.bestParts = p.bestParts === null ? r.parts : Math.min(p.bestParts, r.parts);
  p.bestStages = Math.max(p.bestStages, r.stages);
  p.bestTime = p.bestTime === null || (r.time !== null && r.time < p.bestTime) ? r.time : p.bestTime;
  p.solvedAt = p.solvedAt ?? new Date().toISOString();
  return p;
};
