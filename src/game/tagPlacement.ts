// Where a goal tag sits in the room. A tag points at its anchor (the zone, container or part the
// goal is about) from one of a few nearby spots, and takes the spot that covers the least of what
// the player needs to see or build on: the empty places the level's own solution puts parts,
// the parts already in the room, other tags and the edges of the view. Pure geometry so it can be
// checked against every campaign level without a browser (tests/levels/goalTags.test.ts).

import type { Vec } from '../core/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TagSide = 'up' | 'down' | 'left' | 'right';

export interface TagSpot {
  side: TagSide;
  /** Horizontal offset of the tag centre from the anchor (up / down spots). */
  dx: number;
  /** Stacking offset: further up for up spots, further down for down spots, down for side spots. */
  dy: number;
}

export interface TagPlacement {
  spot: TagSpot;
  rect: Rect;
  /** Weighted overlap of the chosen spot (0 = covers nothing that matters). */
  cost: number;
}

export interface TagObstacles {
  /** Where the level's solution places parts: space the player must be able to see and use. */
  buildSpots: Rect[];
  /** Parts already in the room. */
  parts: Rect[];
  /** Tags placed before this one. */
  tags: Rect[];
  /** The visible room; spill outside it costs. */
  view: Rect;
}

/** Arrow length between the tag and its anchor. */
export const TAG_GAP = 7;

const WEIGHT = { build: 5, part: 1, tag: 8, outside: 6 };

export const overlapArea = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** Candidate spots in order of preference: straight above first, as the tags always were. */
export function tagSpots(w: number, h: number): TagSpot[] {
  const s = Math.round(w * 0.5 - 14);
  const row = h + 4;
  return [
    { side: 'up', dx: 0, dy: 0 },
    { side: 'up', dx: -s, dy: 0 },
    { side: 'up', dx: s, dy: 0 },
    { side: 'down', dx: 0, dy: 0 },
    { side: 'right', dx: 0, dy: 0 },
    { side: 'left', dx: 0, dy: 0 },
    { side: 'up', dx: 0, dy: row },
    { side: 'down', dx: -s, dy: 0 },
    { side: 'down', dx: s, dy: 0 },
    { side: 'up', dx: 0, dy: 2 * row },
    { side: 'right', dx: 0, dy: -row },
    { side: 'left', dx: 0, dy: -row },
    { side: 'right', dx: 0, dy: row },
    { side: 'left', dx: 0, dy: row },
    { side: 'down', dx: 0, dy: row },
    { side: 'up', dx: -s, dy: row },
    { side: 'up', dx: s, dy: row },
  ];
}

export function spotRect(anchor: Vec, w: number, h: number, spot: TagSpot): Rect {
  switch (spot.side) {
    case 'up':
      return { x: anchor.x + spot.dx - w / 2, y: anchor.y - TAG_GAP - spot.dy - h, w, h };
    case 'down':
      return { x: anchor.x + spot.dx - w / 2, y: anchor.y + TAG_GAP + spot.dy, w, h };
    case 'right':
      return { x: anchor.x + TAG_GAP + 4, y: anchor.y - h / 2 + spot.dy, w, h };
    case 'left':
      return { x: anchor.x - TAG_GAP - 4 - w, y: anchor.y - h / 2 + spot.dy, w, h };
  }
}

export function spotCost(r: Rect, o: TagObstacles): number {
  let c = 0;
  for (const b of o.buildSpots) c += WEIGHT.build * overlapArea(r, b);
  for (const p of o.parts) c += WEIGHT.part * overlapArea(r, p);
  for (const t of o.tags) c += WEIGHT.tag * overlapArea(r, t);
  c += WEIGHT.outside * (r.w * r.h - overlapArea(r, o.view));
  return c;
}

/**
 * Pick the spot for one tag. Earlier spots win ties, and a spot must save a real amount of
 * covered area (a tenth of the tag) before the tag leaves its usual place above the anchor.
 */
export function placeTag(anchor: Vec, w: number, h: number, o: TagObstacles, spots = tagSpots(w, h)): TagPlacement {
  let best: TagPlacement | null = null;
  const margin = 0.1 * w * h;
  for (let i = 0; i < spots.length; i++) {
    const rect = spotRect(anchor, w, h, spots[i]);
    const cost = spotCost(rect, o) + i * 0.002 * w * h;
    if (!best || cost < best.cost - (best.spot === spots[0] ? margin : 0)) best = { spot: spots[i], rect, cost };
    if (cost === 0) break;
  }
  return best!;
}
