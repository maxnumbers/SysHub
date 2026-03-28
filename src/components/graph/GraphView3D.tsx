import { useCallback, useEffect, useMemo, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useLayerColors } from "../../hooks/useLayerColors";
import { useNodeEmphasis } from "../../hooks/useNodeEmphasis";

interface GraphNode {
  id: string;
  name: string;
  layerId: string;
  color: string;
  x?: number;
  y?: number;
  z?: number;
  fy?: number; // fixed Y for layer positioning
  emphasis: number;
}

interface GraphLink {
  source: string;
  target: string;
  relationship: string;
  type: string;
  weight: number | null;
  color: string;
}

export function GraphView3D() {
  const graphRef = useRef<any>(null);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const layers = useGraphStore((s) => s.layers);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectNode = useUIStore((s) => s.selectNode);
  const hiddenLayers = useUIStore((s) => s.hiddenLayers);
  const soloLayerId = useUIStore((s) => s.soloLayerId);
  const hiddenEdgeTypes = useUIStore((s) => s.hiddenEdgeTypes);
  const crossLayerOnly = useUIStore((s) => s.crossLayerOnly);
  const display = useUIStore((s) => s.display);
  const showLabels = useUIStore((s) => s.showLabels);

  const layerColors = useLayerColors(layers);
  const { scores } = useNodeEmphasis(nodes, edges, display.emphasisMetric);

  // Build neighbor set for selected node highlighting
  const neighborSet = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    set.add(selectedNodeId);
    for (const edge of edges) {
      if (edge.fromNodeId === selectedNodeId) set.add(edge.toNodeId);
      if (edge.toNodeId === selectedNodeId) set.add(edge.fromNodeId);
    }
    return set;
  }, [selectedNodeId, edges]);

  // Node layer map for cross-layer edge detection
  const nodeLayerMap = useMemo(() => {
    const m = new Map<string, string>();
    nodes.forEach((n) => m.set(n.id, n.layerId));
    return m;
  }, [nodes]);

  // Determine visibility for a layer
  const isLayerVisible = useCallback(
    (layerId: string) => {
      if (soloLayerId) return layerId === soloLayerId;
      return !hiddenLayers.has(layerId);
    },
    [soloLayerId, hiddenLayers]
  );

  // Build graph data
  const graphData = useMemo(() => {
    const sorted = [...layers].sort((a, b) => a.order - b.order);
    const layerYMap = new Map<string, number>();
    sorted.forEach((l, i) => {
      layerYMap.set(l.id, -i * display.layerSpacing);
    });

    const graphNodes: GraphNode[] = nodes
      .filter((n) => isLayerVisible(n.layerId))
      .map((n) => ({
        id: n.id,
        name: n.name,
        layerId: n.layerId,
        color: layerColors.get(n.layerId) || "#999",
        fy: layerYMap.get(n.layerId) ?? 0,
        emphasis: scores.get(n.id) || 0,
      }));

    const visibleNodeIds = new Set(graphNodes.map((n) => n.id));

    const graphLinks: GraphLink[] = edges
      .filter((e) => {
        if (!visibleNodeIds.has(e.fromNodeId) || !visibleNodeIds.has(e.toNodeId)) return false;
        if (hiddenEdgeTypes.has(e.type)) return false;
        if (crossLayerOnly) {
          const fromL = nodeLayerMap.get(e.fromNodeId);
          const toL = nodeLayerMap.get(e.toNodeId);
          if (fromL === toL) return false;
        }
        return true;
      })
      .map((e) => ({
        source: e.fromNodeId,
        target: e.toNodeId,
        relationship: e.relationship,
        type: e.type,
        weight: e.weight,
        color: getEdgeColor(e.type),
      }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, layers, layerColors, scores, display.layerSpacing, isLayerVisible, hiddenEdgeTypes, crossLayerOnly, nodeLayerMap]);

  // Custom node rendering
  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const isSelected = node.id === selectedNodeId;
      const isNeighbor = neighborSet.has(node.id);
      const dimmed = selectedNodeId && !isNeighbor;

      const emphasisScale = 1 + node.emphasis * display.emphasisStrength * 0.8;
      const baseW = 80 * display.nodeSize * emphasisScale;
      const baseH = 32 * display.nodeSize * emphasisScale;
      const scale = 2; // canvas resolution multiplier
      const w = baseW * scale;
      const h = baseH * scale;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      // Parse color
      const color = node.color;
      const alpha = dimmed ? 0.12 : isSelected ? 1 : isNeighbor ? 0.85 : 0.7;

      // Background
      const radius = 8 * scale;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, radius);
      ctx.fillStyle = applyAlpha(color, alpha * 0.2);
      ctx.fill();

      // Border
      ctx.strokeStyle = applyAlpha(color, isSelected ? 0.9 : alpha * 0.6);
      ctx.lineWidth = isSelected ? 3 * scale : 1.5 * scale;
      ctx.stroke();

      // Label
      if (showLabels || isSelected || isNeighbor || node.emphasis * display.emphasisStrength > 0.35) {
        const fontSize = Math.round(12 * scale * Math.min(emphasisScale, 1.3));
        ctx.font = `${isSelected ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = dimmed ? applyAlpha("#3d3529", 0.3) : "#3d3529";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Truncate label to fit
        let label = node.name;
        while (ctx.measureText(label).width > w - 12 * scale && label.length > 3) {
          label = label.slice(0, -2) + "…";
        }
        ctx.fillText(label, w / 2, h / 2);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(baseW / 6, baseH / 6, 1);
      return sprite;
    },
    [selectedNodeId, neighborSet, display.nodeSize, display.emphasisStrength, showLabels]
  );

  // Edge styling
  const linkColor = useCallback(
    (link: GraphLink) => {
      if (!selectedNodeId) return applyAlpha(link.color, display.edgeOpacity);
      const src = typeof link.source === "object" ? (link.source as any).id : link.source;
      const tgt = typeof link.target === "object" ? (link.target as any).id : link.target;
      const connected = src === selectedNodeId || tgt === selectedNodeId;
      return applyAlpha(link.color, connected ? Math.min(display.edgeOpacity * 2.5, 1) : 0.05);
    },
    [selectedNodeId, display.edgeOpacity]
  );

  const linkWidth = useCallback(
    (link: GraphLink) => {
      const base = link.weight != null ? Math.abs(link.weight) * 2 + 0.5 : 1;
      return base;
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      selectNode(selectedNodeId === node.id ? null : node.id);
    },
    [selectedNodeId, selectNode]
  );

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Set camera position on mount
  useEffect(() => {
    if (graphRef.current) {
      const fg = graphRef.current;
      // Charge force for repulsion
      fg.d3Force("charge")?.strength(-120);
      // Set initial camera
      setTimeout(() => {
        fg.cameraPosition({ x: 200, y: -150, z: 300 }, { x: 0, y: -150, z: 0 }, 0);
      }, 100);
    }
  }, []);

  // Camera presets
  const centerY = -(layers.length * display.layerSpacing) / 2;
  const setCameraPreset = useCallback(
    (preset: "iso" | "top" | "front" | "reset") => {
      const fg = graphRef.current;
      if (!fg) return;
      const dur = 600;
      switch (preset) {
        case "iso":
          fg.cameraPosition({ x: 250, y: centerY - 100, z: 350 }, { x: 0, y: centerY, z: 0 }, dur);
          break;
        case "top":
          fg.cameraPosition({ x: 0, y: centerY - 500, z: 1 }, { x: 0, y: centerY, z: 0 }, dur);
          break;
        case "front":
          fg.cameraPosition({ x: 0, y: centerY, z: 500 }, { x: 0, y: centerY, z: 0 }, dur);
          break;
        case "reset":
          fg.cameraPosition({ x: 200, y: centerY + 50, z: 300 }, { x: 0, y: centerY, z: 0 }, dur);
          fg.d3Force("charge")?.strength(-120);
          break;
      }
    },
    [centerY]
  );

  if (nodes.length === 0) return null;

  return (
    <div className="w-full h-full relative">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        nodeId="id"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkSource="source"
        linkTarget="target"
        linkColor={linkColor as any}
        linkWidth={linkWidth as any}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={0.9}
        onNodeClick={handleNodeClick as any}
        onBackgroundClick={handleBackgroundClick}
        backgroundColor="#f0ece4"
        showNavInfo={false}
        enableNodeDrag={true}
        warmupTicks={50}
        cooldownTicks={100}
      />

      {/* Camera preset buttons */}
      <div className="absolute top-3 right-3 flex gap-1 bg-paper/80 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
        {([["iso", "Iso"], ["top", "Top"], ["front", "Front"], ["reset", "Reset"]] as const).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setCameraPreset(key)}
              className="px-2 py-0.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-darker rounded transition-colors"
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Selection actions */}
      {selectedNodeId && (
        <div className="absolute top-3 left-3 flex gap-1 bg-paper/80 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
          <button
            onClick={() => selectNode(null)}
            className="px-2 py-0.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-darker rounded transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => {
              const fg = graphRef.current;
              const node = graphData.nodes.find((n) => n.id === selectedNodeId);
              if (fg && node && node.x != null && node.y != null && node.z != null) {
                fg.cameraPosition(
                  { x: node.x + 80, y: (node.y ?? 0) - 40, z: (node.z ?? 0) + 80 },
                  { x: node.x, y: node.y, z: node.z },
                  600
                );
              }
            }}
            className="px-2 py-0.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-darker rounded transition-colors"
          >
            Fit Node
          </button>
        </div>
      )}
    </div>
  );
}

function getEdgeColor(type: string): string {
  const colors: Record<string, string> = {
    structural: "#7a8b6a",
    "data-flow": "#5a7a8a",
    communication: "#8a7a5a",
    constraint: "#8a5a5a",
    attenuating: "#a04030",
  };
  return colors[type] || "#888";
}

function applyAlpha(color: string, alpha: number): string {
  // Convert HSL or hex to rgba
  if (color.startsWith("hsl")) {
    return color.replace(")", ` / ${alpha})`).replace("hsl(", "hsla(");
  }
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
