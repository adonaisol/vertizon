import { useState, type Dispatch } from "react";
import type { Employee } from "../lib/data";
import type { Manager, Rubric } from "../lib/schema";
import { ratingLabel, strength } from "../lib/scoring";
import type { Derived } from "../state/derive";
import { effectiveEvidence, type OverrideAction, type Overrides } from "../state/overrides";
import { ReviewText } from "./ReviewText";
import { EvidenceList } from "./EvidenceList";

export type DrilldownProps = {
  employee: Employee; rubric: Rubric; managers: Manager[]; derived: Derived;
  overrides: Overrides; dispatch: Dispatch<OverrideAction>;
  apiKey: string | null; onNeedKey: () => void; onBack: () => void;
};

export function Drilldown(p: DrilldownProps) {
  const { employee: e, rubric } = p;
  const [active, setActive] = useState<number | null>(null);
  const evidence = effectiveEvidence(e, p.overrides);
  const s = strength(evidence);
  const suff = e.extraction.sufficiency;

  return (
    <div className="space-y-5">
      <div>
        <button onClick={p.onBack} className="text-xs text-slate-500 hover:underline">← back to agenda</button>
        <h2 className="mt-1 text-base font-semibold text-slate-900">{e.name} <span className="font-normal text-slate-500">· {e.level} · manager {e.manager.name}</span></h2>
        <p className="text-sm">
          Rating: <b>{ratingLabel(e.rating, rubric.ratings)}</b> ({e.rating}) · Evidence:{" "}
          {s === null ? <b>none found</b> : <b>{ratingLabel(s, rubric.ratings)} ({s.toFixed(1)})</b>}
          {suff === "low" && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">too little evidence to judge</span>}
        </p>
        {e.extraction.notes.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{e.extraction.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Review</h3>
        <ReviewText review={e.review} evidence={evidence} activeIndex={active} onActivate={setActive} />
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence <span className="font-normal normal-case">(change a level to override the model; the map updates)</span></h3>
        <EvidenceList
          evidence={evidence} originals={e.extraction.evidence} activeIndex={active} onActivate={setActive} rubric={rubric}
          onSetLevel={(i, level) => p.dispatch({ type: "set", employeeId: e.id, index: i, level })}
          onReset={() => p.dispatch({ type: "resetEmployee", employeeId: e.id })}
        />
      </section>

      {/* OtherBars (Task 14) */}
      {/* Rerun (Task 15) */}
    </div>
  );
}
