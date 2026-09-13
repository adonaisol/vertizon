import { describe, it, expect } from "vitest";
import { stability, quoteFidelity } from "./eval-checks";
import type { ExtractionRecord } from "../src/lib/schema";

const rec = (id: string, runs: number[], dropped: string[] = []): ExtractionRecord => ({
  employeeId: id, model: "m", strengthByRun: runs, droppedQuotes: dropped,
  extraction: { strength: runs[0], sufficiency: "high", evidence: [{ quote: "q", dimension: "impact", level: "at", rationale: "" }], notes: [] },
});

describe("stability", () => {
  it("counts identical runs and spread histogram", () => {
    const s = stability([rec("a", [2, 2, 2]), rec("b", [2, 3, 2]), rec("c", [1, 3, 2])]);
    expect(s.identical).toBe(1);
    expect(s.total).toBe(3);
    expect(s.maxSpread).toEqual({ 0: 1, 1: 1, 2: 1 });
  });
});

describe("quoteFidelity", () => {
  it("counts kept vs dropped quotes across runs", () => {
    const q = quoteFidelity([rec("a", [2, 2, 2], ["x"]), rec("b", [2, 2, 2])]);
    expect(q.dropped).toBe(1);
    expect(q.kept).toBe(2); // one evidence item per canonical extraction
  });
});
