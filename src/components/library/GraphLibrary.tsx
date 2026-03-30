import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibraryStore } from "../../store/libraryStore";
import { useUIStore } from "../../store/uiStore";
import { GraphCard } from "./GraphCard";
import { WarmStartModal } from "../warmstart/WarmStartModal";
import { SettingsPanel } from "../layout/SettingsPanel";
import { Plus, Settings, BookOpen } from "lucide-react";

export function GraphLibrary() {
  const graphs = useLibraryStore((s) => s.graphs);
  const loadExample = useLibraryStore((s) => s.loadExampleScenario);
  const removeGraph = useLibraryStore((s) => s.removeGraph);
  const [warmStartOpen, setWarmStartOpen] = useState(false);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const navigate = useNavigate();

  const handleLoadExample = async () => {
    await loadExample();
    navigate("/graph/g-pipeline-ops");
  };

  const handleOpenGraph = (graphId: string) => {
    navigate(`/graph/${graphId}`);
  };

  const handleNewGraph = () => {
    setWarmStartOpen(true);
  };

  const handleWarmStartComplete = (graphId: string) => {
    setWarmStartOpen(false);
    navigate(`/graph/${graphId}`);
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="border-b border-border bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink">SysHub</h1>
            <p className="text-sm text-ink-muted">Knowledge graphs for organizational sensemaking</p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {graphs.length === 0 ? (
          <EmptyState onNew={handleNewGraph} onLoadExample={handleLoadExample} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-ink">Your Graphs</h2>
              <div className="flex items-center gap-2">
                {!graphs.some((g) => g.id === "g-pipeline-ops") && (
                  <button
                    onClick={handleLoadExample}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-ink-muted hover:text-ink hover:bg-paper-darker transition-colors"
                  >
                    <BookOpen size={16} />
                    Load Example
                  </button>
                )}
                <button
                  onClick={handleNewGraph}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  <Plus size={16} />
                  New Graph
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {graphs.map((graph) => (
                <GraphCard
                  key={graph.id}
                  graph={graph}
                  onOpen={() => handleOpenGraph(graph.id)}
                  onDelete={() => removeGraph(graph.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {warmStartOpen && (
        <WarmStartModal
          onComplete={handleWarmStartComplete}
          onClose={() => setWarmStartOpen(false)}
        />
      )}

      {settingsOpen && <SettingsPanel />}
    </div>
  );
}

function EmptyState({ onNew, onLoadExample }: { onNew: () => void; onLoadExample: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-16 h-16 rounded-2xl bg-paper-darker border border-border flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted">
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <line x1="7.5" y1="7.5" x2="10.5" y2="16.5" />
          <line x1="16.5" y1="7.5" x2="13.5" y2="16.5" />
          <line x1="8" y1="6" x2="16" y2="6" />
        </svg>
      </div>
      <h2 className="text-lg font-medium text-ink mb-1">No graphs yet</h2>
      <p className="text-sm text-ink-muted mb-6">
        Create your first one to start mapping a system.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          New Graph
        </button>
        <button
          onClick={onLoadExample}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border text-ink-muted hover:text-ink hover:bg-paper-darker transition-colors"
        >
          <BookOpen size={16} />
          Load Example
        </button>
      </div>
    </div>
  );
}
