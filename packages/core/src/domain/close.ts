import type { AccountCode, AccountId, IsoDate } from './account.js';
import type { CommodityCode } from './commodity.js';
import { clampDay, daysInMonth } from './billing.js';

/**
 * 마감 — the accounting truth of a period.
 *
 * Two things the plan asked for that are deliberately NOT here:
 *
 * **No multi-grain hard close.** A day sits inside a month; revaluing FX at both
 * double-counts it. There is exactly one hard-close grain per book. Daily and
 * weekly are checkpoints — snapshots only, no revaluation, no journal lock.
 *
 * **No closing entries into equity.** That ritual exists because paper ledgers
 * had no way to compute a period-scoped sum without one. We have SQL. Posting
 * them means "2026 dining spend" becomes a query that must know about and exclude
 * them — journal noise to solve a problem we do not have. The snapshot gives
 * carry-forward and a self-contained balance sheet without touching the journal.
 */

export interface PeriodBounds {
  readonly id: string;
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export class CloseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloseError';
  }
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function monthBounds(spec: string): PeriodBounds {
  const m = MONTH_RE.exec(spec.trim());
  if (!m) throw new CloseError(`${JSON.stringify(spec)} is not a month. Write it as YYYY-MM, e.g. 2026-07.`);
  const [, y, mo] = m;
  const year = Number(y);
  const month = Number(mo);
  if (month < 1 || month > 12) throw new CloseError(`${spec}: month must be 01-12`);
  const last = daysInMonth(year, month);
  return {
    id: `month:${y}-${mo}`,
    start: `${y}-${mo}-01` as IsoDate,
    end: `${y}-${mo}-${String(last).padStart(2, '0')}` as IsoDate,
  };
}

export interface AssertionCheck {
  readonly accountCode: AccountCode;
  readonly asOf: IsoDate;
  readonly commodity: CommodityCode;
  readonly expectedMinor: bigint;
  readonly actualMinor: bigint;
  readonly deltaMinor: bigint;
  readonly ok: boolean;
}

/**
 * The gate that actually matters.
 *
 * A month whose balances were never checked against a statement is not closed —
 * it is frozen. Everything else in this system guards structure; only an
 * assertion compares the ledger to the world.
 */
export function checkAssertion(expectedMinor: bigint, actualMinor: bigint): { deltaMinor: bigint; ok: boolean } {
  const delta = actualMinor - expectedMinor;
  return { deltaMinor: delta, ok: delta === 0n };
}

export interface RevaluationInput {
  readonly accountId: AccountId;
  readonly accountCode: AccountCode;
  readonly commodity: CommodityCode;
  /** Closing balance in the account's own commodity. */
  readonly unitsMinor: bigint;
  /** Historical-cost KRW basis — free, it is SUM(weight_minor). */
  readonly carryingMinor: bigint;
  /** What those units are worth in KRW at the closing rate. */
  readonly targetMinor: bigint;
}

export interface RevaluationLine {
  readonly accountId: AccountId;
  readonly accountCode: AccountCode;
  readonly commodity: CommodityCode;
  /** Signed. Positive = the KRW carrying value went up. */
  readonly deltaMinor: bigint;
}

/**
 * What revaluation writes.
 *
 * Each line becomes a posting with **`units_minor = 0` and a non-zero weight**.
 * That is the move that makes revaluation-only FX work: it changes the KRW
 * carrying value without touching the foreign-currency balance, and
 * `SUM(weight) = 0` still holds against the offsetting Income:FX line.
 *
 * It is only expressible because weight is STORED separately from units rather
 * than derived from units × rate. Under a rate-derived model there is no way to
 * say "this account is worth more KRW now" without lying about how many dollars
 * are in it.
 *
 * Revaluation is INCREMENTAL — carrying accumulates, so each close only posts the
 * movement since the last one. No reversal at period start: that exists to keep
 * paper worksheets honest and here would just double the journal for no
 * information.
 */
export function revaluationLines(inputs: readonly RevaluationInput[]): RevaluationLine[] {
  return inputs
    .map((i) => ({
      accountId: i.accountId,
      accountCode: i.accountCode,
      commodity: i.commodity,
      deltaMinor: i.targetMinor - i.carryingMinor,
    }))
    .filter((l) => l.deltaMinor !== 0n);
}

export interface CloseGate {
  readonly ok: boolean;
  readonly draftCount: number;
  readonly failedAssertions: readonly AssertionCheck[];
  readonly explanation: string;
}

/**
 * Can this period close?
 *
 * Drafts must be RESOLVED, not silently excluded — an unreviewed screenshot is
 * not a closed month. And an assertion that disagrees with the bank is the whole
 * reason to have assertions; closing over it throws away the signal.
 */
export function closeGate(draftCount: number, assertions: readonly AssertionCheck[]): CloseGate {
  const failed = assertions.filter((a) => !a.ok);
  const parts: string[] = [];
  if (draftCount > 0) {
    parts.push(
      `${draftCount}건의 드래프트가 이 기간에 남아 있습니다. 검토되지 않은 캡쳐가 있는 달은 마감된 게 아닙니다 — ` +
        `\`holiday review list\`로 처리하세요.`,
    );
  }
  for (const a of failed) {
    parts.push(
      `${a.accountCode} (${a.asOf}): 장부는 ${a.actualMinor}, 단언은 ${a.expectedMinor} — ${a.deltaMinor} 차이.`,
    );
  }
  return {
    ok: parts.length === 0,
    draftCount,
    failedAssertions: failed,
    explanation: parts.length === 0 ? `마감 가능` : parts.join('\n'),
  };
}

export function clampToMonthEnd(year: number, month: number, day: number): number {
  return clampDay(year, month, day);
}
