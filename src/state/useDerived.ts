import { useMemo } from "react";
import { derive, type Derived } from "./derive";
import type { Employee } from "../lib/data";
import type { Manager, Rubric } from "../lib/schema";
import type { Overrides } from "./overrides";

export function useDerived(employees: Employee[], managers: Manager[], rubric: Rubric, overrides: Overrides): Derived {
  return useMemo(() => derive(employees, managers, rubric, overrides), [employees, managers, rubric, overrides]);
}
