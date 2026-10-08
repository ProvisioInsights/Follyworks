// Merging two copies of a save (this device and the cloud, or a pasted save code). The rule is
// "never lose progress": mission results take the best of both, everything else (settings,
// builds, custom levels, sandbox slots) keeps whichever copy changed most recently, and a piece
// deleted after the other copy last changed it stays deleted. Pure, so it is unit-tested.

import { DIFFICULTIES, type DifficultyProgress, type LevelProgress, type SaveData } from './save';

const minN = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));
const earliest = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a < b ? a : b);
const later = (a: string | undefined, b: string | undefined) => ((a ?? '') >= (b ?? '') ? a : b);

const mergeDifficulty = (a: DifficultyProgress, b: DifficultyProgress): DifficultyProgress => ({
  solved: a.solved || b.solved,
  elegant: a.elegant || b.elegant,
  absurd: a.absurd || b.absurd,
  bestTime: minN(a.bestTime, b.bestTime),
  noHints: a.noHints || b.noHints,
});

/** The best of two records of the same mission. */
export const mergeLevelProgress = (a: LevelProgress, b: LevelProgress): LevelProgress => {
  const byDifficulty = { ...a.byDifficulty };
  for (const d of DIFFICULTIES) byDifficulty[d] = mergeDifficulty(a.byDifficulty[d], b.byDifficulty[d]);
  return {
    solved: a.solved || b.solved,
    elegant: a.elegant || b.elegant,
    absurd: a.absurd || b.absurd,
    bestParts: minN(a.bestParts, b.bestParts),
    bestStages: Math.max(a.bestStages, b.bestStages),
    bestTime: minN(a.bestTime, b.bestTime),
    attempts: Math.max(a.attempts, b.attempts),
    solvedAt: earliest(a.solvedAt, b.solvedAt),
    byDifficulty,
  };
};

/**
 * Merge `remote` into `local`. On a tie (same change time, or neither stamped) this device's copy
 * wins. Device-only bookkeeping (the level open in the editor, the last lab lesson) stays local.
 */
export const mergeSaves = (local: SaveData, remote: SaveData): SaveData => {
  const L = local.sync;
  const R = remote.sync;
  const stamps: Record<string, string> = {};
  const removed: Record<string, string> = {};

  /** Decide one keyed piece: which side's copy survives, or 'gone' if a deletion is newest. */
  const pick = (key: string, hasL: boolean, hasR: boolean): 'local' | 'remote' | 'gone' => {
    const sl = hasL ? L.stamps[key] ?? '' : undefined;
    const sr = hasR ? R.stamps[key] ?? '' : undefined;
    const del = later(L.removed[key], R.removed[key]);
    const newest = later(sl, sr);
    if (del !== undefined && (newest === undefined || del > newest)) {
      removed[key] = del;
      return 'gone';
    }
    if (newest) stamps[key] = newest;
    if (sl === undefined) return 'remote';
    if (sr === undefined) return 'local';
    return sr > sl ? 'remote' : 'local';
  };

  /** Newest-wins merge of a collection keyed by `prefix` + id, keeping local order then remote extras. */
  const newestWins = <T>(prefix: string, a: Map<string, T>, b: Map<string, T>): Map<string, T> => {
    const out = new Map<string, T>();
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const w = pick(prefix + id, a.has(id), b.has(id));
      if (w !== 'gone') out.set(id, (w === 'local' ? a.get(id) : b.get(id)) as T);
    }
    return out;
  };

  // Progress: best of both, unless a reset (deletion) happened after the other side last played it.
  const progress: Record<string, LevelProgress> = {};
  for (const id of new Set([...Object.keys(local.progress), ...Object.keys(remote.progress)])) {
    const a = local.progress[id];
    const b = remote.progress[id];
    const w = pick(`p:${id}`, !!a, !!b);
    if (w === 'gone') continue;
    progress[id] = a && b ? mergeLevelProgress(a, b) : (a ?? b);
  }

  const settingsFrom = pick('settings', true, true);
  const builds = Object.fromEntries(newestWins('b:', new Map(Object.entries(local.builds)), new Map(Object.entries(remote.builds))));
  const levels = newestWins('l:', new Map(local.customLevels.map((l) => [l.id, l])), new Map(remote.customLevels.map((l) => [l.id, l])));
  const slots = newestWins('s:', new Map(local.sandboxSlots.map((s) => [s.id, s])), new Map(remote.sandboxSlots.map((s) => [s.id, s])));

  // Tombstones for pieces neither side has any more are kept so a third device learns of them.
  for (const k of new Set([...Object.keys(L.removed), ...Object.keys(R.removed)])) {
    if (!(k in stamps) && !(k in removed)) removed[k] = later(L.removed[k], R.removed[k])!;
  }

  const customLevels = [...levels.values()];
  return {
    version: local.version,
    settings: { ...(settingsFrom === 'remote' ? remote.settings : local.settings) },
    progress,
    builds,
    customLevels,
    sandboxSlots: [...slots.values()],
    editorLevelId: local.editorLevelId && customLevels.some((l) => l.id === local.editorLevelId) ? local.editorLevelId : null,
    lab: { lastPlayed: local.lab.lastPlayed ?? remote.lab.lastPlayed },
    sync: { stamps, removed },
  };
};

/** Plain-words summary of what a save holds, for "this will add..." sentences. */
export const describeSave = (d: SaveData) => {
  const solved = Object.values(d.progress).filter((p) => p.solved).length;
  const parts: string[] = [`${solved} solved ${solved === 1 ? 'puzzle' : 'puzzles'}`];
  if (d.customLevels.length) parts.push(`${d.customLevels.length} custom ${d.customLevels.length === 1 ? 'level' : 'levels'}`);
  const slots = d.sandboxSlots.filter((s) => s.id !== 'autosave').length;
  if (slots) parts.push(`${slots} sandbox ${slots === 1 ? 'machine' : 'machines'}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
};
