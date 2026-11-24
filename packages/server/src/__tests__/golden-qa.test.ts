import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { askAgent } from "../agent/planner.js";
import { openStore } from "../relate-db.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("ClientGraph golden Q&A", () => {
  beforeAll(() => {
    execSync("npm run seed", { cwd: serverRoot, stdio: "pipe" });
  });

  const conn = () => openStore({ readOnly: true });

  it("ingest creates expected node counts", () => {
    const row = conn()
      .query(
        `MATCH (n) OPTIONAL MATCH (n)-[r]->()
         RETURN count(DISTINCT n) AS nodes, count(r) AS rels`,
      )
      .single();
    expect(Number(row.nodes)).toBeGreaterThan(25);
    expect(Number(row.rels)).toBeGreaterThan(25);
  });

  it("Q1: who approved the cohort scope change", async () => {
    const answer = await askAgent(
      conn(),
      "Who approved the scope change for the cohort comparison module?",
    );
    expect(answer.intent).toBe("scope_approval");
    expect(answer.answer).toMatch(/Maya Chen/i);
    expect(answer.answer).toMatch(/SC-NW-02/);
    expect(answer.path.nodes.length).toBeGreaterThan(0);
    const types = answer.path.edges.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["APPROVES", "GAVE_APPROVAL", "EVIDENCES", "PART_OF", "BELONGS_TO"]));
    const ids = new Set(answer.path.nodes.map((n) => n.id));
    for (const e of answer.path.edges) {
      expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
    }
  });

  it("Q2: unpaid and overdue invoices", async () => {
    const answer = await askAgent(conn(), "What is unpaid and overdue?");
    expect(answer.intent).toBe("unpaid_overdue");
    expect(answer.answer).toMatch(/INV-NW-104/);
    expect(answer.answer).toMatch(/INV-HC-077/);
    expect(answer.answer).toMatch(/Harbor Creative/i);
  });

  it("Q3: client relationships at risk", async () => {
    const answer = await askAgent(
      conn(),
      "Which client relationships are at risk and why?",
    );
    expect(answer.intent).toBe("relationship_risk");
    expect(answer.answer).toMatch(/Harbor Creative/i);
    expect(answer.answer).toMatch(/Northwind/i);
    expect(answer.answer).toMatch(/overdue|unanswered|risk/i);
  });

  it("Q4: deliverable PR for Northwind", async () => {
    const answer = await askAgent(
      conn(),
      "What pull request deliverable shipped for the Northwind dashboard project?",
    );
    expect(answer.intent).toBe("deliverable_lookup");
    expect(answer.answer).toMatch(/feat: dashboard|DEL-NW/i);
  });

  it("Q5: Harbor contact", async () => {
    const answer = await askAgent(
      conn(),
      "Who is the account contact at Harbor Creative Studio?",
    );
    expect(answer.intent).toBe("contact_lookup");
    expect(answer.answer).toMatch(/Jordan Vale/i);
  });
});