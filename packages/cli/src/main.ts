/**
 * The bin entry point.
 *
 * `./env.js` must come first: its module body installs the stderr warning filter,
 * and module bodies run in import order. It does not need to beat node:sqlite's
 * linking — see the comment in env.ts for why that turned out not to matter.
 */
import './env.js';

import './cli.js';
