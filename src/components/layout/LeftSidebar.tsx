import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { getLayerColor } from "../shared/ColorUtils";
import { Eye, EyeOff, Search, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

export function LeftSidebar() {
  const layers = useGraphStore((s) => s.layers);
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);
  const hiddenLayers = useUIStore((s) => s.hiddenLayers);
  const soloLayerId = useUIStore((s) => s.soloLayerId);
  const toggleLayer = useUIStore((s) => s.toggleLayerVisibility);
  const soloLayer = useUIStore((s) => s.soloLayer);
  const display = useUIStore((s) => s.display);
  const updateDisplay = useUIStore((s) => s.updateDisplay);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const showLabels = useUIStore((s) => s.showLabels);
  const setShowLabels = useUIStore((s) => s.setShowLabels);
  const crossLayerOnly = useUIStore((s) => s.crossLayerOnly);
  const setCrossLayerOnly = useUIStore((s) => s.setCrossLayerOnly);
  const hiddenEdgeTypes = useUIStore((s) => s.hiddenEdgeTypes);
  const toggleEdgeType = useUIStore((s) => s.toggleEdgeType);
  const selectNode = useUIStore((s) => s.selectNode);
  const resetAllDisplay = useUIStore((s) => s.resetAllDisplay);
  const displayOpen = useUIStore((s) => s.displaySectionOpen);
  const setDisplayOpen = useUIStore((s) => s.setDisplaySectionOpen);
  const edgeTypesOpen = useUIStore((s) => s.edgeTypesSectionOpen);
  const setEdgeTypesOpen = useUIStore((s) => s.setEdgeTypesSectionOpen);

  const sorted = [...layers].sort((a, b) => a.order - b.order);

  // Get unique edge types
  const edgeTypes = [...new Set(edges.map((e) => e.type))];

  // Get numeric property keys for emphasis
  const numericKeys = new Set<string>();
  for (const node of nodes) {
    for (const [key, val] of Object.entries(node.properties)) {
      if (typeof val === "number") numericKeys.add(key);
    }
  }
  const emphasisOptions = ["degree", "crossLayer", "combined", ...numericKeys];

  // Search results
  const searchResults = searchQuery.trim()
    ? nodes.filter((n) => {
        const q = searchQuery.toLowerCase();
        if (n.name.toLowerCase().includes(q)) return true;
        if (n.aliases.some((a) => a.toLowerCase().includes(q))) return true;
        for (const val of Object.values(n.properties)) {
          if (String(val).toLowerCase().includes(q)) return true;
        }
        return false;
      })
    : [];

  return (
    <aside className="w-[260px] bg-paper border-r border-border overflow-y-auto shrink-0">
      <div className="p-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-paper-dark border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-paper border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
              {searchResults.map((n) => {
                const layer = layers.find((l) => l.id === n.layerId);
                const color = layer
                  ? getLayerColor(sorted.indexOf(layer), sorted.length, layer.colorOverride)
                  : "#999";
                return (
                  <button
                    key={n.id}
                    onClick={() => { selectNode(n.id); setSearchQuery(""); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-darker flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate flex-1">{n.name}</span>
                    <span className="text-[10px] text-ink-muted ml-auto shrink-0">{layer?.name || ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Layers */}
        <section>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Layers</h3>
          <div className="space-y-1">
            {sorted.map((layer, idx) => {
              const color = getLayerColor(idx, sorted.length, layer.colorOverride);
              const isHidden = soloLayerId
                ? soloLayerId !== layer.id
                : hiddenLayers.has(layer.id);
              const isSolo = soloLayerId === layer.id;
              const count = nodes.filter((n) => n.layerId === layer.id).length;

              return (
                <div
                  key={layer.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer transition-colors ${
                    isHidden ? "opacity-40" : ""
                  } ${isSolo ? "bg-accent-bg" : "hover:bg-paper-darker"}`}
                  onDoubleClick={() => soloLayer(layer.id)}
                >
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 truncate">{layer.name}</span>
                  <span className="text-xs text-ink-muted">{count}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLayer(layer.id); }}
                    className="p-0.5 hover:bg-paper-darker rounded"
                  >
                    {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Edge Types -- collapsible */}
        {edgeTypes.length > 0 && (
          <section>
            <button
              onClick={() => setEdgeTypesOpen(!edgeTypesOpen)}
              className="flex items-center gap-1 w-full text-left mb-1"
            >
              {edgeTypesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Edge Types</h3>
            </button>
            {edgeTypesOpen && (
              <div className="space-y-1 ml-1">
                {edgeTypes.map((type) => {
                  const hidden = hiddenEdgeTypes.has(type);
                  return (
                    <label key={type} className="flex items-center gap-2 px-2 py-0.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() => toggleEdgeType(type)}
                        className="rounded text-accent"
                      />
                      <span className={hidden ? "opacity-40" : ""}>{type}</span>
                    </label>
                  );
                })}
                <label className="flex items-center gap-2 px-2 py-0.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crossLayerOnly}
                    onChange={(e) => setCrossLayerOnly(e.target.checked)}
                    className="rounded text-accent"
                  />
                  <span>Cross-layer only</span>
                </label>
              </div>
            )}
          </section>
        )}

        {/* Display Controls -- collapsible */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <button
              onClick={() => setDisplayOpen(!displayOpen)}
              className="flex items-center gap-1 flex-1 text-left"
            >
              {displayOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Display</h3>
            </button>
            <button
              onClick={resetAllDisplay}
              className="p-0.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
              title="Reset all display and filter settings"
            >
              <RotateCcw size={11} />
            </button>
          </div>
          {displayOpen && (
            <div className="space-y-3 ml-1">
              <SliderControl
                label="Layer spacing"
                value={display.layerSpacing}
                min={55} max={250}
                onChange={(v) => updateDisplay({ layerSpacing: v })}
              />
              <SliderControl
                label="Edge opacity"
                value={display.edgeOpacity}
                min={0.04} max={1} step={0.02}
                onChange={(v) => updateDisplay({ edgeOpacity: v })}
              />
              <SliderControl
                label="Node size"
                value={display.nodeSize}
                min={0.6} max={1.6} step={0.05}
                onChange={(v) => updateDisplay({ nodeSize: v })}
              />
            </div>
          )}
        </section>

        {/* Emphasis */}
        <section>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Emphasis</h3>
          <div className="space-y-2">
            <select
              value={display.emphasisMetric}
              onChange={(e) => updateDisplay({ emphasisMetric: e.target.value })}
              className="w-full text-sm bg-paper-dark border border-border rounded-md px-2 py-1"
            >
              {emphasisOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <SliderControl
              label="Strength"
              value={display.emphasisStrength}
              min={0} max={1} step={0.05}
              onChange={(v) => updateDisplay({ emphasisStrength: v })}
            />
          </div>
        </section>

        {/* Toggles */}
        <section>
          <label className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded text-accent"
            />
            <span>Show all labels</span>
          </label>
        </section>
      </div>
    </aside>
  );
}

function SliderControl({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-muted mb-1">
        <span>{label}</span>
        <span>{typeof value === "number" && value < 10 ? value.toFixed(2) : Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-border accent-accent"
      />
    </div>
  );
}
