// Versioned local persistence. Everything the player owns lives in one JSON document in
// localStorage. Loading never throws: malformed data is quarantined and replaced by defaults.

import { parseBuild, parseLevel } from '../core/level';
import { THEMES, type ThemeSetting } from '../core/themes';
import type { BuildDef, LevelDef } from '../core/types';

export const SAVE_KEY = 'follyworks.save';
export const SAVE_VERSION = 2;

/** Campaign difficulty (see game/difficulty.ts). Normal is the level as authored. */
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
  /** UI text scale: 1, 1.15 or 1.3 */
  textScale: number;
  reducedMotion: boolean;
  snap: boolean;
  showForces: boolean;
  ghostTrails: boolean;
  unlockAll: boolean;
  tips: boolean;
  /** Step-by-step on-screen guidance in tutorial missions. */
  guidance: boolean;
  /** The one difficulty every campaign mission is played on, until the player changes it in Settings. */
  difficulty: Difficulty;
  /** The player has picked a difficulty (first-time chooser or Settings), so the chooser never shows again. */
  difficultyChosen: boolean;
  /** Visual theme: 'auto' follows each mission's era, or one fixed theme everywhere. */
  theme: ThemeSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  sfx: 0.8,
  music: 0.45,
  muted: false,
  textScale: 1,
  reducedMotion: false,
  snap: true,
  showForces: false,
  ghostTrails: true,
  unlockAll: false,
  tips: true,
  guidance: true,
  difficulty: 'normal',
  difficultyChosen: false,
  theme: 'auto',
};

export interface LevelProgress {
  solved: boolean;
  elegant: boolean;
  absurd: boolean;
  bestParts: number | null;
  bestStages: number;
  bestTime: number | null;
  attempts: number;
  solvedAt: string | null;
  /**
   * Results per difficulty. The fields above aggregate every difficulty (any solve unlocks the
   * next missions). Saves from before difficulties existed count as Normal.
   */
  byDifficulty: Record<Difficulty, DifficultyProgress>;
}

export interface DifficultyProgress {
  solved: boolean;
  elegant: boolean;
  absurd: boolean;
  bestTime: number | null;
  /** Solved at least once without using any hint. */
  noHints: boolean;
}

export const emptyDifficultyProgress = (): DifficultyProgress => ({ solved: false, elegant: false, absurd: false, bestTime: null, noHints: false });

export const emptyProgress = (): LevelProgress => ({
  solved: false,
  elegant: false,
  absurd: false,
  bestParts: null,
  bestStages: 0,
  bestTime: null,
  attempts: 0,
  solvedAt: null,
  byDifficulty: { easy: emptyDifficultyProgress(), normal: emptyDifficultyProgress(), hard: emptyDifficultyProgress() },
});

export interface SandboxSlot {
  id: string;
  name: string;
  environment: string;
  build: BuildDef;
  updated: string;
}

export interface SaveData {
  version: number;
  settings: Settings;
  progress: Record<string, LevelProgress>;
  /** Autosaved player machines per level id (campaign and custom). */
  builds: Record<string, BuildDef>;
  customLevels: LevelDef[];
  sandboxSlots: SandboxSlot[];
  /** Id of the custom level open in the editor, to resume. */
  editorLevelId: string | null;
  /** Physics Lab bookkeeping. Lesson results live in `progress`, keyed by their lab- level id. */
  lab: LabSave;
}

export interface LabSave {
  /** The lesson opened most recently, so the lab list can offer to carry on. */
  lastPlayed: string | null;
}

/** Older saves have no `lab` field; anything unreadable falls back to a fresh lab record. */
export const parseLabSave = (raw: unknown): LabSave => ({
  lastPlayed: isObj(raw) && typeof raw.lastPlayed === 'string' ? raw.lastPlayed.slice(0, 80) : null,
});

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  progress: {},
  builds: {},
  customLevels: [],
  sandboxSlots: [],
  editorLevelId: null,
  lab: { lastPlayed: null },
});

/** Minimal storage interface so tests can inject a fake. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const n01 = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export const parseSettings = (raw: unknown): Settings => {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const ts = typeof r.textScale === 'number' && [1, 1.15, 1.3].includes(r.textScale) ? r.textScale : d.textScale;
  return {
    master: n01(r.master, d.master),
    sfx: n01(r.sfx, d.sfx),
    music: n01(r.music, d.music),
    muted: bool(r.muted, d.muted),
    textScale: ts,
    reducedMotion: bool(r.reducedMotion, d.reducedMotion),
    snap: bool(r.snap, d.snap),
    showForces: bool(r.showForces, d.showForces),
    ghostTrails: bool(r.ghostTrails, d.ghostTrails),
    unlockAll: bool(r.unlockAll, d.unlockAll),
    tips: bool(r.tips, d.tips),
    guidance: bool(r.guidance, d.guidance),
    difficulty: isDifficulty(r.difficulty) ? r.difficulty : d.difficulty,
    // Saves from before the flag remembered a difficulty picked in a briefing: that counts as chosen.
    difficultyChosen: typeof r.difficultyChosen === 'boolean' ? r.difficultyChosen : isDifficulty(r.difficulty),
    theme: r.theme === 'auto' || THEMES.some((t) => t.id === r.theme) ? (r.theme as ThemeSetting) : d.theme,
  };
};

const parseProgress = (raw: unknown): LevelProgress => {
  const r = isObj(raw) ? raw : {};
  const p = emptyProgress();
  p.solved = bool(r.solved, false);
  p.elegant = bool(r.elegant, false);
  p.absurd = bool(r.absurd, false);
  p.bestParts = typeof r.bestParts === 'number' ? r.bestParts : null;
  p.bestStages = typeof r.bestStages === 'number' ? r.bestStages : 0;
  p.bestTime = typeof r.bestTime === 'number' ? r.bestTime : null;
  p.attempts = typeof r.attempts === 'number' ? Math.max(0, Math.floor(r.attempts)) : 0;
  p.solvedAt = typeof r.solvedAt === 'string' ? r.solvedAt : null;
  if (isObj(r.byDifficulty)) {
    for (const d of DIFFICULTIES) p.byDifficulty[d] = parseDifficultyProgress(r.byDifficulty[d]);
  } else if (p.solved) {
    // Older saves: everything recorded so far was played on Normal.
    p.byDifficulty.normal = { solved: p.solved, elegant: p.elegant, absurd: p.absurd, bestTime: p.bestTime, noHints: p.solved };
  }
  return p;
};

const parseDifficultyProgress = (raw: unknown): DifficultyProgress => {
  const r = isObj(raw) ? raw : {};
  return {
    solved: bool(r.solved, false),
    elegant: bool(r.elegant, false),
    absurd: bool(r.absurd, false),
    bestTime: typeof r.bestTime === 'number' && Number.isFinite(r.bestTime) ? r.bestTime : null,
    noHints: bool(r.noHints, false),
  };
};

/** Upgrade older save versions. v1 stored custom levels as an id->level map. */
export const migrateSave = (raw: Record<string, any>): Record<string, any> => {
  const v = typeof raw.version === 'number' ? raw.version : 1;
  if (v < 2) {
    if (isObj(raw.customLevels)) raw.customLevels = Object.values(raw.customLevels);
    raw.version = 2;
  }
  return raw;
};

export const parseSave = (text: string | null): { data: SaveData; recovered: boolean } => {
  if (!text) return { data: defaultSave(), recovered: false };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { data: defaultSave(), recovered: true };
  }
  if (!isObj(raw)) return { data: defaultSave(), recovered: true };
  if (typeof raw.version === 'number' && raw.version > SAVE_VERSION) {
    // From a newer build: keep what we understand, never crash.
  }
  const r = migrateSave({ ...raw });
  const data = defaultSave();
  let recovered = false;
  data.settings = parseSettings(r.settings);
  if (isObj(r.progress)) for (const [k, v] of Object.entries(r.progress)) data.progress[k] = parseProgress(v);
  if (Array.isArray(r.customLevels)) {
    for (const l of r.customLevels) {
      try {
        data.customLevels.push(parseLevel(l).level);
      } catch {
        recovered = true;
      }
    }
  }
  if (isObj(r.builds)) {
    for (const [k, v] of Object.entries(r.builds)) {
      // Builds are re-validated against their level at load time; here keep structure only.
      if (isObj(v) && Array.isArray(v.objects) && Array.isArray(v.connections)) data.builds[k] = v as BuildDef;
      else recovered = true;
    }
  }
  if (Array.isArray(r.sandboxSlots)) {
    for (const s of r.sandboxSlots) {
      if (!isObj(s) || typeof s.id !== 'string') {
        recovered = true;
        continue;
      }
      data.sandboxSlots.push({
        id: s.id,
        name: typeof s.name === 'string' ? s.name.slice(0, 60) : 'Sandbox machine',
        environment: typeof s.environment === 'string' ? s.environment : 'garage',
        build: isObj(s.build) && Array.isArray(s.build.objects) ? (s.build as BuildDef) : { objects: [], connections: [] },
        updated: typeof s.updated === 'string' ? s.updated : new Date(0).toISOString(),
      });
    }
  }
  data.editorLevelId = typeof r.editorLevelId === 'string' ? r.editorLevelId : null;
  data.lab = parseLabSave(r.lab);
  return { data, recovered };
};

export class SaveStore {
  data: SaveData;
  /** True when the stored save was damaged and had to be partially or fully reset. */
  recovered = false;
  private kv: KV | null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(kv?: KV | null) {
    this.kv = kv === undefined ? safeLocalStorage() : kv;
    let text: string | null = null;
    try {
      text = this.kv?.getItem(SAVE_KEY) ?? null;
    } catch {
      text = null;
    }
    const { data, recovered } = parseSave(text);
    this.data = data;
    this.recovered = recovered;
    if (recovered && text) {
      try {
        this.kv?.setItem(`${SAVE_KEY}.corrupt-${Date.now()}`, text);
      } catch {
        /* storage full or unavailable: ignore */
      }
    }
  }

  /** Persist soon (debounced). */
  save() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.kv?.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  progress(levelId: string): LevelProgress {
    return this.data.progress[levelId] ?? emptyProgress();
  }

  setProgress(levelId: string, p: LevelProgress) {
    this.data.progress[levelId] = p;
    this.save();
  }

  getBuild(level: LevelDef): BuildDef | null {
    const b = this.data.builds[level.id];
    return b ? parseBuild(b, level) : null;
  }

  setBuild(levelId: string, build: BuildDef) {
    this.data.builds[levelId] = build;
    this.save();
  }

  upsertCustomLevel(level: LevelDef) {
    const i = this.data.customLevels.findIndex((l) => l.id === level.id);
    if (i >= 0) this.data.customLevels[i] = level;
    else this.data.customLevels.unshift(level);
    this.save();
  }

  deleteCustomLevel(id: string) {
    this.data.customLevels = this.data.customLevels.filter((l) => l.id !== id);
    delete this.data.builds[id];
    delete this.data.progress[id];
    if (this.data.editorLevelId === id) this.data.editorLevelId = null;
    this.save();
  }
}

const safeLocalStorage = (): KV | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__fw_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
};
