// The classic up-up-down-down cheat code. Pure and DOM-free so it can be unit-tested; App feeds it
// every keydown and toggles the secret arcade theme when it completes.

export const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'] as const;

type Step = (typeof KONAMI)[number];

const ARROWS: Record<string, Step> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/** Normalise a keydown to a code step (null for keys that are not part of the code). */
export function konamiStep(key: string, code = ''): Step | null {
  if (ARROWS[key]) return ARROWS[key];
  const k = key.length === 1 ? key.toLowerCase() : code === 'KeyB' ? 'b' : code === 'KeyA' ? 'a' : '';
  return k === 'b' || k === 'a' ? k : null;
}

export class KonamiDetector {
  private pos = 0;

  /** Feed one key; true when it completes the code (the detector then starts over). */
  push(key: string, code = ''): boolean {
    const step = konamiStep(key, code);
    if (step === KONAMI[this.pos]) this.pos++;
    // a wrong key restarts the code, but an 'up' may be the start of a fresh attempt
    else this.pos = step === 'up' ? (this.pos === 2 ? 2 : 1) : 0;
    if (this.pos < KONAMI.length) return false;
    this.pos = 0;
    return true;
  }

  /** How far into the code the player is (for a subtle progress cue). */
  get progress(): number {
    return this.pos;
  }
}
