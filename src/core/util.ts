import type { Vec } from './types';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const rotate = (p: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};
/** Transform a local point by position/angle/flip. */
export const localToWorld = (local: Vec, pos: Vec, angle: number, flip = false): Vec => {
  const p = rotate({ x: flip ? -local.x : local.x, y: local.y }, angle);
  return { x: p.x + pos.x, y: p.y + pos.y };
};
export const worldToLocal = (world: Vec, pos: Vec, angle: number, flip = false): Vec => {
  const p = rotate({ x: world.x - pos.x, y: world.y - pos.y }, -angle);
  return { x: flip ? -p.x : p.x, y: p.y };
};
export const normAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

let idCounter = 0;
/** Short unique ids. Not cryptographic; collisions are checked by the caller where it matters. */
export const newId = (prefix = 'o') => {
  idCounter = (idCounter + 1) % 1679616;
  return `${prefix}${Date.now().toString(36).slice(-5)}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
};

/** Small seeded PRNG (mulberry32) so procedural art and effects are repeatable. */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Distance from point p to segment ab. */
export const pointSegDist = (p: Vec, a: Vec, b: Vec) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

export const pointInRect = (p: Vec, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
