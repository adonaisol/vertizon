import { LEVELS, type EvidenceItem, type Level, type Rubric } from "../lib/schema";
import { DIMENSION_COLORS } from "./dimensionColors";

const LEVEL_LABEL: Record<Level, string> = { well_below: "well below", below: "below", at: "at", above: "above", well_above: "well above" };

type Props = {
  evidence: EvidenceItem[]; originals: EvidenceItem[]; activeIndex: number | null;
  onActivate: (i: number | null) => void; onSetLevel: (i: number, level: Level) => void; onReset: () => void; rubric: Rubric;
};

export function EvidenceList({ evidence, originals, activeIndex, onActivate, onSetLevel, onReset, rubric }: Props) {
  const changed = evidence.some((e, i) => e.level !== originals[i].level);
  const dimName = (id: EvidenceItem["dimension"]) => rubric.dimensions.find((d) => d.id === id)?.name ?? id;
  if (evidence.length === 0) return <p className="text-slate-500">No concrete evidence was found in this review.</p>;
  return (
    <div>
      <ul className="space-y-1">
        {evidence.map((e, i) => (
          <li key={i} className={`rounded p-1.5 ${activeIndex === i ? "bg-slate-100" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="w-24 rounded px-1 text-xs" style={{ background: DIMENSION_COLORS[e.dimension] }}>{dimName(e.dimension)}</span>
              <select
                value={e.level}
                onChange={(ev) => onSetLevel(i, ev.target.value as Level)}
                className={`rounded border px-1 text-xs ${e.level !== originals[i].level ? "border-amber-400 bg-amber-50" : "border-slate-300"}`}
                aria-label={`Level for evidence ${i + 1}`}
              >
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]} the bar</option>)}
              </select>
              <button onClick={() => onActivate(activeIndex === i ? null : i)} className="truncate text-left text-xs text-slate-700 hover:underline">“{e.quote}”</button>
            </div>
            {activeIndex === i && <p className="mt-1 pl-1 text-xs text-slate-600">{e.rationale}</p>}
          </li>
        ))}
      </ul>
      {changed && <button onClick={onReset} className="mt-2 text-xs text-amber-700 hover:underline">Reset overrides for this employee</button>}
    </div>
  );
}
