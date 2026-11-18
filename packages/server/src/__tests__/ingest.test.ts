import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openStore } from "../relate-db.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("ingest", () => {
  it("seeds unique clients and indexes", () => {
    execSync("npx tsx src/cli/seed.ts", { cwd: serverRoot, stdio: "pipe" });

    const conn = openStore({ readOnly: true });
    const clients = conn.query("MATCH (c:Client) RETURN count(c) AS n").single().n;
    expect(Number(clients)).toBe(3);

    const indexes = conn
      .query(
        `SHOW INDEXES YIELD name, type, state
         WHERE type IN ['FULLTEXT', 'VECTOR']
         RETURN count(name) AS n`,
      )
      .single().n;
    expect(Number(indexes)).toBeGreaterThanOrEqual(4);
  });
});