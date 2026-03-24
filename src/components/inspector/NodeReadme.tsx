import { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { Pencil, Check, X } from "lucide-react";

interface Props {
  nodeId: string;
}

export function NodeReadme({ nodeId }: Props) {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNode = useGraphStore((s) => s.updateNode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!node) return null;

  const handleEdit = () => {
    setDraft(node.readme || "");
    setEditing(true);
  };

  const handleSave = () => {
    updateNode(nodeId, { readme: draft || null });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft("");
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          README
        </h3>
        {!editing && (
          <button
            onClick={handleEdit}
            className="p-0.5 rounded hover:bg-paper-darker text-ink-muted"
            title="Edit README"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-40 text-xs bg-paper-dark border border-border rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-accent resize-y font-mono"
            placeholder="Write documentation for this node in Markdown..."
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent/90"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border text-ink-muted hover:bg-paper-darker"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : node.readme ? (
        <MarkdownRenderer content={node.readme} />
      ) : (
        <p className="text-xs text-ink-muted italic">
          No documentation yet. Click the edit icon to add a README.
        </p>
      )}
    </section>
  );
}
