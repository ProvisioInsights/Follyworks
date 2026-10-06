// Physics Lab — a separate learning track of short lesson missions, each built around one
// physics concept (see src/content/science.ts). It is deliberately NOT part of CAMPAIGN: the
// campaign ramps in difficulty (tests/levels/campaign.test.ts) and these are self-contained
// lessons. Each entry has the usual CampaignEntry shape plus the concept it teaches and an intro
// card (the idea, a picture in words, the challenge). Lab missions use only existing parts.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels/lab.test.ts).

import type { ConceptId } from '../../content/science';
import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

/** `chapter` / `metadata.chapter` value used by every lab mission (outside the campaign's CHAPTERS). */
export const LAB_CHAPTER = 100;

export interface LabIntro {
  /** The idea in one or two plain sentences. */
  idea: string;
  /** A picture in words: something the player can imagine or has seen. */
  picture: string;
  /** What this mission asks for, in terms of the idea. */
  challenge: string;
}

export interface LabEntry extends CampaignEntry {
  /** The concept card this lesson is built around. */
  concept: ConceptId;
  intro: LabIntro;
}

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string): ConnectionDef => ({
  id,
  kind: 'wire',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
});
const rope = (id: string, from: string, fromPort: string, to: string, toPort: string, via: string[] = []): ConnectionDef => ({
  id,
  kind: 'rope',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
  via,
});
const belt = (id: string, a: string, b: string): ConnectionDef => ({ id, kind: 'belt', from: { obj: a, port: 'rotor' }, to: { obj: b, port: 'rotor' } });
/** A fixed sloped board (scenery) running from (x1, y1) to (x2, y2). */
const slope = (id: string, x1: number, y1: number, x2: number, y2: number, material = 'wood', h = 14): ObjectDef =>
  o(id, 'wall', (x1 + x2) / 2, (y1 + y2) / 2, { w: Math.round(Math.hypot(x2 - x1, y2 - y1)), h, material }, Math.atan2(y2 - y1, x2 - x1));

/**
 * A curved fixed ramp made of short boards: a quarter-ish arc of radius r around (cx, cy), from
 * angle a0 to a1 (degrees, 0 = straight down from the centre... measured as screen angles).
 * Gentle bends lose far less energy than one sharp corner.
 */
const arc = (id: string, cx: number, cy: number, r: number, a0: number, a1: number, n: number, material = 'wood'): ObjectDef[] => {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return pts.slice(1).map((p, i) => {
    const q = pts[i];
    // overlap neighbouring boards slightly so a ball never catches on a seam
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const l = Math.hypot(dx, dy);
    return o(`${id}-${i}`, 'wall', (p.x + q.x) / 2, (p.y + q.y) / 2, { w: Math.round(l + 4), h: 14, material }, Math.atan2(dy, dx));
  });
};

/**
 * A smooth fixed ramp: a straight board from (x0, y0) going down-right at `deg`, bending through
 * an arc of radius r until it runs flat along the floor. Returns the boards and where the flat
 * end meets the floor.
 */
const smoothRamp = (id: string, x0: number, y0: number, deg: number, r: number, material = 'wood') => {
  const floorC = 623; // board centre when it lies on the floor
  const t0 = 90 + deg; // arc angle where its tangent matches the straight board
  const cy = floorC - r;
  const py = cy + r * Math.sin((t0 * Math.PI) / 180);
  const px = x0 + (py - y0) / Math.tan((deg * Math.PI) / 180);
  const cx = px - r * Math.cos((t0 * Math.PI) / 180);
  const boards = [slope(`${id}-s`, x0, y0, px + 2, py + 2 * Math.tan((deg * Math.PI) / 180), material), ...arc(`${id}-a`, cx, cy, r, t0, 90, 8, material)];
  return { boards, endX: cx };
};

const DEG = Math.PI / 180;
const world = () => ({ ...STANDARD_WORLD });
const meta = (order: number, blurb: string) => ({ chapter: LAB_CHAPTER, order, author: 'Follyworks', blurb });
const base = { schemaVersion: LEVEL_SCHEMA_VERSION, world: world(), connections: [] as ConnectionDef[] };

// ---------------------------------------------------------------- 1: gravity — sideways and down

const sideways: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'gravity',
  intro: {
    idea: 'Gravity pulls everything down at the same rate, whether or not it is also moving sideways. A thing knocked off a shelf falls for exactly as long as a thing that just drops.',
    picture: 'Roll a marble off a table and let another one drop from the edge at the same moment. They hit the floor together: the rolling one simply lands further away.',
    challenge: 'Punch the crate off the shelf so it lands in the bin. The fall always takes the same time, so the punch decides how far it travels.',
  },
  level: {
    ...base,
    id: 'lab-sideways-and-down',
    name: 'Sideways and Down',
    description: 'Punch the crate off the shelf and into the bin. Too soft and it drops short; too hard and it sails over.',
    environment: 'research',
    fixedObjects: [
      o('l1-shelf', 'wall', 200, 300, { w: 360, h: 20, material: 'wood' }),
      o('l1-leg', 'wall', 360, 470, { w: 16, h: 320, material: 'wood' }),
      o('l1-bin-l', 'wall', 700, 565, { w: 12, h: 130, material: 'steel' }),
      o('l1-bin-r', 'wall', 880, 565, { w: 12, h: 130, material: 'steel' }),
    ],
    startingObjects: [o('l1-crate', 'crate', 330, 268), o('l1-battery', 'battery', 60, 259)],
    inventory: [{ type: 'boxing_glove', count: 1 }],
    goals: [{ kind: 'enterRegion', target: { id: 'l1-crate' }, region: { x: 706, y: 500, w: 168, h: 130 }, hold: 0.5, label: 'Land the crate in the bin' }],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 1, absurdStages: 0 },
    hints: [
      'Put the boxing glove on the shelf just left of the crate, facing it, and wire the battery to it so it punches when you press RUN.',
      'If the crate lands short, turn the Punch up; if it flies over the bin, turn it down. Somewhere around 1200 works.',
    ],
    metadata: meta(1, 'Falling takes the same time, however hard you push.'),
  },
  solutions: [
    {
      objects: [o('glove-a', 'boxing_glove', 278, 273, { power: 1200 })],
      connections: [wire('w-a', 'l1-battery', 'out', 'glove-a', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'the punch is too soft',
      build: { objects: [o('glove-a', 'boxing_glove', 278, 273, { power: 450 })], connections: [wire('w-a', 'l1-battery', 'out', 'glove-a', 'in')] },
    },
    {
      why: 'the punch is far too hard',
      build: { objects: [o('glove-a', 'boxing_glove', 278, 273, { power: 1600 })], connections: [wire('w-a', 'l1-battery', 'out', 'glove-a', 'in')] },
    },
  ],
};

// ---------------------------------------------------------------- 2: energy — height into speed

/** Mirror boards left-right about x = axis (a down-right ramp becomes an up-right one). */
const mirror = (boards: ObjectDef[], axis: number): ObjectDef[] => boards.map((b) => ({ ...b, x: 2 * axis - b.x, angle: -b.angle }));
// The fixed climb on the right: a smooth curve off the floor into a straight board up to the ledge.
const L2_DESCENT = smoothRamp('l2-down', 300, 300, 50, 160).boards;
const L2_CLIMB = mirror(smoothRamp('l2-climb', 0, 440, 50, 160).boards, 440);

const heightIntoSpeed: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'energy',
  intro: {
    idea: 'Height is stored energy. Falling or rolling downhill turns it into speed, and rolling uphill turns the speed back into height. A ball can climb back to nearly the height it started from, but never higher.',
    picture: 'A skateboarder in a half-pipe drops in from one lip and rises up the far wall to nearly the same height, then rolls back.',
    challenge: 'The ball rolls off the high shelf. On its own it just drops and bounces on the spot. Give it a ramp so its fall turns into speed, and it will roll across and climb onto the ledge, which is lower than the shelf.',
  },
  level: {
    ...base,
    id: 'lab-height-into-speed',
    name: 'Height into Speed',
    description: 'The ball rolls off the high shelf and plops straight down. Turn that fall into speed so it can climb the curve onto the ledge.',
    environment: 'garage',
    fixedObjects: [
      o('l2-shelf', 'wall', 110, 190, { w: 220, h: 20, material: 'wood' }, 5 * DEG),
      o('l2-shelf-leg', 'wall', 30, 410, { w: 16, h: 420, material: 'wood' }),
      ...L2_DESCENT,
      ...L2_CLIMB,
      o('l2-ledge', 'wall', 1000, 535, { w: 240, h: 190, material: 'brick' }),
    ],
    startingObjects: [o('l2-ball', 'ball', 40, 164)],
    inventory: [{ type: 'plank', count: 1 }],
    goals: [{ kind: 'enterRegion', target: { id: 'l2-ball' }, region: { x: 890, y: 340, w: 220, h: 100 }, hold: 1, label: 'Roll the ball up onto the ledge' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, absurdStages: 0 },
    hints: [
      'Falling straight down gives the ball speed, but all of it pointing down. A ramp turns it sideways.',
      'Lay a short plank from just under the end of the shelf down onto the top of the curved slide, so the ball lands on it and rolls away to the right.',
    ],
    metadata: meta(2, 'What goes down can come back up, nearly.'),
  },
  solutions: [{ objects: [o('plank-a', 'plank', 266, 248, { length: 120 }, 47 * DEG)], connections: [] }],
  counterexamples: [{ why: 'there is no ramp, so the ball just drops', build: { objects: [], connections: [] } }],
};

// ---------------------------------------------------------------- 3: buoyancy — lift-off

const liftOff: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'buoyancy',
  intro: {
    idea: 'Air pushes up on everything in it, with a force equal to the weight of the air that thing pushes aside. A balloon floats because that upward push is bigger than its own weight, and the spare push can lift a load.',
    picture: 'A bunch of helium balloons tied to a toy: one balloon just strains at the string, but add enough and the toy lifts off the floor.',
    challenge: 'Tie balloons to the 3 kg crate until their combined upward push beats its weight. Each balloon’s Lift setting is how hard it pulls.',
  },
  level: {
    ...base,
    id: 'lab-lift-off',
    name: 'Lift-Off',
    description: 'Float the crate up to the line using balloons. Add up the pulls: together they have to beat the crate’s weight.',
    environment: 'greenhouse',
    fixedObjects: [],
    startingObjects: [o('l3-crate', 'crate', 560, 608)],
    inventory: [
      { type: 'balloon', count: 2 },
      { type: 'rope', count: 2 },
    ],
    goals: [{ kind: 'height', target: { id: 'l3-crate' }, maxY: 330, label: 'Float the crate above the line' }],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 4, absurdStages: 0 },
    hints: [
      'One balloon can’t do it, even at full Lift. Two balloons at the normal setting can’t either.',
      'Tie two balloons to the crate’s hook and turn both of their Lift settings up to 2 or more.',
    ],
    metadata: meta(3, 'Enough push from the air beats the weight.'),
  },
  solutions: [
    {
      objects: [o('bal-a', 'balloon', 520, 480, { lift: 2 }), o('bal-b', 'balloon', 600, 480, { lift: 2 })],
      connections: [rope('rope-a', 'bal-a', 'string', 'l3-crate', 'hook'), rope('rope-b', 'bal-b', 'string', 'l3-crate', 'hook')],
    },
  ],
  counterexamples: [
    {
      why: 'one balloon pulls at full Lift',
      build: { objects: [o('bal-a', 'balloon', 560, 480, { lift: 2.5 })], connections: [rope('rope-a', 'bal-a', 'string', 'l3-crate', 'hook')] },
    },
    {
      why: 'two balloons pull at the normal Lift',
      build: {
        objects: [o('bal-a', 'balloon', 520, 480, { lift: 1 }), o('bal-b', 'balloon', 600, 480, { lift: 1 })],
        connections: [rope('rope-a', 'bal-a', 'string', 'l3-crate', 'hook'), rope('rope-b', 'bal-b', 'string', 'l3-crate', 'hook')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4: momentum — heavyweight

const L4_RAMP = smoothRamp('l4-ramp', 20, 140, 50, 260, 'steel');

const heavyweight: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'momentum',
  intro: {
    idea: 'Momentum is mass times velocity. In a collision, momentum is passed from one thing to another, so a heavy thing at the same speed carries far more push than a light one.',
    picture: 'A tennis ball and a bowling ball rolled at the same speed at an empty box: the tennis ball bounces off, the bowling ball shoves the box across the floor.',
    challenge: 'Roll something down the ramp hard enough to shove the crate into the marked zone. Both balls reach the bottom at about the same speed; only one has the momentum.',
  },
  level: {
    ...base,
    id: 'lab-heavyweight',
    name: 'Heavyweight',
    description: 'Shove the 3 kg crate across the floor into the zone. The rubber balls weigh 1 kg; the bowling ball weighs 10.',
    environment: 'basement',
    fixedObjects: [...L4_RAMP.boards, o('l4-stop', 'wall', 1010, 570, { w: 20, h: 120, material: 'brick' })],
    startingObjects: [o('l4-crate', 'crate', 680, 608)],
    inventory: [
      { type: 'ball', count: 3 },
      { type: 'bowling_ball', count: 1 },
    ],
    goals: [{ kind: 'enterRegion', target: { id: 'l4-crate' }, region: { x: 800, y: 540, w: 200, h: 90 }, hold: 0.5, label: 'Shove the crate into the zone' }],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 1, absurdStages: 0 },
    hints: ['Rubber balls bounce off the crate and hand over very little of their momentum.', 'Roll the bowling ball down the ramp.'],
    metadata: meta(4, 'Same speed, ten times the mass.'),
  },
  solutions: [{ objects: [o('bowl-a', 'bowling_ball', 70, 110)], connections: [] }],
  counterexamples: [
    {
      why: 'three rubber balls are rolled at it instead',
      build: { objects: [o('ball-a', 'ball', 60, 100), o('ball-b', 'ball', 120, 160), o('ball-c', 'ball', 180, 225)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 5: lever — light beats heavy

const lightBeatsHeavy: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'lever',
  intro: {
    idea: 'A lever turns about a pivot. What matters is torque: the force times its distance from the pivot. A small weight far out can beat a big weight close in.',
    picture: 'On a playground seesaw, a grown-up sitting close to the middle can be lifted by a child sitting right at the far end.',
    challenge: 'Put the 3 kg crate on the left arm and the 1 kg ball on the right, and make the right end go down onto the pressure plate. Where you put the crate decides who wins.',
  },
  level: {
    ...base,
    id: 'lab-light-beats-heavy',
    name: 'Light Beats Heavy',
    description: 'Make a 1 kg ball outweigh a 3 kg crate on the seesaw, so the right end presses the plate and lights the bulb.',
    environment: 'maintenance',
    fixedObjects: [o('l5-plate', 'pressure_plate', 740, 623, { minMass: 2.5 }), o('l5-bulb', 'light_bulb', 1000, 380)],
    startingObjects: [o('l5-seesaw', 'seesaw', 560, 594, { length: 400 }), o('l5-battery', 'battery', 1000, 601)],
    connections: [wire('l5-w1', 'l5-battery', 'out', 'l5-plate', 'in'), wire('l5-w2', 'l5-plate', 'out', 'l5-bulb', 'in')],
    inventory: [
      { type: 'crate', count: 1 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'l5-bulb' }, duration: 1, label: 'Light the bulb' },
      { kind: 'enterRegion', target: { type: 'crate' }, region: { x: 360, y: 500, w: 200, h: 100 }, hold: 1, label: 'Keep the crate on the left arm' },
    ],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 2, absurdStages: 0 },
    hints: [
      'Torque is weight times distance from the pivot. The ball is 3 times lighter, so it has to be more than 3 times further out.',
      'Put the ball at the very right end, and the crate on the left arm close to the pivot (less than about 60 cm from the middle).',
    ],
    metadata: meta(5, 'Distance from the pivot is a superpower.'),
  },
  solutions: [{ objects: [o('crate-a', 'crate', 530, 566), o('ball-a', 'ball', 736, 574)], connections: [] }],
  counterexamples: [
    { why: 'the crate sits at the far end of its arm', build: { objects: [o('crate-a', 'crate', 400, 566), o('ball-a', 'ball', 736, 574)], connections: [] } },
    { why: 'the crate sits close in but there is no ball', build: { objects: [o('crate-a', 'crate', 530, 566)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 6: pulley — balancing act

const balancingAct: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'pulley',
  intro: {
    idea: 'A rope over a fixed pulley pulls with the same tension on both sides, so the pulley only changes the direction of the pull. Whichever side is heavier goes down; equal weights balance.',
    picture: 'An old lift: the cabin hangs on one side of a big wheel and a heavy counterweight hangs on the other, so the motor barely has to work.',
    challenge: 'The 8 kg steel crate is roped over two pulleys to a 2 kg bucket. Load the bucket until its side is the heavier one, and the crate will rise.',
  },
  level: {
    ...base,
    id: 'lab-balancing-act',
    name: 'Balancing Act',
    description: 'Load the bucket until it outweighs the 8 kg steel crate and hoists it above the line.',
    environment: 'garage',
    fixedObjects: [
      o('l6-beam', 'wall', 560, 50, { w: 420, h: 20, material: 'steel' }),
      o('l6-post-a', 'wall', 440, 72, { w: 12, h: 26, material: 'steel' }),
      o('l6-post-b', 'wall', 680, 72, { w: 12, h: 26, material: 'steel' }),
      o('l6-pulley-a', 'pulley', 440, 100),
      o('l6-pulley-b', 'pulley', 680, 100),
    ],
    startingObjects: [o('l6-crate', 'crate', 440, 608, { material: 'steel' }), o('l6-bucket', 'bucket', 680, 300, { anchored: false })],
    connections: [rope('l6-rope', 'l6-crate', 'hook', 'l6-bucket', 'handle', ['l6-pulley-a', 'l6-pulley-b'])],
    inventory: [
      { type: 'ball', count: 3 },
      { type: 'bowling_ball', count: 1 },
    ],
    goals: [{ kind: 'height', target: { id: 'l6-crate' }, maxY: 430, label: 'Hoist the crate above the line' }],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 2, absurdStages: 0 },
    hints: [
      'Add up each side. Even with all three rubber balls the bucket side is only 2 + 3 = 5 kg against the crate’s 8.',
      'Drop the 10 kg bowling ball into the bucket: 12 kg against 8, and the bucket side wins.',
    ],
    metadata: meta(6, 'A pulley swaps up for down.'),
  },
  solutions: [{ objects: [o('bowl-a', 'bowling_ball', 680, 230)], connections: [] }],
  counterexamples: [
    {
      why: 'all three rubber balls go in the bucket (5 kg against 8)',
      build: { objects: [o('ball-a', 'ball', 664, 230), o('ball-b', 'ball', 696, 230), o('ball-c', 'ball', 680, 196)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 7: gears — opposite day

const oppositeDay: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'gears',
  intro: {
    idea: 'Two meshed gears always turn in opposite directions, while a belt keeps both wheels turning the same way. Each gear in a chain flips the direction once more.',
    picture: 'Hold two meshed cogs and turn one clockwise: the other turns anticlockwise. Add a third and it turns clockwise again.',
    challenge: 'The motor only turns clockwise, which would run the conveyor to the right. Use a gear to reverse it, so the crate rides left into the bin.',
  },
  level: {
    ...base,
    id: 'lab-opposite-day',
    name: 'Opposite Day',
    description: 'The motor turns clockwise and you can’t change it. Get the conveyor running left so the crate drops into the bin.',
    environment: 'research',
    fixedObjects: [
      o('l7-shelf', 'wall', 180, 470, { w: 280, h: 20, material: 'steel' }),
      o('l7-stop', 'wall', 380, 585, { w: 12, h: 90, material: 'steel' }),
    ],
    startingObjects: [
      o('l7-motor', 'motor', 160, 436, { rpm: 40, dir: 'cw' }),
      o('l7-battery', 'battery', 70, 431),
      o('l7-conveyor', 'conveyor', 760, 500, { length: 400, speed: 110, dir: 'right' }),
      o('l7-crate', 'crate', 760, 467),
    ],
    connections: [wire('l7-w1', 'l7-battery', 'out', 'l7-motor', 'in')],
    inventory: [
      { type: 'gear', count: 2 },
      { type: 'belt', count: 1 },
    ],
    goals: [{ kind: 'enterRegion', target: { id: 'l7-crate' }, region: { x: 386, y: 540, w: 174, h: 90 }, hold: 0.5, label: 'Drop the crate off the left end' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, absurdStages: 0 },
    hints: [
      'A belt straight from the motor to the conveyor turns it clockwise too, and the crate rides off to the right.',
      'Mesh one gear with the motor (it turns anticlockwise), then belt that gear to the conveyor’s drive wheel at its left end.',
    ],
    metadata: meta(7, 'Every mesh flips the spin.'),
  },
  solutions: [
    { objects: [o('gear-a', 'gear', 160, 384, { size: 'medium' })], connections: [belt('belt-a', 'gear-a', 'l7-conveyor')] },
  ],
  counterexamples: [
    { why: 'the motor is belted straight to the conveyor', build: { objects: [], connections: [belt('belt-a', 'l7-motor', 'l7-conveyor')] } },
    {
      why: 'two gears in a row flip the direction back',
      build: {
        objects: [o('gear-a', 'gear', 160, 384, { size: 'medium' }), o('gear-b', 'gear', 228, 384, { size: 'medium' })],
        connections: [belt('belt-a', 'gear-b', 'l7-conveyor')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 8: logic — two-key lock

const twoKeyLock: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'logic',
  intro: {
    idea: 'A logic gate makes a decision from its inputs. An AND gate’s output is on only when input A and input B are both on, like two switches in a row on one wire.',
    picture: 'A bank vault that needs two keys turned at once, by two different people, before the door will open.',
    challenge: 'The bulb is wired through an AND gate to two pressure plates. Press both. The right-hand plate is fussy: it needs at least 2.5 kg.',
  },
  level: {
    ...base,
    id: 'lab-two-key-lock',
    name: 'Two-Key Lock',
    description: 'Light the bulb. It only comes on when the AND gate sees both pressure plates pressed at once.',
    environment: 'maintenance',
    fixedObjects: [
      o('l8-ledge', 'wall', 260, 420, { w: 200, h: 20, material: 'steel' }),
      o('l8-plate-a', 'pressure_plate', 260, 401, { minMass: 0.5 }),
      o('l8-plate-b', 'pressure_plate', 800, 621, { minMass: 2.5 }),
      o('l8-gate', 'logic_gate', 560, 260, { mode: 'and' }),
      o('l8-bulb', 'light_bulb', 700, 200),
    ],
    startingObjects: [o('l8-battery', 'battery', 60, 601)],
    connections: [
      wire('l8-w1', 'l8-battery', 'out', 'l8-plate-a', 'in'),
      wire('l8-w2', 'l8-battery', 'out', 'l8-plate-b', 'in'),
      wire('l8-w3', 'l8-plate-a', 'out', 'l8-gate', 'a'),
      wire('l8-w4', 'l8-plate-b', 'out', 'l8-gate', 'b'),
      wire('l8-w5', 'l8-gate', 'out', 'l8-bulb', 'in'),
    ],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'crate', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'l8-bulb' }, duration: 1.5, label: 'Light the bulb for 1.5 s' }],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 2, absurdStages: 0 },
    hints: ['AND means both. One pressed plate is not enough.', 'A ball is heavy enough for the left plate; the right plate needs the 3 kg crate.'],
    metadata: meta(8, 'Both keys, or no light.'),
  },
  solutions: [{ objects: [o('ball-a', 'ball', 260, 370), o('crate-a', 'crate', 800, 590)], connections: [] }],
  counterexamples: [
    { why: 'only the left plate is pressed', build: { objects: [o('ball-a', 'ball', 260, 370)], connections: [] } },
    { why: 'only the right plate is pressed', build: { objects: [o('crate-a', 'crate', 800, 590)], connections: [] } },
    { why: 'two rubber balls sit on the fussy plate', build: { objects: [o('ball-a', 'ball', 260, 370), o('ball-b', 'ball', 800, 600)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 9: electromagnet — sort the metal

const sortTheMetal: LabEntry = {
  chapter: LAB_CHAPTER,
  concept: 'electromagnet',
  intro: {
    idea: 'Electric current flowing through a coil of wire makes a magnetic field. It pulls on iron and steel, ignores rubber and wood, and switches off the moment the current stops.',
    picture: 'A scrapyard crane drops a big round electromagnet onto a pile of junk, lifts the cars, and leaves the plastic behind.',
    challenge: 'An iron ball and a rubber ball roll off the ledge together. Use the electromagnet to tug the iron ball sideways into the right bin while the rubber ball drops straight into the left one.',
  },
  level: {
    ...base,
    id: 'lab-sort-the-metal',
    name: 'Sort the Metal',
    description: 'Sort the balls: iron into the right bin, rubber into the left. An electromagnet only cares about one of them.',
    environment: 'underground',
    fixedObjects: [
      slope('l9-ramp', 40, 200, 460, 300, 'steel'),
      o('l9-bin-a', 'wall', 470, 570, { w: 12, h: 120, material: 'steel' }),
      o('l9-bin-mid', 'wall', 650, 570, { w: 12, h: 120, material: 'steel' }),
      o('l9-bin-b', 'wall', 880, 570, { w: 12, h: 120, material: 'steel' }),
    ],
    startingObjects: [o('l9-rubber', 'ball', 160, 210), o('l9-iron', 'bowling_ball', 80, 190), o('l9-battery', 'battery', 1040, 601)],
    inventory: [{ type: 'magnet', count: 1 }],
    goals: [
      { kind: 'enterRegion', target: { id: 'l9-iron' }, region: { x: 656, y: 510, w: 218, h: 120 }, hold: 1, label: 'Iron ball in the right bin' },
      { kind: 'enterRegion', target: { id: 'l9-rubber' }, region: { x: 476, y: 510, w: 168, h: 120 }, hold: 1, label: 'Rubber ball in the left bin' },
    ],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 1, absurdStages: 0 },
    hints: [
      'Place the electromagnet on the right, facing left, and wire the battery to it. It does nothing until it has current.',
      'Put it above the right bin, a little below the ledge, so it pulls the iron ball across as it falls.',
    ],
    metadata: meta(9, 'Current makes a magnet.'),
  },
  solutions: [
    {
      objects: [o('mag-a', 'magnet', 820, 380, { strength: 8, reach: 360 }, 0, true)],
      connections: [wire('w-a', 'l9-battery', 'out', 'mag-a', 'in')],
    },
  ],
  counterexamples: [
    { why: 'the magnet is placed but never powered', build: { objects: [o('mag-a', 'magnet', 820, 380, { strength: 8, reach: 360 }, 0, true)], connections: [] } },
  ],
};

/** The Physics Lab, in suggested order. Every lesson is open from the start. */
export const LAB: LabEntry[] = [sideways, heightIntoSpeed, liftOff, heavyweight, lightBeatsHeavy, balancingAct, oppositeDay, twoKeyLock, sortTheMetal];

export const labIndex = (id: string) => LAB.findIndex((e) => e.level.id === id);
/** Display code such as "L3". */
export const labCode = (index: number) => (index >= 0 && index < LAB.length ? `L${index + 1}` : '');
