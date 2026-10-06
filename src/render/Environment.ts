// Painted workshop backdrop: far wall, additive light pass, ambient animation, near-layer
// silhouettes with slight parallax. Pure decoration — never affects gameplay.

import Phaser from 'phaser';
import { ENV_MARGIN, paintEnvironment, type AmbientEmitter } from './art/environment';

const ENV_SCALE = 1.25;

interface Drop {
  em: AmbientEmitter;
  y: number;
  vy: number;
  wait: number;
}

export class EnvironmentView {
  private scene: Phaser.Scene;
  private far: Phaser.GameObjects.Image | null = null;
  private light: Phaser.GameObjects.Image | null = null;
  private near: Phaser.GameObjects.Image | null = null;
  private ambientFar: Phaser.GameObjects.Graphics;
  private ambientNear: Phaser.GameObjects.Graphics;
  private emitters: AmbientEmitter[] = [];
  private drops: Drop[] = [];
  private motes: { x: number; y: number; vx: number; vy: number; a: number; em: AmbientEmitter }[] = [];
  private key = '';
  private w = 0;
  private h = 0;
  reducedMotion = false;

  constructor(scene: Phaser.Scene, back: Phaser.GameObjects.Container, front: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.ambientFar = scene.add.graphics();
    this.ambientNear = scene.add.graphics();
    back.add(this.ambientFar);
    front.add(this.ambientNear);
    this.back = back;
    this.front = front;
  }
  private back: Phaser.GameObjects.Container;
  private front: Phaser.GameObjects.Container;

  /** (Re)paint when the environment id or world size changed. */
  set(id: string, w: number, h: number) {
    const key = `${id}:${w}x${h}`;
    if (key === this.key) return;
    this.key = key;
    this.w = w;
    this.h = h;
    this.far?.destroy();
    this.light?.destroy();
    this.near?.destroy();
    const layers = paintEnvironment(id, w, h, ENV_SCALE);
    const texKey = (n: string) => `env:${key}:${n}`;
    const add = (name: string, canvas: HTMLCanvasElement) => {
      const k = texKey(name);
      if (!this.scene.textures.exists(k)) this.scene.textures.addCanvas(k, canvas);
      const img = this.scene.add.image(-ENV_MARGIN.left, -ENV_MARGIN.top, k).setOrigin(0, 0);
      img.setDisplaySize(w + ENV_MARGIN.left + ENV_MARGIN.right, h + ENV_MARGIN.top + ENV_MARGIN.bottom);
      return img;
    };
    this.far = add('far', layers.far);
    this.light = add('light', layers.light).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    this.near = add('near', layers.near);
    this.back.addAt(this.far, 0);
    this.back.addAt(this.light, 1);
    this.front.addAt(this.near, 0);
    this.emitters = layers.ambient;
    this.drops = this.emitters.filter((e) => e.kind === 'drip').map((em, i) => ({ em, y: em.y, vy: 0, wait: 1 + i * 0.7 }));
    this.motes = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const em of this.emitters.filter((e) => e.kind === 'dust')) {
      for (let i = 0; i < 18; i++) {
        this.motes.push({ x: em.x + rnd() * (em.w ?? 200), y: em.y + rnd() * (em.h ?? 200), vx: (rnd() - 0.5) * 6, vy: (rnd() - 0.5) * 4, a: rnd(), em });
      }
    }
  }

  /** Remove textures for environments no longer shown (keeps GPU memory bounded). */
  purgeExcept(keep: string) {
    for (const k of this.scene.textures.getTextureKeys()) {
      if (k.startsWith('env:') && !k.startsWith(`env:${keep}:`)) this.scene.textures.remove(k);
    }
  }

  get currentKey() {
    return this.key;
  }

  update(t: number, dt: number, cam: Phaser.Cameras.Scene2D.Camera) {
    // Near layer parallax: drift slightly against the camera centre.
    if (this.near) {
      const cx = cam.midPoint.x - this.w / 2;
      const cy = cam.midPoint.y - this.h / 2;
      this.near.setPosition(-ENV_MARGIN.left - cx * 0.05, -ENV_MARGIN.top - cy * 0.04);
    }
    const g = this.ambientFar;
    const gn = this.ambientNear;
    g.clear();
    gn.clear();
    const still = this.reducedMotion;
    let flick = 0;
    for (const em of this.emitters) {
      const gg = em.layer === 'near' ? gn : g;
      const col = em.color ?? 0xffd890;
      const period = em.period ?? 2;
      switch (em.kind) {
        case 'blink': {
          const on = still ? 0.7 : 0.35 + 0.65 * Math.max(0, Math.sin((t / period) * Math.PI * 2 + em.x));
          const r = em.size ?? 3;
          gg.fillStyle(col, 0.25 * on);
          gg.fillCircle(em.x, em.y, r * 3);
          gg.fillStyle(col, 0.9 * on);
          gg.fillCircle(em.x, em.y, r);
          break;
        }
        case 'flicker': {
          const f = still ? 0 : Math.sin(t * 31 + em.x) * Math.sin(t * 7 + em.y) > 0.82 ? 1 : 0;
          flick = Math.max(flick, f);
          if (f) {
            gg.fillStyle(0x000000, 0.18);
            gg.fillRect(em.x - (em.w ?? 100) / 2, em.y - (em.h ?? 100) / 2, em.w ?? 100, em.h ?? 100);
          }
          break;
        }
        case 'monitor': {
          const w = em.w ?? 40;
          const h = em.h ?? 30;
          const scan = still ? 0.5 : (t / period) % 1;
          gg.fillStyle(col, 0.06 + 0.04 * Math.sin(t * 3 + em.x));
          gg.fillRect(em.x, em.y, w, h);
          gg.fillStyle(col, 0.25);
          gg.fillRect(em.x, em.y + scan * h, w, 1.5);
          // a few text-ish blips
          for (let i = 0; i < 4; i++) {
            const lw = (Math.sin(Math.floor(t * 1.5) * 3.1 + i * 7.7 + em.x) * 0.5 + 0.5) * w * 0.7;
            gg.fillRect(em.x + 4, em.y + 5 + i * (h / 5), lw, 1.5);
          }
          break;
        }
        case 'fan': {
          const r = em.size ?? 14;
          const a0 = still ? 0 : t * 9;
          gg.fillStyle(0x15110e, 0.8);
          for (let i = 0; i < 4; i++) {
            const a = a0 + (i * Math.PI) / 2;
            gg.fillTriangle(em.x, em.y, em.x + Math.cos(a) * r, em.y + Math.sin(a) * r, em.x + Math.cos(a + 0.6) * r, em.y + Math.sin(a + 0.6) * r);
          }
          break;
        }
        case 'sway': {
          const s = still ? 0 : Math.sin(t * 1.3 + em.x) * 3;
          gg.lineStyle(2, 0x0c0907, 0.85);
          gg.lineBetween(em.x, em.y - 40, em.x + s, em.y);
          break;
        }
        case 'steam': {
          if (still) break;
          for (let i = 0; i < 5; i++) {
            const ph = (t / (period || 3) + i / 5) % 1;
            gg.fillStyle(0xe8e4dc, 0.12 * (1 - ph));
            gg.fillCircle(em.x + Math.sin(ph * 6 + i) * 6 * ph, em.y - ph * 70, 5 + ph * 16);
          }
          break;
        }
        case 'spark': {
          if (still) break;
          const p = (t / (period || 2.7)) % 1;
          if (p < 0.08) {
            gg.fillStyle(col, 0.5 * (1 - p / 0.08));
            gg.fillCircle(em.x, em.y, 20);
            gg.lineStyle(1.5, 0xf0e6ff, 0.9);
            let x = em.x;
            let y = em.y;
            for (let i = 0; i < 4; i++) {
              const nx = x + Math.sin(t * 90 + i * 2.1) * 9;
              const ny = y + 6 + i * 2;
              gg.lineBetween(x, y, nx, ny);
              x = nx;
              y = ny;
            }
          }
          break;
        }
        default:
          break;
      }
    }
    if (this.light) this.light.setAlpha(0.6 - flick * 0.2);
    if (!still) {
      for (const d of this.drops) {
        if (d.wait > 0) {
          d.wait -= dt;
          g.fillStyle(0xbfd8e8, 0.6 * Math.min(1, 1 - d.wait / 2));
          g.fillCircle(d.em.x, d.em.y + 2, 2);
          continue;
        }
        d.vy += 900 * dt;
        d.y += d.vy * dt;
        g.fillStyle(0xbfd8e8, 0.7);
        g.fillEllipse(d.em.x, d.y, 3, 6);
        if (d.y > this.h - 4) {
          d.y = d.em.y;
          d.vy = 0;
          d.wait = (d.em.period ?? 3) * (0.7 + ((d.em.x * 13) % 7) / 10);
        }
      }
      for (const m of this.motes) {
        m.x += m.vx * dt + Math.sin(t * 0.7 + m.a * 10) * 2 * dt;
        m.y += m.vy * dt;
        const w = m.em.w ?? 200;
        const h = m.em.h ?? 200;
        if (m.x < m.em.x) m.x += w;
        if (m.x > m.em.x + w) m.x -= w;
        if (m.y < m.em.y) m.y += h;
        if (m.y > m.em.y + h) m.y -= h;
        g.fillStyle(0xfff0d0, 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + m.a * 20)));
        g.fillCircle(m.x, m.y, 1.4);
      }
    }
  }
}
