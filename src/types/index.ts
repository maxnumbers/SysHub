// ═══ Core Entities ═══

export interface Graph {
  id: string;
  title: string;
  readme: string;
  visibility: "private" | "team" | "public";
  frame: "organization" | "problem" | "decision" | "process" | null;
  intent: "not_working" | "explain" | "intervene" | "understand" | null;
  layers: Layer[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    isolatedNodeCount: number;
    lastModified: string;
    contributors: string[];
    openProposals: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Layer {
  id: string;
  graphId: string;
  name: string;
  order: number;
  colorOverride: string | null;
}

export interface Node {
  id: string;
  graphId: string;
  name: string;
  aliases: string[];
  layerId: string;
  properties: Record<string, any>;
  readme: string | null;
  childGraphId: string | null;
  sourceSegmentId: string | null;
  status: "confirmed" | "proposed" | "needs_review";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  id: string;
  graphId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: string;
  type: string;
  weight: number | null;
  properties: Record<string, any>;
  sourceSegmentId: string | null;
  status: "confirmed" | "proposed" | "needs_review";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transcript {
  id: string;
  graphId: string;
  title: string;
  audioPath: string | null;
  segments: Segment[];
  createdAt: string;
}

export interface Segment {
  id: string;
  transcriptId: string;
  speakerLabel: string | null;
  text: string;
  startTime: number;
  endTime: number;
  confidenceScore: number;
  reviewed: boolean;
}

export interface DictionaryEntry {
  id: string;
  term: string;
  canonicalName: string;
  definition: string;
  createdBy: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  sourceRef: string;
  targetRef: string;
  authorId: string;
  title: string;
  description: string;
  status: "open" | "merged" | "rejected" | "draft";
  diff: ProposalDiff;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalDiff {
  nodesAdded: Node[];
  nodesRemoved: string[];
  nodesModified: { nodeId: string; before: Partial<Node>; after: Partial<Node> }[];
  edgesAdded: Edge[];
  edgesRemoved: string[];
  edgesModified: { edgeId: string; before: Partial<Edge>; after: Partial<Edge> }[];
  layersAdded: Layer[];
  layersRemoved: string[];
}

export interface CommitEntry {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: number;
}

// ═══ Extraction (LLM pipeline output) ═══

export interface ExtractionProposal {
  nodes: ProposedNode[];
  edges: ProposedEdge[];
  aliasMatches: AliasMatch[];
  staleNodes: StaleNodeFlag[];
}

export interface ProposedNode {
  tempId: string;
  name: string;
  suggestedLayer: string;
  properties: Record<string, any>;
  sourceSegmentId: string;
  confidence: number;
}

export interface ProposedEdge {
  tempId: string;
  fromNodeRef: string;
  toNodeRef: string;
  relationship: string;
  type: string;
  confidence: number;
  sourceSegmentId: string;
}

export interface AliasMatch {
  candidateName: string;
  existingNodeId: string;
  existingNodeName: string;
  similarityScore: number;
  sourceSegmentId: string;
}

export interface StaleNodeFlag {
  nodeId: string;
  nodeName: string;
  reason: string;
  affectedSegmentIds: string[];
  suggestedReadmeUpdate: string;
}

// ═══ Warm Start ═══

export interface WarmStartSuggestion {
  layers: { name: string; description: string }[];
  seedQuestions: { layerName: string; questions: string[] }[];
}

export interface SeedExtractionResult {
  nodes: ProposedNode[];
  edges: ProposedEdge[];
}

// ═══ UI State ═══

export type ViewMode = "graph3d" | "table" | "transcript";
export type WarmStartStep = "frame" | "intent" | "scope" | "layers";

export interface FilterState {
  visibleLayers: Set<string>;
  soloLayerId: string | null;
  visibleEdgeTypes: Set<string>;
  crossLayerOnly: boolean;
  showLabels: boolean;
  searchQuery: string;
}

export interface DisplaySettings {
  layerSpacing: number;
  edgeOpacity: number;
  nodeSize: number;
  emphasisMetric: string;
  emphasisStrength: number;
}
