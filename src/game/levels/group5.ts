// Mission group 5: Ridiculous Machines. Timers, logic boxes, sensors, cannons, dynamite, the
// boxing glove and the whole goofy gang, built into the biggest, silliest chain reactions in the
// campaign. Each mission is a mostly-built contraption with a few gaps for the player.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };
const wire = (id: string, from: string, to: string, toPort = 'in', fromPort = 'out'): ConnectionDef => link(id, 'wire', from, fromPort, to, toPort);

const WORLD = () => ({ ...STANDARD_WORLD });
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- 5-1: punch on cue

const waitForIt: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-wait-for-it',
    name: 'Wait For It',
    description: 'Two mousetraps ride the conveyor under the drop pipe. Punch each basketball down the pipe just as a trap passes, and the traps will fling them into the hoop.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      // two tunnels on the left feed one drop pipe
      o('g5a-upper-shelf', 'wall', 390, 180, { w: 370, h: 20, material: 'wood' }),
      o('g5a-upper-roof', 'wall', 390, 122, { w: 370, h: 20, material: 'wood' }),
      o('g5a-lower-shelf', 'wall', 390, 310, { w: 370, h: 20, material: 'wood' }),
      o('g5a-lower-roof', 'wall', 390, 252, { w: 370, h: 20, material: 'wood' }),
      o('g5a-pipe-mid', 'wall', 579, 216, { w: 8, h: 92, material: 'steel' }),
      o('g5a-pipe-low', 'wall', 579, 365, { w: 8, h: 130, material: 'steel' }),
      o('g5a-pipe-right', 'wall', 625, 265, { w: 8, h: 330, material: 'steel' }),
      o('g5a-hoop', 'basketball_hoop', 994, 426, {}, 0, true),
      o('g5a-ramp', 'plank', 985, 525, { length: 180 }, 10 * DEG),
      o('g5a-bell', 'bell', 1094, 578),
    ],
    startingObjects: [
      o('g5a-battery', 'battery', 40, 601),
      o('g5a-conveyor-1', 'conveyor', 300, 617, { length: 400, speed: 30, dir: 'right' }),
      o('g5a-conveyor-2', 'conveyor', 700, 617, { length: 400, speed: 30, dir: 'right' }),
      o('g5a-trap-a', 'mousetrap', 330, 601, { fixed: false }),
      o('g5a-trap-b', 'mousetrap', 130, 601, { fixed: false }),
      o('g5a-ball-a', 'basketball', 320, 284),
      o('g5a-ball-b', 'basketball', 320, 154),
      o('g5a-bulb', 'light_bulb', 1060, 420),
    ],
    connections: [
      wire('g5a-w1', 'g5a-battery', 'g5a-conveyor-1'),
      wire('g5a-w2', 'g5a-battery', 'g5a-conveyor-2'),
      wire('g5a-w3', 'g5a-bell', 'g5a-bulb'),
    ],
    inventory: [
      { type: 'boxing_glove', count: 2 },
      { type: 'timer', count: 2 },
      { type: 'toggle_switch', count: 2 },
      { type: 'battery', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g5a-hoop', count: 2, filter: { type: 'basketball' }, label: 'Sink both basketballs' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 9, absurdStages: 15 },
    hints: [
      'A boxing glove punches its ball the moment power reaches it. Wired straight to a battery, both balls come down the pipe long before a trap passes.',
      'An unwired kitchen timer starts counting at RUN, then powers whatever it is wired to. Give each glove its own timer.',
      'Try about 3 seconds for the lower ball and about 6 for the upper one, then nudge the times while you watch where the traps are.',
    ],
    metadata: { chapter: 5, order: 1, author: 'Follyworks', blurb: 'Patience, measured in seconds.' },
  },
  solutions: [
    {
      objects: [
        o('s-glove-a', 'boxing_glove', 270, 284),
        o('s-glove-b', 'boxing_glove', 270, 154),
        o('s-timer-a', 'timer', 150, 450, { delay: 2.9, hold: 0 }),
        o('s-timer-b', 'timer', 230, 450, { delay: 5.8, hold: 0 }),
      ],
      connections: [wire('s-w1', 's-timer-a', 's-glove-a'), wire('s-w2', 's-timer-b', 's-glove-b')],
    },
    // ABSURD: each trap flicks its own switch on the way past, which starts that ball's timer.
    {
      objects: [
        o('s-glove-a', 'boxing_glove', 270, 284),
        o('s-glove-b', 'boxing_glove', 270, 154),
        o('s-battery', 'battery', 80, 450),
        o('s-switch-a', 'toggle_switch', 420, 590),
        o('s-switch-b', 'toggle_switch', 250, 590),
        o('s-timer-a', 'timer', 150, 450, { delay: 2.3, hold: 0 }),
        o('s-timer-b', 'timer', 230, 450, { delay: 4.7, hold: 0 }),
      ],
      connections: [
        wire('s-w1', 's-battery', 's-switch-a'),
        wire('s-w2', 's-battery', 's-switch-b'),
        wire('s-w3', 's-switch-a', 's-timer-a'),
        wire('s-w4', 's-switch-b', 's-timer-b'),
        wire('s-w5', 's-timer-a', 's-glove-a'),
        wire('s-w6', 's-timer-b', 's-glove-b'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'one timer punches both balls at once, so they land on the same trap',
      build: {
        objects: [o('s-glove-a', 'boxing_glove', 270, 284), o('s-glove-b', 'boxing_glove', 270, 154), o('s-timer-a', 'timer', 150, 450, { delay: 2.9, hold: 0 })],
        connections: [wire('s-w1', 's-timer-a', 's-glove-a'), wire('s-w2', 's-timer-a', 's-glove-b')],
      },
    },
    {
      why: 'the gloves are wired straight to a battery and punch before any trap arrives',
      build: {
        objects: [o('s-glove-a', 'boxing_glove', 270, 284), o('s-glove-b', 'boxing_glove', 270, 154), o('s-battery', 'battery', 80, 450)],
        connections: [wire('s-w1', 's-battery', 's-glove-a'), wire('s-w2', 's-battery', 's-glove-b')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-2: the alarm clock

const riseAndShine: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-rise-and-shine',
    name: 'Rise and Shine',
    description: 'Whiskers is asleep on the top shelf, right behind the basketball. Wake him so he shoves it down the pipe, then punch it into the hoop the moment it lands on the post below.',
    environment: 'basement',
    world: WORLD(),
    fixedObjects: [
      // the starter: a bowling ball, three dominoes and a bell wired to the toaster
      o('g5b-ramp', 'plank', 90, 95, { length: 120 }, 25 * DEG),
      o('g5b-start-shelf', 'wall', 260, 160, { w: 440, h: 20, material: 'wood' }),
      o('g5b-bell', 'bell', 310, 130),
      // Whiskers' tunnel, the drop pipe and the cradle under it
      o('g5b-shelf', 'wall', 850, 300, { w: 500, h: 20, material: 'wood' }),
      o('g5b-roof', 'wall', 860, 238, { w: 480, h: 20, material: 'wood' }),
      o('g5b-pipe-l', 'wall', 559, 335, { w: 8, h: 170, material: 'steel' }),
      o('g5b-pipe-r', 'wall', 604, 365, { w: 8, h: 110, material: 'steel' }),
      o('g5b-cradle', 'wall', 594, 595, { w: 20, h: 70, material: 'wood' }),
      o('g5b-hoop', 'basketball_hoop', 945, 486, {}, 0, true),
      o('g5b-score-bell', 'bell', 948, 594),
    ],
    startingObjects: [
      o('g5b-bowling', 'bowling_ball', 45, 52),
      o('g5b-domino-1', 'domino', 190, 121),
      o('g5b-domino-2', 'domino', 225, 121),
      o('g5b-domino-3', 'domino', 260, 121),
      o('g5b-toaster', 'toaster', 420, 112, { slices: 1, delay: 1, power: 720 }, 30 * DEG),
      o('g5b-cat', 'cat', 1040, 277, {}, 0, true),
      o('g5b-ball', 'basketball', 680, 274),
      o('g5b-bulb', 'light_bulb', 1060, 420),
    ],
    connections: [wire('g5b-w1', 'g5b-bell', 'g5b-toaster'), wire('g5b-w2', 'g5b-score-bell', 'g5b-bulb')],
    inventory: [
      { type: 'rubber_chicken', count: 1 },
      { type: 'pressure_plate', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'boxing_glove', count: 1 },
      { type: 'timer', count: 1 },
      { type: 'light_bulb', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g5b-hoop', count: 1, filter: { type: 'basketball' }, label: 'Sink the basketball' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 9, absurdStages: 17 },
    hints: [
      'Whiskers sleeps through the toaster’s DING: it is too far away. A rubber chicken squawks when something lands on it, and that he will hear.',
      'The basketball drops down the pipe onto the little post below it. A pressure plate there can tell your glove exactly when to punch.',
      'Put the chicken on the tunnel roof where the toast comes down. Then a plate on the post, a battery into the plate, the plate into a glove tilted up and to the right just below it.',
    ],
    metadata: { chapter: 5, order: 2, author: 'Follyworks', blurb: 'The world’s least efficient alarm clock.' },
  },
  solutions: [
    {
      objects: [
        o('s-chicken', 'rubber_chicken', 830, 219),
        o('s-glove', 'boxing_glove', 541, 590, {}, -60 * DEG),
        o('s-plate', 'pressure_plate', 584, 553, { minMass: 1 }),
        o('s-battery', 'battery', 400, 601),
      ],
      connections: [wire('s-w1', 's-battery', 's-plate'), wire('s-w2', 's-plate', 's-glove')],
    },
    // ABSURD: the plate lights a bulb as well as firing the glove, and a kitchen timer chimes in at RUN for no reason at all.
    {
      objects: [
        o('s-chicken', 'rubber_chicken', 830, 219),
        o('s-glove', 'boxing_glove', 541, 590, {}, -60 * DEG),
        o('s-plate', 'pressure_plate', 584, 553, { minMass: 1 }),
        o('s-battery', 'battery', 400, 601),
        o('s-timer', 'timer', 450, 480, { delay: 1, hold: 0 }),
        o('s-bulb', 'light_bulb', 380, 480),
      ],
      connections: [wire('s-w1', 's-battery', 's-plate'), wire('s-w2', 's-plate', 's-glove'), wire('s-w3', 's-plate', 's-bulb')],
    },
  ],
  counterexamples: [
    {
      why: 'the glove is wired straight to the battery and punches the empty cradle',
      build: {
        objects: [o('s-chicken', 'rubber_chicken', 830, 219), o('s-glove', 'boxing_glove', 541, 590, {}, -60 * DEG), o('s-battery', 'battery', 400, 601)],
        connections: [wire('s-w1', 's-battery', 's-glove')],
      },
    },
    {
      why: 'nobody wakes Whiskers, so the basketball never moves',
      build: {
        objects: [o('s-glove', 'boxing_glove', 541, 590, {}, -60 * DEG), o('s-plate', 'pressure_plate', 584, 553, { minMass: 1 }), o('s-battery', 'battery', 400, 601)],
        connections: [wire('s-w1', 's-battery', 's-plate'), wire('s-w2', 's-plate', 's-glove')],
      },
    },
    {
      why: 'the glove punches the basketball along the shelf at RUN instead of waiting for it at the cradle',
      build: {
        objects: [o('s-glove', 'boxing_glove', 920, 269, {}, 0, true), o('s-battery', 'battery', 400, 601)],
        connections: [wire('s-w1', 's-battery', 's-glove')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-3: the boom relay

const surpriseParty: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-surprise-party',
    name: 'Surprise Party',
    description: 'The bowling ball nudges the dynamite onto the candle and the party starts with a BANG. Carry the boom across to the balloons in the far corner, and keep the flying bowling ball out of the punch bowl so it can bowl a strike.',
    environment: 'greenhouse',
    world: WORLD(),
    fixedObjects: [
      o('g5c-ramp', 'plank', 90, 95, { length: 120 }, 25 * DEG),
      o('g5c-start-shelf', 'wall', 300, 160, { w: 520, h: 20, material: 'wood' }),
      o('g5c-candle', 'candle', 580, 250),
      o('g5c-table', 'wall', 650, 420, { w: 130, h: 16, material: 'wood' }),
      o('g5c-den', 'wall', 460, 550, { w: 16, h: 160, material: 'brick' }),
      o('g5c-bowl-l', 'wall', 760, 600, { w: 12, h: 60, material: 'steel' }),
      o('g5c-bowl-r', 'wall', 940, 600, { w: 12, h: 60, material: 'steel' }),
    ],
    startingObjects: [
      o('g5c-bowling', 'bowling_ball', 45, 52),
      o('g5c-tnt-a', 'dynamite', 548, 139, { power: 6, fuse: 1.5 }),
      o('g5c-boulder', 'bowling_ball', 695, 392),
      o('g5c-balloon-a', 'balloon', 540, 191, { color: 'red' }),
      o('g5c-balloon-b', 'balloon', 60, 191, { color: 'yellow' }),
      o('g5c-balloon-c', 'balloon', 120, 191, { color: 'teal' }),
      o('g5c-balloon-d', 'balloon', 180, 191, { color: 'red' }),
      o('g5c-cat', 'cat', 330, 616),
      o('g5c-pin-1', 'bowling_pin', 1000, 602),
      o('g5c-pin-2', 'bowling_pin', 1040, 602),
      o('g5c-pin-3', 'bowling_pin', 1080, 602),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'dynamite', count: 2 },
      { type: 'rubber_chicken', count: 1 },
    ],
    goals: [
      { kind: 'destroyed', target: { type: 'balloon' }, label: 'Pop every balloon' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3 },
      { kind: 'activate', target: { id: 'g5c-cat' }, label: 'SURPRISE, Whiskers!' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 9, absurdStages: 21 },
    hints: [
      'A blast sets off any dynamite close enough to it, and turning up a stick’s Bang makes its blast reach further.',
      'One stick can’t carry the boom all the way to the corner. Put one on the floor just left of the table, and a second on a plank shelf halfway to the balloons.',
      'The flying bowling ball lands right in the punch bowl. A plank above the bowl, tilted down to the right, sends it on to the pins.',
    ],
    metadata: { chapter: 5, order: 3, author: 'Follyworks', blurb: 'Everybody hide! No, really: take cover.' },
  },
  solutions: [
    {
      objects: [
        o('s-deflector', 'plank', 840, 520, { length: 160 }, 20 * DEG),
        o('s-tnt-1', 'dynamite', 530, 619, { power: 10, fuse: 1.5 }),
        o('s-shelf', 'plank', 295, 423, { length: 100 }),
        o('s-tnt-2', 'dynamite', 295, 405, { power: 10, fuse: 1.5 }),
      ],
      connections: [],
    },
    // ABSURD: a rubber chicken in the blast zone, SQUAWKing its little heart out.
    {
      objects: [
        o('s-deflector', 'plank', 840, 520, { length: 160 }, 20 * DEG),
        o('s-tnt-1', 'dynamite', 530, 619, { power: 10, fuse: 1.5 }),
        o('s-shelf', 'plank', 295, 423, { length: 100 }),
        o('s-tnt-2', 'dynamite', 295, 405, { power: 10, fuse: 1.5 }),
        o('s-chicken', 'rubber_chicken', 400, 621),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'without a deflector the bowling ball lands in the punch bowl and the pins stay up',
      build: {
        objects: [
          o('s-tnt-1', 'dynamite', 530, 619, { power: 10, fuse: 1.5 }),
          o('s-shelf', 'plank', 295, 423, { length: 100 }),
          o('s-tnt-2', 'dynamite', 295, 405, { power: 10, fuse: 1.5 }),
        ],
        connections: [],
      },
    },
    {
      why: 'a single stick, even at full Bang, cannot carry the blast to the far balloons',
      build: {
        objects: [
          o('s-deflector', 'plank', 840, 520, { length: 160 }, 20 * DEG),
          o('s-shelf', 'plank', 390, 345, { length: 100 }),
          o('s-tnt-2', 'dynamite', 390, 327, { power: 10, fuse: 1.5 }),
        ],
        connections: [],
      },
    },
    {
      why: 'two sticks on the floor are too far from the balloons under the shelf',
      build: {
        objects: [
          o('s-deflector', 'plank', 840, 520, { length: 160 }, 20 * DEG),
          o('s-tnt-1', 'dynamite', 530, 619, { power: 10, fuse: 1.5 }),
          o('s-tnt-2', 'dynamite', 230, 619, { power: 10, fuse: 1.5 }),
        ],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-4: a sensor that remembers

const latchOn: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-latch-on',
    name: 'Latch On',
    description: 'When the bell rings, both conveyors must start rolling and keep rolling, but the bell only rings for a moment. Make it stick, then drop each basketball onto its own trap.',
    environment: 'underground',
    world: WORLD(),
    fixedObjects: [
      // the starter on the top right: a bowling ball, a gap in the shelf, three dominoes and a bell
      o('g5d-ramp', 'plank', 1030, 95, { length: 120 }, -25 * DEG),
      o('g5d-shelf-r', 'wall', 995, 160, { w: 170, h: 20, material: 'wood' }),
      o('g5d-shelf-l', 'wall', 745, 160, { w: 210, h: 20, material: 'wood' }),
      o('g5d-bell', 'bell', 680, 130),
      // two tunnels feed one drop pipe
      o('g5d-upper-shelf', 'wall', 390, 180, { w: 370, h: 20, material: 'wood' }),
      o('g5d-upper-roof', 'wall', 390, 122, { w: 370, h: 20, material: 'wood' }),
      o('g5d-lower-shelf', 'wall', 390, 310, { w: 370, h: 20, material: 'wood' }),
      o('g5d-lower-roof', 'wall', 390, 252, { w: 370, h: 20, material: 'wood' }),
      o('g5d-pipe-mid', 'wall', 579, 216, { w: 8, h: 92, material: 'steel' }),
      o('g5d-pipe-low', 'wall', 579, 365, { w: 8, h: 130, material: 'steel' }),
      o('g5d-pipe-right', 'wall', 625, 265, { w: 8, h: 330, material: 'steel' }),
      o('g5d-hoop', 'basketball_hoop', 994, 426, {}, 0, true),
      o('g5d-hoop-ramp', 'plank', 985, 525, { length: 180 }, 10 * DEG),
      o('g5d-score-bell', 'bell', 1094, 578),
    ],
    startingObjects: [
      o('g5d-bowling', 'bowling_ball', 1075, 52),
      o('g5d-domino-1', 'domino', 800, 121),
      o('g5d-domino-2', 'domino', 765, 121),
      o('g5d-domino-3', 'domino', 730, 121),
      o('g5d-conveyor-1', 'conveyor', 300, 617, { length: 400, speed: 30, dir: 'right' }),
      o('g5d-conveyor-2', 'conveyor', 700, 617, { length: 400, speed: 30, dir: 'right' }),
      o('g5d-trap-a', 'mousetrap', 500, 601, { fixed: false }),
      o('g5d-trap-b', 'mousetrap', 360, 601, { fixed: false }),
      o('g5d-ball-a', 'basketball', 320, 284),
      o('g5d-ball-b', 'basketball', 320, 154),
      o('g5d-bulb', 'light_bulb', 1060, 420),
    ],
    connections: [wire('g5d-w1', 'g5d-score-bell', 'g5d-bulb')],
    inventory: [
      { type: 'plank', count: 1 },
      { type: 'logic_gate', count: 1 },
      { type: 'toggle_switch', count: 1 },
      { type: 'boxing_glove', count: 2 },
      { type: 'light_bulb', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g5d-hoop', count: 2, filter: { type: 'basketball' }, label: 'Sink both basketballs' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 12, absurdStages: 20 },
    hints: [
      'Bridge the gap in the top shelf so the bowling ball reaches the dominoes and the bell.',
      'A logic box set to TOGGLE flips on at the first pulse and stays on. Bell into the TOGGLE, TOGGLE into both conveyors.',
      'Punch the lower ball on the bell. For the upper one, let the first trap flick a toggle switch on its way past (power it from the TOGGLE) and wire the switch to the second glove.',
    ],
    metadata: { chapter: 5, order: 4, author: 'Follyworks', blurb: 'A sensor with a memory.' },
  },
  solutions: [
    {
      objects: [
        o('s-bridge', 'plank', 880, 157, { length: 56 }),
        o('s-latch', 'logic_gate', 760, 400, { mode: 'toggle' }),
        o('s-glove-a', 'boxing_glove', 270, 284),
        o('s-glove-b', 'boxing_glove', 270, 154),
        o('s-switch', 'toggle_switch', 645, 580),
      ],
      connections: [
        wire('s-w1', 'g5d-bell', 's-latch', 'a'),
        wire('s-w2', 's-latch', 'g5d-conveyor-1'),
        wire('s-w3', 's-latch', 'g5d-conveyor-2'),
        wire('s-w4', 'g5d-bell', 's-glove-a'),
        wire('s-w5', 's-latch', 's-switch'),
        wire('s-w6', 's-switch', 's-glove-b'),
      ],
    },
    // ABSURD: the switch also lights a lamp in the control room, just so everyone knows.
    {
      objects: [
        o('s-bridge', 'plank', 880, 157, { length: 56 }),
        o('s-latch', 'logic_gate', 760, 400, { mode: 'toggle' }),
        o('s-glove-a', 'boxing_glove', 270, 284),
        o('s-glove-b', 'boxing_glove', 270, 154),
        o('s-switch', 'toggle_switch', 645, 580),
        o('s-lamp', 'light_bulb', 840, 400),
      ],
      connections: [
        wire('s-w1', 'g5d-bell', 's-latch', 'a'),
        wire('s-w2', 's-latch', 'g5d-conveyor-1'),
        wire('s-w3', 's-latch', 'g5d-conveyor-2'),
        wire('s-w4', 'g5d-bell', 's-glove-a'),
        wire('s-w5', 's-latch', 's-switch'),
        wire('s-w6', 's-switch', 's-glove-b'),
        wire('s-w7', 's-switch', 's-lamp'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'the bell only rings for a moment, so the conveyors barely twitch',
      build: {
        objects: [
          o('s-bridge', 'plank', 880, 157, { length: 56 }),
          o('s-glove-a', 'boxing_glove', 270, 284),
          o('s-glove-b', 'boxing_glove', 270, 154),
          o('s-switch', 'toggle_switch', 645, 580),
        ],
        connections: [
          wire('s-w2', 'g5d-bell', 'g5d-conveyor-1'),
          wire('s-w3', 'g5d-bell', 'g5d-conveyor-2'),
          wire('s-w4', 'g5d-bell', 's-glove-a'),
          wire('s-w5', 'g5d-bell', 's-switch'),
          wire('s-w6', 's-switch', 's-glove-b'),
        ],
      },
    },
    {
      why: 'a NOT box powers the conveyors from the start, so the traps are long gone when the first ball drops',
      build: {
        objects: [
          o('s-bridge', 'plank', 880, 157, { length: 56 }),
          o('s-latch', 'logic_gate', 760, 400, { mode: 'not' }),
          o('s-glove-a', 'boxing_glove', 270, 284),
          o('s-glove-b', 'boxing_glove', 270, 154),
          o('s-switch', 'toggle_switch', 645, 580),
        ],
        connections: [
          wire('s-w2', 's-latch', 'g5d-conveyor-1'),
          wire('s-w3', 's-latch', 'g5d-conveyor-2'),
          wire('s-w4', 'g5d-bell', 's-glove-a'),
          wire('s-w5', 's-latch', 's-switch'),
          wire('s-w6', 's-switch', 's-glove-b'),
        ],
      },
    },
    {
      why: 'the second glove waits for the score bell, but by then its trap has rolled past the pipe',
      build: {
        objects: [
          o('s-bridge', 'plank', 880, 157, { length: 56 }),
          o('s-latch', 'logic_gate', 760, 400, { mode: 'toggle' }),
          o('s-glove-a', 'boxing_glove', 270, 284),
          o('s-glove-b', 'boxing_glove', 270, 154),
        ],
        connections: [
          wire('s-w1', 'g5d-bell', 's-latch', 'a'),
          wire('s-w2', 's-latch', 'g5d-conveyor-1'),
          wire('s-w3', 's-latch', 'g5d-conveyor-2'),
          wire('s-w4', 'g5d-bell', 's-glove-a'),
          wire('s-w6', 'g5d-score-bell', 's-glove-b'),
        ],
      },
    },
    {
      why: 'both gloves punch on the bell, so both balls land on the first trap',
      build: {
        objects: [
          o('s-bridge', 'plank', 880, 157, { length: 56 }),
          o('s-latch', 'logic_gate', 760, 400, { mode: 'toggle' }),
          o('s-glove-a', 'boxing_glove', 270, 284),
          o('s-glove-b', 'boxing_glove', 270, 154),
        ],
        connections: [
          wire('s-w1', 'g5d-bell', 's-latch', 'a'),
          wire('s-w2', 's-latch', 'g5d-conveyor-1'),
          wire('s-w3', 's-latch', 'g5d-conveyor-2'),
          wire('s-w4', 'g5d-bell', 's-glove-a'),
          wire('s-w6', 'g5d-bell', 's-glove-b'),
        ],
      },
    },
    {
      why: 'without the bridge the bowling ball drops through the gap and the bell never rings',
      build: {
        objects: [
          o('s-latch', 'logic_gate', 760, 400, { mode: 'toggle' }),
          o('s-glove-a', 'boxing_glove', 270, 284),
          o('s-glove-b', 'boxing_glove', 270, 154),
          o('s-switch', 'toggle_switch', 645, 580),
        ],
        connections: [
          wire('s-w1', 'g5d-bell', 's-latch', 'a'),
          wire('s-w2', 's-latch', 'g5d-conveyor-1'),
          wire('s-w3', 's-latch', 'g5d-conveyor-2'),
          wire('s-w4', 'g5d-bell', 's-glove-a'),
          wire('s-w5', 's-latch', 's-switch'),
          wire('s-w6', 's-switch', 's-glove-b'),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-5: the shooting gallery

const duckShoot: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-duck-shoot',
    name: 'Duck Shoot',
    description: 'Once the bell starts the conveyors, two rubber chickens ride out of their coops. Bop each one with a cannonball as it goes by, and the racket will send Whiskers running for the prize bell.',
    environment: 'garage',
    world: WORLD(),
    fixedObjects: [
      o('g5e-start-shelf', 'wall', 260, 160, { w: 440, h: 20, material: 'wood' }),
      o('g5e-bell', 'bell', 310, 130),
      o('g5e-latch', 'logic_gate', 420, 250, { mode: 'toggle' }),
      // lane A: a coop on the left, chickens ride right
      o('g5e-coop-a-roof', 'wall', 240, 380, { w: 130, h: 12, material: 'wood' }),
      o('g5e-coop-a-back', 'wall', 181, 405, { w: 12, h: 50, material: 'wood' }),
      o('g5e-coop-a-door', 'wall', 299, 400, { w: 12, h: 32, material: 'wood' }),
      o('g5e-stop-a', 'wall', 692, 420, { w: 12, h: 60, material: 'wood' }),
      // lane B: a coop on the right, chickens ride left
      o('g5e-coop-b-roof', 'wall', 960, 180, { w: 130, h: 12, material: 'wood' }),
      o('g5e-coop-b-back', 'wall', 1019, 205, { w: 12, h: 50, material: 'wood' }),
      o('g5e-coop-b-door', 'wall', 901, 200, { w: 12, h: 32, material: 'wood' }),
      o('g5e-stop-b', 'wall', 568, 220, { w: 12, h: 60, material: 'wood' }),
      o('g5e-prize-bell', 'bell', 1094, 594),
    ],
    startingObjects: [
      o('g5e-bowling', 'bowling_ball', 80, 130),
      o('g5e-domino-1', 'domino', 190, 121),
      o('g5e-domino-2', 'domino', 225, 121),
      o('g5e-domino-3', 'domino', 260, 121),
      o('g5e-lane-a', 'conveyor', 435, 450, { length: 500, speed: 30, dir: 'right' }),
      o('g5e-lane-b', 'conveyor', 795, 250, { length: 450, speed: 30, dir: 'left' }),
      o('g5e-chicken-a', 'rubber_chicken', 240, 430),
      o('g5e-chicken-b', 'rubber_chicken', 960, 230),
      o('g5e-cat', 'cat', 600, 612),
      o('g5e-bulb', 'light_bulb', 1060, 420),
    ],
    connections: [
      wire('g5e-w1', 'g5e-bell', 'g5e-latch', 'a'),
      wire('g5e-w2', 'g5e-latch', 'g5e-lane-a'),
      wire('g5e-w3', 'g5e-latch', 'g5e-lane-b'),
      wire('g5e-w4', 'g5e-prize-bell', 'g5e-bulb'),
    ],
    inventory: [
      { type: 'boxing_glove', count: 1 },
      { type: 'cannon', count: 3 },
      { type: 'toggle_switch', count: 2 },
      { type: 'battery', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g5e-chicken-a' }, label: 'Squawk the bottom chicken' },
      { kind: 'activate', target: { id: 'g5e-chicken-b' }, label: 'Squawk the top chicken' },
      { kind: 'activate', target: { id: 'g5e-bulb' }, label: 'Light the WINNER lamp' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 12, absurdStages: 23 },
    hints: [
      'Start with a hard punch (about 1200) to the bowling ball, so the dominoes reach the bell. Cannons can hang anywhere: point one straight down over each conveyor.',
      'A toggle switch makes a fine tripwire. Put one where a chicken rides through it and wire battery → switch → cannon. Flip the top lane’s switch: that chicken rides left.',
      'Nudge each switch along until its shot lands: while the ball falls, the chicken rides on about 15 px, so trip the cannon just before the chicken is underneath.',
    ],
    metadata: { chapter: 5, order: 5, author: 'Follyworks', blurb: 'Step right up! Everybody’s a winner.' },
  },
  solutions: [
    {
      objects: [
        o('s-glove', 'boxing_glove', 40, 132, { power: 1200 }),
        o('s-battery', 'battery', 600, 330),
        o('s-cannon-a', 'cannon', 480, 300, { power: 300, shots: 1 }, 90 * DEG),
        o('s-switch-a', 'toggle_switch', 516, 410),
        o('s-cannon-b', 'cannon', 720, 100, { power: 300, shots: 1 }, 90 * DEG),
        o('s-switch-b', 'toggle_switch', 688, 210, {}, 0, true),
      ],
      connections: [
        wire('s-w0', 's-battery', 's-glove'),
        wire('s-w1', 's-battery', 's-switch-a'),
        wire('s-w2', 's-switch-a', 's-cannon-a'),
        wire('s-w3', 's-battery', 's-switch-b'),
        wire('s-w4', 's-switch-b', 's-cannon-b'),
      ],
    },
    // ABSURD: a third cannon on the lower tripwire, firing three rounds at the prize bell for good measure.
    {
      objects: [
        o('s-glove', 'boxing_glove', 40, 132, { power: 1200 }),
        o('s-battery', 'battery', 600, 330),
        o('s-cannon-a', 'cannon', 480, 300, { power: 300, shots: 1 }, 90 * DEG),
        o('s-switch-a', 'toggle_switch', 516, 410),
        o('s-cannon-b', 'cannon', 720, 100, { power: 300, shots: 1 }, 90 * DEG),
        o('s-switch-b', 'toggle_switch', 688, 210, {}, 0, true),
        o('s-cannon-c', 'cannon', 900, 500, { power: 300, shots: 3 }, 0),
      ],
      connections: [
        wire('s-w0', 's-battery', 's-glove'),
        wire('s-w1', 's-battery', 's-switch-a'),
        wire('s-w2', 's-switch-a', 's-cannon-a'),
        wire('s-w3', 's-battery', 's-switch-b'),
        wire('s-w4', 's-switch-b', 's-cannon-b'),
        wire('s-w5', 's-switch-a', 's-cannon-c'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'cannons fired at RUN hit the coop roofs: the chickens are still inside',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 40, 132, { power: 1200 }),
          o('s-battery', 'battery', 600, 330),
          o('s-cannon-a', 'cannon', 240, 300, { power: 300, shots: 1 }, 90 * DEG),
          o('s-cannon-b', 'cannon', 960, 100, { power: 300, shots: 1 }, 90 * DEG),
        ],
        connections: [wire('s-w1', 's-battery', 's-cannon-a'), wire('s-w2', 's-battery', 's-cannon-b')],
      },
    },
    {
      why: 'a cannonball is too fat to fit through the coop door',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 40, 132, { power: 1200 }),
          o('s-battery', 'battery', 600, 330),
          o('s-cannon-a', 'cannon', 400, 428, { power: 600, shots: 1 }, 0, true),
        ],
        connections: [wire('s-w1', 's-battery', 's-cannon-a')],
      },
    },
    {
      why: 'nobody gives the bowling ball a shove, so the bell never rings and the conveyors never start',
      build: {
        objects: [
          o('s-battery', 'battery', 600, 330),
          o('s-cannon-a', 'cannon', 480, 300, { power: 300, shots: 1 }, 90 * DEG),
          o('s-switch-a', 'toggle_switch', 516, 410),
          o('s-cannon-b', 'cannon', 720, 100, { power: 300, shots: 1 }, 90 * DEG),
          o('s-switch-b', 'toggle_switch', 688, 210, {}, 0, true),
        ],
        connections: [
          wire('s-w1', 's-battery', 's-switch-a'),
          wire('s-w2', 's-switch-a', 's-cannon-a'),
          wire('s-w3', 's-battery', 's-switch-b'),
          wire('s-w4', 's-switch-b', 's-cannon-b'),
        ],
      },
    },
    {
      why: 'an unflipped switch only turns ON for things moving right, and the top chicken rides left',
      build: {
        objects: [
        o('s-glove', 'boxing_glove', 40, 132, { power: 1200 }),
        o('s-battery', 'battery', 600, 330),
        o('s-cannon-a', 'cannon', 480, 300, { power: 300, shots: 1 }, 90 * DEG),
        o('s-switch-a', 'toggle_switch', 516, 410),
        o('s-cannon-b', 'cannon', 720, 100, { power: 300, shots: 1 }, 90 * DEG),
        o('s-switch-b', 'toggle_switch', 688, 210),
        ],
        connections: [
        wire('s-w0', 's-battery', 's-glove'),
        wire('s-w1', 's-battery', 's-switch-a'),
        wire('s-w2', 's-switch-a', 's-cannon-a'),
        wire('s-w3', 's-battery', 's-switch-b'),
        wire('s-w4', 's-switch-b', 's-cannon-b'),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-6: both keys at once

const twoKeys: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-two-key-lock',
    name: 'Two-Key Lock',
    description: 'The vault cannon fires only while BOTH pressure plates are held down. Land the bowling ball on the left plate and the basketball on the right one, and the cannon sinks the shot.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g5f-ledge', 'wall', 80, 77, { w: 60, h: 14, material: 'wood' }),
      o('g5f-ramp', 'plank', 164, 105, { length: 120 }, 25 * DEG),
      o('g5f-shelf-l', 'wall', 245, 160, { w: 90, h: 20, material: 'wood' }),
      o('g5f-shelf-r', 'wall', 470, 240, { w: 100, h: 20, material: 'wood' }),
      o('g5f-chute', 'plank', 310, 320, { length: 220 }, -25 * DEG),
      o('g5f-toaster-stand', 'wall', 520, 150, { w: 60, h: 20, material: 'wood' }),
      o('g5f-tunnel-shelf', 'wall', 900, 300, { w: 400, h: 20, material: 'wood' }),
      o('g5f-tunnel-roof', 'wall', 910, 238, { w: 380, h: 20, material: 'wood' }),
      o('g5f-pipe-l', 'wall', 659, 335, { w: 8, h: 170, material: 'steel' }),
      o('g5f-pipe-r', 'wall', 704, 365, { w: 8, h: 110, material: 'steel' }),
      o('g5f-back-l', 'wall', 282, 525, { w: 12, h: 210, material: 'wood' }),
      o('g5f-lip-l', 'wall', 378, 600, { w: 12, h: 60, material: 'wood' }),
      o('g5f-plate-l', 'pressure_plate', 330, 622, { minMass: 2.5 }),
      o('g5f-back-r', 'wall', 858, 535, { w: 12, h: 190, material: 'wood' }),
      o('g5f-lip-r', 'wall', 762, 600, { w: 12, h: 60, material: 'wood' }),
      o('g5f-plate-r', 'pressure_plate', 810, 622, { minMass: 1 }),
      o('g5f-battery', 'battery', 560, 380),
      o('g5f-and', 'logic_gate', 560, 450, { mode: 'and' }),
      o('g5f-cannon', 'cannon', 1075, 600, { power: 535, shots: 1 }, 65 * DEG, true),
      o('g5f-hoop', 'basketball_hoop', 920, 480),
      o('g5f-bell', 'bell', 915, 594),
    ],
    startingObjects: [
      o('g5f-bowling', 'bowling_ball', 80, 50),
      o('g5f-toaster', 'toaster', 520, 110, { slices: 1, delay: 1, power: 720 }, 30 * DEG),
      o('g5f-cat', 'cat', 1060, 277, {}, 0, true),
      o('g5f-ball', 'basketball', 780, 274),
      o('g5f-lamp', 'light_bulb', 620, 450),
      o('g5f-bulb', 'light_bulb', 1080, 420),
    ],
    connections: [
      wire('g5f-w1', 'g5f-battery', 'g5f-plate-l'),
      wire('g5f-w2', 'g5f-battery', 'g5f-plate-r'),
      wire('g5f-w3', 'g5f-plate-l', 'g5f-and', 'a'),
      wire('g5f-w4', 'g5f-plate-r', 'g5f-and', 'b'),
      wire('g5f-w5', 'g5f-and', 'g5f-cannon'),
      wire('g5f-w6', 'g5f-and', 'g5f-lamp'),
      wire('g5f-w7', 'g5f-bell', 'g5f-bulb'),
    ],
    inventory: [
      { type: 'boxing_glove', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'battery', count: 1 },
      { type: 'rubber_chicken', count: 1 },
      { type: 'timer', count: 1 },
      { type: 'light_bulb', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g5f-hoop', count: 1, filter: { type: 'cannonball' }, label: 'Swish a cannonball' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 12, absurdStages: 16 },
    hints: [
      'Both plates feed the AND box, and the AND box fires the cannon. A plate only counts while something heavy sits on it.',
      'Punch the bowling ball off its ledge, give it a ramp across the gap, then catch it as it flies off the lower shelf with a plank tilted down to the left.',
      'Power the toaster. Its toast lands on the tunnel roof, where a rubber chicken will wake Whiskers to shove the basketball down the pipe. A plank under the pipe, tilted down to the right, rolls it onto the right plate.',
    ],
    metadata: { chapter: 5, order: 6, author: 'Follyworks', blurb: 'Two keys, one lock, zero patience.' },
  },
  solutions: [
    {
      objects: [
        o('s-glove', 'boxing_glove', 38, 50),
        o('s-bridge', 'plank', 360, 190, { length: 140 }, 25 * DEG),
        o('s-battery', 'battery', 600, 200),
        o('s-chicken', 'rubber_chicken', 935, 219),
        o('s-deflect-l', 'plank', 520, 360, { length: 200 }, -25 * DEG),
        o('s-deflect-r', 'plank', 720, 500, { length: 140 }, 25 * DEG),
      ],
      connections: [wire('s-w1', 's-battery', 'g5f-toaster'), wire('s-w2', 's-battery', 's-glove')],
    },
    // ABSURD: a desk lamp on the battery and a kitchen timer dinging away at nothing in particular.
    {
      objects: [
        o('s-glove', 'boxing_glove', 38, 50),
        o('s-bridge', 'plank', 360, 190, { length: 140 }, 25 * DEG),
        o('s-battery', 'battery', 600, 200),
        o('s-chicken', 'rubber_chicken', 935, 219),
        o('s-deflect-l', 'plank', 520, 360, { length: 200 }, -25 * DEG),
        o('s-deflect-r', 'plank', 720, 500, { length: 140 }, 25 * DEG),
        o('s-lamp', 'light_bulb', 640, 120),
        o('s-timer', 'timer', 700, 120, { delay: 1, hold: 0 }),
      ],
      connections: [wire('s-w1', 's-battery', 'g5f-toaster'), wire('s-w2', 's-battery', 's-glove'), wire('s-w3', 's-battery', 's-lamp')],
    },
  ],
  counterexamples: [
    {
      why: 'the bowling ball sails past the left plate without a plank to catch it',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-bridge', 'plank', 360, 190, { length: 140 }, 25 * DEG),
          o('s-battery', 'battery', 600, 200),
          o('s-chicken', 'rubber_chicken', 935, 219),
          o('s-deflect-r', 'plank', 720, 500, { length: 140 }, 25 * DEG),
        ],
        connections: [wire('s-w1', 's-battery', 'g5f-toaster'), wire('s-w2', 's-battery', 's-glove')],
      },
    },
    {
      why: 'without a chicken on the roof the toast lands silently and Whiskers sleeps on',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-bridge', 'plank', 360, 190, { length: 140 }, 25 * DEG),
          o('s-battery', 'battery', 600, 200),
          o('s-deflect-l', 'plank', 520, 360, { length: 200 }, -25 * DEG),
          o('s-deflect-r', 'plank', 720, 500, { length: 140 }, 25 * DEG),
        ],
        connections: [wire('s-w1', 's-battery', 'g5f-toaster'), wire('s-w2', 's-battery', 's-glove')],
      },
    },
    {
      why: 'without a plank under the pipe the basketball bounces away from the right plate',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-bridge', 'plank', 360, 190, { length: 140 }, 25 * DEG),
          o('s-battery', 'battery', 600, 200),
          o('s-chicken', 'rubber_chicken', 935, 219),
          o('s-deflect-l', 'plank', 520, 360, { length: 200 }, -25 * DEG),
        ],
        connections: [wire('s-w1', 's-battery', 'g5f-toaster'), wire('s-w2', 's-battery', 's-glove')],
      },
    },
    {
      why: 'without a ramp across the gap the bowling ball drops out of the machine',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-battery', 'battery', 600, 200),
          o('s-chicken', 'rubber_chicken', 935, 219),
          o('s-deflect-l', 'plank', 520, 360, { length: 200 }, -25 * DEG),
          o('s-deflect-r', 'plank', 720, 500, { length: 140 }, 25 * DEG),
        ],
        connections: [wire('s-w1', 's-battery', 'g5f-toaster'), wire('s-w2', 's-battery', 's-glove')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-7: the breakfast lift

const goingUp: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-going-up',
    name: 'Going Up',
    description: 'Bolt is asleep in the basement and the party is upstairs. When breakfast pops, wake Whiskers so he shoves the cannonball down the hole, and let its weight hoist Bolt up to the dance floor. Then pop the party balloons.',
    environment: 'basement',
    world: WORLD(),
    fixedObjects: [
      // breakfast shelf: alarm clock, toaster, Whiskers, the cannonball and a hole just too narrow for a cat
      o('g5g-shelf-a', 'wall', 270, 190, { w: 500, h: 20, material: 'wood' }),
      o('g5g-shelf-b', 'wall', 637, 190, { w: 160, h: 20, material: 'wood' }),
      o('g5g-shelf-stop', 'wall', 26, 150, { w: 12, h: 60, material: 'wood' }),
      o('g5g-bell', 'bell', 700, 150),
      o('g5g-shelf-end', 'wall', 723, 120, { w: 12, h: 140, material: 'wood' }),
      // the basement, the switch post and the party floor
      o('g5g-party-floor', 'wall', 885, 480, { w: 370, h: 300, material: 'brick' }),
      o('g5g-end-wall', 'wall', 1074, 285, { w: 12, h: 90, material: 'brick' }),
      o('g5g-switch-post', 'wall', 538, 590, { w: 96, h: 80, material: 'wood' }),
      o('g5g-balloon-roof', 'wall', 1040, 24, { w: 160, h: 16, material: 'wood' }),
    ],
    startingObjects: [
      o('g5g-alarm', 'timer', 120, 250, { delay: 0.5, hold: 0 }),
      o('g5g-toaster', 'toaster', 70, 160, { slices: 1, delay: 1, power: 480 }, 35 * DEG),
      o('g5g-cat', 'cat', 365, 167),
      o('g5g-cannonball', 'cannonball', 503, 168),
      o('g5g-bulb', 'light_bulb', 760, 100),
      o('g5g-battery', 'battery', 420, 601),
      o('g5g-switch', 'toggle_switch', 538, 536, {}, 90 * DEG),
      o('g5g-bolt', 'robot', 640, 607, { speed: 70, awake: false }),
      o('g5g-lamp-1', 'light_bulb', 920, 300),
      o('g5g-lamp-2', 'light_bulb', 980, 300),
      o('g5g-lamp-3', 'light_bulb', 1040, 300),
      o('g5g-balloon-a', 'balloon', 990, 60, { color: 'red' }),
      o('g5g-balloon-b', 'balloon', 1040, 60, { color: 'yellow' }),
      o('g5g-balloon-c', 'balloon', 1090, 60, { color: 'teal' }),
    ],
    connections: [
      wire('g5g-w1', 'g5g-alarm', 'g5g-toaster'),
      wire('g5g-w2', 'g5g-bell', 'g5g-bulb'),
      wire('g5g-w3', 'g5g-battery', 'g5g-switch'),
      wire('g5g-w4', 'g5g-switch', 'g5g-bolt'),
      wire('g5g-w5', 'g5g-switch', 'g5g-lamp-1'),
      wire('g5g-w6', 'g5g-switch', 'g5g-lamp-2'),
      wire('g5g-w7', 'g5g-switch', 'g5g-lamp-3'),
    ],
    inventory: [
      { type: 'rubber_chicken', count: 1 },
      { type: 'pulley', count: 3 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'dynamite', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'light_bulb', count: 1 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g5g-bolt' }, region: { x: 930, y: 230, w: 140, h: 100 }, hold: 1, label: 'Get Bolt to the dance floor' },
      { kind: 'destroyed', target: { type: 'balloon' }, label: 'Pop every party balloon' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 7, elegantTime: 11, absurdStages: 23 },
    hints: [
      'Bolt wakes when the switch on the post is flipped, and he cannot climb. Something heavy falling past that switch could do both jobs at once.',
      'Hang a bucket under the hole on a rope over two pulleys, tied to Bolt’s back hook. The cannonball drops in, the bucket sinks, and up goes Bolt. Whiskers will only push it if a chicken squawks where the toast lands.',
      'For the balloons: a stick of dynamite on a little plank just under them, wired to the wall switch so it goes bang once Bolt is on his way up.',
    ],
    metadata: { chapter: 5, order: 7, author: 'Follyworks', blurb: 'Upward mobility, breakfast edition.' },
  },
  solutions: [
    {
      objects: [
        o('s-chicken', 'rubber_chicken', 250, 171),
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 538, 40),
        o('s-bucket', 'bucket', 538, 250, { anchored: false }),
        o('s-shelf', 'plank', 1040, 150, { length: 100 }),
        o('s-tnt', 'dynamite', 1040, 132, { power: 2 }),
      ],
      connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']), wire('s-w1', 'g5g-switch', 's-tnt')],
    },
    // ABSURD: a party light on the switch, just because.
    {
      objects: [
        o('s-chicken', 'rubber_chicken', 250, 171),
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 538, 40),
        o('s-bucket', 'bucket', 538, 250, { anchored: false }),
        o('s-shelf', 'plank', 1040, 150, { length: 100 }),
        o('s-tnt', 'dynamite', 1040, 132, { power: 2 }),
        o('s-bulb', 'light_bulb', 820, 60),
      ],
      connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']), wire('s-w1', 'g5g-switch', 's-tnt'), wire('s-w2', 'g5g-switch', 's-bulb')],
    },
  ],
  counterexamples: [
    {
      why: 'without a chicken where the toast lands, Whiskers sleeps through breakfast and the cannonball never moves',
      build: {
        objects: [
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 538, 40),
          o('s-bucket', 'bucket', 538, 250, { anchored: false }),
          o('s-shelf', 'plank', 1040, 150, { length: 100 }),
          o('s-tnt', 'dynamite', 1040, 132, { power: 2 }),
        ],
        connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']), wire('s-w1', 'g5g-switch', 's-tnt')],
      },
    },
    {
      why: 'a chicken dropped on the switch wakes Bolt in the basement, and he marches off before the lift arrives',
      build: {
        objects: [
          o('s-chicken', 'rubber_chicken', 538, 470),
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 538, 40),
          o('s-bucket', 'bucket', 538, 250, { anchored: false }),
          o('s-shelf', 'plank', 1040, 150, { length: 100 }),
          o('s-tnt', 'dynamite', 1040, 132, { power: 2 }),
        ],
        connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']), wire('s-w1', 'g5g-switch', 's-tnt')],
      },
    },
    {
      why: 'a bucket hung beside the hole catches nothing, so Bolt stays in the basement',
      build: {
        objects: [
          o('s-chicken', 'rubber_chicken', 250, 171),
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 470, 40),
          o('s-bucket', 'bucket', 470, 250, { anchored: false }),
          o('s-shelf', 'plank', 1040, 150, { length: 100 }),
          o('s-tnt', 'dynamite', 1040, 132, { power: 2 }),
        ],
        connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']), wire('s-w1', 'g5g-switch', 's-tnt')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-8: one flame, a relay of blasts, a cannon on a tripwire

const fireInTheHole: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-fire-in-the-hole',
    name: 'Fire in the Hole',
    description: 'Blasting day in the mine. Pop the balloon sealed in the steel bunker, swish a cannonball through the hoop and bowl the boulder into the pins. The only power is the mine’s own, and it runs through the pressure plate under the ore crate.',
    environment: 'underground',
    world: WORLD(),
    fixedObjects: [
      o('g5h-bunker-top', 'wall', 170, 66, { w: 132, h: 12, material: 'steel' }),
      o('g5h-bunker-l', 'wall', 170 - 60, 124, { w: 12, h: 104, material: 'steel' }),
      o('g5h-bunker-r', 'wall', 170 + 60, 124, { w: 12, h: 104, material: 'steel' }),
      o('g5h-bunker-floor', 'wall', 170, 182, { w: 132, h: 12, material: 'steel' }),
      o('g5h-hook', 'hook', 170, 168),
      o('g5h-crane-hook', 'hook', 680, 60),
      o('g5h-hoop', 'basketball_hoop', 960, 320),
      // the bowling alley: a boulder on a ledge above a ramp, and three pins at the bottom
      o('g5h-ledge', 'wall', 830, 500, { w: 100, h: 12, material: 'wood' }),
      o('g5h-alley', 'plank', 935, 560, { length: 130 }, 35 * DEG),
    ],
    startingObjects: [
      o('g5h-battery', 'battery', 470, 601),
      o('g5h-plate', 'pressure_plate', 680, 621, { minMass: 2 }),
      o('g5h-lamp', 'light_bulb', 760, 591),
      o('g5h-crate', 'crate', 680, 300, { material: 'steel' }),
      o('g5h-balloon', 'balloon', 170, 110, { lift: 1, color: 'teal' }),
      o('g5h-rubble-1', 'crate', 110, 608, { material: 'wood' }),
      o('g5h-rubble-2', 'crate', 156, 608, { material: 'wood' }),
      o('g5h-rubble-3', 'crate', 133, 563, { material: 'wood' }),
      o('g5h-ball-return', 'bucket', 962, 420, { anchored: true }),
      o('g5h-boulder', 'bowling_ball', 860, 474),
      o('g5h-pin-1', 'bowling_pin', 1015, 602),
      o('g5h-pin-2', 'bowling_pin', 1050, 602),
      o('g5h-pin-3', 'bowling_pin', 1085, 602),
    ],
    connections: [
      link('g5h-tether', 'rope', 'g5h-hook', 'hook', 'g5h-balloon', 'string'),
      link('g5h-hang', 'rope', 'g5h-crane-hook', 'hook', 'g5h-crate', 'hook'),
      wire('g5h-w1', 'g5h-battery', 'g5h-plate'),
      wire('g5h-w2', 'g5h-plate', 'g5h-lamp'),
    ],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'dynamite', count: 3 },
      { type: 'cannon', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'timer', count: 1 },
    ],
    goals: [
      { kind: 'destroyed', target: { id: 'g5h-balloon' }, label: 'Pop the balloon in the bunker' },
      { kind: 'containerCount', container: 'g5h-hoop', count: 1, filter: { type: 'cannonball' }, label: 'Swish a cannonball' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Strike! Knock down all three pins' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 5, elegantTime: 6, absurdStages: 21 },
    hints: [
      'The pressure plate is the only power you get. Something heavy has to land on it, and its output can fire a cannon.',
      'A candle under the crane rope drops the ore crate. Steel walls stop things, not shock waves: light a stick at the candle and a second stick within its blast relays the bang to the bunker.',
      'Wire the plate to a cannon aimed up and to the right at the hoop, and to a small stick behind the boulder: the gentlest bang is enough to roll it down the alley.',
    ],
    metadata: { chapter: 5, order: 8, author: 'Follyworks', blurb: 'One match, three jobs, zero batteries.' },
  },
  solutions: [
    {
      // One flame drops the crate and starts the relay; the plate fires the cannon and nudges the boulder.
      objects: [
        o('s-candle-shelf', 'plank', 680, 236, { length: 70 }),
        o('s-candle', 'candle', 680, 200),
        o('s-tnt-1', 'dynamite', 680, 176, { power: 7 }),
        o('s-shelf', 'plank', 420, 168, { length: 70 }),
        o('s-tnt-2', 'dynamite', 420, 150, { power: 7 }),
        o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
        o('s-tnt-3', 'dynamite', 805, 483, { power: 1 }),
      ],
      connections: [wire('s-w1', 'g5h-plate', 's-cannon'), wire('s-w2', 'g5h-plate', 's-tnt-3')],
    },
    // ABSURD: the relay as before, and a kitchen timer counts the cannon in for dramatic effect.
    {
      objects: [
        o('s-candle-shelf', 'plank', 680, 236, { length: 70 }),
        o('s-candle', 'candle', 680, 200),
        o('s-tnt-1', 'dynamite', 680, 176, { power: 7 }),
        o('s-shelf', 'plank', 420, 168, { length: 70 }),
        o('s-tnt-2', 'dynamite', 420, 150, { power: 7 }),
        o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
        o('s-tnt-3', 'dynamite', 805, 483, { power: 1 }),
        o('s-timer', 'timer', 620, 470, { delay: 0.5, hold: 0 }),
      ],
      connections: [wire('s-w1', 'g5h-plate', 's-timer'), wire('s-w3', 's-timer', 's-cannon'), wire('s-w2', 'g5h-plate', 's-tnt-3')],
    },
  ],
  counterexamples: [
    {
      why: 'the candle drops the crate and the cannon fires, but nothing ever goes bang near the bunker',
      build: {
        objects: [
          o('s-candle-shelf', 'plank', 680, 236, { length: 70 }),
          o('s-candle', 'candle', 680, 200),
          o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
          o('s-tnt-3', 'dynamite', 805, 483, { power: 1 }),
        ],
        connections: [wire('s-w1', 'g5h-plate', 's-cannon'), wire('s-w2', 'g5h-plate', 's-tnt-3')],
      },
    },
    {
      why: 'one stick by the crane is too far from the bunker to pop the balloon on its own',
      build: {
        objects: [
          o('s-candle-shelf', 'plank', 680, 236, { length: 70 }),
          o('s-candle', 'candle', 680, 200),
          o('s-tnt-1', 'dynamite', 680, 176, { power: 10 }),
          o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
          o('s-tnt-3', 'dynamite', 805, 483, { power: 1 }),
        ],
        connections: [wire('s-w1', 'g5h-plate', 's-cannon'), wire('s-w2', 'g5h-plate', 's-tnt-3')],
      },
    },
    {
      why: 'without a nudge the boulder sits on its ledge and the pins stay standing',
      build: {
        objects: [
          o('s-candle-shelf', 'plank', 680, 236, { length: 70 }),
          o('s-candle', 'candle', 680, 200),
          o('s-tnt-1', 'dynamite', 680, 176, { power: 7 }),
          o('s-shelf', 'plank', 420, 168, { length: 70 }),
          o('s-tnt-2', 'dynamite', 420, 150, { power: 7 }),
          o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
        ],
        connections: [wire('s-w1', 'g5h-plate', 's-cannon')],
      },
    },
    {
      why: 'without the candle the crate never drops, so the plate never powers anything',
      build: {
        objects: [
          o('s-candle-shelf', 'plank', 680, 236, { length: 70 }),
          o('s-tnt-1', 'dynamite', 680, 176, { power: 7 }),
          o('s-shelf', 'plank', 420, 168, { length: 70 }),
          o('s-tnt-2', 'dynamite', 420, 150, { power: 7 }),
          o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
          o('s-tnt-3', 'dynamite', 805, 483, { power: 1 }),
        ],
        connections: [wire('s-w1', 'g5h-plate', 's-cannon'), wire('s-w2', 'g5h-plate', 's-tnt-3')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-9: sort the scrap, and the full skip wakes the yard cat

const scrapSorter: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-scrap-sorter',
    name: 'Scrap Sorter',
    description: 'The scrap belt is stopped and the iron and rubber are all mixed up. Sort them: bowling balls into the iron skip, rubber balls into the rubber bin. Iron landing in the skip makes toast, and toast wakes the yard cat, who has a basketball to deliver.',
    environment: 'garage',
    world: WORLD(),
    fixedObjects: [
      // the scrap belt and its two bins
      o('g5i-belt-stop', 'wall', 104, 160, { w: 12, h: 60, material: 'steel' }),
      o('g5i-skip-l', 'wall', 370, 590, { w: 12, h: 80, material: 'steel' }),
      o('g5i-skip-r', 'wall', 500, 600, { w: 12, h: 60, material: 'steel' }),
      // the yard cat's catwalk, its drop pipe and the cradle underneath
      o('g5i-catwalk-a', 'wall', 693, 160, { w: 246, h: 20, material: 'wood' }),
      o('g5i-catwalk-b', 'wall', 987, 160, { w: 234, h: 20, material: 'wood' }),
      o('g5i-catwalk-stop', 'wall', 576, 120, { w: 12, h: 60, material: 'wood' }),
      o('g5i-toaster-fence', 'wall', 1010, 115, { w: 10, h: 70, material: 'wood' }),
      o('g5i-pipe-l', 'wall', 820, 250, { w: 8, h: 200, material: 'steel' }),
      o('g5i-pipe-r', 'wall', 865, 250, { w: 8, h: 200, material: 'steel' }),
      o('g5i-cradle', 'wall', 855, 595, { w: 20, h: 70, material: 'wood' }),
      o('g5i-hoop', 'basketball_hoop', 1060, 470, {}, 0, true),
      o('g5i-score-bell', 'bell', 1060, 594),
    ],
    startingObjects: [
      o('g5i-belt', 'conveyor', 300, 200, { length: 380, speed: 90 }),
      o('g5i-iron-1', 'bowling_ball', 140, 169),
      o('g5i-rubber-1', 'ball', 200, 175),
      o('g5i-iron-2', 'bowling_ball', 260, 169),
      o('g5i-rubber-2', 'ball', 320, 175),
      o('g5i-iron-3', 'bowling_ball', 380, 169),
      o('g5i-rubber-3', 'ball', 440, 175),
      o('g5i-rubber-bin', 'bucket', 700, 608),
      o('g5i-battery', 'battery', 60, 601),
      o('g5i-switch', 'toggle_switch', 60, 90),
      o('g5i-skip-plate', 'pressure_plate', 440, 622, { minMass: 10 }),
      o('g5i-lamp', 'light_bulb', 440, 520),
      o('g5i-toaster', 'toaster', 1070, 130, { slices: 1, delay: 1, power: 430 }, -35 * DEG, true),
      o('g5i-cat', 'cat', 650, 137),
      o('g5i-ball', 'basketball', 785, 134),
      o('g5i-score-lamp', 'light_bulb', 1000, 560),
    ],
    connections: [
      wire('g5i-w1', 'g5i-battery', 'g5i-switch'),
      wire('g5i-w2', 'g5i-switch', 'g5i-belt'),
      wire('g5i-w3', 'g5i-battery', 'g5i-skip-plate'),
      wire('g5i-w4', 'g5i-skip-plate', 'g5i-lamp'),
      wire('g5i-w5', 'g5i-skip-plate', 'g5i-toaster'),
      wire('g5i-w6', 'g5i-score-bell', 'g5i-score-lamp'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'motor', count: 1 },
      { type: 'belt', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'rubber_chicken', count: 1 },
      { type: 'pressure_plate', count: 1 },
      { type: 'boxing_glove', count: 1 },
      { type: 'magnet', count: 1 },
      { type: 'timer', count: 1 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g5i-iron-1' }, region: { x: 376, y: 530, w: 118, h: 100 }, hold: 1, label: 'Bowling ball #1 in the iron skip' },
      { kind: 'enterRegion', target: { id: 'g5i-iron-2' }, region: { x: 376, y: 530, w: 118, h: 100 }, hold: 1, label: 'Bowling ball #2 in the iron skip' },
      { kind: 'enterRegion', target: { id: 'g5i-iron-3' }, region: { x: 376, y: 530, w: 118, h: 100 }, hold: 1, label: 'Bowling ball #3 in the iron skip' },
      { kind: 'containerCount', container: 'g5i-rubber-bin', count: 2, filter: { type: 'ball' }, label: 'Two rubber balls in the rubber bin' },
      { kind: 'containerCount', container: 'g5i-hoop', count: 1, filter: { type: 'basketball' }, label: 'Sink the yard cat’s basketball' },
    ],
    restrictions: { timeLimit: 35 },
    bonus: { elegantParts: 8, elegantTime: 11, absurdStages: 24 },
    hints: [
      'The belt’s end wheel can be driven without its switch: a powered motor and a belt from the motor to that wheel. A fan pushes every ball equally hard, but a rubber ball is ten times lighter than a bowling ball.',
      'Blow sideways across the drop: the rubber flies off towards the bin, the iron barely swerves. Once iron lands in the skip, its plate fires the toaster; put a rubber chicken on the catwalk where the toast comes down.',
      'The basketball drops down the pipe onto the little post. A pressure plate there tells a boxing glove, tilted up and to the right just below it, exactly when to punch.',
    ],
    metadata: { chapter: 5, order: 9, author: 'Follyworks', blurb: 'Same push, very different results.' },
  },
  solutions: [
    {
      objects: [
        o('s-motor', 'motor', 160, 330, { rpm: 60 }),
        o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
        o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
        o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
        o('s-chicken', 'rubber_chicken', 900, 141),
        o('s-plate', 'pressure_plate', 845, 553, { minMass: 1 }),
        o('s-glove', 'boxing_glove', 802, 590, { power: 550 }, -60 * DEG),
      ],
      connections: [
        wire('s-w1', 'g5i-battery', 's-motor'),
        link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
        wire('s-w2', 'g5i-battery', 's-fan'),
        wire('s-w3', 'g5i-battery', 's-plate'),
        wire('s-w4', 's-plate', 's-glove'),
      ],
    },
    // ABSURD: the fan waits for a kitchen timer before it blows, as if anyone asked.
    {
      objects: [
        o('s-motor', 'motor', 160, 330, { rpm: 60 }),
        o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
        o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
        o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
        o('s-chicken', 'rubber_chicken', 900, 141),
        o('s-plate', 'pressure_plate', 845, 553, { minMass: 1 }),
        o('s-glove', 'boxing_glove', 802, 590, { power: 550 }, -60 * DEG),
        o('s-timer', 'timer', 300, 420, { delay: 0.3, hold: 0 }),
      ],
      connections: [
        wire('s-w1', 'g5i-battery', 's-motor'),
        link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
        wire('s-w5', 'g5i-battery', 's-timer'),
        wire('s-w2', 's-timer', 's-fan'),
        wire('s-w3', 'g5i-battery', 's-plate'),
        wire('s-w4', 's-plate', 's-glove'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'with no fan the rubber falls with the iron, straight into the skip',
      build: {
        objects: [
          o('s-motor', 'motor', 160, 330, { rpm: 60 }),
          o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
          o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
          o('s-chicken', 'rubber_chicken', 900, 141),
          o('s-plate', 'pressure_plate', 845, 553, { minMass: 1 }),
          o('s-glove', 'boxing_glove', 802, 590, { power: 550 }, -60 * DEG),
        ],
        connections: [
          wire('s-w1', 'g5i-battery', 's-motor'),
          link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
          wire('s-w3', 'g5i-battery', 's-plate'),
          wire('s-w4', 's-plate', 's-glove'),
        ],
      },
    },
    {
      why: 'a perfect sorter is no use if the belt never moves',
      build: {
        objects: [
          o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
          o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
          o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
          o('s-chicken', 'rubber_chicken', 900, 141),
          o('s-plate', 'pressure_plate', 845, 553, { minMass: 1 }),
          o('s-glove', 'boxing_glove', 802, 590, { power: 550 }, -60 * DEG),
        ],
        connections: [
          wire('s-w2', 'g5i-battery', 's-fan'),
          wire('s-w3', 'g5i-battery', 's-plate'),
          wire('s-w4', 's-plate', 's-glove'),
        ],
      },
    },
    {
      why: 'without a chicken on the catwalk the toast lands quietly and the yard cat sleeps on',
      build: {
        objects: [
          o('s-motor', 'motor', 160, 330, { rpm: 60 }),
          o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
          o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
          o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
          o('s-plate', 'pressure_plate', 845, 553, { minMass: 1 }),
          o('s-glove', 'boxing_glove', 802, 590, { power: 550 }, -60 * DEG),
        ],
        connections: [
          wire('s-w1', 'g5i-battery', 's-motor'),
          link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
          wire('s-w2', 'g5i-battery', 's-fan'),
          wire('s-w3', 'g5i-battery', 's-plate'),
          wire('s-w4', 's-plate', 's-glove'),
        ],
      },
    },
    {
      why: 'the glove is wired straight to the battery and punches the empty cradle',
      build: {
        objects: [
          o('s-motor', 'motor', 160, 330, { rpm: 60 }),
          o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
          o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
          o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
          o('s-chicken', 'rubber_chicken', 900, 141),
          o('s-glove', 'boxing_glove', 802, 590, { power: 550 }, -60 * DEG),
        ],
        connections: [
          wire('s-w1', 'g5i-battery', 's-motor'),
          link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
          wire('s-w2', 'g5i-battery', 's-fan'),
          wire('s-w4', 'g5i-battery', 's-glove'),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-10: the whole shebang

const grandFinale: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-grand-finale',
    name: 'The Whole Shebang',
    description: 'Closing night at the lab. Punch the bowling ball into the lift bucket to hoist Bolt onto the stage, and park him on the spotlight until the EXIT sign has glowed for 2 seconds. Along the way, swish the trophy cannonball, pop the bunker balloon, and get Whiskers to ring the curtain bell.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      // the opening punch: a ledge, a gap and a ramp down into the lift bucket
      o('g5j-ledge', 'wall', 80, 77, { w: 60, h: 14, material: 'wood' }),
      o('g5j-ramp', 'plank', 210, 114, { length: 86 }, 19 * DEG),
      o('g5j-backstop', 'wall', 322, 96, { w: 10, h: 80, material: 'wood' }),
      // the stage, the lift pedestal and the bunker
      o('g5j-stage', 'wall', 885, 480, { w: 370, h: 300, material: 'brick' }),
      o('g5j-stage-stop', 'wall', 1074, 300, { w: 12, h: 60, material: 'brick' }),
      o('g5j-pedestal', 'wall', 300, 590, { w: 130, h: 80, material: 'wood' }),
      o('g5j-pedestal-lip-l', 'wall', 240, 540, { w: 10, h: 20, material: 'wood' }),
      o('g5j-pedestal-lip-r', 'wall', 360, 540, { w: 10, h: 20, material: 'wood' }),
      o('g5j-bunker-roof', 'wall', 150, 186, { w: 132, h: 12, material: 'steel' }),
      o('g5j-bunker-l', 'wall', 90, 244, { w: 12, h: 104, material: 'steel' }),
      o('g5j-bunker-r', 'wall', 210, 244, { w: 12, h: 104, material: 'steel' }),
      o('g5j-bunker-floor', 'wall', 150, 302, { w: 132, h: 12, material: 'steel' }),
      o('g5j-hook', 'hook', 150, 288),
      o('g5j-trophy-hoop', 'basketball_hoop', 560, 250),
      // the curtain call: a toaster in the wings and Whiskers asleep on the lighting rig
      o('g5j-rig-roof', 'wall', 740, 5, { w: 340, h: 10, material: 'steel' }),
      o('g5j-rig', 'wall', 740, 78, { w: 320, h: 16, material: 'steel' }),
      o('g5j-rig-stop', 'wall', 576, 50, { w: 8, h: 40, material: 'steel' }),
      o('g5j-cat-basket', 'wall', 826, 64, { w: 6, h: 12, material: 'wood' }),
      o('g5j-curtain-bell', 'bell', 896, 40),
      o('g5j-applause-bell', 'bell', 610, 594),
    ],
    startingObjects: [
      o('g5j-bowling', 'bowling_ball', 80, 50),
      o('g5j-battery', 'battery', 520, 601),
      o('g5j-plate-drop', 'pressure_plate', 300, 543, { minMass: 1.5 }),
      o('g5j-plate-spot', 'pressure_plate', 1000, 323, { minMass: 1 }),
      o('g5j-exit', 'light_bulb', 1030, 140),
      o('g5j-house-1', 'light_bulb', 790, 400),
      o('g5j-house-2', 'light_bulb', 880, 400),
      o('g5j-house-3', 'light_bulb', 970, 400),
      o('g5j-applause-lamp', 'light_bulb', 660, 520),
      o('g5j-curtain-lamp', 'light_bulb', 960, 40),
      o('g5j-bolt', 'robot', 660, 607, { speed: 60, awake: false }),
      o('g5j-balloon', 'balloon', 150, 230, { lift: 1, color: 'red' }),
      o('g5j-crate-1', 'crate', 80, 608, { material: 'wood' }),
      o('g5j-crate-2', 'crate', 126, 608, { material: 'wood' }),
      o('g5j-crate-3', 'crate', 103, 563, { material: 'wood' }),
      o('g5j-toaster', 'toaster', 607, 50, { slices: 1, delay: 1, power: 380 }, 65 * DEG),
      o('g5j-cat', 'cat', 856, 57),
    ],
    connections: [
      link('g5j-tether', 'rope', 'g5j-hook', 'hook', 'g5j-balloon', 'string'),
      wire('g5j-w1', 'g5j-battery', 'g5j-plate-drop'),
      wire('g5j-w2', 'g5j-battery', 'g5j-plate-spot'),
      wire('g5j-w3', 'g5j-plate-spot', 'g5j-exit'),
      wire('g5j-w4', 'g5j-plate-drop', 'g5j-house-1'),
      wire('g5j-w5', 'g5j-plate-drop', 'g5j-house-2'),
      wire('g5j-w6', 'g5j-plate-spot', 'g5j-toaster'),
      wire('g5j-w7', 'g5j-curtain-bell', 'g5j-curtain-lamp'),
      wire('g5j-w8', 'g5j-plate-drop', 'g5j-house-3'),
      wire('g5j-w9', 'g5j-applause-bell', 'g5j-applause-lamp'),
    ],
    inventory: [
      { type: 'boxing_glove', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'pulley', count: 3 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'cannon', count: 1 },
      { type: 'logic_gate', count: 3 },
      { type: 'dynamite', count: 2 },
      { type: 'rubber_chicken', count: 1 },
      { type: 'timer', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g5j-exit' }, duration: 2, label: 'Bolt on the spotlight: EXIT sign lit for 2 seconds' },
      { kind: 'containerCount', container: 'g5j-trophy-hoop', count: 1, filter: { type: 'cannonball' }, label: 'Swish the trophy cannonball' },
      { kind: 'destroyed', target: { id: 'g5j-balloon' }, label: 'Pop the balloon in the bunker' },
      { kind: 'activate', target: { id: 'g5j-curtain-bell' }, label: 'Whiskers rings the curtain bell' },
    ],
    restrictions: { timeLimit: 35 },
    bonus: { elegantParts: 11, elegantTime: 10, absurdStages: 28 },
    hints: [
      'Start with the lift: punch the bowling ball over the gap (a plank bridges it) and down into a bucket hung on a rope over two pulleys and tied to Bolt’s back hook. The bucket lands on the drop plate, and that plate’s output is yours to use.',
      'Bolt should wake when the counterweight lands and stop on the spotlight plate: drop plate AND (NOT spotlight plate) into his antenna. The drop plate can fire a cannon at the trophy hoop too.',
      'The spotlight plate already fires the toaster up on the lighting rig. A rubber chicken on the rig where the toast comes down wakes Whiskers, and the spotlight plate can set off a stick on the bunker roof as well.',
    ],
    metadata: { chapter: 5, order: 10, author: 'Follyworks', blurb: 'Every trick in the book, all at once.' },
  },
  solutions: [
    {
      objects: [
        o('s-glove', 'boxing_glove', 38, 50),
        o('s-bridge', 'plank', 140, 87, { length: 50 }, 20 * DEG),
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 40),
        o('s-bucket', 'bucket', 300, 191, { anchored: false }),
        o('s-cannon', 'cannon', 420, 590, { power: 1075, shots: 1 }, -85 * DEG),
        o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
        o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
        o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
        o('s-chicken', 'rubber_chicken', 780, 61),
      ],
      connections: [
        link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
        wire('s-w0', 'g5j-battery', 's-glove'),
        wire('s-w1', 'g5j-plate-drop', 's-cannon'),
        wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
        wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
        wire('s-w4', 's-not', 's-and', 'b'),
        wire('s-w5', 's-and', 'g5j-bolt'),
        wire('s-w6', 'g5j-plate-spot', 's-tnt'),
      ],
    },
    // ABSURD: a timer counts the cannon in, and the bunker charge goes through a spare OR box for luck.
    {
      objects: [
        o('s-glove', 'boxing_glove', 38, 50),
        o('s-bridge', 'plank', 140, 87, { length: 50 }, 20 * DEG),
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 40),
        o('s-bucket', 'bucket', 300, 191, { anchored: false }),
        o('s-cannon', 'cannon', 420, 590, { power: 1075, shots: 1 }, -85 * DEG),
        o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
        o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
        o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
        o('s-chicken', 'rubber_chicken', 780, 61),
        o('s-timer', 'timer', 480, 470, { delay: 0.3, hold: 0 }),
        o('s-or', 'logic_gate', 640, 400, { mode: 'or' }),
      ],
      connections: [
        link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
        wire('s-w0', 'g5j-battery', 's-glove'),
        wire('s-w1', 'g5j-plate-drop', 's-timer'),
        wire('s-w7', 's-timer', 's-cannon'),
        wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
        wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
        wire('s-w4', 's-not', 's-and', 'b'),
        wire('s-w5', 's-and', 'g5j-bolt'),
        wire('s-w6', 'g5j-plate-spot', 's-or', 'a'),
        wire('s-w8', 's-or', 's-tnt'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'Bolt woken straight off the drop plate never stops: he marches over the spotlight into the wall and back',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-bridge', 'plank', 140, 87, { length: 50 }, 20 * DEG),
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 300, 40),
          o('s-bucket', 'bucket', 300, 191, { anchored: false }),
          o('s-cannon', 'cannon', 420, 590, { power: 1075, shots: 1 }, -85 * DEG),
          o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
          o('s-chicken', 'rubber_chicken', 780, 61),
        ],
        connections: [
          link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
          wire('s-w0', 'g5j-battery', 's-glove'),
          wire('s-w1', 'g5j-plate-drop', 's-cannon'),
          wire('s-w5', 'g5j-plate-drop', 'g5j-bolt'),
          wire('s-w6', 'g5j-plate-spot', 's-tnt'),
        ],
      },
    },
    {
      why: 'without a plank over the gap the bowling ball drops onto the bunker, and the lift never moves',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 300, 40),
          o('s-bucket', 'bucket', 300, 191, { anchored: false }),
          o('s-cannon', 'cannon', 420, 590, { power: 1075, shots: 1 }, -85 * DEG),
          o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
          o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
          o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
          o('s-chicken', 'rubber_chicken', 780, 61),
        ],
        connections: [
          link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
          wire('s-w0', 'g5j-battery', 's-glove'),
          wire('s-w1', 'g5j-plate-drop', 's-cannon'),
          wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
          wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
          wire('s-w4', 's-not', 's-and', 'b'),
          wire('s-w5', 's-and', 'g5j-bolt'),
          wire('s-w6', 'g5j-plate-spot', 's-tnt'),
        ],
      },
    },
    {
      why: 'without a chicken on the rig the toast lands quietly and Whiskers sleeps through the curtain call',
      build: {
        objects: [
          o('s-glove', 'boxing_glove', 38, 50),
          o('s-bridge', 'plank', 140, 87, { length: 50 }, 20 * DEG),
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 300, 40),
          o('s-bucket', 'bucket', 300, 191, { anchored: false }),
          o('s-cannon', 'cannon', 420, 590, { power: 1075, shots: 1 }, -85 * DEG),
          o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
          o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
          o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
        ],
        connections: [
          link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
          wire('s-w0', 'g5j-battery', 's-glove'),
          wire('s-w1', 'g5j-plate-drop', 's-cannon'),
          wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
          wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
          wire('s-w4', 's-not', 's-and', 'b'),
          wire('s-w5', 's-and', 'g5j-bolt'),
          wire('s-w6', 'g5j-plate-spot', 's-tnt'),
        ],
      },
    },
    {
      why: 'an empty bucket is too light to lift a robot: nobody punched the bowling ball in',
      build: {
        objects: [
          o('s-bridge', 'plank', 140, 87, { length: 50 }, 20 * DEG),
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 300, 40),
          o('s-bucket', 'bucket', 300, 191, { anchored: false }),
          o('s-cannon', 'cannon', 420, 590, { power: 1075, shots: 1 }, -85 * DEG),
          o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
          o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
          o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
          o('s-chicken', 'rubber_chicken', 780, 61),
        ],
        connections: [
          link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
          wire('s-w1', 'g5j-plate-drop', 's-cannon'),
          wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
          wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
          wire('s-w4', 's-not', 's-and', 'b'),
          wire('s-w5', 's-and', 'g5j-bolt'),
          wire('s-w6', 'g5j-plate-spot', 's-tnt'),
        ],
      },
    },
  ],
};

export const GROUP_5: CampaignEntry[] = [waitForIt, riseAndShine, surpriseParty, latchOn, duckShoot, twoKeys, goingUp, fireInTheHole, scrapSorter, grandFinale];
