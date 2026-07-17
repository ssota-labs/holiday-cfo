/**
 * The entry point exists only to control load order. Real work is in cli.ts.
 *
 * Why it has to be this way, since it looks like pointless indirection:
 *
 * node:sqlite prints an ExperimentalWarning to stderr when it loads, and stderr
 * is where this CLI writes its machine-readable error envelope for the agent
 * calling it. Suppressing that warning means patching `process.emitWarning`
 * before node:sqlite loads — and with a STATIC `import ... from 'node:sqlite'`
 * anywhere in the graph, that is impossible. Static imports of builtins resolve
 * during the linking phase, which happens before *any* module body runs,
 * including a side-effecting one imported first. (Verified: a CJS `require` or a
 * dynamic `await import` is interceptable; a static import is not.)
 *
 * So the patch goes in a module that pulls in no builtins, and everything else —
 * commander, the store, node:sqlite — is loaded dynamically afterwards.
 */
import './env.js';

await import('./cli.js');
