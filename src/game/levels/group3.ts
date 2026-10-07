// Mission group 3 — Moving Parts. Motors, gears, drive belts, conveyors, winches and Bolt the
// walking robot, plus the timing of things that keep moving. See CHAPTERS in types.ts.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };
const wire = (id: string, from: string, to: string, fromPort = 'out', toPort = 'in') => link(id, 'wire', from, fromPort, to, toPort);
const belt = (id: string, a: string, b: string) => link(id, 'belt', a, 'rotor', b, 'rotor');

// Resting heights on the floor (y = 630) for common parts.
const FLOOR = STANDARD_WORLD.height;
const BATTERY_Y = FLOOR - 28;
const MOTOR_Y = FLOOR - 24;
const BOX_Y = FLOOR - 22; // crate, Bolt, bucket

// ---------------------------------------------------------------- 3-1: gears mesh and pass the turn on

const wakeUpCall: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-wake-up-call',
    name: 'Wake-Up Call',
    description: 'Whiskers has slept through breakfast again. The motor hums, but the drive gear up top is out of its reach. Bridge the gap with gears and let the toaster do the shouting.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3a-shelf', 'plank', 800, 337, { length: 260 }),
      o('g3a-guide', 'wall', 681, 305, { w: 14, h: 36, material: 'steel' }),
    ],
    startingObjects: [
      o('g3a-battery', 'battery', 100, BATTERY_Y),
      o('g3a-motor', 'motor', 200, MOTOR_Y, { rpm: 90, dir: 'cw' }),
      o('g3a-drive', 'gear', 200, 246, { size: 'medium' }),
      o('g3a-conveyor', 'conveyor', 480, 250, { length: 400, speed: 110, dir: 'right' }),
      o('g3a-ball', 'ball', 320, 225),
      o('g3a-toaster', 'toaster', 750, 306, { delay: 0.8 }, 0, true),
      o('g3a-cat', 'cat', 880, 317),
    ],
    connections: [wire('g3a-w1', 'g3a-battery', 'g3a-motor'), belt('g3a-b1', 'g3a-drive', 'g3a-conveyor')],
    inventory: [{ type: 'gear', count: 5 }],
    goals: [{ kind: 'activate', target: { id: 'g3a-cat' }, label: 'Wake Whiskers the cat' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 6, absurdStages: 10 },
    hints: [
      'Gears turn when their teeth touch a turning neighbour. The ring glows green when they mesh.',
      'One gear cannot reach the drive gear. Stack a tower of them straight up from the motor.',
      'Three large gears, one on top of the other, from the motor up to the drive gear.',
    ],
    metadata: { chapter: 3, order: 1, author: 'Follyworks', blurb: 'Teeth to teeth to toast.' },
  },
  solutions: [
    {
      objects: [o('s-g1', 'gear', 200, 537, { size: 'large' }), o('s-g2', 'gear', 200, 436, { size: 'large' }), o('s-g3', 'gear', 200, 332, { size: 'large' })],
      connections: [],
    },
    // ABSURD: two spare small gears whirl off the side of the tower.
    {
      objects: [
        o('s-g1', 'gear', 200, 537, { size: 'large' }),
        o('s-g2', 'gear', 200, 436, { size: 'large' }),
        o('s-g3', 'gear', 200, 332, { size: 'large' }),
        o('s-x1', 'gear', 274, 537, { size: 'small' }),
        o('s-x2', 'gear', 126, 436, { size: 'small' }),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'two large gears fall short of the drive gear',
      build: { objects: [o('s-g1', 'gear', 200, 537, { size: 'large' }), o('s-g2', 'gear', 200, 436, { size: 'large' })], connections: [] },
    },
    {
      why: 'an even number of gears runs the conveyor backwards',
      build: {
        objects: [
          o('s-g1', 'gear', 200, 537, { size: 'large' }),
          o('s-g2', 'gear', 200, 436, { size: 'large' }),
          o('s-g3', 'gear', 200, 350, { size: 'medium' }),
          o('s-g4', 'gear', 200, 294, { size: 'small' }),
        ],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-2: Bolt walks, steps onto low things, turns at walls

const SHELF = 300; // top of Bolt's brick plinths
const LANE = 480; // top of the bowling lane
const PLINTH_Y = (SHELF + FLOOR) / 2;
const SEAT_H = FLOOR - SHELF - 14; // the notches either side of the gap sit one plank lower
const strikeBolt: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-strike-bolt',
    name: 'Strike, Bolt!',
    description: 'Meet Bolt: he marches straight ahead, turns round when he bumps into something solid, and steps over anything no taller than his ankles. Get him to push the bowling ball down to the lane, knock down five pins and follow it down.',
    environment: 'greenhouse',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3b-plinth-a', 'wall', 240, PLINTH_Y, { w: 280, h: FLOOR - SHELF, material: 'brick' }),
      o('g3b-seat-a', 'wall', 395, FLOOR - SEAT_H / 2, { w: 30, h: SEAT_H, material: 'brick' }),
      o('g3b-seat-b', 'wall', 505, FLOOR - SEAT_H / 2, { w: 30, h: SEAT_H, material: 'brick' }),
      o('g3b-plinth-b', 'wall', 575, PLINTH_Y, { w: 110, h: FLOOR - SHELF, material: 'brick' }),
      o('g3b-lane', 'wall', 955, (LANE + FLOOR) / 2, { w: 330, h: FLOOR - LANE, material: 'wood' }),
    ],
    startingObjects: [
      o('g3b-bolt', 'robot', 300, SHELF - 22, { speed: 80, awake: true }, 0, true),
      o('g3b-ball', 'bowling_ball', 580, SHELF - 20),
      o('g3b-cactus', 'cactus', 50, FLOOR - 28),
      ...[0, 1, 2, 3, 4, 5].map((i) => o(`g3b-pin${i + 1}`, 'bowling_pin', 920 + i * 36, LANE - 28)),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 4 },
      { type: 'domino', count: 4 },
    ],
    goals: [
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 5, label: 'Knock down 5 pins' },
      { kind: 'enterRegion', target: { id: 'g3b-bolt' }, region: { x: 790, y: 390, w: 330, h: 90 }, hold: 0.5, label: 'Bolt follows his ball down to the lane' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 11, absurdStages: 15 },
    hints: [
      'Bolt only turns round when he walks into something solid, and he is marching the wrong way.',
      'Stand a plank on its end behind him to turn him round. A plank lying flat across the gap is just a step to him.',
      'Upright plank behind Bolt, a flat plank across the gap (the notches hold it level), and a sloping plank from the end of his shelf down to the lane.',
    ],
    metadata: { chapter: 3, order: 2, author: 'Follyworks', blurb: 'Left, right, left. STRIKE.' },
  },
  solutions: [
    {
      objects: [
        o('s-post', 'plank', 150, SHELF - 40, { length: 80 }, Math.PI / 2),
        o('s-bridge', 'plank', 450, SHELF + 3, { length: 140 }),
        o('s-ramp', 'plank', 740, 388, { length: 270 }, 0.65),
      ],
      connections: [],
    },
    // ABSURD: Bolt bulldozes three dominoes on his way to the turning post.
    {
      objects: [
        o('s-post', 'plank', 150, SHELF - 40, { length: 80 }, Math.PI / 2),
        o('s-d1', 'domino', 230, SHELF - 29),
        o('s-d2', 'domino', 200, SHELF - 29),
        o('s-d3', 'domino', 262, SHELF - 29),
        o('s-bridge', 'plank', 450, SHELF + 3, { length: 140 }),
        o('s-ramp', 'plank', 740, 388, { length: 270 }, 0.65),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'nothing turns Bolt round, so he walks off into the cactus pit',
      build: { objects: [o('s-bridge', 'plank', 450, SHELF + 3, { length: 140 }), o('s-ramp', 'plank', 740, 388, { length: 270 }, 0.65)], connections: [] },
    },
    {
      why: 'the gap is not bridged',
      build: { objects: [o('s-post', 'plank', 150, SHELF - 40, { length: 80 }, Math.PI / 2), o('s-ramp', 'plank', 740, 388, { length: 270 }, 0.65)], connections: [] },
    },
    {
      why: 'there is no ramp down to the lane',
      build: { objects: [o('s-post', 'plank', 150, SHELF - 40, { length: 80 }, Math.PI / 2), o('s-bridge', 'plank', 450, SHELF + 3, { length: 140 })], connections: [] },
    },
    {
      why: 'dominoes knock the pins over but Bolt never reaches the lane',
      build: { objects: [o('s-d1', 'domino', 893, LANE - 29, {}, 0.5), o('s-d2', 'domino', 857, LANE - 29, {}, 0.5)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 3-3: a belted pulley is a winch

const hoopHoist: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-hoop-hoist',
    name: 'Hoop Hoist',
    description: 'The rolling ball starts the motor, but a steel gate still blocks the basketball. Build a winch to hoist the gate, then catapult the ball through the hoop and onto the bell.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3c-chute', 'plank', 990, 150, { length: 200 }, -0.25),
      o('g3c-ledge', 'wall', 820, 250, { w: 160, h: 20, material: 'steel' }),
      o('g3c-stop', 'wall', 746, 222, { w: 12, h: 36, material: 'steel' }),
      o('g3c-gantry', 'wall', 560, 40, { w: 200, h: 20, material: 'steel' }),
      o('g3c-shelf', 'plank', 480, 250, { length: 400 }, -0.1),
    ],
    startingObjects: [
      o('g3c-ball', 'ball', 1070, 106),
      o('g3c-plate', 'pressure_plate', 840, 233),
      o('g3c-battery', 'battery', 1080, BATTERY_Y),
      o('g3c-motor', 'motor', 980, MOTOR_Y, { rpm: 60, dir: 'cw' }),
      o('g3c-gate', 'crate', 560, 219, { material: 'steel' }, -0.1),
      o('g3c-hoopball', 'basketball', 602, 220),
      o('g3c-hoop', 'basketball_hoop', 571, 489, {}, 0, true),
      o('g3c-bell', 'bell', 562, 598),
    ],
    connections: [wire('g3c-w1', 'g3c-battery', 'g3c-plate'), wire('g3c-w2', 'g3c-plate', 'g3c-motor')],
    inventory: [
      { type: 'pulley', count: 2 },
      { type: 'belt', count: 1 },
      { type: 'rope', count: 2 },
      { type: 'mousetrap', count: 1 },
      { type: 'gear', count: 3 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g3c-hoop', count: 1, filter: { id: 'g3c-hoopball' }, label: 'Sink the basketball' },
      { kind: 'activate', target: { id: 'g3c-bell' }, label: 'Ring the bell' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 10, absurdStages: 8 },
    hints: [
      'Hang a pulley under the gantry. A drive belt from the motor spins it, and a rope tied to its winch drum gets wound in.',
      'Once the gate is up, the basketball rolls off the end of the shelf. Catch it on a mousetrap facing the hoop.',
      'Pulley just under the gantry, belted to the motor, gate roped to its winch drum. Mousetrap on the floor where the ball lands, snapping to the right.',
    ],
    metadata: { chapter: 3, order: 3, author: 'Follyworks', blurb: 'Belt, rope, SNAP, swish.' },
  },
  solutions: [
    {
      objects: [o('s-winch', 'pulley', 560, 82), o('s-trap', 'mousetrap', 186, FLOOR - 5)],
      connections: [belt('s-belt', 'g3c-motor', 's-winch'), link('s-rope', 'rope', 'g3c-gate', 'hook', 's-winch', 'drum')],
    },
    // ABSURD: the winch is driven through a two-gear relay, which spins a third gear for show.
    {
      objects: [
        o('s-g1', 'gear', 980, 537, { size: 'large' }),
        o('s-g2', 'gear', 1054, 537, { size: 'small' }),
        o('s-g3', 'gear', 980, 454, { size: 'medium' }),
        o('s-winch', 'pulley', 560, 82),
        o('s-trap', 'mousetrap', 186, FLOOR - 5),
      ],
      connections: [belt('s-belt', 's-g2', 's-winch'), link('s-rope', 'rope', 'g3c-gate', 'hook', 's-winch', 'drum')],
    },
  ],
  counterexamples: [
    {
      why: 'the pulley is not belted to the motor, so nothing hoists the gate',
      build: { objects: [o('s-winch', 'pulley', 560, 82), o('s-trap', 'mousetrap', 186, FLOOR - 5)], connections: [link('s-rope', 'rope', 'g3c-gate', 'hook', 's-winch', 'drum')] },
    },
    {
      why: 'there is no mousetrap, so the basketball just rolls away',
      build: { objects: [o('s-winch', 'pulley', 560, 82)], connections: [belt('s-belt', 'g3c-motor', 's-winch'), link('s-rope', 'rope', 'g3c-gate', 'hook', 's-winch', 'drum')] },
    },
  ],
};

// ---------------------------------------------------------------- 3-5: belts keep the direction, gears flip it

const zigZag: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-zig-zag',
    name: 'Zig and Zag',
    description: 'The bowling ball sits on three dead conveyors, and their direction levers are jammed the wrong way. Drive them from the motor so the ball zigs, zags and zigs onto the bell. Whiskers will take it from there.',
    environment: 'maintenance',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3e-backstop', 'wall', 838, 220, { w: 12, h: 120, material: 'steel' }),
      o('g3e-bumper', 'wall', 130, 378, { w: 12, h: 74, material: 'steel' }),
      o('g3e-stopper', 'wall', 676, 420, { w: 12, h: 70, material: 'steel' }),
    ],
    startingObjects: [
      o('g3e-ball', 'bowling_ball', 340, 169),
      o('g3e-top', 'conveyor', 530, 200, { length: 460, speed: 110, dir: 'left' }),
      o('g3e-mid', 'conveyor', 480, 330, { length: 460, speed: 110, dir: 'right' }),
      o('g3e-low', 'conveyor', 350, 440, { length: 540, speed: 110, dir: 'left' }),
      o('g3e-bell', 'bell', 648, 530),
      o('g3e-cat', 'cat', 730, FLOOR - 13),
      ...[0, 1, 2, 3].map((i) => o(`g3e-pin${i + 1}`, 'bowling_pin', 960 + i * 36, FLOOR - 28)),
      o('g3e-battery', 'battery', 200, BATTERY_Y),
      o('g3e-motor', 'motor', 300, MOTOR_Y, { rpm: 70, dir: 'ccw' }),
    ],
    connections: [wire('g3e-w1', 'g3e-battery', 'g3e-motor')],
    inventory: [
      { type: 'belt', count: 3 },
      { type: 'gear', count: 3 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g3e-bell' }, label: 'Ring the bell' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Whiskers bowls over 3 pins' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 16, absurdStages: 15 },
    hints: [
      'A belt makes two wheels turn the same way; meshed gears turn opposite ways. A wheel turning clockwise rolls a conveyor to the right.',
      'This motor turns anticlockwise. Mesh a gear on top of it and that gear turns clockwise.',
      'Gear on the motor. Belt the gear to the top and bottom conveyors and the motor to the middle one. A plank leaning on the steel post under the top conveyor’s end steers the ball onto the middle one.',
    ],
    metadata: { chapter: 3, order: 5, author: 'Follyworks', blurb: 'Clockwise, anticlockwise, DING.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 300, 555, { size: 'medium' }), o('s-deflect', 'plank', 767, 279, { length: 140 }, -0.5)],
      connections: [belt('s-b1', 's-gear', 'g3e-top'), belt('s-b2', 'g3e-motor', 'g3e-mid'), belt('s-b3', 's-gear', 'g3e-low')],
    },
    // ABSURD: two spare gears whirl either side of the reversing gear.
    {
      objects: [
        o('s-gear', 'gear', 300, 555, { size: 'medium' }),
        o('s-x1', 'gear', 356, 555, { size: 'small' }),
        o('s-x2', 'gear', 244, 555, { size: 'small' }),
        o('s-deflect', 'plank', 767, 279, { length: 140 }, -0.5),
      ],
      connections: [belt('s-b1', 's-gear', 'g3e-top'), belt('s-b2', 'g3e-motor', 'g3e-mid'), belt('s-b3', 's-gear', 'g3e-low')],
    },
  ],
  counterexamples: [
    {
      why: 'the conveyors are wired straight to the battery and run the way their jammed levers point',
      build: { objects: [], connections: [wire('s-w1', 'g3e-battery', 'g3e-top'), wire('s-w2', 'g3e-battery', 'g3e-mid'), wire('s-w3', 'g3e-battery', 'g3e-low')] },
    },
    {
      why: 'every conveyor is belted straight to the motor, so they all turn the same way',
      build: {
        objects: [o('s-deflect', 'plank', 767, 279, { length: 140 }, -0.5)],
        connections: [belt('s-b1', 'g3e-motor', 'g3e-top'), belt('s-b2', 'g3e-motor', 'g3e-mid'), belt('s-b3', 'g3e-motor', 'g3e-low')],
      },
    },
    {
      why: 'nothing steers the ball onto the middle conveyor',
      build: {
        objects: [o('s-gear', 'gear', 300, 555, { size: 'medium' })],
        connections: [belt('s-b1', 's-gear', 'g3e-top'), belt('s-b2', 'g3e-motor', 'g3e-mid'), belt('s-b3', 's-gear', 'g3e-low')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-4: Bolt is a motor too

const TRACK_A = 0.08; // the top-left track slopes gently down to the right
const DOM_Y = 380; // top of the domino shelf
const robotPower: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-robot-power',
    name: 'Robot Power',
    description: 'No battery, no motor, no problem: Bolt is a walking engine. Rope him up so his march hoists the gate up to the line, then get the bowling ball over to the dominoes. Somewhere at the end of all that, a cat is still asleep.',
    environment: 'underground',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3d-track', 'plank', 380, 260, { length: 400 }, TRACK_A),
      o('g3d-backstop', 'wall', 186, 226, { w: 12, h: 50, material: 'steel' }),
      o('g3d-dom-shelf', 'wall', 850, DOM_Y + 10, { w: 300, h: 20, material: 'wood' }),
      o('g3d-perch', 'wall', 1060, 575, { w: 120, h: 110, material: 'brick' }),
    ],
    startingObjects: [
      o('g3d-bolt', 'robot', 160, BOX_Y, { speed: 80, awake: true }),
      o('g3d-gate', 'crate', 300, 230, {}, TRACK_A),
      o('g3d-ball', 'bowling_ball', 250, 225),
      ...[0, 1, 2, 3, 4, 5].map((i) => o(`g3d-d${i + 1}`, 'domino', 760 + i * 34, DOM_Y - 29)),
      o('g3d-toaster', 'toaster', 990, DOM_Y - 24, { delay: 0.8 }, 0, true),
      o('g3d-cat', 'cat', 1070, 507, {}, 0, true),
    ],
    connections: [],
    inventory: [
      { type: 'pulley', count: 3 },
      { type: 'rope', count: 2 },
      { type: 'plank', count: 2 },
      { type: 'domino', count: 2 },
    ],
    goals: [
      { kind: 'height', target: { id: 'g3d-gate' }, maxY: 160, label: 'Hoist the gate up to the line' },
      { kind: 'activate', target: { id: 'g3d-cat' }, label: 'Wake Whiskers the cat' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 8.5, absurdStages: 12 },
    hints: [
      'Tie a rope to Bolt’s back hook and he drags it along as he walks. Pulleys turn that drag into a lift.',
      'Bolt walks right, so the rope has to leave his back towards the left: round a low pulley behind him, then up over a high pulley right above the gate.',
      'Low pulley on the floor left of Bolt, high pulley above the gate, one rope from Bolt over both to the gate’s hook. Then a plank from the end of the track down to the dominoes.',
    ],
    metadata: { chapter: 3, order: 4, author: 'Follyworks', blurb: 'One robot-power. Approximately.' },
  },
  solutions: [
    {
      objects: [o('s-low', 'pulley', 60, 590), o('s-high', 'pulley', 300, 80), o('s-ramp', 'plank', 640, 330, { length: 140 }, 0.45)],
      connections: [link('s-rope', 'rope', 'g3d-bolt', 'back', 'g3d-gate', 'hook', ['s-low', 's-high'])],
    },
    // ABSURD: two more dominoes at the head of the row.
    {
      objects: [
        o('s-low', 'pulley', 60, 590),
        o('s-high', 'pulley', 300, 80),
        o('s-d0', 'domino', 726, DOM_Y - 29),
        o('s-dx', 'domino', 743, DOM_Y - 29),
        o('s-ramp', 'plank', 640, 330, { length: 140 }, 0.45),
      ],
      connections: [link('s-rope', 'rope', 'g3d-bolt', 'back', 'g3d-gate', 'hook', ['s-low', 's-high'])],
    },
  ],
  counterexamples: [
    {
      why: 'the rope runs straight from Bolt up over the gate pulley, so his walk slackens it',
      build: { objects: [o('s-high', 'pulley', 300, 80), o('s-ramp', 'plank', 640, 330, { length: 140 }, 0.45)], connections: [link('s-rope', 'rope', 'g3d-bolt', 'back', 'g3d-gate', 'hook', ['s-high'])] },
    },
    {
      why: 'there is no ramp, so the bowling ball drops to the floor',
      build: { objects: [o('s-low', 'pulley', 60, 590), o('s-high', 'pulley', 300, 80)], connections: [link('s-rope', 'rope', 'g3d-bolt', 'back', 'g3d-gate', 'hook', ['s-low', 's-high'])] },
    },
    {
      why: 'a tipped domino starts the row but the gate is never hoisted',
      build: { objects: [o('s-d0', 'domino', 735, DOM_Y - 29, {}, 0.5)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 3-6: a conveyor delivers the kettle, steam does the rest

const TEA = 319; // top of the teapot's conveyors and the stove plate
const STOVE_X = 575;
const teaTime: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-tea-time',
    name: 'Tea Time',
    description: 'The teapot is parked on two dead conveyors and the stove has gone out. Roll the pot onto the stove and light it: the steam will shoot the basketball, the whistle will wake Whiskers, and Whiskers will want to bowl.',
    environment: 'basement',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3f-plate', 'wall', STOVE_X, TEA + 3, { w: 100, h: 6, material: 'steel' }),
      o('g3f-stove', 'wall', STOVE_X, (TEA + 68 + FLOOR) / 2, { w: 40, h: FLOOR - TEA - 68, material: 'brick' }),
      o('g3f-shelf', 'wall', 680, 278, { w: 80, h: 20, material: 'wood' }),
      o('g3f-ledge', 'wall', 720, 470, { w: 140, h: 20, material: 'wood' }),
    ],
    startingObjects: [
      o('g3f-battery', 'battery', 60, BATTERY_Y),
      o('g3f-motor', 'motor', 150, MOTOR_Y, { rpm: 60, dir: 'ccw' }),
      o('g3f-conv-a', 'conveyor', 185, TEA + 11, { length: 130, speed: 110, dir: 'left' }),
      o('g3f-conv-b', 'conveyor', 320, TEA + 11, { length: 130, speed: 110, dir: 'left' }),
      o('g3f-conv-c', 'conveyor', 455, TEA + 11, { length: 130, speed: 110, dir: 'left' }),
      o('g3f-teapot', 'teapot', 200, TEA - 21),
      o('g3f-ball', 'basketball', 661, 252),
      o('g3f-cat', 'cat', 700, 460 - 13),
      o('g3f-hoop', 'basketball_hoop', 812, 316, {}, 0, true),
      ...[0, 1, 2, 3].map((i) => o(`g3f-pin${i + 1}`, 'bowling_pin', 960 + i * 36, FLOOR - 28)),
    ],
    connections: [wire('g3f-w1', 'g3f-battery', 'g3f-motor')],
    inventory: [
      { type: 'gear', count: 5 },
      { type: 'belt', count: 4 },
      { type: 'candle', count: 1 },
      { type: 'plank', count: 3 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g3f-hoop', count: 1, filter: { id: 'g3f-ball' }, label: 'Sink the basketball' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Whiskers bowls over 3 pins' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 5, elegantTime: 9, absurdStages: 17 },
    hints: [
      'This motor turns anticlockwise, which would roll the conveyors to the left. Mesh a gear on it and belt the gear instead.',
      'Each conveyor needs its own belt, and a belt keeps the direction of the wheel it comes from.',
      'Gear on the motor, a belt from the gear to each of the three conveyors, and the candle on the brick stove under the plate.',
    ],
    metadata: { chapter: 3, order: 6, author: 'Follyworks', blurb: 'Reverse gear, full steam.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 150, 555, { size: 'medium' }), o('s-candle', 'candle', STOVE_X, TEA + 37)],
      connections: [belt('s-b1', 's-gear', 'g3f-conv-a'), belt('s-b2', 's-gear', 'g3f-conv-b'), belt('s-b3', 's-gear', 'g3f-conv-c')],
    },
    {
      // ABSURD: four idler gears hung off the drive gear just to spin
      objects: [
        o('s-gear', 'gear', 150, 555, { size: 'medium' }),
        o('s-i1', 'gear', 206, 555, { size: 'small' }),
        o('s-i2', 'gear', 150, 499, { size: 'small' }),
        o('s-i3', 'gear', 250, 555, { size: 'small' }),
        o('s-i4', 'gear', 294, 555, { size: 'small' }),
        o('s-candle', 'candle', STOVE_X, TEA + 37),
      ],
      connections: [belt('s-b1', 's-gear', 'g3f-conv-a'), belt('s-b2', 's-gear', 'g3f-conv-b'), belt('s-b3', 's-gear', 'g3f-conv-c')],
    },
  ],
  counterexamples: [
    {
      why: 'belted straight from the motor, the conveyors roll the pot away from the stove',
      build: {
        objects: [o('s-candle', 'candle', STOVE_X, TEA + 37)],
        connections: [belt('s-b1', 'g3f-motor', 'g3f-conv-a'), belt('s-b2', 'g3f-motor', 'g3f-conv-b'), belt('s-b3', 'g3f-motor', 'g3f-conv-c')],
      },
    },
    {
      why: 'two belts only: the pot stalls on the last, dead conveyor',
      build: {
        objects: [o('s-gear', 'gear', 150, 555, { size: 'medium' }), o('s-candle', 'candle', STOVE_X, TEA + 37)],
        connections: [belt('s-b1', 's-gear', 'g3f-conv-a'), belt('s-b2', 's-gear', 'g3f-conv-b')],
      },
    },
    {
      why: 'no candle: the pot never boils',
      build: {
        objects: [o('s-gear', 'gear', 150, 555, { size: 'medium' })],
        connections: [belt('s-b1', 's-gear', 'g3f-conv-a'), belt('s-b2', 's-gear', 'g3f-conv-b'), belt('s-b3', 's-gear', 'g3f-conv-c')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-7: one motor, two jobs

const BOLT_SHELF = 220; // top of Bolt's shelf
const doubleShift: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-double-shift',
    name: 'Double Shift',
    description: 'One motor, two jobs: winch up the steel gate so Bolt can shove the bowling ball off his shelf, and run the conveyor that brings it back across the room. Breakfast is served at the far end, and the cat is a light sleeper.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3g-shelf', 'wall', 855, BOLT_SHELF + 10, { w: 510, h: 20, material: 'wood' }),
      o('g3g-backstop', 'wall', 1104, BOLT_SHELF - 20, { w: 12, h: 40, material: 'steel' }),
      o('g3g-gantry', 'wall', 900, 30, { w: 120, h: 20, material: 'steel' }),
      o('g3g-endstop', 'wall', 626, 372, { w: 12, h: 36, material: 'steel' }),
      o('g3g-toast-shelf', 'wall', 50, 595, { w: 100, h: 70, material: 'brick' }),
    ],
    startingObjects: [
      o('g3g-battery', 'battery', 1080, BATTERY_Y),
      o('g3g-motor', 'motor', 990, MOTOR_Y, { rpm: 60, dir: 'cw' }),
      o('g3g-winch', 'pulley', 900, 72),
      o('g3g-gate', 'crate', 900, BOLT_SHELF - 22, { material: 'steel' }),
      o('g3g-bolt', 'robot', 1050, BOLT_SHELF - 22, { speed: 80, awake: true }, 0, true),
      o('g3g-ball', 'bowling_ball', 700, BOLT_SHELF - 20),
      o('g3g-conveyor', 'conveyor', 410, 400, { length: 420, speed: 110, dir: 'right' }),
      o('g3g-cat', 'cat', 225, FLOOR - 13),
      ...[0, 1, 2, 3].map((i) => o(`g3g-pin${i + 1}`, 'bowling_pin', 640 + i * 36, FLOOR - 28)),
      o('g3g-bell', 'bell', 840, 598),
    ],
    connections: [wire('g3g-w1', 'g3g-battery', 'g3g-motor')],
    inventory: [
      { type: 'pulley', count: 1 },
      { type: 'belt', count: 3 },
      { type: 'rope', count: 1 },
      { type: 'gear', count: 4 },
      { type: 'toaster', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g3g-ball' }, region: { x: 0, y: 440, w: 110, h: 120 }, hold: 0.5, label: 'Deliver the bowling ball to the breakfast shelf' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Whiskers bowls over 3 pins' },
      { kind: 'activate', target: { id: 'g3g-bell' }, label: 'Ring the bell' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 17, absurdStages: 22 },
    hints: [
      'The winch reels in when it turns clockwise, like the motor. The conveyor has to roll left, so it needs the opposite way round: put a gear in between.',
      'The ball leaves the conveyor too low and too soon for the brick shelf. Give it a ramp up there, and put the toaster on the shelf with its lever facing the ramp.',
      'Belt motor to winch, rope gate hook to winch drum. Gear on the motor, belted to the conveyor. Plank sloping down from under the conveyor’s left end to the shelf, toaster on the shelf.',
    ],
    metadata: { chapter: 3, order: 7, author: 'Follyworks', blurb: 'Clockwise for one, anticlockwise for the other.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 990, 555, { size: 'medium' }), o('s-toaster', 'toaster', 45, 536), o('s-ramp', 'plank', 140, 510, { length: 120 }, -0.75)],
      connections: [
        belt('s-b1', 'g3g-motor', 'g3g-winch'),
        link('s-rope', 'rope', 'g3g-gate', 'hook', 'g3g-winch', 'drum'),
        belt('s-b2', 's-gear', 'g3g-conveyor'),
      ],
    },
    {
      // ABSURD: an idler tower on the drive gear, all spinning for nobody
      objects: [
        o('s-gear', 'gear', 990, 555, { size: 'medium' }),
        o('s-i1', 'gear', 934, 555, { size: 'small' }),
        o('s-i2', 'gear', 890, 555, { size: 'small' }),
        o('s-i3', 'gear', 990, 499, { size: 'small' }),
        o('s-toaster', 'toaster', 45, 536), o('s-ramp', 'plank', 140, 510, { length: 120 }, -0.75),
      ],
      connections: [
        belt('s-b1', 'g3g-motor', 'g3g-winch'),
        link('s-rope', 'rope', 'g3g-gate', 'hook', 'g3g-winch', 'drum'),
        belt('s-b2', 's-gear', 'g3g-conveyor'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'both belts come straight off the motor, so the conveyor rolls the ball into the end stop',
      build: {
        objects: [o('s-toaster', 'toaster', 45, 536), o('s-ramp', 'plank', 140, 510, { length: 120 }, -0.75)],
        connections: [
          belt('s-b1', 'g3g-motor', 'g3g-winch'),
          link('s-rope', 'rope', 'g3g-gate', 'hook', 'g3g-winch', 'drum'),
          belt('s-b2', 'g3g-motor', 'g3g-conveyor'),
        ],
      },
    },
    {
      why: 'no ramp: the ball drops short of the toaster shelf',
      build: {
        objects: [o('s-gear', 'gear', 990, 555, { size: 'medium' }), o('s-toaster', 'toaster', 45, 536)],
        connections: [
          belt('s-b1', 'g3g-motor', 'g3g-winch'),
          link('s-rope', 'rope', 'g3g-gate', 'hook', 'g3g-winch', 'drum'),
          belt('s-b2', 's-gear', 'g3g-conveyor'),
        ],
      },
    },
    {
      why: 'no toaster: nothing makes a noise and Whiskers sleeps on',
      build: {
        objects: [o('s-gear', 'gear', 990, 555, { size: 'medium' })],
        connections: [
          belt('s-b1', 'g3g-motor', 'g3g-winch'),
          link('s-rope', 'rope', 'g3g-gate', 'hook', 'g3g-winch', 'drum'),
          belt('s-b2', 's-gear', 'g3g-conveyor'),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-8: timing: hit a moving bucket

const SLAB = 606; // top of the conveyor and the loading bay slab
const PERCH = 460; // top of Whiskers' perch
const movingTarget: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-moving-target',
    name: 'Moving Target',
    description: 'Bolt is about to stroll off the wrong end of his shelf. Turn him round so he shoves the bowling ball over the edge, start the conveyor and the gate winch, and land the ball in the bucket on its way to the loading bay. The toaster in the bay is set to breakfast.',
    environment: 'underground',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3h-shelf', 'wall', 290, 215, { w: 300, h: 30, material: 'wood' }),
      // the gate stands in a pocket in the bay floor, so the bucket cannot just shove it along
      o('g3h-slab-a', 'wall', 768, SLAB + 14, { w: 16, h: 24, material: 'brick' }),
      o('g3h-pocket', 'wall', 800, SLAB + 20, { w: 48, h: 16, material: 'brick' }),
      o('g3h-slab-b', 'wall', 972, SLAB + 14, { w: 296, h: 24, material: 'brick' }),
      o('g3h-perch', 'wall', 1010, PERCH + 10, { w: 220, h: 20, material: 'wood' }),
    ],
    startingObjects: [
      o('g3h-bolt', 'robot', 240, 178, { speed: 80, awake: true }, 0, true),
      o('g3h-ball', 'bowling_ball', 380, 180),
      o('g3h-battery', 'battery', 70, BATTERY_Y),
      o('g3h-motor', 'motor', 180, MOTOR_Y, { rpm: 20, dir: 'ccw' }),
      o('g3h-conveyor', 'conveyor', 530, SLAB + 11, { length: 460, speed: 110, dir: 'left' }),
      o('g3h-bucket', 'bucket', 340, SLAB - 32, { anchored: false }),
      o('g3h-gate', 'crate', 800, SLAB - 10, { material: 'steel' }),
      o('g3h-toaster', 'toaster', 870, SLAB - 24, { delay: 0.8 }, 0, true),
      o('g3h-cat', 'cat', 925, PERCH - 13),
      ...[0, 1, 2, 3].map((i) => o(`g3h-pin${i + 1}`, 'bowling_pin', 975 + i * 26, PERCH - 28)),
      o('g3h-bell', 'bell', 1097, PERCH - 32),
    ],
    connections: [wire('g3h-w1', 'g3h-battery', 'g3h-motor')],
    inventory: [
      { type: 'plank', count: 3 },
      { type: 'belt', count: 3 },
      { type: 'gear', count: 4 },
      { type: 'pulley', count: 1 },
      { type: 'rope', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g3h-bucket', count: 1, filter: { id: 'g3h-ball' }, label: 'Land the ball in the bucket' },
      { kind: 'enterRegion', target: { id: 'g3h-bucket' }, region: { x: 740, y: 520, w: 360, h: 90 }, hold: 0.5, label: 'Deliver the bucket to the loading bay' },
      { kind: 'activate', target: { id: 'g3h-bell' }, label: 'Ring the bell' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 7, elegantTime: 11.5, absurdStages: 22 },
    hints: [
      'Three jobs: turn Bolt round with an upright plank, belt the conveyor, and winch the steel gate out of the bucket’s way.',
      'The motor turns anticlockwise. Both the conveyor and the winch want clockwise, so drive them both from a gear on the motor.',
      'The ball drops just behind the moving bucket. A short plank at the shelf edge, tilted down to the right, gives it the lead it needs.',
    ],
    metadata: { chapter: 3, order: 8, author: 'Follyworks', blurb: 'Lead the target.' },
  },
  solutions: [
    {
      objects: [o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2), o('s-gear', 'gear', 180, 555, { size: 'medium' }), o('s-ramp', 'plank', 464, 220, { length: 40 }, 0.35), o('s-winch', 'pulley', 800, 330)],
      connections: [belt('s-b1', 's-gear', 'g3h-conveyor'), belt('s-b2', 's-gear', 's-winch'), link('s-rope', 'rope', 'g3h-gate', 'hook', 's-winch', 'drum')],
    },
    // ABSURD: three idler gears stacked on the reversing gear.
    {
      objects: [
        o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2),
        o('s-gear', 'gear', 180, 555, { size: 'medium' }),
        o('s-i1', 'gear', 236, 555, { size: 'small' }),
        o('s-i2', 'gear', 180, 499, { size: 'small' }),
        o('s-i3', 'gear', 280, 555, { size: 'small' }),
        o('s-ramp', 'plank', 464, 220, { length: 40 }, 0.35),
        o('s-winch', 'pulley', 800, 330),
      ],
      connections: [belt('s-b1', 's-gear', 'g3h-conveyor'), belt('s-b2', 's-gear', 's-winch'), link('s-rope', 'rope', 'g3h-gate', 'hook', 's-winch', 'drum')],
    },
  ],
  counterexamples: [
    {
      why: 'no lip at the shelf edge, so the ball drops behind the bucket',
      build: { objects: [o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2), o('s-gear', 'gear', 180, 555, { size: 'medium' }), o('s-winch', 'pulley', 800, 330)], connections: [belt('s-b1', 's-gear', 'g3h-conveyor'), belt('s-b2', 's-gear', 's-winch'), link('s-rope', 'rope', 'g3h-gate', 'hook', 's-winch', 'drum')] },
    },
    {
      why: 'nothing turns Bolt round, so the ball stays on the shelf',
      build: { objects: [o('s-gear', 'gear', 180, 555, { size: 'medium' }), o('s-ramp', 'plank', 464, 220, { length: 40 }, 0.35), o('s-winch', 'pulley', 800, 330)], connections: [belt('s-b1', 's-gear', 'g3h-conveyor'), belt('s-b2', 's-gear', 's-winch'), link('s-rope', 'rope', 'g3h-gate', 'hook', 's-winch', 'drum')] },
    },
    {
      why: 'belted straight off the motor, the conveyor runs backwards and the winch pays out',
      build: {
        objects: [o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2), o('s-ramp', 'plank', 464, 220, { length: 40 }, 0.35), o('s-winch', 'pulley', 800, 330)],
        connections: [belt('s-b1', 'g3h-motor', 'g3h-conveyor'), belt('s-b2', 'g3h-motor', 's-winch'), link('s-rope', 'rope', 'g3h-gate', 'hook', 's-winch', 'drum')],
      },
    },
    {
      why: 'the gate stays down and stops the bucket short of the bay',
      build: { objects: [o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2), o('s-gear', 'gear', 180, 555, { size: 'medium' }), o('s-ramp', 'plank', 464, 220, { length: 40 }, 0.35)], connections: [belt('s-b1', 's-gear', 'g3h-conveyor')] },
    },
  ],
};

// ---------------------------------------------------------------- 3-9: three jobs around a running machine

const rushHour: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-rush-hour',
    name: 'Rush Hour',
    description: 'The workshop is already busy. Without jamming anything: catch both balls from the conveyor in the bucket, get the wall clock turning, and get Bolt up to his office on the top floor.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [o('g3i-upper', 'wall', 940, 465, { w: 360, h: 330, material: 'concrete' })],
    startingObjects: [
      o('g3i-battery', 'battery', 90, BATTERY_Y),
      o('g3i-motor', 'motor', 200, MOTOR_Y, { rpm: 40, dir: 'cw' }),
      o('g3i-conveyor', 'conveyor', 460, 380, { length: 360, speed: 110, dir: 'right' }),
      o('g3i-ball-a', 'ball', 330, 355),
      o('g3i-ball-b', 'ball', 400, 355),
      o('g3i-bucket', 'bucket', 520, BOX_Y),
      o('g3i-clock', 'gear', 140, 330, { size: 'large' }),
      o('g3i-bolt', 'robot', 640, BOX_Y, { speed: 70, awake: true }),
      o('g3i-cactus', 'cactus', 1050, 272),
    ],
    connections: [wire('g3i-w1', 'g3i-battery', 'g3i-motor'), belt('g3i-b1', 'g3i-motor', 'g3i-conveyor')],
    inventory: [
      { type: 'gear', count: 3 },
      { type: 'plank', count: 2 },
      { type: 'pulley', count: 2 },
      { type: 'belt', count: 1 },
      { type: 'rope', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g3i-bucket', count: 2, label: 'Catch both balls in the bucket' },
      { kind: 'activate', target: { id: 'g3i-clock' }, duration: 1, label: 'Keep the wall clock turning' },
      { kind: 'enterRegion', target: { id: 'g3i-bolt' }, region: { x: 770, y: 180, w: 330, h: 120 }, hold: 1, label: 'Get Bolt up to the top floor' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 9, absurdStages: 11 },
    hints: [
      'Three separate little jobs. The balls need a chute back to the bucket, the clock needs a gear chain, and Bolt needs a lift.',
      'Your only belt is precious: gears can reach the clock, but only a belt can turn a pulley into a winch.',
      'Two large gears stack from the motor up to the clock. A pulley just above the top floor’s edge, belted to the motor with Bolt roped to its drum, drags him up the wall.',
    ],
    metadata: { chapter: 3, order: 9, author: 'Follyworks', blurb: 'Everything, everywhere, all at once.' },
  },
  solutions: [
    {
      objects: [
        o('s-chute', 'plank', 650, 475, { length: 160 }, -0.7),
        o('s-g1', 'gear', 200, 536, { size: 'large' }),
        o('s-g2', 'gear', 170, 433, { size: 'large' }),
        o('s-winch', 'pulley', 800, 250),
      ],
      connections: [belt('s-belt', 'g3i-motor', 's-winch'), link('s-rope', 'rope', 'g3i-bolt', 'back', 's-winch', 'drum')],
    },
    // ABSURD: a spare gear spins off the side of the clock train for good measure.
    {
      objects: [
        o('s-chute', 'plank', 650, 475, { length: 160 }, -0.7),
        o('s-g1', 'gear', 200, 536, { size: 'large' }),
        o('s-g2', 'gear', 170, 433, { size: 'large' }),
        o('s-g3', 'gear', 274, 536, { size: 'small' }),
        o('s-winch', 'pulley', 800, 250),
      ],
      connections: [belt('s-belt', 'g3i-motor', 's-winch'), link('s-rope', 'rope', 'g3i-bolt', 'back', 's-winch', 'drum')],
    },
  ],
  counterexamples: [
    {
      why: 'the only belt is spent on the clock, so the winch never turns',
      build: {
        objects: [o('s-chute', 'plank', 650, 475, { length: 160 }, -0.7), o('s-winch', 'pulley', 800, 250)],
        connections: [belt('s-belt', 'g3i-motor', 'g3i-clock'), link('s-rope', 'rope', 'g3i-bolt', 'back', 's-winch', 'drum')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-10: the whole works, start to finish

const POST = o('s-post', 'plank', 115, 120, { length: 80 }, Math.PI / 2);
const RAMP = o('s-ramp', 'plank', 430, 320, { length: 160 }, 0.2);
const GEAR = o('s-gear', 'gear', 200, 554, { size: 'medium' });
const theWorks: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-the-works',
    name: 'The Whole Works',
    description: 'One ball, one long trip: Bolt nudges it off his shelf, two dead conveyors carry it across the room, and it drops into the bucket, if somebody has lifted the steel plug out first. Build every bit of it.',
    environment: 'greenhouse',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3j-shelf', 'wall', 250, 175, { w: 300, h: 30, material: 'wood' }),
      o('g3j-bar', 'wall', 394, 117, { w: 12, h: 22, material: 'steel' }),
      o('g3j-deflector', 'wall', 880, 330, { w: 12, h: 190, material: 'steel' }, -0.45),
      o('g3j-backstop', 'wall', 1056, 505, { w: 12, h: 130, material: 'steel' }),
    ],
    startingObjects: [
      o('g3j-bolt', 'robot', 300, 138, { speed: 80, awake: true }, 0, true),
      o('g3j-ball', 'ball', 345, 146),
      o('g3j-battery', 'battery', 90, BATTERY_Y),
      o('g3j-motor', 'motor', 200, MOTOR_Y, { rpm: 70, dir: 'ccw' }),
      o('g3j-flat', 'battery', 600, BATTERY_Y, { on: false }),
      o('g3j-upper', 'conveyor', 620, 330, { length: 300, speed: 110, dir: 'left' }, -0.2),
      o('g3j-lower', 'conveyor', 830, 470, { length: 260, speed: 110, dir: 'left' }),
      o('g3j-winch', 'pulley', 1010, 300),
      o('g3j-plug', 'crate', 1010, 566, { material: 'steel' }),
      o('g3j-bucket', 'bucket', 1010, BOX_Y),
    ],
    connections: [
      wire('g3j-w1', 'g3j-battery', 'g3j-motor'),
      wire('g3j-w2', 'g3j-flat', 'g3j-upper'),
      wire('g3j-w3', 'g3j-flat', 'g3j-lower'),
      link('g3j-rope', 'rope', 'g3j-plug', 'hook', 'g3j-winch', 'drum'),
    ],
    inventory: [
      { type: 'plank', count: 3 },
      { type: 'gear', count: 3 },
      { type: 'belt', count: 4 },
    ],
    goals: [{ kind: 'containerCount', container: 'g3j-bucket', count: 1, filter: { id: 'g3j-ball' }, label: 'Deliver the ball into the bucket' }],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 6, elegantTime: 15, absurdStages: 8 },
    hints: [
      'Follow the ball’s trip: turn Bolt round, ramp the ball onto the upper conveyor, run both conveyors to the right, and reel the plug up out of the bucket.',
      'Every job here needs a clockwise turn, but the motor runs anticlockwise. Mesh one gear on the motor and take every belt from that gear.',
      'An upright plank at the left end of the shelf, a ramp under the right end down onto the upper conveyor, a gear on the motor, and three belts from the gear: upper conveyor, lower conveyor, winch.',
    ],
    metadata: { chapter: 3, order: 10, author: 'Follyworks', blurb: 'Everything you know, in a row.' },
  },
  solutions: [
    {
      objects: [POST, GEAR, RAMP],
      connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')],
    },
    // ABSURD: two spare gears whirl along beside the motor for the show.
    {
      objects: [POST, GEAR, RAMP, o('s-spare1', 'gear', 200, 498, { size: 'small' }), o('s-spare2', 'gear', 256, 554, { size: 'small' })],
      connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')],
    },
  ],
  counterexamples: [
    {
      why: 'there is no ramp and the ball drops straight off the shelf',
      build: { objects: [POST, GEAR], connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')] },
    },
    {
      why: 'the upper conveyor is left dead',
      build: { objects: [POST, GEAR, RAMP], connections: [belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')] },
    },
    {
      why: 'the lower conveyor is left dead',
      build: { objects: [POST, GEAR, RAMP], connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b3', 's-gear', 'g3j-winch')] },
    },
    {
      why: 'the plug is never lifted',
      build: { objects: [POST, GEAR, RAMP], connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower')] },
    },
    {
      why: 'every belt comes straight off the anticlockwise motor',
      build: { objects: [POST, RAMP], connections: [belt('s-b1', 'g3j-motor', 'g3j-upper'), belt('s-b2', 'g3j-motor', 'g3j-lower'), belt('s-b3', 'g3j-motor', 'g3j-winch')] },
    },
  ],
};

export const GROUP_3: CampaignEntry[] = [wakeUpCall, strikeBolt, hoopHoist, robotPower, zigZag, teaTime, doubleShift, movingTarget, rushHour, theWorks];
