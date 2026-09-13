import type { Extractor } from "../components/Rerun";
import { LEVELS, type Extraction } from "./schema";

/** Dev-only stand-in for the live API: returns a slightly perturbed copy of a bundled extraction after a delay. */
export function makeMockExtractor(bundledFor: (review: string) => Extraction | undefined): Extractor {
  return async (_apiKey, input) => {
    await new Promise((r) => setTimeout(r, 1500));
    const base = bundledFor(input.review);
    if (!base) throw new Error("mock: no bundled extraction for this review");
    const evidence = base.evidence.map((item, i) => {
      if (i !== 0) return item;
      const idx = Math.min(LEVELS.length - 1, LEVELS.indexOf(item.level) + 1);
      return { ...item, level: LEVELS[idx] };
    });
    return { extraction: { ...base, evidence, notes: [...base.notes, "(mock) live re-run"] }, dropped: [] };
  };
}
