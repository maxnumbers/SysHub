import { create } from "zustand";
import type { Node, Edge, Layer, Transcript, CommitEntry } from "../types";

interface GraphSnapshot {
  layers: Layer[];
  nodes: Node[];
  edges: Edge[];
  transcripts: Transcript[];
  commits: CommitEntry[];
}

interface GraphState {
  graphId: string | null;
  layers: Layer[];
  nodes: Node[];
  edges: Edge[];
  transcripts: Transcript[];
  commits: CommitEntry[];

  // Per-graph data registry (persists across navigation)
  _graphData: Map<string, GraphSnapshot>;

  // Actions
  loadGraph: (graphId: string) => void;
  loadEmpty: (graphId: string, layers: Layer[]) => void;
  loadGraphData: (graphId: string, data: GraphSnapshot) => void;
  saveCurrentGraph: () => void;

  // Node CRUD
  addNode: (node: Node) => void;
  addNodes: (nodes: Node[]) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  removeNode: (id: string) => void;

  // Edge CRUD
  addEdge: (edge: Edge) => void;
  addEdges: (edges: Edge[]) => void;
  updateEdge: (id: string, updates: Partial<Edge>) => void;
  removeEdge: (id: string) => void;

  // Layer CRUD
  addLayer: (layer: Layer) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  reorderLayers: (layerIds: string[]) => void;

  // Transcript
  addTranscript: (transcript: Transcript) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphId: null,
  layers: [],
  nodes: [],
  edges: [],
  transcripts: [],
  commits: [],
  _graphData: new Map(),

  loadGraph: (graphId) => {
    // Save current graph first
    const state = get();
    if (state.graphId && state.graphId !== graphId) {
      state.saveCurrentGraph();
    }

    // Load from registry
    const data = state._graphData.get(graphId);
    if (data) {
      set({
        graphId,
        layers: data.layers,
        nodes: data.nodes,
        edges: data.edges,
        transcripts: data.transcripts,
        commits: data.commits,
      });
    } else {
      // Graph exists in library but has no data yet — load empty
      set({
        graphId,
        layers: [],
        nodes: [],
        edges: [],
        transcripts: [],
        commits: [],
      });
    }
  },

  loadEmpty: (graphId, layers) => {
    const snapshot: GraphSnapshot = {
      layers,
      nodes: [],
      edges: [],
      transcripts: [],
      commits: [],
    };
    set((s) => {
      const next = new Map(s._graphData);
      next.set(graphId, snapshot);
      return {
        graphId,
        ...snapshot,
        _graphData: next,
      };
    });
  },

  loadGraphData: (graphId, data) => {
    set((s) => {
      const next = new Map(s._graphData);
      next.set(graphId, data);
      return { _graphData: next };
    });
  },

  saveCurrentGraph: () => {
    const { graphId, layers, nodes, edges, transcripts, commits } = get();
    if (!graphId) return;
    set((s) => {
      const next = new Map(s._graphData);
      next.set(graphId, { layers, nodes, edges, transcripts, commits });
      return { _graphData: next };
    });
  },

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  addNodes: (nodes) =>
    set((s) => ({ nodes: [...s.nodes, ...nodes] })),

  updateNode: (id, updates) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.fromNodeId !== id && e.toNodeId !== id),
    })),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  addEdges: (edges) =>
    set((s) => ({ edges: [...s.edges, ...edges] })),

  updateEdge: (id, updates) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  addLayer: (layer) =>
    set((s) => ({ layers: [...s.layers, layer] })),

  updateLayer: (id, updates) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),

  removeLayer: (id) =>
    set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),

  reorderLayers: (layerIds) =>
    set((s) => ({
      layers: layerIds
        .map((id, idx) => {
          const layer = s.layers.find((l) => l.id === id);
          return layer ? { ...layer, order: idx } : null;
        })
        .filter(Boolean) as Layer[],
    })),

  addTranscript: (transcript) =>
    set((s) => ({ transcripts: [...s.transcripts, transcript] })),
}));
