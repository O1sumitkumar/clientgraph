# ClientGraph — 90-second demo script

**Audience:** Relate hackathon judges  
**Prereq:** `npm install && npm run seed && npm test` already green

## 0:00–0:15 — Problem

> “Freelancers juggle email threads, scope changes, invoices, and PRs. Answers live in disconnected tools. ClientGraph stores that context as a **persistent Relate graph** and answers with **hybrid retrieval plus traversals**, showing the path that justifies each answer.”

## 0:15–0:35 — Seed & store

Terminal:

```bash
npm run seed
relate --database ./data/clientgraph.rl --read-only --mode table \
  "MATCH (c:Client) RETURN c.name AS client ORDER BY client"
```

> “One command loads **fictional** Northwind, Harbor, and Lumen data into `data/clientgraph.rl` — a durable single-file Relate store.”

## 0:35–1:10 — UI Q&A (three judges’ questions)

```bash
npm run dev
```

Open the web UI (port **9848**). Ask, in order:

1. **Who approved the scope change for the cohort comparison module?**  
   Point to Maya Chen, `SC-NW-02`, and the evidence subgraph.

2. **What is unpaid and overdue?**  
   Highlight `INV-NW-104` and `INV-HC-077` with `Invoice → Project → Client` paths.

3. **Which client relationships are at risk and why?**  
   Show `riskScore` and `riskReasons` on Project nodes linked to clients.

> “Default planner is **rule-based** — no API keys. With `OPENAI_API_KEY` set, the server can optionally plan with an LLM but still runs `EXPLAIN` before executing.”

## 1:10–1:30 — Relate capabilities (voiceover)

> “We use embedded **@relate/relate 1.1.0**, Cypher traversals, **FULLTEXT** and **VECTOR** indexes, **SEARCH** with reciprocal-rank fusion for fallbacks, constraints, and a read-only API over the `.rl` file.”

End on the evidence graph panel: “Context, connected.”