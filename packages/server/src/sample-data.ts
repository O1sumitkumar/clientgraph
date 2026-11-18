/**
 * Fictional freelancer/agency sample dataset (deterministic).
 * All clients, contacts, and amounts are invented for demos.
 */

export type SampleMessage = {
  id: string;
  text: string;
  /** 8-dim FLOAT32 embedding — deterministic pseudo-embeddings for hybrid search */
  embedding: number[];
  sentAt: string;
  channel: string;
};

export type SampleScopeItem = {
  id: string;
  title: string;
  description: string;
  kind: "original" | "change";
  status: "proposed" | "approved" | "rejected";
  addedAt: string;
};

export type SampleProject = {
  slug: string;
  name: string;
  status: "active" | "on_hold" | "closed";
  startedAt: string;
  riskScore: number;
  riskReasons: string[];
  scope: SampleScopeItem[];
  messages: SampleMessage[];
  invoices: {
    id: string;
    number: string;
    amountCents: number;
    issuedAt: string;
    dueAt: string;
    status: "paid" | "partial" | "open";
  }[];
  payments: {
    id: string;
    invoiceId: string;
    amountCents: number;
    paidAt: string;
  }[];
  deliverables: {
    id: string;
    title: string;
    type: "pr" | "design" | "report";
    url: string;
    deliveredAt: string;
  }[];
};

export type SampleClient = {
  slug: string;
  name: string;
  industry: string;
  tier: "retainer" | "project";
  contacts: { id: string; name: string; email: string; role: string }[];
  projects: SampleProject[];
};

/** Simple deterministic embedding from text (no external model). */
export function textEmbedding(text: string, dims = 8): number[] {
  const out = new Array<number>(dims).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    for (let j = 0; j < t.length; j++) {
      const bucket = (t.charCodeAt(j) + i * 17 + j * 3) % dims;
      out[bucket] += 1 / (1 + j);
    }
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => Number((v / norm).toFixed(6)));
}

export const SAMPLE_CLIENTS: SampleClient[] = [
  {
    slug: "northwind-analytics",
    name: "Northwind Analytics (fictional)",
    industry: "B2B SaaS",
    tier: "retainer",
    contacts: [
      {
        id: "nw-maya",
        name: "Maya Chen",
        email: "maya@northwind-analytics.example",
        role: "VP Product",
      },
      {
        id: "nw-eli",
        name: "Eli Brooks",
        email: "eli@northwind-analytics.example",
        role: "Engineering Lead",
      },
    ],
    projects: [
      {
        slug: "nw-dashboard-refresh",
        name: "Customer Dashboard Refresh",
        status: "active",
        startedAt: "2026-09-01",
        riskScore: 72,
        riskReasons: [
          "Invoice INV-NW-104 overdue 19 days",
          "Scope change SC-NW-02 awaiting payment before start",
        ],
        scope: [
          {
            id: "SC-NW-01",
            title: "Baseline dashboard IA",
            description: "Navigation, KPI cards, and filter panel for enterprise tenants.",
            kind: "original",
            status: "approved",
            addedAt: "2026-09-05",
          },
          {
            id: "SC-NW-02",
            title: "Add cohort comparison module",
            description:
              "Client requested side-by-side cohort charts after kickoff; adds ~24h design + 40h eng.",
            kind: "change",
            status: "approved",
            addedAt: "2026-10-12",
          },
        ],
        messages: [
          {
            id: "MSG-NW-01",
            text: "Can we add cohort comparison before the November launch? Happy to sign a change order.",
            sentAt: "2026-10-10",
            channel: "email",
            embedding: [],
          },
          {
            id: "MSG-NW-02",
            text: "Approved SC-NW-02 in writing — please proceed once invoice is acknowledged.",
            sentAt: "2026-10-12",
            channel: "slack",
            embedding: [],
          },
        ],
        invoices: [
          {
            id: "INV-NW-104",
            number: "INV-NW-104",
            amountCents: 185_000,
            issuedAt: "2026-10-01",
            dueAt: "2026-10-15",
            status: "open",
          },
        ],
        payments: [],
        deliverables: [
          {
            id: "DEL-NW-PR-12",
            title: "feat: dashboard shell and routing",
            type: "pr",
            url: "https://github.example/northwind/dashboard/pull/12",
            deliveredAt: "2026-09-28",
          },
        ],
      },
    ],
  },
  {
    slug: "harbor-creative",
    name: "Harbor Creative Studio (fictional)",
    industry: "Agency",
    tier: "project",
    contacts: [
      {
        id: "hc-jordan",
        name: "Jordan Vale",
        email: "jordan@harborcreative.example",
        role: "Account Director",
      },
    ],
    projects: [
      {
        slug: "hc-brand-system",
        name: "Brand System Rollout",
        status: "active",
        startedAt: "2026-08-15",
        riskScore: 88,
        riskReasons: [
          "No payment on INV-HC-077 (47 days overdue)",
          "Last client message unanswered 11 days",
        ],
        scope: [
          {
            id: "SC-HC-01",
            title: "Logo lockups + color tokens",
            description: "Deliver Figma library and exportable SVG set.",
            kind: "original",
            status: "approved",
            addedAt: "2026-08-18",
          },
        ],
        messages: [
          {
            id: "MSG-HC-01",
            text: "Finance is reviewing — can you resend the statement of work PDF?",
            sentAt: "2026-11-05",
            channel: "email",
            embedding: [],
          },
        ],
        invoices: [
          {
            id: "INV-HC-077",
            number: "INV-HC-077",
            amountCents: 96_000,
            issuedAt: "2026-09-20",
            dueAt: "2026-10-05",
            status: "open",
          },
        ],
        payments: [],
        deliverables: [
          {
            id: "DEL-HC-DES-3",
            title: "Harbor color + typography tokens",
            type: "design",
            url: "https://figma.example/harbor/tokens",
            deliveredAt: "2026-09-30",
          },
        ],
      },
    ],
  },
  {
    slug: "lumen-health",
    name: "Lumen Health Ops (fictional)",
    industry: "Healthcare IT",
    tier: "retainer",
    contacts: [
      {
        id: "lh-sam",
        name: "Sam Okonkwo",
        email: "sam@lumenhealth.example",
        role: "Operations Manager",
      },
    ],
    projects: [
      {
        slug: "lh-oncall-runbook",
        name: "On-call Runbook Automation",
        status: "active",
        startedAt: "2026-07-01",
        riskScore: 25,
        riskReasons: [],
        scope: [
          {
            id: "SC-LH-01",
            title: "PagerDuty + Slack runbook sync",
            description: "Bidirectional sync for escalation policies.",
            kind: "original",
            status: "approved",
            addedAt: "2026-07-05",
          },
        ],
        messages: [
          {
            id: "MSG-LH-01",
            text: "Looks great — approved for prod rollout next week.",
            sentAt: "2026-10-20",
            channel: "slack",
            embedding: [],
          },
        ],
        invoices: [
          {
            id: "INV-LH-210",
            number: "INV-LH-210",
            amountCents: 120_000,
            issuedAt: "2026-10-01",
            dueAt: "2026-10-31",
            status: "paid",
          },
        ],
        payments: [
          {
            id: "PAY-LH-01",
            invoiceId: "INV-LH-210",
            amountCents: 120_000,
            paidAt: "2026-10-18",
          },
        ],
        deliverables: [
          {
            id: "DEL-LH-PR-4",
            title: "chore: runbook drift detector",
            type: "pr",
            url: "https://github.example/lumen/runbooks/pull/4",
            deliveredAt: "2026-10-15",
          },
        ],
      },
    ],
  },
];

export function hydrateEmbeddings(): void {
  for (const client of SAMPLE_CLIENTS) {
    for (const project of client.projects) {
      for (const msg of project.messages) {
        msg.embedding = textEmbedding(msg.text);
      }
    }
  }
}

hydrateEmbeddings();