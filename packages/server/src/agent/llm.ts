import type { Connection } from "../relate-db.js";
import { pathFromRow } from "../graph-path.js";
import type { AgentAnswer } from "./types.js";

/**
 * Optional OpenAI planner — disabled unless OPENAI_API_KEY is set.
 * Falls back silently (returns null) on any error so the rule planner runs.
 */
export async function maybeLlmAnswer(
  conn: Connection,
  question: string,
): Promise<AgentAnswer | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const system = `You are ClientGraph. Answer using only read-only Cypher over a freelancer client graph.
Node labels: Client, Contact, Project, ScopeItem, Approval, Invoice, Payment, Message, Deliverable.
Respond JSON: {"cypher":"...","summary":"..."} — one MATCH query, LIMIT 25, no writes.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Question: ${question}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { cypher?: string; summary?: string };
    const cypher = parsed.cypher?.trim();
    if (!cypher || /\b(create|merge|set|delete|remove)\b/i.test(cypher)) return null;

    conn.query(`EXPLAIN ${cypher}`);
    const path = pathFromRow(conn, cypher, {});

    return {
      question,
      answer: parsed.summary ?? "LLM-generated summary (verify against graph evidence).",
      intent: "llm",
      planner: "llm",
      cypher: [cypher],
      path,
    };
  } catch {
    return null;
  }
}