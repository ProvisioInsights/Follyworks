// Orientation: six short tutorial missions, each teaching one control, each with a silly little
// machine to watch and a fun goal (a hoop, a bell, pins, toast, a cat). Optional step-by-step
// guidance (see GuideStep in core/types.ts). Each should take well under a minute.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/campaign.test.ts).

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
const slope = (id: string, x1: number, y1: number, x2: number, y2: number, material = 'wood', h = 12): ObjectDef =>
  o(id, 'wall', (x1 + x2) / 2, (y1 + y2) / 2, { w: Math.round(Math.hypot(x2 - x1, y2 - y1)), h, material }, Math.atan2(y2 - y1, x2 - x1));

const WORLD = { ...STANDARD_WORLD };
/** One rotate-button press with snap on. */
const NOTCH = Math.PI / 12;
const meta = (order: number, blurb: string) => ({ chapter: 0, order, tutorial: true, author: 'Follyworks', blurb });

// ---------------------------------------------------------------- T1: place one thing, press RUN

const t1: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't1-first-drop',
    name: 'Nothing But Net',
    description: 'Every great machine starts with something falling. Drop the rubber ball into the funnel: swish through the hoop, into the toy box.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      slope('t1-funnel-l', 500, 170, 556, 320, 'steel', 8),
      slope('t1-funnel-r', 660, 170, 604, 320, 'steel', 8),
      o('t1-chute-l', 'wall', 556, 342, { w: 8, h: 44, material: 'steel' }),
      o('t1-chute-r', 'wall', 604, 342, { w: 8, h: 44, material: 'steel' }),
      o('t1-hoop', 'basketball_hoop', 576, 384),
      o('t1-box-l', 'wall', 500, 575, { w: 16, h: 110, material: 'wood' }),
      o('t1-box-r', 'wall', 660, 575, { w: 16, h: 110, material: 'wood' }),
    ],
    startingObjects: [o('t1-chicken', 'rubber_chicken', 580, 620), o('t1-cat', 'cat', 840, 616)],
    connections: [],
    inventory: [{ type: 'ball', count: 1 }],
    goals: [
      { kind: 'enterRegion', target: { type: 'ball' }, region: { x: 508, y: 520, w: 144, h: 110 }, hold: 1, label: 'Land the ball in the toy box' },
      { kind: 'containerCount', container: 't1-hoop', count: 1, label: 'Swish it through the hoop' },
    ],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 1, elegantTime: 3, absurdStages: 0 },
    hints: ['Things fall straight down. Put the ball anywhere above the funnel, then press RUN.'],
    guide: [
      {
        text: 'Drag the Rubber Ball out of the parts bin and drop it on the glowing outline above the funnel.',
        point: { bin: 'ball' },
        ghost: { type: 'ball', x: 580, y: 220 },
        until: { kind: 'place', type: 'ball', at: { x: 580, y: 220 }, radius: 90 },
      },
      { text: 'Press RUN to start time. (Press it again, or Space, to reset and try again.)', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(1, 'Place one thing. Press RUN. Feel powerful.'),
  },
  solutions: [{ objects: [o('ball-a', 'ball', 580, 220)], connections: [] }],
};

// ---------------------------------------------------------------- T2: rotate a part

const t2: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't2-ramp-it-up',
    name: 'Ring My Bell',
    description: 'The ball drops out of the chute and just sits there. Tilt a plank under it so it rolls off into the dominoes, and the last domino rings the bell.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t2-chute-l', 'wall', 164, 90, { w: 12, h: 150, material: 'steel' }),
      o('t2-chute-r', 'wall', 216, 90, { w: 12, h: 150, material: 'steel' }),
      o('t2-bell', 'bell', 925, 590),
    ],
    startingObjects: [
      o('t2-ball', 'ball', 190, 120),
      o('t2-dom-1', 'domino', 760, 601),
      o('t2-dom-2', 'domino', 800, 601),
      o('t2-dom-3', 'domino', 840, 601),
      o('t2-dom-4', 'domino', 880, 601),
    ],
    connections: [],
    inventory: [{ type: 'plank', count: 2 }],
    goals: [{ kind: 'activate', target: { id: 't2-bell' }, label: 'Ring the bell' }],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 1, elegantTime: 5, absurdStages: 0 },
    hints: ['A plank does not have to be flat. Rotate it to make a slope.', 'Put a plank under the chute, sloping down to the right.'],
    guide: [
      {
        text: 'Drag a Plank out of the parts bin onto the outline under the chute.',
        point: { bin: 'plank' },
        ghost: { type: 'plank', x: 290, y: 330, angle: NOTCH, props: { length: 300 } },
        until: { kind: 'place', type: 'plank', at: { x: 290, y: 330 }, radius: 90 },
      },
      {
        text: 'Planks start flat. With your plank selected, press the rotate button (or E) to tilt it like the outline.',
        point: { hud: 'rotate' },
        ghost: { type: 'plank', x: 290, y: 330, angle: NOTCH, props: { length: 300 } },
        until: { kind: 'place', type: 'plank', at: { x: 290, y: 330 }, radius: 110, angle: NOTCH, angleTol: 0.14 },
      },
      { text: 'Press RUN and watch it roll.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(2, 'Planks: the original redirect.'),
  },
  solutions: [{ objects: [o('plank-a', 'plank', 290, 330, { length: 300 }, NOTCH)], connections: [] }],
};

// ---------------------------------------------------------------- T3: start a chain reaction

const t3: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't3-knock-on',
    name: 'Bowled Over',
    description: 'The pins are set up at the end of the lane. Build a ramp down onto the lane and send the bowling ball rolling into them. Three down counts!',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t3-lane', 'wall', 660, 400, { w: 480, h: 14, material: 'wood' }),
      o('t3-post', 'wall', 440, 518, { w: 16, h: 222, material: 'wood' }),
    ],
    startingObjects: [
      o('t3-pin-1', 'bowling_pin', 716, 365),
      o('t3-pin-2', 'bowling_pin', 762, 365),
      o('t3-pin-3', 'bowling_pin', 808, 365),
      o('t3-pin-4', 'bowling_pin', 854, 365),
    ],
    connections: [],
    inventory: [
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down three pins' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 5, absurdStages: 0 },
    hints: [
      'A ball dropped onto a sloped plank arrives rolling, and passes its speed on to whatever it hits.',
      'Put a plank sloping down onto the left end of the lane, and drop the bowling ball onto the plank.',
    ],
    guide: [
      {
        text: 'Place a Plank as a ramp leading down onto the lane, and tilt it to match the outline.',
        point: { bin: 'plank' },
        ghost: { type: 'plank', x: 320, y: 340, angle: NOTCH, props: { length: 240 } },
        until: { kind: 'place', type: 'plank', at: { x: 320, y: 340 }, radius: 90, angle: NOTCH, angleTol: 0.3 },
      },
      {
        text: 'Now drop the Bowling Ball on the top of the ramp.',
        point: { bin: 'bowling_ball' },
        ghost: { type: 'bowling_ball', x: 230, y: 250 },
        until: { kind: 'place', type: 'bowling_ball' },
      },
      { text: 'RUN it. If it misses, reset, nudge a part and go again: that is the whole game.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(3, 'Cause, meet effect.'),
  },
  solutions: [{ objects: [o('plank-a', 'plank', 320, 340, { length: 240 }, NOTCH), o('bowl-a', 'bowling_ball', 230, 250)], connections: [] }],
};

// ---------------------------------------------------------------- T4: things can switch things on

const t4: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't4-lights-on',
    name: 'Breakfast Switch',
    description: 'The battery is already wired to the toaster through a switch. Switches flip ON when something rolls through them left to right. Make toast, and serve it in the bucket.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t4-battery', 'battery', 640, 601),
      o('t4-switch', 'toggle_switch', 560, 602),
      o('t4-toaster', 'toaster', 760, 606, { slices: 1 }, NOTCH),
      o('t4-bucket', 'bucket', 900, 608),
    ],
    startingObjects: [o('t4-cat', 'cat', 975, 616)],
    connections: [wire('t4-w1', 't4-battery', 'out', 't4-switch', 'in'), wire('t4-w2', 't4-switch', 'out', 't4-toaster', 'in')],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 't4-bucket', count: 1, filter: { type: 'toast' }, label: 'Toast in the bucket' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 0 },
    hints: [
      'A ball dropped onto the floor just bounces in place. It needs to be moving right when it reaches the switch.',
      'Drop the ball onto a plank that slopes down to the floor, left of the switch.',
    ],
    guide: [
      {
        text: 'The switch only cares about things moving right. Build a ramp that ends on the floor left of the switch.',
        point: { bin: 'plank' },
        ghost: { type: 'plank', x: 330, y: 560, angle: NOTCH, props: { length: 300 } },
        until: { kind: 'place', type: 'plank', at: { x: 330, y: 560 }, radius: 110, angle: NOTCH, angleTol: 0.3 },
      },
      { text: 'Add the ball at the top of your ramp.', point: { bin: 'ball' }, ghost: { type: 'ball', x: 220, y: 440 }, until: { kind: 'place', type: 'ball' } },
      { text: 'RUN, and watch the wires light up as power flows.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(4, 'Power flows when the switch says so.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 330, 560, { length: 300 }, NOTCH), o('ball-a', 'ball', 220, 440)], connections: [] },
    { objects: [o('plank-a', 'plank', 380, 580, { length: 200 }, NOTCH), o('ball-a', 'ball', 320, 300)], connections: [] },
  ],
};

// ---------------------------------------------------------------- T5: draw a wire

const t5: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't5-wire-it-up',
    name: 'Wake Up, Whiskers',
    description: 'The ball will flip the switch on its own, but the fan is not connected to anything. Wire the switch to the fan so it blows the rubber chicken off the shelf. SQUAWK.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t5-ramp', 'plank', 245, 446, { length: 300 }, NOTCH),
      o('t5-ledge', 'wall', 480, 492, { w: 200, h: 14, material: 'wood' }),
      o('t5-switch', 'toggle_switch', 470, 467),
      o('t5-battery', 'battery', 420, 601),
      o('t5-bucket', 'bucket', 660, 608),
      o('t5-fan', 'fan', 760, 372, { strength: 8, range: 300 }),
      o('t5-shelf', 'wall', 860, 415, { w: 170, h: 14, material: 'wood' }),
    ],
    startingObjects: [o('t5-ball', 'ball', 130, 370), o('t5-chicken', 'rubber_chicken', 870, 397), o('t5-cat', 'cat', 1040, 616, {}, 0, true)],
    connections: [wire('t5-w1', 't5-battery', 'out', 't5-switch', 'in')],
    inventory: [{ type: 'wire', count: -1 }],
    goals: [{ kind: 'activate', target: { id: 't5-cat' }, label: 'Wake up Whiskers the cat' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 0, elegantTime: 5, absurdStages: 0 },
    hints: ['Power flows out of orange OUT sockets and into cyan IN sockets. Wires are free.', 'Pick the wire, click the switch’s orange OUT socket, then click the fan’s cyan IN socket.'],
    guide: [
      {
        text: 'Pick the Wire, click the switch’s orange OUT socket, then click the fan’s cyan IN socket. Wires are free.',
        point: { bin: 'wire' },
        until: { kind: 'connect', connection: 'wire' },
      },
      { text: 'Now RUN. When the ball flips the switch, power flows down your wire into the fan.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(5, 'Orange out, cyan in.'),
  },
  solutions: [{ objects: [], connections: [wire('wire-a', 't5-switch', 'out', 't5-fan', 'in')] }],
};

// ---------------------------------------------------------------- T6: a tiny real machine

const t6: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't6-tiny-machine',
    name: 'The Tiny Machine',
    description: 'Your first real contraption, no hand-holding: roll a ball through the switch, wire the switch to the fan, and blow the basketball off the shelf and through the hoop.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t6-battery', 'battery', 120, 601),
      o('t6-switch', 'toggle_switch', 320, 389, {}, NOTCH),
      o('t6-shelf', 'wall', 690, 400, { w: 220, h: 14, material: 'wood' }),
      o('t6-fan', 'fan', 610, 357, { strength: 3, range: 300 }),
      o('t6-backstop', 'wall', 905, 400, { w: 14, h: 150, material: 'brick' }),
      slope('t6-funnel-l', 790, 420, 835, 475, 'steel', 8),
      slope('t6-funnel-r', 898, 440, 875, 475, 'steel', 8),
      o('t6-chute-l', 'wall', 831, 494, { w: 8, h: 40, material: 'steel' }),
      o('t6-chute-r', 'wall', 879, 494, { w: 8, h: 40, material: 'steel' }),
      o('t6-hoop', 'basketball_hoop', 851, 526),
      slope('t6-chute', 815, 592, 1030, 626, 'wood', 8),
      o('t6-bell', 'bell', 1050, 592),
    ],
    startingObjects: [o('t6-bball', 'basketball', 700, 377)],
    connections: [wire('t6-w1', 't6-battery', 'out', 't6-switch', 'in')],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'wire', count: -1 },
    ],
    goals: [
      { kind: 'containerCount', container: 't6-hoop', count: 1, filter: { id: 't6-bball' }, label: 'Swish the basketball through the hoop' },
      { kind: 'activate', target: { id: 't6-bell' }, label: 'Ring the bell' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 6, absurdStages: 0 },
    hints: [
      'The fan only blows while it has power, and nothing is wired to it yet.',
      'Wire the switch’s OUT to the fan’s IN, then build a ramp down to the switch and drop a ball on it.',
    ],
    guide: [
      {
        text: 'Last one: no outlines this time. Make the fan blow the basketball through the hoop. The light bulb button in the top bar has hints.',
        point: { hud: 'hint' },
        until: { kind: 'ack' },
      },
    ],
    metadata: meta(6, 'Ball, switch, fan, hoop, bell. A real machine!'),
  },
  solutions: [
    {
      objects: [o('plank-a', 'plank', 220, 360, { length: 300 }, NOTCH), o('ball-a', 'ball', 110, 250)],
      connections: [wire('wire-a', 't6-switch', 'out', 't6-fan', 'in')],
    },
  ],
};

export const TUTORIAL: CampaignEntry[] = [t1, t2, t3, t4, t5, t6];
