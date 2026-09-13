import type { Employee } from "../lib/data";
import type { Manager, Rubric } from "../lib/schema";
import { agenda, managerFit, managerSummary, pooledFit, strength, usablePoints, type AgendaRow, type Fit, type Scored } from "../lib/scoring";
import { effectiveEvidence, type Overrides } from "./overrides";

export type Derived = {
  scored: Scored[];
  fits: Record<string, Fit | null>;
  pooled: Fit | null;
  agenda: AgendaRow[];
  summaries: Record<string, string>;
  strengthById: Record<string, number | null>;
};

export function derive(employees: Employee[], managers: Manager[], rubric: Rubric, overrides: Overrides): Derived {
  const scored: Scored[] = employees.map((e) => ({
    id: e.id, name: e.name, managerId: e.managerId, rating: e.rating,
    strength: strength(effectiveEvidence(e, overrides)),
    sufficiency: e.extraction.sufficiency,
  }));
  const pooled = pooledFit(usablePoints(scored));
  const fits: Record<string, Fit | null> = {};
  const summaries: Record<string, string> = {};
  for (const m of managers) {
    const own = scored.filter((s) => s.managerId === m.id);
    fits[m.id] = managerFit(usablePoints(own), pooled);
    summaries[m.id] = managerSummary(fits[m.id], own);
  }
  const strengthById = Object.fromEntries(scored.map((s) => [s.id, s.strength]));
  return { scored, fits, pooled, agenda: agenda(scored, rubric.ratings), summaries, strengthById };
}
