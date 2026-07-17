import type { SqlDriver } from './driver.js';
import type { Migration } from './migrate.js';

/**
 * Everything about a SQL engine that the store cannot be written without.
 *
 * This is deliberately tiny, and its size is the argument for the whole design:
 * the store is ~1,500 lines, and *this* is all of it that differs between SQLite
 * and Postgres. Anything that grows this interface should be looked at hard —
 * it means a real difference was found, or that engine-specific behaviour is
 * leaking into shared code.
 */
export interface SqlEngine {
  /** Reported as `store.name` and in error envelopes. */
  readonly name: string;
  readonly driver: SqlDriver;
  /**
   * The DDL. Injected, not imported: `sqliteTable` and `pgTable` are different
   * Drizzle builders and the trigger bodies are genuinely different SQL
   * (`RAISE(ABORT)` vs plpgsql `RAISE EXCEPTION`), so each engine brings its own.
   * See ADR-005.
   */
  readonly migrations: readonly Migration[];
  /** Bumped when the shape of the book row changes, not per migration. */
  readonly schemaVersion: number;
  /** Connection-level setup that is not migratable — SQLite's PRAGMAs. */
  init?(driver: SqlDriver): Promise<void>;
  /**
   * Make the durable file/ database self-contained.
   *
   * SQLite folds the WAL back in, which matters because ledger.db is meant to be
   * committed and an un-checkpointed file can be missing the most recent
   * transactions. Postgres has no equivalent and no need for one.
   */
  checkpoint?(driver: SqlDriver): Promise<void>;
}
