import type { Employee } from "../lib/data";
import type { Manager, Rubric } from "../lib/schema";
import { impliedRating, ratingLabel } from "../lib/scoring";
import type { Derived } from "../state/derive";
import { managerColor } from "./colors";

export function OtherBars({ employee, strengthValue, managers, derived, rubric }: { employee: Employee; strengthValue: number | null; managers: Manager[]; derived: Derived; rubric: Rubric }) {
  if (strengthValue === null) return <p className="text-xs text-slate-500">No evidence to compare against other managers' bars.</p>;
  return (
    <div>
      <ul className="space-y-1 text-xs">
        {managers.map((m, i) => {
          const fit = derived.fits[m.id];
          const own = m.id === employee.managerId;
          if (!fit) {
            return <li key={m.id} className="flex items-center gap-2"><Swatch i={i} /><span className="w-28 font-medium">{m.name}</span><span className="text-slate-500">not enough evidence to infer this manager's bar</span></li>;
          }
          const r = impliedRating(strengthValue, fit);
          const lo = ratingLabel(r.low, rubric.ratings);
          const hi = ratingLabel(r.high, rubric.ratings);
          const range = lo === hi ? lo : `${lo}–${hi}`;
          const pct = (v: number) => `${((v - 1) / 3) * 100}%`;
          return (
            <li key={m.id} className="flex items-center gap-2">
              <Swatch i={i} />
              <span className="w-28 font-medium">{m.name}{own && <span className="text-slate-400"> (own)</span>}</span>
              <span className="relative h-2 flex-1 rounded bg-slate-100">
                <span className="absolute h-2 rounded" style={{ left: pct(r.low), width: `calc(${pct(r.high)} - ${pct(r.low)})`, background: managerColor(i), opacity: 0.35 }} />
                <span className="absolute -top-0.5 h-3 w-0.5" style={{ left: pct(Math.min(4, Math.max(1, r.estimate))), background: managerColor(i) }} />
              </span>
              <span className="w-36 text-right">{range} <span className="text-slate-400">· n={fit.n}</span></span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">
        Each range is where this employee's evidence would land on that manager's fitted rating line (shrunk toward the pooled line for small n).
        Width is the line's standard error, floored at half a step; it widens when a manager is inconsistent or has not rated evidence this strong before.
      </p>
    </div>
  );
}

function Swatch({ i }: { i: number }) {
  return <span className="inline-block h-2 w-4 shrink-0 rounded-sm" style={{ background: managerColor(i) }} />;
}
