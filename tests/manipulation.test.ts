// On-canvas manipulation geometry (src/game/manipulation.ts): swinging an end of a long part
// about the opposite end, turning about the centre, and angle snapping.

import { describe, expect, it } from 'vitest';
import { DRAG_ROT_STEP, endDrag, onGuideAngle, rotateAbout, snapAngle, type EndDragInput } from '../src/game/manipulation';

const DEG = Math.PI / 180;
const plank = (over: Partial<EndDragInput> = {}): EndDragInput => ({
  x: 500,
  y: 300,
  angle: 0,
  length: 160,
  axis: 'w',
  sign: 1,
  pointer: { x: 580, y: 300 },
  rotatable: true,
  step: 5 * DEG,
  range: { min: 40, max: 600, step: 10 },
  lockLength: false,
  ...over,
});
/** Both ends of a result along the given axis. */
const endsOf = (r: { x: number; y: number; angle: number; length: number }, axis: 'w' | 'h' = 'w') => {
  const a = r.angle + (axis === 'h' ? Math.PI / 2 : 0);
  const u = { x: Math.cos(a), y: Math.sin(a) };
  return {
    minus: { x: r.x - (u.x * r.length) / 2, y: r.y - (u.y * r.length) / 2 },
    plus: { x: r.x + (u.x * r.length) / 2, y: r.y + (u.y * r.length) / 2 },
  };
};

describe('end drag (swing an end about the other end)', () => {
  it('keeps the opposite end put while the grabbed end follows the pointer', () => {
    const at = { x: 420 + Math.cos(30 * DEG) * 220, y: 300 + Math.sin(30 * DEG) * 220 };
    const r = endDrag(plank({ pointer: at }));
    expect(r.angle).toBeCloseTo(30 * DEG, 9);
    expect(r.length).toBe(220);
    const e = endsOf(r);
    expect(e.minus.x).toBeCloseTo(420, 9);
    expect(e.minus.y).toBeCloseTo(300, 9);
    expect(e.plus.x).toBeCloseTo(at.x, 6);
    expect(e.plus.y).toBeCloseTo(at.y, 6);
    expect(r.pivot).toEqual({ x: 420, y: 300 });
  });

  it('swings the left end about the right end', () => {
    // the right end is at (580, 300); put the left end up and to the left at 45°
    const r = endDrag(plank({ sign: -1, pointer: { x: 580 - 100, y: 300 - 100 } }));
    expect(r.angle).toBeCloseTo(45 * DEG, 9);
    expect(r.length).toBe(140); // 141.4 rounds to the 10 cm step
    const e = endsOf(r);
    expect(e.plus.x).toBeCloseTo(580, 9);
    expect(e.plus.y).toBeCloseTo(300, 9);
  });

  it('works from an already turned part, and swinging past the pivot flips the part over', () => {
    const start = plank({ angle: 60 * DEG });
    const pivot = endsOf({ ...start, length: 160 }).minus;
    const r = endDrag({ ...start, pointer: { x: pivot.x - 200, y: pivot.y } });
    expect(Math.abs(r.angle)).toBeCloseTo(Math.PI, 9);
    expect(r.length).toBe(200);
    expect(r.pivot.x).toBeCloseTo(pivot.x, 9);
    expect(endsOf(r).minus.x).toBeCloseTo(pivot.x, 9);
    expect(endsOf(r).minus.y).toBeCloseTo(pivot.y, 9);
  });

  it('snaps the angle to the part step, and to whole degrees when free', () => {
    const p = { x: 420 + Math.cos(33 * DEG) * 200, y: 300 + Math.sin(33 * DEG) * 200 };
    expect(endDrag(plank({ pointer: p })).angle).toBeCloseTo(35 * DEG, 9);
    expect(endDrag(plank({ pointer: p, step: 15 * DEG })).angle).toBeCloseTo(30 * DEG, 9);
    expect(endDrag(plank({ pointer: p, step: null })).angle).toBeCloseTo(33 * DEG, 9);
  });

  it('clamps the length to the prop range and rounds to its step', () => {
    expect(endDrag(plank({ pointer: { x: 2000, y: 300 } })).length).toBe(600);
    expect(endDrag(plank({ pointer: { x: 430, y: 300 } })).length).toBe(40);
    expect(endDrag(plank({ pointer: { x: 600.4, y: 300 } })).length).toBe(180);
    expect(endDrag(plank({ pointer: { x: 600.4, y: 300 }, range: { min: 40, max: 600, step: 1 } })).length).toBe(180);
    expect(endDrag(plank({ pointer: { x: 603.6, y: 300 }, range: { min: 40, max: 600, step: 1 } })).length).toBe(184);
  });

  it('still turns about the opposite end at its min or max length', () => {
    const r = endDrag(plank({ pointer: { x: 420 + 2000 * Math.cos(-20 * DEG), y: 300 + 2000 * Math.sin(-20 * DEG) } }));
    expect(r.length).toBe(600);
    expect(r.angle).toBeCloseTo(-20 * DEG, 9);
    expect(endsOf(r).minus.x).toBeCloseTo(420, 9);
    expect(endsOf(r).minus.y).toBeCloseTo(300, 9);
  });

  it('Shift (lockLength) only turns', () => {
    const r = endDrag(plank({ lockLength: true, pointer: { x: 420 + 400 * Math.cos(-20 * DEG), y: 300 + 400 * Math.sin(-20 * DEG) } }));
    expect(r.length).toBe(160);
    expect(r.angle).toBeCloseTo(-20 * DEG, 9);
    expect(endsOf(r).minus.x).toBeCloseTo(420, 9);
  });

  it('a fixed-length part only turns', () => {
    const r = endDrag(plank({ range: null, pointer: { x: 420, y: 500 } }));
    expect(r.length).toBe(160);
    expect(r.angle).toBeCloseTo(90 * DEG, 9);
    expect(endsOf(r).minus.y).toBeCloseTo(300, 9);
  });

  it('a part that cannot turn only stretches along its own axis', () => {
    const r = endDrag(plank({ rotatable: false, pointer: { x: 640, y: 420 } }));
    expect(r.angle).toBe(0);
    expect(r.length).toBe(220);
    expect(r.y).toBe(300);
    expect(endsOf(r).minus.x).toBeCloseTo(420, 9);
  });

  it('swings along the height axis (a tall wall)', () => {
    // a 40 x 200 wall standing up: its long axis is 'h', the top end is sign -1
    const wall = plank({ axis: 'h', length: 200, sign: -1, range: { min: 6, max: 1200, step: 10 } });
    const bottom = { x: 500, y: 400 };
    const r = endDrag({ ...wall, pointer: { x: bottom.x + 150, y: bottom.y - 150 } });
    // the wall leans 45° to the right: its height axis now points down-left
    expect(r.angle).toBeCloseTo(45 * DEG, 9);
    expect(endsOf(r, 'h').plus.x).toBeCloseTo(bottom.x, 9);
    expect(endsOf(r, 'h').plus.y).toBeCloseTo(bottom.y, 9);
    expect(r.length).toBe(210);
  });
});

describe('turning about the centre', () => {
  it('keeps the grab offset and snaps', () => {
    const c = { x: 100, y: 100 };
    // grabbed the knob straight above the centre (-90° off a level part)
    const grab = -Math.PI / 2;
    expect(rotateAbout(c, { x: 100 + 50 * Math.cos(-58 * DEG), y: 100 + 50 * Math.sin(-58 * DEG) }, grab, DRAG_ROT_STEP)).toBeCloseTo(30 * DEG, 9);
    expect(rotateAbout(c, { x: 100 + 50 * Math.cos(-58 * DEG), y: 100 + 50 * Math.sin(-58 * DEG) }, grab, null)).toBeCloseTo(32 * DEG, 9);
  });

  it('wraps angles and spots the 45° guide lines', () => {
    expect(snapAngle(370 * DEG, 5 * DEG)).toBeCloseTo(10 * DEG, 9);
    expect(onGuideAngle(snapAngle(-135 * DEG, 5 * DEG))).toBe(true);
    expect(onGuideAngle(90 * DEG)).toBe(true);
    expect(onGuideAngle(30 * DEG)).toBe(false);
  });
});
