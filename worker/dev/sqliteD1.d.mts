import type { D1Like } from '../api';

/** In-memory D1 stand-in with migrations/ applied. `all` runs a query for test assertions. */
export declare const sqliteD1: () => D1Like & { all(sql: string): Record<string, unknown>[] };
