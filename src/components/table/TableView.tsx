import { useState } from "react";
import { NodeTable } from "./NodeTable";
import { EdgeTable } from "./EdgeTable";

export function TableView() {
  const [tab, setTab] = useState<"nodes" | "edges">("nodes");

  return (
    <div className="h-full flex flex-col bg-paper">
      <div className="flex border-b border-border px-3 pt-2 shrink-0">
        <button
          onClick={() => setTab("nodes")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            tab === "nodes"
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Nodes
        </button>
        <button
          onClick={() => setTab("edges")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            tab === "edges"
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Edges
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === "nodes" ? <NodeTable /> : <EdgeTable />}
      </div>
    </div>
  );
}
