import { describe, expect, it } from 'vitest';

import type { IsoDate } from './account.js';
import { AmountFactory } from './amount.js';
import { CommodityRegistry, WELL_KNOWN_COMMODITIES } from './commodity.js';
import { RATE_SCALE } from './rate.js';
import {
  TaxReturn,
  describeTaxError,
  formatTaxRatePercent,
  taxLinesToColumns,
  type TaxReturnHeader,
} from './tax.js';

const d = (s: string) => s as IsoDate;
const registry = CommodityRegistry.from(WELL_KNOWN_COMMODITIES);
const amounts = new AmountFactory(registry);

const GLOBAL_COLUMNS = {
  global_income: {
    income_amount: '22144107',
    income_deduction: '2350580',
    tax_base: '19793527',
    tax_rate: '15.0',
    calculated_tax: '1709029',
    tax_credit: '70000',
    determined_tax_total: '1639029',
    additional_tax: '107570',
    already_paid: '563323',
    payable_within_deadline: '1183276',
  },
};

const VAT_COLUMNS = {
  vat: {
    taxable_supply: '48000000',
    output_tax: '4800000',
    input_tax: '1200000',
    payable_tax: '3600000',
    refundable_tax: '0',
  },
};

function baseInput(over: Partial<Parameters<typeof TaxReturn.create>[0]> = {}) {
  return {
    id: '01TAXRETURN0000000000000001',
    form: 'kr_global_income' as const,
    taxYear: 2025,
    period: 'annual' as const,
    filedOn: d('2026-06-22'),
    commodity: 'KRW' as const,
    createdAt: '2026-07-20T00:00:00.000Z',
    columns: GLOBAL_COLUMNS,
    amounts,
    ...over,
  };
}

describe('TaxReturn.create — POLICY-021', () => {
  it('accepts a global-income return with required keys and rates at RATE_SCALE', () => {
    const r = TaxReturn.create(baseInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.form).toBe('kr_global_income');
    expect(r.value.period).toBe('annual');
    expect(r.value.revision).toBe(1);
    expect(r.value.status).toBe('current');
    expect(r.value.lines.length).toBeGreaterThanOrEqual(3);

    const rate = r.value.lines.find((l) => l.lineKey === 'tax_rate')!;
    expect(rate.valueKind).toBe('rate');
    expect(rate.valueScaled).toBe(RATE_SCALE * 15n / 100n);

    const income = r.value.lines.find((l) => l.lineKey === 'income_amount')!;
    expect(income.valueScaled).toBe(22_144_107n);
  });

  it('accepts a VAT H1_final return with required keys', () => {
    const r = TaxReturn.create(
      baseInput({
        form: 'kr_vat',
        period: 'H1_final',
        columns: VAT_COLUMNS,
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = new Set(r.value.lines.map((l) => l.lineKey));
    expect(keys.has('taxable_supply')).toBe(true);
    expect(keys.has('output_tax')).toBe(true);
    expect(keys.has('input_tax')).toBe(true);
    expect(keys.has('payable_tax')).toBe(true);
  });

  it('rejects kr_global_income with a VAT period', () => {
    const r = TaxReturn.create(baseInput({ period: 'H1_final' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.some((e) => e.code === 'invalid_tax_form_period')).toBe(true);
  });

  it('rejects kr_vat with annual', () => {
    const r = TaxReturn.create(
      baseInput({ form: 'kr_vat', period: 'annual', columns: VAT_COLUMNS }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.some((e) => e.code === 'invalid_tax_form_period')).toBe(true);
  });

  it('rejects missing required global_income keys', () => {
    const r = TaxReturn.create(
      baseInput({
        columns: { global_income: { income_amount: '1' } },
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const missing = r.error.find((e) => e.code === 'missing_tax_lines');
    expect(missing).toBeDefined();
    if (missing?.code !== 'missing_tax_lines') return;
    expect(missing.missing).toEqual(expect.arrayContaining(['tax_base', 'payable_within_deadline']));
  });

  it('rejects VAT without payable_tax and refundable_tax', () => {
    const r = TaxReturn.create(
      baseInput({
        form: 'kr_vat',
        period: 'H1_final',
        columns: {
          vat: {
            taxable_supply: '1',
            output_tax: '1',
            input_tax: '1',
          },
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.some((e) => e.code === 'missing_tax_lines')).toBe(true);
  });

  it('accepts VAT with only refundable_tax (no payable)', () => {
    const r = TaxReturn.create(
      baseInput({
        form: 'kr_vat',
        period: 'H2_final',
        columns: {
          vat: {
            taxable_supply: '0',
            output_tax: '0',
            input_tax: '500000',
            refundable_tax: '500000',
          },
        },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects unknown line keys', () => {
    const r = TaxReturn.create(
      baseInput({
        columns: {
          global_income: {
            ...GLOBAL_COLUMNS.global_income,
            made_up_key: '1',
          },
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.some((e) => e.code === 'unknown_tax_line')).toBe(true);
  });

  it('does not verify arithmetic between lines (observation-only)', () => {
    // tax_base ≠ income − deduction; still accepted — ADR-010.
    const r = TaxReturn.create(
      baseInput({
        columns: {
          global_income: {
            income_amount: '100',
            tax_base: '999999',
            payable_within_deadline: '1',
          },
        },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects year outside 2000–2100 and revision < 1', () => {
    const y = TaxReturn.create(baseInput({ taxYear: 1999 }));
    expect(y.ok).toBe(false);
    const rev = TaxReturn.create(baseInput({ revision: 0 }));
    expect(rev.ok).toBe(false);
  });
});

describe('TaxReturn.amend', () => {
  it('bumps revision and stamps supersedeId', () => {
    const first = TaxReturn.create(baseInput());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const previous: TaxReturnHeader = {
      id: first.value.id,
      form: first.value.form,
      taxYear: first.value.taxYear,
      period: first.value.period,
      filedOn: first.value.filedOn,
      revision: first.value.revision,
      status: 'current',
      commodity: first.value.commodity,
      note: null,
      sourcePath: null,
      sourceSha256: null,
      createdAt: first.value.createdAt,
    };
    const next = TaxReturn.amend({
      id: '01TAXRETURN0000000000000002',
      previous,
      filedOn: d('2026-07-01'),
      commodity: 'KRW',
      createdAt: '2026-07-20T01:00:00.000Z',
      columns: {
        global_income: {
          income_amount: '20000000',
          tax_base: '18000000',
          payable_within_deadline: '1000000',
        },
      },
      amounts,
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value.revision).toBe(2);
    expect(next.value.supersedeId).toBe(previous.id);
    expect(next.value.status).toBe('current');
  });

  it('refuses amend when previous is not current', () => {
    const previous: TaxReturnHeader = {
      id: '01TAXRETURN0000000000000001' as TaxReturnHeader['id'],
      form: 'kr_global_income',
      taxYear: 2025,
      period: 'annual',
      filedOn: d('2026-06-22'),
      revision: 1,
      status: 'superseded',
      commodity: 'KRW',
      note: null,
      sourcePath: null,
      sourceSha256: null,
      createdAt: '2026-07-20T00:00:00.000Z',
    };
    const next = TaxReturn.amend({
      id: '01TAXRETURN0000000000000002',
      previous,
      filedOn: d('2026-07-01'),
      commodity: 'KRW',
      createdAt: '2026-07-20T01:00:00.000Z',
      columns: GLOBAL_COLUMNS,
      amounts,
    });
    expect(next.ok).toBe(false);
    if (next.ok) return;
    expect(next.error[0]!.code).toBe('amend_requires_previous');
  });
});

describe('tax line display helpers', () => {
  it('round-trips a short percent through formatTaxRatePercent', () => {
    expect(formatTaxRatePercent(RATE_SCALE * 15n / 100n, 1)).toBe('15.0');
  });

  it('groups lines into columns for show', () => {
    const r = TaxReturn.create(baseInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cols = taxLinesToColumns(r.value.lines);
    expect(cols.global_income!.income_amount).toBe('22144107');
    expect(cols.global_income!.tax_rate).toBe('15.0');
  });

  it('describeTaxError covers missing keys', () => {
    expect(
      describeTaxError({
        code: 'missing_tax_lines',
        form: 'kr_vat',
        columnKey: 'vat',
        missing: ['payable_tax|refundable_tax'],
      }),
    ).toContain('payable_tax');
  });
});
