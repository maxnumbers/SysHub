import { useUIStore } from "../../store/uiStore";
import { InspectorPanel } from "../inspector/InspectorPanel";

export function RightSidebar() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);

  return (
    <aside className="w-[300px] bg-paper border-l border-border overflow-y-auto shrink-0">
      {selectedNodeId ? (
        <InspectorPanel nodeId={selectedNodeId} />
      ) : (
        <div className="p-4 text-sm text-ink-muted">
          <p className="font-medium mb-1">Inspector</p>
          <p>Click a node to inspect and edit its properties and connections.</p>
        </div>
      )}
    </aside>
  );
}
