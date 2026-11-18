import { textEmbedding } from "./sample-data.js";
import { type Connection } from "./relate-db.js";

export type HybridHit = {
  id: string;
  label: string;
  text: string;
  score: number;
  source: "fulltext" | "vector" | "hybrid";
};

/** Message-only hybrid for simpler cases. */
export function hybridSearchMessages(conn: Connection, query: string, k = 5): HybridHit[] {
  const v = textEmbedding(query);
  const q = query.trim();
  if (!q) return [];

  const rows = conn.query(
    `CALL () {
      MATCH (n:Message)
      SEARCH n IN (VECTOR INDEX message_embedding FOR $v LIMIT $k) SCORE AS vscore
      WITH n ORDER BY vscore DESC, n.id
      WITH collect(n) AS ns
      UNWIND range(0, size(ns) - 1) AS i
      RETURN ns[i] AS n, i + 1 AS rank, 'vector' AS list
      UNION ALL
      MATCH (n:Message)
      SEARCH n IN (FULLTEXT INDEX message_text FOR $q LIMIT $k) SCORE AS score
      WITH n ORDER BY score DESC, n.id
      WITH collect(n) AS ns
      UNWIND range(0, size(ns) - 1) AS i
      RETURN ns[i] AS n, i + 1 AS rank, 'fulltext' AS list
    }
    WITH n, sum(1.0 / (60 + rank)) AS rrf
    ORDER BY rrf DESC, n.id
    LIMIT $k
    RETURN n.id AS id, n.text AS text, round(rrf, 4) AS score`,
    { v, q, k },
  ).rows;

  return rows.map((r) => ({
    id: String(r.id),
    label: "Message",
    text: String(r.text),
    score: Number(r.score),
    source: "hybrid" as const,
  }));
}