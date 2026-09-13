import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { EmployeesFileSchema, RubricSchema, filterQuotes, type ExtractionRecord } from "../src/lib/schema";
import { buildExtractionPrompt } from "../src/lib/prompt";
import { runHeadless } from "./headless";

const RUNS = 3;
const CONCURRENCY = 4;
const OUT = "data/extractions.json";

const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));
const { employees } = EmployeesFileSchema.parse(JSON.parse(readFileSync("data/employees.json", "utf8")));
const only = process.argv[2]; // optional employee id to re-run a single one

const existing: ExtractionRecord[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((r) => [r.employeeId, r]));

// Serialize writes through a single promise chain so concurrent workers never interleave.
let writeChain: Promise<void> = Promise.resolve();
function persist(): Promise<void> {
  writeChain = writeChain.then(() => {
    writeFileSync(OUT, JSON.stringify([...byId.values()], null, 2));
  });
  return writeChain;
}

async function processEmployee(e: (typeof employees)[number]): Promise<void> {
  const { system, user } = buildExtractionPrompt({ rubric, level: e.level, review: e.review, rating: e.rating });
  const runs: { extraction: ReturnType<typeof filterQuotes>["extraction"]; dropped: string[]; model: string }[] = [];
  for (let i = 0; i < RUNS; i++) {
    const { raw, model } = await runHeadless(system, user);
    const { extraction, dropped } = filterQuotes(raw, e.review);
    runs.push({ extraction, dropped, model });
    console.log(`${e.id} run ${i + 1}: strength=${extraction.strength} suff=${extraction.sufficiency} items=${extraction.evidence.length} dropped=${dropped.length}`);
  }
  byId.set(e.id, {
    employeeId: e.id,
    model: runs[0].model,
    extraction: runs[0].extraction,
    strengthByRun: runs.map((r) => r.extraction.strength),
    droppedQuotes: runs.flatMap((r) => r.dropped),
  });
  await persist();
}

// Work list: in single-employee mode, always (re-)run that one employee; otherwise skip cached ones.
const todo = employees.filter((e) => (only ? e.id === only : !byId.has(e.id)));
if (!only) {
  for (const e of employees) if (byId.has(e.id)) console.log(`${e.id}: cached`);
}

/** Small worker pool: `concurrency` workers pull employees off a shared cursor; each employee's 3 runs stay sequential. */
async function runPool(items: typeof employees, concurrency: number): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    for (let e = items[next++]; e; e = items[next++]) {
      try {
        await processEmployee(e);
      } catch (err) {
        console.error(`${e.id}: FAILED — ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

await runPool(todo, CONCURRENCY);
console.log(`wrote ${OUT}`);
