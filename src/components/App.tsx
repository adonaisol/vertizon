import { useMemo, useReducer, useState } from "react";
import { loadData } from "../lib/data";
import { overridesReducer, countOverrides } from "../state/overrides";
import { useDerived } from "../state/useDerived";
import { makeMockExtractor } from "../lib/mockExtract";
import { TopBar } from "./TopBar";
import { CalibrationMap } from "./CalibrationMap";
import { Agenda } from "./Agenda";
import { Drilldown } from "./Drilldown";
import { KeyDialog } from "./KeyDialog";

export function App() {
  const { rubric, managers, employees } = useMemo(loadData, []);
  const [overrides, dispatch] = useReducer(overridesReducer, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenManagers, setHidden] = useState<Set<string>>(new Set());
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const derived = useDerived(employees, managers, rubric, overrides);
  const selected = employees.find((e) => e.id === selectedId) ?? null;

  const toggleManager = (id: string) =>
    setHidden((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const extractor = import.meta.env.VITE_MOCK_RERUN === "1"
    ? makeMockExtractor((review) => employees.find((x) => x.review === review)?.extraction)
    : undefined;

  return (
    <div className="flex h-screen flex-col text-slate-800">
      <TopBar hasKey={apiKey !== null} onKeyClick={() => setKeyOpen(true)} />
      <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-[3fr_2fr]">
        <div className="min-h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
          <CalibrationMap
            employees={employees} managers={managers} derived={derived}
            selectedId={selectedId} onSelect={setSelectedId}
            hiddenManagers={hiddenManagers} onToggleManager={toggleManager}
            overrideCount={countOverrides(overrides)}
          />
        </div>
        <aside className="overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 text-sm">
          {selected ? (
            <Drilldown
              key={selected.id}
              employee={selected} rubric={rubric} managers={managers} derived={derived}
              overrides={overrides} dispatch={dispatch}
              apiKey={apiKey} onNeedKey={() => setKeyOpen(true)} onBack={() => setSelectedId(null)}
              extractor={extractor}
            />
          ) : (
            <Agenda employees={employees} managers={managers} derived={derived} onSelect={setSelectedId} />
          )}
        </aside>
      </main>
      <KeyDialog open={keyOpen} onClose={() => setKeyOpen(false)} onSave={setApiKey} hasKey={apiKey !== null} />
    </div>
  );
}
