# ClientGraph

**ClientGraph** is a hackathon entry for [Relate by Neo4j](https://relate.devpost.com/): a persistent client-memory graph and Q&A agent for freelancers and small agencies.

All sample clients, contacts, and dollar amounts are **fictional** and loaded from deterministic seed data.

## Quick start

Requires **Node.js 18+**. Tested with **Relate v1.1.0** (`@relate/relate` npm package). Optional: install the Relate CLI to inspect the store (`curl -sSfL https://relatedb.ai/install.sh | bash`).

```bash
npm install
npm run seed    # writes data/clientgraph.rl
npm test        # ingest + 6 golden Q&A tests
npm run dev     # API :9847 + UI :9848
```

Single-port production run (built UI served by the API):

```bash
npm run build && npm start   # open http://127.0.0.1:9847
```

Verify everything in one step: `npm run verify` (seed + tests + build).

Open **http://127.0.0.1:9848** and try:

1. Who approved the scope change for the cohort comparison module?
2. What is unpaid and overdue?
3. Which client relationships are at risk and why?

No API keys required for the default demo.

## Architecture

| Piece | Role |
| --- | --- |
| `packages/server` | Express API, Relate embedded store, ingest, rule-based agent |
| `packages/web` | React + Vite UI: question, answer, evidence graph path |
| `data/clientgraph.rl` | Persistent single-file Relate store (created by `npm run seed`) |

### Graph model

Nodes: `Client`, `Contact`, `Project`, `ScopeItem`, `Approval`, `Invoice`, `Payment`, `Message`, `Deliverable`  
Relationships include `WORKS_FOR`, `BELONGS_TO`, `PART_OF`, `APPROVES`, `GAVE_APPROVAL`, `EVIDENCES`, `BILLED_FOR`, `SETTLES`, `ABOUT`, `DELIVERED_FOR`.

## How we use Relate

Verified against official docs at [relatedb.ai](https://relatedb.ai/docs/get-started/install) and GitHub [relatedb/relate](https://github.com/relatedb/relate).

| Capability | Where |
| --- | --- |
| Embedded Node.js client `@relate/relate` **1.1.0** | `packages/server/src/relate-db.ts` |
| Persistent **single-file** store `.rl` | `data/clientgraph.rl` |
| Cypher schema: constraints, `CREATE`, `MATCH` traversals | `packages/server/src/ingest.ts` |
| **FULLTEXT** indexes on `Message.text`, `ScopeItem.searchText` | `ingest.ts` |
| **VECTOR** indexes (8-dim `FLOAT32`, cosine) on embeddings | `ingest.ts` |
| **SEARCH** clause + reciprocal rank fusion (hybrid) | `packages/server/src/hybrid.ts` |
| `SHOW INDEXES` verification in tests | `ingest.test.ts` |
| Read-only queries for API / agent | `openStore({ readOnly: true })` |
| Optional CLI inspection | `relate --database ./data/clientgraph.rl --read-only` |

**Not used in this MVP:** Relate WASM in-browser (Node backend chosen for simpler judge repro), Bolt/HTTP/MCP server modes, Neo4j `pull`/`push`.

Embeddings for hybrid search are **deterministic hashes of text** (no paid embedding API) so the demo stays zero-cost while still exercising vector indexes.

## Agent behavior

- **Default:** rule/intent planner maps common freelancer questions to Cypher and builds an evidence subgraph via `RETURN` of nodes/relationships.
- **Optional:** set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) for LLM-drafted read-only Cypher; failures fall back to rules.

## Scripts

```bash
npm run seed          # recreate data/clientgraph.rl
npm test              # vitest
npm run dev           # server + web concurrently (from root)
npm run build         # compile server + web
```

Run API only:

```bash
npm run dev -w @clientgraph/server
npm run dev -w @clientgraph/web
```

## AI tools used

- **Cursor Cloud Agent** (Composer) authored the scaffold, Relate integration, tests, UI, and documentation.
- No paid third-party APIs are required to run or test the project.

## License

MIT — see [LICENSE](LICENSE).

## Demo video outline

See [docs/demo-script.md](docs/demo-script.md) for a 90-second walkthrough script.