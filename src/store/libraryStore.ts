import { create } from "zustand";
import type { Graph } from "../types";
import { mockGraph } from "../mock/data";

interface LibraryState {
  graphs: Graph[];
  addGraph: (graph: Graph) => void;
  updateGraph: (id: string, updates: Partial<Graph>) => void;
  removeGraph: (id: string) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  graphs: [mockGraph],

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
}));
