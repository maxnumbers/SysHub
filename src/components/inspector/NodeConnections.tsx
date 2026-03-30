import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useLayerColors } from "../../hooks/useLayerColors";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface Props {
  nodeId: string;
}

export function NodeConnections({ nodeId }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const layers = useGraphStore((s) => s.layers);
  const selectNode = useUIStore((s) => s.selectNode);
  const layerColors = useLayerColors(layers);

  const outgoing = edges.filter((e) => e.fromNodeId === nodeId);
  const incoming = edges.filter((e) => e.toNodeId === nodeId);

  const getNode = (id: string) => nodes.find((n) => n.id === id);
  const getLayer = (layerId: string) => layers.find((l) => l.id === layerId);

  const currentNode = getNode(nodeId);
  const currentLayerId = currentNode?.layerId;

  return (
    <section>
      <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
        Connections ({outgoing.length + incoming.length})
      </h3>

      {outgoing.length + incoming.length === 0 && (
        <p className="text-xs text-ink-muted italic">No connections yet.</p>
      )}

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-ink-muted mb-1">Outgoing ({outgoing.length})</div>
          <div className="space-y-0.5">
            {outgoing.map((edge) => {
              const target = getNode(edge.toNodeId);
              if (!target) return null;
              const isCrossLayer = target.layerId !== currentLayerId;
              const targetLayer = getLayer(target.layerId);
              const color = layerColors.get(target.layerId) || "#999";

              return (
                <button
                  key={edge.id}
                  onClick={() => selectNode(target.id)}
                  className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-paper-darker transition-colors group"
                >
                  <ArrowRight size={11} className="text-ink-muted shrink-0" />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-ink group-hover:text-accent truncate">
                    {target.name}
                  </span>
                  <span className="text-ink-muted shrink-0 truncate max-w-[80px]">
                    {edge.relationship}
                  </span>
                  {edge.type && (
                    <span className="text-[9px] px-1 py-0 rounded bg-paper-darker text-ink-muted shrink-0">
                      {edge.type}
                    </span>
                  )}
                  {isCrossLayer && targetLayer && (
                    <span
                      className="text-[10px] px-1 py-0 rounded-full shrink-0"
                      style={{
                        backgroundColor: color + "20",
                        color: color,
                      }}
                    >
                      {targetLayer.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming */}
      {incoming.length > 0 && (
        <div>
          <div className="text-xs text-ink-muted mb-1">Incoming ({incoming.length})</div>
          <div className="space-y-0.5">
            {incoming.map((edge) => {
              const source = getNode(edge.fromNodeId);
              if (!source) return null;
              const isCrossLayer = source.layerId !== currentLayerId;
              const sourceLayer = getLayer(source.layerId);
              const color = layerColors.get(source.layerId) || "#999";

              return (
                <button
                  key={edge.id}
                  onClick={() => selectNode(source.id)}
                  className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-paper-darker transition-colors group"
                >
                  <ArrowLeft size={11} className="text-ink-muted shrink-0" />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-ink group-hover:text-accent truncate">
                    {source.name}
                  </span>
                  <span className="text-ink-muted shrink-0 truncate max-w-[80px]">
                    {edge.relationship}
                  </span>
                  {edge.type && (
                    <span className="text-[9px] px-1 py-0 rounded bg-paper-darker text-ink-muted shrink-0">
                      {edge.type}
                    </span>
                  )}
                  {isCrossLayer && sourceLayer && (
                    <span
                      className="text-[10px] px-1 py-0 rounded-full shrink-0"
                      style={{
                        backgroundColor: color + "20",
                        color: color,
                      }}
                    >
                      {sourceLayer.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
