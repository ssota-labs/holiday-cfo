/**
 * Silence the one warning node:sqlite prints on load. Import this FIRST.
 *
 * The patch runs as a module side effect, not as an exported function you call.
 * That is deliberate and it is not stylistic: ESM hoists every import above the
 * module body, so a `silence()` call in main.ts would run *after* node:sqlite had
 * already loaded and already warned. Only a side effect in a module that is
 * imported earlier gets there in time.
 *
 * Why bother: stderr carries this CLI's machine-readable error envelope. The
 * caller is an agent, and it should not have to strip a Node banner out of the
 * stream before parsing. Exactly one warning is dropped; everything else still
 * gets through.
 */
const original = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === 'string' ? warning : warning?.message;
  if (typeof text === 'string' && text.includes('SQLite is an experimental feature')) return;
  return (original as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

export {};
