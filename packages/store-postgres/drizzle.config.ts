import { defineConfig } from 'drizzle-kit';

/**
 * A SEPARATE schema from SQLite's, because Drizzle does not share one.
 * `sqliteTable` and `pgTable` are different builders with non-overlapping column
 * types — see ADR-005. This is a dialect fact, not a toolchain gap.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.drizzle.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
