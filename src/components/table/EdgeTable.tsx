import { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useHistoryStore } from "../../store/historyStore";
import { ArrowUpDown } from "lucide-react";

export function EdgeTable() {
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);
  const updateEdge = useGraphStore((s) => s.updateEdge);
  const removeEdge = useGraphStore((s) => s.removeEdge);
  const selectNode = useUIStore((s) => s.selectNode);

  const getNodeName = (id: string) => nodes.find((n) => n.id === id)?.name || id;

  const [sortBy, setSortBy] = useState<"from" | "to" | "relationship" | "type">("from");

  const sorted = [...edges].sort((a, b) => {
    switch (sortBy) {
      case "from": return getNodeName(a.fromNodeId).localeCompare(getNodeName(b.fromNodeId));
      case "to": return getNodeName(a.toNodeId).localeCompare(getNodeName(b.toNodeId));
      case "relationship": return a.relationship.localeCompare(b.relationship);
      case "type": return a.type.localeCompare(b.type);
      default: return 0;
    }
  });

  return (
    <div className="p-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            {([["from", "From"], ["to", "To"], ["relationship", "Relationship"], ["type", "Type"]] as const).map(
              ([key, label]) => (
                <th
                  key={key}
                  onClick={() => setSortBy(key)}
                  className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wider px-2 py-2 cursor-pointer hover:bg-paper-darker select-none"
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <ArrowUpDown size={10} className="opacity-30" />
                  </div>
                </th>
              )
            )}
            <th className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wider px-2 py-2">Weight</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((edge) => (
            <tr key={edge.id} className="border-b border-border-light hover:bg-paper-darker/50">
              <td className="px-2 py-1.5">
                <button
                  onClick={() => selectNode(edge.fromNodeId)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {getNodeName(edge.fromNodeId)}
                </button>
              </td>
              <td className="px-2 py-1.5">
                <button
                  onClick={() => selectNode(edge.toNodeId)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {getNodeName(edge.toNodeId)}
                </button>
              </td>
              <td className="px-2 py-1.5">
                <EditableText
                  value={edge.relationship}
                  onChange={(v) => updateEdge(edge.id, { relationship: v })}
                />
              </td>
              <td className="px-2 py-1.5">
                <EditableText
                  value={edge.type}
                  onChange={(v) => updateEdge(edge.id, { type: v })}
                />
              </td>
              <td className="px-2 py-1.5">
                {edge.weight != null && (
                  <span className={`text-xs font-mono ${edge.weight < 0 ? "text-danger" : "text-success"}`}>
                    {edge.weight.toFixed(1)}
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5">
                <button
                  onClick={() => {
                    const from = getNodeName(edge.fromNodeId);
                    const to = getNodeName(edge.toNodeId);
                    useHistoryStore.getState().commit(`Removed edge: ${from} -> ${to}`, () => {
                      removeEdge(edge.id);
                    });
                  }}
                  className="text-xs text-ink-muted hover:text-danger"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between mt-3 text-xs text-ink-muted">
        <span>Showing {edges.length} edges</span>
      </div>
    </div>
  );
}

function EditableText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        className="text-xs bg-paper-dark border border-border rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-accent"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onChange(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      className="text-xs cursor-text hover:bg-paper-darker/50 px-1 py-0.5 rounded block truncate"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {value || <span className="text-ink-muted italic">—</span>}
    </span>
  );
}
