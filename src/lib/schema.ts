// Imports from "zod/v4" (not the bare "zod" v3-compat export) because the Anthropic SDK's
// `zodOutputFormat` helper (src/lib/anthropic.ts) requires zod-v4-core schema objects at runtime.
import { z } from "zod/v4";

export const LEVELS = ["well_below", "below", "at", "above", "well_above"] as const;
export const DIMENSIONS = ["impact", "craft", "collaboration", "ownership"] as const;
export const SUFFICIENCIES = ["low", "medium", "high"] as const;
export const MANAGER_STYLES = ["calibrated", "lenient", "harsh", "verbose", "nonnative", "terse"] as const;
export const PLANTS = ["over_rated", "under_rated", "contradictory", "self_contradicting"] as const;

export type Level = (typeof LEVELS)[number];
export type Dimension = (typeof DIMENSIONS)[number];
export type Sufficiency = (typeof SUFFICIENCIES)[number];
export type ManagerStyle = (typeof MANAGER_STYLES)[number];
export type Plant = (typeof PLANTS)[number];

const Rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const LevelKey = z.enum(["L3", "L4", "L5"]);

export const EvidenceItemSchema = z.object({
  quote: z.string().min(1),
  dimension: z.enum(DIMENSIONS),
  level: z.enum(LEVELS),
  rationale: z.string(),
});

/** API-facing shape: only types/enums that every JSON-schema consumer accepts. */
export const ExtractionOutputSchema = z.object({
  strength: z.number().int(),
  sufficiency: z.enum(SUFFICIENCIES),
  evidence: z.array(EvidenceItemSchema),
  notes: z.array(z.string()),
});

/** Validation shape used everywhere else. */
export const ExtractionSchema = ExtractionOutputSchema.refine(
  (e) => e.strength >= 1 && e.strength <= 4,
  { message: "strength must be 1-4", path: ["strength"] },
);

export const RubricSchema = z.object({
  dimensions: z.array(
    z.object({
      id: z.enum(DIMENSIONS),
      name: z.string(),
      bars: z.record(LevelKey, z.object({ below: z.string(), at: z.string(), above: z.string() })),
    }),
  ),
  ratings: z.array(z.object({ value: Rating, label: z.string() })),
});

export const ManagerSchema = z.object({ id: z.string(), name: z.string(), style: z.enum(MANAGER_STYLES) });

export const EmployeeRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: LevelKey,
  managerId: z.string(),
  rating: Rating,
  review: z.string(),
  plant: z.enum(PLANTS).optional(),
});

export const EmployeesFileSchema = z.object({
  managers: z.array(ManagerSchema),
  employees: z.array(EmployeeRecordSchema),
});

export const ExtractionRecordSchema = z.object({
  employeeId: z.string(),
  model: z.string(),
  extraction: ExtractionSchema,
  strengthByRun: z.array(z.number()),
  droppedQuotes: z.array(z.string()),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type Extraction = z.infer<typeof ExtractionOutputSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type Manager = z.infer<typeof ManagerSchema>;
export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;
export type EmployeesFile = z.infer<typeof EmployeesFileSchema>;
export type ExtractionRecord = z.infer<typeof ExtractionRecordSchema>;

/** Keep only evidence whose quote is a verbatim substring of the review. */
export function filterQuotes(ex: Extraction, review: string): { extraction: Extraction; dropped: string[] } {
  const dropped: string[] = [];
  const evidence: EvidenceItem[] = [];
  for (const item of ex.evidence) {
    const quote = item.quote.trim();
    if (quote.length > 0 && review.includes(quote)) evidence.push({ ...item, quote });
    else dropped.push(item.quote);
  }
  const sufficiency = evidence.length === 0 ? "low" : ex.sufficiency;
  return { extraction: { ...ex, evidence, sufficiency }, dropped };
}
