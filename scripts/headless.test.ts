import { describe, it, expect } from "vitest";
import { parseHeadlessOutput } from "./headless";

// Real shape observed from `claude -p ... --output-format json --json-schema '...' --model opus --tools ""`
// (v2.1.270): no top-level `model` field; `modelUsage` keys by full model id, and includes an
// incidental low-cost `claude-haiku-4-5-*` entry alongside the real generation model — pick the
// entry with the highest costUSD as the model actually used.
describe("parseHeadlessOutput", () => {
  it("extracts the structured object and the highest-cost model from modelUsage", () => {
    const sample = JSON.stringify({
      type: "result",
      result: '{"n":4}',
      structured_output: { n: 4 },
      modelUsage: {
        "claude-haiku-4-5-20251001": { costUSD: 0.000985 },
        "claude-opus-5": { costUSD: 0.0039365 },
      },
    });
    const out = parseHeadlessOutput(sample);
    expect(out.structured).toEqual({ n: 4 });
    expect(out.model).toBe("claude-opus-5");
  });

  it("falls back to parsing result as JSON text when structured_output is absent", () => {
    const sample = JSON.stringify({ type: "result", result: '{"n":4}' });
    expect(parseHeadlessOutput(sample).structured).toEqual({ n: 4 });
  });

  it("uses a top-level model field when present", () => {
    const sample = JSON.stringify({ type: "result", structured_output: { n: 4 }, model: "claude-opus-5" });
    expect(parseHeadlessOutput(sample).model).toBe("claude-opus-5");
  });

  it("throws on non-JSON", () => {
    expect(() => parseHeadlessOutput("not json")).toThrow();
  });
});
