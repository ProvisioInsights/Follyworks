// Cloud save: the save follows the player to other browsers and devices, with no sign-up. Each
// device makes a secret id (persistence/cloudId.ts) and keeps its save under /api/save/<id> on the
// game's own Worker (worker/api.ts). Entering another device's id links the two: they merge and
// share that id from then on.
//
// On start: pull, merge (persistence/merge.ts), apply. After saves: push, at most about every 20 s,
// and right away (keepalive) when the tab is hidden. The server keeps a revision number; a push
// based on an older revision is refused (412), so the device pulls, merges and pushes again and
// two devices never overwrite each other's progress. Offline, or with no API (the static dev
// server), everything keeps working locally and syncing is retried later, silently.

import { formatCloudId, newCloudId, parseCloudCode } from './cloudId';
import { mergeSaves } from './merge';
import { parseSave, type KV, type SaveStore } from './save';

export const CLOUD_KEY = 'follyworks.cloud';
/** Minimum time between pushes while playing. */
export const PUSH_EVERY_MS = 20_000;
/** Quiet time after a change before pushing, so a burst of edits goes up as one. */
const SETTLE_MS = 3_000;
const RETRY_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
/** Browsers refuse keepalive requests with bodies over 64 KB. */
const KEEPALIVE_MAX = 60_000;

/** 'connecting' until the first answer; 'saved' when the cloud has everything; 'offline' when it cannot be reached. */
export type CloudStatus = 'connecting' | 'saving' | 'saved' | 'offline';

export type LinkResult = 'linked' | 'same' | 'invalid' | 'not-found' | 'offline';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface CloudOptions {
  fetch?: Fetch;
  /** Where the device's id lives (localStorage beside the save). */
  kv?: KV | null;
  base?: string;
  /** Hook up visibilitychange/online listeners (off in tests). */
  listen?: boolean;
}

export class CloudSync {
  id: string;
  status: CloudStatus = 'connecting';
  /** Called after data from another device was merged into the save. */
  onChange: () => void = () => {};
  private rev: number | null = null;
  /** Save JSON the server is known to hold, to skip pushes that would change nothing. */
  private serverCopy: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPush = 0;
  private failures = 0;
  private pulled = false;
  /** The id was made on this visit, so the cloud cannot have anything under it. */
  private fresh: boolean;
  private statusFns: ((s: CloudStatus) => void)[] = [];
  private fetch: Fetch;
  private kv: KV | null;
  private base: string;

  constructor(
    private store: SaveStore,
    o: CloudOptions = {},
  ) {
    this.fetch = o.fetch ?? ((i, init) => fetch(i, init));
    this.kv = o.kv === undefined ? safeStorage() : o.kv;
    this.base = o.base ?? '/api/save/';
    const saved = this.readState();
    this.id = saved?.id ?? newCloudId();
    this.rev = saved?.rev ?? null;
    this.fresh = !saved;
    if (!saved) this.writeState();
    store.onFlush(() => this.schedule());
    if (o.listen !== false && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => document.hidden && this.pushNow(true));
      window.addEventListener('online', () => this.schedule(500));
    }
  }

  /** The id as players see and type it. */
  get code() {
    return formatCloudId(this.id);
  }

  /** Pull and merge whatever the cloud has for this device. Resolves once that is done (or failed). */
  start(): Promise<void> {
    return this.enqueue(async () => {
      if (this.fresh) {
        // A brand-new id has nothing in the cloud yet: skip the pull (and its 404) and just push.
        this.fresh = false;
        this.pulled = true;
        this.setStatus('saving');
      } else await this.pull();
      this.schedule();
    });
  }

  onStatus(fn: (s: CloudStatus) => void) {
    this.statusFns.push(fn);
    return () => (this.statusFns = this.statusFns.filter((f) => f !== fn));
  }

  /**
   * Link this device to another device's code: merge that save in, then both share its id.
   * Never loses anything on either side.
   */
  link(input: string): Promise<LinkResult> {
    const id = parseCloudCode(input);
    if (!id) return Promise.resolve('invalid');
    if (id === this.id) return Promise.resolve('same');
    return this.enqueue(async () => {
      const got = await this.get(id);
      if (got === 'offline') return 'offline';
      if (got === 'missing') return 'not-found';
      this.id = id;
      this.fresh = false;
      this.rev = got.rev;
      this.serverCopy = got.text;
      this.writeState();
      this.apply(got.text);
      this.pulled = true;
      await this.push();
      return 'linked' as const;
    });
  }

  /** Push soon, respecting the minimum gap between pushes. */
  schedule(minDelay = SETTLE_MS) {
    if (this.timer) return;
    const delay = Math.max(minDelay, this.lastPush + PUSH_EVERY_MS - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.enqueue(async () => {
        if (!this.pulled) await this.pull();
        if (this.pulled) await this.push();
      });
    }, delay);
  }

  /** Push immediately (tab hidden). With keepalive the request survives the page closing. */
  pushNow(keepalive = false) {
    this.store.flush(); // (this schedules a push too; it is replaced by the one below)
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (keepalive && this.pulled) return void this.send(true);
    void this.enqueue(async () => {
      if (!this.pulled) await this.pull();
      if (this.pulled) await this.push();
    });
  }

  /** Wait for queued work (tests, and the boot sequence). */
  idle() {
    return this.queue.then(() => {});
  }

  // ---------------------------------------------------------------- internals

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn, fn);
    this.queue = p.catch(() => {});
    return p;
  }

  private setStatus(s: CloudStatus) {
    if (s === this.status) return;
    this.status = s;
    for (const fn of this.statusFns) fn(s);
  }

  private offline() {
    this.setStatus('offline');
    const wait = RETRY_MS[Math.min(this.failures, RETRY_MS.length - 1)];
    this.failures++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.schedule(wait);
  }

  private async get(id: string): Promise<{ text: string; rev: number | null } | 'missing' | 'offline'> {
    let res: Response;
    try {
      res = await this.fetch(this.base + id, { cache: 'no-store', headers: { accept: 'application/json' } });
    } catch {
      return 'offline';
    }
    // A host with no API answers with the game's index.html, so insist on JSON.
    const json = (res.headers.get('content-type') ?? '').includes('application/json');
    if (res.status === 404 && json) return 'missing';
    if (!res.ok || !json) return 'offline';
    try {
      return { text: await res.text(), rev: revOf(res.headers.get('etag')) };
    } catch {
      return 'offline';
    }
  }

  private async pull() {
    const got = await this.get(this.id);
    if (got === 'offline') return this.offline();
    this.pulled = true;
    this.failures = 0;
    if (got === 'missing') {
      this.rev = null;
      this.serverCopy = null;
    } else {
      this.rev = got.rev;
      this.serverCopy = got.text;
      this.apply(got.text);
    }
    this.writeState();
    this.setStatus(this.serverCopy === JSON.stringify(this.store.data) ? 'saved' : 'saving');
  }

  /** Merge a save from the server into the local one. */
  private apply(text: string) {
    const remote = parseSave(text).data;
    this.store.restamp();
    const before = JSON.stringify(this.store.data);
    const merged = mergeSaves(this.store.data, remote);
    if (JSON.stringify(merged) === before) return;
    this.store.adopt(merged);
    this.onChange();
  }

  private body() {
    this.store.restamp();
    return JSON.stringify(this.store.data);
  }

  private async push(tries = 3): Promise<void> {
    const body = this.body();
    if (body === this.serverCopy) return this.setStatus('saved');
    this.setStatus('saving');
    const res = await this.send(false, body);
    if (res === 'offline') return this.offline();
    if (res === 'stale') {
      // Another device saved in between: take its changes in, then try again.
      await this.pull();
      if (this.pulled && tries > 1) return this.push(tries - 1);
      return this.offline();
    }
    this.failures = 0;
    this.setStatus(this.body() === this.serverCopy ? 'saved' : 'saving');
  }

  private async send(keepalive: boolean, body = this.body()): Promise<'ok' | 'stale' | 'offline'> {
    if (body === this.serverCopy) return 'ok';
    this.lastPush = Date.now();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.rev !== null) headers['if-match'] = `"${this.rev}"`;
    else headers['if-none-match'] = '*';
    let res: Response;
    try {
      res = await this.fetch(this.base + this.id, { method: 'PUT', body, headers, cache: 'no-store', keepalive: keepalive && body.length < KEEPALIVE_MAX });
    } catch {
      return 'offline';
    }
    if (res.status === 412) return 'stale';
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return 'offline';
    let rev: number | null = revOf(res.headers.get('etag'));
    try {
      const j = await res.json();
      if (typeof j?.rev === 'number') rev = j.rev;
    } catch {
      /* the ETag is enough */
    }
    this.rev = rev;
    this.serverCopy = body;
    this.writeState();
    return 'ok';
  }

  private readState(): { id: string; rev: number | null } | null {
    try {
      const raw = JSON.parse(this.kv?.getItem(CLOUD_KEY) ?? 'null');
      const id = typeof raw?.id === 'string' ? parseCloudCode(raw.id) : null;
      return id ? { id, rev: typeof raw.rev === 'number' ? raw.rev : null } : null;
    } catch {
      return null;
    }
  }

  private writeState() {
    try {
      this.kv?.setItem(CLOUD_KEY, JSON.stringify({ id: this.id, rev: this.rev }));
    } catch {
      /* storage full or blocked: the id lasts for this visit */
    }
  }
}

const revOf = (etag: string | null) => {
  const m = etag?.match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

const safeStorage = (): KV | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
