import type { Graph } from "../../types";
import { getLayerColors } from "../shared/ColorUtils";
import { Users, Trash2 } from "lucide-react";

interface Props {
  graph: Graph;
  onOpen: () => void;
  onDelete: () => void;
}

export function GraphCard({ graph, onOpen, onDelete }: Props) {
  const layerColors = getLayerColors(graph.layers.length);
  const readmeExcerpt = graph.readme
    .replace(/^#.*$/gm, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 180);

  const lastMod = new Date(graph.stats.lastModified);
  const timeAgo = getTimeAgo(lastMod);

  return (
    <div className="relative bg-paper border border-border rounded-xl hover:border-accent/30 hover:shadow-sm transition-all group">
      <button onClick={onOpen} className="text-left w-full p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-ink group-hover:text-accent transition-colors">
            {graph.title}
          </h3>
          <div className="flex gap-0.5 ml-2 shrink-0">
            {layerColors.map((color, i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {readmeExcerpt && (
          <p className="text-sm text-ink-muted leading-relaxed mb-3 line-clamp-2">
            {readmeExcerpt}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span>{graph.stats.nodeCount} nodes</span>
          <span className="text-border">·</span>
          <span>{graph.stats.edgeCount} edges</span>
          <span className="text-border">·</span>
          <span>{graph.layers.length} layers</span>
          <div className="flex-1" />
          <span>{timeAgo}</span>
          {graph.stats.contributors.length > 1 && (
            <span className="flex items-center gap-0.5">
              <Users size={12} />
              {graph.stats.contributors.length}
            </span>
          )}
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete "${graph.title}"? This cannot be undone.`)) {
            onDelete();
          }
        }}
        className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-paper-darker text-ink-muted hover:text-danger transition-all"
        title="Delete graph"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
