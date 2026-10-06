// Per-theme part skins and theme rooms (src/render/skin.ts, src/core/themes.ts).

import { describe, expect, it } from 'vitest';
import { CHAPTER_THEME, THEMES, themeFor } from '../src/core/themes';
import { RIM_STYLE, THEME_ROOM, gradePixels, roomFor } from '../src/render/skin';
import { THEMED_ENVS } from '../src/render/art/envThemes';

/** A 48x48 test image: an opaque disc of varied colour inside a transparent square. */
const sample = () => {
  const w = 48, h = 48;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = (x - 24) ** 2 + (y - 24) ** 2 < 20 * 20;
      d[i] = (x * 5) % 256;
      d[i + 1] = (y * 5) % 256;
      d[i + 2] = ((x + y) * 3) % 256;
      d[i + 3] = inside ? 255 : 0;
    }
  return { d, w, h };
};

const alphas = (d: Uint8ClampedArray) => d.filter((_, i) => i % 4 === 3);

describe('theme skins', () => {
  it('leaves modern untouched', () => {
    const { d, w, h } = sample();
    const before = d.slice();
    gradePixels('modern', d, w, h, { scale: 1, seed: 1 });
    expect(d).toEqual(before);
  });

  it('never changes alpha, so silhouettes and hit shapes are the same in every theme', () => {
    for (const t of THEMES.map((x) => x.id)) {
      const { d, w, h } = sample();
      const before = alphas(d);
      gradePixels(t, d, w, h, { scale: 1, seed: 3 });
      expect(alphas(d), t).toEqual(before);
    }
  });

  it('changes colour for every themed skin', () => {
    for (const t of THEMES.map((x) => x.id).filter((x) => x !== 'modern')) {
      const { d, w, h } = sample();
      const before = d.slice();
      gradePixels(t, d, w, h, { scale: 1, seed: 3 });
      expect(d, t).not.toEqual(before);
    }
  });

  it('posterizes retro into a small palette', () => {
    const { d, w, h } = sample();
    const count = (x: Uint8ClampedArray) => {
      const s = new Set<number>();
      for (let i = 0; i < x.length; i += 4) if (x[i + 3]) s.add((x[i] << 16) | (x[i + 1] << 8) | x[i + 2]);
      return s.size;
    };
    const before = count(d);
    gradePixels('retro', d, w, h, { scale: 1, seed: 3 });
    expect(count(d)).toBeLessThan(before / 3);
  });
});

describe('theme rooms', () => {
  it('maps each theme to a room, modern keeps the level environment', () => {
    expect(roomFor('modern', 'garage')).toBe('garage');
    for (const t of THEMES.map((x) => x.id).filter((x) => x !== 'modern')) {
      const room = THEME_ROOM[t]!;
      expect(roomFor(t, 'garage')).toBe(room);
      expect(THEMED_ENVS[room], room).toBeTruthy();
    }
  });

  it('has a rim style for every theme', () => {
    for (const t of THEMES) expect(RIM_STYLE[t.id]).toBeTruthy();
  });

  it('follows the era unless a theme is fixed', () => {
    const [chapter, era] = Object.entries(CHAPTER_THEME)[1];
    expect(themeFor(Number(chapter), 'auto')).toBe(era);
    expect(themeFor(Number(chapter), 'comic')).toBe('comic');
  });
});
