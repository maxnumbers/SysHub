import { useNavigate } from "react-router-dom";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { ArrowLeft, Mic, PanelLeft, PanelRight, Download } from "lucide-react";

export function TopBar() {
  const navigate = useNavigate();
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const toggleLeft = useUIStore((s) => s.toggleLeftSidebar);
  const toggleRight = useUIStore((s) => s.toggleRightSidebar);
  const setExtractionReview = useUIStore((s) => s.setExtractionReviewOpen);

  const handleExport = (format: "json" | "mermaid") => {
    const data = format === "json"
      ? exportJSON()
      : exportMermaid();
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph.${format === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const store = useGraphStore.getState();
    return JSON.stringify({
      graphId: store.graphId,
      layers: store.layers,
      nodes: store.nodes,
      edges: store.edges,
    }, null, 2);
  };

  const exportMermaid = () => {
    const store = useGraphStore.getState();
    let lines = ["graph TD"];
    for (const node of store.nodes) {
      const safe = node.id.replace(/-/g, "_");
      lines.push(`    ${safe}["${node.name}"]`);
    }
    for (const edge of store.edges) {
      const from = edge.fromNodeId.replace(/-/g, "_");
      const to = edge.toNodeId.replace(/-/g, "_");
      const label = edge.relationship ? `|${edge.relationship}|` : "";
      lines.push(`    ${from} -->${label} ${to}`);
    }
    return lines.join("\n");
  };

  return (
    <header className="h-12 bg-paper border-b border-border flex items-center px-3 gap-2 shrink-0">
      <button
        onClick={() => navigate("/")}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Back to library"
      >
        <ArrowLeft size={18} />
      </button>

      <button
        onClick={toggleLeft}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Toggle left sidebar"
      >
        <PanelLeft size={18} />
      </button>

      <div className="h-5 w-px bg-border mx-1" />

      <span className="text-sm font-medium text-ink truncate">
        {graphId ? "Data Pipeline Operations" : "Untitled Graph"}
      </span>

      <span className="text-xs text-ink-muted ml-1">
        {nodes.length} nodes · {edges.length} edges
      </span>

      <div className="flex-1" />

      {/* Extraction review trigger */}
      <button
        onClick={() => setExtractionReview(true)}
        className="px-2.5 py-1 text-xs font-medium rounded bg-accent-bg text-accent border border-accent/20 hover:bg-accent/10 transition-colors"
      >
        Extract Entities
      </button>

      {/* Mic button */}
      <button
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Start dictation"
      >
        <Mic size={18} />
      </button>

      {/* Export dropdown */}
      <div className="relative group">
        <button
          className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
          title="Export"
        >
          <Download size={18} />
        </button>
        <div className="absolute right-0 top-full mt-1 bg-paper border border-border rounded-lg shadow-lg py-1 min-w-[120px] hidden group-hover:block z-50">
          <button
            onClick={() => handleExport("json")}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-darker"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport("mermaid")}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-darker"
          >
            Export Mermaid
          </button>
        </div>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      <button
        onClick={toggleRight}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Toggle inspector"
      >
        <PanelRight size={18} />
      </button>
    </header>
  );
}
