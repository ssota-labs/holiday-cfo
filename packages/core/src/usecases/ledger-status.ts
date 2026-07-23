import { buildLedgerStatus, type LedgerStatusSnapshot } from '../domain/ledger-status.js';
import type { LedgerRead } from '../ports/ledger-store.js';

/** Read the structural ledger records needed by status.md, without loading balances. */
export async function ledgerStatus(
  read: LedgerRead,
  generatedAt: string,
): Promise<LedgerStatusSnapshot> {
  const [accounts, cards, loans, installments] = await Promise.all([
    read.listAccounts(),
    read.listCards(),
    read.listLoans(),
    read.listInstallments(),
  ]);

  return buildLedgerStatus({
    generatedAt,
    accounts,
    cards,
    loans: loans.map(({ loan }) => ({
      accountId: loan.accountId,
      label: loan.label,
    })),
    installments: installments.map(({ plan }) => ({
      liabilityAccountId: plan.liabilityAccountId,
      label: plan.label,
    })),
  });
}
