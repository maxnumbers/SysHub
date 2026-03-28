import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Graph } from "../types";
import { useGraphStore } from "./graphStore";

interface LibraryState {
  graphs: Graph[];
  addGraph: (graph: Graph) => void;
  updateGraph: (id: string, updates: Partial<Graph>) => void;
  removeGraph: (id: string) => void;
  loadExampleScenario: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      graphs: [],

      addGraph: (graph) =>
        set((state) => ({ graphs: [...state.graphs, graph] })),

      updateGraph: (id, updates) =>
        set((state) => ({
          graphs: state.graphs.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),

      removeGraph: (id) => {
        set((state) => ({
          graphs: state.graphs.filter((g) => g.id !== id),
        }));
        useGraphStore.getState().removeGraphData(id);
      },

      loadExampleScenario: async () => {
        if (get().graphs.some((g) => g.id === "g-pipeline-ops")) return;

        const {
          mockGraph, mockNodes, mockEdges, mockLayers,
          mockTranscripts, mockCommits,
        } = await import("../mock/data");

        set((state) => ({ graphs: [...state.graphs, mockGraph] }));

        useGraphStore.getState().loadGraphData(mockGraph.id, {
          layers: mockLayers,
          nodes: mockNodes,
          edges: mockEdges,
          transcripts: mockTranscripts,
          commits: mockCommits,
        });
      },
    }),
    {
      name: "syshub-library",
    }
  )
);
