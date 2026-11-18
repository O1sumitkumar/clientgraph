import { useCallback, useState } from "react";
import { GraphView, type EvidencePath } from "./GraphView";

type AgentAnswer = {
  answer: string;
  intent: string;
  planner: string;
  cypher: string[];
  path: EvidencePath;
};

const SAMPLE_QUESTIONS = [
  "Who approved the scope change for the cohort comparison module?",
  "What is unpaid and overdue?",
  "Which client relationships are at risk and why?",
];

const emptyPath: EvidencePath = { nodes: [], edges: [] };

export function App() {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setResult(data as AgentAnswer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [question]);

  return (
    <>
      <header>
        <h1>ClientGraph</h1>
        <p>
          Freelancer client memory on Neo4j Relate — hybrid retrieval plus graph paths that justify
          each answer.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Ask</h2>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-label="Question"
          />
          <div className="actions">
            <button type="button" className="primary" onClick={ask} disabled={loading}>
              {loading ? "Thinking…" : "Ask ClientGraph"}
            </button>
          </div>
          <div className="actions chips">
            {SAMPLE_QUESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => setQuestion(q)} disabled={loading}>
                {q.length > 48 ? `${q.slice(0, 48)}…` : q}
              </button>
            ))}
          </div>

          <h2 style={{ marginTop: "1.25rem" }}>Answer</h2>
          {error && <p className="error">{error}</p>}
          {result && (
            <>
              <p className="answer">{result.answer}</p>
              <p className="meta">
                Intent: {result.intent} · Planner: {result.planner}
              </p>
              {result.cypher.length > 0 && (
                <pre className="meta" style={{ overflow: "auto" }}>
                  {result.cypher.join("\n\n")}
                </pre>
              )}
            </>
          )}
        </section>

        <section className="panel">
          <h2>Evidence path</h2>
          <GraphView path={result?.path ?? emptyPath} />
        </section>
      </div>
    </>
  );
}