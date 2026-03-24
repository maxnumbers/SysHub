import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { GraphView3D } from "../graph/GraphView3D";
import { NodeTable } from "../table/NodeTable";
import { TranscriptView } from "../transcript/TranscriptView";
import { ExtractionReview } from "../extraction/ExtractionReview";
import { WarmStartModal } from "../warmstart/WarmStartModal";

export function Workspace() {
  const { graphId } = useParams<{ graphId: string }>();
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const nodes = useGraphStore((s) => s.nodes);
  const viewMode = useUIStore((s) => s.viewMode);
  const leftOpen = useUIStore((s) => s.leftSidebarOpen);
  const rightOpen = useUIStore((s) => s.rightSidebarOpen);
  const warmStartOpen = useUIStore((s) => s.warmStartOpen);
  const setWarmStartOpen = useUIStore((s) => s.setWarmStartOpen);
  const extractionReviewOpen = useUIStore((s) => s.extractionReviewOpen);

  useEffect(() => {
    if (graphId) loadGraph(graphId);
  }, [graphId, loadGraph]);

  return (
    <div className="h-screen flex flex-col bg-paper">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {leftOpen && <LeftSidebar />}
        <main className="flex-1 relative overflow-hidden bg-paper-dark">
          {viewMode === "graph3d" && <GraphView3D />}
          {viewMode === "table" && <NodeTable />}
          {viewMode === "transcript" && <TranscriptView />}

          {/* View mode tabs */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-paper/90 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
            <ViewTab mode="graph3d" label="Graph" />
            <ViewTab mode="table" label="Table" />
            <ViewTab mode="transcript" label="Transcript" />
          </div>

          {/* Empty state for new graphs */}
          {nodes.length === 0 && viewMode === "graph3d" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-ink-muted max-w-sm">
                <p className="text-lg font-medium mb-2">Ready to start</p>
                <p className="text-sm leading-relaxed">
                  Click the mic to describe your system by voice, or switch to
                  Table view and add nodes manually.
                </p>
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
