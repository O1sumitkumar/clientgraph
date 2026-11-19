import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { askAgent } from "./agent/planner.js";
import { seedStore } from "./ingest.js";
import {
  openStore,
  RELATE_PKG_VERSION,
  storeExists,
} from "./relate-db.js";
import { STORE_PATH } from "./paths.js";

const PORT = Number(process.env.PORT ?? 9847);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function getConn() {
  if (!storeExists()) {
    throw new Error("Store not seeded. Run: npm run seed");
  }
  return openStore({ readOnly: true });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    relatePackage: RELATE_PKG_VERSION,
    storePath: STORE_PATH,
    seeded: storeExists(),
  });
});

app.post("/api/ask", async (req, res) => {
  try {
    const question = String(req.body?.question ?? "");
    const conn = getConn();
    const answer = await askAgent(conn, question);
    res.json(answer);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

app.get("/api/graph/sample", (_req, res) => {
  try {
    const conn = getConn();
    const rows = conn.query(
      `MATCH (cl:Client)<-[:BELONGS_TO]-(p:Project)
       RETURN cl.name AS client, p.name AS project, p.riskScore AS risk
       ORDER BY risk DESC`,
    ).rows;
    res.json({ projects: rows });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Serve the built web UI (npm run build) so `npm start` is a single-port demo.
const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(path.join(WEB_DIST, "index.html"))) {
  app.use(express.static(WEB_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, "index.html")));
}

if (!storeExists()) {
  console.log("No store at", STORE_PATH, "— seeding on startup…");
  seedStore(true);
}

app.listen(PORT, () => {
  console.log(
    `ClientGraph API on http://127.0.0.1:${PORT} (Relate @relate/relate ${RELATE_PKG_VERSION})`,
  );
});