// Chapter 3 — Momentum. Launch, rebound, regret.

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string): ConnectionDef => ({
  id,
  kind: 'wire',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
});

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 3-1: trampolines

const c3a: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c3-bounce-house',
    name: 'Bounce House',
    description: 'The ball drops out of the pipe and lands with a sad little thud. Bounce it over the wall and up onto the high ledge.',
    environment: 'greenhouse',
    world: WORLD,
    fixedObjects: [
      o('c3a-pipe-l', 'wall', 164, 90, { w: 14, h: 180, material: 'steel' }),
      o('c3a-pipe-r', 'wall', 236, 90, { w: 14, h: 180, material: 'steel' }),
      o('c3a-wall', 'wall', 760, 730, { w: 30, h: 340, material: 'brick' }),
      o('c3a-ledge', 'wall', 1330, 532, { w: 340, h: 24, material: 'wood' }),
      o('c3a-ledge-post', 'wall', 1330, 722, { w: 24, h: 356, material: 'wood' }),
      o('c3a-backstop', 'wall', 1520, 425, { w: 20, h: 190, material: 'wood' }),
    ],
    startingObjects: [o('c3a-ball', 'ball', 200, 130)],
    connections: [],
    inventory: [
      { type: 'trampoline', count: 3 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c3a-ball' },
        region: { x: 1160, y: 360, w: 350, h: 160 },
        hold: 0.4,
        label: 'Land the ball on the high ledge',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 1, elegantTime: 3, absurdStages: 3 },
    hints: [
      'Trampolines throw things away from their springy side. Tilt one to aim the bounce.',
      'One trampoline at normal springiness only gets you so high. Chain a second bounce, or turn the springiness up.',
    ],
    metadata: { chapter: 3, order: 1, author: 'Follyworks', blurb: 'Boing. Boing. Ledge.' },
  },
  solutions: [
    // A springy trampoline under the pipe, tilted towards the ledge.
    { objects: [o('tramp-a', 'trampoline', 200, 840, { power: 3 }, 0.4)], connections: [] },
    // Tilted a little further works too.
    { objects: [o('tramp-a', 'trampoline', 200, 840, { power: 3 }, 0.35)], connections: [] },
    // ABSURD: boing off the pipe trampoline, then hop across two soft trampolines laid along the ledge.
    {
      objects: [
        o('tramp-a', 'trampoline', 200, 840, { power: 3 }, 0.4),
        o('tramp-b', 'trampoline', 1300, 504, { power: 0.5 }),
        o('tramp-c', 'trampoline', 1396, 504, { power: 0.5 }),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 3-2: heavy hits harder

const c3b: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c3-push-comes-to-shove',
    name: 'Push Comes to Shove',
    description: 'Knock the crate off its pedestal and into the scrap bin below. A gentle tap will not do; it needs real momentum.',
    environment: 'research',
    world: WORLD,
    fixedObjects: [
      o('c3b-pedestal', 'wall', 1150, 650, { w: 200, h: 500, material: 'concrete' }),
      o('c3b-bin-wall', 'wall', 1590, 820, { w: 20, h: 160, material: 'steel' }),
    ],
    startingObjects: [o('c3b-crate', 'crate', 1222, 378)],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'cannon', count: 1 },
      { type: 'timer', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c3b-crate' },
        region: { x: 1262, y: 600, w: 338, h: 300 },
        hold: 0.5,
        label: 'Knock the crate into the scrap bin',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 3, absurdStages: 7 },
    hints: [
      'Momentum is mass times speed. A rubber ball bounces off the crate; something heavier will not.',
      'Roll the bowling ball down a long ramp onto the pedestal, or let a cannon do the talking.',
      'A kitchen timer with nothing wired into it starts counting the moment you press RUN.',
    ],
    metadata: { chapter: 3, order: 2, author: 'Follyworks', blurb: 'Heavier. Faster. Further.' },
  },
  solutions: [
    // Bowling ball down a long ramp onto the pedestal.
    { objects: [o('plank-a', 'plank', 843, 277, { length: 450 }, 0.5), o('bowl-a', 'bowling_ball', 700, 120)], connections: [] },
    // Timer fires a cannon aimed at the crate.
    {
      objects: [o('cannon-a', 'cannon', 980, 372, {}, -0.05), o('timer-a', 'timer', 880, 290, { delay: 0.5 })],
      connections: [wire('wire-a', 'timer-a', 'out', 'cannon-a', 'in')],
    },
    // ABSURD: the bowling-ball ramp plus a timed cannon shot that blasts a spare ball across the floor while the bowling ball bonks a ball parked on the pedestal.
    {
      objects: [
        o('plank-a', 'plank', 843, 277, { length: 450 }, 0.5),
        o('bowl-a', 'bowling_ball', 700, 120),
        o('ball-a', 'ball', 1090, 385),
        o('cannon-a', 'cannon', 200, 852, { power: 850 }),
        o('timer-a', 'timer', 120, 760, { delay: 0.3 }),
        o('ball-b', 'ball', 600, 865),
      ],
      connections: [wire('wire-a', 'timer-a', 'out', 'cannon-a', 'in')],
    },
  ],
};

export const CHAPTER_3: CampaignEntry[] = [c3a, c3b];
