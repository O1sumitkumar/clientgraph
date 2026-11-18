#!/usr/bin/env tsx
import { seedStore } from "../ingest.js";
import { RELATE_PKG_VERSION } from "../relate-db.js";
import { STORE_PATH } from "../paths.js";

const stats = seedStore(true);
console.log(
  JSON.stringify(
    {
      ok: true,
      store: STORE_PATH,
      relatePackage: RELATE_PKG_VERSION,
      nodes: stats.nodes,
      relationships: stats.relationships,
    },
    null,
    2,
  ),
);