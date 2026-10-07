import { describe, expect, it } from 'vitest';
import { KonamiDetector, konamiStep } from '../src/app/konami';

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const feed = (d: KonamiDetector, keys: string[]) => keys.map((k) => d.push(k));

describe('Konami code', () => {
  it('fires exactly on the last key of the code', () => {
    const r = feed(new KonamiDetector(), CODE);
    expect(r.slice(0, -1).every((x) => !x)).toBe(true);
    expect(r[r.length - 1]).toBe(true);
  });

  it('accepts capital B A and physical key codes', () => {
    const d = new KonamiDetector();
    feed(d, CODE.slice(0, 8));
    expect(d.push('B')).toBe(false);
    expect(d.push('A')).toBe(true);
    feed(d, CODE.slice(0, 8));
    expect(d.push('Unidentified', 'KeyB')).toBe(false);
    expect(d.push('Unidentified', 'KeyA')).toBe(true);
  });

  it('restarts on a wrong key and tolerates extra ups before the code', () => {
    const d = new KonamiDetector();
    expect(feed(d, ['ArrowUp', 'ArrowDown', 'x', ...CODE]).pop()).toBe(true);
    expect(feed(d, ['ArrowUp', 'ArrowUp', 'ArrowUp', ...CODE.slice(2)]).pop()).toBe(true);
    expect(feed(d, [...CODE.slice(0, 9), 'b']).some(Boolean)).toBe(false);
  });

  it('can fire again after completing', () => {
    const d = new KonamiDetector();
    expect(feed(d, [...CODE, ...CODE]).filter(Boolean).length).toBe(2);
  });

  it('ignores unrelated keys', () => {
    expect(konamiStep('Enter')).toBeNull();
    expect(konamiStep('c')).toBeNull();
  });
});
