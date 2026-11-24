import type { Connection, Params } from "./relate-db.js";

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

type RawNode = {
  kind: "node";
  elementId: string;
  labels: string[];
  properties: Record<string, unknown>;
};

type RawRel = {
  kind: "relationship";
  elementId: string;
  type: string;
  properties: Record<string, unknown>;
  startElementId?: string;
  endElementId?: string;
  startNodeElementId?: string;
  endNodeElementId?: string;
};

function collectValue(
  value: unknown,
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge>,
): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) collectValue(v, nodes, edges);
    return;
  }
  const kind = (value as { kind?: string }).kind;
  if (kind === "node") {
    const n = value as RawNode;
    const id = nodeId(n);
    nodes.set(id, { id, labels: n.labels ?? [], properties: { ...n.properties } });
  } else if (kind === "relationship") {
    const r = value as RawRel;
    const id = relId(r);
    edges.set(id, {
      id,
      type: r.type,
      from: String(r.startElementId ?? r.startNodeElementId),
      to: String(r.endElementId ?? r.endNodeElementId),
      properties: { ...r.properties },
    });
  }
}

/**
 * Serialize Relate node/relationship values from result rows (including lists of nodes)
 * into an evidence path, then pull every relationship that connects the returned nodes
 * so the UI can draw the actual graph path behind the answer.
 */
export function pathFromRow(
  conn: Connection,
  cypher: string,
  params: Params,
): EvidencePath {
  const result = conn.query(cypher, params);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const row of result.rows) {
    for (const value of Object.values(row)) collectValue(value, nodes, edges);
  }

  const ids = [...nodes.keys()];
  if (ids.length > 1) {
    const rels = conn.query(
      `MATCH (a)-[r]->(b)
       WHERE elementId(a) IN $ids AND elementId(b) IN $ids
       RETURN r`,
      { ids },
    ).rows;
    for (const row of rels) collectValue(row.r, nodes, edges);
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