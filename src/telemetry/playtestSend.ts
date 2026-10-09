// Playtest mode and sending a finished log to John. Opening the game with ?playtest turns the mode
// on for this browser until the player finishes; the UI for it is ui/playtestKit.ts. Finishing
// POSTs the log to /api/playtest (the Worker stores it in D1; `npm run playtests:pull` fetches
// them), and when that fails (offline, or a dev server with no API) saves it as a file instead.

import type { PlaytestLog } from './playtest';

const MODE_KEY = 'follyworks.playtestMode';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;

export const playtestMode = {
  on(storage: Store): boolean {
    try {
      return storage?.getItem(MODE_KEY) === '1';
    } catch {
      return false;
    }
  },
  set(storage: Store, on: boolean) {
    try {
      if (on) storage?.setItem(MODE_KEY, '1');
      else storage?.removeItem(MODE_KEY);
    } catch {
      /* blocked storage: the mode lasts for this page only */
    }
  },
};

/** Whether a URL's query asks for playtest mode (?playtest, ?playtest=1; not ?playtest=0). */
export const wantsPlaytest = (search: string) => {
  const q = new URLSearchParams(search);
  return q.has('playtest') && !/^(0|off|false|no)$/i.test(q.get('playtest') ?? '');
};

export type SendOutcome = 'sent' | 'saved';

export interface SendDeps {
  fetch: (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'headers'>>;
  /** Save the log as a file on the player's device (the fallback). */
  download: (log: PlaytestLog) => void;
}

export const PLAYTEST_ENDPOINT = '/api/playtest';

/**
 * Send a finished log, or save it as a file when the server can't take it. The note (the player's
 * name or nickname) goes along beside the log and into it. Only a 2xx that is not an HTML page
 * counts as sent: a static host or dev server may answer an unknown POST with its index page.
 */
export async function sendPlaytest(log: PlaytestLog, note: string | undefined, deps: SendDeps): Promise<SendOutcome> {
  const name = note?.replace(/\s+/g, ' ').trim().slice(0, 60) || undefined;
  const body: { log: PlaytestLog; note?: string } = { log: name ? { ...log, name } : log };
  if (name) body.note = name;
  try {
    const res = await deps.fetch(PLAYTEST_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (res.ok && !/text\/html/i.test(res.headers.get('content-type') ?? '')) return 'sent';
  } catch {
    /* offline or blocked: fall through to the file */
  }
  deps.download(body.log);
  return 'saved';
}

/** File name of a saved log: follyworks-playtest-<name>-<id>.json. */
export const playtestFileName = (log: PlaytestLog) => {
  const who = (log.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `follyworks-playtest-${who ? `${who}-` : ''}${log.player}.json`;
};

/** Browser download of a log (the fallback when sending fails). */
export const downloadLog = (log: PlaytestLog) => {
  const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = playtestFileName(log);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
