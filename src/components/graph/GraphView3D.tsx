import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useLayerColors } from "../../hooks/useLayerColors";
import { useNodeEmphasis } from "../../hooks/useNodeEmphasis";
import { getEdgeTypeColor } from "../shared/ColorUtils";

interface GraphNode {
  id: string;
  name: string;
  layerId: string;
  color: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
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

type ViewMode2D3D = "3d" | "2d";

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

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [degreeFilter, setDegreeFilter] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode2D3D>("3d");
  const [degreeActive, setDegreeActive] = useState(false);

  const layerColors = useLayerColors(layers);
  const { scores } = useNodeEmphasis(nodes, edges, display.emphasisMetric);

  const edgeTypeColors = useMemo(() => {
    const types = [...new Set(edges.map((e) => e.type))];
    const map = new Map<string, string>();
    types.forEach((t, i) => map.set(t, getEdgeTypeColor(i, types.length)));
    return map;
  }, [edges]);

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

  const degreeNeighborhood = useMemo(() => {
    if (!selectedNodeId || !degreeActive) return null;
    const set = new Set<string>([selectedNodeId]);
    let frontier = [selectedNodeId];
    for (let d = 0; d < degreeFilter; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const edge of edges) {
          if (edge.fromNodeId === id && !set.has(edge.toNodeId)) {
            set.add(edge.toNodeId);
            next.push(edge.toNodeId);
          }
          if (edge.toNodeId === id && !set.has(edge.fromNodeId)) {
            set.add(edge.fromNodeId);
            next.push(edge.fromNodeId);
          }
        }
      }
      frontier = next;
    }
    return set;
  }, [selectedNodeId, degreeFilter, edges, degreeActive]);

  const nodeLayerMap = useMemo(() => {
    const m = new Map<string, string>();
    nodes.forEach((n) => m.set(n.id, n.layerId));
    return m;
  }, [nodes]);

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

    let filteredNodes = nodes.filter((n) => isLayerVisible(n.layerId));
    if (degreeActive && degreeNeighborhood) {
      filteredNodes = filteredNodes.filter((n) => degreeNeighborhood.has(n.id));
    }

    const graphNodes: GraphNode[] = filteredNodes.map((n) => ({
      id: n.id,
      name: n.name,
      layerId: n.layerId,
      color: layerColors.get(n.layerId) || "#999",
      emphasis: scores.get(n.id) || 0,
      fy: viewMode === "3d" ? (layerYMap.get(n.layerId) ?? 0) : 0,
      fx: undefined,
      fz: undefined,
    }));

    const visibleNodeIds = new Set(graphNodes.map((n) => n.id));

    const graphLinks: GraphLink[] = edges
      .filter((e) => {
        if (!visibleNodeIds.has(e.fromNodeId) || !visibleNodeIds.has(e.toNodeId)) return false;
        if (hiddenEdgeTypes.has(e.type)) return false;
        if (crossLayerOnly && viewMode === "3d") {
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
        color: edgeTypeColors.get(e.type) || "#888",
      }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, layers, layerColors, scores, display.layerSpacing, isLayerVisible, hiddenEdgeTypes, crossLayerOnly, nodeLayerMap, viewMode, degreeNeighborhood, degreeActive, edgeTypeColors]);

  // Custom node rendering
  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const isSelected = node.id === selectedNodeId;
      const isNeighbor = neighborSet.has(node.id);
      const isHovered = node.id === hoveredNodeId;
      const dimmed = !!(selectedNodeId && !isNeighbor);

      const emphasisScale = 1 + node.emphasis * display.emphasisStrength * 0.8;
      const nodeW = 28 * display.nodeSize * emphasisScale;
      const nodeH = 18 * display.nodeSize * emphasisScale;

      const group = new THREE.Group();

      // -- Node body --
      const bodyScale = 2;
      const canvasW = Math.round(nodeW * bodyScale);
      const canvasH = Math.round(nodeH * bodyScale);
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      const color = node.color;
      const alpha = dimmed ? 0.15 : isSelected ? 1 : isNeighbor ? 0.85 : 0.7;

      const radius = 5 * bodyScale;
      ctx.beginPath();
      ctx.roundRect(0, 0, canvasW, canvasH, radius);
      ctx.fillStyle = applyAlpha(color, alpha * 0.5);
      ctx.fill();

      ctx.strokeStyle = applyAlpha(color, isSelected ? 0.95 : alpha * 0.8);
      ctx.lineWidth = isSelected ? 3 * bodyScale : 2 * bodyScale;
      ctx.stroke();

      // Left accent strip
      const stripW = 5 * bodyScale;
      ctx.beginPath();
      ctx.roundRect(0, 0, stripW, canvasH, [radius, 0, 0, radius]);
      ctx.fillStyle = applyAlpha(color, dimmed ? 0.25 : 0.9);
      ctx.fill();

      if (isSelected) {
        ctx.shadowColor = applyAlpha(color, 0.6);
        ctx.shadowBlur = 12 * bodyScale;
        ctx.beginPath();
        ctx.roundRect(2, 2, canvasW - 4, canvasH - 4, radius);
        ctx.strokeStyle = applyAlpha(color, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      const bodyTexture = new THREE.CanvasTexture(canvas);
      bodyTexture.minFilter = THREE.LinearFilter;
      const bodyMaterial = new THREE.SpriteMaterial({ map: bodyTexture, transparent: true });
      const bodySprite = new THREE.Sprite(bodyMaterial);
      bodySprite.scale.set(nodeW / 6, nodeH / 6, 1);
      group.add(bodySprite);

      // -- External label --
      const shouldShowLabel =
        showLabels || isSelected || isNeighbor || isHovered ||
        node.emphasis * display.emphasisStrength > 0.2;

      if (shouldShowLabel) {
        const labelScale = 2;
        const fontSize = Math.round(13 * labelScale * Math.min(emphasisScale, 1.3));
        const labelCanvas = document.createElement("canvas");
        const labelCtx = labelCanvas.getContext("2d")!;

        labelCtx.font = `${isSelected ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
        const textWidth = labelCtx.measureText(node.name).width;
        const padX = 8 * labelScale;
        const padY = 4 * labelScale;
        labelCanvas.width = Math.round(textWidth + padX * 2);
        labelCanvas.height = Math.round(fontSize + padY * 2);

        // Background pill
        labelCtx.beginPath();
        labelCtx.roundRect(0, 0, labelCanvas.width, labelCanvas.height, 4 * labelScale);
        labelCtx.fillStyle = dimmed
          ? "rgba(240, 236, 228, 0.4)"
          : "rgba(250, 248, 243, 0.95)";
        labelCtx.fill();
        labelCtx.strokeStyle = applyAlpha(color, dimmed ? 0.08 : 0.25);
        labelCtx.lineWidth = 1;
        labelCtx.stroke();

        // Text -- use the LAYER COLOR for the label text
        labelCtx.font = `${isSelected ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
        labelCtx.fillStyle = dimmed
          ? applyAlpha(color, 0.25)
          : applyAlpha(color, 0.9);
        labelCtx.textAlign = "center";
        labelCtx.textBaseline = "middle";
        labelCtx.fillText(node.name, labelCanvas.width / 2, labelCanvas.height / 2);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        labelTexture.minFilter = THREE.LinearFilter;
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
        const labelSprite = new THREE.Sprite(labelMaterial);
        const scaleFactor = 5;
        const labelW = labelCanvas.width / (scaleFactor * labelScale) * display.nodeSize;
        const labelH = labelCanvas.height / (scaleFactor * labelScale) * display.nodeSize;
        labelSprite.scale.set(labelW, labelH, 1);
        labelSprite.position.set(0, -(nodeH / 6 / 2 + labelH / 2 + 0.5), 0);
        group.add(labelSprite);
      }

      return group;
    },
    [selectedNodeId, neighborSet, hoveredNodeId, display.nodeSize, display.emphasisStrength, showLabels]
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
    (link: GraphLink) => link.weight != null ? Math.abs(link.weight) * 2 + 0.5 : 1,
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

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNodeId(node?.id ?? null);
  }, []);

  // nodeThreeObject already has showLabels/selectedNodeId/hoveredNodeId in its
  // useCallback deps, so ForceGraph3D detects the callback change and re-renders

  // Set camera position on mount
  useEffect(() => {
    if (graphRef.current) {
      const fg = graphRef.current;
      fg.d3Force("charge")?.strength(-120);
      setTimeout(() => {
        fg.cameraPosition({ x: 200, y: -150, z: 300 }, { x: 0, y: -150, z: 0 }, 0);
      }, 100);
    }
  }, []);

  // Lock 2D view: disable rotation, only allow pan
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const controls = fg.controls();
    if (!controls) return;
    if (viewMode === "2d") {
      // Disable rotation entirely for 2D flat view
      controls.enableRotate = false;
      // screenSpacePanning: true makes vertical drag pan up/down (not along orbit plane)
      controls.screenSpacePanning = true;
      // Left-click drag = pan, scroll = zoom
      controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    } else {
      // 3D mode: normal orbit behavior
      controls.enableRotate = true;
      controls.screenSpacePanning = false;
      controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }
  }, [viewMode]);

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

  const handleToggleViewMode = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    if (viewMode === "3d") {
      setViewMode("2d");
      setDegreeActive(false);
      fg.cameraPosition({ x: 0, y: -400, z: 1 }, { x: 0, y: 0, z: 0 }, 600);
    } else {
      setViewMode("3d");
      setDegreeActive(false);
      fg.cameraPosition({ x: 250, y: centerY - 100, z: 350 }, { x: 0, y: centerY, z: 0 }, 600);
    }
  }, [viewMode, centerY]);

  const handleToggleDegree = useCallback(() => {
    if (!selectedNodeId) return;
    setDegreeActive((prev) => !prev);
  }, [selectedNodeId]);

  return (
    <div className="w-full h-full relative">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        controlType="orbit"
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
        onNodeHover={handleNodeHover as any}
        onBackgroundClick={handleBackgroundClick}
        backgroundColor="#f0ece4"
        showNavInfo={false}
        enableNodeDrag={true}
        warmupTicks={50}
        cooldownTicks={100}
      />

      {/* Top-right control bar */}
      <div className="absolute top-3 right-3 flex gap-1 bg-paper/80 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
        {/* 3D mode: camera presets on left of toggle */}
        {viewMode === "3d" && ([["iso", "Iso"], ["top", "Top"], ["front", "Front"], ["reset", "Reset"]] as const).map(
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

        {/* 2D mode: degree filter on left of toggle */}
        {viewMode === "2d" && selectedNodeId && (
          <>
            <button
              onClick={() => setDegreeFilter(Math.max(1, degreeFilter - 1))}
              className="w-5 h-5 flex items-center justify-center text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-darker rounded transition-colors"
            >
              -
            </button>
            <button
              onClick={handleToggleDegree}
              className={`px-1.5 py-0.5 text-xs font-bold rounded transition-colors ${
                degreeActive
                  ? "bg-accent text-white"
                  : "text-ink-muted hover:text-ink hover:bg-paper-darker"
              }`}
              title={degreeActive ? `Filtering to ${degreeFilter}-degree neighborhood` : `Click to filter to ${degreeFilter}-degree neighborhood`}
            >
              {degreeFilter}
            </button>
            <button
              onClick={() => setDegreeFilter(Math.min(5, degreeFilter + 1))}
              className="w-5 h-5 flex items-center justify-center text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-darker rounded transition-colors"
            >
              +
            </button>
          </>
        )}

        {/* Separator + view mode toggle (always rightmost) */}
        <div className="w-px bg-border mx-0.5" />
        <button
          onClick={handleToggleViewMode}
          className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
            viewMode === "2d"
              ? "bg-accent text-white"
              : "text-ink-muted hover:text-ink hover:bg-paper-darker"
          }`}
        >
          {viewMode === "2d" ? "2D" : "3D"}
        </button>
      </div>

      {/* Selection actions -- top left */}
      {selectedNodeId && (
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-paper/80 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
          <button
            onClick={() => { selectNode(null); setDegreeActive(false); }}
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

      {/* 2D degree filter indicator */}
      {viewMode === "2d" && degreeActive && selectedNodeId && (
        <div className="absolute top-12 right-3 bg-accent/90 text-white text-xs font-medium px-3 py-1 rounded-full shadow z-20">
          {degreeFilter}-degree neighborhood
        </div>
      )}
    </div>
  );
}

/** Convert an HSL or hex color string to an rgba/hsla string with the given alpha. */
function applyAlpha(color: string, alpha: number): string {
  if (color.startsWith("hsl")) {
    return color.replace(/\)$/, `, ${alpha})`).replace("hsl(", "hsla(");
  }
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
