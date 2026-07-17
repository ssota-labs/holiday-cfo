/**
 * The seam between one LedgerStore implementation and two SQL engines.
 *
 * This exists because of a measurement: store.ts is ~1,500 lines and exactly
 * EIGHT of them are dialect-specific (three GLOB, three PRAGMA, one
 * INSERT OR IGNORE, one BEGIN IMMEDIATE). Everything else is standard SQL. The
 * only structural difference is that node:sqlite is synchronous and Postgres is
 * not.
 *
 * So the store is written once against this interface. Mirroring it per engine —
 * which is what was started before this — produces two files that agree today and
 * drift on the first hand-edit that lands in one and not the other. The port
 * boundary exists to prevent exactly that, and hand-mirroring betrays it.
 *
 * What is NOT shared, and cannot be:
 *   - the Drizzle schema  (sqliteTable vs pgTable are different builders — ADR-005)
 *   - the triggers        (RAISE(ABORT) vs plpgsql RAISE EXCEPTION)
 *   - the driver          (setReadBigInts vs int8-arrives-as-string)
 */
export type SqlValue = string | number | bigint | null | Uint8Array;

/**
 * Async even for SQLite, where every call resolves immediately.
 *
 * Making the sync engine wear an async coat is the cheap direction; making
 * Postgres synchronous is impossible. The uow signature was already async.
 */
export interface SqlDriver {
  get<T>(sql: string, ...params: readonly SqlValue[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: readonly SqlValue[]): Promise<T[]>;
  run(sql: string, ...params: readonly SqlValue[]): Promise<void>;
  /** Multi-statement DDL, no params. */
  exec(sql: string): Promise<void>;
  /** A real transaction. The callback's driver MUST be used for the work inside. */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly dialect: Dialect;
}

export interface Dialect {
  readonly name: 'sqlite' | 'postgres';
  /**
   * The subtree wildcard for the materialized-path query.
   * SQLite globs `Assets:Bank:*`; Postgres LIKEs `Assets:Bank:%`.
   *
   * Account codes are `[A-Za-z0-9:-]` by construction, so neither `%` nor `_`
   * can appear in one and there is nothing to escape. The CLI validates that
   * before anything reaches here.
   */
  subtreeWildcard(prefix: string): string;
  /** Last chance to rewrite SQL per engine — placeholders, GLOB/LIKE, upserts. */
  prepare(sql: string): string;
}
