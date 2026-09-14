import type { Employee } from "../lib/data";
import type { Manager } from "../lib/schema";
import type { AgendaGroup } from "../lib/scoring";
import type { Derived } from "../state/derive";
import { managerColor } from "./colors";
import { flagsSelfContradiction } from "../lib/notes";

const GROUPS: { key: AgendaGroup; title: string; hint: string; defaultOpen: boolean }[] = [
  { key: "discuss", title: "Discuss", hint: "rating and evidence disagree by a full step, or the profile is uneven across dimensions", defaultOpen: true },
  { key: "more_input", title: "Get more input", hint: "the review is too thin to judge; ask the manager for specifics", defaultOpen: true },
  { key: "consistent", title: "Looks consistent", hint: "rating matches the evidence", defaultOpen: false },
];

export function Agenda({ employees, managers, derived, onSelect }: { employees: Employee[]; managers: Manager[]; derived: Derived; onSelect: (id: string) => void }) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Agenda</h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Every employee, grouped by what the calibration meeting should do with them. Click a row to open the review and its evidence.
        </p>
      </div>

      <Legend managers={managers} derived={derived} />

      {GROUPS.map((g) => {
        const rows = derived.agenda.filter((r) => r.group === g.key);
        return (
          <details key={g.key} open={g.defaultOpen} className="group">
            <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm font-semibold text-slate-900">
              <span className="inline-block w-3 text-xs text-slate-400 transition-transform group-open:rotate-90">▶</span>
              {g.title} <span className="text-xs font-normal text-slate-500">({rows.length}) · {g.hint}</span>
            </summary>
            <ul className="mt-1 divide-y divide-slate-100 pl-5">
              {rows.map((r) => {
                const e = byId.get(r.id)!;
                const mi = managers.findIndex((m) => m.id === e.managerId);
                const low = e.extraction.sufficiency === "low";
                const contradictionNoted = flagsSelfContradiction(e.extraction.notes);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onSelect(r.id)} className="flex w-full items-start gap-2 py-1.5 text-left hover:bg-slate-50">
                      <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: managerColor(mi), background: low ? "white" : managerColor(mi) }} />
                      <span className="flex-1">
                        <span className="font-medium">{e.name}</span> <span className="text-slate-500">· {e.level} · {e.manager.name}</span>
                        <div className="text-xs text-slate-600">
                          {r.reason}
                          {contradictionNoted && (
                            <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">review contradicts itself</span>
                          )}
                        </div>
                      </span>
                    </button>
                  </li>
                );
              })}
              {rows.length === 0 && <li className="py-1.5 text-xs text-slate-500">None.</li>}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function Legend({ managers, derived }: { managers: Manager[]; derived: Derived }) {
  return (
    <section className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Managers</h3>
        <ul className="mt-1 space-y-1 text-xs">
          {managers.map((m, i) => {
            const usable = derived.scored.filter(
              (s) => s.managerId === m.id && s.sufficiency !== "low" && s.strength !== null,
            ).length;
            return (
              <li key={m.id} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-2 w-4 shrink-0 rounded-sm" style={{ background: managerColor(i) }} />
                <span>
                  <span className="font-medium">{m.name}</span>{" "}
                  <span className="text-slate-600">{derived.summaries[m.id]} · n={usable}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</h3>
        <ul className="mt-1 space-y-1 text-xs text-slate-700">
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-slate-600 bg-slate-600" />
            <span><b>Solid point</b>: enough evidence to judge</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-slate-600 bg-white" />
            <span><b>Hollow point</b>: too little evidence; not used in manager lines</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-4 shrink-0 border-t-2 border-dashed border-slate-400" />
            <span><b>Dashed diagonal</b>: rating matches evidence</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-4 shrink-0 border-t-2 border-slate-600" />
            <span><b>Coloured line</b>: one manager's fitted rating-vs-evidence line</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
