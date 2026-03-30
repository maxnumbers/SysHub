import { create } from "zustand";
import { useGraphStore } from "./graphStore";
import type { Node, Edge } from "../types";

interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface HistoryEntry {
  id: string;
  label: string;
  timestamp: string;
  before: GraphSnapshot;
  after: GraphSnapshot;
}

interface HistoryState {
  entries: HistoryEntry[];
  position: number; // Index of current position in history (-1 = at latest)
  maxDepth: number;

  /** Capture a snapshot before a mutation. Call commitAfter() when done. */
  beginCommit: (label: string) => void;
  /** Finalize the commit with the current graph state as "after". */
  commitAfter: () => void;
  /** Combined: snapshot before, run mutator, snapshot after. */
  commit: (label: string, mutator: () => void) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

let _pendingLabel: string | null = null;
let _pendingBefore: GraphSnapshot | null = null;

function captureSnapshot(): GraphSnapshot {
  const state = useGraphStore.getState();
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  };
}

function restoreSnapshot(snapshot: GraphSnapshot) {
  useGraphStore.setState({
    nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
    edges: JSON.parse(JSON.stringify(snapshot.edges)),
  });
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  entries: [],
  position: -1,
  maxDepth: 50,

  beginCommit: (label: string) => {
    _pendingLabel = label;
    _pendingBefore = captureSnapshot();
  },

  commitAfter: () => {
    if (!_pendingLabel || !_pendingBefore) return;

    const after = captureSnapshot();
    const entry: HistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: _pendingLabel,
      timestamp: new Date().toISOString(),
      before: _pendingBefore,
      after,
    };

    set((s) => {
      // If we're not at the end, truncate forward history
      let entries = s.position >= 0
        ? s.entries.slice(0, s.entries.length - s.position)
        : [...s.entries];

      entries.push(entry);

      // Enforce max depth
      if (entries.length > s.maxDepth) {
        entries = entries.slice(entries.length - s.maxDepth);
      }

      return { entries, position: -1 };
    });

    _pendingLabel = null;
    _pendingBefore = null;
  },

  commit: (label: string, mutator: () => void) => {
    const before = captureSnapshot();
    mutator();
    const after = captureSnapshot();

    // Skip if nothing changed
    if (JSON.stringify(before) === JSON.stringify(after)) return;

    const entry: HistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      timestamp: new Date().toISOString(),
      before,
      after,
    };

    set((s) => {
      let entries = s.position >= 0
        ? s.entries.slice(0, s.entries.length - s.position)
        : [...s.entries];

      entries.push(entry);

      if (entries.length > s.maxDepth) {
        entries = entries.slice(entries.length - s.maxDepth);
      }

      return { entries, position: -1 };
    });
  },

  undo: () => {
    const { entries, position } = get();
    const idx = position === -1 ? entries.length - 1 : entries.length - 1 - position - 1 + (entries.length - 1 - (entries.length - 1 - position));

    // Simpler: the "current" entry index
    const currentIdx = position === -1
      ? entries.length - 1
      : entries.length - 1 - position;

    if (currentIdx < 0 || currentIdx >= entries.length) return;

    const entry = entries[currentIdx];
    restoreSnapshot(entry.before);

    set({ position: position === -1 ? 0 : position + 1 });
  },

  redo: () => {
    const { entries, position } = get();
    if (position <= 0) return;

    const targetIdx = entries.length - position;
    if (targetIdx < 0 || targetIdx >= entries.length) return;

    const entry = entries[targetIdx];
    restoreSnapshot(entry.after);

    set({ position: position - 1 });
  },

  canUndo: () => {
    const { entries, position } = get();
    const currentIdx = position === -1
      ? entries.length - 1
      : entries.length - 1 - position;
    return currentIdx >= 0;
  },

  canRedo: () => {
    const { position } = get();
    return position > 0;
  },

  clearHistory: () => set({ entries: [], position: -1 }),
}));

// Keyboard shortcut listener
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      useHistoryStore.getState().undo();
    }
    if (isCtrl && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      useHistoryStore.getState().redo();
    }
    if (isCtrl && e.key === "y") {
      e.preventDefault();
      useHistoryStore.getState().redo();
    }
  });
}
