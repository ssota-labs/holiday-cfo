/**
 * Narrowing helpers for values that arrive from SQL as something wider.
 *
 * Both engines need this and for opposite reasons, which is why it is here and
 * not in a driver:
 *
 *   - node:sqlite reads every INTEGER as `bigint` (because store-sqlite's driver
 *     forces setReadBigInts(true) — see its db.ts for why), so COUNT(*) and 0/1
 *     flags arrive as bigint too.
 *   - Postgres sends int8 as a *string* over the wire, because it does not fit a
 *     JS number; its driver converts to bigint at the boundary.
 *
 * Either way the store sees `bigint | number` and narrows here, loudly. Silently
 * accepting a wrong-width number is how a ledger starts lying.
 */

/** Narrow a bigint read back to a small JS number, loudly. */
export function toInt(v: bigint | number): number {
  const n = typeof v === 'bigint' ? Number(v) : v;
  if (!Number.isSafeInteger(n)) throw new RangeError(`expected a small integer, got ${v}`);
  return n;
}

export function toBool(v: bigint | number): boolean {
  return toInt(v) === 1;
}

export function toBigInt(v: bigint | number): bigint {
  return typeof v === 'bigint' ? v : BigInt(v);
}
