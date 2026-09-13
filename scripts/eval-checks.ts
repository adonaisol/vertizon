import type { EmployeeRecord, ExtractionRecord, Manager, ManagerStyle } from "../src/lib/schema";
import type { AgendaRow } from "../src/lib/scoring";

export type Joined = { emp: EmployeeRecord; manager: Manager; rec: ExtractionRecord; ruleStrength: number | null };

export function stability(recs: ExtractionRecord[]) {
  const maxSpread: Record<number, number> = {};
  let identical = 0;
  for (const r of recs) {
    const spread = Math.max(...r.strengthByRun) - Math.min(...r.strengthByRun);
    maxSpread[spread] = (maxSpread[spread] ?? 0) + 1;
    if (spread === 0) identical++;
  }
  return { identical, total: recs.length, maxSpread };
}

export function quoteFidelity(recs: ExtractionRecord[]) {
  const kept = recs.reduce((n, r) => n + r.extraction.evidence.length, 0);
  const dropped = recs.reduce((n, r) => n + r.droppedQuotes.length, 0);
  return { kept, dropped };
}

export function ruleVsModel(rows: Joined[]) {
  const usable = rows.filter((r) => r.ruleStrength !== null);
  const agreeWithinHalf = usable.filter((r) => Math.abs((r.ruleStrength as number) - r.rec.extraction.strength) <= 0.5).length;
  return { agreeWithinHalf, total: usable.length };
}

export function managerOffsets(rows: Joined[]) {
  const out: Record<string, { style: ManagerStyle; offset: number; n: number }> = {};
  for (const m of new Set(rows.map((r) => r.manager.id))) {
    const own = rows.filter((r) => r.manager.id === m && r.rec.extraction.sufficiency !== "low" && r.ruleStrength !== null);
    const offset = own.length ? own.reduce((a, r) => a + (r.emp.rating - (r.ruleStrength as number)), 0) / own.length : NaN;
    out[m] = { style: rows.find((r) => r.manager.id === m)!.manager.style, offset, n: own.length };
  }
  return out;
}

export function plantedChecks(rows: Joined[], agendaRows: AgendaRow[]) {
  const offsets = managerOffsets(rows);
  const byStyle = (s: ManagerStyle) => Object.values(offsets).find((o) => o.style === s)!;
  const group = (id: string) => agendaRows.find((a) => a.id === id)?.group;
  const strengthOf = (s: ManagerStyle) => rows.filter((r) => r.manager.style === s && r.ruleStrength !== null).map((r) => r.ruleStrength as number);
  const meanOf = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
  const terseLow = rows.filter((r) => r.manager.style === "terse");
  const terseLowShare = terseLow.filter((r) => r.rec.extraction.sufficiency === "low").length / terseLow.length;
  const nonnativeMean = meanOf(strengthOf("nonnative"));
  const calibratedMean = meanOf(strengthOf("calibrated"));

  const checks = [
    { name: "lenient manager offset > +0.5", pass: byStyle("lenient").offset > 0.5, detail: byStyle("lenient").offset.toFixed(2) },
    { name: "harsh manager offset < -0.5", pass: byStyle("harsh").offset < -0.5, detail: byStyle("harsh").offset.toFixed(2) },
    { name: "calibrated manager |offset| < 0.4", pass: Math.abs(byStyle("calibrated").offset) < 0.4, detail: byStyle("calibrated").offset.toFixed(2) },
    { name: "terse team >= 80% low sufficiency", pass: terseLowShare >= 0.8, detail: `${(terseLowShare * 100).toFixed(0)}%` },
    { name: "verbose team not scored high on prose alone (mean strength <= 2.5)", pass: meanOf(strengthOf("verbose")) <= 2.5, detail: meanOf(strengthOf("verbose")).toFixed(2) },
    { name: "non-native team scored on work: mean strength within 0.5 of calibrated team", pass: Math.abs(nonnativeMean - calibratedMean) <= 0.5, detail: `${nonnativeMean.toFixed(2)} vs ${calibratedMean.toFixed(2)}` },
  ];
  for (const r of rows.filter((r) => r.emp.plant)) {
    const g = group(r.emp.id);
    if (r.emp.plant === "contradictory" || r.emp.plant === "self_contradicting") {
      const noted = r.rec.extraction.notes.some((n) => /contradict/i.test(n));
      checks.push({
        name: `planted ${r.emp.plant} (${r.emp.id}) lands in Discuss or is noted as contradictory`,
        pass: g === "discuss" || noted,
        detail: `group=${g} noted=${noted}`,
      });
    } else {
      checks.push({ name: `planted ${r.emp.plant} (${r.emp.id}) lands in Discuss`, pass: g === "discuss", detail: `group=${g}` });
    }
  }
  return checks;
}
