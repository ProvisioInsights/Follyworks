// Per-theme part skins and theme rooms (src/render/skin.ts, src/core/themes.ts).

import { describe, expect, it } from 'vitest';
import { CHAPTER_THEME, THEMES, themeFor } from '../src/core/themes';
import { ARCADE_PALETTE, RIM_STYLE, THEME_ROOM, arcadeCell, gradePixels, roomFor } from '../src/render/skin';
import { THEMED_ENVS, THEME_ROOMS } from '../src/render/art/envThemes';
import { ENVIRONMENTS } from '../src/render/art/environment';

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
    // (the secret arcade skin snaps alpha to its pixel grid; see the arcade block below)
    for (const t of THEMES.map((x) => x.id).filter((x) => x !== 'arcade')) {
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

describe('arcade skin (chunky sprite pixels)', () => {
  const grade = (opts: { scale: number; noEdge?: boolean; softShadow?: boolean } = { scale: 2 }) => {
    const { d, w, h } = sample();
    const before = d.slice();
    gradePixels('arcade', d, w, h, { seed: 3, ...opts });
    return { d, w, h, before };
  };

  it('makes alpha hard and only moves the silhouette by less than one chunky pixel', () => {
    const { d, w, h, before } = grade();
    const c = arcadeCell(w, h, 2);
    expect(c).toBeGreaterThan(1);
    const box = (px: Uint8ClampedArray) => {
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] >= 128) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
      return [x0, y0, x1, y1];
    };
    for (const a of alphas(d)) expect(a === 0 || a === 255).toBe(true);
    const [a0, b0] = [box(before), box(d)];
    for (let i = 0; i < 4; i++) expect(Math.abs(a0[i] - b0[i])).toBeLessThan(c);
    const same = alphas(d).filter((a, i) => a === alphas(before)[i]).length;
    expect(same / (w * h)).toBeGreaterThan(0.9);
  });

  it('paints flat chunky cells from a small saturated palette', () => {
    const { d, w, h } = grade();
    const c = arcadeCell(w, h, 2);
    const pal = new Set(ARCADE_PALETTE);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!d[i + 3]) continue;
        expect(pal.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])).toBe(true);
        // every pixel matches the top-left pixel of its cell
        const j = (Math.floor(y / c) * c * w + Math.floor(x / c) * c) * 4;
        expect([d[i], d[i + 1], d[i + 2], d[i + 3]]).toEqual([d[j], d[j + 1], d[j + 2], d[j + 3]]);
      }
    expect(ARCADE_PALETTE.length).toBeLessThanOrEqual(40);
  });

  it('keeps a hard translucent drop shadow on icons and stepped alpha on overlays', () => {
    const w = 48, h = 48;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i] = 200; d[i + 1] = 60; d[i + 2] = 40;
        // solid square with a soft shadow band below it
        d[i + 3] = x > 8 && x < 36 && y > 8 && y < 30 ? 255 : x > 8 && x < 36 && y >= 30 && y < 40 ? 70 : 0;
      }
    gradePixels('arcade', d, w, h, { scale: 2, softShadow: true });
    const as = new Set(alphas(d));
    expect(as.has(255)).toBe(true);
    expect([...as].some((a) => a > 0 && a < 255)).toBe(true);

    const o = grade({ scale: 2, noEdge: true });
    for (const a of alphas(o.d)) expect(a % 64 === 0 || a === 255).toBe(true);
  });

  it('uses smaller cells on tiny art', () => {
    expect(arcadeCell(8, 8, 2)).toBe(1);
    expect(arcadeCell(200, 200, 2)).toBe(4);
    expect(arcadeCell(200, 200, 2, true)).toBe(5);
  });
});

describe('theme rooms', () => {
  it('keeps the secret arcade room out of the public room lists', () => {
    expect(THEME_ROOM.arcade).toBe('arcade');
    expect(THEMED_ENVS.arcade?.stage).toBe(true);
    expect(ENVIRONMENTS.some((e) => e.id === 'arcade')).toBe(false);
    expect(THEME_ROOMS.some((e) => e.id === 'arcade')).toBe(false);
  });

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
