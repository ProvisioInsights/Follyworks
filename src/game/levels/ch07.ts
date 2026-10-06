// Chapter 7 — Air, Heat & Energy. Fans, balloons, candles burning ropes, light vs heavy.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_b.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 7-1: burn the tether, steer the balloon

const upUpAndAway: CampaignEntry = {
  chapter: 7,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c7-up-up-and-away',
    name: 'Up, Up and Away',
    description: 'The balloon is tied down and the greenhouse roof is in the way. Set it free, then breeze it over to the open skylight.',
    environment: 'greenhouse',
    world: WORLD,
    fixedObjects: [
      o('c7a-roof', 'wall', 600, 60, { w: 1200, h: 40, material: 'steel' }),
      o('c7a-skylight-top', 'wall', 1400, 10, { w: 400, h: 20, material: 'steel' }),
      o('c7a-planter', 'wall', 1000, 860, { w: 360, h: 80, material: 'wood' }),
      o('c7a-tether-hook', 'hook', 700, 880),
    ],
    startingObjects: [o('c7a-balloon', 'balloon', 700, 560, { lift: 1, color: 'yellow' })],
    connections: [link('c7a-tether', 'rope', 'c7a-tether-hook', 'hook', 'c7a-balloon', 'string')],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'bowling_ball', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c7a-balloon' },
        region: { x: 1210, y: 0, w: 390, h: 85 },
        hold: 0.5,
        label: 'Float the balloon out through the skylight',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 5, absurdStages: 4 },
    hints: [
      'A candle flame burns through any rope that passes right over it. Keep it away from the balloon itself.',
      'Once it is free the balloon just bumps against the roof. A fan can push light things a long way.',
      'Mount the fan up near the roof, left of the balloon, pointing right, and turn its Reach up. Fans need a battery.',
    ],
    metadata: { chapter: 7, order: 1, author: 'Follyworks', blurb: 'Snip, float, whoosh.' },
  },
  solutions: [
    {
      objects: [
        o('s-candle', 'candle', 702, 871),
        o('s-fan', 'fan', 600, 112, { strength: 6, range: 700 }),
        o('s-battery', 'battery', 100, 871),
      ],
      connections: [link('s-w1', 'wire', 's-battery', 'out', 's-fan', 'in')],
    },
    // ABSURD: candle and fan as before, plus a bowling ball dropped on the way that bonks the balloon.
    {
      objects: [
        o('s-candle', 'candle', 702, 871),
        o('s-fan', 'fan', 600, 112, { strength: 6, range: 700 }),
        o('s-battery', 'battery', 100, 871),
        o('s-bowl', 'bowling_ball', 670, 470),
      ],
      connections: [link('s-w1', 'wire', 's-battery', 'out', 's-fan', 'in')],
    },
  ],
};

// ---------------------------------------------------------------- 7-2: balloons vs a wooden crate

const lighterThanAir: CampaignEntry = {
  chapter: 7,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c7-lighter-than-air',
    name: 'Lighter Than Air',
    description: 'Float the crate up through the hatch into the attic. One balloon will not cut it. Several might, if you puff them up.',
    environment: 'basement',
    world: WORLD,
    fixedObjects: [
      o('c7b-floor-l', 'wall', 350, 300, { w: 700, h: 24, material: 'wood' }),
      o('c7b-floor-r', 'wall', 1250, 300, { w: 700, h: 24, material: 'wood' }),
      o('c7b-attic-roof', 'wall', 800, 12, { w: 1600, h: 24, material: 'wood' }),
    ],
    startingObjects: [o('c7b-crate', 'crate', 800, 878)],
    connections: [],
    inventory: [
      { type: 'balloon', count: 3 },
      { type: 'rope', count: 3 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
    ],
    goals: [{ kind: 'height', target: { id: 'c7b-crate' }, maxY: 270, label: 'Float the crate up into the attic' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 4, elegantTime: 6, absurdStages: 4 },
    hints: [
      'Tie balloons to the crate hook. Each one lifts a little under a kilo; the crate weighs three.',
      'Turn up a balloon’s Lift in its properties to make it pull harder.',
      'Aim for the middle of the hatch so nothing snags on the edges.',
    ],
    metadata: { chapter: 7, order: 2, author: 'Follyworks', blurb: 'Party supplies as heavy machinery.' },
  },
  solutions: [
    {
      // Three well-inflated balloons.
      objects: [
        o('s-b1', 'balloon', 760, 700, { lift: 1.6 }),
        o('s-b2', 'balloon', 800, 660, { lift: 1.6 }),
        o('s-b3', 'balloon', 840, 700, { lift: 1.6 }),
      ],
      connections: [
        link('s-r1', 'rope', 's-b1', 'string', 'c7b-crate', 'hook'),
        link('s-r2', 'rope', 's-b2', 'string', 'c7b-crate', 'hook'),
        link('s-r3', 'rope', 's-b3', 'string', 'c7b-crate', 'hook'),
      ],
    },
    {
      // Two maxed-out balloons.
      objects: [o('s-b1', 'balloon', 770, 680, { lift: 2.5 }), o('s-b2', 'balloon', 830, 680, { lift: 2.5 })],
      connections: [
        link('s-r1', 'rope', 's-b1', 'string', 'c7b-crate', 'hook'),
        link('s-r2', 'rope', 's-b2', 'string', 'c7b-crate', 'hook'),
      ],
    },
    // ABSURD: a stack of three balloons of decreasing lift, with a floor fan giving them a shove.
    {
      objects: [
        o('s-b1', 'balloon', 800, 780, { lift: 2.5 }),
        o('s-b2', 'balloon', 800, 720, { lift: 2 }),
        o('s-b3', 'balloon', 800, 660, { lift: 1 }),
        o('s-fan', 'fan', 200, 846, { strength: 3, range: 400 }),
        o('s-battery', 'battery', 100, 871),
      ],
      connections: [
        link('s-r1', 'rope', 's-b1', 'string', 'c7b-crate', 'hook'),
        link('s-r2', 'rope', 's-b2', 'string', 'c7b-crate', 'hook'),
        link('s-r3', 'rope', 's-b3', 'string', 'c7b-crate', 'hook'),
        link('s-w1', 'wire', 's-battery', 'out', 's-fan', 'in'),
      ],
    },
  ],
};

export const CHAPTER_7: CampaignEntry[] = [upUpAndAway, lighterThanAir];
