import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useLayerColors } from "../../hooks/useLayerColors";
import { NodeProperties } from "./NodeProperties";
import { NodeReadme } from "./NodeReadme";
import { NodeConnections } from "./NodeConnections";
import { X } from "lucide-react";

interface Props {
  nodeId: string;
}

export function InspectorPanel({ nodeId }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const layers = useGraphStore((s) => s.layers);
  const updateNode = useGraphStore((s) => s.updateNode);
  const selectNode = useUIStore((s) => s.selectNode);
  const layerColors = useLayerColors(layers);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const layer = layers.find((l) => l.id === node.layerId);
  const color = layerColors.get(node.layerId) || "#999";

  // Compute degrees
  const connectedEdges = edges.filter(
    (e) => e.fromNodeId === nodeId || e.toNodeId === nodeId
  );
  const degree = connectedEdges.length;
  const crossLayerDegree = connectedEdges.filter((e) => {
    const otherId = e.fromNodeId === nodeId ? e.toNodeId : e.fromNodeId;
    const otherNode = nodes.find((n) => n.id === otherId);
    return otherNode && otherNode.layerId !== node.layerId;
  }).length;

  const handleNameChange = (name: string) => {
    updateNode(nodeId, { name });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <input
            type="text"
            value={node.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="text-base font-semibold text-ink bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full"
          />
          <button
            onClick={() => selectNode(null)}
            className="p-1 rounded hover:bg-paper-darker text-ink-muted shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
            style={{
              backgroundColor: color + "20",
              color: color,
              border: `1px solid ${color}40`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            {layer?.name || "Unknown"}
          </span>
          <span className="text-xs text-ink-muted">
            {degree} conn · {crossLayerDegree} cross-layer
          </span>
        </div>

        {node.aliases.length > 0 && (
          <div className="mt-1.5 text-xs text-ink-muted">
            Also known as: {node.aliases.join(", ")}
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* Properties */}
      <NodeProperties nodeId={nodeId} />

      <hr className="border-border" />

      {/* README */}
      <NodeReadme nodeId={nodeId} />

      <hr className="border-border" />

      {/* Connections */}
      <NodeConnections nodeId={nodeId} />
    </div>
  );
}
