import { defineConfig } from 'tsup';

/**
 * Bundles the CLI into `plugin/bin/holiday.mjs` — one file, no dependencies.
 *
 * This is what a Claude Code plugin actually needs. Plugins are copied into a
 * versioned cache with NO install step, so there is no `pnpm install` and no
 * postinstall to compile anything. Whatever is committed is what runs.
 *
 * That constraint is why the SQLite adapter uses `node:sqlite` rather than
 * better-sqlite3: a native addon cannot be bundled, and shipping per-platform
 * prebuilds or a vendored node_modules into a plugin is not a thing. node:sqlite
 * is a builtin, so it stays external here and resolves at runtime.
 *
 * The committed output rots if nobody watches it, so CI re-bundles and diffs
 * against the committed file.
 */
export default defineConfig({
  entry: { holiday: 'src/main.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: '../../plugin/bin',
  outExtension: () => ({ js: '.mjs' }),
  // Everything that is not a Node builtin gets inlined: @holiday-cfo/core,
  // @holiday-cfo/store-sql, @holiday-cfo/store-sqlite, commander, zod.
  //
  // The pattern is anchored on the scope with a hyphen class rather than a bare
  // `@holiday/`: renaming the scope to @holiday-cfo silently stopped the old
  // regex matching, tsup happily marked every workspace package external, and the
  // bundle built clean and died at runtime with ERR_MODULE_NOT_FOUND. Typecheck
  // and 211 tests all passed — nothing tests the bundle but running it, which is
  // why bundle:check exists and why CI must run it.
  noExternal: [/^@holiday-cfo\//, 'commander', 'zod'],
  /**
   * The `createRequire` line is not decoration.
   *
   * commander is CJS. Inlined into an ESM bundle, esbuild emits a `__require`
   * shim that throws "Dynamic require of node:events is not supported" — the
   * bundle builds clean and dies on the first run. That shim is written as
   * `typeof require !== "undefined" ? require : <throwing stub>` and evaluates at
   * module init, so defining a real `require` ABOVE it makes the shim resolve to
   * the real thing instead of the stub. Order matters; this must stay in the
   * banner. (tsup's `shims` option does not cover this — it handles __dirname and
   * __filename.)
   */
  banner: {
    js: [
      '#!/usr/bin/env node',
      // Aliased: bundled source imports createRequire under its own name, and two
      // top-level declarations of it is a SyntaxError that only appears in the
      // bundle.
      "import { createRequire as __nodeCreateRequire } from 'node:module';",
      'const require = __nodeCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  /**
   * Load-bearing. tsup defaults this to true and rewrites `node:sqlite` to
   * `sqlite`, which does not resolve — newer builtins are reachable ONLY via the
   * prefix. The bundle builds clean, reports success, and then dies on the first
   * run with "Cannot find package 'sqlite'".
   *
   * (esbuild itself preserves the prefix at every target; this is tsup's own
   * rewrite, kept for backwards compatibility with old Node.)
   */
  removeNodeProtocol: false,
  clean: true,
  minify: false, // A human should be able to read what a plugin is about to run.
  sourcemap: false,
  splitting: false,
  dts: false,
  /**
   * The dash template is data, not code, so the bundler walks straight past it.
   *
   * `holiday dash init` resolves it as `../templates/` from whatever is running,
   * which is the one path that holds for both shapes:
   *
   *   npm      dist/main.js      → packages/cli/templates/   (files: [...])
   *   plugin   bin/holiday.mjs   → plugin/templates/         ← copied here
   *
   * Without this the plugin build produces a CLI whose `dash init` throws. It
   * would not be caught by typecheck or by any test that imports the source,
   * because both find the template through the workspace. Only running the
   * bundled binary finds it — same lesson as the noExternal regex above.
   */
  onSuccess: async () => {
    const { cpSync, rmSync } = await import('node:fs');
    const dest = new URL('../../plugin/templates/', import.meta.url);
    rmSync(dest, { recursive: true, force: true });
    cpSync(new URL('templates/', import.meta.url), dest, { recursive: true });
  },
});
