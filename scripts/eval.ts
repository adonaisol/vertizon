import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { EmployeesFileSchema, ExtractionRecordSchema, RubricSchema } from "../src/lib/schema";
import { agenda, strength, type Scored } from "../src/lib/scoring";
import { managerOffsets, plantedChecks, quoteFidelity, ruleVsModel, stability, type Joined } from "./eval-checks";
import { z } from "zod/v4";

const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));
const { managers, employees } = EmployeesFileSchema.parse(JSON.parse(readFileSync("data/employees.json", "utf8")));
const recs = z.array(ExtractionRecordSchema).parse(JSON.parse(readFileSync("data/extractions.json", "utf8")));

const rows: Joined[] = employees.map((emp) => {
  const rec = recs.find((r) => r.employeeId === emp.id)!;
  return { emp, manager: managers.find((m) => m.id === emp.managerId)!, rec, ruleStrength: strength(rec.extraction.evidence) };
});
const scored: Scored[] = rows.map((r) => ({ id: r.emp.id, name: r.emp.name, managerId: r.emp.managerId, rating: r.emp.rating, strength: r.ruleStrength, sufficiency: r.rec.extraction.sufficiency }));
const agendaRows = agenda(scored, rubric.ratings);

const st = stability(recs);
const qf = quoteFidelity(recs);
const rv = ruleVsModel(rows);
const offsets = managerOffsets(rows);
const checks = plantedChecks(rows, agendaRows);

const lines = [
  `# Extraction eval report`,
  ``,
  `Model: ${recs[0]?.model}. ${recs.length} reviews × ${recs[0]?.strengthByRun.length} runs. Generated ${new Date().toISOString().slice(0, 10)}.`,
  ``,
  `## 1. Stability`,
  `Identical strength across runs: ${st.identical}/${st.total}. Max spread histogram: ${JSON.stringify(st.maxSpread)}.`,
  ``,
  `## 2. Quote fidelity`,
  `Quotes kept: ${qf.kept}. Dropped (not verbatim): ${qf.dropped}. Fidelity: ${((qf.kept / (qf.kept + qf.dropped)) * 100).toFixed(1)}%.`,
  ``,
  `## 3. Rule vs model strength`,
  `Client-side strength rule within 0.5 of the model's own strength: ${rv.agreeWithinHalf}/${rv.total}.`,
  ``,
  `## 4. Manager offsets (mean rating − evidence, usable points only)`,
  `| Manager | Style | Offset | n |`, `|---|---|---|---|`,
  ...Object.entries(offsets).map(([id, o]) => `| ${managers.find((m) => m.id === id)!.name} | ${o.style} | ${isNaN(o.offset) ? "n/a" : o.offset.toFixed(2)} | ${o.n} |`),
  ``,
  `## 5. Planted-truth checks`,
  `| Check | Result | Detail |`, `|---|---|---|`,
  ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`),
  ``,
  `Note: the non-native and calibrated teams were written at the same true quality (two Exceeds, three Meets), so comparing their mean strength isolates the effect of writing style.`,
  ``,
  `## 6. Changes made in response`,
  existsSync("data/eval-notes.md") ? `See notes below.` : `(Filled in by the author: what failed, what changed in the prompt, and the result of the re-run.)`,
];
if (existsSync("data/eval-notes.md")) lines.push("", readFileSync("data/eval-notes.md", "utf8"));
writeFileSync("data/eval-report.md", lines.join("\n"));
console.log(lines.join("\n"));
