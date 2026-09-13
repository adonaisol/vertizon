import type { ReactNode } from "react";
import type { EvidenceItem } from "../lib/schema";
import { DIMENSION_COLORS } from "./dimensionColors";

type Span = { start: number; end: number; index: number };

export function ReviewText({ review, evidence, activeIndex, onActivate }: { review: string; evidence: EvidenceItem[]; activeIndex: number | null; onActivate: (i: number | null) => void }) {
  // Build a candidate span for every evidence item, sort by start (earlier wins ties
  // broken by longer span first), then greedily accept, rejecting overlaps with an
  // already-accepted span. This makes "earlier-starting wins" independent of the
  // evidence array's order.
  const candidates: Span[] = [];
  evidence.forEach((e, index) => {
    const start = review.indexOf(e.quote);
    if (start < 0) return;
    candidates.push({ start, end: start + e.quote.length, index });
  });
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const spans: Span[] = [];
  for (const c of candidates) {
    if (spans.some((s) => c.start < s.end && c.end > s.start)) continue; // overlap: skip
    spans.push(c);
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) parts.push(review.slice(cursor, s.start));
    const item = evidence[s.index];
    parts.push(
      <mark
        key={s.index}
        role="button"
        tabIndex={0}
        onClick={() => onActivate(activeIndex === s.index ? null : s.index)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onActivate(activeIndex === s.index ? null : s.index);
          }
        }}
        className={`cursor-pointer rounded px-0.5 ${activeIndex === s.index ? "ring-2 ring-slate-500" : ""}`}
        style={{ background: DIMENSION_COLORS[item.dimension] }}
        title={`${item.dimension} · ${item.level}`}
      >
        {review.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  }
  if (cursor < review.length) parts.push(review.slice(cursor));
  return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}
