// The GOOGLYEYES cheat: a pair of googly eyes stuck on every part. Purely visual, drawn each frame
// in world space over the parts; each pupil is a little damped spring that sags with gravity and
// sloshes when its part is thrown about, then rattles against the rim of the eye.

import Phaser from 'phaser';
import type { EntityView } from './views';

interface Pupil {
  /** Offset from the eye centre (world units) and its velocity. */
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Eyes {
  pupils: [Pupil, Pupil];
  /** Last world position of each eye, to feel the part accelerating. */
  last: [{ x: number; y: number; vx: number; vy: number } | null, { x: number; y: number; vx: number; vy: number } | null];
}

/** Weak pull to the centre, damping, and the "gravity" that sags the pupil to the bottom. */
const SPRING = 10;
const DAMP = 3.5;
const SAG = 600;
/** How strongly the part's own acceleration throws the pupil about. */
const SLOSH = 0.6;

export class GooglyEyes {
  private g: Phaser.GameObjects.Graphics;
  private eyes = new Map<string, Eyes>();
  enabled = false;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.g = scene.add.graphics();
    layer.add(this.g);
  }

  /** Forget every pupil (a new simulation was shown). */
  reset() {
    this.eyes.clear();
  }

  draw(views: Iterable<EntityView>, alpha: number, dt: number) {
    const g = this.g;
    g.clear();
    if (!this.enabled) return;
    const step = Math.min(dt, 1 / 30);
    for (const v of views) {
      const e = v.entity;
      if (!e.alive) continue;
      const size = e.def.size(e.props);
      const w = Math.max(8, size.w);
      const hgt = Math.max(8, size.h);
      const R = Phaser.Math.Clamp(Math.min(w * 0.2, hgt * 0.32), 4.5, 11);
      const gap = R * 1.08;
      // Eyes sit in the upper middle of the part's own frame, so they turn with it.
      const ly = Math.max(-hgt / 2 + R + 1, -hgt * 0.18);
      const f = v.pose(alpha);
      const c = Math.cos(f.rot);
      const s = Math.sin(f.rot);
      let st = this.eyes.get(e.id);
      if (!st) this.eyes.set(e.id, (st = { pupils: [pupil(), pupil()], last: [null, null] }));
      for (let k = 0; k < 2; k++) {
        const lx = k === 0 ? -gap : gap;
        const ex = f.x + lx * c - ly * s;
        const ey = f.y + lx * s + ly * c;
        // acceleration of the eye itself, felt by the pupil as a push the other way
        let ax = 0;
        let ay = 0;
        const prev = st.last[k];
        if (prev && step > 0) {
          const vx = (ex - prev.x) / step;
          const vy = (ey - prev.y) / step;
          ax = Phaser.Math.Clamp((vx - prev.vx) / step, -8000, 8000);
          ay = Phaser.Math.Clamp((vy - prev.vy) / step, -8000, 8000);
          st.last[k] = { x: ex, y: ey, vx, vy };
        } else st.last[k] = { x: ex, y: ey, vx: 0, vy: 0 };
        const p = st.pupils[k];
        const pr = R * 0.52;
        const room = R - pr - 0.6;
        p.vx += (-SPRING * p.x - DAMP * p.vx - ax * SLOSH) * step;
        p.vy += (-SPRING * p.y - DAMP * p.vy + SAG - ay * SLOSH) * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        const d = Math.hypot(p.x, p.y);
        if (d > room) {
          // rattle off the rim
          const nx = p.x / d;
          const ny = p.y / d;
          p.x = nx * room;
          p.y = ny * room;
          const vn = p.vx * nx + p.vy * ny;
          if (vn > 0) {
            p.vx -= 1.6 * vn * nx;
            p.vy -= 1.6 * vn * ny;
          }
        }
        g.fillStyle(0x000000, 0.28);
        g.fillCircle(ex + 0.8, ey + 1.2, R + 0.6);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(ex, ey, R);
        g.lineStyle(Math.max(1, R * 0.14), 0x1a1a1a, 0.9);
        g.strokeCircle(ex, ey, R);
        g.fillStyle(0x111111, 1);
        g.fillCircle(ex + p.x, ey + p.y, pr);
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(ex + p.x - pr * 0.35, ey + p.y - pr * 0.35, pr * 0.28);
      }
    }
  }
}

const pupil = (): Pupil => ({ x: 0, y: 0, vx: 0, vy: 0 });
