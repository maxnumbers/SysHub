import { create } from "zustand";
import type { ViewMode, DisplaySettings } from "../types";

interface UIState {
  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Selection
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;

  // Sidebars
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;

  // Layers visibility
  hiddenLayers: Set<string>;
  soloLayerId: string | null;
  toggleLayerVisibility: (layerId: string) => void;
  soloLayer: (layerId: string | null) => void;

  // Edge type visibility
  hiddenEdgeTypes: Set<string>;
  toggleEdgeType: (type: string) => void;
  crossLayerOnly: boolean;
  setCrossLayerOnly: (v: boolean) => void;

  // Display settings
  display: DisplaySettings;
  updateDisplay: (updates: Partial<DisplaySettings>) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Labels
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;

  // Warm start
  warmStartOpen: boolean;
  setWarmStartOpen: (v: boolean) => void;

  // Extraction review
  extractionReviewOpen: boolean;
  setExtractionReviewOpen: (v: boolean) => void;

  // Settings
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;

  // API settings
  speechProvider: string;
  setSpeechProvider: (v: string) => void;
  llmModel: string;
  setLlmModel: (v: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: "graph3d",
  setViewMode: (mode) => set({ viewMode: mode }),

  selectedNodeId: null,
  selectNode: (id) => set({ selectedNodeId: id }),

  leftSidebarOpen: true,
  rightSidebarOpen: true,
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),

  hiddenLayers: new Set(),
  soloLayerId: null,
  toggleLayerVisibility: (layerId) =>
    set((s) => {
      const next = new Set(s.hiddenLayers);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return { hiddenLayers: next, soloLayerId: null };
    }),
  soloLayer: (layerId) =>
    set((s) => ({
      soloLayerId: s.soloLayerId === layerId ? null : layerId,
      hiddenLayers: new Set(),
    })),

  hiddenEdgeTypes: new Set(),
  toggleEdgeType: (type) =>
    set((s) => {
      const next = new Set(s.hiddenEdgeTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { hiddenEdgeTypes: next };
    }),
  crossLayerOnly: false,
  setCrossLayerOnly: (v) => set({ crossLayerOnly: v }),

  display: {
    layerSpacing: 120,
    edgeOpacity: 0.3,
    nodeSize: 1.0,
    emphasisMetric: "degree",
    emphasisStrength: 0.5,
  },
  updateDisplay: (updates) =>
    set((s) => ({ display: { ...s.display, ...updates } })),

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  showLabels: true,
  setShowLabels: (v) => set({ showLabels: v }),

  warmStartOpen: false,
  setWarmStartOpen: (v) => set({ warmStartOpen: v }),

  extractionReviewOpen: false,
  setExtractionReviewOpen: (v) => set({ extractionReviewOpen: v }),

  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  speechProvider: "deepgram",
  setSpeechProvider: (v) => set({ speechProvider: v }),
  llmModel: "cerebras/llama-3.3-70b",
  setLlmModel: (v) => set({ llmModel: v }),
}));
