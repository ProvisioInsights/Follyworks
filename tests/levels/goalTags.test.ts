import { describe, expect, it } from 'vitest';
import '../../src/components';
import { CAMPAIGN, levelCode } from '../../src/game/campaign';
import { buildSpots, partRects } from '../../src/game/goalTags';
import { LAB } from '../../src/game/levels/lab';
import { overlapArea, placeTag, tagSpots, type Rect } from '../../src/game/tagPlacement';
import { goalMarker } from '../../src/sim/goals';
import { Simulation } from '../../src/sim/Simulation';

// Tag size in world px at the usual fit zoom (~1.1): measured tags are about 34 px plus 6.6 px a
// character wide and 26 px tall on screen.
const ZOOM = 1.1;
const tagSize = (chars: number) => ({ w: (34 + 6.6 * chars) / ZOOM, h: 26 / ZOOM });

describe('tag placement', () => {
  const view = { x: 0, y: 0, w: 1000, h: 600 };
  it('stays above its anchor when nothing is in the way', () => {
    const p = placeTag({ x: 500, y: 300 }, 120, 24, { buildSpots: [], parts: [], tags: [], view });
    expect(p.spot).toEqual({ side: 'up', dx: 0, dy: 0 });
    expect(p.cost).toBe(0);
  });

  it('moves off a build spot that sits right above the anchor', () => {
    const spot: Rect = { x: 440, y: 250, w: 120, h: 40 };
    const p = placeTag({ x: 500, y: 300 }, 120, 24, { buildSpots: [spot], parts: [], tags: [], view });
    expect(overlapArea(p.rect, spot)).toBe(0);
  });

  it('stays inside the view near an edge', () => {
    const p = placeTag({ x: 500, y: 10 }, 120, 24, { buildSpots: [], parts: [], tags: [], view });
    expect(p.spot.side).toBe('down');
  });

  it('tags for the same spot do not cover each other', () => {
    const tags: Rect[] = [];
    for (let i = 0; i < 3; i++) tags.push(placeTag({ x: 500, y: 300 }, 160, 24, { buildSpots: [], parts: [], tags, view }).rect);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(overlapArea(tags[i], tags[j])).toBe(0);
  });
});

describe('goal tags never cover the space a mission needs', () => {
  for (const [i, c] of [...CAMPAIGN.entries(), ...LAB.map((l, k) => [1000 + k, l] as const)]) {
    const code = i >= 1000 ? `L${i - 999}` : levelCode(i);
    it(`${code} ${c.level.name}`, () => {
      const base = new Simulation(c.level, { objects: [], connections: [] });
      const obstacles = {
        buildSpots: buildSpots(c.level, c.solutions[0]),
        parts: partRects(base),
        tags: [] as Rect[],
        view: { x: 0, y: 0, w: c.level.world.width, h: c.level.world.height },
      };
      const bad: string[] = [];
      c.level.goals.forEach((g, gi) => {
        const m = goalMarker(g, base);
        if (!m.at) return;
        const { w, h } = tagSize(m.text.length + (m.detail ? m.detail.length + 1 : 0));
        const p = placeTag(m.at, w, h, obstacles);
        const covered = obstacles.buildSpots.reduce((a, b) => a + overlapArea(p.rect, b), 0) / (w * h);
        if (covered > 0.02) bad.push(`goal ${gi + 1} "${m.text}" covers ${(covered * 100).toFixed(0)}% of a build spot`);
        obstacles.tags.push(p.rect);
      });
      expect(bad).toEqual([]);
      // sanity: the default spot is still the usual one when it is clear
      expect(tagSpots(100, 20)[0]).toEqual({ side: 'up', dx: 0, dy: 0 });
    });
  }
});
