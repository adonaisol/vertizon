import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z as z4 } from "zod/v4";
import { ExtractionSchema, DIMENSIONS, LEVELS, SUFFICIENCIES, filterQuotes, type Extraction } from "./schema";
import { buildExtractionPrompt, type ExtractionInput } from "./prompt";

export const MODEL = "claude-opus-5";

/**
 * `zodOutputFormat` (in the installed @anthropic-ai/sdk@0.125.0) is built against the
 * zod v4 core (`import * as z from "zod/v4"` internally) and calls `z.toJSONSchema(zodObject, ...)`
 * on whatever schema it is given. The project's `schema.ts` builds `ExtractionOutputSchema`
 * with `import { z } from "zod"`, which on the installed zod@3.25.76 resolves to the legacy
 * v3-compatible implementation (`zod/v3`), not the v4 core. Passing that v3 schema object
 * into `zodOutputFormat` fails at RUNTIME (not just a type error): `z.toJSONSchema` reads
 * `._zod.def` off the object, which v3 schema instances don't have, throwing
 * "Cannot read properties of undefined (reading 'def')". Verified empirically against the
 * installed packages (see task-7-report.md).
 *
 * The fix is to hand `zodOutputFormat` a schema built from `zod/v4` instead. This mirrors
 * the shape of `ExtractionOutputSchema` (API-facing: plain types/enums, `strength` as a bare
 * int) purely for JSON-schema generation and for populating `response.parsed_output`. The
 * actual validation of that parsed output still goes through the canonical `ExtractionSchema`
 * (built with the project's v3 zod in `schema.ts`) below, so `schema.ts` remains the single
 * source of truth for the `Extraction` shape and its 1-4 strength refinement; this is only a
 * mechanical re-declaration to satisfy the SDK helper's zod-v4 requirement.
 */
const ExtractionOutputSchemaV4 = z4.object({
  strength: z4.number().int(),
  sufficiency: z4.enum(SUFFICIENCIES),
  evidence: z4.array(
    z4.object({
      quote: z4.string().min(1),
      dimension: z4.enum(DIMENSIONS),
      level: z4.enum(LEVELS),
      rationale: z4.string(),
    }),
  ),
  notes: z4.array(z4.string()),
});

export function makeClient(opts: { apiKey?: string; browser?: boolean } = {}): Anthropic {
  return new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: opts.browser === true,
  });
}

/** One extraction call. Returns the quote-filtered extraction plus the raw model output. */
export async function extractOne(
  client: Anthropic,
  input: ExtractionInput,
): Promise<{ extraction: Extraction; dropped: string[]; raw: Extraction }> {
  const { system, user } = buildExtractionPrompt(input);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(ExtractionOutputSchemaV4) },
  });
  if (response.stop_reason === "refusal") throw new Error("Model declined the request.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Model output did not match the schema.");
  const raw = ExtractionSchema.parse(parsed);
  const { extraction, dropped } = filterQuotes(raw, input.review);
  return { extraction, dropped, raw };
}
