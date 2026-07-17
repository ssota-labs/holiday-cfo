/**
 * Drop the one warning node:sqlite prints on load. Import this before ./cli.js.
 *
 * Why stderr matters: it carries this CLI's machine-readable error envelope, and
 * the caller is an agent. It should not have to strip a Node banner out of the
 * stream before parsing.
 *
 * Why a LISTENER and not a `process.emitWarning` patch: node:sqlite emits during
 * module linking, which happens before any module body runs — so by the time a
 * patched emitWarning exists, the warning has already been queued. But
 * emitWarning only *queues*; the actual `process.emit('warning', …)` lands on the
 * next tick, which is after every module body. Swapping the listener therefore
 * catches it, and does so no matter how the module graph is ordered — including
 * after a bundler has inlined everything into one file.
 *
 * Exactly one warning is dropped. Everything else still prints.
 */
process.removeAllListeners('warning');

process.on('warning', (warning: Error) => {
  if (warning.name === 'ExperimentalWarning' && warning.message.includes('SQLite')) return;
  // Node's default handler prints roughly this; keep the shape familiar.
  process.stderr.write(`${warning.name}: ${warning.message}\n`);
});

export {};
