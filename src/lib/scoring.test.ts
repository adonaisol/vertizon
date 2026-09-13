import { describe, it, expect } from "vitest";
import { strength, ratingLabel, olsFit, pooledFit, managerFit, impliedRating, type Point } from "./scoring";
import type { EvidenceItem } from "./schema";

const ev = (dimension: EvidenceItem["dimension"], level: EvidenceItem["level"]): EvidenceItem => ({
  quote: "q", dimension, level, rationale: "",
});
const RATINGS = [
  { value: 1, label: "Below" }, { value: 2, label: "Meets" }, { value: 3, label: "Exceeds" }, { value: 4, label: "Greatly Exceeds" },
];

describe("strength", () => {
  it("is 2 when everything is at the bar", () => {
    expect(strength([ev("impact", "at"), ev("craft", "at")])).toBe(2);
  });
  it("is 4 when everything is well above", () => {
    expect(strength([ev("impact", "well_above"), ev("ownership", "well_above")])).toBe(4);
  });
  it("is 3 when everything is above", () => {
    expect(strength([ev("impact", "above")])).toBe(3);
  });
  it("averages within a dimension before averaging across dimensions", () => {
    // impact: 3 quotes all "above" (+1 each) -> +1 ; craft: one "below" (-1) -> mean 0 -> 2
    const items = [ev("impact", "above"), ev("impact", "above"), ev("impact", "above"), ev("craft", "below")];
    expect(strength(items)).toBe(2);
  });
  it("clamps to [1,4]", () => {
    expect(strength([ev("impact", "well_below"), ev("craft", "well_below")])).toBe(1);
  });
  it("returns null with no evidence", () => {
    expect(strength([])).toBeNull();
  });
});

describe("ratingLabel", () => {
  it("rounds to the nearest rating", () => {
    expect(ratingLabel(2.4, RATINGS)).toBe("Meets");
    expect(ratingLabel(2.6, RATINGS)).toBe("Exceeds");
  });
});

const diag: Point[] = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 2.5, y: 2.5 }];

describe("olsFit", () => {
  it("recovers a perfect line", () => {
    const f = olsFit(diag)!;
    expect(f.b).toBeCloseTo(1);
    expect(f.a).toBeCloseTo(0);
  });
  it("returns null for n<2 or constant x", () => {
    expect(olsFit([{ x: 2, y: 3 }])).toBeNull();
    expect(olsFit([{ x: 2, y: 3 }, { x: 2, y: 1 }])).toBeNull();
  });
});

describe("managerFit", () => {
  const pooled = pooledFit(diag)!;
  it("shrinks toward the pooled fit with weight n/(n+3)", () => {
    // own: 5 points, all rated +1 above evidence -> own a=1, b=1 ; pooled a=0,b=1
    const own = diag.map((p) => ({ x: p.x, y: Math.min(4, p.y + 1) })).filter((p) => p.y <= 4);
    const f = managerFit(own, pooled)!;
    const w = own.length / (own.length + 3);
    const ownFit = olsFit(own)!;
    expect(f.b).toBeCloseTo(w * ownFit.b + (1 - w) * pooled.b);
    expect(f.a).toBeCloseTo(w * ownFit.a + (1 - w) * pooled.a);
    expect(f.n).toBe(own.length);
  });
  it("uses the pooled slope when own x is constant, keeps own n", () => {
    const f = managerFit([{ x: 2, y: 3 }, { x: 2, y: 4 }], pooled)!;
    expect(f.b).toBeCloseTo(pooled.b);
    expect(f.n).toBe(2);
  });
  it("returns null with no usable points", () => {
    expect(managerFit([], pooled)).toBeNull();
  });
  it("falls back to pooled s and sxx when n < 3", () => {
    const f = managerFit([{ x: 2, y: 2 }], pooled)!;
    expect(f.s).toBeCloseTo(pooled.s);
    expect(f.sxx).toBeCloseTo(pooled.sxx);
  });
});

describe("impliedRating", () => {
  const fit = { a: 0, b: 1, n: 5, s: 0.4, xbar: 2.5, sxx: 5 };
  it("floors the half-width at 0.5", () => {
    const r = impliedRating(2.5, fit);
    expect(r.estimate).toBeCloseTo(2.5);
    expect(r.halfWidth).toBe(0.5);
  });
  it("widens when extrapolating away from xbar", () => {
    const wide = { ...fit, s: 1.2 };
    expect(impliedRating(4, wide).halfWidth).toBeGreaterThan(impliedRating(2.5, wide).halfWidth);
  });
  it("clamps the range to [1,4]", () => {
    const r = impliedRating(4, fit);
    expect(r.high).toBeLessThanOrEqual(4);
    expect(r.low).toBeGreaterThanOrEqual(1);
  });
});
