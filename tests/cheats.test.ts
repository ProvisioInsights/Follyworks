import { describe, expect, it } from 'vitest';
import {
  blocksStamps,
  CHEATS,
  CheatDetector,
  cheatZoom,
  matchCode,
  parseCheatState,
  physicsFor,
  runCheats,
  stampBlockers,
  toggleCheat,
  type CheatId,
} from '../src/game/cheats';
import { mergeProgress, scoreAttempt } from '../src/game/scoring';
import { DEFAULT_SETTINGS, emptyProgress, parseSettings } from '../src/persistence/save';
import { Simulation } from '../src/sim/Simulation';
import { level, obj } from './helpers';

const type = (d: CheatDetector, text: string) => [...text].map((ch) => d.push(ch));
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

describe('cheat detector', () => {
  it('fires on the last letter of every code, in any case', () => {
    for (const c of CHEATS.filter((c) => c.code)) {
      const r = type(new CheatDetector(), c.code.toLowerCase());
      expect(r.slice(0, -1).every((x) => x === null)).toBe(true);
      expect(r[r.length - 1]).toBe(c.id);
    }
  });

  it('ignores stray letters before a code and starts over after one', () => {
    const d = new CheatDetector();
    expect(type(d, 'xyzmoonboots').pop()).toBe('moonboots');
    expect(type(d, 'googlyeyes').pop()).toBe('googlyeyes');
  });

  it('wrong codes do nothing', () => {
    const d = new CheatDetector();
    expect(type(d, 'moonboot').every((x) => x === null)).toBe(true);
    expect(type(d, 'iddqdidkfa').every((x) => x === null)).toBe(true);
    expect(type(d, 'MOONBOOTZ').every((x) => x === null)).toBe(true);
  });

  it('a non-letter key breaks a code, Shift does not', () => {
    const d = new CheatDetector();
    type(d, 'MOON');
    d.push(' ');
    expect(type(d, 'BOOTS').pop()).toBe(null);
    type(d, 'MOON');
    d.push('Shift');
    expect(type(d, 'BOOTS').pop()).toBe('moonboots');
  });

  it('letters can be switched off (play screen) while the Konami code still works', () => {
    const d = new CheatDetector();
    expect([...'MOONBOOTS'].map((ch) => d.push(ch, '', false)).every((x) => x === null)).toBe(true);
    expect(KONAMI.map((k) => d.push(k, '', false)).pop()).toBe('konami');
    expect(KONAMI.map((k) => d.push(k)).pop()).toBe('konami');
  });

  it('falls back to the physical key code', () => {
    const d = new CheatDetector();
    expect([...'SLOWPOKE'].map((ch) => d.push('Unidentified', `Key${ch}`)).pop()).toBe('slowpoke');
  });

  it('the code box takes whole codes, with spaces, arrows or U D L R for Konami', () => {
    expect(matchCode('  Bounce House ')).toBe('bouncehouse');
    expect(matchCode('skeleton-key')).toBe('skeletonkey');
    expect(matchCode('↑↑↓↓←→←→BA')).toBe('konami');
    expect(matchCode('uuddlrlrba')).toBe('konami');
    expect(matchCode('moon')).toBe(null);
    expect(matchCode('')).toBe(null);
  });
});

describe('cheat rules', () => {
  it('only the physics cheats block stamps', () => {
    const all = CHEATS.map((c) => c.id);
    expect(stampBlockers(all).sort()).toEqual(['bouncehouse', 'moonboots']);
    for (const id of ['googlyeyes', 'discofever', 'tinytools', 'bigtools', 'slowpoke', 'skeletonkey', 'konami'] as CheatId[]) expect(blocksStamps([id])).toBe(false);
    expect(blocksStamps(['moonboots'])).toBe(true);
    expect(blocksStamps(['googlyeyes', 'bouncehouse'])).toBe(true);
    expect(runCheats(['moonboots', 'googlyeyes']).blockers).toEqual(['MOONBOOTS']);
    expect(runCheats(['googlyeyes']).blockers).toEqual([]);
  });

  it('physics is identity unless a physics cheat is on', () => {
    expect(physicsFor([])).toEqual({ gravity: 1, bounce: 0 });
    expect(physicsFor(['googlyeyes', 'slowpoke']).gravity).toBe(1);
    expect(physicsFor(['moonboots']).gravity).toBeLessThan(0.5);
    expect(physicsFor(['bouncehouse']).bounce).toBeGreaterThan(0.8);
  });

  it('a code toggles on and off, and is remembered as found', () => {
    let s = toggleCheat({ found: [], on: [] }, 'googlyeyes');
    expect(s).toEqual({ found: ['googlyeyes'], on: ['googlyeyes'] });
    s = toggleCheat(s, 'googlyeyes');
    expect(s).toEqual({ found: ['googlyeyes'], on: [] });
    expect(toggleCheat(s, 'googlyeyes', false).on).toEqual([]);
  });

  it('tiny and big tools exclude each other', () => {
    let s = toggleCheat({ found: [], on: [] }, 'tinytools');
    s = toggleCheat(s, 'bigtools');
    expect(s.on).toEqual(['bigtools']);
    expect(cheatZoom(s.on)).toBeGreaterThan(1);
    expect(cheatZoom(toggleCheat(s, 'tinytools').on)).toBeLessThan(1);
  });

  it('a cheat run records nothing, but still reports its result', () => {
    const l = level([]);
    l.bonus = { elegantParts: 5 };
    const r = { ...scoreAttempt(l, 2, 1, []), cheats: ['MOONBOOTS'] };
    expect(r.solved).toBe(true);
    const prev = emptyProgress();
    expect(mergeProgress(prev, r)).toBe(prev);
    expect(mergeProgress(prev, { ...r, cheats: [] }).solved).toBe(true);
  });
});

describe('cheat saves', () => {
  it('old saves load with no cheats', () => {
    expect(parseSettings({ master: 0.5 }).cheats).toEqual({ found: [], on: [] });
    expect(DEFAULT_SETTINGS.cheats).toEqual({ found: [], on: [] });
  });

  it('old unlock-all and arcade flags count as found cheats', () => {
    const s = parseSettings({ unlockAll: true, arcadeUnlocked: true });
    expect(s.unlockAll).toBe(true);
    expect(s.cheats.found.sort()).toEqual(['konami', 'skeletonkey']);
    expect(s.cheats.on).toEqual([]);
  });

  it('keeps known ids once, drops junk, and counts active cheats as found', () => {
    expect(parseCheatState({ found: ['moonboots', 'moonboots', 'warp', 3], on: ['googlyeyes'] })).toEqual({ found: ['moonboots', 'googlyeyes'], on: ['googlyeyes'] });
    expect(parseCheatState('nonsense')).toEqual({ found: [], on: [] });
    expect(parseCheatState({ found: 'x', on: null })).toEqual({ found: [], on: [] });
  });

  it('setting-backed cheats are never stored as on, and exclusive pairs keep the first', () => {
    expect(parseCheatState({ found: [], on: ['skeletonkey', 'konami', 'slowpoke'] }).on).toEqual(['slowpoke']);
    expect(parseCheatState({ on: ['bigtools', 'tinytools'] }).on).toEqual(['bigtools']);
  });

  it('round-trips through parseSettings', () => {
    const cheats = { found: ['moonboots', 'discofever'] as CheatId[], on: ['discofever'] as CheatId[] };
    expect(parseSettings(JSON.parse(JSON.stringify({ ...DEFAULT_SETTINGS, cheats }))).cheats).toEqual(cheats);
  });
});

describe('cheat physics in the simulation', () => {
  const drop = (physics?: { gravity?: number; bounce?: number }) => {
    const ball = obj('ball', 400, 300);
    const s = new Simulation(level([ball]), { objects: [], connections: [] }, { physics });
    const ys: number[] = [];
    for (let i = 0; i < 240; i++) {
      s.step();
      ys.push(s.entities.get(ball.id)!.body.position.y);
    }
    return { s, ys };
  };

  it('moon boots: things fall slower', () => {
    const normal = drop();
    const moon = drop({ gravity: 0.35 });
    expect(moon.s.gravity).toBeCloseTo(0.35);
    expect(moon.ys[30] - 300).toBeLessThan((normal.ys[30] - 300) * 0.5);
  });

  it('bounce house: a dropped ball comes back up higher', () => {
    const peakAfterFirstBounce = (ys: number[]) => {
      const floor = ys.findIndex((y, i) => i > 0 && y < ys[i - 1]);
      return Math.min(...ys.slice(floor));
    };
    const normal = drop();
    const bouncy = drop({ bounce: 0.86 });
    expect(peakAfterFirstBounce(bouncy.ys)).toBeLessThan(peakAfterFirstBounce(normal.ys) - 20);
  });

  it('cheat physics is deterministic', () => {
    expect(drop({ gravity: 0.35, bounce: 0.86 }).ys).toEqual(drop({ gravity: 0.35, bounce: 0.86 }).ys);
  });

  it('no physics option leaves the simulation exactly as before', () => {
    expect(drop({ gravity: 1, bounce: 0 }).ys).toEqual(drop().ys);
  });
});
