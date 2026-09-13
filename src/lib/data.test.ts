import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EmployeesFileSchema, RubricSchema } from "./schema";

const employees = EmployeesFileSchema.parse(JSON.parse(readFileSync("data/employees.json", "utf8")));
const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));

describe("employees.json", () => {
  it("has 6 managers with distinct styles and 30 employees, 5 per manager", () => {
    expect(employees.managers).toHaveLength(6);
    expect(new Set(employees.managers.map((m) => m.style)).size).toBe(6);
    expect(employees.employees).toHaveLength(30);
    for (const m of employees.managers) {
      expect(employees.employees.filter((e) => e.managerId === m.id)).toHaveLength(5);
    }
  });
  it("has unique ids and names", () => {
    expect(new Set(employees.employees.map((e) => e.id)).size).toBe(30);
    expect(new Set(employees.employees.map((e) => e.name)).size).toBe(30);
  });
  it("plants each case type at least once, none on the terse manager", () => {
    const terse = employees.managers.find((m) => m.style === "terse")!.id;
    const plants = employees.employees.filter((e) => e.plant);
    expect(new Set(plants.map((e) => e.plant)).size).toBe(4);
    expect(plants.every((e) => e.managerId !== terse)).toBe(true);
  });
  it("terse reviews are short, verbose reviews are long", () => {
    const byStyle = (s: string) => employees.employees.filter((e) => e.managerId === employees.managers.find((m) => m.style === s)!.id);
    for (const e of byStyle("terse")) expect(e.review.split(/\s+/).length).toBeLessThan(45);
    for (const e of byStyle("verbose")) expect(e.review.split(/\s+/).length).toBeGreaterThan(180);
  });
  it("rubric has 4 dimensions with all three levels", () => {
    expect(rubric.dimensions).toHaveLength(4);
    for (const d of rubric.dimensions) expect(Object.keys(d.bars).sort()).toEqual(["L3", "L4", "L5"]);
  });
});
