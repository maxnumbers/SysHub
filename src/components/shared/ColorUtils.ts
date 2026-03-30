/**
 * Auto-distribute layer colors around the HSL wheel.
 * Muted saturation to complement the sepia/paper theme.
 */
export function getLayerColors(count: number): string[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const hue = (i / count) * 360;
    return `hsl(${Math.round(hue)}, 65%, 45%)`;
  });
}

/** Get a single layer's color given its index and total count, respecting overrides. */
export function getLayerColor(
  index: number,
  total: number,
  colorOverride: string | null
): string {
  if (colorOverride) return colorOverride;
  const hue = (index / total) * 360;
  return `hsl(${Math.round(hue)}, 65%, 45%)`;
}

/** Get a desaturated edge type color (separate palette from layers). */
export function getEdgeTypeColor(index: number, total: number): string {
  if (total === 0) return "hsl(0, 0%, 60%)";
  // Offset by 30° from layer colors to avoid overlap
  const hue = ((index / total) * 360 + 30) % 360;
  return `hsl(${Math.round(hue)}, 35%, 55%)`;
}

/** Parse HSL string to components */
export function parseHSL(hsl: string): { h: number; s: number; l: number } | null {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return null;
  return { h: parseInt(match[1]), s: parseInt(match[2]), l: parseInt(match[3]) };
}

/** Convert HSL to a hex string for Three.js */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
