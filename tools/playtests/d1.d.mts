import type { PlaytestLog } from '../../src/telemetry/playtest';

export const PULL_SQL: string;
export function rowsFromD1(output: string): { id: number; created_at?: string; note?: string | null; log: unknown }[];
export function filesFromD1(output: string): { files: { file: string; log: PlaytestLog; created: string | null }[]; skipped: number[] };
