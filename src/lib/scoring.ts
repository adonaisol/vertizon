import type { Dimension, EvidenceItem, Level } from "./schema";

export const LEVEL_VALUE: Record<Level, number> = {
  well_below: -2, below: -1, at: 0, above: 1, well_above: 2,
};

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Evidence-implied rating on the 1-4 scale. Continuous. Null when there is no evidence. */
export function strength(evidence: EvidenceItem[]): number | null {
  if (evidence.length === 0) return null;
  const byDim = new Map<Dimension, number[]>();
  for (const e of evidence) {
    const arr = byDim.get(e.dimension) ?? [];
    arr.push(LEVEL_VALUE[e.level]);
    byDim.set(e.dimension, arr);
  }
  const dimMeans = [...byDim.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
  const mean = dimMeans.reduce((a, b) => a + b, 0) / dimMeans.length;
  return clamp(2 + mean, 1, 4);
}

export function ratingLabel(x: number, ratings: { value: number; label: string }[]): string {
  const v = clamp(Math.round(x), 1, 4);
  return ratings.find((r) => r.value === v)?.label ?? String(v);
}
