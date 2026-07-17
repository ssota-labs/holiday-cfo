import type { CommodityCode, Grain } from '@holiday/core';
import { type SqlEngine, SqlLedgerStore } from '@holiday/store-sql';

import { SqliteDriver } from './driver.js';
import { MIGRATIONS } from './migrations.generated.js';
import { PRAGMAS, SCHEMA_VERSION } from './schema.js';

/**
 * The SQLite engine: a driver, the DDL, and the two things that are genuinely
 * SQLite's own — pragmas and the WAL checkpoint.
 *
 * The ~1,500 lines that used to be in this file are now in @holiday/store-sql,
 * because a count said they should be: exactly eight were dialect-specific. The
 * alternative on the table was copying them for Postgres, which produces two
 * files that agree today and drift on the first hand-edit that lands in one and
 * not the other. The port boundary exists to prevent that.
 */
export interface SqliteStoreOptions {
  readonly path: string;
  readonly book: {
    readonly functionalCurrency: CommodityCode;
    readonly closeGrain?: Grain;
    readonly timezone?: string;
  };
  readonly now?: () => string;
}

export function sqliteEngine(path: string): SqlEngine {
  return {
    name: 'sqlite',
    driver: SqliteDriver.open(path),
    migrations: MIGRATIONS,
    schemaVersion: SCHEMA_VERSION,
    // Pragmas are per-connection, so they are set on open and never migrated.
    init: async (d) => d.exec(PRAGMAS),
    // ledger.db is meant to be committed, and an un-checkpointed file can be
    // missing the most recent transactions — they are still sitting in the -wal
    // that git is (correctly) ignoring. A backup that silently omits last week is
    // worse than no backup.
    checkpoint: async (d) => d.exec('PRAGMA wal_checkpoint(TRUNCATE)'),
  };
}

/** Open the ledger at `path`. Call `init()` then `migrate()` before using it. */
export function sqliteLedgerStore(opts: SqliteStoreOptions): SqlLedgerStore {
  return new SqlLedgerStore({
    engine: sqliteEngine(opts.path),
    book: opts.book,
    ...(opts.now ? { now: opts.now } : {}),
  });
}
