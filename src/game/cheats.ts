// Old-school cheat codes, a nod to 90s games. Pure and DOM-free so the detector, the rules and the
// save format can be unit-tested; App feeds keys in and applies the result.
//
// Two kinds of cheat:
// - cosmetic ones (googly eyes, disco, camera size, slow motion, unlock-all, the arcade theme) are
//   free and never touch the outcome of a run;
// - physics ones (gravity, bounce) go into the Simulation as `SimPhysics` and change what happens,
//   so a run made with them celebrates as usual but awards and records nothing.

import { KonamiDetector } from '../app/konami';

export const CHEAT_IDS = ['moonboots', 'bouncehouse', 'googlyeyes', 'discofever', 'tinytools', 'bigtools', 'slowpoke', 'skeletonkey', 'konami'] as const;
export type CheatId = (typeof CHEAT_IDS)[number];

export interface CheatDef {
  id: CheatId;
  /** What to type (letters only). The Konami code is arrows plus B A, handled by KonamiDetector. */
  code: string;
  /** Short label for Settings and the toast. */
  name: string;
  blurb: string;
  /** Changes the physics, so runs made with it earn no stamps. */
  physics?: boolean;
  /** Cheats that cannot be on at the same time as this one. */
  excludes?: CheatId[];
}

export const CHEATS: CheatDef[] = [
  { id: 'moonboots', code: 'MOONBOOTS', name: 'Moon boots', blurb: 'Low gravity', physics: true },
  { id: 'bouncehouse', code: 'BOUNCEHOUSE', name: 'Bounce house', blurb: 'Everything is extra bouncy', physics: true },
  { id: 'googlyeyes', code: 'GOOGLYEYES', name: 'Googly eyes', blurb: 'Every part gets googly eyes' },
  { id: 'discofever', code: 'DISCOFEVER', name: 'Disco fever', blurb: 'Party lights and livelier music' },
  { id: 'tinytools', code: 'TINYTOOLS', name: 'Tiny tools', blurb: 'A doll’s-house view of the room', excludes: ['bigtools'] },
  { id: 'bigtools', code: 'BIGTOOLS', name: 'Big tools', blurb: 'A close-up camera that follows the action', excludes: ['tinytools'] },
  { id: 'slowpoke', code: 'SLOWPOKE', name: 'Slowpoke', blurb: 'Runs play in slow motion' },
  { id: 'skeletonkey', code: 'SKELETONKEY', name: 'Skeleton key', blurb: 'Every puzzle unlocked' },
  { id: 'konami', code: '', name: 'Insert coin', blurb: 'The secret arcade theme (↑↑↓↓←→←→BA)' },
];

export const cheatDef = (id: CheatId): CheatDef => CHEATS.find((c) => c.id === id)!;
export const isCheatId = (v: unknown): v is CheatId => typeof v === 'string' && (CHEAT_IDS as readonly string[]).includes(v);

/** What the player has found and switched on. Konami and Skeleton key live in their own settings. */
export interface CheatState {
  found: CheatId[];
  on: CheatId[];
}

/** Cheats whose on/off state is an existing setting rather than `CheatState.on`. */
export const SETTING_CHEATS: readonly CheatId[] = ['skeletonkey', 'konami'];

export const emptyCheats = (): CheatState => ({ found: [], on: [] });

/** Physics changes a run is built with. Identity values mean "as authored". */
export interface SimPhysics {
  /** Gravity multiplier. */
  gravity: number;
  /** Minimum restitution of every part (0 = unchanged). */
  bounce: number;
}

export const NORMAL_PHYSICS: SimPhysics = { gravity: 1, bounce: 0 };
export const MOON_GRAVITY = 0.35;
export const BOUNCE_HOUSE = 0.86;

export const physicsFor = (on: readonly CheatId[]): SimPhysics => ({
  gravity: on.includes('moonboots') ? MOON_GRAVITY : 1,
  bounce: on.includes('bouncehouse') ? BOUNCE_HOUSE : 0,
});

/** The switched-on cheats that change the outcome of a run (these block stamps and progress). */
export const stampBlockers = (on: readonly CheatId[]): CheatId[] => CHEATS.filter((c) => c.physics && on.includes(c.id)).map((c) => c.id);

export const blocksStamps = (on: readonly CheatId[]) => stampBlockers(on).length > 0;

/** Everything a run needs from the cheats in force (see RunController's RunCheats). */
export const runCheats = (on: readonly CheatId[]) => ({
  physics: physicsFor(on),
  blockers: stampBlockers(on).map((id) => cheatDef(id).code),
  timeScale: cheatTimeScale(on),
});

/** Camera multiplier for the room: Tiny tools pulls back, Big tools moves in. */
export const cheatZoom = (on: readonly CheatId[]) => (on.includes('tinytools') ? 0.7 : on.includes('bigtools') ? 1.6 : 1);

/** Run-speed multiplier (purely cosmetic: the simulation still steps at a fixed 60 Hz). */
export const cheatTimeScale = (on: readonly CheatId[]) => (on.includes('slowpoke') ? 0.4 : 1);

/**
 * Toggle a cheat in the plain state (the code was entered or its Settings switch flipped): it is
 * marked found, switched on or off, and anything it excludes is switched off.
 */
export const toggleCheat = (s: CheatState, id: CheatId, value?: boolean): CheatState => {
  const found = s.found.includes(id) ? s.found : [...s.found, id];
  const wasOn = s.on.includes(id);
  const turnOn = value ?? !wasOn;
  const ex = cheatDef(id).excludes ?? [];
  const on = s.on.filter((c) => c !== id && !(turnOn && ex.includes(c)));
  if (turnOn) on.push(id);
  return { found, on };
};

/** Saves keep only known ids, without duplicates; an active cheat always counts as found. */
export const parseCheatState = (raw: unknown): CheatState => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const ids = (v: unknown): CheatId[] => (Array.isArray(v) ? [...new Set(v.filter(isCheatId))] : []);
  // Skeleton key and the Konami code are switched on through their own settings (unlockAll, theme).
  let on = ids(r.on).filter((id) => !SETTING_CHEATS.includes(id));
  // two cheats that exclude each other: keep the first
  on = on.filter((id, i) => !(cheatDef(id).excludes ?? []).some((x) => on.indexOf(x) > -1 && on.indexOf(x) < i));
  const found = ids(r.found);
  for (const id of on) if (!found.includes(id)) found.push(id);
  return { found, on };
};

/** Typed letter codes, longest first so a code that ends another one can never shadow it. */
const LETTER_CODES = CHEATS.filter((c) => c.code).sort((a, b) => b.code.length - a.code.length);
const MAX_CODE = Math.max(...LETTER_CODES.map((c) => c.code.length));

/** Normalise text from the hidden code box: letters only, upper case; arrows spelled U D L R. */
export const normaliseCode = (text: string) =>
  text
    .toUpperCase()
    .replace(/↑/g, 'U')
    .replace(/↓/g, 'D')
    .replace(/←/g, 'L')
    .replace(/→/g, 'R')
    .replace(/[^A-Z]/g, '');

/** A whole code typed into the code box (touch). Unknown text gives null. */
export const matchCode = (text: string): CheatId | null => {
  const t = normaliseCode(text);
  if (!t) return null;
  if (t === 'UUDDLRLRBA') return 'konami';
  return LETTER_CODES.find((c) => c.code === t)?.id ?? null;
};

/**
 * Watches keydowns for any code. Letters build up a short buffer and a code fires when the buffer
 * ends with it, so stray letters before it do no harm; any other key (except Shift and friends)
 * clears the buffer. The Konami code is passed through to its own detector.
 */
export class CheatDetector {
  private buf = '';
  private konami = new KonamiDetector();

  /** Feed one key. `letters` false ignores typed codes (the play screen uses letters as shortcuts). */
  push(key: string, code = '', letters = true): CheatId | null {
    if (this.konami.push(key, code)) {
      this.buf = '';
      return 'konami';
    }
    const ch = key.length === 1 ? key.toUpperCase() : code.startsWith('Key') ? code.slice(3) : '';
    if (!/^[A-Z]$/.test(ch)) {
      if (!MODIFIERS.has(key)) this.buf = '';
      return null;
    }
    if (!letters) return null;
    this.buf = (this.buf + ch).slice(-MAX_CODE);
    const hit = LETTER_CODES.find((c) => this.buf.endsWith(c.code));
    if (!hit) return null;
    this.buf = '';
    return hit.id;
  }
}

const MODIFIERS = new Set(['Shift', 'CapsLock', 'Control', 'Alt', 'Meta', 'Dead', 'Unidentified']);
