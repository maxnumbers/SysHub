import { useHistoryStore } from "../../store/historyStore";
import { Undo2, Redo2 } from "lucide-react";

export function TimelineBar() {
  const entries = useHistoryStore((s) => s.entries);
  const position = useHistoryStore((s) => s.position);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());

  if (entries.length === 0) return null;

  // Determine which entry is "current"
  const currentIdx = position === -1
    ? entries.length - 1
    : entries.length - 1 - position;

  // Show only last 10 entries to avoid overflow
  const visibleEntries = entries.slice(-10);
  const visibleOffset = Math.max(0, entries.length - 10);

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-paper/90 backdrop-blur rounded-lg border border-border px-2 py-1 shadow-sm z-10">
      {/* Undo button */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="p-1 rounded hover:bg-paper-darker text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>

      {/* Timeline dots */}
      <div className="flex items-center gap-0.5 px-1">
        {visibleEntries.map((entry, i) => {
          const actualIdx = visibleOffset + i;
          const isCurrent = actualIdx === currentIdx;
          const isFuture = actualIdx > currentIdx;

          return (
            <div key={entry.id} className="relative group">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  isCurrent
                    ? "bg-accent scale-125"
                    : isFuture
                      ? "bg-border"
                      : "bg-ink-muted/40"
                }`}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                <div className="bg-ink text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap max-w-[200px] truncate">
                  {entry.label}
                  <div className="text-[10px] opacity-70">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Redo button */}
      <button
        onClick={redo}
        disabled={!canRedo}
        className="p-1 rounded hover:bg-paper-darker text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={14} />
      </button>

      {/* Entry count */}
      <span className="text-[10px] text-ink-muted ml-0.5">
        {entries.length}
      </span>
    </div>
  );
}
