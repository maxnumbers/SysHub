import { create } from "zustand";
import type { Node, Edge, Layer, Transcript, CommitEntry } from "../types";
import { mockNodes, mockEdges, mockLayers, mockTranscripts, mockCommits } from "../mock/data";

interface GraphState {
  graphId: string | null;
  layers: Layer[];
  nodes: Node[];
  edges: Edge[];
  transcripts: Transcript[];
  commits: CommitEntry[];

  // Actions
  loadGraph: (graphId: string) => void;
  loadEmpty: (graphId: string, layers: Layer[]) => void;

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

export const useGraphStore = create<GraphState>((set) => ({
  graphId: null,
  layers: [],
  nodes: [],
  edges: [],
  transcripts: [],
  commits: [],

  loadGraph: (graphId) => {
    // For PoC, load mock data for the demo graph
    if (graphId === "g-pipeline-ops") {
      set({
        graphId,
        layers: mockLayers,
        nodes: mockNodes,
        edges: mockEdges,
        transcripts: mockTranscripts,
        commits: mockCommits,
      });
    }
  },

  loadEmpty: (graphId, layers) => {
    set({
      graphId,
      layers,
      nodes: [],
      edges: [],
      transcripts: [],
      commits: [],
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
