'use client';

import { createContext, useContext } from 'react';

/**
 * The datasets a dashboard renders. Produced by the server reading the ledger —
 * NEVER by the agent.
 *
 * This split is the whole point of the design. The agent chooses which blocks to
 * show and in what order; it does not supply a single number. A dashboard where
 * the model retypes balances would be worse than no dashboard: a wrong figure in
 * a well-designed card reads as authoritative, which is exactly why the ledger
 * refuses to estimate anything it can observe.
 *
 * So the catalog's props are FILTERS — an account prefix, a month — and the data
 * comes from here.
 */
export interface Datasets {
  readonly balances: readonly {
    accountCode: string;
    commodity: string;
    unitsMinor: string;
    weightMinor: string;
  }[];
  readonly cashflow: {
    openingCashMinor: string;
    commodity: string;
    runway: readonly { date: string; label: string; deltaMinor: string; closingMinor: string }[];
  };
  readonly health: {
    ok: boolean;
    checked: number;
    problems: readonly { kind: string; detail: string }[];
    head: { seq: number; hash: string } | null;
  };
}

const DataContext = createContext<Datasets | null>(null);

export function DataProvider({ value, children }: { value: Datasets; children: React.ReactNode }) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDatasets(): Datasets {
  const v = useContext(DataContext);
  if (!v) throw new Error('holiday: a dashboard block was rendered outside <DataProvider>');
  return v;
}
