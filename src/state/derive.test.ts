import { describe, it, expect } from "vitest";
import { derive } from "./derive";
import { loadData } from "../lib/data";
import type { Overrides } from "./overrides";

describe("derive", () => {
  const { rubric, managers, employees } = loadData();
  it("produces a fit for every manager with usable points and an agenda row per employee", () => {
    const d = derive(employees, managers, rubric, {});
    expect(d.agenda).toHaveLength(employees.length);
    expect(Object.keys(d.fits)).toHaveLength(managers.length);
  });
  it("an override moves the employee's strength", () => {
    const target = employees.find((e) => e.extraction.evidence.length > 0 && e.extraction.evidence[0].level !== "well_below")!;
    const before = derive(employees, managers, rubric, {}).strengthById[target.id];
    const after = derive(employees, managers, rubric, { [`${target.id}:0`]: "well_below" } as Overrides).strengthById[target.id];
    expect(after).not.toEqual(before);
  });
});
