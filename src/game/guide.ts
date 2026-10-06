// Tutorial guidance progress: which step of a level's optional guide the player is on.
// Pure logic so it can be tested headlessly. Guidance never restricts the player; steps are
// simply skipped once what they ask for is already true.

import type { BuildDef, GuideStep, GuideTrigger } from '../core/types';

export interface GuideProgress {
  /** The player has pressed RUN at least once. */
  ran: boolean;
  /** Indexes of 'ack' steps the player dismissed with "Got it". */
  acked: Set<number>;
}

const PLACE_RADIUS = 70;
const ANGLE_TOL = 0.2;

/** Smallest difference between two angles, treating a half turn as the same pose (planks, trampolines). */
export const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
};

export const triggerMet = (t: GuideTrigger, build: BuildDef, p: GuideProgress, index: number): boolean => {
  switch (t.kind) {
    case 'place':
      return build.objects.some(
        (o) =>
          o.type === t.type &&
          (!t.at || Math.hypot(o.x - t.at.x, o.y - t.at.y) <= (t.radius ?? PLACE_RADIUS)) &&
          (t.angle === undefined || angleGap(o.angle ?? 0, t.angle) <= (t.angleTol ?? ANGLE_TOL)),
      );
    case 'connect':
      return build.connections.some((c) => c.kind === t.connection);
    case 'run':
      return p.ran;
    case 'ack':
      return p.acked.has(index);
  }
};

/** Index of the first step whose trigger is not yet met (steps.length when the guide is finished). */
export const currentGuideStep = (steps: GuideStep[], build: BuildDef, p: GuideProgress): number => {
  for (let i = 0; i < steps.length; i++) if (!triggerMet(steps[i].until, build, p, i)) return i;
  return steps.length;
};
