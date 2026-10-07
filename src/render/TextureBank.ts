// Turns procedural canvas art into Phaser textures on demand, caching by key + params.
// This is the replacement boundary for art: swap paintPart/paintIcon for painted assets later
// without touching gameplay or views.

import type Phaser from 'phaser';
import type { ThemeId } from '../core/themes';
import { paintPart } from './art/parts';
import { RIM_STYLE, skinCanvas } from './skin';

export const ART_SCALE = 2;
/** Width of the contrast halo around part art, in world px. */
export const RIM = 1.6;

export interface TexInfo {
  key: string;
  /** Size in world units. */
  w: number;
  h: number;
  /** Normalised origin for setOrigin. */
  ox: number;
  oy: number;
}

export interface TexOpts {
  /** Leave the art exactly as painted (glows and other additive overlays). */
  raw?: boolean;
}

export class TextureBank {
  private scene: Phaser.Scene;
  private cache = new Map<string, TexInfo>();
  /** Keys of textures this bank painted (not the shared fx sprites), for disposal on theme change. */
  private painted = new Set<string>();
  private _theme: ThemeId = 'modern';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.makeFxTextures();
  }

  get theme(): ThemeId {
    return this._theme;
  }

  /**
   * Switch the part skin. Every texture painted for the old theme is removed from the GPU, so
   * memory stays bounded to one theme's worth of art; callers must rebuild their views.
   * Returns false when nothing changed.
   */
  setTheme(theme: ThemeId): boolean {
    if (theme === this._theme) return false;
    this._theme = theme;
    for (const k of this.painted) {
      this.cache.delete(k);
      if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    }
    this.painted.clear();
    return true;
  }

  get(key: string, params: Record<string, string | number | boolean> = {}, opts: TexOpts = {}): TexInfo {
    if (key.startsWith('fx_')) opts = { raw: true };
    const pk = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const skinned = !opts.raw && this._theme !== 'modern';
    const cacheKey = (pk ? `${key}?${pk}` : key) + (skinned ? `@${this._theme}` : '');
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;
    let info: TexInfo;
    if (this.scene.textures.exists(cacheKey)) {
      const src = this.scene.textures.get(cacheKey).getSourceImage() as HTMLCanvasElement;
      info = { key: cacheKey, w: src.width / ART_SCALE, h: src.height / ART_SCALE, ox: 0.5, oy: 0.5 };
    } else {
      const painted = paintPart(key, params, ART_SCALE);
      if (skinned) skinCanvas(painted.canvas, this._theme, key, ART_SCALE);
      this.scene.textures.addCanvas(cacheKey, painted.canvas);
      if (!key.startsWith('fx_')) this.painted.add(cacheKey);
      const w = painted.canvas.width / ART_SCALE;
      const h = painted.canvas.height / ART_SCALE;
      info = { key: cacheKey, w, h, ox: painted.ox / painted.canvas.width, oy: painted.oy / painted.canvas.height };
    }
    this.cache.set(cacheKey, info);
    return info;
  }

  /**
   * A dark halo the shape of a part texture, drawn behind it so parts stay readable against any
   * backdrop (busy pegboards, dark corners). Same frame as the texture plus `RIM` px of padding.
   */
  getRim(key: string, params: Record<string, string | number | boolean> = {}): TexInfo {
    const base = this.get(key, params);
    const rimKey = `${base.key}#rim`;
    const hit = this.cache.get(rimKey);
    if (hit) return hit;
    const src = this.scene.textures.get(base.key).getSourceImage() as HTMLCanvasElement;
    const style = RIM_STYLE[this._theme];
    const pad = Math.ceil(Math.max(style.width, style.glow?.width ?? 0) * ART_SCALE) + 1;
    const c = document.createElement('canvas');
    c.width = src.width + pad * 2;
    c.height = src.height + pad * 2;
    const g = c.getContext('2d')!;
    // A halo of `width` px: the texture stamped round a circle, then flooded with one colour.
    const halo = (width: number, color: string) => {
      const t = document.createElement('canvas');
      t.width = c.width;
      t.height = c.height;
      const tg = t.getContext('2d')!;
      const r = width * ART_SCALE;
      const n = width > 2 ? 16 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        tg.drawImage(src, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = color;
      tg.fillRect(0, 0, t.width, t.height);
      return t;
    };
    if (style.glow) {
      g.filter = `blur(${(style.glow.width * ART_SCALE * 0.35).toFixed(1)}px)`;
      g.drawImage(halo(style.glow.width, style.glow.color), 0, 0);
      g.filter = 'none';
    }
    g.drawImage(halo(style.width, style.color), 0, 0);
    this.scene.textures.addCanvas(rimKey, c);
    this.painted.add(rimKey);
    const info: TexInfo = {
      key: rimKey,
      w: c.width / ART_SCALE,
      h: c.height / ART_SCALE,
      ox: (base.ox * src.width + pad) / c.width,
      oy: (base.oy * src.height + pad) / c.height,
    };
    this.cache.set(rimKey, info);
    return info;
  }

  /** Small generic sprites for particles, glows and flames. */
  private makeFxTextures() {
    const mk = (key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) => {
      if (this.scene.textures.exists(key)) return;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const c = cv.getContext('2d')!;
      draw(c, size);
      this.scene.textures.addCanvas(key, cv);
      this.cache.set(key, { key, w: size / ART_SCALE, h: size / ART_SCALE, ox: 0.5, oy: 0.5 });
    };
    const radial = (stops: [number, string][]) => (c: CanvasRenderingContext2D, s: number) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      for (const [o, col] of stops) g.addColorStop(o, col);
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    };
    mk('fx_glow_warm', 128, radial([[0, 'rgba(255,214,140,0.9)'], [0.25, 'rgba(255,170,80,0.45)'], [1, 'rgba(255,120,40,0)']]));
    mk('fx_glow_cyan', 128, radial([[0, 'rgba(160,250,255,0.9)'], [0.3, 'rgba(60,210,240,0.4)'], [1, 'rgba(20,160,220,0)']]));
    mk('fx_glow_violet', 128, radial([[0, 'rgba(230,190,255,0.9)'], [0.3, 'rgba(170,110,255,0.4)'], [1, 'rgba(120,60,255,0)']]));
    mk('fx_glow_green', 128, radial([[0, 'rgba(200,255,170,0.9)'], [0.3, 'rgba(120,240,110,0.4)'], [1, 'rgba(60,200,80,0)']]));
    mk('fx_dot', 16, radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]));
    mk('fx_smoke', 64, (c, s) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = s / 2 + Math.cos(a) * s * 0.14;
        const y = s / 2 + Math.sin(a) * s * 0.14;
        const g = c.createRadialGradient(x, y, 0, x, y, s * 0.32);
        g.addColorStop(0, 'rgba(235,228,220,0.30)');
        g.addColorStop(1, 'rgba(235,228,220,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
      }
    });
    mk('fx_spark', 16, (c, s) => {
      const g = c.createLinearGradient(0, s / 2, s, s / 2);
      g.addColorStop(0, 'rgba(255,200,90,0)');
      g.addColorStop(0.5, 'rgba(255,250,210,1)');
      g.addColorStop(1, 'rgba(255,200,90,0)');
      c.fillStyle = g;
      c.fillRect(0, s / 2 - 2, s, 4);
    });
    mk('fx_square', 8, (c, s) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, s, s);
    });
    mk('fx_flame', 64, (c, s) => {
      // teardrop flame, white-hot core
      const drawDrop = (scale: number, col: string) => {
        c.save();
        c.translate(s / 2, s * 0.68);
        c.scale(scale, scale);
        c.beginPath();
        c.moveTo(0, -s * 0.6);
        c.bezierCurveTo(s * 0.2, -s * 0.28, s * 0.24, -s * 0.02, 0, s * 0.18);
        c.bezierCurveTo(-s * 0.24, -s * 0.02, -s * 0.2, -s * 0.28, 0, -s * 0.6);
        c.fillStyle = col;
        c.fill();
        c.restore();
      };
      drawDrop(1, 'rgba(255,120,30,0.85)');
      drawDrop(0.72, 'rgba(255,190,70,0.95)');
      drawDrop(0.42, 'rgba(255,248,220,1)');
    });
    mk('fx_star', 32, (c, s) => {
      // four-point twinkle with a soft core (goal-met sparkles, celebration)
      const h = s / 2;
      const g = c.createRadialGradient(h, h, 0, h, h, h * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.fillStyle = 'rgba(255,255,255,1)';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? h * 0.16 : h * 0.98;
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    });
    mk('fx_ring', 64, (c, s) => {
      c.strokeStyle = 'rgba(255,255,255,1)';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
      c.stroke();
    });
  }
}
