import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ScatterPointItem } from "recharts";
import type { Employee } from "../lib/data";
import type { Manager } from "../lib/schema";
import type { Derived } from "../state/derive";
import { managerColor } from "./colors";

type Props = {
  employees: Employee[];
  managers: Manager[];
  derived: Derived;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hiddenManagers: Set<string>;
  onToggleManager: (id: string) => void;
  overrideCount: number;
  onResetAll: () => void;
};

type Datum = { x: number; y: number; id: string; name: string; managerName: string; low: boolean; selected: boolean; color: string };

const RATING_TICKS = [1, 2, 3, 4];
const LABELS: Record<number, string> = { 1: "Below", 2: "Meets", 3: "Exceeds", 4: "Greatly Exceeds" };

// Deterministic vertical jitter so integer ratings don't stack.
function jitter(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 0.18;
}

function PointShape(props: { cx?: number; cy?: number; payload?: Datum }) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload) return null;
  const r = payload.selected ? 8 : 6;
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={payload.low ? "white" : payload.color}
      stroke={payload.color}
      strokeWidth={payload.selected ? 3 : 2}
      style={{ cursor: "pointer" }}
    />
  );
}

export function CalibrationMap({ employees, managers, derived, selectedId, onSelect, hiddenManagers, onToggleManager, overrideCount, onResetAll }: Props) {
  const visible = employees.filter((e) => !hiddenManagers.has(e.managerId));
  const noEvidenceCount = visible.filter((e) => derived.strengthById[e.id] === null).length;
  const data: Datum[] = visible
    .filter((e) => derived.strengthById[e.id] !== null)
    .map((e) => {
      const s = derived.strengthById[e.id] as number;
      const mi = managers.findIndex((m) => m.id === e.managerId);
      return {
        x: s, y: e.rating + jitter(e.id), id: e.id, name: e.name, managerName: e.manager.name,
        low: e.extraction.sufficiency === "low", selected: e.id === selectedId, color: managerColor(mi),
      };
    });

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 pb-1 text-xs text-slate-600">
        <span className="font-medium text-slate-700">Rating vs. evidence, one point per employee</span>
        <span className="flex items-center gap-2">
          {overrideCount > 0 && (
            <>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">{overrideCount} override{overrideCount > 1 ? "s" : ""} applied</span>
              <button type="button" onClick={onResetAll} className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50">Reset all</button>
            </>
          )}
        </span>
      </div>
      {noEvidenceCount > 0 && (
        <div className="px-2 pb-1 text-[11px] text-slate-500">
          {noEvidenceCount} review(s) with no extractable evidence are not plotted — see Get more input
        </div>
      )}
      <div className="min-h-[360px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" domain={[0.8, 4.2]} ticks={RATING_TICKS} tickFormatter={(v) => LABELS[v] ?? ""} label={{ value: "Evidence strength", position: "bottom", offset: 10, fontSize: 12 }} />
            <YAxis type="number" dataKey="y" domain={[0.8, 4.2]} ticks={RATING_TICKS} tickFormatter={(v) => LABELS[v] ?? ""} width={90} label={{ value: "Manager rating", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <ReferenceLine segment={[{ x: 1, y: 1 }, { x: 4, y: 4 }]} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="hidden" />
            {managers.map((m, i) => {
              const f = derived.fits[m.id];
              if (!f || hiddenManagers.has(m.id)) return null;
              return <ReferenceLine key={m.id} segment={[{ x: 1, y: f.a + f.b }, { x: 4, y: f.a + 4 * f.b }]} stroke={managerColor(i)} strokeWidth={1.5} strokeOpacity={0.7} ifOverflow="hidden" />;
            })}
            <Tooltip
              cursor={false}
              content={({ payload }) => {
                const d = payload?.[0]?.payload as Datum | undefined;
                if (!d) return null;
                return (
                  <div className="rounded border border-slate-200 bg-white px-2 py-1 text-xs shadow">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-slate-600">{d.managerName}</div>
                    <div>evidence {d.x.toFixed(1)} · rating {Math.round(d.y)}</div>
                  </div>
                );
              }}
            />
            <Scatter
              data={data}
              shape={<PointShape />}
              onClick={(point: ScatterPointItem) => {
                const d = point.payload as Datum | undefined;
                if (d) onSelect(d.id);
              }}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="px-2 pt-2 text-xs text-slate-600">
        <p className="font-medium text-slate-800">Is this rating a property of the evidence, or of who wrote it?</p>
        <p className="mt-0.5">
          Each point is one employee: how strong the written evidence in their review is (across) against the rating
          their manager gave (up). On the dashed diagonal the two agree. Points well above it are rated higher than
          their evidence supports; points well below are rated lower. Each coloured line is one manager's fitted
          rating-vs-evidence line: above the pack means generous, below means harsh, steeper means they want more
          evidence per step. Hollow points come from reviews too thin to judge and do not shape the lines.
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
          <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-600 bg-slate-600" /> solid: enough evidence to judge</li>
          <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-600 bg-white" /> hollow: too little evidence, not in the lines</li>
          <li className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-slate-400" /> dashed diagonal: rating matches evidence</li>
          <li className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-slate-600" /> coloured line: one manager's fitted line</li>
        </ul>
        <p className="mt-1 text-[11px] text-slate-500">Click a point to open the employee. Click a manager below to hide or show their points and line.</p>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1 text-xs">
        {managers.map((m, i) => (
          <li key={m.id}>
            <button
              type="button"
              aria-pressed={!hiddenManagers.has(m.id)}
              onClick={() => onToggleManager(m.id)}
              title={`Toggle ${m.name}'s points and line`}
              className={`flex items-center gap-1 ${hiddenManagers.has(m.id) ? "opacity-40" : ""}`}
            >
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: managerColor(i) }} />
              {m.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
