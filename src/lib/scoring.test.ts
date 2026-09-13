import { describe, it, expect } from "vitest";
import { strength, ratingLabel } from "./scoring";
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
