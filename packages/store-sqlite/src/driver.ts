import type { Dialect, SqlDriver, SqlValue } from '@holiday-cfo/store-sql';

import { Db } from './db.js';

/**
 * SQLite wearing an async coat.
 *
 * node:sqlite is synchronous, so every method here resolves immediately and none
 * of the awaits in the store cost a syscall. The coat is worn because the reverse
 * is impossible: Postgres cannot be made synchronous, and the alternative to one
 * async store was two stores — which is a mirror, and mirrors drift.
 *
 * The awaits are not free of meaning, though. Between two of them the microtask
 * queue drains, so a *second* concurrent unitOfWork() on the same store would
 * interleave its statements into this one's transaction. That was true before
 * this refactor too — node:sqlite is one connection and BEGIN IMMEDIATE is
 * connection-wide — and the CLI is one command per process, so it cannot happen
 * today. It is written down because it will not stay obvious.
 */
export class SqliteDriver implements SqlDriver {
  readonly dialect: Dialect = {
    name: 'sqlite',
    subtreeWildcard: (prefix) => `${prefix}:*`,
    prepare: (sql) => sql,
  };

  #inTransaction = false;

  constructor(readonly db: Db) {}

  static open(path: string): SqliteDriver {
    return new SqliteDriver(new Db(path));
  }

  async get<T>(sql: string, ...params: readonly SqlValue[]): Promise<T | undefined> {
    return this.db.get<T>(sql, ...params);
  }

  async all<T>(sql: string, ...params: readonly SqlValue[]): Promise<T[]> {
    return this.db.all<T>(sql, ...params);
  }

  async run(sql: string, ...params: readonly SqlValue[]): Promise<void> {
    this.db.run(sql, ...params);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * IMMEDIATE, not DEFERRED: take the write lock up front so a concurrent writer
   * fails at BEGIN rather than at COMMIT, where the work is already done.
   *
   * Nested calls join the outer transaction rather than issuing a second BEGIN,
   * which SQLite rejects outright. The migration runner wraps each migration in
   * one of these, and seeding the book opens another inside migrate() — so the
   * nesting is real, not hypothetical.
   */
  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    if (this.#inTransaction) return fn(this);
    this.db.exec('BEGIN IMMEDIATE');
    this.#inTransaction = true;
    try {
      const out = await fn(this);
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // A rollback failure must not mask the original error.
      }
      throw e;
    } finally {
      this.#inTransaction = false;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
