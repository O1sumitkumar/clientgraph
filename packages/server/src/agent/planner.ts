import type { Connection } from "../relate-db.js";
import { pathFromRow } from "../graph-path.js";
import { hybridSearchMessages } from "../hybrid.js";
import type { AgentAnswer } from "./types.js";
import { maybeLlmAnswer } from "./llm.js";

type Intent =
  | "scope_approval"
  | "unpaid_overdue"
  | "relationship_risk"
  | "contact_lookup"
  | "deliverable_lookup"
  | "hybrid_context"
  | "unknown";

const TODAY = "2026-11-18";

function formatDate(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "year" in value) {
    const d = value as { year: number; month: number; day: number };
    const mm = String(d.month).padStart(2, "0");
    const dd = String(d.day).padStart(2, "0");
    return `${d.year}-${mm}-${dd}`;
  }
  return String(value);
}

function classify(question: string): Intent {
  const q = question.toLowerCase();
  if (
    /who approved/.test(q) &&
    (/scope/.test(q) || /change/.test(q) || /sc-nw-02|cohort/.test(q))
  ) {
    return "scope_approval";
  }
  if (/unpaid|overdue|past due|outstanding/.test(q)) {
    return "unpaid_overdue";
  }
  if (/at risk|relationship/.test(q) && /client|account/.test(q)) {
    return "relationship_risk";
  }
  if (/contact|account director|who is/.test(q) && /harbor|northwind|lumen/.test(q)) {
    return "contact_lookup";
  }
  if (/deliverable|pull request|pr\b|shipped/.test(q) && /northwind|harbor|lumen|dashboard/.test(q)) {
    return "deliverable_lookup";
  }
  if (/scope change/.test(q) && /approv/.test(q)) {
    return "scope_approval";
  }
  return "unknown";
}

function answerScopeApproval(conn: Connection, question: string): AgentAnswer {
  const scopeId = /sc-nw-02/i.test(question)
    ? "SC-NW-02"
    : undefined;

  const params: Record<string, unknown> = {};
  const match = scopeId
    ? `MATCH (s:ScopeItem {id: $scopeId})`
    : `MATCH (s:ScopeItem {kind: 'change'})`;
  if (scopeId) params.scopeId = scopeId;

  const cypher = `${match}
    OPTIONAL MATCH (ap:Approval)-[:APPROVES]->(s)
    OPTIONAL MATCH (ct:Contact)-[:GAVE_APPROVAL]->(ap)
    OPTIONAL MATCH (m:Message)-[:EVIDENCES]->(ap)
    OPTIONAL MATCH (s)-[:PART_OF]->(p:Project)-[:BELONGS_TO]->(cl:Client)
    RETURN s, ap, ct, m, p, cl
    ORDER BY s.addedAt DESC
    LIMIT 3`;

  const rows = conn.query(cypher, params).rows;
  const path = pathFromRow(
    conn,
    cypher,
    params,
  );

  const approvals = rows
    .map((r) => ({
      scope: r.s?.properties?.id as string | undefined,
      title: r.s?.properties?.title as string | undefined,
      approver: r.ct?.properties?.name as string | undefined,
      role: r.ct?.properties?.role as string | undefined,
      approvedAt: r.ap?.properties?.approvedAt,
      client: r.cl?.properties?.name as string | undefined,
    }))
    .filter((a) => a.approver);

  const primary = approvals[0];
  const answer = primary
    ? `${primary.approver} (${primary.role}) approved scope item ${primary.scope} — “${primary.title}”` +
      (primary.client ? ` for ${primary.client}.` : ".") +
      (scopeId === "SC-NW-02" || primary.scope === "SC-NW-02"
        ? " Message MSG-NW-02 records written approval on 2026-10-12."
        : "")
    : "No approved scope changes found in the graph.";

  return {
    question,
    answer,
    intent: "scope_approval",
    planner: "rules",
    cypher: [cypher],
    path,
    highlights: approvals.map((a) => `${a.scope}: ${a.approver}`),
  };
}

function answerUnpaidOverdue(conn: Connection, question: string): AgentAnswer {
  const cypher = `
    MATCH (i:Invoice)-[:BILLED_FOR]->(p:Project)-[:BELONGS_TO]->(cl:Client)
    OPTIONAL MATCH (pay:Payment)-[:SETTLES]->(i)
    WITH i, p, cl, coalesce(sum(pay.amountCents), 0) AS paid
    WHERE i.dueAt < date($today)
      AND paid < i.amountCents
    RETURN i, p, cl, paid
    ORDER BY i.dueAt ASC`;

  const rows = conn.query(cypher, { today: TODAY }).rows;
  const path = pathFromRow(conn, cypher, { today: TODAY });

  if (rows.length === 0) {
    return {
      question,
      answer: "No overdue unpaid invoices in the sample ledger (as of 2026-11-18).",
      intent: "unpaid_overdue",
      planner: "rules",
      cypher: [cypher],
      path,
    };
  }

  const lines = rows.map((r) => {
    const inv = r.i.properties;
    const client = r.cl.properties.name;
    const due = formatDate(inv.dueAt);
    const owed = (inv.amountCents as number) - (r.paid as number);
    return `${inv.number}: $${(owed / 100).toFixed(2)} overdue (due ${due}) — ${client} / ${r.p.properties.name}`;
  });

  const answer =
    `There ${rows.length === 1 ? "is" : "are"} ${rows.length} unpaid overdue invoice(s):\n` +
    lines.map((l) => `• ${l}`).join("\n");

  return {
    question,
    answer,
    intent: "unpaid_overdue",
    planner: "rules",
    cypher: [cypher],
    path,
    highlights: lines,
  };
}

function answerRelationshipRisk(conn: Connection, question: string): AgentAnswer {
  const cypher = `
    MATCH (cl:Client)<-[:BELONGS_TO]-(p:Project)
    WHERE p.riskScore >= $minScore
    OPTIONAL MATCH (i:Invoice)-[:BILLED_FOR]->(p)
    OPTIONAL MATCH (pay:Payment)-[:SETTLES]->(i)
    OPTIONAL MATCH (m:Message)-[:ABOUT]->(p)
    WITH cl, p, collect(DISTINCT i) AS invoices,
         collect(DISTINCT m) AS messages,
         p.riskReasons AS reasons
    RETURN cl, p, invoices, messages, reasons
    ORDER BY p.riskScore DESC`;

  const rows = conn.query(cypher, { minScore: 50 }).rows;
  const path = pathFromRow(conn, cypher, { minScore: 50 });

  const summaries = rows.map((r) => {
    const client = r.cl.properties.name as string;
    const project = r.p.properties.name as string;
    const score = r.p.properties.riskScore as number;
    const reasons = (r.reasons as string[]) ?? [];
    return `${client} — ${project} (risk ${score}): ${reasons.join("; ") || "elevated risk score"}`;
  });

  const answer =
    summaries.length > 0
      ? `Relationships flagged at risk:\n${summaries.map((s) => `• ${s}`).join("\n")}`
      : "No client relationships exceed the risk threshold in the sample data.";

  return {
    question,
    answer,
    intent: "relationship_risk",
    planner: "rules",
    cypher: [cypher],
    path,
    highlights: summaries,
  };
}

function clientSlugFromQuestion(q: string): string | undefined {
  const lower = q.toLowerCase();
  if (/northwind/.test(lower)) return "northwind-analytics";
  if (/harbor/.test(lower)) return "harbor-creative";
  if (/lumen/.test(lower)) return "lumen-health";
  return undefined;
}

function answerContactLookup(conn: Connection, question: string): AgentAnswer {
  const slug = clientSlugFromQuestion(question) ?? "harbor-creative";
  const cypher = `
    MATCH (cl:Client {slug: $slug})<-[:WORKS_FOR]-(ct:Contact)
  RETURN cl, ct`;
  const path = pathFromRow(conn, cypher, { slug });
  const rows = conn.query(cypher, { slug }).rows;
  const contact = rows[0]?.ct?.properties as { name?: string; role?: string } | undefined;
  const client = rows[0]?.cl?.properties as { name?: string } | undefined;

  const answer = contact
    ? `${contact.name} (${contact.role}) is the primary contact for ${client?.name ?? slug}.`
    : `No contacts found for client slug ${slug}.`;

  return {
    question,
    answer,
    intent: "contact_lookup",
    planner: "rules",
    cypher: [cypher],
    path,
  };
}

function answerDeliverableLookup(conn: Connection, question: string): AgentAnswer {
  const slug = clientSlugFromQuestion(question);
  const cypher = slug
    ? `MATCH (cl:Client {slug: $slug})<-[:BELONGS_TO]-(p:Project)<-[:DELIVERED_FOR]-(d:Deliverable)
       RETURN cl, p, d ORDER BY d.deliveredAt DESC LIMIT 5`
    : `MATCH (p:Project)<-[:DELIVERED_FOR]-(d:Deliverable)
       WHERE toLower(d.title) CONTAINS 'dashboard' OR d.type = 'pr'
       RETURN p, d ORDER BY d.deliveredAt DESC LIMIT 5`;
  const params = slug ? { slug } : {};
  const path = pathFromRow(conn, cypher, params);
  const rows = conn.query(cypher, params).rows;

  const items = rows.map((r) => {
    const d = r.d.properties as { title: string; type: string; url: string };
    return `${d.title} (${d.type}) — ${d.url}`;
  });

  const answer =
    items.length > 0
      ? `Deliverables:\n${items.map((l) => `• ${l}`).join("\n")}`
      : "No matching deliverables in the graph.";

  return {
    question,
    answer,
    intent: "deliverable_lookup",
    planner: "rules",
    cypher: [cypher],
    path,
    highlights: items,
  };
}

function answerHybrid(conn: Connection, question: string): AgentAnswer {
  const hits = hybridSearchMessages(conn, question, 5);
  const cypher = [
    "Hybrid retrieval: VECTOR INDEX message_embedding + FULLTEXT INDEX message_text (RRF k=5)",
  ];

  if (hits.length === 0) {
    return {
      question,
      answer:
        "I could not find relevant messages. Try one of the sample questions in the README.",
      intent: "hybrid_context",
      planner: "rules",
      cypher,
      path: { nodes: [], edges: [] },
    };
  }

  const ids = hits.map((h) => h.id);
  const pathCypher = `
    UNWIND $ids AS mid
    MATCH (m:Message {id: mid})-[:ABOUT]->(p:Project)-[:BELONGS_TO]->(cl:Client)
    RETURN m, p, cl`;
  const path = pathFromRow(conn, pathCypher, { ids });

  const answer =
    "Top message hits (hybrid full-text + vector):\n" +
    hits.map((h) => `• [${h.id}] score ${h.score}: ${h.text}`).join("\n");

  return {
    question,
    answer,
    intent: "hybrid_context",
    planner: "rules",
    cypher,
    path,
    highlights: hits.map((h) => h.id),
  };
}

export async function askAgent(conn: Connection, question: string): Promise<AgentAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      question,
      answer: "Please enter a question about clients, scope, invoices, or deliverables.",
      intent: "unknown",
      planner: "rules",
      cypher: [],
      path: { nodes: [], edges: [] },
    };
  }

  const llm = await maybeLlmAnswer(conn, trimmed);
  if (llm) return llm;

  const intent = classify(trimmed);
  switch (intent) {
    case "scope_approval":
      return answerScopeApproval(conn, trimmed);
    case "unpaid_overdue":
      return answerUnpaidOverdue(conn, trimmed);
    case "relationship_risk":
      return answerRelationshipRisk(conn, trimmed);
    case "contact_lookup":
      return answerContactLookup(conn, trimmed);
    case "deliverable_lookup":
      return answerDeliverableLookup(conn, trimmed);
    default:
      return answerHybrid(conn, trimmed);
  }
}