// Mission group 1 — Workshop Basics. Things fall. Things hit things.
// Gravity, ramps, rolling, bouncing, dominoes, buckets, crates, and the eternal question of
// rubber ball versus bowling ball. Switches and pressure plates appear only as goal triggers.
// Pure level data; `solutions` and `counterexamples` are test fixtures (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
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
/** A fixed sloped board (scenery) running from (x1, y1) to (x2, y2). */
const slope = (id: string, x1: number, y1: number, x2: number, y2: number, material = 'wood', h = 14): ObjectDef =>
  o(id, 'wall', (x1 + x2) / 2, (y1 + y2) / 2, { w: Math.round(Math.hypot(x2 - x1, y2 - y1)), h, material }, Math.atan2(y2 - y1, x2 - x1));

const world = () => ({ ...STANDARD_WORLD });
const DEG = Math.PI / 180;
const meta = (order: number, blurb: string) => ({ chapter: 1, order, author: 'Follyworks', blurb });

// ---------------------------------------------------------------- 1: one ball hits another

const g1a: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-corner-pocket',
    name: 'Corner Pocket',
    description: 'Sink the red ball in the pocket at the end of the table. You may not touch it, but you may certainly hit it with something.',
    environment: 'garage',
    world: world(),
    fixedObjects: [
      slope('g1a-ramp', 150, 300, 386, 423),
      o('g1a-table', 'wall', 620, 440, { w: 480, h: 20, material: 'wood' }),
      o('g1a-leg', 'wall', 420, 535, { w: 20, h: 170, material: 'wood' }),
      o('g1a-pocket-wall', 'wall', 850, 535, { w: 12, h: 170, material: 'wood' }),
      o('g1a-cushion', 'wall', 1000, 520, { w: 20, h: 220, material: 'brick' }),
    ],
    startingObjects: [o('g1a-target', 'ball', 820, 416)],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g1a-target' },
        region: { x: 858, y: 520, w: 132, h: 110 },
        hold: 0.5,
        label: 'Sink the red ball in the pocket',
      },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 4, absurdStages: 3 },
    hints: [
      'A ball rolling along the table will happily pass its speed on to the red ball.',
      'Drop a ball onto the sloping board at the left so it arrives at the table already rolling.',
    ],
    metadata: meta(1, 'Cause, meet effect.'),
  },
  solutions: [
    { objects: [o('ball-a', 'ball', 200, 240)], connections: [] },
    { objects: [o('bowl-a', 'bowling_ball', 220, 200)], connections: [] },
    // ABSURD: bowling ball down the ramp bonks a parked ball, which knocks the target into the pocket.
    { objects: [o('bowl-a', 'bowling_ball', 220, 200), o('ball-a', 'ball', 700, 416)], connections: [] },
  ],
};

// ---------------------------------------------------------------- 2: heavy hits harder

const g1b: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-heavy-hitter',
    name: 'Heavy Hitter',
    description: 'Shove the crate off its pedestal and into the scrap bin. The last apprentice tried a rubber ball. Watch how that went.',
    environment: 'research',
    world: world(),
    fixedObjects: [
      slope('g1b-ramp', 110, 100, 480, 300, 'steel'),
      o('g1b-pedestal', 'wall', 600, 470, { w: 220, h: 320, material: 'concrete' }),
      o('g1b-bin-r', 'wall', 1010, 560, { w: 12, h: 140, material: 'steel' }),
    ],
    startingObjects: [o('g1b-crate', 'crate', 680, 288), o('g1b-dud', 'ball', 140, 100)],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g1b-crate' },
        region: { x: 716, y: 540, w: 286, h: 90 },
        hold: 0.5,
        label: 'Knock the crate into the scrap bin',
      },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 4, absurdStages: 4 },
    hints: [
      'A rubber ball weighs 1 kg and the crate weighs 3. Light things just bounce off heavy things.',
      'The cast-iron bowling ball weighs 10 kg. Send it down the same ramp.',
    ],
    metadata: meta(3, 'Heavier. Faster. Further.'),
  },
  solutions: [
    { objects: [o('bowl-a', 'bowling_ball', 250, 144)], connections: [] },
    // ABSURD: two more rubber balls and the bowling ball all go down the ramp in a queue.
    {
      objects: [o('bowl-a', 'bowling_ball', 330, 170), o('ball-a', 'ball', 250, 150), o('ball-b', 'ball', 450, 230)],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'only rubber balls are rolled at the crate', build: { objects: [o('ball-a', 'ball', 260, 170), o('ball-b', 'ball', 330, 190)], connections: [] } },
  ],
};


// ---------------------------------------------------------------- 3: trampolines

const g1c: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-bounce-house',
    name: 'Bounce House',
    description: 'The ball drops out of the pipe and lands with a sad little thud. Bounce it over the wall and up onto the high shelf.',
    environment: 'greenhouse',
    world: world(),
    fixedObjects: [
      o('g1c-pipe-l', 'wall', 134, 110, { w: 12, h: 140, material: 'steel' }),
      o('g1c-pipe-r', 'wall', 186, 110, { w: 12, h: 140, material: 'steel' }),
      o('g1c-wall', 'wall', 470, 470, { w: 30, h: 320, material: 'brick' }),
      o('g1c-shelf', 'wall', 880, 330, { w: 320, h: 20, material: 'wood' }),
      o('g1c-post', 'wall', 880, 485, { w: 24, h: 290, material: 'wood' }),
      o('g1c-backstop', 'wall', 1050, 260, { w: 20, h: 160, material: 'wood' }),
    ],
    startingObjects: [o('g1c-ball', 'ball', 160, 140)],
    connections: [],
    inventory: [
      { type: 'trampoline', count: 2 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g1c-ball' },
        region: { x: 725, y: 220, w: 315, h: 100 },
        hold: 0.5,
        label: 'Land the ball on the high shelf',
      },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 3, absurdStages: 3 },
    hints: [
      'Trampolines throw things away from their springy side. Tilt one to aim the bounce.',
      'Put a trampoline under the pipe and tilt it a little towards the shelf. If the ball falls short, turn up its Springiness.',
    ],
    metadata: meta(2, 'Boing. Boing. Shelf.'),
  },
  solutions: [
    { objects: [o('tramp-a', 'trampoline', 160, 600, { power: 2.4 }, 15 * DEG)], connections: [] },
    // ABSURD: the ball lands on the shelf and bowls over a rubber ball waiting there.
    { objects: [o('tramp-a', 'trampoline', 160, 600, { power: 2.4 }, 15 * DEG), o('ball-a', 'ball', 915, 306)], connections: [] },
  ],
};

// ---------------------------------------------------------------- 4: fill the bucket

const g1d: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-bucket-brigade',
    name: 'Bucket Brigade',
    description: 'Two rubber balls are loafing about on the high shelf. Get both of them down the chute and into the bucket.',
    environment: 'underground',
    world: world(),
    fixedObjects: [
      o('g1d-shelf', 'wall', 470, 300, { w: 340, h: 20, material: 'concrete' }),
      slope('g1d-chute', 645, 300, 812, 440, 'steel', 10),
      o('g1d-hopper-l', 'wall', 817, 500, { w: 8, h: 110, material: 'steel' }),
      o('g1d-hopper-r', 'wall', 863, 450, { w: 8, h: 210, material: 'steel' }),
    ],
    startingObjects: [o('g1d-ball-1', 'ball', 560, 276), o('g1d-ball-2', 'ball', 600, 276), o('g1d-bucket', 'bucket', 840, 608)],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'bowling_ball', count: 1 },
      { type: 'crate', count: 1 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g1d-bucket', count: 2, filter: { type: 'ball' }, label: 'Get both rubber balls into the bucket' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 5 },
    hints: [
      'Something rolling along the shelf will shove the balls off the end and down the chute.',
      'A bowling ball dropped straight onto the shelf just sits there. Give it a ramp so it arrives rolling.',
    ],
    metadata: meta(4, 'Two balls, one bucket, zero effort.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 230, 245, { length: 200 }, 20 * DEG), o('bowl-a', 'bowling_ball', 160, 185)], connections: [] },
    // ABSURD: no ramp at all. The bowling ball is bounced off a trampoline straight onto the shelf.
    { objects: [o('tramp-a', 'trampoline', 100, 480, { power: 1.8 }, 15 * DEG), o('bowl-a', 'bowling_ball', 100, 200)], connections: [] },
  ],
};

// ---------------------------------------------------------------- 5: dominoes climb stairs

const g1e: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-domino-stairs',
    name: 'Domino Stairs',
    description: 'Balls are hopeless at climbing stairs. Dominoes, on the other hand, fall up them beautifully. Flip the switch at the top.',
    environment: 'basement',
    world: world(),
    fixedObjects: [
      o('g1e-step-1', 'wall', 845, 618, { w: 450, h: 24, material: 'wood' }),
      o('g1e-step-2', 'wall', 860, 606, { w: 420, h: 48, material: 'wood' }),
      o('g1e-step-3', 'wall', 875, 594, { w: 390, h: 72, material: 'wood' }),
    ],
    startingObjects: [
      o('g1e-domino-1', 'domino', 596, 601),
      o('g1e-domino-2', 'domino', 627, 577),
      o('g1e-domino-3', 'domino', 657, 553),
      o('g1e-switch', 'toggle_switch', 712, 540),
    ],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
      { type: 'domino', count: 3 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g1e-switch' }, label: 'Flip the switch at the top of the stairs' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 6 },
    hints: [
      'Only the first domino needs a push. Each one falls onto the next, a little higher up.',
      'Roll a ball down a plank into the bottom domino.',
    ],
    metadata: meta(5, 'Gravity, but upstairs.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 400, 540, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 330, 480)], connections: [] },
    // ABSURD: a longer domino run on the floor leads up to the stairs.
    {
      objects: [
        o('plank-a', 'plank', 340, 540, { length: 200 }, 20 * DEG),
        o('ball-a', 'ball', 270, 480),
        o('dom-a', 'domino', 500, 601),
        o('dom-b', 'domino', 535, 601),
        o('dom-c', 'domino', 566, 601),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 6: crates bounce too

const g1f: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-crate-expectations',
    name: 'Crate Expectations',
    description: 'The last crate belongs up in the loft with the others, and nobody here owns a forklift. Get it up there anyway.',
    environment: 'maintenance',
    world: world(),
    fixedObjects: [
      o('g1f-shelf', 'wall', 360, 420, { w: 320, h: 20, material: 'steel' }),
      o('g1f-loft', 'wall', 910, 320, { w: 300, h: 20, material: 'wood' }),
      o('g1f-loft-post', 'wall', 1040, 475, { w: 24, h: 290, material: 'wood' }),
      o('g1f-backstop', 'wall', 1055, 220, { w: 16, h: 180, material: 'wood' }),
    ],
    startingObjects: [o('g1f-crate', 'crate', 506, 388), o('g1f-stored-1', 'crate', 1023, 288), o('g1f-stored-2', 'crate', 1023, 244)],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'trampoline', count: 2 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g1f-crate' }, region: { x: 765, y: 180, w: 280, h: 130 }, hold: 0.5, label: 'Get the crate up into the loft' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 5, absurdStages: 5 },
    hints: [
      'A trampoline does not care what lands on it. Crates bounce too.',
      'Shove the crate off the end of the shelf with a rolling bowling ball, onto a trampoline tilted a notch towards the loft.',
    ],
    metadata: meta(7, 'Up is just down with a trampoline.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 190, 330, { length: 300 }, 25 * DEG),
        o('bowl-a', 'bowling_ball', 90, 240),
        o('tramp-a', 'trampoline', 570, 600, { power: 2.4 }, 15 * DEG),
      ],
      connections: [],
    },
    // ABSURD: meanwhile, a sideshow: a ball boings off a second trampoline into another ball.
    {
      objects: [
        o('plank-a', 'plank', 190, 330, { length: 300 }, 25 * DEG),
        o('bowl-a', 'bowling_ball', 90, 240),
        o('tramp-a', 'trampoline', 570, 600, { power: 2.4 }, 15 * DEG),
        o('tramp-b', 'trampoline', 300, 602, { power: 1 }, -15 * DEG),
        o('ball-a', 'ball', 300, 450),
        o('ball-b', 'ball', 180, 616),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 7: through the slot

const g1g: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-mail-slot',
    name: 'Mail Slot',
    description: 'The lamp switch is inside a tunnel behind the mail slot. Post the rubber ball through the slot fast enough to flip the switch on its way past.',
    environment: 'garage',
    world: world(),
    fixedObjects: [
      o('g1g-wall', 'wall', 620, 317, { w: 20, h: 554, material: 'brick' }),
      o('g1g-tunnel', 'wall', 700, 587, { w: 180, h: 14, material: 'steel' }),
      o('g1g-lamp-shelf', 'wall', 900, 300, { w: 220, h: 14, material: 'wood' }),
    ],
    startingObjects: [
      o('g1g-ball', 'ball', 420, 616),
      o('g1g-switch', 'toggle_switch', 700, 622),
      o('g1g-battery', 'battery', 980, 264),
      o('g1g-bulb', 'light_bulb', 850, 264),
    ],
    connections: [
      wire('g1g-w1', 'g1g-battery', 'out', 'g1g-switch', 'in'),
      wire('g1g-w2', 'g1g-switch', 'out', 'g1g-bulb', 'in'),
    ],
    inventory: [
      { type: 'plank', count: 3 },
      { type: 'bowling_ball', count: 1 },
      { type: 'crate', count: 1 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g1g-bulb' }, label: 'Light the lamp' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 5 },
    hints: [
      'Only the rubber ball fits through the slot. Everything you own is too big.',
      'Knock the rubber ball towards the slot with something heavy that arrives rolling.',
    ],
    metadata: meta(6, 'Please do not bend.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 200, 540, { length: 240 }, 20 * DEG), o('bowl-a', 'bowling_ball', 120, 480)], connections: [] },
    // ABSURD: the bowling ball rams a crate, which shunts the rubber ball through the slot.
    {
      objects: [o('plank-a', 'plank', 200, 540, { length: 240 }, 20 * DEG), o('bowl-a', 'bowling_ball', 120, 480), o('crate-a', 'crate', 340, 608)],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'the bowling ball is rolled at the slot by itself', build: { objects: [o('plank-a', 'plank', 400, 540, { length: 240 }, 20 * DEG), o('bowl-a', 'bowling_ball', 320, 480)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 8: fill in the missing pieces

const g1h: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-mind-the-gaps',
    name: 'Mind the Gaps',
    description: 'Somebody built a lovely machine to hop the rubber ball over the fence, then lost three pieces of it. Find the gaps and fill them.',
    environment: 'research',
    world: world(),
    fixedObjects: [
      slope('g1h-ramp', 70, 130, 262, 236, 'steel'),
      o('g1h-shelf', 'wall', 500, 260, { w: 240, h: 20, material: 'wood' }),
      slope('g1h-drop', 618, 257, 680, 325, 'wood'),
      o('g1h-fence', 'wall', 970, 470, { w: 20, h: 320, material: 'brick' }),
    ],
    startingObjects: [
      o('g1h-bowl', 'bowling_ball', 100, 120),
      o('g1h-domino-1', 'domino', 470, 221),
      o('g1h-domino-2', 'domino', 500, 221),
      o('g1h-domino-3', 'domino', 590, 221),
      o('g1h-ball', 'ball', 616, 236),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'domino', count: 2 },
      { type: 'trampoline', count: 2 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g1h-ball' }, region: { x: 985, y: 300, w: 90, h: 330 }, hold: 0.5, label: 'Get the rubber ball over the fence' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 7, absurdStages: 7 },
    hints: [
      'Press RUN with nothing added and watch where the machine breaks down. Each break is a missing piece.',
      'The bowling ball needs a bridge, the domino row has a hole, and nothing sends the ball back up once it drops.',
    ],
    metadata: meta(8, 'Some assembly required.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 340, 243, { length: 140 }),
        o('dom-a', 'domino', 545, 221),
        o('tramp-a', 'trampoline', 810, 600, { power: 2.2 }),
      ],
      connections: [],
    },
    // ABSURD: an extra domino at the head of the row, and a spare ball waiting behind the fence.
    {
      objects: [
        o('plank-a', 'plank', 340, 243, { length: 140 }),
        o('dom-b', 'domino', 440, 221),
        o('dom-a', 'domino', 545, 221),
        o('tramp-a', 'trampoline', 810, 600, { power: 2.2 }),
        o('ball-a', 'ball', 1030, 616),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 9: two plates, both at once

const g1i: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-double-press',
    name: 'Double Press',
    description: 'The lamp is wired through two pressure plates, and each one wants a full 5 kilos sitting on it. You have nothing that heavy. The pipes do.',
    environment: 'underground',
    world: world(),
    fixedObjects: [
      o('g1i-pipe-l1', 'wall', 172, 105, { w: 10, h: 130, material: 'steel' }),
      o('g1i-pipe-l2', 'wall', 228, 105, { w: 10, h: 130, material: 'steel' }),
      o('g1i-pipe-r1', 'wall', 892, 105, { w: 10, h: 130, material: 'steel' }),
      o('g1i-pipe-r2', 'wall', 948, 105, { w: 10, h: 130, material: 'steel' }),
      o('g1i-pit-a', 'wall', 422, 600, { w: 10, h: 60, material: 'concrete' }),
      o('g1i-pillar', 'wall', 560, 540, { w: 84, h: 180, material: 'concrete' }),
      o('g1i-pit-b', 'wall', 698, 600, { w: 10, h: 60, material: 'concrete' }),
    ],
    startingObjects: [
      o('g1i-bowl-l', 'bowling_ball', 200, 120),
      o('g1i-bowl-r', 'bowling_ball', 920, 120),
      o('g1i-plate-a', 'pressure_plate', 472, 623, { minMass: 5 }),
      o('g1i-plate-b', 'pressure_plate', 648, 623, { minMass: 5 }),
      o('g1i-battery', 'battery', 560, 421),
      o('g1i-bulb', 'light_bulb', 560, 250),
    ],
    connections: [
      wire('g1i-w1', 'g1i-battery', 'out', 'g1i-plate-a', 'in'),
      wire('g1i-w2', 'g1i-plate-a', 'out', 'g1i-plate-b', 'in'),
      wire('g1i-w3', 'g1i-plate-b', 'out', 'g1i-bulb', 'in'),
    ],
    inventory: [
      { type: 'plank', count: 4 },
      { type: 'ball', count: 2 },
      { type: 'crate', count: 1 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g1i-bulb' }, duration: 1, label: 'Keep the lamp lit for a second' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 5 },
    hints: [
      'Power has to pass through BOTH plates, so both need something heavy sitting on them at the same time.',
      'Rubber balls and crates are too light. Steer each bowling ball out of its pipe and into a pit.',
    ],
    metadata: meta(9, 'Heavy is a feature.'),
  },
  solutions: [
    {
      objects: [o('plank-a', 'plank', 305, 320, { length: 280 }, 35 * DEG), o('plank-b', 'plank', 815, 320, { length: 280 }, -35 * DEG)],
      connections: [],
    },
    // ABSURD: while the bowling balls do the work, a rubber ball boings off a trampoline into a crate.
    {
      objects: [
        o('plank-a', 'plank', 305, 320, { length: 280 }, 35 * DEG),
        o('plank-b', 'plank', 815, 320, { length: 280 }, -35 * DEG),
        o('tramp-a', 'trampoline', 790, 590, { power: 1.6 }, 30 * DEG),
        o('ball-a', 'ball', 790, 450),
        o('crate-a', 'crate', 900, 608),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'rubber balls and a crate are dropped on the plates',
      build: { objects: [o('ball-a', 'ball', 470, 560), o('crate-a', 'crate', 650, 560), o('ball-b', 'ball', 650, 480)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 10: the grand finale

const g1j: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-up-and-away',
    name: 'Up, Up and Away',
    description: 'The lamp only lights when the bowling ball sits on the plate in the high pit. Nudge the ball off its shelf, get it past the crates, and up into the pit.',
    environment: 'maintenance',
    world: world(),
    fixedObjects: [
      o('g1j-shelf', 'wall', 190, 290, { w: 260, h: 20, material: 'concrete' }),
      slope('g1j-drop', 320, 287, 420, 380, 'steel'),
      o('g1j-high', 'wall', 940, 330, { w: 240, h: 20, material: 'concrete' }),
      o('g1j-high-post', 'wall', 1040, 480, { w: 20, h: 280, material: 'concrete' }),
      o('g1j-pit-l', 'wall', 902, 310, { w: 10, h: 20, material: 'steel' }),
      o('g1j-pit-r', 'wall', 995, 265, { w: 10, h: 110, material: 'steel' }),
      o('g1j-pit-roof', 'wall', 945, 216, { w: 110, h: 12, material: 'steel' }),
    ],
    startingObjects: [
      o('g1j-bowl', 'bowling_ball', 314, 260),
      o('g1j-crate-1', 'crate', 660, 608),
      o('g1j-crate-2', 'crate', 660, 564),
      o('g1j-plate', 'pressure_plate', 950, 313, { minMass: 5 }),
      o('g1j-battery', 'battery', 1000, 591),
      o('g1j-bulb', 'light_bulb', 760, 150),
    ],
    connections: [
      wire('g1j-w1', 'g1j-battery', 'out', 'g1j-plate', 'in'),
      wire('g1j-w2', 'g1j-plate', 'out', 'g1j-bulb', 'in'),
    ],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 3 },
      { type: 'trampoline', count: 2 },
      { type: 'domino', count: 3 },
      { type: 'crate', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g1j-bulb' }, duration: 1, label: 'Keep the lamp lit for a second' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 6, absurdStages: 7 },
    hints: [
      'The bowling ball only needs a nudge to roll off its shelf. Even a rubber ball can manage that.',
      'The crates block the floor, so the ball has to go up and over. Put a trampoline where it lands.',
      'Tilt the trampoline one notch towards the pit and turn its Springiness up until the ball sails in through the side.',
    ],
    metadata: meta(10, 'Everything you have learned, all at once.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 150, 220, { length: 160 }, 20 * DEG),
        o('ball-a', 'ball', 100, 180),
        o('tramp-a', 'trampoline', 565, 600, { power: 2.4 }, 15 * DEG),
      ],
      connections: [],
    },
    // ABSURD: the rubber ball sets off a row of dominoes, and the last one nudges the bowling ball.
    {
      objects: [
        o('plank-a', 'plank', 105, 225, { length: 160 }, 20 * DEG),
        o('ball-a', 'ball', 55, 180),
        o('dom-a', 'domino', 225, 251),
        o('dom-b', 'domino', 255, 251),
        o('dom-c', 'domino', 285, 251),
        o('tramp-a', 'trampoline', 555, 600, { power: 2.4 }, 15 * DEG),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'the trampoline is left at its default springiness',
      build: {
        objects: [o('plank-a', 'plank', 150, 220, { length: 160 }, 20 * DEG), o('ball-a', 'ball', 100, 180), o('tramp-a', 'trampoline', 565, 600, {}, 15 * DEG)],
        connections: [],
      },
    },
  ],
};

export const GROUP_1: CampaignEntry[] = [g1a, g1c, g1b, g1d, g1e, g1g, g1f, g1h, g1i, g1j];
