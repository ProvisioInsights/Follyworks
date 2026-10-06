// Chapter 10 — Ridiculous Machines. Multi-domain contraptions, sparse parts bins, several valid
// answers and a standing invitation to overdo it.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_b.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };

const BIG = { width: 2400, height: 1200, gravity: 1 };

// ---------------------------------------------------------------- 10-1: get Bolt up to the penthouse

const socialClimber: CampaignEntry = {
  chapter: 10,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c10-social-climber',
    name: 'Social Climber',
    description: 'Bolt has been invited to the penthouse party. Robots cannot climb, so get him up there by any means necessary: bounce him, hoist him, whatever works.',
    environment: 'underground',
    world: BIG,
    fixedObjects: [
      o('c10a-ledge', 'wall', 300, 1050, { w: 600, h: 300, material: 'concrete' }),
      o('c10a-penthouse', 'wall', 1650, 990, { w: 1500, h: 420, material: 'brick' }),
      o('c10a-awning', 'wall', 1700, 470, { w: 600, h: 20, material: 'steel' }),
      o('c10a-awning-post', 'wall', 1990, 620, { w: 20, h: 300, material: 'steel' }),
    ],
    startingObjects: [o('c10a-bolt', 'robot', 120, 878, { speed: 70, awake: true })],
    connections: [],
    inventory: [
      { type: 'trampoline', count: 1 },
      { type: 'pulley', count: 2 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c10a-bolt' },
        region: { x: 920, y: 560, w: 1460, h: 220 },
        hold: 1,
        label: 'Get Bolt up to the penthouse',
      },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 1, elegantTime: 6, absurdStages: 4 },
    hints: [
      'Bolt marches right off the end of his ledge. Where he lands is up to you.',
      'Springiness and tilt both matter: a trampoline angled towards the penthouse turns a fall into a leap.',
      'Or tie a rope to Bolt’s back hook, run it over pulleys and hang a loaded bucket on the other end.',
    ],
    metadata: { chapter: 10, order: 1, author: 'Follyworks', blurb: 'Upward mobility, robot edition.' },
  },
  solutions: [
    {
      // Chaos: one well-angled trampoline.
      objects: [o('s-tramp', 'trampoline', 660, 1168, { power: 3 }, 0.25)],
      connections: [],
    },
    {
      // Mechanical: counterweight hoist over two pulleys.
      objects: [
        o('s-p1', 'pulley', 1080, 690),
        o('s-p2', 'pulley', 650, 150),
        o('s-bucket', 'bucket', 610, 260, { anchored: false }),
        o('s-iron', 'bowling_ball', 610, 250),
      ],
      connections: [link('s-rope', 'rope', 'c10a-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
    },
    // ABSURD: counterweight hoist whose bucket boings off a soft trampoline on the way down.
    {
      objects: [
        o('s-p1', 'pulley', 1080, 690),
        o('s-p2', 'pulley', 760, 150),
        o('s-bucket', 'bucket', 720, 260, { anchored: false }),
        o('s-iron', 'bowling_ball', 720, 250),
        o('s-tramp', 'trampoline', 720, 600, { power: 0.5 }),
      ],
      connections: [link('s-rope', 'rope', 'c10a-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
    },
  ],
};

// ---------------------------------------------------------------- 10-2: pop every balloon in the place

const partyPooper: CampaignEntry = {
  chapter: 10,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c10-party-pooper',
    name: 'Party Pooper',
    description: 'Three balloons, three hiding places, one very small parts bin. Pop every last one of them, as tidily or as explosively as you like.',
    environment: 'greenhouse',
    world: BIG,
    fixedObjects: [
      // Left: a balloon tied down under a hanging cactus.
      o('c10b-chain', 'wall', 400, 220, { w: 6, h: 440, material: 'steel' }),
      o('c10b-hook-a', 'hook', 400, 1180),
      // Middle: a brick bunker.
      o('c10b-bunker-l', 'wall', 1110, 1030, { w: 20, h: 340, material: 'brick' }),
      o('c10b-bunker-r', 'wall', 1390, 1030, { w: 20, h: 340, material: 'brick' }),
      o('c10b-bunker-roof', 'wall', 1250, 850, { w: 300, h: 20, material: 'brick' }),
      o('c10b-hook-b', 'hook', 1250, 1180),
      // Right: a high shelf.
      o('c10b-shelf', 'wall', 1700, 760, { w: 260, h: 24, material: 'wood' }),
      o('c10b-shelf-strut', 'wall', 1810, 986, { w: 20, h: 428, material: 'wood' }),
      o('c10b-hook-c', 'hook', 1700, 740),
      // The party table, safely out of range.
      o('c10b-table', 'wall', 2150, 1060, { w: 300, h: 20, material: 'wood' }),
      o('c10b-table-leg-l', 'wall', 2030, 1135, { w: 16, h: 130, material: 'wood' }),
      o('c10b-table-leg-r', 'wall', 2270, 1135, { w: 16, h: 130, material: 'wood' }),
    ],
    startingObjects: [
      o('c10b-cactus', 'cactus', 400, 470),
      o('c10b-balloon-a', 'balloon', 400, 760, { lift: 1, color: 'red' }),
      o('c10b-balloon-b', 'balloon', 1250, 950, { lift: 1, color: 'yellow' }),
      o('c10b-balloon-c', 'balloon', 1700, 520, { lift: 1, color: 'teal' }),
    ],
    connections: [
      link('c10b-tether-a', 'rope', 'c10b-hook-a', 'hook', 'c10b-balloon-a', 'string'),
      link('c10b-tether-b', 'rope', 'c10b-hook-b', 'hook', 'c10b-balloon-b', 'string'),
      link('c10b-tether-c', 'rope', 'c10b-hook-c', 'hook', 'c10b-balloon-c', 'string'),
    ],
    inventory: [
      { type: 'candle', count: 2 },
      { type: 'dynamite', count: 2 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'rocket', count: 1 },
    ],
    goals: [
      { kind: 'destroyed', target: { id: 'c10b-balloon-a' }, label: 'Pop the balloon under the cactus' },
      { kind: 'destroyed', target: { id: 'c10b-balloon-b' }, label: 'Pop the balloon in the bunker' },
      { kind: 'destroyed', target: { id: 'c10b-balloon-c' }, label: 'Pop the balloon on the high shelf' },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 4, absurdStages: 11 },
    hints: [
      'The left balloon only needs setting free. The cactus will do the rest.',
      'Explosions reach straight through brick, and a battery wired to dynamite is a detonator. Turn up the Bang for a bigger blast.',
      'No battery? A blast sets off any dynamite close by. Fire, boom, boom.',
    ],
    metadata: { chapter: 10, order: 2, author: 'Follyworks', blurb: 'Nobody invited the cactus.' },
  },
  solutions: [
    {
      // Remote control: snip the left tether, detonate one charge per balloon.
      objects: [
        o('s-candle', 'candle', 402, 1171),
        o('s-battery', 'battery', 2000, 1171),
        o('s-tnt-b', 'dynamite', 1250, 829, { fuse: 1.5, power: 5 }),
        o('s-tnt-c', 'dynamite', 1630, 737, { fuse: 1.5, power: 8 }),
      ],
      connections: [
        link('s-w1', 'wire', 's-battery', 'out', 's-tnt-b', 'in'),
        link('s-w2', 'wire', 's-battery', 'out', 's-tnt-c', 'in'),
      ],
    },
    {
      // One big bang: a maximum-strength charge on a plank between the bunker and the shelf.
      objects: [
        o('s-candle', 'candle', 402, 1171),
        o('s-battery', 'battery', 2000, 1171),
        o('s-shelf', 'plank', 1475, 790, { length: 80 }),
        o('s-tnt', 'dynamite', 1475, 772, { fuse: 1.5, power: 10 }),
      ],
      connections: [link('s-w1', 'wire', 's-battery', 'out', 's-tnt', 'in')],
    },
    {
      // No electricity: a candle lights the first charge, whose blast sets off the second.
      objects: [
        o('s-candle-a', 'candle', 402, 1171),
        o('s-candle-b', 'candle', 1200, 811),
        o('s-tnt-b', 'dynamite', 1200, 787, { fuse: 1.5, power: 10 }),
        o('s-shelf', 'plank', 1450, 716, { length: 80 }),
        o('s-tnt-c', 'dynamite', 1450, 698, { fuse: 1.5, power: 10 }),
      ],
      connections: [],
    },
    // ABSURD: the candle chain, plus a battery-fired rocket in the bunker whose exhaust burns through the tether.
    {
      objects: [
        o('s-candle-a', 'candle', 402, 1171),
        o('s-candle-b', 'candle', 1200, 811),
        o('s-tnt-b', 'dynamite', 1200, 787, { fuse: 1.5, power: 10 }),
        o('s-shelf', 'plank', 1450, 716, { length: 80 }),
        o('s-tnt-c', 'dynamite', 1450, 698, { fuse: 1.5, power: 10 }),
        o('s-battery', 'battery', 2000, 1171),
        o('s-rocket', 'rocket', 1240, 1110, { thrust: 2 }, -1.5708),
      ],
      connections: [link('s-w1', 'wire', 's-battery', 'out', 's-rocket', 'in')],
    },
  ],
};

export const CHAPTER_10: CampaignEntry[] = [socialClimber, partyPooper];
