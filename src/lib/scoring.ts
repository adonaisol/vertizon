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

export type Point = { x: number; y: number };
export type Fit = { a: number; b: number; n: number; s: number; xbar: number; sxx: number };
export const SHRINK_K = 3;

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

export function olsFit(points: Point[]): { a: number; b: number; xbar: number; sxx: number } | null {
  if (points.length < 2) return null;
  const xbar = mean(points.map((p) => p.x));
  const ybar = mean(points.map((p) => p.y));
  let sxx = 0, sxy = 0;
  for (const p of points) { sxx += (p.x - xbar) ** 2; sxy += (p.x - xbar) * (p.y - ybar); }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: ybar - b * xbar, b, xbar, sxx };
}

function residualSE(points: Point[], a: number, b: number): number {
  const df = Math.max(points.length - 2, 1);
  const ss = points.reduce((acc, p) => acc + (p.y - (a + b * p.x)) ** 2, 0);
  return Math.sqrt(ss / df);
}

export function pooledFit(points: Point[]): Fit | null {
  const f = olsFit(points);
  if (!f) return null;
  return { ...f, n: points.length, s: residualSE(points, f.a, f.b) };
}

/** A manager's fit, shrunk toward the pooled fit with weight n/(n+k). */
export function managerFit(own: Point[], pooled: Fit | null): Fit | null {
  const n = own.length;
  if (n === 0) return null;
  const w = n / (n + SHRINK_K);
  const ownFit = olsFit(own);
  const xbar = mean(own.map((p) => p.x));
  const ybar = mean(own.map((p) => p.y));
  // Fallback when the pooled fit is unavailable: a horizontal line at the manager's mean rating.
  const base = pooled ?? { a: ybar, b: 0, n, s: 0, xbar, sxx: 1 };
  let a: number, b: number;
  if (ownFit) {
    a = w * ownFit.a + (1 - w) * base.a;
    b = w * ownFit.b + (1 - w) * base.b;
  } else {
    // slope undefined: use the base slope, shrink the intercept implied by the manager's mean
    b = base.b;
    a = w * (ybar - b * xbar) + (1 - w) * base.a;
  }
  const sxx = ownFit ? ownFit.sxx : base.sxx;
  const s = n >= 3 ? residualSE(own, a, b) : base.s;
  return { a, b, n, s, xbar, sxx };
}

export function impliedRating(x: number, fit: Fit): { estimate: number; low: number; high: number; halfWidth: number } {
  const estimate = fit.a + fit.b * x;
  const se = fit.s * Math.sqrt(1 / fit.n + (x - fit.xbar) ** 2 / fit.sxx);
  const halfWidth = Math.max(0.5, se);
  return { estimate, halfWidth, low: clamp(estimate - halfWidth, 1, 4), high: clamp(estimate + halfWidth, 1, 4) };
}
