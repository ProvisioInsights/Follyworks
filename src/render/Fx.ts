// Lightweight pooled particle system, floating chain-reaction labels and camera shake.
// Hand-rolled (not Phaser emitters) so behaviour is identical across renderer versions and
// so the total particle budget is strictly capped.

import Phaser from 'phaser';
import type { SimEvent } from '../sim/Simulation';

const MAX_PARTICLES = 420;

interface P {
  img: Phaser.GameObjects.Image;
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
  rot: number;
  vr: number;
  stretch: boolean;
}

interface Label {
  text: Phaser.GameObjects.Text;
  x: number;
  y: number;
  age: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  gravity: '#f3d9a4',
  mechanical: '#f0b35a',
  air: '#bfe8ff',
  heat: '#ff9a5a',
  electric: '#7fe6ff',
  logic: '#a6f08a',
  chaos: '#ff7062',
  creature: '#ffd36b',
  light: '#ff7ad9',
};

export const domainColor = (d: string) => DOMAIN_COLORS[d] ?? '#f3e6cc';

export class Fx {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private addLayer: Phaser.GameObjects.Container;
  private pool: P[] = [];
  private labels: Label[] = [];
  private rngState = 1;
  reducedMotion = false;
  labelsEnabled = true;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, addLayer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
    this.addLayer = addLayer;
  }

  private rnd() {
    this.rngState = (this.rngState * 16807) % 2147483647;
    return this.rngState / 2147483647;
  }
  private range(a: number, b: number) {
    return a + (b - a) * this.rnd();
  }

  private spawn(tex: string, additive: boolean, o: Partial<Omit<P, 'img' | 'live'>> & { x: number; y: number; tint?: number }) {
    let p = this.pool.find((q) => !q.live && (q.img.blendMode === Phaser.BlendModes.ADD) === additive);
    if (!p) {
      if (this.pool.length >= MAX_PARTICLES) {
        // recycle the oldest-lived particle
        p = this.pool.reduce((a, b) => (a.life / a.max > b.life / b.max ? a : b));
      } else {
        const img = this.scene.add.image(0, 0, tex);
        if (additive) {
          img.setBlendMode(Phaser.BlendModes.ADD);
          this.addLayer.add(img);
        } else this.layer.add(img);
        p = { img } as P;
        this.pool.push(p);
      }
    }
    if ((p.img.blendMode === Phaser.BlendModes.ADD) !== additive) {
      p.img.setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      (additive ? this.addLayer : this.layer).add(p.img);
    }
    p.img.setTexture(tex);
    p.img.setVisible(true);
    if (o.tint !== undefined) p.img.setTint(o.tint);
    else p.img.clearTint();
    Object.assign(p, {
      live: true,
      vx: 0,
      vy: 0,
      g: 0,
      drag: 0,
      life: 0,
      max: 0.6,
      s0: 10,
      s1: 10,
      a0: 1,
      rot: 0,
      vr: 0,
      stretch: false,
      ...o,
    });
    p.img.setPosition(p.x, p.y);
    return p;
  }

  event(ev: SimEvent) {
    if (ev.t === 'fx') this.burst(ev.kind, ev.x, ev.y, ev.dx ?? 0, ev.dy ?? 0, ev.scale ?? 1);
    else if (ev.t === 'shake') this.shake(ev.amount);
    else if (ev.t === 'activate' && this.labelsEnabled) this.label(ev.label, ev.x, ev.y, ev.domain);
  }

  shake(amount: number) {
    if (this.reducedMotion) return;
    this.scene.cameras.main.shake(120 + amount * 220, 0.002 + amount * 0.008);
  }

  label(text: string, x: number, y: number, domain: string) {
    if (this.labels.length >= 6) {
      const old = this.labels.shift()!;
      old.text.destroy();
    }
    const t = this.scene.add.text(x, y - 34, text, {
      fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif',
      fontSize: '17px',
      fontStyle: '600',
      color: domainColor(domain),
      stroke: '#120d0a',
      strokeThickness: 4,
    });
    t.setOrigin(0.5, 1);
    t.setResolution(3);
    this.layer.add(t);
    // avoid stacking directly on top of a recent label
    for (const l of this.labels) if (Math.abs(l.x - x) < 90 && Math.abs(l.y - (y - 34)) < 22) y -= 22;
    this.labels.push({ text: t, x, y: y - 34, age: 0 });
  }

  clear() {
    for (const p of this.pool) {
      p.live = false;
      p.img.setVisible(false);
    }
    for (const l of this.labels) l.text.destroy();
    this.labels = [];
  }

  burst(kind: string, x: number, y: number, dx: number, dy: number, scale: number) {
    const R = this.range.bind(this);
    switch (kind) {
      case 'explosion': {
        const s = Math.max(0.6, scale);
        this.spawn('fx_glow_warm', true, { x, y, s0: 160 * s, s1: 260 * s, max: 0.35, a0: 1 });
        this.spawn('fx_ring', true, { x, y, s0: 20, s1: 280 * s, max: 0.35, a0: 0.8, tint: 0xffd9a0 });
        for (let i = 0; i < 34; i++) {
          const a = R(0, Math.PI * 2);
          const v = R(300, 900) * s;
          this.spawn('fx_spark', true, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, drag: 1.5, max: R(0.3, 0.8), s0: R(10, 22), s1: 4, stretch: true });
        }
        for (let i = 0; i < 16; i++) {
          const a = R(0, Math.PI * 2);
          const v = R(40, 220) * s;
          this.spawn('fx_smoke', false, { x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: -40, drag: 2.2, max: R(1.2, 2.4), s0: R(30, 50) * s, s1: R(90, 160) * s, a0: 0.9, tint: 0x5a4f48, rot: R(0, 6), vr: R(-1, 1) });
        }
        for (let i = 0; i < 10; i++) {
          const a = R(0, Math.PI * 2);
          const v = R(200, 500) * s;
          this.spawn('fx_square', false, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, g: 1200, drag: 0.4, max: R(0.8, 1.4), s0: R(4, 8), s1: R(3, 6), tint: 0x2a221c, rot: R(0, 6), vr: R(-12, 12) });
        }
        break;
      }
      case 'pop': {
        this.spawn('fx_ring', true, { x, y, s0: 10, s1: 70, max: 0.18, a0: 0.7 });
        for (let i = 0; i < 12; i++) {
          const a = R(0, Math.PI * 2);
          const v = R(150, 420);
          this.spawn('fx_square', false, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, drag: 2, max: R(0.5, 0.9), s0: R(5, 9), s1: 3, tint: [0xd8443a, 0xe9b93a, 0x3ab0a6][i % 3], rot: R(0, 6), vr: R(-20, 20) });
        }
        break;
      }
      case 'sparks':
      case 'zap': {
        const n = kind === 'zap' ? 8 : 12;
        if (kind === 'zap') this.spawn('fx_glow_cyan', true, { x, y, s0: 50, s1: 80, max: 0.2 });
        for (let i = 0; i < n; i++) {
          const a = R(0, Math.PI * 2);
          const v = R(150, 450);
          this.spawn('fx_spark', true, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, g: 1000, drag: 1, max: R(0.2, 0.5), s0: R(8, 14), s1: 3, stretch: true, tint: kind === 'zap' ? 0x9ff4ff : undefined });
        }
        break;
      }
      case 'smoke':
        for (let i = 0; i < 6; i++) this.spawn('fx_smoke', false, { x: x + R(-8, 8), y: y + R(-8, 8), vx: R(-30, 30), vy: R(-80, -30), g: -20, drag: 1.5, max: R(1, 1.8), s0: 20, s1: R(60, 90), a0: 0.7, tint: 0x6a6058, rot: R(0, 6), vr: R(-1, 1) });
        break;
      case 'puff':
      case 'dust':
        for (let i = 0; i < 5; i++) this.spawn('fx_smoke', false, { x: x + R(-6, 6), y, vx: R(-120, 120), vy: R(-50, -10), drag: 3, max: R(0.4, 0.8), s0: 10, s1: R(26, 40), a0: 0.5, tint: 0xc9b8a0, rot: R(0, 6) });
        break;
      case 'burn':
        this.spawn('fx_glow_warm', true, { x, y, s0: 40, s1: 70, max: 0.3 });
        for (let i = 0; i < 8; i++) this.spawn('fx_dot', true, { x, y, vx: R(-60, 60), vy: R(-160, -40), g: -50, max: R(0.4, 0.9), s0: R(3, 6), s1: 1, tint: 0xffa040 });
        this.burst('smoke', x, y, 0, 0, 1);
        break;
      case 'muzzle': {
        const l = Math.hypot(dx, dy) || 1;
        const ux = dx / l;
        const uy = dy / l;
        this.spawn('fx_glow_warm', true, { x: x + ux * 10, y: y + uy * 10, s0: 70, s1: 110, max: 0.15 });
        for (let i = 0; i < 8; i++) {
          const v = R(60, 260);
          this.spawn('fx_smoke', false, { x, y, vx: ux * v + R(-40, 40), vy: uy * v + R(-40, 40), drag: 2.5, max: R(0.8, 1.5), s0: 16, s1: R(50, 80), a0: 0.75, tint: 0x8a8078, rot: R(0, 6), vr: R(-1, 1) });
        }
        break;
      }
      case 'exhaust': {
        if (this.rnd() < 0.5) {
          const l = Math.hypot(dx, dy) || 1;
          this.spawn('fx_smoke', false, { x, y, vx: (dx / l) * 120 + R(-20, 20), vy: (dy / l) * 120 + R(-20, 20), drag: 2, max: R(0.6, 1.1), s0: 10, s1: R(30, 50), a0: 0.5, tint: 0x9a9088, rot: R(0, 6) });
        }
        break;
      }
      case 'confetti':
        for (let i = 0; i < 70; i++) {
          const a = R(-Math.PI * 0.95, -Math.PI * 0.05);
          const v = R(300, 800);
          this.spawn('fx_square', false, { x: x + R(-30, 30), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 700, drag: 2.2, max: R(1.4, 2.4), s0: R(6, 10), s1: R(5, 8), tint: [0xf2c043, 0xe0543c, 0x4fdcf5, 0x7cf0a0, 0xe07ad0, 0xfff2d8][i % 6], rot: R(0, 6), vr: R(-14, 14) });
        }
        break;
      case 'bounce':
        this.spawn('fx_ring', true, { x, y, s0: 8, s1: 46, max: 0.2, a0: 0.5 });
        break;
      default:
        break;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.live) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.live = false;
        p.img.setVisible(false);
        continue;
      }
      const k = p.life / p.max;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const s = p.s0 + (p.s1 - p.s0) * k;
      p.img.setPosition(p.x, p.y);
      if (p.stretch) {
        const sp = Math.hypot(p.vx, p.vy);
        p.img.setRotation(Math.atan2(p.vy, p.vx));
        p.img.setDisplaySize(Math.max(s, s * (0.6 + sp / 300)), Math.max(2, s * 0.35));
      } else {
        p.img.setRotation(p.rot);
        p.img.setDisplaySize(s, s);
      }
      p.img.setAlpha(p.a0 * (k < 0.1 ? 1 : 1 - (k - 0.1) / 0.9));
    }
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      l.age += dt;
      const k = l.age / 1.8;
      l.text.setPosition(l.x, l.y - 30 * Math.min(1, l.age * 1.5));
      l.text.setAlpha(k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1);
      // keep labels a readable size on screen whatever the camera zoom
      const inv = Math.min(2.4, Math.max(0.8, 1 / this.scene.cameras.main.zoom));
      l.text.setScale(inv * (l.age < 0.12 ? 0.7 + (l.age / 0.12) * 0.3 : 1));
      if (k >= 1) {
        l.text.destroy();
        this.labels.splice(i, 1);
      }
    }
  }
}
