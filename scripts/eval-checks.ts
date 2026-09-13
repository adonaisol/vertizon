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

/** Excludes planted employees: plants are individual anomalies, not manager style. */
export function managerOffsets(rows: Joined[]) {
  const out: Record<string, { style: ManagerStyle; offset: number; n: number }> = {};
  for (const m of new Set(rows.map((r) => r.manager.id))) {
    const own = rows.filter((r) => r.manager.id === m && !r.emp.plant && r.rec.extraction.sufficiency !== "low" && r.ruleStrength !== null);
    const offset = own.length ? own.reduce((a, r) => a + (r.emp.rating - (r.ruleStrength as number)), 0) / own.length : NaN;
    out[m] = { style: rows.find((r) => r.manager.id === m)!.manager.style, offset, n: own.length };
  }
  return out;
}

const signed = (x: number): string => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`;

export function plantedChecks(rows: Joined[], agendaRows: AgendaRow[]) {
  const offsets = managerOffsets(rows);
  const byStyle = (s: ManagerStyle) => Object.values(offsets).find((o) => o.style === s)!;
  const group = (id: string) => agendaRows.find((a) => a.id === id)?.group;
  const strengthOf = (s: ManagerStyle) => rows.filter((r) => r.manager.style === s && r.ruleStrength !== null).map((r) => r.ruleStrength as number);
  const meanOf = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
  const fmtMean = (v: number[]) => (v.length ? meanOf(v).toFixed(2) : "no evidence");

  const lenient = byStyle("lenient");
  const harsh = byStyle("harsh");
  const calibrated = byStyle("calibrated");
  const lenientVsCalibrated = lenient.n > 0 && calibrated.n > 0 ? lenient.offset - calibrated.offset : NaN;
  const harshVsCalibrated = harsh.n > 0 && calibrated.n > 0 ? calibrated.offset - harsh.offset : NaN;

  const terseRows = rows.filter((r) => r.manager.style === "terse");
  const terseLowShare = terseRows.length ? terseRows.filter((r) => r.rec.extraction.sufficiency === "low").length / terseRows.length : NaN;

  const verboseStrengths = strengthOf("verbose");
  const nonnativeStrengths = strengthOf("nonnative");
  const calibratedStrengths = strengthOf("calibrated");
  const verboseMean = meanOf(verboseStrengths);
  const nonnativeMean = meanOf(nonnativeStrengths);
  const calibratedStrengthMean = meanOf(calibratedStrengths);

  const checks = [
    {
      name: "lenient manager runs ≥ 0.3 above the calibrated baseline",
      pass: !Number.isNaN(lenientVsCalibrated) && lenientVsCalibrated >= 0.3,
      detail: Number.isNaN(lenientVsCalibrated) ? "no usable points" : `${signed(lenient.offset)} vs ${signed(calibrated.offset)}`,
    },
    {
      name: "harsh manager runs ≥ 0.3 below the calibrated baseline",
      pass: !Number.isNaN(harshVsCalibrated) && harshVsCalibrated >= 0.3,
      detail: Number.isNaN(harshVsCalibrated) ? "no usable points" : `${signed(harsh.offset)} vs ${signed(calibrated.offset)}`,
    },
    {
      name: "calibrated manager |offset| < 0.4",
      pass: calibrated.n > 0 && Math.abs(calibrated.offset) < 0.4,
      detail: calibrated.n === 0 ? "no usable points" : calibrated.offset.toFixed(2),
    },
    {
      name: "terse team >= 80% low sufficiency",
      pass: !Number.isNaN(terseLowShare) && terseLowShare >= 0.8,
      detail: Number.isNaN(terseLowShare) ? "no evidence" : `${(terseLowShare * 100).toFixed(0)}%`,
    },
    {
      name: "verbose team not scored high on prose alone (mean strength <= 2.5)",
      pass: verboseStrengths.length > 0 && verboseMean <= 2.5,
      detail: fmtMean(verboseStrengths),
    },
    {
      name: "non-native team scored on work: mean strength within 0.5 of calibrated team",
      pass: nonnativeStrengths.length > 0 && calibratedStrengths.length > 0 && Math.abs(nonnativeMean - calibratedStrengthMean) <= 0.5,
      detail: nonnativeStrengths.length && calibratedStrengths.length ? `${nonnativeMean.toFixed(2)} vs ${calibratedStrengthMean.toFixed(2)}` : "no evidence",
    },
  ];
  for (const r of rows.filter((r) => r.emp.plant)) {
    const g = group(r.emp.id);
    if (r.emp.plant === "self_contradicting") {
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
