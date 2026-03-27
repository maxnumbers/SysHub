import { create } from "zustand";
import type { Graph } from "../types";
import { useGraphStore } from "./graphStore";

interface LibraryState {
  graphs: Graph[];
  addGraph: (graph: Graph) => void;
  updateGraph: (id: string, updates: Partial<Graph>) => void;
  removeGraph: (id: string) => void;
  loadExampleScenario: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  graphs: [],

  addGraph: (graph) =>
    set((state) => ({ graphs: [...state.graphs, graph] })),

  updateGraph: (id, updates) =>
    set((state) => ({
      graphs: state.graphs.map((g) =>
        g.id === id ? { ...g, ...updates } : g
      ),
    })),

  removeGraph: (id) =>
    set((state) => ({
      graphs: state.graphs.filter((g) => g.id !== id),
    })),

  loadExampleScenario: async () => {
    // Check if already loaded
    if (get().graphs.some((g) => g.id === "g-pipeline-ops")) return;

    // Dynamic import — mock/data.ts is only loaded when user asks for it
    const {
      mockGraph,
      mockNodes,
      mockEdges,
      mockLayers,
      mockTranscripts,
      mockCommits,
    } = await import("../mock/data");

    // Add graph to library
    set((state) => ({ graphs: [...state.graphs, mockGraph] }));

    // Register graph data in graphStore
    useGraphStore.getState().loadGraphData(mockGraph.id, {
      layers: mockLayers,
      nodes: mockNodes,
      edges: mockEdges,
      transcripts: mockTranscripts,
      commits: mockCommits,
    });
  },
}));
