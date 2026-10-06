// Chapter 2 — Gravity. Heavy things win arguments with light things.

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const rope = (id: string, from: string, fromPort: string, to: string, toPort: string, via: string[]): ConnectionDef => ({
  id,
  kind: 'rope',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
  via,
});

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 2-1: fill the counterweight

const c2a: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c2-featherweight',
    name: 'Featherweight Division',
    description: 'The empty bucket is too light to hoist the crate. Add enough weight to the bucket to lift the crate up to the rafters.',
    environment: 'basement',
    world: WORLD,
    fixedObjects: [
      o('c2a-pulley-l', 'pulley', 640, 140),
      o('c2a-pulley-r', 'pulley', 960, 140),
      o('c2a-beam', 'wall', 800, 104, { w: 460, h: 20, material: 'steel' }),
    ],
    startingObjects: [o('c2a-crate', 'crate', 640, 878), o('c2a-bucket', 'bucket', 960, 380, { anchored: false })],
    connections: [rope('c2a-rope', 'c2a-crate', 'hook', 'c2a-bucket', 'handle', ['c2a-pulley-l', 'c2a-pulley-r'])],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'bowling_ball', count: 1 },
      { type: 'balloon', count: 1 },
    ],
    goals: [{ kind: 'height', target: { id: 'c2a-crate' }, maxY: 450, label: 'Hoist the crate up to the rafters' }],
    restrictions: { timeLimit: 8 },
    bonus: { elegantParts: 1, elegantTime: 2.5, absurdStages: 5 },
    hints: [
      'The crate weighs 3 kg and the bucket only 2 kg. The heavier side goes down.',
      'Drop something heavy into the bucket. A rubber ball weighs 1 kg; the bowling ball weighs 10.',
    ],
    metadata: { chapter: 2, order: 1, author: 'Follyworks', blurb: 'Heavy goes down. Light goes up. Physics!' },
  },
  solutions: [
    { objects: [o('bowl-a', 'bowling_ball', 960, 250)], connections: [] },
    // Two rubber balls just tip the balance (4 kg vs 3 kg), slowly.
    { objects: [o('ball-a', 'ball', 960, 250), o('ball-b', 'ball', 960, 180)], connections: [] },
    // ABSURD: a ball, bowling ball and ball stacked into the bucket, landing on a balloon that gets squashed in first.
    {
      objects: [
        o('ball-a', 'ball', 960, 330),
        o('bowl-a', 'bowling_ball', 960, 250),
        o('ball-b', 'ball', 960, 180),
        o('balloon-a', 'balloon', 960, 445),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 2-2: build your own counterweight

const c2b: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c2-heavy-lifting',
    name: 'Heavy Lifting',
    description: 'The steel crate weighs 8 kg and refuses to climb stairs. Rig a counterweight over the pulleys to hoist it up to the loft.',
    environment: 'research',
    world: WORLD,
    fixedObjects: [
      o('c2b-pulley-l', 'pulley', 420, 120),
      o('c2b-pulley-r', 'pulley', 1100, 120),
      o('c2b-beam', 'wall', 760, 84, { w: 760, h: 20, material: 'steel' }),
      o('c2b-loft', 'wall', 190, 460, { w: 300, h: 24, material: 'wood' }),
    ],
    startingObjects: [o('c2b-crate', 'crate', 420, 878, { material: 'steel' })],
    connections: [],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 3 },
      { type: 'crate', count: 1 },
    ],
    goals: [{ kind: 'height', target: { id: 'c2b-crate' }, maxY: 420, label: 'Hoist the steel crate up to loft height' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 3, absurdStages: 7 },
    hints: [
      'Tie the rope to the crate’s hook, route it over both pulleys, and tie the other end to something heavier than 8 kg.',
      'An unbolted bucket makes a great counterweight. Untick “Bolted down” and fill it with something heavy.',
      'The higher the counterweight starts, the further it falls and the higher the crate goes.',
    ],
    metadata: { chapter: 2, order: 2, author: 'Follyworks', blurb: 'Make your own ballast.' },
  },
  solutions: [
    {
      objects: [o('bucket-a', 'bucket', 1100, 300, { anchored: false }), o('bowl-a', 'bowling_ball', 1100, 290)],
      connections: [
        rope('rope-a', 'c2b-crate', 'hook', 'bucket-a', 'handle', ['c2b-pulley-l', 'c2b-pulley-r']),
      ],
    },
    // ABSURD: a falling bucket of bowling ball and three rubber balls hoists the steel crate, which then gets a wooden crate dropped on its head.
    {
      objects: [
        o('bucket-a', 'bucket', 1100, 300, { anchored: false }),
        o('bowl-a', 'bowling_ball', 1100, 240),
        o('ball-a', 'ball', 1085, 190),
        o('ball-b', 'ball', 1118, 175),
        o('ball-c', 'ball', 1100, 150),
        o('crate-a', 'crate', 420, 760),
      ],
      connections: [rope('rope-a', 'c2b-crate', 'hook', 'bucket-a', 'handle', ['c2b-pulley-l', 'c2b-pulley-r'])],
    },
  ],
};

export const CHAPTER_2: CampaignEntry[] = [c2a, c2b];
