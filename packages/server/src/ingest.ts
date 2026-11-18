import { SAMPLE_CLIENTS, textEmbedding, type SampleScopeItem } from "./sample-data.js";
import { openStore, vectorLiteral, type Connection } from "./relate-db.js";

const SCHEMA_STATEMENTS = [
  `CREATE CONSTRAINT client_id IF NOT EXISTS FOR (c:Client) REQUIRE c.id IS UNIQUE`,
  `CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE`,
  `CREATE CONSTRAINT contact_id IF NOT EXISTS FOR (c:Contact) REQUIRE c.id IS UNIQUE`,
  `CREATE CONSTRAINT scope_id IF NOT EXISTS FOR (s:ScopeItem) REQUIRE s.id IS UNIQUE`,
  `CREATE CONSTRAINT invoice_id IF NOT EXISTS FOR (i:Invoice) REQUIRE i.id IS UNIQUE`,
  `CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE`,
  `CREATE FULLTEXT INDEX message_text IF NOT EXISTS FOR (m:Message) ON EACH [m.text]`,
  `CREATE FULLTEXT INDEX scope_text IF NOT EXISTS FOR (s:ScopeItem) ON EACH [s.searchText]`,
  `CREATE VECTOR INDEX message_embedding IF NOT EXISTS FOR (m:Message) ON (m.embedding)
   OPTIONS {indexConfig: { \`vector.dimensions\`: 8, \`vector.similarity_function\`: 'cosine'}}`,
  `CREATE VECTOR INDEX scope_embedding IF NOT EXISTS FOR (s:ScopeItem) ON (s.embedding)
   OPTIONS {indexConfig: { \`vector.dimensions\`: 8, \`vector.similarity_function\`: 'cosine'}}`,
];

export function clearGraph(conn: Connection): void {
  conn.query("MATCH (n) DETACH DELETE n");
}

export function ingestSample(conn: Connection): { nodes: number; relationships: number } {
  for (const stmt of SCHEMA_STATEMENTS) {
    conn.query(stmt);
  }

  for (const client of SAMPLE_CLIENTS) {
    conn.query(
      `CREATE (c:Client {
        id: $id, slug: $slug, name: $name, industry: $industry, tier: $tier
      })`,
      {
        id: `client:${client.slug}`,
        slug: client.slug,
        name: client.name,
        industry: client.industry,
        tier: client.tier,
      },
    );

    for (const contact of client.contacts) {
      conn.query(
        `MATCH (cl:Client {slug: $clientSlug})
         CREATE (ct:Contact {
           id: $id, name: $name, email: $email, role: $role
         })-[:WORKS_FOR]->(cl)`,
        {
          clientSlug: client.slug,
          id: contact.id,
          name: contact.name,
          email: contact.email,
          role: contact.role,
        },
      );
    }

    for (const project of client.projects) {
      conn.query(
        `MATCH (cl:Client {slug: $clientSlug})
         CREATE (p:Project {
           id: $id,
           slug: $slug,
           name: $name,
           status: $status,
           startedAt: date($startedAt),
           riskScore: $riskScore,
           riskReasons: $riskReasons
         })-[:BELONGS_TO]->(cl)`,
        {
          clientSlug: client.slug,
          id: `project:${project.slug}`,
          slug: project.slug,
          name: project.name,
          status: project.status,
          startedAt: project.startedAt,
          riskScore: project.riskScore,
          riskReasons: project.riskReasons,
        },
      );

      for (const scope of project.scope) {
        const searchText = `${scope.title} ${scope.description}`;
        const embedding = textEmbedding(searchText);
        conn.query(
          `MATCH (p:Project {slug: $projectSlug})
           CREATE (s:ScopeItem {
             id: $id,
             title: $title,
             description: $description,
             kind: $kind,
             status: $status,
             addedAt: date($addedAt),
             searchText: $searchText,
             embedding: ${vectorLiteral(embedding)}
           })-[:PART_OF]->(p)`,
          {
            projectSlug: project.slug,
            id: scope.id,
            title: scope.title,
            description: scope.description,
            kind: scope.kind,
            status: scope.status,
            addedAt: scope.addedAt,
            searchText,
          },
        );
      }

      for (const msg of project.messages) {
        conn.query(
          `MATCH (p:Project {slug: $projectSlug})
           CREATE (m:Message {
             id: $id,
             text: $text,
             sentAt: date($sentAt),
             channel: $channel,
             embedding: ${vectorLiteral(msg.embedding)}
           })-[:ABOUT]->(p)`,
          {
            projectSlug: project.slug,
            id: msg.id,
            text: msg.text,
            sentAt: msg.sentAt,
            channel: msg.channel,
          },
        );
      }

      for (const inv of project.invoices) {
        conn.query(
          `MATCH (p:Project {slug: $projectSlug})
           CREATE (i:Invoice {
             id: $id,
             number: $number,
             amountCents: $amountCents,
             issuedAt: date($issuedAt),
             dueAt: date($dueAt),
             status: $status
           })-[:BILLED_FOR]->(p)`,
          {
            projectSlug: project.slug,
            ...inv,
          },
        );
      }

      for (const pay of project.payments) {
        conn.query(
          `MATCH (i:Invoice {id: $invoiceId})
           CREATE (pay:Payment {
             id: $id,
             amountCents: $amountCents,
             paidAt: date($paidAt)
           })-[:SETTLES]->(i)`,
          pay,
        );
      }

      for (const del of project.deliverables) {
        conn.query(
          `MATCH (p:Project {slug: $projectSlug})
           CREATE (d:Deliverable {
             id: $id,
             title: $title,
             type: $type,
             url: $url,
             deliveredAt: date($deliveredAt)
           })-[:DELIVERED_FOR]->(p)`,
          {
            projectSlug: project.slug,
            ...del,
          },
        );
      }
    }
  }

  // Approvals linked to scope changes
  wireApprovals(conn);

  const row = conn
    .query(
      `MATCH (n) OPTIONAL MATCH (n)-[r]->()
       RETURN count(DISTINCT n) AS nodes, count(r) AS rels`,
    )
    .single();

  return { nodes: Number(row.nodes), relationships: Number(row.rels) };
}

function wireApprovals(conn: Connection): void {
  const approvals: {
    scopeId: string;
    contactId: string;
    approvedAt: string;
    messageId?: string;
  }[] = [
    {
      scopeId: "SC-NW-02",
      contactId: "nw-maya",
      approvedAt: "2026-10-12",
      messageId: "MSG-NW-02",
    },
    {
      scopeId: "SC-NW-01",
      contactId: "nw-eli",
      approvedAt: "2026-09-06",
    },
    {
      scopeId: "SC-HC-01",
      contactId: "hc-jordan",
      approvedAt: "2026-08-20",
    },
    {
      scopeId: "SC-LH-01",
      contactId: "lh-sam",
      approvedAt: "2026-07-06",
    },
  ];

  for (const a of approvals) {
    conn.query(
      `MATCH (s:ScopeItem {id: $scopeId}), (ct:Contact {id: $contactId})
       CREATE (ap:Approval {id: $approvalId, approvedAt: date($approvedAt)})
       MERGE (ap)-[:APPROVES]->(s)
       MERGE (ct)-[:GAVE_APPROVAL]->(ap)`,
      {
        scopeId: a.scopeId,
        contactId: a.contactId,
        approvalId: `APR-${a.scopeId}`,
        approvedAt: a.approvedAt,
      },
    );
    if (a.messageId) {
      conn.query(
        `MATCH (ap:Approval {id: $approvalId}), (m:Message {id: $messageId})
         MERGE (m)-[:EVIDENCES]->(ap)`,
        { approvalId: `APR-${a.scopeId}`, messageId: a.messageId },
      );
    }
  }
}

export function seedStore(fresh = true): { nodes: number; relationships: number } {
  const conn = openStore({ fresh });
  try {
    conn.begin();
    if (fresh) {
      clearGraph(conn);
    } else {
      const existing = conn.query("MATCH (c:Client) RETURN count(c) AS n").single().n;
      if (Number(existing) > 0) {
        conn.rollback();
        return { nodes: 0, relationships: 0 };
      }
      clearGraph(conn);
    }
    const stats = ingestSample(conn);
    conn.commit();
    return stats;
  } catch (e) {
    conn.rollback();
    throw e;
  }
}