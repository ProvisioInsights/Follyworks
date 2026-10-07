// Views for the goofy parts: which painted layers each one shows, and the little animations
// (a squashed squawk, the trap bar snapping over, toast going down, a rattling lid, the cat's
// run cycle, the bell swinging, the net in front of the ball). Every animation reads the
// entity's state times, so scrubbing a rewind shows the right pose.

import type { Entity } from '../sim/Entity';
import type { ViewSpec } from './views';

/** 1 right at `since` = 0, fading to 0 at `dur`; 0 before. */
const decay = (since: number, dur: number) => (since < 0 || since > dur ? 0 : 1 - since / dur);
const ago = (e: Entity, t: number, key: string) => t - (typeof e.state[key] === 'number' ? e.state[key] : -10);

const slotX = (slices: number, i: number) => (slices <= 1 ? 0 : i === 0 ? -11 : 11);
const toasting = (e: Entity) => (e.state.fireAt ?? -1) >= 0 && !e.state.rang;

const toastSlice = (i: number): ViewSpec['parts'][number] => ({
  tex: 'toast',
  frame: 'entity',
  visible: (e) => !e.state.rang && i < e.num('slices'),
  // peeking out of the slot, or pushed down while toasting
  offset: (e) => ({ x: slotX(e.num('slices'), i), y: toasting(e) ? -5 : -12 }),
});

export const GOOFY_VIEWS: Record<string, ViewSpec> = {
  basketball: { parts: [{ tex: 'basketball' }, { tex: 'shine_m', upright: true, size: 40 }] },
  rubber_chicken: {
    parts: [
      {
        tex: (e, t) => (ago(e, t, 'squawkAt') < 0.3 ? 'chicken_squawk' : 'rubber_chicken'),
        // a squeezed-rubber squash and stretch on each squawk
        scale: (e, t) => {
          const k = decay(ago(e, t, 'squawkAt'), 0.35) * Math.cos(ago(e, t, 'squawkAt') * 30);
          return { x: 1 + 0.14 * k, y: 1 - 0.18 * k };
        },
      },
    ],
  },
  mousetrap: {
    parts: [
      { tex: 'mousetrap' },
      {
        tex: 'trap_bar',
        x: 0,
        y: -6.5,
        // set: lying back over the left end; snapped: whipped over to the right in 0.07 s
        rotate: (e, t) => (e.state.snapped ? -Math.PI * (1 - Math.min(1, Math.max(0, ago(e, t, 'snapAt')) / 0.07)) : -Math.PI),
      },
    ],
  },
  toaster: {
    parts: [
      toastSlice(0),
      toastSlice(1),
      { tex: 'toaster', frame: 'entity' },
      { tex: 'toaster_lever', frame: 'entity', x: 35, y: -8, offset: (e) => ({ x: 0, y: toasting(e) ? 12 : 0 }) },
      {
        tex: 'fx_glow_warm',
        frame: 'entity',
        y: -16,
        size: 60,
        additive: true,
        visible: (e) => toasting(e),
        alpha: (_e, t) => 0.45 + 0.15 * Math.sin(t * 9),
      },
    ],
  },
  teapot: {
    parts: [
      { tex: 'teapot' },
      {
        tex: 'teapot_lid',
        y: -14,
        // the lid rattles while it steams
        offset: (e, t) => ({ x: 0, y: e.state.steaming ? -1.2 * Math.abs(Math.sin(t * 38)) : 0 }),
        rotate: (e, t) => (e.state.steaming ? 0.06 * Math.sin(t * 29) : 0),
      },
    ],
  },
  cat: {
    mirror: (e) => (e.state.dir ?? (e.flip ? -1 : 1)) < 0,
    parts: [
      {
        tex: (e, t) => {
          if (!e.state.awake) return 'cat';
          if (ago(e, t, 'wokeAt') < 0.45) return 'cat_startle';
          return `cat_run_${Math.floor((e.state.walk ?? 0) / 3) % 2}`;
        },
        // slow breathing while asleep
        scale: (e, t) => (e.state.awake ? { x: 1, y: 1 } : { x: 1, y: 1 + 0.035 * Math.sin(t * 2.4 + e.x) }),
      },
      {
        tex: 'zzz',
        upright: true,
        visible: (e) => !e.state.awake,
        offset: (e, t) => ({ x: (e.state.dir ?? 1) * 14 + 3 * Math.sin(t * 1.3), y: -26 - 4 * ((t * 0.6) % 1) }),
        alpha: (_e, t) => 0.9 - 0.6 * ((t * 0.6) % 1),
      },
    ],
  },
  bell: {
    mounted: true,
    parts: [
      { tex: 'bell', frame: 'entity' },
      {
        tex: 'bell_body',
        frame: 'entity',
        x: 0,
        y: -20,
        rotate: (e, t) => {
          const s = ago(e, t, 'ringAt');
          return (e.state.swing ?? 1) * 0.32 * decay(s, 1.4) * Math.sin(s * 13);
        },
      },
      { tex: 'fx_glow_green', frame: 'entity', x: 14, y: -30, size: 22, additive: true, visible: (e) => !!e.outputs.out },
    ],
  },
  basketball_hoop: {
    parts: [
      { tex: 'basketball_hoop', frame: 'entity' },
      {
        tex: 'hoop_net',
        frame: 'entity',
        front: true,
        // the net jumps when something drops through
        scale: (e, t) => {
          const k = decay(ago(e, t, 'swishAt'), 0.6);
          return { x: 1 - 0.08 * k, y: 1 + 0.22 * k * Math.abs(Math.cos(ago(e, t, 'swishAt') * 14)) };
        },
      },
      { tex: 'hoop_rim', frame: 'entity', front: true },
    ],
  },
};
