// Types for scripts/fetch-donki.mjs (imported by tests/fetchDonki.test.ts).
export interface DonkiWindow {
  startDate: string;
  endDate: string;
}
export interface DonkiSnapshot {
  fetchedAt: string;
  source: { base: string; announcement: string };
  window: DonkiWindow;
  flr: { url: string; records: unknown[] };
  cme: { url: string; records: unknown[] };
}
export function windowFor(todayIso: string, days?: number): DonkiWindow;
export function donkiUrl(kind: 'FLR' | 'CME', startDate: string, endDate: string, base?: string): string;
export function parseBody(body: string): unknown[];
export function buildSnapshot(x: Omit<DonkiSnapshot, 'source'>): DonkiSnapshot;
