import { describe, it, expect } from "vitest";
import { strength, ratingLabel, olsFit, pooledFit, managerFit, impliedRating, dimensionMeans, dimensionSpread, type Point } from "./scoring";
import { agenda, managerSummary, usablePoints, type Scored } from "./scoring";
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

describe("dimensionMeans", () => {
  it("averages within each dimension present", () => {
    const items = [ev("impact", "above"), ev("impact", "well_above"), ev("collaboration", "well_below")];
    expect(dimensionMeans(items)).toEqual({ impact: 1.5, collaboration: -2 });
  });
  it("is empty with no evidence", () => {
    expect(dimensionMeans([])).toEqual({});
  });
});

describe("dimensionSpread", () => {
  it("is the max minus the min of the dimension means", () => {
    const items = [ev("impact", "above"), ev("collaboration", "well_below")];
    expect(dimensionSpread(items)).toBe(3);
  });
  it("is 0 with fewer than 2 dimensions", () => {
    expect(dimensionSpread([ev("impact", "above")])).toBe(0);
    expect(dimensionSpread([])).toBe(0);
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

const S = (id: string, rating: number, strength: number | null, sufficiency: Scored["sufficiency"] = "high"): Scored =>
  ({ id, name: id, managerId: "m1", rating, strength, sufficiency, dims: {} });

describe("usablePoints", () => {
  it("keeps only rows with sufficiency != low and non-null strength", () => {
    const rows = [S("a", 3, 2, "high"), S("b", 2, null, "high"), S("c", 2, 1.5, "low"), S("d", 4, 3, "medium")];
    expect(usablePoints(rows)).toEqual([{ x: 2, y: 3 }, { x: 3, y: 4 }]);
  });
});

describe("agenda", () => {
  it("groups and orders rows", () => {
    const rows = agenda([S("a", 3, 2), S("b", 2, 2.1), S("c", 2, 1.5, "low"), S("d", 4, 2)], RATINGS);
    expect(rows.map((r) => [r.id, r.group])).toEqual([
      ["d", "discuss"], ["a", "discuss"], ["c", "more_input"], ["b", "consistent"],
    ]);
  });
  it("writes a reason sentence", () => {
    const [row] = agenda([S("a", 3, 2)], RATINGS);
    expect(row.reason).toBe("Rated Exceeds; evidence reads as Meets.");
    const [more] = agenda([S("c", 2, 1.5, "low")], RATINGS);
    expect(more.reason).toBe("Review gives too little evidence to judge.");
  });
  it("treats null strength as more_input", () => {
    expect(agenda([S("z", 2, null, "high")], RATINGS)[0].group).toBe("more_input");
  });
  it("flags an uneven dimension profile as discuss even when the gap is zero", () => {
    const row = { ...S("u", 2, 2), dims: { impact: 1, collaboration: -2 } };
    const [r] = agenda([row], RATINGS);
    expect(r.group).toBe("discuss");
    expect(r.gap).toBe(0);
    expect(r.reason).toBe("Uneven profile: impact above the bar, collaboration well below the bar.");
  });
  it("does not trigger the uneven-profile rule when spread is under 2", () => {
    const row = { ...S("v", 2, 2), dims: { impact: 1, craft: 0.5 } };
    const [r] = agenda([row], RATINGS);
    expect(r.group).toBe("consistent");
  });
});

describe("managerSummary", () => {
  it("describes offset", () => {
    const own = [S("a", 3, 2), S("b", 4, 3), S("c", 3, 2.2)];
    expect(managerSummary({ a: 1, b: 1, n: 3, s: 0.1, xbar: 2.4, sxx: 1 }, own)).toBe("runs +0.9 above evidence");
  });
  it("describes slope when offset is small", () => {
    const own = [S("a", 1, 2), S("b", 4, 3)];
    expect(managerSummary({ a: -3, b: 2, n: 2, s: 0.1, xbar: 2.5, sxx: 1 }, own)).toBe("stretches the scale: harsh at the bottom, generous at the top");
  });
  it("says on the diagonal otherwise", () => {
    expect(managerSummary({ a: 0.1, b: 1, n: 5, s: 0.1, xbar: 2.5, sxx: 1 }, [S("a", 2, 2)])).toBe("on the diagonal");
  });
  it("handles no fit", () => {
    expect(managerSummary(null, [])).toBe("not enough evidence to infer this manager's bar");
  });
});
