import type { Account, AccountCode, AccountId } from './account.js';

export interface LedgerStatusRow {
  readonly label: string;
  readonly accountCode: AccountCode;
}

export interface LedgerStatusAssetRow extends LedgerStatusRow {
  readonly cash: boolean;
}

export interface LedgerStatusSnapshot {
  readonly generatedAt: string;
  readonly assets: readonly LedgerStatusAssetRow[];
  readonly cards: readonly LedgerStatusRow[];
  readonly loans: readonly LedgerStatusRow[];
  readonly installments: readonly LedgerStatusRow[];
  readonly otherLiabilities: readonly LedgerStatusRow[];
}

export interface BuildLedgerStatusInput {
  readonly generatedAt: string;
  readonly accounts: readonly Account[];
  readonly cards: readonly { readonly accountId: AccountId; readonly label: string | null }[];
  readonly loans: readonly { readonly accountId: AccountId; readonly label: string | null }[];
  readonly installments: readonly {
    readonly liabilityAccountId: AccountId;
    readonly label: string | null;
  }[];
}

/**
 * 원장의 구조만 현황 스냅샷으로 만든다. 금액은 입력에도 출력에도 두지 않는다.
 *
 * SPEC-ledger-status 수락 기준 2–3.
 */
export function buildLedgerStatus(input: BuildLedgerStatusInput): LedgerStatusSnapshot {
  const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
  const hasChild = new Set<AccountId>();
  for (const account of input.accounts) {
    if (account.parentId) hasChild.add(account.parentId);
    for (const possibleParent of input.accounts) {
      if (account.code.startsWith(`${possibleParent.code}:`)) hasChild.add(possibleParent.id);
    }
  }

  const assets = input.accounts
    .filter((account) => account.type === 'asset' && !account.placeholder && !hasChild.has(account.id))
    .map((account) => ({ ...rowFor(account), cash: account.cash }))
    .sort(compareRows);

  const cards = input.cards
    .map((card) => rowForId(accountsById, card.accountId, card.label))
    .filter(isPresent)
    .sort(compareRows);

  const loans = input.loans
    .map((loan) => rowForId(accountsById, loan.accountId, loan.label))
    .filter(isPresent)
    .sort(compareRows);

  const installments = input.installments
    .map((plan) => rowForId(accountsById, plan.liabilityAccountId, plan.label))
    .filter(isPresent)
    .sort(compareRows);

  const classified = new Set<AccountId>([
    ...input.cards.map((card) => card.accountId),
    ...input.loans.map((loan) => loan.accountId),
    ...input.installments.map((plan) => plan.liabilityAccountId),
  ]);
  const otherLiabilities = input.accounts
    .filter(
      (account) =>
        account.type === 'liability' &&
        !account.placeholder &&
        !hasChild.has(account.id) &&
        !classified.has(account.id),
    )
    .map(rowFor)
    .sort(compareRows);

  return { generatedAt: input.generatedAt, assets, cards, loans, installments, otherLiabilities };
}

/** Render the complete, replace-on-refresh status.md body. */
export function renderLedgerStatusMarkdown(status: LedgerStatusSnapshot): string {
  const lines = [
    '# 장부 현황',
    '',
    `갱신 시각: ${status.generatedAt}`,
    '',
    '## 계좌',
    '',
    ...renderRows(status.assets, (row) => (row.cash ? ' (쓸 수 있는 돈)' : '')),
    '',
    '## 부채',
    '',
    '### 카드',
    '',
    ...renderRows(status.cards),
    '',
    '### 대출',
    '',
    ...renderRows(status.loans),
    '',
    '### 할부',
    '',
    ...renderRows(status.installments),
  ];

  if (status.otherLiabilities.length > 0) {
    lines.push('', '### 그 외 부채', '', ...renderRows(status.otherLiabilities));
  }
  lines.push('');
  return lines.join('\n');
}

function rowFor(account: Account): LedgerStatusRow {
  return { label: lastSegment(account.code), accountCode: account.code };
}

function rowForId(
  accountsById: ReadonlyMap<AccountId, Account>,
  accountId: AccountId,
  label: string | null,
): LedgerStatusRow | null {
  const account = accountsById.get(accountId);
  return account ? { label: label?.trim() || lastSegment(account.code), accountCode: account.code } : null;
}

function lastSegment(code: AccountCode): string {
  return code.slice(code.lastIndexOf(':') + 1);
}

function compareRows(a: LedgerStatusRow, b: LedgerStatusRow): number {
  return a.accountCode.localeCompare(b.accountCode);
}

function renderRows<T extends LedgerStatusRow>(
  rows: readonly T[],
  suffix: (row: T) => string = () => '',
): string[] {
  return rows.length > 0
    ? rows.map((row) => `- ${row.label}${suffix(row)} — \`${row.accountCode}\``)
    : ['- 없음'];
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
