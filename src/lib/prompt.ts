import type { Rubric } from "./schema";

export type ExtractionInput = { rubric: Rubric; level: "L3" | "L4" | "L5"; review: string; rating: 1 | 2 | 3 | 4 };

export function buildExtractionPrompt(input: ExtractionInput): { system: string; user: string } {
  const { rubric, level, review, rating } = input;
  const ratingLabel = rubric.ratings.find((r) => r.value === rating)?.label ?? String(rating);

  const system = `You are helping a performance-calibration facilitator check whether written reviews support their ratings.

You will get one rubric (four dimensions, with the bar for the employee's level), one written review, and the rating the manager gave.

Your job:
1. Extract every concrete piece of evidence about the employee's work. Each item must be a verbatim quote copied exactly from the review text, tagged with one rubric dimension and a level relative to the bar for this employee's level: well_below, below, at, above, well_above.
2. Judge the work described, not the quality of the writing. Rough grammar, short sentences, or awkward phrasing say nothing about the employee. Enthusiastic adjectives without a concrete example are not evidence.
3. Set "sufficiency" to how much the text supports any conclusion: high (several concrete examples across dimensions), medium (some concrete examples), low (little or nothing concrete). When the review gives too little to judge, return low sufficiency rather than guessing.
4. Set "strength" to the rating (1 Below, 2 Meets, 3 Exceeds, 4 Greatly Exceeds) that the evidence alone would justify. Do not anchor on the manager's rating; it is provided only so you can note in "notes" if the text contradicts it.
5. Put anything unusual in "notes": contradictory evidence, the review contradicting itself, praise with no examples, unclear passages.

Only quote text that appears verbatim in the review. Do not paraphrase inside "quote".`;

  const bars = rubric.dimensions
    .map((d) => `${d.name} (${d.id})\n  below the bar: ${d.bars[level]!.below}\n  at the bar: ${d.bars[level]!.at}\n  above the bar: ${d.bars[level]!.above}`)
    .join("\n\n");

  const user = `Employee level: ${level}

Rubric bars for ${level}:

${bars}

Rating scale: ${rubric.ratings.map((r) => `${r.value} = ${r.label}`).join(", ")}

Manager's rating: ${rating} (${ratingLabel})

Review text:
<review>
${review}
</review>`;

  return { system, user };
}
