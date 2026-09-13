import type { Dimension, EvidenceItem, Level, Sufficiency } from "./schema";

export const LEVEL_VALUE: Record<Level, number> = {
  well_below: -2, below: -1, at: 0, above: 1, well_above: 2,
};

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Mean LEVEL_VALUE per dimension present in the evidence. */
export function dimensionMeans(evidence: EvidenceItem[]): Partial<Record<Dimension, number>> {
  const byDim = new Map<Dimension, number[]>();
  for (const e of evidence) {
    const arr = byDim.get(e.dimension) ?? [];
    arr.push(LEVEL_VALUE[e.level]);
    byDim.set(e.dimension, arr);
  }
  const out: Partial<Record<Dimension, number>> = {};
  for (const [dim, vals] of byDim) out[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
  return out;
}

function spreadOfMeans(means: Partial<Record<Dimension, number>>): number {
  const vals = Object.values(means) as number[];
  return vals.length < 2 ? 0 : Math.max(...vals) - Math.min(...vals);
}

/** Max − min of dimensionMeans; 0 when fewer than 2 dimensions are present. */
export function dimensionSpread(evidence: EvidenceItem[]): number {
  return spreadOfMeans(dimensionMeans(evidence));
}

function describeMean(m: number): string {
  if (m >= 1.5) return "well above";
  if (m >= 0.5) return "above";
  if (m <= -1.5) return "well below";
  if (m <= -0.5) return "below";
  return "at";
}

/** Evidence-implied rating on the 1-4 scale. Continuous. Null when there is no evidence. */
export function strength(evidence: EvidenceItem[]): number | null {
  if (evidence.length === 0) return null;
  const dimMeans = Object.values(dimensionMeans(evidence)) as number[];
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

export type Scored = { id: string; name: string; managerId: string; rating: number; strength: number | null; sufficiency: Sufficiency; dims: Partial<Record<Dimension, number>> };
export type AgendaGroup = "discuss" | "more_input" | "consistent";
export type AgendaRow = { id: string; group: AgendaGroup; gap: number; reason: string };

export function usablePoints(rows: Scored[]): Point[] {
  return rows.filter((r) => r.sufficiency !== "low" && r.strength !== null).map((r) => ({ x: r.strength as number, y: r.rating }));
}

export function agenda(rows: Scored[], ratings: { value: number; label: string }[]): AgendaRow[] {
  const out: AgendaRow[] = rows.map((r) => {
    if (r.sufficiency === "low" || r.strength === null) {
      return { id: r.id, group: "more_input", gap: 0, reason: "Review gives too little evidence to judge." };
    }
    if (spreadOfMeans(r.dims) >= 2) {
      const entries = Object.entries(r.dims) as [Dimension, number][];
      const hi = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
      const lo = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
      return {
        id: r.id, group: "discuss", gap: r.rating - r.strength,
        reason: `Uneven profile: ${hi[0]} ${describeMean(hi[1])} the bar, ${lo[0]} ${describeMean(lo[1])} the bar.`,
      };
    }
    const gap = r.rating - r.strength;
    const rated = ratingLabel(r.rating, ratings);
    const ev = ratingLabel(r.strength, ratings);
    if (Math.abs(gap) >= 1) {
      return { id: r.id, group: "discuss", gap, reason: `Rated ${rated}; evidence reads as ${ev}.` };
    }
    return { id: r.id, group: "consistent", gap, reason: `Rated ${rated}; evidence agrees.` };
  });
  const order: Record<AgendaGroup, number> = { discuss: 0, more_input: 1, consistent: 2 };
  return out.sort((p, q) => order[p.group] - order[q.group] || Math.abs(q.gap) - Math.abs(p.gap));
}

export function managerSummary(fit: Fit | null, own: Scored[]): string {
  if (!fit) return "not enough evidence to infer this manager's bar";
  const usable = own.filter((r) => r.sufficiency !== "low" && r.strength !== null);
  const offset = usable.length ? mean(usable.map((r) => r.rating - (r.strength as number))) : 0;
  if (Math.abs(offset) >= 0.3) {
    const sign = offset > 0 ? "+" : "−";
    return `runs ${sign}${Math.abs(offset).toFixed(1)} ${offset > 0 ? "above" : "below"} evidence`;
  }
  if (fit.b >= 1.3) return "stretches the scale: harsh at the bottom, generous at the top";
  if (fit.b <= 0.7) return "compresses the scale: rates everyone near the middle";
  return "on the diagonal";
}
