import type { AmountFactory } from './amount.js';
import type { CommodityCode } from './commodity.js';
import type { IsoDate } from './account.js';
import { Err, Ok, type Result } from './result.js';
import { parseAnnualPercent, RATE_SCALE } from './rate.js';

/**
 * Tax return SoR — observed filing headers and tax-table cells.
 *
 * No tax formula lives here (ADR-010 / POLICY-021). Values are what the return
 * (or Hometax) already printed. The domain only checks form/period pairing,
 * registered line keys, and required cells — never arithmetic between lines.
 */

export type TaxForm = 'kr_global_income' | 'kr_vat';
export type TaxPeriod =
  | 'annual'
  | 'H1_provisional'
  | 'H1_final'
  | 'H2_provisional'
  | 'H2_final';
export type TaxReturnStatus = 'current' | 'superseded';
export type TaxValueKind = 'amount' | 'rate';

export const TAX_FORMS = ['kr_global_income', 'kr_vat'] as const;
export const TAX_PERIODS = [
  'annual',
  'H1_provisional',
  'H1_final',
  'H2_provisional',
  'H2_final',
] as const;
export const VAT_PERIODS = [
  'H1_provisional',
  'H1_final',
  'H2_provisional',
  'H2_final',
] as const;

declare const VALIDATED: unique symbol;
type Validated = { readonly [VALIDATED]: true };

export type TaxReturnId = string & { readonly __taxReturn: unique symbol };

export interface TaxReturnLine {
  readonly columnKey: string;
  readonly lineKey: string;
  readonly valueKind: TaxValueKind;
  readonly valueScaled: bigint;
}

export interface TaxReturnFields {
  readonly id: TaxReturnId;
  readonly form: TaxForm;
  readonly taxYear: number;
  readonly period: TaxPeriod;
  readonly filedOn: IsoDate;
  readonly revision: number;
  readonly status: TaxReturnStatus;
  readonly commodity: CommodityCode;
  readonly note: string | null;
  readonly sourcePath: string | null;
  readonly sourceSha256: string | null;
  readonly createdAt: string;
  readonly lines: readonly TaxReturnLine[];
  /** When set, `addTaxReturn` must supersede this id in the same transaction. */
  readonly supersedeId: TaxReturnId | null;
}

export type ValidatedTaxReturn = Validated & TaxReturnFields;

/** Header without lines — list / filter projections. */
export interface TaxReturnHeader {
  readonly id: TaxReturnId;
  readonly form: TaxForm;
  readonly taxYear: number;
  readonly period: TaxPeriod;
  readonly filedOn: IsoDate;
  readonly revision: number;
  readonly status: TaxReturnStatus;
  readonly commodity: CommodityCode;
  readonly note: string | null;
  readonly sourcePath: string | null;
  readonly sourceSha256: string | null;
  readonly createdAt: string;
}

/** Header + lines, grouped by column for CLI show. */
export interface TaxReturnDetail extends TaxReturnHeader {
  readonly lines: readonly TaxReturnLine[];
}

export type TaxError =
  | { readonly code: 'invalid_tax_form'; readonly form: string }
  | { readonly code: 'invalid_tax_period'; readonly period: string }
  | { readonly code: 'invalid_tax_form_period'; readonly form: TaxForm; readonly period: TaxPeriod }
  | { readonly code: 'invalid_tax_year'; readonly taxYear: number }
  | { readonly code: 'invalid_revision'; readonly revision: number }
  | { readonly code: 'unknown_tax_column'; readonly form: TaxForm; readonly columnKey: string }
  | {
      readonly code: 'unknown_tax_line';
      readonly form: TaxForm;
      readonly columnKey: string;
      readonly lineKey: string;
    }
  | {
      readonly code: 'missing_tax_lines';
      readonly form: TaxForm;
      readonly columnKey: string;
      readonly missing: readonly string[];
    }
  | {
      readonly code: 'invalid_tax_value';
      readonly columnKey: string;
      readonly lineKey: string;
      readonly reason: string;
    }
  | { readonly code: 'number_not_allowed'; readonly columnKey: string; readonly lineKey: string }
  | { readonly code: 'amend_requires_previous' };

export function describeTaxError(e: TaxError): string {
  switch (e.code) {
    case 'invalid_tax_form':
      return `unknown tax form ${JSON.stringify(e.form)}; use kr_global_income or kr_vat`;
    case 'invalid_tax_period':
      return `unknown tax period ${JSON.stringify(e.period)}`;
    case 'invalid_tax_form_period':
      return `form ${e.form} does not accept period ${e.period}`;
    case 'invalid_tax_year':
      return `tax year ${e.taxYear} is out of range (2000–2100)`;
    case 'invalid_revision':
      return `revision must be >= 1, got ${e.revision}`;
    case 'unknown_tax_column':
      return `form ${e.form} has no column ${JSON.stringify(e.columnKey)}`;
    case 'unknown_tax_line':
      return `form ${e.form} column ${e.columnKey} has no line ${JSON.stringify(e.lineKey)}`;
    case 'missing_tax_lines':
      return (
        `form ${e.form} column ${e.columnKey} is missing required line(s): ` +
        e.missing.join(', ')
      );
    case 'invalid_tax_value':
      return `${e.columnKey}.${e.lineKey}: ${e.reason}`;
    case 'number_not_allowed':
      return `${e.columnKey}.${e.lineKey} must be a decimal string, not a JSON number`;
    case 'amend_requires_previous':
      return 'amend needs a previous current return for the same form/year/period';
  }
}

type LineDef = { readonly valueKind: TaxValueKind };

/** Registered (form → column → line → kind). Unknown triples are rejected. */
export const TAX_LINE_REGISTRY: Readonly<
  Record<TaxForm, Readonly<Record<string, Readonly<Record<string, LineDef>>>>>
> = {
  kr_global_income: {
    global_income: {
      income_amount: { valueKind: 'amount' },
      income_deduction: { valueKind: 'amount' },
      tax_base: { valueKind: 'amount' },
      tax_rate: { valueKind: 'rate' },
      calculated_tax: { valueKind: 'amount' },
      tax_reduction: { valueKind: 'amount' },
      tax_credit: { valueKind: 'amount' },
      determined_tax_global: { valueKind: 'amount' },
      determined_tax_separate: { valueKind: 'amount' },
      determined_tax_total: { valueKind: 'amount' },
      additional_tax: { valueKind: 'amount' },
      additional_tax_payable: { valueKind: 'amount' },
      total_tax: { valueKind: 'amount' },
      already_paid: { valueKind: 'amount' },
      net_tax: { valueKind: 'amount' },
      payable_within_deadline: { valueKind: 'amount' },
    },
    rural_special: {
      tax_base: { valueKind: 'amount' },
      tax_rate: { valueKind: 'rate' },
      calculated_tax: { valueKind: 'amount' },
      determined_tax_total: { valueKind: 'amount' },
      net_tax: { valueKind: 'amount' },
      payable_within_deadline: { valueKind: 'amount' },
    },
  },
  kr_vat: {
    vat: {
      taxable_supply: { valueKind: 'amount' },
      output_tax: { valueKind: 'amount' },
      input_tax: { valueKind: 'amount' },
      payable_tax: { valueKind: 'amount' },
      refundable_tax: { valueKind: 'amount' },
      provisional_paid: { valueKind: 'amount' },
      additional_tax: { valueKind: 'amount' },
    },
  },
};

/** Required line keys per form/column. Empty = column optional; if present, no required keys. */
const REQUIRED_LINES: Readonly<Record<TaxForm, Readonly<Record<string, readonly string[]>>>> = {
  kr_global_income: {
    global_income: ['income_amount', 'tax_base', 'payable_within_deadline'],
  },
  kr_vat: {
    // payable/refundable handled specially (at least one).
    vat: ['taxable_supply', 'output_tax', 'input_tax'],
  },
};

export function isTaxForm(s: string): s is TaxForm {
  return (TAX_FORMS as readonly string[]).includes(s);
}

export function isTaxPeriod(s: string): s is TaxPeriod {
  return (TAX_PERIODS as readonly string[]).includes(s);
}

export function defaultPeriodForForm(form: TaxForm): TaxPeriod | null {
  return form === 'kr_global_income' ? 'annual' : null;
}

export function formAcceptsPeriod(form: TaxForm, period: TaxPeriod): boolean {
  if (form === 'kr_global_income') return period === 'annual';
  return (VAT_PERIODS as readonly string[]).includes(period);
}

export interface TaxReturnCreateInput {
  readonly id: string;
  readonly form: TaxForm;
  readonly taxYear: number;
  readonly period: TaxPeriod;
  readonly filedOn: IsoDate;
  readonly revision?: number;
  readonly commodity: CommodityCode;
  readonly note?: string | null;
  readonly sourcePath?: string | null;
  readonly sourceSha256?: string | null;
  readonly createdAt: string;
  /**
   * Observed cells: column → line → decimal string.
   * JSON numbers must be rejected by the caller before they reach here.
   */
  readonly columns: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly amounts: AmountFactory;
  readonly supersedeId?: string | null;
}

export interface TaxReturnAmendInput {
  readonly id: string;
  readonly previous: TaxReturnHeader;
  readonly filedOn: IsoDate;
  readonly commodity: CommodityCode;
  readonly note?: string | null;
  readonly sourcePath?: string | null;
  readonly sourceSha256?: string | null;
  readonly createdAt: string;
  readonly columns: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly amounts: AmountFactory;
}

export const TaxReturn = {
  create(input: TaxReturnCreateInput): Result<ValidatedTaxReturn, TaxError[]> {
    const errors: TaxError[] = [];
    const revision = input.revision ?? 1;

    if (!Number.isInteger(input.taxYear) || input.taxYear < 2000 || input.taxYear > 2100) {
      errors.push({ code: 'invalid_tax_year', taxYear: input.taxYear });
    }
    if (!Number.isInteger(revision) || revision < 1) {
      errors.push({ code: 'invalid_revision', revision });
    }
    if (!formAcceptsPeriod(input.form, input.period)) {
      errors.push({ code: 'invalid_tax_form_period', form: input.form, period: input.period });
    }

    const registry = TAX_LINE_REGISTRY[input.form];
    const lines: TaxReturnLine[] = [];

    for (const [columnKey, cells] of Object.entries(input.columns)) {
      const colReg = registry[columnKey];
      if (!colReg) {
        errors.push({ code: 'unknown_tax_column', form: input.form, columnKey });
        continue;
      }
      for (const [lineKey, raw] of Object.entries(cells)) {
        const def = colReg[lineKey];
        if (!def) {
          errors.push({ code: 'unknown_tax_line', form: input.form, columnKey, lineKey });
          continue;
        }
        if (typeof raw !== 'string') {
          errors.push({ code: 'number_not_allowed', columnKey, lineKey });
          continue;
        }
        try {
          const valueScaled =
            def.valueKind === 'rate'
              ? parseAnnualPercent(raw)
              : input.amounts.parse(raw, input.commodity).minor;
          lines.push({
            columnKey,
            lineKey,
            valueKind: def.valueKind,
            valueScaled,
          });
        } catch (e) {
          errors.push({
            code: 'invalid_tax_value',
            columnKey,
            lineKey,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Required keys — only for columns that appear OR are mandatory columns.
    for (const [columnKey, required] of Object.entries(REQUIRED_LINES[input.form])) {
      const present = new Set(
        lines.filter((l) => l.columnKey === columnKey).map((l) => l.lineKey),
      );
      // Mandatory columns (global_income, vat) must be present with required keys.
      const columnInInput = columnKey in input.columns;
      const isMandatoryColumn = columnKey === 'global_income' || columnKey === 'vat';
      if (!columnInInput && !isMandatoryColumn) continue;
      if (!columnInInput && isMandatoryColumn) {
        errors.push({
          code: 'missing_tax_lines',
          form: input.form,
          columnKey,
          missing: required,
        });
        continue;
      }
      const missing = required.filter((k) => !present.has(k));
      if (missing.length > 0) {
        errors.push({ code: 'missing_tax_lines', form: input.form, columnKey, missing });
      }
    }

    if (input.form === 'kr_vat') {
      const vatKeys = new Set(lines.filter((l) => l.columnKey === 'vat').map((l) => l.lineKey));
      if (vatKeys.size > 0 && !vatKeys.has('payable_tax') && !vatKeys.has('refundable_tax')) {
        errors.push({
          code: 'missing_tax_lines',
          form: input.form,
          columnKey: 'vat',
          missing: ['payable_tax|refundable_tax'],
        });
      }
    }

    if (errors.length > 0) return Err(errors);

    const fields: TaxReturnFields = {
      id: input.id as TaxReturnId,
      form: input.form,
      taxYear: input.taxYear,
      period: input.period,
      filedOn: input.filedOn,
      revision,
      status: 'current',
      commodity: input.commodity,
      note: input.note ?? null,
      sourcePath: input.sourcePath ?? null,
      sourceSha256: input.sourceSha256 ?? null,
      createdAt: input.createdAt,
      lines,
      supersedeId: (input.supersedeId as TaxReturnId | null | undefined) ?? null,
    };
    return Ok(fields as ValidatedTaxReturn);
  },

  /**
   * Build the next revision. Previous id is stamped for atomic supersede in the store.
   * Does not mutate `previous`.
   */
  amend(input: TaxReturnAmendInput): Result<ValidatedTaxReturn, TaxError[]> {
    if (input.previous.status !== 'current') {
      return Err([{ code: 'amend_requires_previous' }]);
    }
    return TaxReturn.create({
      id: input.id,
      form: input.previous.form,
      taxYear: input.previous.taxYear,
      period: input.previous.period,
      filedOn: input.filedOn,
      revision: input.previous.revision + 1,
      commodity: input.commodity,
      note: input.note ?? null,
      sourcePath: input.sourcePath ?? null,
      sourceSha256: input.sourceSha256 ?? null,
      createdAt: input.createdAt,
      columns: input.columns,
      amounts: input.amounts,
      supersedeId: input.previous.id,
    });
  },

  trustFromStorage(fields: TaxReturnFields): ValidatedTaxReturn {
    return fields as ValidatedTaxReturn;
  },
};

/** Group flat lines into column → line → display string (amounts as minor, rates as %). */
export function taxLinesToColumns(
  lines: readonly TaxReturnLine[],
  ratePlaces = 1,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const line of lines) {
    const col = out[line.columnKey] ?? (out[line.columnKey] = {});
    col[line.lineKey] =
      line.valueKind === 'rate' ? formatTaxRatePercent(line.valueScaled, ratePlaces) : line.valueScaled.toString();
  }
  return out;
}

/** Format a RATE_SCALE fraction as a percent string (e.g. 0.15 → "15.0"). */
export function formatTaxRatePercent(scaled: bigint, places = 1): string {
  // scaled is fraction (0.15 × 1e18); display as percent with `places` decimals.
  const pct = scaled * 100n;
  const divisor = RATE_SCALE / 10n ** BigInt(places);
  const v = pct / divisor; // truncate toward zero for stable round-trip of short inputs
  const neg = v < 0n;
  const abs = (neg ? -v : v).toString().padStart(places + 1, '0');
  const cut = abs.length - places;
  const body = places === 0 ? abs : `${abs.slice(0, cut)}.${abs.slice(cut)}`;
  return `${neg ? '-' : ''}${body}`;
}

export function headerOf(r: TaxReturnFields | TaxReturnDetail | ValidatedTaxReturn): TaxReturnHeader {
  return {
    id: r.id,
    form: r.form,
    taxYear: r.taxYear,
    period: r.period,
    filedOn: r.filedOn,
    revision: r.revision,
    status: r.status,
    commodity: r.commodity,
    note: r.note,
    sourcePath: r.sourcePath,
    sourceSha256: r.sourceSha256,
    createdAt: r.createdAt,
  };
}
