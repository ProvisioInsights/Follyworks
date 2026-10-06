// The one Phaser scene. It renders whatever Simulation it is handed (a never-stepped "build"
// simulation while editing, or the live run simulation) and knows nothing about game rules.
// Controllers drive it through setSim / setOverlay / frame callbacks.

import Phaser from 'phaser';
import type { ThemeId } from '../core/themes';
import type { Vec } from '../core/types';
import type { Entity } from '../sim/Entity';
import type { Simulation, SimEvent } from '../sim/Simulation';
import { EnvironmentView } from './Environment';
import { Fx } from './Fx';
import { Overlays, type OverlayState } from './Overlays';
import { roomFor } from './skin';
import { TextureBank } from './TextureBank';
import { EntityView } from './views';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type FrameHook = (dtSec: number) => void;

export class WorkshopScene extends Phaser.Scene {
  bank!: TextureBank;
  env!: EnvironmentView;
  fx!: Fx;
  overlays!: Overlays;
  private layers!: Record<'bg' | 'under' | 'mounted' | 'views' | 'over' | 'fx' | 'fxAdd' | 'front' | 'top', Phaser.GameObjects.Container>;
  private views = new Map<string, EntityView>();
  private sim: Simulation | null = null;
  private envId = '';
  /** The level's own environment id; the room shown may be the theme's instead. */
  private levelEnv = 'garage';
  private theme: ThemeId = 'modern';
  insets: Insets = { top: 60, right: 20, bottom: 110, left: 20 };
  /** Fitted zoom for the current world; user zoom is relative to it. */
  private fitZoom = 1;
  private userZoom = 1;
  private pan = { x: 0, y: 0 };
  private worldW = 1600;
  private worldH = 900;
  private frameHooks = new Set<FrameHook>();
  private ready: (() => void) | null = null;
  readyPromise: Promise<void>;
  /** Supplied by the active controller every frame. */
  overlayState: Omit<OverlayState, 'sim' | 't'> | null = null;
  renderAlpha = 1;
  renderTime = 0;
  running = false;
  private realTime = 0;
  private floor!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'workshop' });
    this.readyPromise = new Promise((r) => (this.ready = r));
  }

  create() {
    this.bank = new TextureBank(this);
    const mk = () => this.add.container(0, 0);
    this.layers = { bg: mk(), under: mk(), mounted: mk(), views: mk(), over: mk(), fx: mk(), fxAdd: mk(), front: mk(), top: mk() };
    this.floor = this.add.graphics();
    this.layers.bg.add(this.floor);
    this.env = new EnvironmentView(this, this.layers.bg, this.layers.front);
    this.fx = new Fx(this, this.layers.fx, this.layers.fxAdd);
    this.overlays = new Overlays(this, this.layers.under, this.layers.over, this.layers.top);
    this.cameras.main.setBackgroundColor('#0d0a08');
    this.scale.on('resize', () => this.applyCamera());
    this.ready?.();
  }

  onFrame(fn: FrameHook) {
    this.frameHooks.add(fn);
    return () => this.frameHooks.delete(fn);
  }

  // ------------------------------------------------------------------ world + sim

  setEnvironment(levelEnv: string, w: number, h: number) {
    this.levelEnv = levelEnv;
    const id = roomFor(this.theme, levelEnv);
    const changedSize = w !== this.worldW || h !== this.worldH;
    this.worldW = w;
    this.worldH = h;
    if (this.envId !== `${id}:${w}x${h}`) {
      this.envId = `${id}:${w}x${h}`;
      this.env.set(id, w, h);
      this.env.purgeExcept(this.env.currentKey);
    }
    if (changedSize) this.resetView();
    this.applyCamera();
  }

  get currentTheme(): ThemeId {
    return this.theme;
  }

  /**
   * Reskin the room and the parts. Purely visual: the simulation is untouched, and the old theme's
   * textures are released. Views of the current simulation are rebuilt with the new skin.
   * With `deferred` (a screen change is about to set a new sim and room) nothing is repainted
   * now: the old views are dropped and the next setSim / setEnvironment paints in the new theme.
   */
  setTheme(theme: ThemeId, deferred = false) {
    if (theme === this.theme) return;
    this.theme = theme;
    if (deferred) {
      for (const v of this.views.values()) v.destroy();
      this.views.clear();
      this.sim = null;
      this.bank?.setTheme(theme);
      return;
    }
    if (this.bank) {
      this.bank.setTheme(theme);
      if (this.sim) this.setSim(this.sim);
    }
    if (this.env && this.envId) this.setEnvironment(this.levelEnv, this.worldW, this.worldH);
  }

  /** Show a simulation. Views are rebuilt (textures are cached, so this is cheap). */
  setSim(sim: Simulation) {
    this.sim = sim;
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    for (const e of sim.list) this.addView(e);
  }

  private addView(e: Entity) {
    const spec = new EntityView(this, this.bank, e, this.layers.views);
    if (spec.mounted) this.layers.mounted.add(spec.root);
    this.views.set(e.id, spec);
  }

  getSim() {
    return this.sim;
  }

  view(id: string) {
    return this.views.get(id);
  }

  allViews() {
    return this.views.values();
  }

  handleEvent(ev: SimEvent) {
    this.fx.event(ev);
  }

  // ------------------------------------------------------------------ camera

  setInsets(i: Insets) {
    this.insets = i;
    this.applyCamera();
  }

  resetView() {
    this.userZoom = 1;
    this.pan = { x: 0, y: 0 };
    this.applyCamera();
  }

  get zoom() {
    return this.fitZoom * this.userZoom;
  }

  zoomAt(factor: number, screen: Vec) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(screen.x, screen.y);
    this.userZoom = Phaser.Math.Clamp(this.userZoom * factor, 0.75, 3.5);
    this.applyCamera();
    const after = cam.getWorldPoint(screen.x, screen.y);
    this.pan.x += before.x - after.x;
    this.pan.y += before.y - after.y;
    this.applyCamera();
  }

  panBy(dxScreen: number, dyScreen: number) {
    this.pan.x -= dxScreen / this.zoom;
    this.pan.y -= dyScreen / this.zoom;
    this.applyCamera();
  }

  private applyCamera() {
    if (!this.cameras?.main) return;
    const cam = this.cameras.main;
    const vw = this.scale.width;
    const vh = this.scale.height;
    const i = this.insets;
    // Just enough room around the world to show the ceiling slab and floor lip.
    const margin = { x: 14, top: 34, bottom: 18 };
    const W = this.worldW + margin.x * 2;
    const H = this.worldH + margin.top + margin.bottom;
    const availW = Math.max(200, vw - i.left - i.right);
    const availH = Math.max(150, vh - i.top - i.bottom);
    this.fitZoom = Math.min(availW / W, availH / H);
    const z = this.zoom;
    cam.setZoom(z);
    // keep pan within reason
    const maxPanX = (this.worldW * 0.6) * Math.max(0, this.userZoom - 0.5);
    const maxPanY = (this.worldH * 0.6) * Math.max(0, this.userZoom - 0.5);
    this.pan.x = Phaser.Math.Clamp(this.pan.x, -maxPanX - 100, maxPanX + 100);
    this.pan.y = Phaser.Math.Clamp(this.pan.y, -maxPanY - 100, maxPanY + 100);
    const cx = this.worldW / 2 + this.pan.x;
    const cy = (this.worldH + margin.bottom - margin.top) / 2 + this.pan.y;
    const sx = (i.left - i.right) / 2;
    const sy = (i.top - i.bottom) / 2;
    cam.centerOn(cx - sx / z, cy - sy / z);
  }

  screenToWorld(x: number, y: number): Vec {
    const p = this.cameras.main.getWorldPoint(x, y);
    return { x: p.x, y: p.y };
  }

  worldToScreen(x: number, y: number): Vec {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  // ------------------------------------------------------------------ frame

  private lastNow = 0;
  override update() {
    // Measure real elapsed time ourselves; the loop's smoothed delta under-reports at low fps.
    const now = performance.now();
    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 1 / 60;
    this.lastNow = now;
    this.realTime += dt;
    for (const fn of this.frameHooks) fn(dt);
    const sim = this.sim;
    this.env.update(this.realTime, dt, this.cameras.main);
    this.drawFloor();
    if (sim) {
      const t = this.running ? this.renderTime : this.realTime;
      for (const v of this.views.values()) v.sync(this.renderAlpha, t, this.running);
      if (this.overlayState) this.overlays.draw({ ...this.overlayState, sim, t: this.realTime, alpha: this.renderAlpha });
    }
    this.fx.update(dt);
  }

  private drawFloor() {
    // thin lip that reads as the physical floor edge (the painted floor continues below)
    const g = this.floor;
    g.clear();
    g.fillStyle(0x000000, 0.25);
    g.fillRect(-220, this.worldH, this.worldW + 440, 3);
  }
}
