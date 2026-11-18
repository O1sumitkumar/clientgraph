import type { Connection } from "./relate-db.js";

export type GraphNode = {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  type: string;
  from: string;
  to: string;
  properties: Record<string, unknown>;
};

export type EvidencePath = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function nodeId(node: { elementId?: string; properties?: { id?: string } }): string {
  const eid = (node as { elementId: string }).elementId;
  return eid ?? String(node.properties?.id ?? "unknown");
}

function relId(rel: { elementId?: string; type?: string }): string {
  return (rel as { elementId: string }).elementId ?? `rel:${rel.type}`;
}

/** Serialize relate node/relationship values from a result row into an evidence path. */
export function pathFromRow(
  conn: Connection,
  cypher: string,
  params: Record<string, unknown>,
): EvidencePath {
  const result = conn.query(cypher, params);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const row of result.rows) {
    for (const value of Object.values(row)) {
      if (!value || typeof value !== "object") continue;
      const kind = (value as { kind?: string }).kind;
      if (kind === "node") {
        const n = value as {
          elementId: string;
          labels: string[];
          properties: Record<string, unknown>;
        };
        const id = nodeId(n);
        nodes.set(id, {
          id,
          labels: n.labels ?? [],
          properties: { ...n.properties },
        });
      } else if (kind === "relationship") {
        const r = value as {
          elementId: string;
          type: string;
          properties: Record<string, unknown>;
          startNodeElementId: string;
          endNodeElementId: string;
        };
        const id = relId(r);
        edges.set(id, {
          id,
          type: r.type,
          from: r.startNodeElementId,
          to: r.endNodeElementId,
          properties: { ...r.properties },
        });
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}

export function mergePaths(...paths: EvidencePath[]): EvidencePath {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  for (const p of paths) {
    for (const n of p.nodes) nodes.set(n.id, n);
    for (const e of p.edges) edges.set(e.id, e);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}