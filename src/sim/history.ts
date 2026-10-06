// Bounded rewind history: snapshots every `interval` ticks, capped at `max` entries.
// The player scrubs to a snapshot; resuming from there discards the abandoned future.

import type { SimSnapshot, Simulation } from './Simulation';

export class History {
  readonly interval: number;
  readonly max: number;
  private snaps: SimSnapshot[] = [];

  constructor(interval = 2, max = 2700) {
    this.interval = interval;
    this.max = max;
  }

  get length() {
    return this.snaps.length;
  }
  get first() {
    return this.snaps[0];
  }
  get last() {
    return this.snaps[this.snaps.length - 1];
  }
  at(i: number) {
    return this.snaps[Math.max(0, Math.min(this.snaps.length - 1, i))];
  }

  clear() {
    this.snaps = [];
  }

  /** Call after every step. */
  record(sim: Simulation, force = false) {
    if (!force && sim.tick % this.interval !== 0) return;
    if (this.last && this.last.tick >= sim.tick) return;
    this.snaps.push(sim.snapshot());
    if (this.snaps.length > this.max) this.snaps.splice(0, this.snaps.length - this.max);
  }

  /** Index of the latest snapshot at or before tick. */
  indexAtOrBefore(tick: number): number {
    let lo = 0;
    let hi = this.snaps.length - 1;
    if (hi < 0) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.snaps[mid].tick <= tick) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Drop everything after index i (branching from a rewound point). */
  truncateAfter(i: number) {
    this.snaps.length = Math.max(0, Math.min(this.snaps.length, i + 1));
  }
}
