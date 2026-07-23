import { describe, expect, it } from 'vitest';

import type { Account, AccountCode, AccountId, IsoDate } from './account.js';
import { buildLedgerStatus, renderLedgerStatusMarkdown } from './ledger-status.js';

const id = (value: string) => value as AccountId;
const code = (value: string) => value as AccountCode;

function account(
  value: string,
  type: Account['type'],
  opts: Partial<Pick<Account, 'cash' | 'placeholder' | 'parentId'>> = {},
): Account {
  return {
    id: id(value),
    code: code(value),
    type,
    parentId: opts.parentId ?? null,
    commodity: null,
    monetary: true,
    cash: opts.cash ?? false,
    placeholder: opts.placeholder ?? false,
    openedOn: '2026-01-01' as IsoDate,
    closedOn: null,
  };
}

describe('ledger status markdown', () => {
  it('renders asset leaves and classified liabilities without amounts', () => {
    // SPEC-ledger-status 수락 1–3: 고정 절, 구조별 계정, 금액 없음.
    const status = buildLedgerStatus({
      generatedAt: '2026-07-23T12:00:00+09:00',
      accounts: [
        account('Assets:Bank', 'asset'),
        account('Assets:Bank:Checking', 'asset', { cash: true }),
        account('Assets:Hidden', 'asset', { placeholder: true }),
        account('Liabilities:Card:Everyday', 'liability'),
        account('Liabilities:Card:Everyday:Installment', 'liability'),
        account('Liabilities:Loans:Home', 'liability'),
        account('Liabilities:Payable:Tax', 'liability'),
        account('Expenses:Food', 'expense'),
      ],
      cards: [{ accountId: id('Liabilities:Card:Everyday'), label: '생활 카드' }],
      loans: [{ accountId: id('Liabilities:Loans:Home'), label: '주택 대출' }],
      installments: [
        {
          liabilityAccountId: id('Liabilities:Card:Everyday:Installment'),
          label: '노트북 할부',
        },
      ],
    });

    expect(status.assets).toEqual([
      {
        label: 'Checking',
        accountCode: 'Assets:Bank:Checking',
        cash: true,
      },
    ]);
    expect(status.otherLiabilities).toEqual([
      {
        label: 'Tax',
        accountCode: 'Liabilities:Payable:Tax',
      },
    ]);

    const markdown = renderLedgerStatusMarkdown(status);
    expect(markdown).toContain('# 장부 현황');
    expect(markdown).toContain('갱신 시각: 2026-07-23T12:00:00+09:00');
    expect(markdown).toContain('Checking (쓸 수 있는 돈) — `Assets:Bank:Checking`');
    expect(markdown).toContain('생활 카드 — `Liabilities:Card:Everyday`');
    expect(markdown).toContain('주택 대출 — `Liabilities:Loans:Home`');
    expect(markdown).toContain('노트북 할부 — `Liabilities:Card:Everyday:Installment`');
    expect(markdown).toContain('Tax — `Liabilities:Payable:Tax`');
    expect(markdown).not.toContain('Assets:Bank`');
    expect(markdown).not.toContain('Assets:Hidden');
    expect(markdown).not.toContain('Expenses:Food');
    expect(markdown).not.toContain('1240000');
    expect(markdown).not.toMatch(/₩|원|잔액|minor/i);
  });

  it('renders stable empty sections and omits other liabilities when absent', () => {
    const status = buildLedgerStatus({
      generatedAt: '2026-07-23T03:00:00Z',
      accounts: [],
      cards: [],
      loans: [],
      installments: [],
    });

    const markdown = renderLedgerStatusMarkdown(status);
    expect(markdown.match(/- 없음/g)).toHaveLength(4);
    expect(markdown).not.toContain('### 그 외 부채');
    expect(renderLedgerStatusMarkdown(status)).toBe(markdown);
  });
});
