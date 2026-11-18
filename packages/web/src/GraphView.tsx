type GraphNode = {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  type: string;
  from: string;
  to: string;
};

export type EvidencePath = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function labelOf(node: GraphNode): string {
  const primary = node.labels[0] ?? "Node";
  const name =
    (node.properties.name as string) ??
    (node.properties.title as string) ??
    (node.properties.id as string) ??
    node.id.slice(0, 12);
  return `${primary}: ${name}`;
}

export function GraphView({ path }: { path: EvidencePath }) {
  if (!path.nodes.length) {
    return <p className="meta">No graph nodes in this evidence path yet.</p>;
  }

  const positions = new Map<string, { x: number; y: number }>();
  const cols = Math.ceil(Math.sqrt(path.nodes.length));
  path.nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(n.id, { x: 70 + col * 140, y: 60 + row * 90 });
  });

  return (
    <div>
      <svg className="graph-svg" viewBox="0 0 700 380" role="img" aria-label="Evidence graph">
        {path.edges.map((e) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          return (
            <g key={e.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#475569" strokeWidth={1.5} />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 6}
                fill="#94a3b8"
                fontSize={10}
                textAnchor="middle"
              >
                {e.type}
              </text>
            </g>
          );
        })}
        {path.nodes.map((n) => {
          const p = positions.get(n.id)!;
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={22} fill="#134e4a" stroke="#5eead4" strokeWidth={2} />
              <text x={p.x} y={p.y + 38} fill="#cbd5e1" fontSize={10} textAnchor="middle">
                {labelOf(n).slice(0, 22)}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ marginTop: "0.75rem" }}>
        {path.nodes.map((n) => (
          <div key={n.id} className="node-card">
            <strong>{labelOf(n)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}