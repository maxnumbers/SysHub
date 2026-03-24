import { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  nodeId: string;
}

export function NodeProperties({ nodeId }: Props) {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNode = useGraphStore((s) => s.updateNode);
  const [newKey, setNewKey] = useState("");
  const [adding, setAdding] = useState(false);

  if (!node) return null;

  const entries = Object.entries(node.properties);

  const handleValueChange = (key: string, value: string) => {
    updateNode(nodeId, {
      properties: { ...node.properties, [key]: value },
    });
  };

  const handleKeyRename = (oldKey: string, newKeyName: string) => {
    if (newKeyName === oldKey || !newKeyName.trim()) return;
    const props = { ...node.properties };
    const val = props[oldKey];
    delete props[oldKey];
    props[newKeyName] = val;
    updateNode(nodeId, { properties: props });
  };

  const handleDelete = (key: string) => {
    const props = { ...node.properties };
    delete props[key];
    updateNode(nodeId, { properties: props });
  };

  const handleAddProperty = () => {
    if (!newKey.trim()) return;
    updateNode(nodeId, {
      properties: { ...node.properties, [newKey.trim()]: "" },
    });
    setNewKey("");
    setAdding(false);
  };

  return (
    <section>
      <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
        Properties
      </h3>
      {entries.length === 0 && !adding && (
        <p className="text-xs text-ink-muted italic mb-2">No properties yet</p>
      )}
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-1.5 group">
            <input
              className="w-24 shrink-0 text-xs font-medium text-ink-light bg-transparent border-b border-transparent focus:border-accent focus:outline-none py-0.5"
              defaultValue={key}
              onBlur={(e) => handleKeyRename(key, e.target.value)}
            />
            <input
              className="flex-1 text-xs text-ink bg-transparent border-b border-transparent focus:border-accent focus:outline-none py-0.5"
              value={String(value)}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            <button
              onClick={() => handleDelete(key)}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-paper-darker text-ink-muted hover:text-danger transition-opacity"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="flex items-center gap-1.5">
            <input
              className="w-24 text-xs bg-paper-dark border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddProperty()}
              autoFocus
            />
            <button
              onClick={handleAddProperty}
              className="text-xs text-accent hover:underline"
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewKey(""); }}
              className="text-xs text-ink-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-light mt-1"
          >
            <Plus size={12} /> Add property
          </button>
        )}
      </div>
    </section>
  );
}
