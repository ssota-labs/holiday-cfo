/**
 * The thin driver seam.
 *
 * Two clients, one interface:
 *
 * - **postgres.js** — a direct/pooled connection to Supabase. This is what makes
 *   the adapter engine tier: real multi-statement transactions, real constraints,
 *   real triggers. Over PostgREST/supabase-js there are no multi-statement
 *   transactions at all, so a 3-leg write could half-apply — and a store that
 *   cannot promise atomicity may not claim to be an engine. `init()` enforces
 *   that; see assertEngineTier.
 *
 * - **pglite** — Postgres compiled to WASM, in-process. Not a mock and not a
 *   different database: it is Postgres. It is what lets the conformance suite
 *   actually run here rather than the adapter shipping unverified, which after
 *   everything this project says about verification would be indefensible.
 *
 * Both are pure JS, so both bundle.
 */
export interface PgClient {
  /** Positional params are $1-style, per Postgres. */
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Multi-statement DDL. No params. */
  exec(sql: string): Promise<void>;
  /** A real transaction. The callback's client MUST be used for the work inside. */
  transaction<T>(fn: (tx: PgClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Minimal shape of a pglite instance — typed here so pglite stays a devDependency. */
interface PgliteLike {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: PgliteLike) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function pgliteClient(db: PgliteLike): PgClient {
  const wrap = (h: PgliteLike): PgClient => ({
    async query<T>(sql: string, params: readonly unknown[] = []) {
      return (await h.query<T>(sql, [...params])).rows;
    },
    async exec(sql: string) {
      await h.exec(sql);
    },
    async transaction<T>(fn: (tx: PgClient) => Promise<T>) {
      return h.transaction(async (tx) => fn(wrap(tx)));
    },
    async close() {
      await h.close();
    },
  });
  return wrap(db);
}

/** Minimal shape of a postgres.js instance. */
interface PostgresJsLike {
  unsafe(sql: string, params?: unknown[]): Promise<unknown[]> & { values(): Promise<unknown[]> };
  begin<T>(fn: (tx: PostgresJsLike) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

export function postgresJsClient(sql: PostgresJsLike): PgClient {
  const wrap = (h: PostgresJsLike): PgClient => ({
    async query<T>(text: string, params: readonly unknown[] = []) {
      return (await h.unsafe(text, [...params])) as T[];
    },
    async exec(text: string) {
      await h.unsafe(text);
    },
    async transaction<T>(fn: (tx: PgClient) => Promise<T>) {
      // begin() rolls back on throw, which is the atomicity the engine tier
      // promises. Do NOT reach for the outer `sql` inside — that would run
      // outside the transaction and half-apply on failure.
      return h.begin(async (tx) => fn(wrap(tx)));
    },
    async close() {
      await h.end();
    },
  });
  return wrap(sql);
}

/**
 * Postgres returns int8 as a string over the wire, to avoid the precision loss a
 * JS number would cause. That is the correct default and we keep it — but every
 * amount then has to be turned back into a bigint at exactly one boundary.
 *
 * Same problem as node:sqlite's setReadBigInts, arrived at from the opposite
 * direction: SQLite would have handed back a lossy number, Postgres hands back a
 * lossless string. Both need one place that knows.
 */
export function toBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'string') return BigInt(v);
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new RangeError(`i64 arrived as an unsafe number: ${v}`);
    return BigInt(v);
  }
  throw new TypeError(`cannot read ${typeof v} as a bigint`);
}

export function toInt(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'bigint' ? Number(v) : (v as number);
  if (!Number.isSafeInteger(n)) throw new RangeError(`expected a small integer, got ${String(v)}`);
  return n;
}

export function toBool(v: unknown): boolean {
  return toInt(v) === 1;
}
