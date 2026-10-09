// Entity views: declarative layering of painted textures in each component's local frame,
// plus small procedural animations (spinning blades, flames, glows, walking legs).

import Phaser from 'phaser';
import type { Entity } from '../sim/Entity';
import { gearRadius } from '../components/defs/mechanical';
import type { TextureBank } from './TextureBank';
import { ROBOT_EYE } from './art/parts';
import { LIGHT_RGB } from './art/opticsParts';
import { laserFiring } from '../sim/optics';
import { GOOFY_VIEWS } from './goofyViews';

type Params = Record<string, string | number | boolean>;
type Fn<T> = (e: Entity, t: number) => T;

export interface PartSpec {
  tex: string | Fn<string>;
  params?: (e: Entity) => Params;
  x?: number;
  y?: number;
  /** Which body frame to follow (default 0). 'entity' = authored frame, never moves. */
  frame?: number | 'entity';
  /** Keep upright in world space (specular highlights). */
  upright?: boolean;
  rotate?: Fn<number>;
  offset?: Fn<{ x: number; y: number }>;
  scale?: Fn<{ x: number; y: number }>;
  visible?: Fn<boolean>;
  alpha?: Fn<number>;
  additive?: boolean;
  /** Colour tint (glows that take the colour of a beam). */
  tint?: Fn<number>;
  /** Size override in world units (for fx textures). */
  size?: number;
  /** Draw in front of other parts (the basketball net goes over the ball). */
  front?: boolean;
}

export interface ViewSpec {
  parts: PartSpec[];
  /** Mirror override (robot turning around). */
  mirror?: (e: Entity) => boolean;
  /** Procedural extras drawn each frame in the entity frame. */
  draw?: (g: Phaser.GameObjects.Graphics, e: Entity, t: number, running: boolean) => void;
  /** Wall-mounted parts render on the back layer. */
  mounted?: boolean;
}

const decay = (since: number, dur: number) => (since < 0 || since > dur ? 0 : 1 - since / dur);
const flick = (t: number, seed: number) => 0.85 + 0.15 * Math.sin(t * 23 + seed) * Math.sin(t * 7.3 + seed * 2);

export const VIEW_SPECS: Record<string, ViewSpec> = {
  ball: { parts: [{ tex: 'ball' }, { tex: 'shine_s', upright: true }] },
  bowling_ball: { parts: [{ tex: 'bowling_ball' }, { tex: 'shine_m', upright: true }] },
  cannonball: { parts: [{ tex: 'cannonball' }, { tex: 'shine_xs', upright: true }] },
  crate: { parts: [{ tex: (e) => (e.str('material') === 'steel' ? 'crate_steel' : 'crate_wood') }] },
  domino: { parts: [{ tex: 'domino' }] },
  plank: { parts: [{ tex: 'plank', params: (e) => ({ length: e.num('length') }) }] },
  seesaw: {
    parts: [
      { tex: 'fulcrum', frame: 'entity' },
      { tex: 'seesaw_plank', params: (e) => ({ length: e.num('length') }) },
    ],
  },
  trampoline: {
    parts: [
      { tex: 'trampoline_frame', frame: 'entity' },
      {
        tex: 'trampoline_mat',
        frame: 'entity',
        y: -6,
        offset: (e, t) => ({ x: 0, y: 5 * decay(t - (e.state.squish ?? -10), 0.25) * Math.cos((t - (e.state.squish ?? 0)) * 40) }),
      },
    ],
  },
  bucket: { parts: [{ tex: 'bucket' }] },
  hook: { parts: [{ tex: 'hook' }], mounted: true },
  pulley: { parts: [{ tex: 'pulley_wheel' }, { tex: 'pulley_mount', frame: 'entity' }] },
  gear: { parts: [{ tex: (e) => `gear_${e.str('size') || 'medium'}` }] },
  motor: {
    parts: [
      { tex: 'motor_body', frame: 'entity' },
      { tex: 'motor_pinion', frame: 'entity', y: -2, rotate: (e) => e.state.spin ?? 0 },
      { tex: 'fx_glow_cyan', frame: 'entity', x: 16, y: -10, size: 16, additive: true, visible: (e) => !!e.inputs.in, alpha: (_e, t) => 0.6 + 0.3 * Math.sin(t * 9) },
    ],
  },
  conveyor: {
    parts: [
      { tex: 'conveyor', frame: 'entity', params: (e) => ({ length: e.num('length') }) },
      { tex: 'roller', frame: 'entity', x: 0, offset: (e) => ({ x: -e.num('length') / 2 + 12, y: 0 }), rotate: (e) => (e.state.travel ?? 0) / 11 },
      { tex: 'roller', frame: 'entity', x: 0, offset: (e) => ({ x: e.num('length') / 2 - 12, y: 0 }), rotate: (e) => (e.state.travel ?? 0) / 11 },
    ],
    draw(g, e) {
      const L = e.num('length');
      const travel = e.state.travel ?? 0;
      g.lineStyle(2, 0x0e0b09, 0.55);
      const spacing = 16;
      const off = ((travel % spacing) + spacing) % spacing;
      for (let x = -L / 2 + 14 + off; x < L / 2 - 12; x += spacing) {
        g.lineBetween(x, -10.5, x - 3, -7);
        g.lineBetween(-x, 10.5, -x + 3, 7);
      }
    },
  },
  fan: {
    parts: [
      { tex: 'fan_body', frame: 'entity' },
      { tex: (e, t) => (e.inputs.in ? `fan_blades_${Math.floor(t * 36) % 3}` : 'fan_blades_0'), frame: 'entity', x: 6, y: -6 },
    ],
    draw(g, e, t, running) {
      if (!running || !e.inputs.in) return;
      const range = e.num('range');
      for (let i = 0; i < 7; i++) {
        const phase = (t * 1.6 + i * 0.37) % 1;
        const x = 24 + phase * range;
        const y = -34 + ((i * 11.3) % 56);
        g.lineStyle(1.5, 0xdff6ff, 0.22 * (1 - phase));
        g.lineBetween(x, y, x + 26, y);
      }
    },
  },
  balloon: {
    parts: [{ tex: (e) => `balloon_${e.str('color') || 'red'}` }],
    draw(g, e, t) {
      // dangling string (a rope tied here is drawn on top of this by the overlays)
      g.lineStyle(1.2, 0xe8dcc8, 0.9);
      g.beginPath();
      g.moveTo(0, 24);
      for (let i = 1; i <= 8; i++) g.lineTo(Math.sin(t * 3 + i * 0.8) * 2.2 * (i / 8), 24 + i * 5);
      g.strokePath();
    },
  },
  magnet: {
    parts: [
      { tex: 'magnet', frame: 'entity' },
      { tex: 'fx_glow_violet', frame: 'entity', x: 30, y: 0, size: 70, additive: true, visible: (e) => !!e.inputs.in, alpha: (_e, t) => 0.55 + 0.25 * Math.sin(t * 12) },
    ],
    draw(g, e, t, running) {
      if (!running || !e.inputs.in) return;
      const R = e.num('reach');
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.8 + i / 3) % 1;
        const r = R * (1 - ph);
        g.lineStyle(1.5, 0xb894ff, 0.28 * ph);
        g.beginPath();
        g.arc(30, 0, r, -0.9, 0.9);
        g.strokePath();
      }
    },
  },
  candle: {
    parts: [
      { tex: 'candle', frame: 'entity' },
      { tex: 'fx_glow_warm', frame: 'entity', y: -26, size: 90, additive: true, visible: (e) => !!e.state.lit, alpha: (e, t) => 0.55 * flick(t, e.x) },
      {
        tex: 'fx_flame',
        frame: 'entity',
        y: -33,
        size: 22,
        additive: true,
        visible: (e) => !!e.state.lit,
        scale: (e, t) => ({ x: 0.9 + 0.1 * Math.sin(t * 17 + e.x), y: 0.85 + 0.2 * flick(t, e.y) }),
        rotate: (e, t) => 0.08 * Math.sin(t * 5 + e.x),
      },
    ],
  },
  dynamite: {
    parts: [
      { tex: 'dynamite' },
      { tex: 'fx_glow_warm', x: -10, y: -14, size: 26, additive: true, visible: (e) => !!e.state.lit, alpha: (_e, t) => 0.6 + 0.4 * Math.sin(t * 40) },
      { tex: 'fx_dot', x: -10, y: -14, size: 6, additive: true, visible: (e) => !!e.state.lit, scale: (_e, t) => ({ x: 0.8 + Math.sin(t * 50) * 0.4, y: 0.8 + Math.cos(t * 43) * 0.4 }) },
    ],
  },
  rocket: {
    parts: [
      { tex: 'fx_flame', x: -40, y: 0, size: 30, additive: true, rotate: () => -Math.PI / 2, visible: (e) => !!e.state.lit && !e.state.done, scale: (e, t) => ({ x: 0.8 + 0.2 * Math.sin(t * 31), y: 1 + 0.3 * flick(t, 3) }) },
      { tex: 'rocket' },
      { tex: 'fx_glow_warm', x: -34, y: 0, size: 70, additive: true, visible: (e) => !!e.state.lit && !e.state.done, alpha: (_e, t) => 0.7 * flick(t, 1) },
    ],
  },
  cannon: {
    parts: [
      {
        tex: 'cannon_barrel',
        frame: 'entity',
        x: 0,
        y: -2,
        offset: (e, t) => ({ x: -7 * decay(t - (e.state.lastShot ?? -10), 0.35), y: 0 }),
      },
      { tex: 'cannon_carriage', frame: 'entity' },
    ],
  },
  boxing_glove: {
    parts: [
      {
        tex: 'glove_spring',
        frame: 'entity',
        x: 16,
        y: 0,
        scale: (e, t) => ({ x: 0.2 + punchExt(e, t) / 40, y: 1 }),
        visible: (e, t) => punchExt(e, t) > 1,
      },
      { tex: 'glove_box', frame: 'entity' },
      { tex: 'glove', frame: 'entity', x: 18, y: 0, offset: (e, t) => ({ x: punchExt(e, t), y: 0 }) },
    ],
  },
  battery: { parts: [{ tex: 'battery' }] },
  toggle_switch: {
    mounted: true,
    parts: [
      { tex: 'switch_lever', frame: 'entity', x: 0, y: -12, rotate: (e) => (e.state.on ? 0.5 : -0.5) },
      { tex: 'switch_plate', frame: 'entity' },
      { tex: 'fx_glow_green', frame: 'entity', x: 12, y: -24, size: 18, additive: true, visible: (e) => !!e.outputs.out },
      { tex: 'fx_glow_warm', frame: 'entity', x: 12, y: -24, size: 12, additive: true, visible: (e) => !!e.state.on && !e.outputs.out, alpha: () => 0.5 },
    ],
  },
  pressure_plate: {
    parts: [
      { tex: 'plate_top', frame: 'entity', y: -6, offset: (e) => ({ x: 0, y: e.state.pressed ? 3 : 0 }) },
      { tex: 'plate_base', frame: 'entity' },
      { tex: 'fx_glow_green', frame: 'entity', y: -4, size: 40, additive: true, visible: (e) => !!e.state.pressed, alpha: () => 0.35 },
    ],
  },
  timer: {
    mounted: true,
    parts: [
      { tex: 'timer', frame: 'entity' },
      { tex: 'timer_hand', frame: 'entity', rotate: (e, t) => timerAngle(e, t) },
      { tex: 'fx_glow_warm', frame: 'entity', y: -22, size: 40, additive: true, visible: (e) => !!e.outputs.out, alpha: (_e, t) => 0.5 + 0.3 * Math.sin(t * 14) },
    ],
  },
  logic_gate: {
    mounted: true,
    parts: [
      { tex: 'logic_box', frame: 'entity', params: (e) => ({ mode: e.str('mode') || 'and' }) },
      { tex: 'fx_glow_green', frame: 'entity', x: 18, y: -12, size: 18, additive: true, visible: (e) => !!e.outputs.out },
    ],
  },
  light_bulb: {
    mounted: true,
    parts: [
      { tex: (e) => (e.inputs.in ? 'bulb_on' : 'bulb_off'), frame: 'entity' },
      { tex: 'fx_glow_warm', frame: 'entity', y: -12, size: 200, additive: true, visible: (e) => !!e.inputs.in, alpha: (_e, t) => 0.75 + 0.05 * Math.sin(t * 50) },
    ],
  },
  robot: {
    mirror: (e) => (e.state.dir ?? (e.flip ? -1 : 1)) < 0,
    parts: [
      { tex: 'robot_leg', x: -6, y: 10, rotate: (e) => (e.state.walking ? Math.sin(e.state.walk ?? 0) * 0.5 : 0) },
      { tex: 'robot_leg', x: 6, y: 10, rotate: (e) => (e.state.walking ? -Math.sin(e.state.walk ?? 0) * 0.5 : 0) },
      { tex: 'robot_body', offset: (e) => ({ x: 0, y: e.state.walking ? -Math.abs(Math.sin(e.state.walk ?? 0)) * 1.5 : 0 }) },
      { tex: 'robot_eye', x: ROBOT_EYE.x, y: ROBOT_EYE.y, size: 14, additive: true, alpha: (e, t) => (e.state.walking ? 0.95 : 0.35 + 0.1 * Math.sin(t * 2)) },
    ],
  },
  cactus: { parts: [{ tex: 'cactus' }] },
  laser: {
    parts: [
      { tex: 'laser', frame: 'entity', params: (e) => ({ color: e.str('color') || 'red' }) },
      { tex: 'fx_dot', frame: 'entity', x: 30, y: 0, size: 18, additive: true, visible: (e) => laserFiring(e), tint: (e) => LIGHT_RGB[e.str('color')] ?? 0xffffff, alpha: (_e, t) => 0.8 + 0.2 * Math.sin(t * 37) },
      { tex: 'fx_glow_warm', frame: 'entity', x: 30, y: 0, size: 46, additive: true, visible: (e) => laserFiring(e), tint: (e) => LIGHT_RGB[e.str('color')] ?? 0xffffff, alpha: () => 0.6 },
    ],
  },
  mirror: { parts: [{ tex: 'mirror', frame: 'entity' }] },
  beam_splitter: { parts: [{ tex: 'beam_splitter', frame: 'entity' }] },
  prism: { parts: [{ tex: 'prism', frame: 'entity' }] },
  color_filter: { parts: [{ tex: 'color_filter', frame: 'entity', params: (e) => ({ color: e.str('color') || 'green' }) }] },
  lens: { parts: [{ tex: 'lens', frame: 'entity' }] },
  light_sensor: {
    parts: [
      { tex: 'light_sensor', frame: 'entity', params: (e) => ({ color: e.str('color') || 'any' }) },
      { tex: 'fx_glow_warm', frame: 'entity', y: -2, size: 56, additive: true, visible: (e) => !!e.state.lit, alpha: (_e, t) => 0.75 + 0.15 * Math.sin(t * 20) },
    ],
  },
  wall: { parts: [{ tex: 'wall', params: (e) => ({ w: e.num('w'), h: e.num('h'), material: e.str('material') || 'concrete' }) }] },
  ...GOOFY_VIEWS,
};

function punchExt(e: Entity, t: number) {
  const s = t - (e.state.punchAt ?? -10);
  if (s < 0 || s > 0.7) return 0;
  if (s < 0.06) return (s / 0.06) * 80;
  if (s < 0.2) return 80;
  return 80 * (1 - (s - 0.2) / 0.5);
}

function timerAngle(e: Entity, t: number) {
  const f = e.state.fireAt;
  if (typeof f !== 'number' || f < 0) return 0;
  const start = e.state.startedAt ?? 0;
  const total = Math.max(0.01, f - start);
  const left = Math.max(0, f - t);
  return -Math.PI * 2 * (left / total) * 0.95;
}

interface Built {
  spec: PartSpec;
  img: Phaser.GameObjects.Image;
  holder: Phaser.GameObjects.Container;
  lastTex: string;
}

/** A live view of one entity. */
export class EntityView {
  readonly entity: Entity;
  readonly root: Phaser.GameObjects.Container;
  /** Layers drawn in front of other parts (null when the part has none). */
  readonly frontRoot: Phaser.GameObjects.Container | null = null;
  private holders = new Map<string, Phaser.GameObjects.Container>();
  private upright: Phaser.GameObjects.Container;
  private parts: Built[] = [];
  private rims = new Map<PartSpec, Phaser.GameObjects.Image>();
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private spec: ViewSpec;
  private bank: TextureBank;
  private scene: Phaser.Scene;
  /** Extra translation applied while dragging in the editor. */
  dragOffset = { x: 0, y: 0 };
  dragRotate = 0;

  constructor(scene: Phaser.Scene, bank: TextureBank, e: Entity, parent: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.bank = bank;
    this.entity = e;
    this.spec = VIEW_SPECS[e.type] ?? { parts: [{ tex: e.def.art }] };
    this.root = scene.add.container(0, 0);
    parent.add(this.root);
    if (this.spec.parts.some((ps) => ps.front)) {
      this.frontRoot = scene.add.container(0, 0);
      parent.add(this.frontRoot);
    }
    this.upright = scene.add.container(0, 0);
    // Contrast rims go in first so they sit under every layer of the part. Only plain painted
    // layers get one (not glows, shines or other overlays).
    for (const ps of this.spec.parts) {
      if (ps.additive || ps.upright || ps.size || ps.scale || typeof ps.tex !== 'string' || ps.tex.startsWith('fx_')) continue;
      const rim = this.bank.getRim(ps.tex, ps.params?.(e) ?? {});
      const img = scene.add.image(ps.x ?? 0, ps.y ?? 0, rim.key);
      img.setOrigin(rim.ox, rim.oy);
      img.setDisplaySize(rim.w, rim.h);
      this.holderFor(ps.frame ?? 0, ps.front).add(img);
      this.rims.set(ps, img);
    }
    for (const ps of this.spec.parts) {
      const holder = ps.upright ? this.upright : this.holderFor(ps.frame ?? 0, ps.front);
      const key = this.texKey(ps, 0);
      const info = this.bank.get(key, ps.params?.(e) ?? {}, { raw: ps.additive });
      const img = scene.add.image(ps.x ?? 0, ps.y ?? 0, info.key);
      img.setOrigin(info.ox, info.oy);
      this.applySize(img, ps, info.w, info.h);
      if (ps.additive) img.setBlendMode(Phaser.BlendModes.ADD);
      if (ps.tint) img.setTint(ps.tint(e, 0));
      holder.add(img);
      this.parts.push({ spec: ps, img, holder, lastTex: info.key });
    }
    if (this.spec.draw) {
      this.gfx = scene.add.graphics();
      this.holderFor('entity').add(this.gfx);
    }
    this.root.add(this.upright);
  }

  get mounted() {
    return !!this.spec.mounted;
  }

  private holderFor(frame: number | 'entity', front = false) {
    const k = front && this.frontRoot ? `^${frame}` : String(frame);
    let h = this.holders.get(k);
    if (!h) {
      h = this.scene.add.container(0, 0);
      this.holders.set(k, h);
      (front && this.frontRoot ? this.frontRoot : this.root).add(h);
    }
    return h;
  }

  private texKey(ps: PartSpec, t: number) {
    return typeof ps.tex === 'function' ? ps.tex(this.entity, t) : ps.tex;
  }

  private applySize(img: Phaser.GameObjects.Image, ps: PartSpec, w: number, h: number) {
    const base = ps.size ? ps.size / Math.max(w, h) : 1;
    const sc = ps.scale ? ps.scale(this.entity, 0) : { x: 1, y: 1 };
    img.setDisplaySize(w * base * sc.x, h * base * sc.y);
    (img as any).__base = { w: w * base, h: h * base };
  }

  /** Frame transform of a body (lerped) or of the authored frame. */
  private frame(idx: number | 'entity', alpha: number) {
    const e = this.entity;
    if (idx === 'entity' || !e.bodies[idx]) return { x: e.x, y: e.y, rot: e.angle };
    const b = e.bodies[idx];
    const pp = (b as any).__prev as { x: number; y: number; a: number } | undefined;
    let bx = b.position.x;
    let by = b.position.y;
    let ba = b.angle;
    if (pp && alpha < 1) {
      bx = pp.x + (bx - pp.x) * alpha;
      by = pp.y + (by - pp.y) * alpha;
      ba = pp.a + (ba - pp.a) * alpha;
    }
    const off = (b as any).__refOffset ?? { x: 0, y: 0 };
    const rot = ba - ((b as any).__refAngle ?? 0) + e.angle;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return { x: bx - (off.x * c - off.y * s), y: by - (off.x * s + off.y * c), rot };
  }

  /** Where the part's main body is drawn this frame (world position and rotation, with any drag). */
  pose(alpha: number) {
    const f = this.frame(0, alpha);
    return { x: f.x + this.dragOffset.x, y: f.y + this.dragOffset.y, rot: f.rot + this.dragRotate };
  }

  sync(alpha: number, t: number, running: boolean) {
    const e = this.entity;
    this.root.setVisible(e.alive);
    this.frontRoot?.setVisible(e.alive);
    if (!e.alive) return;
    const mirror = this.spec.mirror ? this.spec.mirror(e) : e.flip;
    const mainFrame = this.frame(0, alpha);
    for (const [hk, h] of this.holders) {
      const k = hk.startsWith('^') ? hk.slice(1) : hk;
      const f = k === 'entity' ? this.frame('entity', alpha) : this.frame(Number(k), alpha);
      h.setPosition(f.x + this.dragOffset.x, f.y + this.dragOffset.y);
      h.setRotation(f.rot + this.dragRotate);
      // A mirror override (robot) may differ from authored flip; only body frames follow it.
      h.setScale(k === 'entity' ? (e.flip ? -1 : 1) : mirror ? -1 : 1, 1);
    }
    const b0 = e.bodies[0];
    if (b0) this.upright.setPosition(b0.position.x + this.dragOffset.x, b0.position.y + this.dragOffset.y);
    else this.upright.setPosition(mainFrame.x, mainFrame.y);
    for (const p of this.parts) {
      const ps = p.spec;
      if (typeof ps.tex === 'function') {
        const info = this.bank.get(this.texKey(ps, t), ps.params?.(e) ?? {}, { raw: ps.additive });
        if (info.key !== p.lastTex) {
          p.img.setTexture(info.key);
          p.img.setOrigin(info.ox, info.oy);
          this.applySize(p.img, ps, info.w, info.h);
          p.lastTex = info.key;
        }
      }
      const vis = ps.visible ? ps.visible(e, t) : true;
      p.img.setVisible(vis);
      const rim = this.rims.get(ps);
      rim?.setVisible(vis);
      if (!vis) continue;
      const off = ps.offset ? ps.offset(e, t) : null;
      p.img.setPosition((ps.x ?? 0) + (off?.x ?? 0), (ps.y ?? 0) + (off?.y ?? 0));
      if (ps.rotate) p.img.setRotation(ps.rotate(e, t));
      if (rim) {
        rim.setPosition(p.img.x, p.img.y);
        rim.setRotation(p.img.rotation);
        rim.setAlpha(this.baseAlpha);
      }
      if (ps.scale) {
        const sc = ps.scale(e, t);
        const base = (p.img as any).__base;
        p.img.setDisplaySize(base.w * sc.x, base.h * sc.y);
      }
      if (ps.alpha) p.img.setAlpha(Math.max(0, Math.min(1, ps.alpha(e, t))) * this.baseAlpha);
      else p.img.setAlpha(this.baseAlpha);
    }
    if (this.gfx && this.spec.draw) {
      this.gfx.clear();
      this.spec.draw(this.gfx, e, t, running);
    }
  }

  /**
   * Happy hop when a mission is solved: `u` runs 0..1 over the bounce. Applied after `sync`, on
   * the drawn containers only (the body never moves), so it is purely cosmetic.
   */
  applyCheer(u: number) {
    if (u <= 0 || u >= 1 || !this.entity.alive) return;
    const fade = 1 - u;
    const hop = Math.abs(Math.sin(u * Math.PI * 2)) * 9 * fade;
    const squash = 1 + Math.sin(u * Math.PI * 4) * 0.07 * fade;
    for (const h of [...this.holders.values(), this.upright]) {
      h.y -= hop;
      h.setScale(h.scaleX * (2 - squash), h.scaleY * squash);
    }
  }

  private baseAlpha = 1;
  setGhost(on: boolean, valid = true) {
    this.baseAlpha = on ? 0.62 : 1;
    for (const p of this.parts) {
      if (p.spec.additive) continue;
      if (on && !valid) p.img.setTint(0xff5a4a);
      else p.img.clearTint();
    }
  }

  setHighlight(color: number | null) {
    for (const p of this.parts) {
      if (p.spec.additive) continue;
      if (color === null) p.img.clearTint();
      else p.img.setTint(color);
    }
  }

  destroy() {
    this.root.destroy(true);
    this.frontRoot?.destroy(true);
  }
}

export const gearOuter = (size: string) => gearRadius(size) + 6;
