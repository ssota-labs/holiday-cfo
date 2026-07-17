/**
 * @holiday/store-postgres — INCOMPLETE. Does not yet implement LedgerStore.
 *
 * What is here and real:
 *   - schema.drizzle.ts   the ledger in pg-core, amounts as native bigint
 *   - migrations/         generated DDL + hand-written plpgsql triggers
 *   - client.ts           the driver seam: postgres.js (Supabase) and pglite (tests)
 *
 * What is not here: the LedgerStore implementation. Until it exists this package
 * exports no store, deliberately — a partial adapter that threw on half its
 * methods would be a store lying about its tier, which is the exact failure the
 * tier contract exists to prevent. It is better to export nothing than to export
 * something that claims to be an engine and is not.
 *
 * The remaining work is a mechanical mirror of store-sqlite's ~1,500 lines:
 * `?` → `$1`, `GLOB` → `LIKE`, and sync → async throughout. The thinking is done;
 * the typing is not.
 *
 * When it lands, the proof that it works is already written:
 * `runLedgerStoreConformance('PgLedgerStore', factory)` — the same 26 cases that
 * SQLite passes. That suite exists precisely so a second engine cannot quietly be
 * worse than the first.
 */
export * from './client.js';
export { MIGRATIONS } from './migrations.generated.js';
export * as schema from './schema.drizzle.js';
