import { useMemo } from "react";
import type { Node, Edge } from "../types";

interface EmphasisResult {
  scores: Map<string, number>;
  maxDegree: number;
  maxCrossLayerDegree: number;
}

/**
 * Compute emphasis scores for each node based on the selected metric.
 * Returns normalized scores (0-1) keyed by node ID.
 */
export function useNodeEmphasis(
  nodes: Node[],
  edges: Edge[],
  metric: string
): EmphasisResult {
  return useMemo(() => {
    const degrees = new Map<string, number>();
    const crossDegrees = new Map<string, number>();
    const nodeLayerMap = new Map<string, string>();

    // Build node → layer lookup
    for (const node of nodes) {
      nodeLayerMap.set(node.id, node.layerId);
      degrees.set(node.id, 0);
      crossDegrees.set(node.id, 0);
    }

    // Count degrees
    for (const edge of edges) {
      degrees.set(edge.fromNodeId, (degrees.get(edge.fromNodeId) || 0) + 1);
      degrees.set(edge.toNodeId, (degrees.get(edge.toNodeId) || 0) + 1);

      // Cross-layer
      const fromLayer = nodeLayerMap.get(edge.fromNodeId);
      const toLayer = nodeLayerMap.get(edge.toNodeId);
      if (fromLayer && toLayer && fromLayer !== toLayer) {
        crossDegrees.set(edge.fromNodeId, (crossDegrees.get(edge.fromNodeId) || 0) + 1);
        crossDegrees.set(edge.toNodeId, (crossDegrees.get(edge.toNodeId) || 0) + 1);
      }
    }

    const maxDegree = Math.max(1, ...degrees.values());
    const maxCrossLayerDegree = Math.max(1, ...crossDegrees.values());

    const scores = new Map<string, number>();

    for (const node of nodes) {
      const deg = degrees.get(node.id) || 0;
      const crossDeg = crossDegrees.get(node.id) || 0;
      let score: number;

      switch (metric) {
        case "degree":
          score = deg / maxDegree;
          break;
        case "crossLayer":
          score = crossDeg / maxCrossLayerDegree;
          break;
        case "combined":
          score = 0.5 * (deg / maxDegree) + 0.5 * (crossDeg / maxCrossLayerDegree);
          break;
        default: {
          // Check if metric is a numeric property
          const val = node.properties[metric];
          if (typeof val === "number") {
            const allVals = nodes
              .map((n) => n.properties[metric])
              .filter((v): v is number => typeof v === "number");
            const min = Math.min(...allVals);
            const max = Math.max(...allVals);
            score = max > min ? (val - min) / (max - min) : 0.5;
          } else {
            score = deg / maxDegree; // fallback
          }
        }
      }

      scores.set(node.id, score);
    }

    return { scores, maxDegree, maxCrossLayerDegree };
  }, [nodes, edges, metric]);
}
