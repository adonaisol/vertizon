import type { EvidenceItem, Level } from "../lib/schema";
import type { Employee } from "../lib/data";

export type OverrideKey = `${string}:${number}`;
export type Overrides = Record<OverrideKey, Level>;
export type OverrideAction =
  | { type: "set"; employeeId: string; index: number; level: Level }
  | { type: "resetEmployee"; employeeId: string }
  | { type: "resetAll" };

export function overridesReducer(state: Overrides, action: OverrideAction): Overrides {
  switch (action.type) {
    case "set":
      return { ...state, [`${action.employeeId}:${action.index}`]: action.level };
    case "resetEmployee":
      return Object.fromEntries(Object.entries(state).filter(([k]) => !k.startsWith(`${action.employeeId}:`))) as Overrides;
    case "resetAll":
      return {};
  }
}

export function effectiveEvidence(emp: Employee, overrides: Overrides): EvidenceItem[] {
  return emp.extraction.evidence.map((item, i) => {
    const o = overrides[`${emp.id}:${i}`];
    return o ? { ...item, level: o } : item;
  });
}

export function countOverrides(overrides: Overrides): number {
  return Object.keys(overrides).length;
}
