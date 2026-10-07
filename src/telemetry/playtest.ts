// Playtest log: what players actually do in each mission, kept on this device only (localStorage,
// never sent anywhere). It records the behaviour that stands in for fun in this genre:
//
//   did they get to RUN quickly          time to first run
//   is the build-run-fix loop snappy     seconds of building between runs
//   did they push through or give up     runs and minutes before solving, or leaving unsolved
//   did they need help                   highest hint tier
//   did they keep playing for its own sake   runs after the first solve (ABSURD hunting, tinkering)
//   what did they say                    an optional 1–5 rating
//
// summarize() turns a log (or several players' exported logs) into per-level signals.
// Export from the browser console: __follyworksPlaytest.download(). See docs/fun/MEASURING_FUN.md.

export type RunEnd = 'solved' | 'settled' | 'timeup' | 'reset';

export interface RunRecord {
  /** Seconds of building since the session started or the previous run was reset. */
  built: number;
  /** Wall-clock seconds the run lasted. */
  lasted: number;
  end: RunEnd;
  /** Chain stages reached (solved runs only). */
  stages?: number;
  absurd?: boolean;
  elegant?: boolean;
}

export interface SessionRecord {
  level: string;
  kind: string;
  /** Epoch ms. */
  start: number;
  /** Seconds from start until the session closed. */
  length: number;
  runs: RunRecord[];
  /** Build edits (place, move, turn, delete, connect...). */
  edits: number;
  /** Seconds from start to the first RUN, or null if they never ran it. */
  firstRun: number | null;
  /** Seconds from start to the first solve, or null. */
  solvedAt: number | null;
  /** Highest hint tier asked for (0 none, 1 nudge, 2 parts list, 3+ ghost outlines). */
  hint: number;
  rewinds: number;
  /** 1–5, when the player rated the mission. */
  rating?: number;
  /** True while the session is still open (it was not closed cleanly, e.g. the tab was shut). */
  open?: boolean;
}

export interface PlaytestLog {
  v: 1;
  /** Random id so logs from several players can be merged without double counting. */
  player: string;
  sessions: SessionRecord[];
}

const KEY = 'follyworks.playtest';
const MAX_SESSIONS = 600;

type Clock = () => number;

/** Records one browser's play. Storage is injectable so tests can run it headlessly. */
export class Playtest {
  log: PlaytestLog;
  private cur: SessionRecord | null = null;
  private mark = 0;
  private runStart = 0;
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private now: Clock;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null, now: Clock = () => Date.now()) {
    this.storage = storage;
    this.now = now;
    this.log = this.load();
  }

  private load(): PlaytestLog {
    try {
      const raw = this.storage?.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.v === 1 && Array.isArray(parsed.sessions)) return parsed;
    } catch {
      /* a broken log is replaced, never fatal */
    }
    return { v: 1, player: Math.random().toString(36).slice(2, 10), sessions: [] };
  }

  private save() {
    if (this.log.sessions.length > MAX_SESSIONS) this.log.sessions.splice(0, this.log.sessions.length - MAX_SESSIONS);
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.log));
    } catch {
      /* storage full or blocked: the log is best-effort */
    }
  }

  private secs(from: number) {
    return Math.round((this.now() - from) / 100) / 10;
  }

  get current() {
    return this.cur;
  }

  begin(level: string, kind: string) {
    this.end();
    this.cur = { level, kind, start: this.now(), length: 0, runs: [], edits: 0, firstRun: null, solvedAt: null, hint: 0, rewinds: 0, open: true };
    this.mark = this.now();
    this.log.sessions.push(this.cur);
    this.save();
  }

  edit() {
    if (this.cur) this.cur.edits++;
  }

  run() {
    const s = this.cur;
    if (!s) return;
    if (s.firstRun === null) s.firstRun = this.secs(s.start);
    s.runs.push({ built: this.secs(this.mark), lasted: 0, end: 'reset' });
    this.runStart = this.now();
    this.save();
  }

  private lastRun() {
    return this.cur?.runs[this.cur.runs.length - 1];
  }

  /** The run solved, settled or timed out. A later reset of the same run keeps this ending. */
  result(end: Exclude<RunEnd, 'reset'>, info: { stages?: number; absurd?: boolean; elegant?: boolean } = {}) {
    const s = this.cur;
    const r = this.lastRun();
    if (!s || !r || r.end !== 'reset') return;
    r.end = end;
    r.lasted = this.secs(this.runStart);
    Object.assign(r, info);
    if (end === 'solved' && s.solvedAt === null) s.solvedAt = this.secs(s.start);
    this.save();
  }

  /** Back to building. */
  reset() {
    const r = this.lastRun();
    if (r && r.end === 'reset') r.lasted = this.secs(this.runStart);
    this.mark = this.now();
    this.save();
  }

  hint(tier: number) {
    if (this.cur) this.cur.hint = Math.max(this.cur.hint, tier);
  }

  rewind() {
    if (this.cur) this.cur.rewinds++;
  }

  /** Optional 1–5 rating of the mission just played (the open session, or else the last one). */
  rate(stars: number, level?: string) {
    const s = this.cur ?? [...this.log.sessions].reverse().find((x) => !level || x.level === level);
    if (!s) return;
    s.rating = Math.max(1, Math.min(5, Math.round(stars)));
    this.save();
  }

  end() {
    const s = this.cur;
    if (!s) return;
    const r = this.lastRun();
    if (r && r.end === 'reset' && !r.lasted) r.lasted = this.secs(this.runStart);
    s.length = this.secs(s.start);
    delete s.open;
    this.cur = null;
    this.save();
  }

  clear() {
    this.log = { v: 1, player: this.log.player, sessions: [] };
    this.cur = null;
    this.save();
  }

  /** Download the log as a JSON file, for sending to whoever is collecting playtests. */
  download() {
    const blob = new Blob([JSON.stringify(this.log)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `follyworks-playtest-${this.log.player}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  summary() {
    return summarize([this.log]);
  }
}

// ------------------------------------------------------------------ analysis

export interface LevelSignals {
  level: string;
  players: number;
  sessions: number;
  /** Share of players who solved it at all. */
  solveRate: number;
  /** Share of players who left it unsolved and never came back to solve it. */
  quitRate: number;
  /** Medians over players who solved it. */
  runsToSolve: number | null;
  minutesToSolve: number | null;
  /** Median seconds spent building between runs: the length of one try. */
  secondsPerTry: number | null;
  /** Median seconds before the very first RUN. */
  secondsToFirstRun: number | null;
  /** Share of solvers who used a ghost hint. */
  ghostRate: number;
  /** Share of solvers who kept running the machine after solving it. */
  replayRate: number;
  /** Share of solvers who also earned ABSURD. */
  absurdRate: number;
  rating: number | null;
  /** Plain-language flags. */
  flags: string[];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const share = (n: number, d: number) => (d ? n / d : 0);

/** Thresholds for player-side flags; see docs/fun/MEASURING_FUN.md. */
export const PLAY_LIMITS = {
  quit: 0.25,
  minutes: 8,
  ghost: 0.5,
  firstRun: 90,
  tryLength: 60,
};

/** Per-level signals from one or more players' logs (sessions of campaign and lab missions only). */
export const summarize = (logs: PlaytestLog[]): LevelSignals[] => {
  const byLevel = new Map<string, { player: string; s: SessionRecord }[]>();
  for (const log of logs)
    for (const s of log.sessions) {
      if (s.kind !== 'campaign') continue;
      const list = byLevel.get(s.level) ?? [];
      list.push({ player: log.player, s });
      byLevel.set(s.level, list);
    }
  const out: LevelSignals[] = [];
  for (const [level, list] of byLevel) {
    const players = [...new Set(list.map((x) => x.player))];
    // one row per player: their sessions on this level in order
    const per = players.map((p) => list.filter((x) => x.player === p).map((x) => x.s).sort((a, b) => a.start - b.start));
    const solvers = per.filter((ss) => ss.some((s) => s.solvedAt !== null));
    const quitters = per.filter((ss) => !ss.some((s) => s.solvedAt !== null) && ss.some((s) => s.runs.length > 0 || s.length > 20));
    const untilSolve = solvers.map((ss) => {
      const k = ss.findIndex((s) => s.solvedAt !== null);
      const before = ss.slice(0, k);
      return {
        runs: before.reduce((n, s) => n + s.runs.length, 0) + ss[k].runs.findIndex((r) => r.end === 'solved') + 1,
        minutes: (before.reduce((n, s) => n + s.length, 0) + ss[k].solvedAt!) / 60,
        ghost: ss.slice(0, k + 1).some((s) => s.hint >= 3),
        replay: ss.slice(k).some((s, i) => (i === 0 ? s.runs.slice(s.runs.findIndex((r) => r.end === 'solved') + 1) : s.runs).length > 0),
        absurd: ss.some((s) => s.runs.some((r) => r.absurd)),
      };
    });
    const all = per.flat();
    const tries = all.flatMap((s) => s.runs.map((r) => r.built));
    const ratings = all.map((s) => s.rating).filter((r): r is number => typeof r === 'number');
    const sig: LevelSignals = {
      level,
      players: players.length,
      sessions: all.length,
      solveRate: share(solvers.length, players.length),
      quitRate: share(quitters.length, players.length),
      runsToSolve: median(untilSolve.map((u) => u.runs)),
      minutesToSolve: median(untilSolve.map((u) => u.minutes)),
      secondsPerTry: median(tries),
      secondsToFirstRun: median(all.map((s) => s.firstRun).filter((x): x is number => x !== null)),
      ghostRate: share(untilSolve.filter((u) => u.ghost).length, solvers.length),
      replayRate: share(untilSolve.filter((u) => u.replay).length, solvers.length),
      absurdRate: share(untilSolve.filter((u) => u.absurd).length, solvers.length),
      rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      flags: [],
    };
    const L = PLAY_LIMITS;
    if (sig.quitRate >= L.quit) sig.flags.push(`${Math.round(sig.quitRate * 100)}% gave up on it`);
    if ((sig.minutesToSolve ?? 0) > L.minutes) sig.flags.push(`takes ${sig.minutesToSolve!.toFixed(1)} min to solve`);
    if (solvers.length && sig.ghostRate >= L.ghost) sig.flags.push(`${Math.round(sig.ghostRate * 100)}% needed ghost hints`);
    if ((sig.secondsToFirstRun ?? 0) > L.firstRun) sig.flags.push(`${Math.round(sig.secondsToFirstRun!)}s before anyone presses RUN`);
    if ((sig.secondsPerTry ?? 0) > L.tryLength) sig.flags.push(`slow loop: ${Math.round(sig.secondsPerTry!)}s of building per try`);
    if (sig.rating !== null && sig.rating < 3) sig.flags.push(`rated ${sig.rating.toFixed(1)}/5`);
    out.push(sig);
  }
  return out;
};

/** The one log for this browser. Null storage outside the browser. */
export const playtest = new Playtest(typeof localStorage !== 'undefined' ? localStorage : null);
if (typeof window !== 'undefined') (window as any).__follyworksPlaytest = playtest;
