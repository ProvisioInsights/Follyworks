// The Follyworks API, run by the Worker (worker/index.ts) for /api/* only; static assets (the game)
// are served by Cloudflare without running any script (`assets.run_worker_first` in wrangler.jsonc).
//
//   GET  /api/save/:id   the stored save JSON, 404 if there is none (ETag: its revision)
//   PUT  /api/save/:id   store a save. With If-Match: "<rev>" it only replaces that revision and
//                        answers 412 otherwise, so a device merges before it overwrites.
//   POST /api/playtest   { log, note? } from a player who chose to send their playtest log; 204
//
// Everything else under /api/ (other paths, other methods, malformed ids) is 404. Saves and logs live in D1 (migrations/0001_init.sql).

import { isCloudId } from '../src/persistence/cloudId';

/** The parts of Cloudflare's D1 binding used here (kept local so no extra type package is needed). */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

export interface Env {
  DB: D1Like;
  ASSETS?: { fetch(req: Request): Promise<Response> };
}

export const MAX_SAVE_BYTES = 512 * 1024;
export const MAX_PLAYTEST_BYTES = 512 * 1024;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const fail = (status: number, error: string) => json({ error }, status);

/** Read a JSON object body no bigger than `max` bytes, or a ready error Response. */
const readObject = async (req: Request, max: number): Promise<{ text: string; value: Record<string, unknown> } | Response> => {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > max) return fail(413, 'too large');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > max) return fail(413, 'too large');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail(400, 'not json');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(400, 'not a json object');
  return { text, value: value as Record<string, unknown> };
};

const etag = (rev: number) => `"${rev}"`;
const revOf = (header: string | null) => {
  const m = header?.match(/^(?:W\/)?"?(\d+)"?$/);
  return m ? Number(m[1]) : null;
};

const getSave = async (env: Env, id: string) => {
  const row = await env.DB.prepare('SELECT data, rev FROM saves WHERE id = ?').bind(id).first<{ data: string; rev: number }>();
  if (!row) return fail(404, 'no save');
  return new Response(row.data, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: etag(row.rev) } });
};

const putSave = async (req: Request, env: Env, id: string) => {
  const body = await readObject(req, MAX_SAVE_BYTES);
  if (body instanceof Response) return body;
  const now = Date.now();
  const ifMatch = req.headers.get('if-match');
  const ifNone = req.headers.get('if-none-match');
  let changes: number;
  let rev: number;
  if (ifMatch !== null) {
    const want = revOf(ifMatch);
    if (want === null) return fail(400, 'bad if-match');
    ({ changes } = (await env.DB.prepare('UPDATE saves SET data = ?, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ?').bind(body.text, now, id, want).run()).meta);
    rev = want + 1;
  } else if (ifNone === '*') {
    ({ changes } = (await env.DB.prepare('INSERT INTO saves (id, data, rev, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT (id) DO NOTHING').bind(id, body.text, now).run()).meta);
    rev = 1;
  } else {
    // Unconditional write (tools, or a client that does not care): create or replace.
    await env.DB.prepare(
      'INSERT INTO saves (id, data, rev, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data, rev = saves.rev + 1, updated_at = excluded.updated_at',
    )
      .bind(id, body.text, now)
      .run();
    const row = await env.DB.prepare('SELECT rev FROM saves WHERE id = ?').bind(id).first<{ rev: number }>();
    changes = 1;
    rev = row?.rev ?? 1;
  }
  if (!changes) {
    const row = await env.DB.prepare('SELECT rev FROM saves WHERE id = ?').bind(id).first<{ rev: number }>();
    return json({ error: 'stale', rev: row?.rev ?? null }, 412, row ? { etag: etag(row.rev) } : {});
  }
  return json({ rev, updatedAt: now }, 200, { etag: etag(rev) });
};

const postPlaytest = async (req: Request, env: Env) => {
  const body = await readObject(req, MAX_PLAYTEST_BYTES);
  if (body instanceof Response) return body;
  const log = body.value.log as Record<string, unknown> | undefined;
  if (!log || typeof log !== 'object' || Array.isArray(log) || !Array.isArray(log.sessions)) return fail(400, 'log missing');
  const note = typeof body.value.note === 'string' ? body.value.note.slice(0, 2000) : null;
  const player = typeof log.player === 'string' ? log.player.slice(0, 64) : null;
  await env.DB.prepare('INSERT INTO playtests (created_at, player, note, log) VALUES (?, ?, ?, ?)').bind(Date.now(), player, note, JSON.stringify(log)).run();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};

export const handle = async (req: Request, env: Env): Promise<Response> => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : fail(404, 'not found');
  try {
    const save = url.pathname.match(/^\/api\/save\/([^/]+)$/);
    if (save) {
      const id = save[1];
      if (!isCloudId(id)) return fail(404, 'not found');
      if (req.method === 'GET') return await getSave(env, id);
      if (req.method === 'PUT') return await putSave(req, env, id);
    }
    if (url.pathname === '/api/playtest' && req.method === 'POST') return await postPlaytest(req, env);
    return fail(404, 'not found');
  } catch (e) {
    console.error('api error', e);
    return fail(500, 'server error');
  }
};
