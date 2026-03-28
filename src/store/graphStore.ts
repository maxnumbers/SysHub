import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
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

  _graphData: Map<string, GraphSnapshot>;

  loadGraph: (graphId: string) => void;
  loadEmpty: (graphId: string, layers: Layer[]) => void;
  loadGraphData: (graphId: string, data: GraphSnapshot) => void;
  saveCurrentGraph: () => void;
  removeGraphData: (graphId: string) => void;

  addNode: (node: Node) => void;
  addNodes: (nodes: Node[]) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  removeNode: (id: string) => void;

  addEdge: (edge: Edge) => void;
  addEdges: (edges: Edge[]) => void;
  updateEdge: (id: string, updates: Partial<Edge>) => void;
  removeEdge: (id: string) => void;

  addLayer: (layer: Layer) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  reorderLayers: (layerIds: string[]) => void;

  addTranscript: (transcript: Transcript) => void;
}

// Custom storage that serializes Map <-> Object for localStorage
const graphStorage = {
  getItem: (name: string): StorageValue<GraphState> | null => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Rehydrate _graphData from plain object to Map
    if (parsed.state?._graphData && !(parsed.state._graphData instanceof Map)) {
      parsed.state._graphData = new Map(Object.entries(parsed.state._graphData));
    }
    return parsed;
  },
  setItem: (name: string, value: StorageValue<GraphState>) => {
    // Serialize Map to plain object for JSON
    const toSave = {
      ...value,
      state: {
        ...value.state,
        _graphData: Object.fromEntries(value.state._graphData),
      },
    };
    localStorage.setItem(name, JSON.stringify(toSave));
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      graphId: null,
      layers: [],
      nodes: [],
      edges: [],
      transcripts: [],
      commits: [],
      _graphData: new Map(),

      loadGraph: (graphId) => {
        const state = get();
        if (state.graphId && state.graphId !== graphId) {
          state.saveCurrentGraph();
        }
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
          layers, nodes: [], edges: [], transcripts: [], commits: [],
        };
        set((s) => {
          const next = new Map(s._graphData);
          next.set(graphId, snapshot);
          return { graphId, ...snapshot, _graphData: next };
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

      removeGraphData: (graphId) => {
        set((s) => {
          const next = new Map(s._graphData);
          next.delete(graphId);
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
    }),
    {
      name: "syshub-graphs",
      storage: graphStorage,
    }
  )
);
