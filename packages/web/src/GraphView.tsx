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

/** Left-to-right layers so evidence flows from messages/people into projects and clients. */
const LAYER: Record<string, number> = {
  Message: 0,
  Contact: 0,
  Approval: 1,
  Invoice: 1,
  Payment: 0,
  Deliverable: 1,
  ScopeItem: 2,
  Project: 3,
  Client: 4,
};

const COLOR: Record<string, string> = {
  Client: "#f59e0b",
  Project: "#5eead4",
  Contact: "#a78bfa",
  ScopeItem: "#60a5fa",
  Approval: "#34d399",
  Message: "#f472b6",
  Invoice: "#f87171",
  Payment: "#a3e635",
  Deliverable: "#38bdf8",
};

const W = 560;
const H = 400;

function primaryLabel(node: GraphNode): string {
  return node.labels[0] ?? "Node";
}

function nameOf(node: GraphNode): string {
  const p = node.properties;
  return String(p.name ?? p.title ?? p.number ?? p.id ?? node.id.slice(0, 12)).replace(
    " (fictional)",
    "",
  );
}

function short(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function GraphView({ path }: { path: EvidencePath }) {
  if (!path.nodes.length) {
    return <p className="meta">Ask a question to see the Relate graph path behind the answer.</p>;
  }

  const layers = new Map<number, GraphNode[]>();
  for (const n of path.nodes) {
    const layer = LAYER[primaryLabel(n)] ?? 1;
    layers.set(layer, [...(layers.get(layer) ?? []), n]);
  }
  const usedLayers = [...layers.keys()].sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number; li: number }>();
  usedLayers.forEach((layer, li) => {
    const col = layers.get(layer)!;
    const x = usedLayers.length === 1 ? W / 2 : 60 + (li * (W - 120)) / (usedLayers.length - 1);
    col.forEach((n, i) => {
      // Stagger alternate layers so straight edges do not run through nodes.
      const stagger = li % 2 === 1 ? 26 : 0;
      const y = ((i + 1) * H) / (col.length + 1) + stagger;
      positions.set(n.id, { x, y, li });
    });
  });

  const presentLabels = [...new Set(path.nodes.map(primaryLabel))];

  return (
    <div>
      <svg className="graph-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evidence graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>
        {path.edges.map((e) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          // Edges that skip a layer bow away from the centre so they do not run through nodes.
          const span = Math.abs(a.li - b.li);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const bow = span > 1 ? (my < H / 2 ? -1 : 1) * 45 * (span - 1) : 0;
          const cx = mx;
          const cy = my + bow;
          const r = 22;
          const d1x = cx - a.x;
          const d1y = cy - a.y;
          const l1 = Math.hypot(d1x, d1y) || 1;
          const d2x = b.x - cx;
          const d2y = b.y - cy;
          const l2 = Math.hypot(d2x, d2y) || 1;
          const x1 = a.x + (d1x / l1) * r;
          const y1 = a.y + (d1y / l1) * r;
          const x2 = b.x - (d2x / l2) * (r + 2);
          const y2 = b.y - (d2y / l2) * (r + 2);
          const lx = (x1 + 2 * cx + x2) / 4;
          const ly = (y1 + 2 * cy + y2) / 4;
          return (
            <g key={e.id}>
              <path
                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.6}
                markerEnd="url(#arrow)"
              />
              <text
                x={lx}
                y={ly - 5}
                fill="#cbd5e1"
                fontSize={12}
                fontWeight={600}
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#0c1118"
                strokeWidth={3}
              >
                {e.type}
              </text>
            </g>
          );
        })}
        {path.nodes.map((n) => {
          const p = positions.get(n.id)!;
          const color = COLOR[primaryLabel(n)] ?? "#94a3b8";
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={20} fill="#0f172a" stroke={color} strokeWidth={3} />
              <text x={p.x} y={p.y + 4} fill={color} fontSize={11} fontWeight={700} textAnchor="middle">
                {primaryLabel(n).slice(0, 3).toUpperCase()}
              </text>
              <text
                x={p.x}
                y={p.y + 36}
                fill="#e2e8f0"
                fontSize={12}
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#0c1118"
                strokeWidth={3}
              >
                {short(nameOf(n), 20)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="meta graph-stats">
        {path.nodes.length} nodes · {path.edges.length} relationships returned from Relate
      </p>
      <div className="legend">
        {presentLabels.map((l) => (
          <span key={l} className="legend-item">
            <span className="dot" style={{ background: COLOR[l] ?? "#94a3b8" }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
