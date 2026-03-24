import type {
  Graph, Layer, Node, Edge, Transcript,
  CommitEntry, ExtractionProposal, DictionaryEntry
} from "../types";

// ═══ IDs ═══
const GRAPH_ID = "g-pipeline-ops";
const USER_ID = "u-demo-user";
const USER2_ID = "u-james";

// Layer IDs
const L_PEOPLE = "l-people";
const L_PROCESS = "l-process";
const L_TOOLS = "l-tools";
const L_CONSTRAINTS = "l-constraints";

// Node IDs
const N_SARAH = "n-sarah";
const N_JAMES = "n-james";
const N_MARIA = "n-maria";
const N_PIPELINE = "n-pipeline-ingestion";
const N_TRANSFORM = "n-data-transform";
const N_ALERTING = "n-alerting";
const N_MONITORING = "n-monitoring";
const N_AIRFLOW = "n-airflow";
const N_DELTA = "n-delta-tables";
const N_DATABRICKS = "n-databricks";
const N_KAFKA = "n-kafka";
const N_GRAFANA = "n-grafana";
const N_PAGERDUTY = "n-pagerduty";
const N_DBT = "n-dbt";
const N_GREAT_EX = "n-great-expectations";
const N_RETRY = "n-retry-policy";
const N_SLA = "n-sla-agreement";
const N_ONCALL = "n-oncall-runbook";

// Transcript / Segment IDs
const T_SESSION1 = "t-session-1";
const T_SESSION2 = "t-session-2";

// ═══ Layers ═══
export const mockLayers: Layer[] = [
  { id: L_PEOPLE, graphId: GRAPH_ID, name: "People & Roles", order: 0, colorOverride: null },
  { id: L_PROCESS, graphId: GRAPH_ID, name: "Processes & Workflows", order: 1, colorOverride: null },
  { id: L_TOOLS, graphId: GRAPH_ID, name: "Tools & Systems", order: 2, colorOverride: null },
  { id: L_CONSTRAINTS, graphId: GRAPH_ID, name: "Constraints & Policies", order: 3, colorOverride: null },
];

// ═══ Nodes ═══
const now = "2026-03-24T12:00:00Z";
const weekAgo = "2026-03-17T12:00:00Z";

function makeNode(
  id: string, name: string, layerId: string,
  props: Record<string, any> = {},
  opts: Partial<Node> = {}
): Node {
  return {
    id, graphId: GRAPH_ID, name, aliases: [],
    layerId, properties: props, readme: null,
    childGraphId: null, sourceSegmentId: null,
    status: "confirmed", createdBy: USER_ID,
    createdAt: weekAgo, updatedAt: now,
    ...opts,
  };
}

export const mockNodes: Node[] = [
  // People
  makeNode(N_SARAH, "Sarah", L_PEOPLE,
    { role: "Pipeline Manager", team: "Data Platform" },
    { readme: "Manages the overall data pipeline. Primary contact for pipeline incidents." }
  ),
  makeNode(N_JAMES, "James", L_PEOPLE,
    { role: "Data Engineer", team: "Data Platform" },
    { aliases: ["JK"] }
  ),
  makeNode(N_MARIA, "Maria", L_PEOPLE,
    { role: "Data Warehouse Owner", team: "Analytics" },
    { readme: "Owns downstream data warehouse. No visibility into upstream failures." }
  ),

  // Processes
  makeNode(N_PIPELINE, "Pipeline Ingestion", L_PROCESS,
    { frequency: "hourly", last_incident: "2026-03-10" }
  ),
  makeNode(N_TRANSFORM, "Data Transformation", L_PROCESS,
    { engine: "dbt + Spark" }
  ),
  makeNode(N_ALERTING, "Alerting", L_PROCESS,
    { channels: "PagerDuty, Slack #alerts" }
  ),
  makeNode(N_MONITORING, "Monitoring", L_PROCESS,
    { dashboards: "3 Grafana boards" }
  ),

  // Tools
  makeNode(N_AIRFLOW, "Airflow", L_TOOLS,
    { version: "2.8.1", managed_by: "James" },
    { readme: "Apache Airflow orchestrates all DAGs. Running on Kubernetes." }
  ),
  makeNode(N_DELTA, "Delta Tables", L_TOOLS,
    { storage: "S3", format: "Delta Lake 3.0" }
  ),
  makeNode(N_DATABRICKS, "Databricks", L_TOOLS,
    { workspace: "analytics-prod", cost_center: "data-platform" }
  ),
  makeNode(N_KAFKA, "Kafka", L_TOOLS,
    { cluster: "prod-events", partitions: 24 },
    { aliases: ["Kafka topics", "event bus"] }
  ),
  makeNode(N_GRAFANA, "Grafana", L_TOOLS,
    { url: "grafana.internal" }
  ),
  makeNode(N_PAGERDUTY, "PagerDuty", L_TOOLS,
    { escalation_policy: "data-platform-oncall" }
  ),
  makeNode(N_DBT, "dbt", L_TOOLS,
    { version: "1.7", models: 142 },
    { createdBy: USER2_ID }
  ),
  makeNode(N_GREAT_EX, "Great Expectations", L_TOOLS,
    { suites: 8, checks: 234 },
    { createdBy: USER2_ID }
  ),

  // Constraints
  makeNode(N_RETRY, "Retry Policy", L_CONSTRAINTS,
    { max_attempts: 3, backoff: "exponential", base_delay: "2s", max_delay: "30s" },
    {
      readme: "# Retry Policy\n\n3 attempts with exponential backoff.\n\n- Base delay: 2 seconds\n- Max delay: 30 seconds\n- Circuit breaker: opens after 5 consecutive failures\n\n*Last reviewed by Sarah — Jan 2026*\n\n> Note: This may be outdated. Discussion in March meeting suggested increasing to 5 attempts.",
      sourceSegmentId: "seg-2-5",
    }
  ),
  makeNode(N_SLA, "SLA Agreement", L_CONSTRAINTS,
    { target: "99.5%", measurement_window: "monthly" }
  ),
  makeNode(N_ONCALL, "On-Call Runbook", L_CONSTRAINTS,
    { location: "Confluence", last_updated: "2026-01-20" },
    { readme: "# On-Call Runbook\n\n1. Check PagerDuty alert details\n2. Verify Grafana dashboards\n3. Check Airflow DAG status\n4. If pipeline failure: follow retry policy\n5. If data quality: check Great Expectations results\n6. Escalate to Sarah if unresolved after 30min" }
  ),
];

// ═══ Edges ═══
function makeEdge(
  id: string, from: string, to: string,
  relationship: string, type: string,
  weight: number | null = null,
  props: Record<string, any> = {}
): Edge {
  return {
    id, graphId: GRAPH_ID, fromNodeId: from, toNodeId: to,
    relationship, type, weight, properties: props,
    sourceSegmentId: null, status: "confirmed",
    createdBy: USER_ID, createdAt: weekAgo, updatedAt: now,
  };
}

export const mockEdges: Edge[] = [
  // People → Processes
  makeEdge("e-1", N_SARAH, N_PIPELINE, "manages", "structural"),
  makeEdge("e-2", N_JAMES, N_PIPELINE, "operates", "structural"),
  makeEdge("e-3", N_JAMES, N_TRANSFORM, "maintains", "structural"),
  makeEdge("e-4", N_MARIA, N_TRANSFORM, "consumes output", "data-flow"),

  // People → Tools
  makeEdge("e-5", N_JAMES, N_AIRFLOW, "manages DAGs", "structural"),
  makeEdge("e-6", N_SARAH, N_PAGERDUTY, "on-call primary", "structural"),
  makeEdge("e-7", N_MARIA, N_DATABRICKS, "queries data", "data-flow"),

  // People communication
  makeEdge("e-8", N_SARAH, N_JAMES, "communicates via Slack", "communication"),
  makeEdge("e-9", N_JAMES, N_MARIA, "data handoff", "data-flow", 0.6),

  // Processes → Tools
  makeEdge("e-10", N_PIPELINE, N_KAFKA, "reads from", "data-flow", 0.9),
  makeEdge("e-11", N_PIPELINE, N_AIRFLOW, "orchestrated by", "structural"),
  makeEdge("e-12", N_PIPELINE, N_DELTA, "writes to", "data-flow", 0.9),
  makeEdge("e-13", N_TRANSFORM, N_DBT, "executed by", "structural"),
  makeEdge("e-14", N_TRANSFORM, N_DELTA, "reads/writes", "data-flow", 0.8),
  makeEdge("e-15", N_TRANSFORM, N_GREAT_EX, "validated by", "structural"),
  makeEdge("e-16", N_ALERTING, N_PAGERDUTY, "triggers via", "structural"),
  makeEdge("e-17", N_MONITORING, N_GRAFANA, "displayed on", "structural"),

  // Tools → Tools
  makeEdge("e-18", N_KAFKA, N_DELTA, "feeds into", "data-flow", 0.9),
  makeEdge("e-19", N_DELTA, N_DATABRICKS, "stored in", "structural"),
  makeEdge("e-20", N_AIRFLOW, N_DBT, "triggers", "structural"),

  // Constraints → Processes
  makeEdge("e-21", N_RETRY, N_PIPELINE, "governs", "constraint", 0.7),
  makeEdge("e-22", N_RETRY, N_ALERTING, "triggers after exhaustion", "constraint"),
  makeEdge("e-23", N_SLA, N_PIPELINE, "constrains", "constraint", 0.8),
  makeEdge("e-24", N_SLA, N_MONITORING, "measured by", "structural"),
  makeEdge("e-25", N_ONCALL, N_ALERTING, "documents response", "structural"),

  // Constraints → People
  makeEdge("e-26", N_SARAH, N_RETRY, "authored", "structural"),
  makeEdge("e-27", N_SARAH, N_ONCALL, "authored", "structural"),

  // Cross-layer visibility gap (Maria can't see upstream)
  makeEdge("e-28", N_MARIA, N_MONITORING, "no access", "attenuating", -0.5,
    { note: "Maria has no visibility into pipeline monitoring" }),
];

// ═══ Transcript ═══
export const mockTranscripts: Transcript[] = [
  {
    id: T_SESSION1,
    graphId: GRAPH_ID,
    title: "Session 1 — People & Roles",
    audioPath: null,
    createdAt: weekAgo,
    segments: [
      {
        id: "seg-1-1", transcriptId: T_SESSION1,
        speakerLabel: "You", text: "The main people are Sarah who manages the pipeline, James who handles the Airflow DAGs, and Maria who owns the downstream data warehouse.",
        startTime: 0, endTime: 12.4, confidenceScore: 0.96, reviewed: true,
      },
      {
        id: "seg-1-2", transcriptId: T_SESSION1,
        speakerLabel: "You", text: "Sarah and James communicate through Slack but Maria only sees the data after it arrives — she has no visibility into failures upstream.",
        startTime: 12.5, endTime: 22.1, confidenceScore: 0.94, reviewed: true,
      },
    ],
  },
  {
    id: T_SESSION2,
    graphId: GRAPH_ID,
    title: "Session 2 — Tools & Systems",
    audioPath: null,
    createdAt: "2026-03-20T14:00:00Z",
    segments: [
      {
        id: "seg-2-1", transcriptId: T_SESSION2,
        speakerLabel: "You", text: "So our main orchestration tool is Airflow, James manages the DAGs there. The data lands in Delta tables on the analytics Databricks account.",
        startTime: 0, endTime: 11.2, confidenceScore: 0.97, reviewed: true,
      },
      {
        id: "seg-2-2", transcriptId: T_SESSION2,
        speakerLabel: "You", text: "We've got Kafka topics feeding into the pipeline, about twenty-four partitions on the prod events cluster.",
        startTime: 11.3, endTime: 18.9, confidenceScore: 0.91, reviewed: false,
      },
      {
        id: "seg-2-3", transcriptId: T_SESSION2,
        speakerLabel: "You", text: "The monitoring is through Grafana dashboards but honestly nobody looks at them until PagerDuty fires.",
        startTime: 19.0, endTime: 26.3, confidenceScore: 0.93, reviewed: true,
      },
      {
        id: "seg-2-4", transcriptId: T_SESSION2,
        speakerLabel: "You", text: "The retrial policy is documented somewhere, I think Sarah wrote it up in Confluence last year, but I haven't checked if it's still accurate.",
        startTime: 26.4, endTime: 35.8, confidenceScore: 0.78, reviewed: false,
      },
      {
        id: "seg-2-5", transcriptId: T_SESSION2,
        speakerLabel: "You", text: "Oh and James added DBT for the transformations and Great Expectations for data quality checks — those are relatively new.",
        startTime: 35.9, endTime: 44.1, confidenceScore: 0.89, reviewed: false,
      },
    ],
  },
];

// ═══ Mock Extraction Proposal (for demo) ═══
export const mockExtractionProposal: ExtractionProposal = {
  nodes: [
    {
      tempId: "tmp-slack",
      name: "Slack",
      suggestedLayer: L_TOOLS,
      properties: { purpose: "Team communication" },
      sourceSegmentId: "seg-1-2",
      confidence: 0.88,
    },
    {
      tempId: "tmp-confluence",
      name: "Confluence",
      suggestedLayer: L_TOOLS,
      properties: { purpose: "Documentation" },
      sourceSegmentId: "seg-2-4",
      confidence: 0.82,
    },
  ],
  edges: [
    {
      tempId: "tmp-e-slack-1",
      fromNodeRef: N_SARAH,
      toNodeRef: "tmp-slack",
      relationship: "communicates via",
      type: "communication",
      confidence: 0.85,
      sourceSegmentId: "seg-1-2",
    },
    {
      tempId: "tmp-e-confluence-1",
      fromNodeRef: N_RETRY,
      toNodeRef: "tmp-confluence",
      relationship: "documented in",
      type: "structural",
      confidence: 0.79,
      sourceSegmentId: "seg-2-4",
    },
  ],
  aliasMatches: [
    {
      candidateName: "retrial policy",
      existingNodeId: N_RETRY,
      existingNodeName: "Retry Policy",
      similarityScore: 0.92,
      sourceSegmentId: "seg-2-4",
    },
  ],
  staleNodes: [
    {
      nodeId: N_RETRY,
      nodeName: "Retry Policy",
      reason: "Conversation mentions this documentation may be outdated. Speaker says 'I haven't checked if it's still accurate.'",
      affectedSegmentIds: ["seg-2-4"],
      suggestedReadmeUpdate: "# Retry Policy\n\n**⚠ Flagged for review** — mentioned as possibly stale in Session 2.\n\n5 attempts with exponential backoff.\n\n- Base delay: 2 seconds\n- Max delay: 60 seconds\n- Circuit breaker: opens after 5 consecutive failures\n\n*Needs review — last confirmed accurate Jan 2026*",
    },
  ],
};

// ═══ Dictionary ═══
export const mockDictionary: DictionaryEntry[] = [
  { id: "d-1", term: "DAG", canonicalName: "DAG", definition: "Directed Acyclic Graph — an Airflow workflow definition", createdBy: USER_ID, createdAt: weekAgo },
  { id: "d-2", term: "Delta table", canonicalName: "Delta Tables", definition: "Delta Lake format tables stored on S3 via Databricks", createdBy: USER_ID, createdAt: weekAgo },
  { id: "d-3", term: "Kafka topics", canonicalName: "Kafka", definition: "Event streaming topics on the prod-events Kafka cluster", createdBy: USER_ID, createdAt: weekAgo },
];

// ═══ Commit History ═══
export const mockCommits: CommitEntry[] = [
  { hash: "a3f7b21", message: "Add dbt and Great Expectations nodes (from James's proposal)", author: "James", timestamp: "2026-03-23T15:30:00Z", filesChanged: 4 },
  { hash: "e1c9d04", message: "Update Retry Policy README with review flag", author: "You", timestamp: "2026-03-22T10:15:00Z", filesChanged: 1 },
  { hash: "8b2f5a7", message: "Add cross-layer edges for monitoring visibility gap", author: "You", timestamp: "2026-03-20T16:45:00Z", filesChanged: 3 },
  { hash: "d4e8c13", message: "Extract entities from Session 2 transcript", author: "You", timestamp: "2026-03-20T14:30:00Z", filesChanged: 12 },
  { hash: "f9a1b36", message: "Add tools & systems layer nodes from dictation", author: "You", timestamp: "2026-03-20T14:15:00Z", filesChanged: 8 },
  { hash: "c7d2e48", message: "Initial graph from warm start — people & roles", author: "You", timestamp: "2026-03-17T12:00:00Z", filesChanged: 6 },
];

// ═══ Graph (top-level) ═══
export const mockGraph: Graph = {
  id: GRAPH_ID,
  title: "Data Pipeline Operations",
  readme: "# Data Pipeline Operations\n\nA map of our team's data pipeline infrastructure, including people, processes, tools, and constraints.\n\n## Context\nThis graph was created to understand why pipeline failures take too long to resolve and why Maria's team has no upstream visibility.\n\n## Key findings\n- Communication gap between James and Maria\n- Retry policy may be outdated\n- Monitoring dashboards exist but nobody watches them proactively",
  visibility: "private",
  frame: "organization",
  intent: "not_working",
  layers: mockLayers,
  stats: {
    nodeCount: mockNodes.length,
    edgeCount: mockEdges.length,
    isolatedNodeCount: 0,
    lastModified: now,
    contributors: [USER_ID, USER2_ID],
    openProposals: 0,
  },
  createdAt: weekAgo,
  updatedAt: now,
};

// ═══ Layer-to-color map helper ═══
export const LAYER_IDS = { L_PEOPLE, L_PROCESS, L_TOOLS, L_CONSTRAINTS };
export const NODE_IDS = {
  N_SARAH, N_JAMES, N_MARIA, N_PIPELINE, N_TRANSFORM, N_ALERTING,
  N_MONITORING, N_AIRFLOW, N_DELTA, N_DATABRICKS, N_KAFKA, N_GRAFANA,
  N_PAGERDUTY, N_DBT, N_GREAT_EX, N_RETRY, N_SLA, N_ONCALL,
};
