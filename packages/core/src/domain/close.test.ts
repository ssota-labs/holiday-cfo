import { describe, expect, it } from 'vitest';

import type { AccountCode, AccountId, IsoDate } from './account.js';
import type { CommodityCode } from './commodity.js';
import { type AssertionCheck, CloseError, checkAssertion, closeGate, monthBounds, revaluationLines } from './close.js';

const d = (s: string) => s as IsoDate;
const USD = 'USD' as CommodityCode;
const WISE = 'wise' as AccountId;
const WISE_CODE = 'Assets:Bank:Wise:USD' as AccountCode;

describe('monthBounds', () => {
  it('spans the whole month', () => {
    expect(monthBounds('2026-07')).toEqual({ id: 'month:2026-07', start: '2026-07-01', end: '2026-07-31' });
  });

  it('knows how long February is', () => {
    expect(monthBounds('2026-02').end).toBe('2026-02-28');
    expect(monthBounds('2028-02').end).toBe('2028-02-29');
  });

  it('rejects anything that is not a month', () => {
    for (const bad of ['2026', '2026-7', '2026-13', '2026-00', '2026-07-01', '']) {
      expect(() => monthBounds(bad), bad).toThrow(CloseError);
    }
  });
});

describe('checkAssertion', () => {
  it('passes only on an exact match', () => {
    expect(checkAssertion(4310000n, 4310000n)).toEqual({ deltaMinor: 0n, ok: true });
  });

  it('reports the exact gap, in the direction that says what happened', () => {
    // Ledger has MORE than the bank → we recorded something that did not happen,
    // or missed a withdrawal. The sign is the first clue.
    expect(checkAssertion(4310000n, 4320000n)).toEqual({ deltaMinor: 10000n, ok: false });
    expect(checkAssertion(4310000n, 4300000n)).toEqual({ deltaMinor: -10000n, ok: false });
  });

  it('catches the misread the rest of the system cannot', () => {
    // ₩1,240,000 read as ₩1,240,00. Balanced, conformant, and wrong by
    // ₩1,115,100 — and ONLY an assertion notices.
    expect(checkAssertion(1240000n, 124000n).ok).toBe(false);
  });
});

describe('revaluationLines', () => {
  it('emits the movement since the last close, not the whole gain', () => {
    // carrying is the historical KRW basis and accumulates, so the delta is
    // incremental. No reversal at period start — that would double the journal
    // for no information.
    const lines = revaluationLines([
      { accountId: WISE, accountCode: WISE_CODE, commodity: USD, unitsMinor: 100000n, carryingMinor: 1300000n, targetMinor: 1400000n },
    ]);
    expect(lines).toEqual([{ accountId: WISE, accountCode: WISE_CODE, commodity: USD, deltaMinor: 100000n }]);
  });

  it('emits a loss as a negative delta', () => {
    const lines = revaluationLines([
      { accountId: WISE, accountCode: WISE_CODE, commodity: USD, unitsMinor: 100000n, carryingMinor: 1400000n, targetMinor: 1350000n },
    ]);
    expect(lines[0]!.deltaMinor).toBe(-50000n);
  });

  it('skips accounts that did not move — a zero posting is noise', () => {
    expect(
      revaluationLines([
        { accountId: WISE, accountCode: WISE_CODE, commodity: USD, unitsMinor: 100000n, carryingMinor: 1300000n, targetMinor: 1300000n },
      ]),
    ).toEqual([]);
  });

  it('revalues a spent-out account back to zero', () => {
    // Bought $1,000 @1300, revalued to 1400 (+100,000), then spent it all @1350.
    // units are 0 but carrying is still 50,000 — the leftover from the revaluation.
    // Closing at any rate must take carrying to 0, and that 50,000 is the FX loss
    // that makes the whole trip net out correctly.
    const lines = revaluationLines([
      { accountId: WISE, accountCode: WISE_CODE, commodity: USD, unitsMinor: 0n, carryingMinor: 50000n, targetMinor: 0n },
    ]);
    expect(lines[0]!.deltaMinor).toBe(-50000n);
  });

  it('handles many accounts at once', () => {
    const other = 'ibkr' as AccountId;
    const lines = revaluationLines([
      { accountId: WISE, accountCode: WISE_CODE, commodity: USD, unitsMinor: 1n, carryingMinor: 100n, targetMinor: 110n },
      { accountId: other, accountCode: 'Assets:Broker:IBKR' as AccountCode, commodity: USD, unitsMinor: 1n, carryingMinor: 200n, targetMinor: 200n },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.accountId).toBe(WISE);
  });
});

describe('closeGate', () => {
  const pass: AssertionCheck = {
    accountCode: 'Assets:Bank:KB:Checking' as AccountCode,
    asOf: d('2026-07-31'),
    commodity: 'KRW' as CommodityCode,
    expectedMinor: 4310000n,
    actualMinor: 4310000n,
    deltaMinor: 0n,
    ok: true,
  };
  const fail: AssertionCheck = { ...pass, actualMinor: 4300000n, deltaMinor: -10000n, ok: false };

  it('opens when there is nothing outstanding', () => {
    expect(closeGate(0, [pass]).ok).toBe(true);
  });

  it('REFUSES over an unreviewed draft, and names the count', () => {
    // Silently excluding drafts would let a month close with a screenshot nobody
    // looked at. That is frozen, not closed.
    const g = closeGate(3, [pass]);
    expect(g.ok).toBe(false);
    expect(g.explanation).toMatch(/3건의 드래프트/);
  });

  it('REFUSES over a failing assertion, and shows the gap', () => {
    // Closing over a disagreement with the bank throws away the only signal that
    // the model misread something.
    const g = closeGate(0, [fail]);
    expect(g.ok).toBe(false);
    expect(g.failedAssertions).toEqual([fail]);
    expect(g.explanation).toMatch(/-10000 차이/);
  });

  it('reports every reason at once, not the first', () => {
    const g = closeGate(2, [fail]);
    expect(g.explanation.split('\n')).toHaveLength(2);
  });

  it('closes a month with no assertions at all', () => {
    // Nothing to check against is not the same as a failed check. It is worth a
    // warning at the CLI, but it is not a hard gate — a brand new ledger has none.
    expect(closeGate(0, []).ok).toBe(true);
  });
});
