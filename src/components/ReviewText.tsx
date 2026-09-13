import type { ReactNode } from "react";
import type { EvidenceItem } from "../lib/schema";
import { DIMENSION_COLORS } from "./dimensionColors";

type Span = { start: number; end: number; index: number };

export function ReviewText({ review, evidence, activeIndex, onActivate }: { review: string; evidence: EvidenceItem[]; activeIndex: number | null; onActivate: (i: number | null) => void }) {
  const spans: Span[] = [];
  evidence.forEach((e, index) => {
    const start = review.indexOf(e.quote);
    if (start < 0) return;
    const end = start + e.quote.length;
    if (spans.some((s) => start < s.end && end > s.start)) return; // overlap: skip
    spans.push({ start, end, index });
  });
  spans.sort((a, b) => a.start - b.start);

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) parts.push(review.slice(cursor, s.start));
    const item = evidence[s.index];
    parts.push(
      <mark
        key={s.index}
        onClick={() => onActivate(activeIndex === s.index ? null : s.index)}
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
