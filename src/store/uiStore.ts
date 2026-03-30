import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewMode, DisplaySettings } from "../types";

interface UIState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;

  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;

  hiddenLayers: Set<string>;
  soloLayerId: string | null;
  toggleLayerVisibility: (layerId: string) => void;
  soloLayer: (layerId: string | null) => void;

  hiddenEdgeTypes: Set<string>;
  toggleEdgeType: (type: string) => void;
  crossLayerOnly: boolean;
  setCrossLayerOnly: (v: boolean) => void;

  display: DisplaySettings;
  updateDisplay: (updates: Partial<DisplaySettings>) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  showLabels: boolean;
  setShowLabels: (v: boolean) => void;

  warmStartOpen: boolean;
  setWarmStartOpen: (v: boolean) => void;

  extractionReviewOpen: boolean;
  setExtractionReviewOpen: (v: boolean) => void;

  textInputOpen: boolean;
  setTextInputOpen: (v: boolean) => void;

  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;

  speechProvider: string;
  setSpeechProvider: (v: string) => void;
  llmModel: string;
  setLlmModel: (v: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: "graph3d",
      setViewMode: (mode) => set({ viewMode: mode }),

      selectedNodeId: null,
      selectNode: (id) => set((s) => ({
        selectedNodeId: id,
        // Auto-open inspector when selecting a node
        ...(id && !s.rightSidebarOpen ? { rightSidebarOpen: true } : {}),
      })),

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
        layerSpacing: 55,
        edgeOpacity: 1.0,
        nodeSize: 1.0,
        emphasisMetric: "degree",
        emphasisStrength: 0.5,
      },
      updateDisplay: (updates) =>
        set((s) => ({ display: { ...s.display, ...updates } })),

      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),

      showLabels: false,
      setShowLabels: (v) => set({ showLabels: v }),

      warmStartOpen: false,
      setWarmStartOpen: (v) => set({ warmStartOpen: v }),

      extractionReviewOpen: false,
      setExtractionReviewOpen: (v) => set({ extractionReviewOpen: v }),

      textInputOpen: false,
      setTextInputOpen: (v) => set({ textInputOpen: v }),

      settingsOpen: false,
      setSettingsOpen: (v) => set({ settingsOpen: v }),

      speechProvider: "deepgram",
      setSpeechProvider: (v) => set({ speechProvider: v }),
      llmModel: "",
      setLlmModel: (v) => set({ llmModel: v }),
    }),
    {
      name: "syshub-ui",
      // Only persist durable preferences, not ephemeral UI state
      partialize: (state) => ({
        display: state.display,
        showLabels: state.showLabels,
        leftSidebarOpen: state.leftSidebarOpen,
        rightSidebarOpen: state.rightSidebarOpen,
        speechProvider: state.speechProvider,
        llmModel: state.llmModel,
      }),
    }
  )
);
