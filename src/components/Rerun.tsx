import { useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import type { Employee } from "../lib/data";
import type { Extraction, Rubric } from "../lib/schema";
import { extractOne, makeClient, MODEL } from "../lib/anthropic";
import type { ExtractionInput } from "../lib/prompt";
import { ratingLabel, strength } from "../lib/scoring";

type State = { status: "idle" } | { status: "running" } | { status: "done"; live: Extraction; dropped: string[] } | { status: "error"; message: string };

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The API key was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited; try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach api.anthropic.com.";
  if (err instanceof Anthropic.APIError) return `API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : "Unknown error";
}

export type Extractor = (apiKey: string, input: ExtractionInput) => Promise<{ extraction: Extraction; dropped: string[] }>;

export const realExtractor: Extractor = async (apiKey, input) => {
  const client = makeClient({ apiKey, browser: true });
  const r = await extractOne(client, input);
  return { extraction: r.extraction, dropped: r.dropped };
};

export function Rerun({ employee: e, rubric, apiKey, onNeedKey, extractor = realExtractor }: { employee: Employee; rubric: Rubric; apiKey: string | null; onNeedKey: () => void; extractor?: Extractor }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    if (!apiKey) { onNeedKey(); return; }
    setState({ status: "running" });
    try {
      const r = await extractor(apiKey, { rubric, level: e.level, review: e.review, rating: e.rating });
      setState({ status: "done", live: r.extraction, dropped: r.dropped });
    } catch (err) {
      setState({ status: "error", message: describeError(err) });
    }
  }

  const bundled = e.extraction;
  const bs = strength(bundled.evidence);
  return (
    <div>
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={state.status === "running"} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">
          {state.status === "running" ? "Running…" : "Re-run with Claude"}
        </button>
        <span className="text-[11px] text-slate-500">{MODEL} · same prompt and validation as the bundled run{!apiKey && " · needs a key"}</span>
      </div>
      {state.status === "error" && <p className="mt-2 text-xs text-red-700">{state.message}</p>}
      {state.status === "done" && (() => {
        const ls = strength(state.live.evidence);
        const fmt = (x: number | null) => (x === null ? "none" : `${ratingLabel(x, rubric.ratings)} (${x.toFixed(1)})`);
        const bundledQuotes = new Set(bundled.evidence.map((i) => i.quote));
        const liveQuotes = new Set(state.live.evidence.map((i) => i.quote));
        return (
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="font-semibold">Bundled</div>
              <div>evidence {fmt(bs)} · sufficiency {bundled.sufficiency}</div>
              <ul className="mt-1 space-y-0.5">{bundled.evidence.map((i, k) => <li key={k} className={liveQuotes.has(i.quote) ? "" : "text-red-700 line-through"}>{i.dimension} · {i.level} · “{i.quote}”</li>)}</ul>
            </div>
            <div>
              <div className="font-semibold">Live</div>
              <div>evidence {fmt(ls)} · sufficiency {state.live.sufficiency}</div>
              <ul className="mt-1 space-y-0.5">{state.live.evidence.map((i, k) => <li key={k} className={bundledQuotes.has(i.quote) ? "" : "text-emerald-700"}>{i.dimension} · {i.level} · “{i.quote}”</li>)}</ul>
              {state.dropped.length > 0 && <div className="mt-1 text-slate-500">{state.dropped.length} quote(s) dropped as non-verbatim</div>}
            </div>
            <p className="col-span-2 text-slate-500">Struck = only in bundled; green = only in live. Bundled data is not replaced.</p>
          </div>
        );
      })()}
    </div>
  );
}
