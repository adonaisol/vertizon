import type { Employee } from "../lib/data";
import type { Manager } from "../lib/schema";
import type { AgendaGroup } from "../lib/scoring";
import type { Derived } from "../state/derive";
import { managerColor } from "./colors";

const GROUPS: { key: AgendaGroup; title: string; hint: string }[] = [
  { key: "discuss", title: "Discuss", hint: "rating and evidence disagree by a full step, or the profile is uneven across dimensions" },
  { key: "more_input", title: "Get more input", hint: "the review is too thin to judge; ask the manager for specifics" },
  { key: "consistent", title: "Looks consistent", hint: "rating matches the evidence" },
];

export function Agenda({ employees, managers, derived, onSelect }: { employees: Employee[]; managers: Manager[]; derived: Derived; onSelect: (id: string) => void }) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return (
    <div className="space-y-5">
      {GROUPS.map((g) => {
        const rows = derived.agenda.filter((r) => r.group === g.key);
        return (
          <section key={g.key}>
            <h2 className="flex items-baseline gap-2 text-sm font-semibold text-slate-900">
              {g.title} <span className="text-xs font-normal text-slate-500">({rows.length}) · {g.hint}</span>
            </h2>
            <ul className="mt-1 divide-y divide-slate-100">
              {rows.map((r) => {
                const e = byId.get(r.id)!;
                const mi = managers.findIndex((m) => m.id === e.managerId);
                const low = e.extraction.sufficiency === "low";
                return (
                  <li key={r.id}>
                    <button onClick={() => onSelect(r.id)} className="flex w-full items-start gap-2 py-1.5 text-left hover:bg-slate-50">
                      <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: managerColor(mi), background: low ? "white" : managerColor(mi) }} />
                      <span className="flex-1">
                        <span className="font-medium">{e.name}</span> <span className="text-slate-500">· {e.level} · {e.manager.name}</span>
                        <div className="text-xs text-slate-600">{r.reason}</div>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <section>
        <h2 className="text-sm font-semibold text-slate-900">Managers</h2>
        <ul className="mt-1 space-y-1 text-xs">
          {managers.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: managerColor(i) }} />
              <span className="w-28 font-medium">{m.name}</span>
              <span className="text-slate-600">{derived.summaries[m.id]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
