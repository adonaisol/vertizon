import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod/v4";
import { ExtractionOutputSchema, ExtractionSchema, type Extraction } from "../src/lib/schema";

const exec = promisify(execFile);

/**
 * Plain types/enums only (no `.refine`) — every JSON-schema consumer, including `claude -p --json-schema`,
 * accepts this. Drop `$schema`: the installed `claude` CLI's validator doesn't fetch/resolve that meta-schema
 * URI and rejects the whole schema with "no schema with key or ref ..." when it's present.
 */
const { $schema: _unusedMetaSchemaRef, ...jsonSchemaWithoutMeta } = z.toJSONSchema(ExtractionOutputSchema);
const SCHEMA = JSON.stringify(jsonSchemaWithoutMeta);

/**
 * Parse the `--output-format json` object `claude -p` prints on stdout.
 *
 * Observed shape (claude 2.1.270): the schema-validated object is under `structured_output`;
 * when absent, `result` holds a JSON string to parse instead. There is no top-level `model`
 * field; the model actually used is a key of `modelUsage`, which — surprisingly — routinely
 * also carries an incidental low-cost `claude-haiku-4-5-*` entry for a background subtask
 * alongside the real generation model. Pick the `modelUsage` entry with the highest `costUSD`.
 */
export function parseHeadlessOutput(stdout: string): { structured: unknown; model: string | null } {
  const obj = JSON.parse(stdout) as Record<string, unknown>;

  let structured: unknown = obj.structured_output;
  if (structured === undefined && typeof obj.result === "string") {
    structured = JSON.parse(obj.result);
  }

  let model: string | null = typeof obj.model === "string" ? obj.model : null;
  if (model === null) {
    const usage = obj.modelUsage as Record<string, { costUSD?: number }> | undefined;
    if (usage) {
      const entries = Object.entries(usage);
      entries.sort((a, b) => (b[1]?.costUSD ?? 0) - (a[1]?.costUSD ?? 0));
      model = entries[0]?.[0] ?? null;
    }
  }

  return { structured, model };
}

/** One extraction through `claude -p`. Each call is a fresh process, so repeated runs are independent samples. */
export async function runHeadless(system: string, user: string): Promise<{ raw: Extraction; model: string }> {
  const args = [
    "-p", user,
    "--system-prompt", system,
    "--output-format", "json",
    "--json-schema", SCHEMA,
    "--model", "opus",
    "--tools", "", // no tool use: pure text-in, JSON-out
  ];
  const { stdout } = await exec("claude", args, { maxBuffer: 10 * 1024 * 1024 });
  const { structured, model } = parseHeadlessOutput(stdout);
  const raw = ExtractionSchema.parse(structured);
  return { raw, model: model ?? "claude (headless, model not reported)" };
}
