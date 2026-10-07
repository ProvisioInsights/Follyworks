// Pure geometry for on-canvas manipulation of a part, shared by the editor and its tests:
// turning about the centre (knob and corners) and swinging an end about the opposite end
// (end grips of long parts), with angle snapping and the length limits of the size prop.

import type { Vec } from '../core/types';

const DEG = Math.PI / 180;
/** Default drag-rotation step for parts that do not declare their own. */
export const DRAG_ROT_STEP = 5 * DEG;

/** Wrap an angle into (-π, π]. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Snap an angle to multiples of `step` (radians), or to whole degrees when `step` is null
 * (free rotation still lands on readable numbers).
 */
export function snapAngle(a: number, step: number | null): number {
  const s = step ?? DEG;
  return wrapAngle(Math.round(a / s) * s);
}

/** True when an angle sits on a 45° line (0, 45, 90, 135...), where a snap guide is drawn. */
export function onGuideAngle(a: number): boolean {
  const k = a / (45 * DEG);
  return Math.abs(k - Math.round(k)) < 1e-6;
}

/** The angle a part takes when turned about `center` by a pointer that grabbed it `grab` radians off its axis. */
export function rotateAbout(center: Vec, pointer: Vec, grab: number, step: number | null): number {
  return snapAngle(Math.atan2(pointer.y - center.y, pointer.x - center.x) - grab, step);
}

export interface EndDragInput {
  /** Pose when the drag started: centre and angle. */
  x: number;
  y: number;
  angle: number;
  /** Length along the dragged axis when the drag started. */
  length: number;
  /** Local axis of the grabbed end: the width axis ('w', angle) or the height axis ('h', angle + 90°). */
  axis: 'w' | 'h';
  /** Which end was grabbed: +1 the end along the axis, -1 the end against it. */
  sign: 1 | -1;
  /** Where the grabbed end should go (the pointer, minus where it grabbed the grip). */
  pointer: Vec;
  /** Whether the part may turn at all. */
  rotatable: boolean;
  /** Angle snap step in radians, or null for free (1°) angles. */
  step: number | null;
  /** The length prop's range and step, or null when the part has a fixed length. */
  range: { min: number; max: number; step: number } | null;
  /** Shift: keep the length and only turn. */
  lockLength: boolean;
}

export interface EndDragResult {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** The end that stays put. */
  pivot: Vec;
}

/**
 * Drag one end of a long part like the end of a line: the opposite end is the pivot, the part
 * turns to point at the pointer and stretches or shrinks to reach it. Angle and length snap;
 * a part that can't turn only stretches along its own axis, and one with a fixed (or locked)
 * length only turns.
 */
export function endDrag(i: EndDragInput): EndDragResult {
  const off = i.axis === 'h' ? Math.PI / 2 : 0;
  const ax = { x: Math.cos(i.angle + off), y: Math.sin(i.angle + off) };
  const pivot = { x: i.x - ax.x * i.sign * (i.length / 2), y: i.y - ax.y * i.sign * (i.length / 2) };
  const dx = i.pointer.x - pivot.x;
  const dy = i.pointer.y - pivot.y;
  let angle = i.angle;
  if (i.rotatable && Math.hypot(dx, dy) > 1e-6) {
    // the axis direction that puts the grabbed end on the pointer's side of the pivot
    angle = snapAngle(Math.atan2(dy * i.sign, dx * i.sign) - off, i.step);
  }
  const dir = { x: Math.cos(angle + off), y: Math.sin(angle + off) };
  let length = i.length;
  if (i.range && !i.lockLength) {
    // how far the pointer reaches along the (snapped) axis, measured from the pivot
    const along = (dx * dir.x + dy * dir.y) * i.sign;
    const st = i.range.step > 0 ? i.range.step : 1;
    length = Math.min(i.range.max, Math.max(i.range.min, Math.round(along / st) * st));
  }
  return {
    x: pivot.x + dir.x * i.sign * (length / 2),
    y: pivot.y + dir.y * i.sign * (length / 2),
    angle,
    length,
    pivot,
  };
}
