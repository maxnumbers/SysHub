import { useMemo } from "react";
import type { Layer } from "../types";
import { getLayerColor } from "../components/shared/ColorUtils";

/** Returns a map of layerId → color string for all layers in the graph. */
export function useLayerColors(layers: Layer[]): Map<string, string> {
  return useMemo(() => {
    const sorted = [...layers].sort((a, b) => a.order - b.order);
    const map = new Map<string, string>();
    sorted.forEach((layer, idx) => {
      map.set(layer.id, getLayerColor(idx, sorted.length, layer.colorOverride));
    });
    return map;
  }, [layers]);
}
