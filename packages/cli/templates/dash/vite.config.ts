import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import vinext from 'vinext';

// vinext: App-Router-compatible on Vite's pipeline. It is what Codex Sites
// builds, and it is also just `vite dev` locally — one config, both surfaces.
export default defineConfig({
  plugins: [vinext(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { host: true },
});
