import { describe, it, expect } from "vitest";
import { overridesReducer, effectiveEvidence, countOverrides } from "./overrides";
import type { Employee } from "../lib/data";

const emp = {
  id: "e01", name: "A", level: "L4", managerId: "m1", rating: 3, review: "x",
  manager: { id: "m1", name: "M", style: "calibrated" },
  strengthByRun: [3, 3, 3],
  extraction: { strength: 3, sufficiency: "high", notes: [], evidence: [
    { quote: "a", dimension: "impact", level: "above", rationale: "" },
    { quote: "b", dimension: "craft", level: "at", rationale: "" },
  ] },
} as Employee;

describe("overrides", () => {
  it("sets and applies an override", () => {
    const s = overridesReducer({}, { type: "set", employeeId: "e01", index: 1, level: "well_above" });
    expect(effectiveEvidence(emp, s)[1].level).toBe("well_above");
    expect(effectiveEvidence(emp, s)[0].level).toBe("above");
    expect(countOverrides(s)).toBe(1);
  });
  it("resets one employee and all", () => {
    let s = overridesReducer({}, { type: "set", employeeId: "e01", index: 0, level: "below" });
    s = overridesReducer(s, { type: "set", employeeId: "e02", index: 0, level: "below" });
    expect(countOverrides(overridesReducer(s, { type: "resetEmployee", employeeId: "e01" }))).toBe(1);
    expect(countOverrides(overridesReducer(s, { type: "resetAll" }))).toBe(0);
  });
});
