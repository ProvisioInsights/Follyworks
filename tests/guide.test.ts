import { describe, expect, it } from 'vitest';
import type { BuildDef, GuideStep } from '../src/core/types';
import { angleGap, currentGuideStep, type GuideProgress } from '../src/game/guide';

const steps: GuideStep[] = [
  { text: 'Drag a plank here', until: { kind: 'place', type: 'plank', at: { x: 300, y: 300 } } },
  { text: 'Tilt it', until: { kind: 'place', type: 'plank', at: { x: 300, y: 300 }, angle: Math.PI / 6 } },
  { text: 'Read this', until: { kind: 'ack' } },
  { text: 'Run it', until: { kind: 'run' } },
];
const fresh = (): GuideProgress => ({ ran: false, acked: new Set() });
const plank = (x: number, y: number, angle = 0): BuildDef => ({ objects: [{ id: 'p', type: 'plank', x, y, angle }], connections: [] });

describe('tutorial guidance progress', () => {
  it('starts at the first step and moves on as the build changes', () => {
    const p = fresh();
    expect(currentGuideStep(steps, { objects: [], connections: [] }, p)).toBe(0);
    expect(currentGuideStep(steps, plank(900, 300), p)).toBe(0);
    expect(currentGuideStep(steps, plank(330, 320), p)).toBe(1);
    expect(currentGuideStep(steps, plank(330, 320, Math.PI / 6 + 0.1), p)).toBe(2);
    p.acked.add(2);
    expect(currentGuideStep(steps, plank(330, 320, Math.PI / 6), p)).toBe(3);
    p.ran = true;
    expect(currentGuideStep(steps, plank(330, 320, Math.PI / 6), p)).toBe(4);
  });

  it('goes back a step if the player removes what a step asked for', () => {
    const p = fresh();
    expect(currentGuideStep(steps, plank(300, 300, Math.PI / 6), p)).toBe(2);
    expect(currentGuideStep(steps, { objects: [], connections: [] }, p)).toBe(0);
  });

  it('treats a half-turned plank as the same slope', () => {
    expect(angleGap(0.5, 0.5 + Math.PI)).toBeCloseTo(0);
    expect(angleGap(-0.1, 0.1)).toBeCloseTo(0.2);
  });
});
