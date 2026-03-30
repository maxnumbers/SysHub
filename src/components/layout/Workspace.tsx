import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { GraphView3D } from "../graph/GraphView3D";
import { TableView } from "../table/TableView";
import { TranscriptView } from "../transcript/TranscriptView";
import { ExtractionReview } from "../extraction/ExtractionReview";
import { TextInputModal } from "../extraction/TextInputModal";
import { WarmStartModal } from "../warmstart/WarmStartModal";
import { SettingsPanel } from "./SettingsPanel";
import { TimelineBar } from "./TimelineBar";
import { Mic, FileText, Table2 } from "lucide-react";

export function Workspace() {
  const { graphId } = useParams<{ graphId: string }>();
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const saveCurrentGraph = useGraphStore((s) => s.saveCurrentGraph);
  const nodes = useGraphStore((s) => s.nodes);
  const layers = useGraphStore((s) => s.layers);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const leftOpen = useUIStore((s) => s.leftSidebarOpen);
  const rightOpen = useUIStore((s) => s.rightSidebarOpen);
  const warmStartOpen = useUIStore((s) => s.warmStartOpen);
  const setWarmStartOpen = useUIStore((s) => s.setWarmStartOpen);
  const extractionReviewOpen = useUIStore((s) => s.extractionReviewOpen);
  const textInputOpen = useUIStore((s) => s.textInputOpen);
  const setTextInputOpen = useUIStore((s) => s.setTextInputOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);

  useEffect(() => {
    if (graphId) loadGraph(graphId);
    // Save graph data when navigating away
    return () => { saveCurrentGraph(); };
  }, [graphId, loadGraph, saveCurrentGraph]);

  return (
    <div className="h-screen flex flex-col bg-paper">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {leftOpen && <LeftSidebar />}
        <main className="flex-1 relative overflow-hidden bg-paper-dark">
          {viewMode === "graph3d" && <GraphView3D />}
          {viewMode === "table" && <TableView />}
          {viewMode === "transcript" && <TranscriptView />}

          {/* Timeline bar for undo/redo */}
          <TimelineBar />

          {/* View mode tabs */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-paper/90 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
            <ViewTab mode="graph3d" label="Graph" />
            <ViewTab mode="table" label="Table" />
            <ViewTab mode="transcript" label="Transcript" />
          </div>

          {/* Empty state for new graphs */}
          {nodes.length === 0 && viewMode === "graph3d" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <p className="text-lg font-medium text-ink mb-2">Ready to start</p>
                <p className="text-sm text-ink-muted mb-5 leading-relaxed">
                  Your graph has {layers.length} layer{layers.length !== 1 ? "s" : ""} configured.
                  Start by describing the entities in each layer.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      // Trigger mic recording via a custom event the TopBar listens to
                      window.dispatchEvent(new CustomEvent("syshub:start-recording"));
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                  >
                    <Mic size={16} />
                    Record audio
                  </button>
                  <button
                    onClick={() => setTextInputOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-ink hover:bg-paper-darker transition-colors"
                  >
                    <FileText size={16} />
                    Describe in text
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-ink hover:bg-paper-darker transition-colors"
                  >
                    <Table2 size={16} />
                    Add manually
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
        {rightOpen && <RightSidebar />}
      </div>

      {warmStartOpen && (
        <WarmStartModal
          onComplete={() => setWarmStartOpen(false)}
          onClose={() => setWarmStartOpen(false)}
        />
      )}
      {extractionReviewOpen && <ExtractionReview />}
      {textInputOpen && <TextInputModal />}
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}

function ViewTab({ mode, label }: { mode: "graph3d" | "table" | "transcript"; label: string }) {
  const current = useUIStore((s) => s.viewMode);
  const set = useUIStore((s) => s.setViewMode);
  const active = current === mode;

  return (
    <button
      onClick={() => set(mode)}
      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "text-ink-muted hover:text-ink hover:bg-paper-darker"
      }`}
    >
      {label}
    </button>
  );
}
