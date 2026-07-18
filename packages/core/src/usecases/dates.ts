import type { IsoDate } from '../domain/index.js';

/**
 * Add months to an ISO date, clamping to the end of the target month.
 *
 * `2026-01-31` + 1 month is `2026-02-28`, not `2026-03-03`. JS Date rolls over;
 * a billing cycle does not.
 *
 * Lived in the CLI until the dashboard needed the same projection window. Pure,
 * no Date.now(), no timezone — the caller says what today is.
 */
export function addMonthsIso(date: string, delta: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const zero = m - 1 + delta;
  const ny = y + Math.floor(zero / 12);
  const nm = (((zero % 12) + 12) % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}` as IsoDate;
}
