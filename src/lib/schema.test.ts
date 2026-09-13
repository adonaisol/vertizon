import { describe, it, expect } from "vitest";
import { ExtractionSchema, filterQuotes, type Extraction } from "./schema";

const base: Extraction = {
  strength: 3,
  sufficiency: "high",
  evidence: [
    { quote: "led the migration", dimension: "impact", level: "above", rationale: "r" },
    { quote: "not in the text", dimension: "craft", level: "at", rationale: "r" },
  ],
  notes: [],
};

describe("ExtractionSchema", () => {
  it("accepts a valid extraction", () => {
    expect(ExtractionSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a bad level", () => {
    const bad = { ...base, evidence: [{ ...base.evidence[0], level: "great" }] };
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects strength outside 1-4", () => {
    expect(ExtractionSchema.safeParse({ ...base, strength: 5 }).success).toBe(false);
  });
});

describe("filterQuotes", () => {
  const review = "This year she led the migration of billing.";
  it("drops quotes that are not verbatim substrings", () => {
    const { extraction, dropped } = filterQuotes(base, review);
    expect(extraction.evidence.map((e) => e.quote)).toEqual(["led the migration"]);
    expect(dropped).toEqual(["not in the text"]);
  });
  it("forces sufficiency to low when every quote is dropped", () => {
    const { extraction } = filterQuotes({ ...base, evidence: [base.evidence[1]] }, review);
    expect(extraction.sufficiency).toBe("low");
    expect(extraction.evidence).toEqual([]);
  });
  it("matches quotes case-sensitively but ignores surrounding whitespace", () => {
    const ex = { ...base, evidence: [{ ...base.evidence[0], quote: "  led the migration " }] };
    expect(filterQuotes(ex, review).extraction.evidence[0].quote).toBe("led the migration");
  });
});
