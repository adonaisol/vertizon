import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { ExtractionSchema, ExtractionOutputSchema, filterQuotes, type Extraction } from "./schema";
import { buildExtractionPrompt, type ExtractionInput } from "./prompt";

export const MODEL = "claude-opus-5";

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
    output_config: { format: zodOutputFormat(ExtractionOutputSchema) },
  });
  if (response.stop_reason === "refusal") throw new Error("Model declined the request.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Model output did not match the schema.");
  let raw: Extraction;
  try {
    raw = ExtractionSchema.parse(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Model output failed validation: ${issues}`);
    }
    throw err;
  }
  const { extraction, dropped } = filterQuotes(raw, input.review);
  return { extraction, dropped, raw };
}
