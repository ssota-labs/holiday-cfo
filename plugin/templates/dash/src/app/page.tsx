import { DataProvider, registry } from '@holiday-cfo/blocks';
import { Renderer } from '@json-render/react';

import datasets from '../data/ledger.json';
import spec from '../data/spec.json';

/**
 * The whole dashboard.
 *
 * It reads two files and renders. It does NOT open ledger.db — that is the point,
 * and it is what lets one build run both locally and on Codex Sites, which has no
 * filesystem and no Node runtime.
 *
 *   data/ledger.json  the FIGURES.  Baked by `holiday dash data`, from the ledger.
 *   data/spec.json    the LAYOUT.   Written by the agent, from the catalog.
 *
 * Re-bake with `holiday dash data` whenever the ledger changes. The snapshot is
 * honest about its age: bakedAt is rendered, because a dashboard that cannot say
 * how old it is lies by omission.
 */
export default function Page() {
  return (
    <DataProvider value={datasets}>
      <Renderer spec={spec} registry={registry} />
    </DataProvider>
  );
}
