# Calibration Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app that plots manager ratings against Claude-extracted evidence strength for a synthetic company, surfaces the cases worth discussing in a calibration meeting, and lets a facilitator drill into any employee, override evidence, see how other managers' bars would rate them, and re-run the extraction live.

**Architecture:** Pure-function scoring library (`src/lib`) shared by a Node precompute/eval script and the React UI; bundled JSON data (`data/`) produced by the script; a thin React layer (`src/components`, `src/state`) with one `useReducer` for overrides. No backend. Live re-run calls the Anthropic API directly from the browser with an in-memory key.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Tailwind 4 (`@tailwindcss/vite`), Recharts 3, zod 3.25, vitest 3, `@anthropic-ai/sdk` (structured outputs via `messages.parse` + `zodOutputFormat`), `tsx` for scripts, Netlify static deploy.

**Spec:** `docs/superpowers/specs/2026-09-13-calibration-map-design.md`

## Global Constraints

- Node is at `~/.nvm/versions/node/v22.22.3/bin` and not on the non-interactive PATH. **Every shell command in this plan is run as** `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && <command>`. The prefix is omitted below for brevity.
- Model ID for the browser SDK path: `claude-opus-5` (constant `MODEL` in `src/lib/anthropic.ts`). No `temperature` (rejected on this model). No prefill.
- **No API key is available during development.** The precompute runs through Claude Code headless mode (`claude -p … --json-schema …`) on the author's subscription; the recorded `model` field is whatever `claude -p` reports. The browser re-run is verified against a mock (success path) and the real API with a bogus key (401 path) only; the README says so.
- Rating scale: integers 1–4 = Below, Meets, Exceeds, Greatly Exceeds.
- Evidence item levels: `well_below | below | at | above | well_above` → −2..+2.
- Strength rule: `clamp(2 + mean, 1, 4)`, mean = average over dimensions present of the per-dimension average. Continuous.
- Manager fit shrinkage: weight `n / (n + 3)` toward the pooled fit; low-sufficiency points excluded from fits.
- Implied-rating band half-width: `max(0.5, s · sqrt(1/n + (x − xbar)² / sxx))`.
- API key: React state only. Never `localStorage`/`sessionStorage`. Browser client uses `dangerouslyAllowBrowser: true`.
- Extraction input never includes manager identity or other employees' reviews.
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01E8m6Cd3f4LnzdAYp4hAYNa
  ```
- Update `docs/TIMELOG.md` at the end of each task with the wall-clock time (`date "+%H:%M"`) and a one-line note.

---

## File structure

| Path | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `netlify.toml`, `index.html`, `src/main.tsx`, `src/index.css` | Scaffold |
| `data/rubric.json` | 4 dimensions × 3 levels × 3 bars + rating labels |
| `data/employees.json` | 6 managers (with ground-truth `style`), 30 employees (review, rating, optional `plant`) |
| `data/extractions.json` | Output of `scripts/extract.ts`: per employee, canonical extraction + `strengthByRun` |
| `data/eval-report.md` | Output of `scripts/eval.ts` |
| `src/lib/schema.ts` | zod schemas + TS types for rubric, employees, extraction; `filterQuotes()` |
| `src/lib/scoring.ts` | `strength`, `pooledFit`, `managerFit`, `impliedRating`, `agenda`, `managerSummary`, label helpers |
| `src/lib/prompt.ts` | `buildExtractionPrompt()` (system + user text) |
| `src/lib/anthropic.ts` | `MODEL`, `makeClient()`, `extractOne()` shared by script and browser |
| `src/lib/data.ts` | Loads the three JSON files, joins them into `Employee[]` with manager info |
| `scripts/extract.ts` | Precompute via `claude -p`: 3 runs per employee → `data/extractions.json` |
| `scripts/headless.ts` | `runHeadless(system, user)`: spawns `claude -p` with the JSON schema, parses and validates the result |
| `src/lib/mockExtract.ts` | Canned `extractOne`-shaped function for verifying the re-run UI without a key |
| `scripts/eval.ts` | Stability, quote fidelity, planted-truth checks → `data/eval-report.md` |
| `src/state/overrides.ts` | Reducer + `applyOverrides()` |
| `src/state/useDerived.ts` | Memoised: effective evidence → strengths → fits → agenda |
| `src/components/App.tsx` | Layout, selection state, key state |
| `src/components/TopBar.tsx` | Title, reading guide, key button |
| `src/components/CalibrationMap.tsx` | Recharts scatter + diagonal + manager fit lines + legend toggles |
| `src/components/Agenda.tsx` | Grouped ranked list + manager summaries |
| `src/components/Drilldown.tsx` | Header + `ReviewText` + `EvidenceList` + `OtherBars` + `Rerun` |
| `src/components/ReviewText.tsx` | Review with highlighted quotes |
| `src/components/EvidenceList.tsx` | Evidence rows with level dropdowns |
| `src/components/OtherBars.tsx` | Implied rating under each manager |
| `src/components/Rerun.tsx` | Live extraction + side-by-side diff |
| `src/components/KeyDialog.tsx` | API key entry (memory only) |
| `README.md`, `docs/RATIONALE.md` | Deliverables |

---

### Task 1: Scaffold, toolchain, deploy config

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/components/App.tsx`, `netlify.toml`, `.gitignore` (modify), `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev|build|test|extract|eval` scripts.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "calibration-map",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "extract": "tsx scripts/extract.ts",
    "eval": "tsx scripts/eval.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.80.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "recharts": "^3.1.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "tailwindcss": "^4.1.0",
    "tsx": "^4.20.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0",
    "zod-to-json-schema": "^3.24.0"
  }
}
```

If `npm install` reports that a pinned version does not exist, run `npm view <pkg> version` and use the latest published version instead; do not downgrade a major.

- [ ] **Step 2: Write config files**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

`tsconfig.node.json` is not needed with a single tsconfig; skip it. Add `/// <reference types="vitest/config" />` as the first line of `vite.config.ts` so the `test` key type-checks.

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Calibration Map</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:
```css
@import "tailwindcss";
```

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./components/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/components/App.tsx` (placeholder replaced in Task 11):
```tsx
export function App() {
  return <main className="p-6 text-slate-800">Calibration Map</main>;
}
```

Append to `.gitignore`:
```
node_modules/
dist/
.env
```

- [ ] **Step 3: Write a smoke test**

`src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Install and verify**

Run: `npm install && npm test && npm run build`
Expected: install succeeds; `1 passed`; `dist/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Scaffold Vite + React + TS app with Tailwind, vitest, Netlify config"
```

---

### Task 2: Schemas, rubric, quote filter

**Files:**
- Create: `src/lib/schema.ts`, `src/lib/schema.test.ts`, `data/rubric.json`

**Interfaces:**
- Produces:
  ```ts
  export type Level = "well_below" | "below" | "at" | "above" | "well_above";
  export type Dimension = "impact" | "craft" | "collaboration" | "ownership";
  export type Sufficiency = "low" | "medium" | "high";
  export type EvidenceItem = { quote: string; dimension: Dimension; level: Level; rationale: string };
  export type Extraction = { strength: 1|2|3|4; sufficiency: Sufficiency; evidence: EvidenceItem[]; notes: string[] };
  export type Rubric = { dimensions: {id: Dimension; name: string; bars: Record<"L3"|"L4"|"L5", {below: string; at: string; above: string}>}[]; ratings: {value: 1|2|3|4; label: string}[] };
  export type ManagerStyle = "calibrated" | "lenient" | "harsh" | "verbose" | "nonnative" | "terse";
  export type Manager = { id: string; name: string; style: ManagerStyle };
  export type Plant = "over_rated" | "under_rated" | "contradictory" | "self_contradicting";
  export type EmployeeRecord = { id: string; name: string; level: "L3"|"L4"|"L5"; managerId: string; rating: 1|2|3|4; review: string; plant?: Plant };
  export type EmployeesFile = { managers: Manager[]; employees: EmployeeRecord[] };
  export type ExtractionRecord = { employeeId: string; model: string; extraction: Extraction; strengthByRun: number[]; droppedQuotes: string[] };
  export const ExtractionSchema: z.ZodType<Extraction>;  // zod object, used for structured output
  export const RubricSchema, EmployeesFileSchema, ExtractionRecordSchema;
  export function filterQuotes(ex: Extraction, review: string): { extraction: Extraction; dropped: string[] };
  ```

- [ ] **Step 1: Write failing tests**

`src/lib/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ExtractionSchema, filterQuotes, type Extraction } from "./schema";

const base: Extraction = {
  strength: 3,
  sufficiency: "high",
  evidence: [
    { quote: "led the migration", dimension: "impact", level: "above", rationale: "r" },
    { quote: "not in the text", dimension: "craft", level: "at", rationale: "r" },
  ],
  notes: [],
};

describe("ExtractionSchema", () => {
  it("accepts a valid extraction", () => {
    expect(ExtractionSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a bad level", () => {
    const bad = { ...base, evidence: [{ ...base.evidence[0], level: "great" }] };
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects strength outside 1-4", () => {
    expect(ExtractionSchema.safeParse({ ...base, strength: 5 }).success).toBe(false);
  });
});

describe("filterQuotes", () => {
  const review = "This year she led the migration of billing.";
  it("drops quotes that are not verbatim substrings", () => {
    const { extraction, dropped } = filterQuotes(base, review);
    expect(extraction.evidence.map((e) => e.quote)).toEqual(["led the migration"]);
    expect(dropped).toEqual(["not in the text"]);
  });
  it("forces sufficiency to low when every quote is dropped", () => {
    const { extraction } = filterQuotes({ ...base, evidence: [base.evidence[1]] }, review);
    expect(extraction.sufficiency).toBe("low");
    expect(extraction.evidence).toEqual([]);
  });
  it("matches quotes case-sensitively but ignores surrounding whitespace", () => {
    const ex = { ...base, evidence: [{ ...base.evidence[0], quote: "  led the migration " }] };
    expect(filterQuotes(ex, review).extraction.evidence[0].quote).toBe("led the migration");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: FAIL, cannot find module `./schema`.

- [ ] **Step 3: Implement `src/lib/schema.ts`**

```ts
import { z } from "zod";

export const LEVELS = ["well_below", "below", "at", "above", "well_above"] as const;
export const DIMENSIONS = ["impact", "craft", "collaboration", "ownership"] as const;
export const SUFFICIENCIES = ["low", "medium", "high"] as const;
export const MANAGER_STYLES = ["calibrated", "lenient", "harsh", "verbose", "nonnative", "terse"] as const;
export const PLANTS = ["over_rated", "under_rated", "contradictory", "self_contradicting"] as const;

export type Level = (typeof LEVELS)[number];
export type Dimension = (typeof DIMENSIONS)[number];
export type Sufficiency = (typeof SUFFICIENCIES)[number];
export type ManagerStyle = (typeof MANAGER_STYLES)[number];
export type Plant = (typeof PLANTS)[number];

const Rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const LevelKey = z.enum(["L3", "L4", "L5"]);

export const EvidenceItemSchema = z.object({
  quote: z.string().min(1),
  dimension: z.enum(DIMENSIONS),
  level: z.enum(LEVELS),
  rationale: z.string(),
});

export const ExtractionSchema = z.object({
  strength: Rating,
  sufficiency: z.enum(SUFFICIENCIES),
  evidence: z.array(EvidenceItemSchema),
  notes: z.array(z.string()),
});

export const RubricSchema = z.object({
  dimensions: z.array(
    z.object({
      id: z.enum(DIMENSIONS),
      name: z.string(),
      bars: z.record(LevelKey, z.object({ below: z.string(), at: z.string(), above: z.string() })),
    }),
  ),
  ratings: z.array(z.object({ value: Rating, label: z.string() })),
});

export const ManagerSchema = z.object({ id: z.string(), name: z.string(), style: z.enum(MANAGER_STYLES) });

export const EmployeeRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: LevelKey,
  managerId: z.string(),
  rating: Rating,
  review: z.string(),
  plant: z.enum(PLANTS).optional(),
});

export const EmployeesFileSchema = z.object({
  managers: z.array(ManagerSchema),
  employees: z.array(EmployeeRecordSchema),
});

export const ExtractionRecordSchema = z.object({
  employeeId: z.string(),
  model: z.string(),
  extraction: ExtractionSchema,
  strengthByRun: z.array(z.number()),
  droppedQuotes: z.array(z.string()),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type Manager = z.infer<typeof ManagerSchema>;
export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;
export type EmployeesFile = z.infer<typeof EmployeesFileSchema>;
export type ExtractionRecord = z.infer<typeof ExtractionRecordSchema>;
export type Rating = z.infer<typeof Rating>;

/** Keep only evidence whose quote is a verbatim substring of the review. */
export function filterQuotes(ex: Extraction, review: string): { extraction: Extraction; dropped: string[] } {
  const dropped: string[] = [];
  const evidence: EvidenceItem[] = [];
  for (const item of ex.evidence) {
    const quote = item.quote.trim();
    if (quote.length > 0 && review.includes(quote)) evidence.push({ ...item, quote });
    else dropped.push(item.quote);
  }
  const sufficiency = evidence.length === 0 ? "low" : ex.sufficiency;
  return { extraction: { ...ex, evidence, sufficiency }, dropped };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Write `data/rubric.json`**

```json
{
  "ratings": [
    { "value": 1, "label": "Below" },
    { "value": 2, "label": "Meets" },
    { "value": 3, "label": "Exceeds" },
    { "value": 4, "label": "Greatly Exceeds" }
  ],
  "dimensions": [
    {
      "id": "impact",
      "name": "Impact",
      "bars": {
        "L3": { "below": "Tasks slip or need rework; limited effect on team goals.", "at": "Delivers well-defined tasks reliably; contributes to team goals.", "above": "Delivers small projects end-to-end with measurable results." },
        "L4": { "below": "Delivers tasks but not scoped projects; results are hard to point to.", "at": "Owns and delivers scoped projects with measurable results.", "above": "Delivers cross-team projects; results visible beyond the team." },
        "L5": { "below": "Delivers projects but not at cross-team scope.", "at": "Leads cross-team projects with results visible across the org.", "above": "Shapes direction for multiple teams; results move org-level metrics." }
      }
    },
    {
      "id": "craft",
      "name": "Craft",
      "bars": {
        "L3": { "below": "Frequent defects; needs close review.", "at": "Solid code and tests with normal review.", "above": "Designs are sound with little guidance; catches others' defects." },
        "L4": { "below": "Designs need substantial correction in review.", "at": "Sound designs and implementations; handles ambiguity within the project.", "above": "Sets quality standards others adopt; anticipates failure modes." },
        "L5": { "below": "Designs are sound but do not raise the team's bar.", "at": "Raises quality across the team; designs hold up under scale.", "above": "Defines technical direction and standards across teams." }
      }
    },
    {
      "id": "collaboration",
      "name": "Collaboration",
      "bars": {
        "L3": { "below": "Hard to work with or unresponsive.", "at": "Communicates clearly; responsive to teammates.", "above": "Actively helps teammates; improves team communication." },
        "L4": { "below": "Works well alone but rarely lifts others.", "at": "Helps teammates; communicates well with partners.", "above": "Mentors others; resolves cross-team friction." },
        "L5": { "below": "Collaborates within the team but not across.", "at": "Mentors; builds working relationships across teams.", "above": "Multiplies other teams' effectiveness; sought out as a partner." }
      }
    },
    {
      "id": "ownership",
      "name": "Ownership",
      "bars": {
        "L3": { "below": "Waits to be told; drops the ball on follow-through.", "at": "Follows through on commitments; escalates blockers.", "above": "Takes initiative beyond assigned tasks." },
        "L4": { "below": "Needs prompting to follow through on project outcomes.", "at": "Owns project outcomes, including unplanned problems.", "above": "Owns outcomes beyond own project; fixes what nobody assigned." },
        "L5": { "below": "Owns own projects but not team-level outcomes.", "at": "Owns team-level outcomes and long-term health.", "above": "Owns org-level outcomes; drives change without a mandate." }
      }
    }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts src/lib/schema.test.ts data/rubric.json && git commit -m "Add zod schemas, quote-fidelity filter, and rubric data"
```

---

### Task 3: Scoring — `strength()`

**Files:**
- Create: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: `EvidenceItem`, `Level`, `Dimension` from `./schema`.
- Produces:
  ```ts
  export const LEVEL_VALUE: Record<Level, number>; // -2..2
  export function strength(evidence: EvidenceItem[]): number | null; // null when no evidence
  export function clamp(x: number, lo: number, hi: number): number;
  export function ratingLabel(x: number, ratings: {value: number; label: string}[]): string; // rounds
  ```

- [ ] **Step 1: Write failing tests**

`src/lib/scoring.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { strength, ratingLabel } from "./scoring";
import type { EvidenceItem } from "./schema";

const ev = (dimension: EvidenceItem["dimension"], level: EvidenceItem["level"]): EvidenceItem => ({
  quote: "q", dimension, level, rationale: "",
});
const RATINGS = [
  { value: 1, label: "Below" }, { value: 2, label: "Meets" }, { value: 3, label: "Exceeds" }, { value: 4, label: "Greatly Exceeds" },
];

describe("strength", () => {
  it("is 2 when everything is at the bar", () => {
    expect(strength([ev("impact", "at"), ev("craft", "at")])).toBe(2);
  });
  it("is 4 when everything is well above", () => {
    expect(strength([ev("impact", "well_above"), ev("ownership", "well_above")])).toBe(4);
  });
  it("is 3 when everything is above", () => {
    expect(strength([ev("impact", "above")])).toBe(3);
  });
  it("averages within a dimension before averaging across dimensions", () => {
    // impact: 3 quotes all "above" (+1 each) -> +1 ; craft: one "below" (-1) -> mean 0 -> 2
    const items = [ev("impact", "above"), ev("impact", "above"), ev("impact", "above"), ev("craft", "below")];
    expect(strength(items)).toBe(2);
  });
  it("clamps to [1,4]", () => {
    expect(strength([ev("impact", "well_below"), ev("craft", "well_below")])).toBe(1);
  });
  it("returns null with no evidence", () => {
    expect(strength([])).toBeNull();
  });
});

describe("ratingLabel", () => {
  it("rounds to the nearest rating", () => {
    expect(ratingLabel(2.4, RATINGS)).toBe("Meets");
    expect(ratingLabel(2.6, RATINGS)).toBe("Exceeds");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL, cannot find module `./scoring`.

- [ ] **Step 3: Implement**

`src/lib/scoring.ts`:
```ts
import type { Dimension, EvidenceItem, Level } from "./schema";

export const LEVEL_VALUE: Record<Level, number> = {
  well_below: -2, below: -1, at: 0, above: 1, well_above: 2,
};

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Evidence-implied rating on the 1-4 scale. Continuous. Null when there is no evidence. */
export function strength(evidence: EvidenceItem[]): number | null {
  if (evidence.length === 0) return null;
  const byDim = new Map<Dimension, number[]>();
  for (const e of evidence) {
    const arr = byDim.get(e.dimension) ?? [];
    arr.push(LEVEL_VALUE[e.level]);
    byDim.set(e.dimension, arr);
  }
  const dimMeans = [...byDim.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
  const mean = dimMeans.reduce((a, b) => a + b, 0) / dimMeans.length;
  return clamp(2 + mean, 1, 4);
}

export function ratingLabel(x: number, ratings: { value: number; label: string }[]): string {
  const v = clamp(Math.round(x), 1, 4);
  return ratings.find((r) => r.value === v)?.label ?? String(v);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts && git commit -m "Add strength rule and rating label helper"
```

---

### Task 4: Scoring — manager fits and implied rating

**Files:**
- Modify: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Point = { x: number; y: number };            // x = strength, y = rating
  export type Fit = { a: number; b: number; n: number; s: number; xbar: number; sxx: number };
  export const SHRINK_K = 3;
  export function olsFit(points: Point[]): { a: number; b: number; xbar: number; sxx: number } | null; // null if n<2 or sxx==0
  export function pooledFit(points: Point[]): Fit | null;
  export function managerFit(own: Point[], pooled: Fit | null): Fit | null; // null when own.length === 0
  export function impliedRating(x: number, fit: Fit): { estimate: number; low: number; high: number; halfWidth: number };
  ```

- [ ] **Step 1: Write failing tests** (append to `src/lib/scoring.test.ts`)

```ts
import { olsFit, pooledFit, managerFit, impliedRating, type Point } from "./scoring";

const diag: Point[] = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 2.5, y: 2.5 }];

describe("olsFit", () => {
  it("recovers a perfect line", () => {
    const f = olsFit(diag)!;
    expect(f.b).toBeCloseTo(1);
    expect(f.a).toBeCloseTo(0);
  });
  it("returns null for n<2 or constant x", () => {
    expect(olsFit([{ x: 2, y: 3 }])).toBeNull();
    expect(olsFit([{ x: 2, y: 3 }, { x: 2, y: 1 }])).toBeNull();
  });
});

describe("managerFit", () => {
  const pooled = pooledFit(diag)!;
  it("shrinks toward the pooled fit with weight n/(n+3)", () => {
    // own: 5 points, all rated +1 above evidence -> own a=1, b=1 ; pooled a=0,b=1
    const own = diag.map((p) => ({ x: p.x, y: Math.min(4, p.y + 1) })).filter((p) => p.y <= 4);
    const f = managerFit(own, pooled)!;
    const w = own.length / (own.length + 3);
    const ownFit = olsFit(own)!;
    expect(f.b).toBeCloseTo(w * ownFit.b + (1 - w) * pooled.b);
    expect(f.a).toBeCloseTo(w * ownFit.a + (1 - w) * pooled.a);
    expect(f.n).toBe(own.length);
  });
  it("uses the pooled slope when own x is constant, keeps own n", () => {
    const f = managerFit([{ x: 2, y: 3 }, { x: 2, y: 4 }], pooled)!;
    expect(f.b).toBeCloseTo(pooled.b);
    expect(f.n).toBe(2);
  });
  it("returns null with no usable points", () => {
    expect(managerFit([], pooled)).toBeNull();
  });
  it("falls back to pooled s and sxx when n < 3", () => {
    const f = managerFit([{ x: 2, y: 2 }], pooled)!;
    expect(f.s).toBeCloseTo(pooled.s);
    expect(f.sxx).toBeCloseTo(pooled.sxx);
  });
});

describe("impliedRating", () => {
  const fit = { a: 0, b: 1, n: 5, s: 0.4, xbar: 2.5, sxx: 5 };
  it("floors the half-width at 0.5", () => {
    const r = impliedRating(2.5, fit);
    expect(r.estimate).toBeCloseTo(2.5);
    expect(r.halfWidth).toBe(0.5);
  });
  it("widens when extrapolating away from xbar", () => {
    const wide = { ...fit, s: 1.2 };
    expect(impliedRating(4, wide).halfWidth).toBeGreaterThan(impliedRating(2.5, wide).halfWidth);
  });
  it("clamps the range to [1,4]", () => {
    const r = impliedRating(4, fit);
    expect(r.high).toBeLessThanOrEqual(4);
    expect(r.low).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL, `olsFit` is not exported.

- [ ] **Step 3: Implement** (append to `src/lib/scoring.ts`)

```ts
export type Point = { x: number; y: number };
export type Fit = { a: number; b: number; n: number; s: number; xbar: number; sxx: number };
export const SHRINK_K = 3;

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

export function olsFit(points: Point[]): { a: number; b: number; xbar: number; sxx: number } | null {
  if (points.length < 2) return null;
  const xbar = mean(points.map((p) => p.x));
  const ybar = mean(points.map((p) => p.y));
  let sxx = 0, sxy = 0;
  for (const p of points) { sxx += (p.x - xbar) ** 2; sxy += (p.x - xbar) * (p.y - ybar); }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: ybar - b * xbar, b, xbar, sxx };
}

function residualSE(points: Point[], a: number, b: number): number {
  const df = Math.max(points.length - 2, 1);
  const ss = points.reduce((acc, p) => acc + (p.y - (a + b * p.x)) ** 2, 0);
  return Math.sqrt(ss / df);
}

export function pooledFit(points: Point[]): Fit | null {
  const f = olsFit(points);
  if (!f) return null;
  return { ...f, n: points.length, s: residualSE(points, f.a, f.b) };
}

/** A manager's fit, shrunk toward the pooled fit with weight n/(n+k). */
export function managerFit(own: Point[], pooled: Fit | null): Fit | null {
  const n = own.length;
  if (n === 0) return null;
  const w = n / (n + SHRINK_K);
  const ownFit = olsFit(own);
  const xbar = mean(own.map((p) => p.x));
  const ybar = mean(own.map((p) => p.y));
  // Fallback when the pooled fit is unavailable: a horizontal line at the manager's mean rating.
  const base = pooled ?? { a: ybar, b: 0, n, s: 0, xbar, sxx: 1 };
  let a: number, b: number;
  if (ownFit) {
    a = w * ownFit.a + (1 - w) * base.a;
    b = w * ownFit.b + (1 - w) * base.b;
  } else {
    // slope undefined: use the base slope, shrink the intercept implied by the manager's mean
    b = base.b;
    a = w * (ybar - b * xbar) + (1 - w) * base.a;
  }
  const sxx = ownFit ? ownFit.sxx : base.sxx;
  const s = n >= 3 ? residualSE(own, a, b) : base.s;
  return { a, b, n, s, xbar, sxx };
}

export function impliedRating(x: number, fit: Fit): { estimate: number; low: number; high: number; halfWidth: number } {
  const estimate = fit.a + fit.b * x;
  const se = fit.s * Math.sqrt(1 / fit.n + (x - fit.xbar) ** 2 / fit.sxx);
  const halfWidth = Math.max(0.5, se);
  return { estimate, halfWidth, low: clamp(estimate - halfWidth, 1, 4), high: clamp(estimate + halfWidth, 1, 4) };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: all pass (17).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts && git commit -m "Add pooled/manager fits with shrinkage and implied-rating bands"
```

---

### Task 5: Scoring — agenda and manager summaries

**Files:**
- Modify: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Scored = { id: string; name: string; managerId: string; rating: number; strength: number | null; sufficiency: Sufficiency };
  export type AgendaGroup = "discuss" | "more_input" | "consistent";
  export type AgendaRow = { id: string; group: AgendaGroup; gap: number; reason: string };
  export function agenda(rows: Scored[], ratings: {value:number;label:string}[]): AgendaRow[]; // sorted: discuss by |gap| desc, then more_input, then consistent
  export function usablePoints(rows: Scored[]): Point[]; // sufficiency != low && strength != null
  export function managerSummary(fit: Fit | null, own: Scored[]): string;
  ```

- [ ] **Step 1: Write failing tests** (append)

```ts
import { agenda, managerSummary, usablePoints, type Scored } from "./scoring";

const S = (id: string, rating: number, strength: number | null, sufficiency: Scored["sufficiency"] = "high"): Scored =>
  ({ id, name: id, managerId: "m1", rating, strength, sufficiency });

describe("agenda", () => {
  it("groups and orders rows", () => {
    const rows = agenda([S("a", 3, 2), S("b", 2, 2.1), S("c", 2, 1.5, "low"), S("d", 4, 2)], RATINGS);
    expect(rows.map((r) => [r.id, r.group])).toEqual([
      ["d", "discuss"], ["a", "discuss"], ["c", "more_input"], ["b", "consistent"],
    ]);
  });
  it("writes a reason sentence", () => {
    const [row] = agenda([S("a", 3, 2)], RATINGS);
    expect(row.reason).toBe("Rated Exceeds; evidence reads as Meets.");
    const [more] = agenda([S("c", 2, 1.5, "low")], RATINGS);
    expect(more.reason).toBe("Review gives too little evidence to judge.");
  });
  it("treats null strength as more_input", () => {
    expect(agenda([S("z", 2, null, "high")], RATINGS)[0].group).toBe("more_input");
  });
});

describe("managerSummary", () => {
  it("describes offset", () => {
    const own = [S("a", 3, 2), S("b", 4, 3), S("c", 3, 2.2)];
    expect(managerSummary({ a: 1, b: 1, n: 3, s: 0.1, xbar: 2.4, sxx: 1 }, own)).toBe("runs +0.9 above evidence");
  });
  it("describes slope when offset is small", () => {
    const own = [S("a", 1, 2), S("b", 4, 3)];
    expect(managerSummary({ a: -3, b: 2, n: 2, s: 0.1, xbar: 2.5, sxx: 1 }, own)).toBe("stretches the scale: harsh at the bottom, generous at the top");
  });
  it("says on the diagonal otherwise", () => {
    expect(managerSummary({ a: 0.1, b: 1, n: 5, s: 0.1, xbar: 2.5, sxx: 1 }, [S("a", 2, 2)])).toBe("on the diagonal");
  });
  it("handles no fit", () => {
    expect(managerSummary(null, [])).toBe("not enough evidence to infer this manager's bar");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL, `agenda` not exported.

- [ ] **Step 3: Implement** (append)

```ts
import type { Sufficiency } from "./schema";

export type Scored = { id: string; name: string; managerId: string; rating: number; strength: number | null; sufficiency: Sufficiency };
export type AgendaGroup = "discuss" | "more_input" | "consistent";
export type AgendaRow = { id: string; group: AgendaGroup; gap: number; reason: string };

export function usablePoints(rows: Scored[]): Point[] {
  return rows.filter((r) => r.sufficiency !== "low" && r.strength !== null).map((r) => ({ x: r.strength as number, y: r.rating }));
}

export function agenda(rows: Scored[], ratings: { value: number; label: string }[]): AgendaRow[] {
  const out: AgendaRow[] = rows.map((r) => {
    if (r.sufficiency === "low" || r.strength === null) {
      return { id: r.id, group: "more_input", gap: 0, reason: "Review gives too little evidence to judge." };
    }
    const gap = r.rating - r.strength;
    const rated = ratingLabel(r.rating, ratings);
    const ev = ratingLabel(r.strength, ratings);
    if (Math.abs(gap) >= 1) {
      return { id: r.id, group: "discuss", gap, reason: `Rated ${rated}; evidence reads as ${ev}.` };
    }
    return { id: r.id, group: "consistent", gap, reason: `Rated ${rated}; evidence agrees.` };
  });
  const order: Record<AgendaGroup, number> = { discuss: 0, more_input: 1, consistent: 2 };
  return out.sort((p, q) => order[p.group] - order[q.group] || Math.abs(q.gap) - Math.abs(p.gap));
}

export function managerSummary(fit: Fit | null, own: Scored[]): string {
  if (!fit) return "not enough evidence to infer this manager's bar";
  const usable = own.filter((r) => r.sufficiency !== "low" && r.strength !== null);
  const offset = usable.length ? mean(usable.map((r) => r.rating - (r.strength as number))) : 0;
  if (Math.abs(offset) >= 0.3) {
    const sign = offset > 0 ? "+" : "−";
    return `runs ${sign}${Math.abs(offset).toFixed(1)} ${offset > 0 ? "above" : "below"} evidence`;
  }
  if (fit.b >= 1.3) return "stretches the scale: harsh at the bottom, generous at the top";
  if (fit.b <= 0.7) return "compresses the scale: rates everyone near the middle";
  return "on the diagonal";
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts && git commit -m "Add agenda ranking and manager summaries"
```

---

### Task 6: Synthetic company data

**Files:**
- Create: `data/employees.json`, `src/lib/data.test.ts`

**Interfaces:**
- Produces: `data/employees.json` matching `EmployeesFileSchema`.

**Author note:** the reviews are written by Claude in the session and hand-edited by the author. Manager names were assigned to styles from a shuffled list; no name is meant to signal the style. Employee names: pick 30 distinct, varied names.

- [ ] **Step 1: Write the validation test**

`src/lib/data.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EmployeesFileSchema, RubricSchema } from "./schema";

const employees = EmployeesFileSchema.parse(JSON.parse(readFileSync("data/employees.json", "utf8")));
const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));

describe("employees.json", () => {
  it("has 6 managers with distinct styles and 30 employees, 5 per manager", () => {
    expect(employees.managers).toHaveLength(6);
    expect(new Set(employees.managers.map((m) => m.style)).size).toBe(6);
    expect(employees.employees).toHaveLength(30);
    for (const m of employees.managers) {
      expect(employees.employees.filter((e) => e.managerId === m.id)).toHaveLength(5);
    }
  });
  it("has unique ids and names", () => {
    expect(new Set(employees.employees.map((e) => e.id)).size).toBe(30);
    expect(new Set(employees.employees.map((e) => e.name)).size).toBe(30);
  });
  it("plants each case type at least once, none on the terse manager", () => {
    const terse = employees.managers.find((m) => m.style === "terse")!.id;
    const plants = employees.employees.filter((e) => e.plant);
    expect(new Set(plants.map((e) => e.plant)).size).toBe(4);
    expect(plants.every((e) => e.managerId !== terse)).toBe(true);
  });
  it("terse reviews are short, verbose reviews are long", () => {
    const byStyle = (s: string) => employees.employees.filter((e) => e.managerId === employees.managers.find((m) => m.style === s)!.id);
    for (const e of byStyle("terse")) expect(e.review.split(/\s+/).length).toBeLessThan(45);
    for (const e of byStyle("verbose")) expect(e.review.split(/\s+/).length).toBeGreaterThan(180);
  });
  it("rubric has 4 dimensions with all three levels", () => {
    expect(rubric.dimensions).toHaveLength(4);
    for (const d of rubric.dimensions) expect(Object.keys(d.bars).sort()).toEqual(["L3", "L4", "L5"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/data.test.ts`
Expected: FAIL, `data/employees.json` not found.

- [ ] **Step 3: Write `data/employees.json`**

Managers (ids `m1`–`m6`):

| id | name | style | Ground truth for the eval |
|---|---|---|---|
| m1 | Priya Nair | calibrated | ratings equal evidence |
| m2 | Tom Whitaker | lenient | ratings ≈ evidence + 1 (capped at 4) |
| m3 | Marcus Bell | harsh | ratings ≈ evidence − 1 (floored at 1) |
| m4 | Sofia Ramos | verbose | 200–280 words each, adjectives and enthusiasm, almost no concrete examples; ratings 3 for all five |
| m5 | Lena Fischer | nonnative | 120–180 words, rough grammar, odd word order, some direct translations; the *work* described is concrete and solid (true quality: two at Exceeds, three at Meets); ratings match true quality |
| m6 | Omar Haddad | terse | ≤ 40 words, no examples; ratings 2,2,3,2,3 |

Employees: ids `e01`–`e30`, five per manager in order (m1: e01–e05, m2: e06–e10, …). Levels mixed: per manager use L3, L3, L4, L4, L5. Each review is written in the manager's style and describes concrete work at a chosen **true quality** (1–4). Rating = true quality adjusted by the manager's style. Reviews are 120–200 words unless the style says otherwise.

Plants (all on m1, m2, m3, m4 or m5, never m6):
- `e03` (m1, L4): `over_rated` — rating 3, review describes clearly Meets-level work (scoped project delivered on time, nothing beyond it).
- `e08` (m2, L4): `under_rated` — rating 2, review describes cross-team delivery with numbers and mentoring (Exceeds-level).
- `e13` (m3, L5): `contradictory` — strong Impact and Ownership evidence, clearly Below-bar Collaboration evidence (two partner teams escalated); rating 2.
- `e19` (m4, L4): `self_contradicting` — the review both praises "always ships on time" and later notes "the two biggest deliverables slipped a quarter"; rating 3.

Style guides with one complete example each:

*Calibrated (m1), true quality 3, L4:*
> Dana led the migration of the billing service off the legacy queue, cutting p95 latency from 800ms to 120ms with no customer-facing incidents. She scoped the project herself and kept the two dependent teams informed through weekly notes, which is why the cutover went smoothly. Her design doc missed the retry semantics and we caught it late in review; she fixed it within the sprint and added a test suite for it. She mentored the two new grads through their first on-call rotations, and both said her runbook was the reason they felt ready. Where she can grow: she still waits for me to bring cross-team problems to her rather than picking them up herself. Overall a clear Exceeds for an L4 this year.

*Non-native English (m5), true quality 3, L4:*
> Jonas make this year the new export pipeline, which before was many manual steps and now is one job that run every night. This is used by the finance team, they told me it save them around one day per week. He found himself that old pipeline lose rows when the file was too big, nobody ask him to look at this, and he fix it and write a document how it works. In the design review he was not so good to explain why his choice is better, people were confused, but the design itself was correct and we used it. With the new colleagues he is patient and explain many times. For me he is more than what we expect from L4, I give Exceeds.

*Terse (m6), true quality unknown, L3:*
> Solid year. Did the work that was asked, no complaints from the team. Meets.

*Verbose-but-vague (m4), true quality unknown, L4 (excerpt of the required 200+ words):*
> Ravi has been an absolute pleasure to have on the team this year and I cannot say enough good things about his attitude, his energy, and the way he lifts everyone around him. He is the kind of engineer every manager hopes to have: positive, dependable, always willing to jump in… (continue in this register; mention "many projects", "countless improvements", "huge impact" without naming a single project, number, or incident).

Write all 30 reviews following the table and style guides, then `data/employees.json`:
```json
{
  "managers": [
    { "id": "m1", "name": "Priya Nair", "style": "calibrated" },
    { "id": "m2", "name": "Tom Whitaker", "style": "lenient" },
    { "id": "m3", "name": "Marcus Bell", "style": "harsh" },
    { "id": "m4", "name": "Sofia Ramos", "style": "verbose" },
    { "id": "m5", "name": "Lena Fischer", "style": "nonnative" },
    { "id": "m6", "name": "Omar Haddad", "style": "terse" }
  ],
  "employees": [
    { "id": "e01", "name": "Dana Kowalski", "level": "L4", "managerId": "m1", "rating": 3, "review": "Dana led the migration ..." }
  ]
}
```

- [ ] **Step 4: Run the validation test**

Run: `npx vitest run src/lib/data.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add data/employees.json src/lib/data.test.ts && git commit -m "Add synthetic company: 6 manager styles, 30 reviews, planted cases"
```

---

### Task 7: Prompt and Anthropic client wrapper

**Files:**
- Create: `src/lib/prompt.ts`, `src/lib/prompt.test.ts`, `src/lib/anthropic.ts`

**Interfaces:**
- Consumes: `Rubric`, `ExtractionSchema`, `filterQuotes` from `./schema`.
- Produces:
  ```ts
  // prompt.ts
  export type ExtractionInput = { rubric: Rubric; level: "L3"|"L4"|"L5"; review: string; rating: 1|2|3|4 };
  export function buildExtractionPrompt(input: ExtractionInput): { system: string; user: string };
  // anthropic.ts
  export const MODEL = "claude-opus-5";
  export function makeClient(opts: { apiKey?: string; browser?: boolean }): Anthropic;
  export async function extractOne(client: Anthropic, input: ExtractionInput): Promise<{ extraction: Extraction; dropped: string[]; raw: Extraction }>;
  ```

- [ ] **Step 1: Write failing tests**

`src/lib/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildExtractionPrompt } from "./prompt";
import { RubricSchema } from "./schema";

const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));

describe("buildExtractionPrompt", () => {
  const p = buildExtractionPrompt({ rubric, level: "L4", review: "She led the migration.", rating: 3 });
  it("includes only the employee's level bars", () => {
    expect(p.user).toContain("Owns and delivers scoped projects");
    expect(p.user).not.toContain("Leads cross-team projects");
  });
  it("includes the review and the manager's rating label", () => {
    expect(p.user).toContain("She led the migration.");
    expect(p.user).toContain("Exceeds");
  });
  it("instructs to judge the work, not the writing, and to prefer low sufficiency over guessing", () => {
    expect(p.system).toMatch(/not the quality of the writing/i);
    expect(p.system).toMatch(/sufficiency/i);
  });
  it("never mentions a manager name field", () => {
    expect(p.user).not.toMatch(/manager name/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/prompt.test.ts`
Expected: FAIL, cannot find module `./prompt`.

- [ ] **Step 3: Implement `src/lib/prompt.ts`**

```ts
import type { Rubric } from "./schema";

export type ExtractionInput = { rubric: Rubric; level: "L3" | "L4" | "L5"; review: string; rating: 1 | 2 | 3 | 4 };

export function buildExtractionPrompt(input: ExtractionInput): { system: string; user: string } {
  const { rubric, level, review, rating } = input;
  const ratingLabel = rubric.ratings.find((r) => r.value === rating)?.label ?? String(rating);

  const system = `You are helping a performance-calibration facilitator check whether written reviews support their ratings.

You will get one rubric (four dimensions, with the bar for the employee's level), one written review, and the rating the manager gave.

Your job:
1. Extract every concrete piece of evidence about the employee's work. Each item must be a verbatim quote copied exactly from the review text, tagged with one rubric dimension and a level relative to the bar for this employee's level: well_below, below, at, above, well_above.
2. Judge the work described, not the quality of the writing. Rough grammar, short sentences, or awkward phrasing say nothing about the employee. Enthusiastic adjectives without a concrete example are not evidence.
3. Set "sufficiency" to how much the text supports any conclusion: high (several concrete examples across dimensions), medium (some concrete examples), low (little or nothing concrete). When the review gives too little to judge, return low sufficiency rather than guessing.
4. Set "strength" to the rating (1 Below, 2 Meets, 3 Exceeds, 4 Greatly Exceeds) that the evidence alone would justify. Do not anchor on the manager's rating; it is provided only so you can note in "notes" if the text contradicts it.
5. Put anything unusual in "notes": contradictory evidence, the review contradicting itself, praise with no examples, unclear passages.

Only quote text that appears verbatim in the review. Do not paraphrase inside "quote".`;

  const bars = rubric.dimensions
    .map((d) => `${d.name} (${d.id})\n  below the bar: ${d.bars[level]!.below}\n  at the bar: ${d.bars[level]!.at}\n  above the bar: ${d.bars[level]!.above}`)
    .join("\n\n");

  const user = `Employee level: ${level}

Rubric bars for ${level}:

${bars}

Rating scale: ${rubric.ratings.map((r) => `${r.value} = ${r.label}`).join(", ")}

Manager's rating: ${rating} (${ratingLabel})

Review text:
<review>
${review}
</review>`;

  return { system, user };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/prompt.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Implement `src/lib/anthropic.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractionSchema, filterQuotes, type Extraction } from "./schema";
import { buildExtractionPrompt, type ExtractionInput } from "./prompt";

export const MODEL = "claude-opus-5";

export function makeClient(opts: { apiKey?: string; browser?: boolean } = {}): Anthropic {
  return new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: opts.browser === true,
  });
}

/** One extraction call. Returns the quote-filtered extraction plus the raw model output. */
export async function extractOne(
  client: Anthropic,
  input: ExtractionInput,
): Promise<{ extraction: Extraction; dropped: string[]; raw: Extraction }> {
  const { system, user } = buildExtractionPrompt(input);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });
  if (response.stop_reason === "refusal") throw new Error("Model declined the request.");
  const raw = response.parsed_output;
  if (!raw) throw new Error("Model output did not match the schema.");
  const { extraction, dropped } = filterQuotes(raw, input.review);
  return { extraction, dropped, raw };
}
```

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass. If `zodOutputFormat` import path errors, check `node_modules/@anthropic-ai/sdk/helpers/zod` exists and adjust the import per the installed SDK's `package.json` `exports`.

```bash
git add src/lib/prompt.ts src/lib/prompt.test.ts src/lib/anthropic.ts && git commit -m "Add extraction prompt and Anthropic client wrapper with structured output"
```

---

### Task 8: Precompute script (Claude Code headless)

**Files:**
- Create: `scripts/headless.ts`, `scripts/headless.test.ts`, `scripts/extract.ts`, `data/extractions.json` (generated)

**Interfaces:**
- Consumes: `buildExtractionPrompt`; `ExtractionSchema`, `filterQuotes`, `EmployeesFileSchema`, `RubricSchema`, `ExtractionRecord`.
- Produces:
  ```ts
  // headless.ts
  export function parseHeadlessOutput(stdout: string): { structured: unknown; model: string | null };
  export async function runHeadless(system: string, user: string): Promise<{ raw: Extraction; model: string }>;
  ```
  and `data/extractions.json` = `ExtractionRecord[]` with `strengthByRun` of length 3.

- [ ] **Step 1: Probe the headless output shape**

Run:
```bash
claude -p "Return the number 4 as the value of field n." --output-format json --json-schema '{"type":"object","properties":{"n":{"type":"number"}},"required":["n"],"additionalProperties":false}' --model opus 2>&1 | head -40
```
Expected: a JSON object. Note (a) which field holds the schema-validated object (look for `structured_output`; if absent, the `result` field holds a JSON string) and (b) which field names the model (look for `model`, or `modelUsage` keys). Write both down; the parser in Step 3 targets them, and the test in Step 2 pins them.

- [ ] **Step 2: Write the failing parser test**

`scripts/headless.test.ts` (replace the sample with the real shape from Step 1):
```ts
import { describe, it, expect } from "vitest";
import { parseHeadlessOutput } from "./headless";

describe("parseHeadlessOutput", () => {
  it("extracts the structured object and the model name", () => {
    const sample = JSON.stringify({ type: "result", structured_output: { n: 4 }, modelUsage: { "claude-opus-5": { inputTokens: 1 } } });
    const out = parseHeadlessOutput(sample);
    expect(out.structured).toEqual({ n: 4 });
    expect(out.model).toBe("claude-opus-5");
  });
  it("falls back to parsing result as JSON text", () => {
    const sample = JSON.stringify({ type: "result", result: "{\"n\":4}" });
    expect(parseHeadlessOutput(sample).structured).toEqual({ n: 4 });
  });
  it("throws on non-JSON", () => {
    expect(() => parseHeadlessOutput("not json")).toThrow();
  });
});
```

Run: `npx vitest run scripts/headless.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement `scripts/headless.ts`**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ExtractionSchema, type Extraction } from "../src/lib/schema";

const exec = promisify(execFile);
const SCHEMA = JSON.stringify(zodToJsonSchema(ExtractionSchema, { target: "openAi" }));

export function parseHeadlessOutput(stdout: string): { structured: unknown; model: string | null } {
  const obj = JSON.parse(stdout) as Record<string, unknown>;
  let structured: unknown = obj.structured_output;
  if (structured === undefined && typeof obj.result === "string") structured = JSON.parse(obj.result);
  const usage = obj.modelUsage as Record<string, unknown> | undefined;
  const model = typeof obj.model === "string" ? obj.model : usage ? Object.keys(usage)[0] ?? null : null;
  return { structured, model };
}

/** One extraction through `claude -p`. Each call is a fresh process, so repeated runs are independent samples. */
export async function runHeadless(system: string, user: string): Promise<{ raw: Extraction; model: string }> {
  const args = [
    "-p", user,
    "--system-prompt", system,
    "--output-format", "json",
    "--json-schema", SCHEMA,
    "--model", "opus",
    "--tools", "",          // no tool use: pure text-in, JSON-out
    "--max-turns", "1",
  ];
  const { stdout } = await exec("claude", args, { maxBuffer: 10 * 1024 * 1024 });
  const { structured, model } = parseHeadlessOutput(stdout);
  const raw = ExtractionSchema.parse(structured);
  return { raw, model: model ?? "claude (headless, model not reported)" };
}
```

If `--system-prompt`, `--tools`, or `--max-turns` is not accepted by the installed `claude`, run `claude -p --help` and use the equivalent flag (e.g. `--append-system-prompt`, `--allowedTools ""`); the intent is: system text supplied separately, no tools, single turn.

Run: `npx vitest run scripts/headless.test.ts` → 3 passed.

- [ ] **Step 4: Write `scripts/extract.ts`**

```ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { EmployeesFileSchema, RubricSchema, filterQuotes, type ExtractionRecord } from "../src/lib/schema";
import { buildExtractionPrompt } from "../src/lib/prompt";
import { runHeadless } from "./headless";

const RUNS = 3;
const OUT = "data/extractions.json";

const rubric = RubricSchema.parse(JSON.parse(readFileSync("data/rubric.json", "utf8")));
const { employees } = EmployeesFileSchema.parse(JSON.parse(readFileSync("data/employees.json", "utf8")));
const only = process.argv[2]; // optional employee id to re-run a single one

const existing: ExtractionRecord[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((r) => [r.employeeId, r]));

for (const e of employees) {
  if (only && e.id !== only) continue;
  if (!only && byId.has(e.id)) { console.log(`${e.id}: cached`); continue; }
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
  writeFileSync(OUT, JSON.stringify([...byId.values()], null, 2));
}
console.log(`wrote ${OUT}`);
```

- [ ] **Step 5: Run one employee first, then all**

Run: `npm run extract e01` and read the three lines and the written record. If the model returned no evidence for a review that clearly has some, or quotes are all dropped, fix the prompt before running the rest.
Then: `npm run extract` (90 headless calls; expect several minutes). Spot-check: the terse manager's employees show `suff=low`; the calibrated manager's show `high`.

- [ ] **Step 6: Commit**

```bash
git add scripts/headless.ts scripts/headless.test.ts scripts/extract.ts data/extractions.json && git commit -m "Precompute extractions via Claude Code headless mode (3 runs per review)"
```

---

### Task 9: Eval script and report

**Files:**
- Create: `scripts/eval.ts`, `scripts/eval-checks.ts`, `scripts/eval-checks.test.ts`, `data/eval-report.md` (generated)

**Interfaces:**
- Consumes: scoring functions, schemas, data files.
- Produces:
  ```ts
  // eval-checks.ts
  export type Joined = { emp: EmployeeRecord; manager: Manager; rec: ExtractionRecord; ruleStrength: number | null };
  export function stability(recs: ExtractionRecord[]): { identical: number; total: number; maxSpread: Record<number, number> };
  export function quoteFidelity(recs: ExtractionRecord[]): { kept: number; dropped: number };
  export function ruleVsModel(rows: Joined[]): { agreeWithinHalf: number; total: number };
  export function managerOffsets(rows: Joined[]): Record<string, { style: ManagerStyle; offset: number; n: number }>;
  export function plantedChecks(rows: Joined[], agendaRows: AgendaRow[]): { name: string; pass: boolean; detail: string }[];
  ```

- [ ] **Step 1: Write failing tests for the checks**

`scripts/eval-checks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stability, quoteFidelity } from "./eval-checks";
import type { ExtractionRecord } from "../src/lib/schema";

const rec = (id: string, runs: number[], dropped: string[] = []): ExtractionRecord => ({
  employeeId: id, model: "m", strengthByRun: runs, droppedQuotes: dropped,
  extraction: { strength: runs[0] as 1, sufficiency: "high", evidence: [{ quote: "q", dimension: "impact", level: "at", rationale: "" }], notes: [] },
});

describe("stability", () => {
  it("counts identical runs and spread histogram", () => {
    const s = stability([rec("a", [2, 2, 2]), rec("b", [2, 3, 2]), rec("c", [1, 3, 2])]);
    expect(s.identical).toBe(1);
    expect(s.total).toBe(3);
    expect(s.maxSpread).toEqual({ 0: 1, 1: 1, 2: 1 });
  });
});

describe("quoteFidelity", () => {
  it("counts kept vs dropped quotes across runs", () => {
    const q = quoteFidelity([rec("a", [2, 2, 2], ["x"]), rec("b", [2, 2, 2])]);
    expect(q.dropped).toBe(1);
    expect(q.kept).toBe(2); // one evidence item per canonical extraction
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/eval-checks.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement `scripts/eval-checks.ts`**

```ts
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
    checks.push({ name: `planted ${r.emp.plant} (${r.emp.id}) lands in Discuss`, pass: g === "discuss", detail: `group=${g}` });
  }
  return checks;
}
```

Note: the non-native check compares team means, which assumes the two teams were written at similar true quality. Task 6 sets both to two Exceeds and three Meets, so the comparison is fair; say so in the report.

- [ ] **Step 4: Run the check tests**

Run: `npx vitest run scripts/eval-checks.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Write `scripts/eval.ts`**

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { EmployeesFileSchema, ExtractionRecordSchema, RubricSchema } from "../src/lib/schema";
import { agenda, strength, type Scored } from "../src/lib/scoring";
import { managerOffsets, plantedChecks, quoteFidelity, ruleVsModel, stability, type Joined } from "./eval-checks";
import { z } from "zod";

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
  `(Filled in by the author: what failed, what changed in the prompt, and the result of the re-run.)`,
];
writeFileSync("data/eval-report.md", lines.join("\n"));
console.log(lines.join("\n"));
```

- [ ] **Step 6: Run and read the report**

Run: `npm run eval`
Expected: report printed and written. Read section 5. For each FAIL: decide whether it is a prompt problem or a data problem. Prompt problems: edit `buildExtractionPrompt`, re-run `npm run extract` for the affected employees (`npm run extract e13`) or delete `data/extractions.json` and re-run all, then `npm run eval` again. Record what changed in section 6 by editing the generated file (keep section 6 text in the script as the placeholder for regeneration and paste the author's note into a `data/eval-notes.md` that the script appends if present).

Add to `scripts/eval.ts` before `writeFileSync`:
```ts
import { existsSync } from "node:fs";
if (existsSync("data/eval-notes.md")) lines.push("", readFileSync("data/eval-notes.md", "utf8"));
```
and change the section 6 placeholder line to `See notes below.` when the file exists.

- [ ] **Step 7: Commit**

```bash
git add scripts/eval.ts scripts/eval-checks.ts scripts/eval-checks.test.ts data/eval-report.md data/eval-notes.md && git commit -m "Add extraction eval: stability, quote fidelity, planted-truth checks"
```

---

### Task 10: Data loading, overrides reducer, derived state

**Files:**
- Create: `src/lib/data.ts`, `src/state/overrides.ts`, `src/state/overrides.test.ts`, `src/state/useDerived.ts`, `src/state/derive.ts`, `src/state/derive.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // data.ts
  export type Employee = EmployeeRecord & { manager: Manager; extraction: Extraction; strengthByRun: number[] };
  export function loadData(): { rubric: Rubric; managers: Manager[]; employees: Employee[] };
  // overrides.ts
  export type OverrideKey = `${string}:${number}`;          // employeeId:evidenceIndex
  export type Overrides = Record<OverrideKey, Level>;
  export type OverrideAction = { type: "set"; employeeId: string; index: number; level: Level } | { type: "resetEmployee"; employeeId: string } | { type: "resetAll" };
  export function overridesReducer(state: Overrides, action: OverrideAction): Overrides;
  export function effectiveEvidence(emp: Employee, overrides: Overrides): EvidenceItem[];
  export function countOverrides(overrides: Overrides): number;
  // derive.ts
  export type Derived = { scored: Scored[]; fits: Record<string, Fit | null>; pooled: Fit | null; agenda: AgendaRow[]; summaries: Record<string, string>; strengthById: Record<string, number | null> };
  export function derive(employees: Employee[], managers: Manager[], rubric: Rubric, overrides: Overrides): Derived;
  // useDerived.ts
  export function useDerived(...same args): Derived;  // useMemo wrapper
  ```

- [ ] **Step 1: Write failing tests**

`src/state/overrides.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { overridesReducer, effectiveEvidence, countOverrides } from "./overrides";
import type { Employee } from "../lib/data";

const emp = {
  id: "e01", name: "A", level: "L4", managerId: "m1", rating: 3, review: "x",
  manager: { id: "m1", name: "M", style: "calibrated" },
  strengthByRun: [3, 3, 3],
  extraction: { strength: 3, sufficiency: "high", notes: [], evidence: [
    { quote: "a", dimension: "impact", level: "above", rationale: "" },
    { quote: "b", dimension: "craft", level: "at", rationale: "" },
  ] },
} as Employee;

describe("overrides", () => {
  it("sets and applies an override", () => {
    const s = overridesReducer({}, { type: "set", employeeId: "e01", index: 1, level: "well_above" });
    expect(effectiveEvidence(emp, s)[1].level).toBe("well_above");
    expect(effectiveEvidence(emp, s)[0].level).toBe("above");
    expect(countOverrides(s)).toBe(1);
  });
  it("resets one employee and all", () => {
    let s = overridesReducer({}, { type: "set", employeeId: "e01", index: 0, level: "below" });
    s = overridesReducer(s, { type: "set", employeeId: "e02", index: 0, level: "below" });
    expect(countOverrides(overridesReducer(s, { type: "resetEmployee", employeeId: "e01" }))).toBe(1);
    expect(countOverrides(overridesReducer(s, { type: "resetAll" }))).toBe(0);
  });
});
```

`src/state/derive.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { derive } from "./derive";
import { loadData } from "../lib/data";

describe("derive", () => {
  const { rubric, managers, employees } = loadData();
  it("produces a fit for every manager with usable points and an agenda row per employee", () => {
    const d = derive(employees, managers, rubric, {});
    expect(d.agenda).toHaveLength(employees.length);
    expect(Object.keys(d.fits)).toHaveLength(managers.length);
  });
  it("an override moves the employee's strength", () => {
    const target = employees.find((e) => e.extraction.evidence.length > 0)!;
    const before = derive(employees, managers, rubric, {}).strengthById[target.id];
    const after = derive(employees, managers, rubric, { [`${target.id}:0`]: "well_below" }).strengthById[target.id];
    expect(after).not.toEqual(before);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/state`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/data.ts`:
```ts
import rubricJson from "../../data/rubric.json";
import employeesJson from "../../data/employees.json";
import extractionsJson from "../../data/extractions.json";
import { z } from "zod";
import { EmployeesFileSchema, ExtractionRecordSchema, RubricSchema, type EmployeeRecord, type Extraction, type Manager, type Rubric } from "./schema";

export type Employee = EmployeeRecord & { manager: Manager; extraction: Extraction; strengthByRun: number[] };

export function loadData(): { rubric: Rubric; managers: Manager[]; employees: Employee[] } {
  const rubric = RubricSchema.parse(rubricJson);
  const { managers, employees } = EmployeesFileSchema.parse(employeesJson);
  const recs = z.array(ExtractionRecordSchema).parse(extractionsJson);
  const joined = employees.map((e) => {
    const rec = recs.find((r) => r.employeeId === e.id);
    if (!rec) throw new Error(`No extraction for ${e.id}`);
    const manager = managers.find((m) => m.id === e.managerId);
    if (!manager) throw new Error(`No manager ${e.managerId}`);
    return { ...e, manager, extraction: rec.extraction, strengthByRun: rec.strengthByRun };
  });
  return { rubric, managers, employees: joined };
}
```

`src/state/overrides.ts`:
```ts
import type { EvidenceItem, Level } from "../lib/schema";
import type { Employee } from "../lib/data";

export type OverrideKey = `${string}:${number}`;
export type Overrides = Record<OverrideKey, Level>;
export type OverrideAction =
  | { type: "set"; employeeId: string; index: number; level: Level }
  | { type: "resetEmployee"; employeeId: string }
  | { type: "resetAll" };

export function overridesReducer(state: Overrides, action: OverrideAction): Overrides {
  switch (action.type) {
    case "set":
      return { ...state, [`${action.employeeId}:${action.index}`]: action.level };
    case "resetEmployee":
      return Object.fromEntries(Object.entries(state).filter(([k]) => !k.startsWith(`${action.employeeId}:`))) as Overrides;
    case "resetAll":
      return {};
  }
}

export function effectiveEvidence(emp: Employee, overrides: Overrides): EvidenceItem[] {
  return emp.extraction.evidence.map((item, i) => {
    const o = overrides[`${emp.id}:${i}`];
    return o ? { ...item, level: o } : item;
  });
}

export function countOverrides(overrides: Overrides): number {
  return Object.keys(overrides).length;
}
```

`src/state/derive.ts`:
```ts
import type { Employee } from "../lib/data";
import type { Manager, Rubric } from "../lib/schema";
import { agenda, managerFit, managerSummary, pooledFit, strength, usablePoints, type AgendaRow, type Fit, type Scored } from "../lib/scoring";
import { effectiveEvidence, type Overrides } from "./overrides";

export type Derived = {
  scored: Scored[];
  fits: Record<string, Fit | null>;
  pooled: Fit | null;
  agenda: AgendaRow[];
  summaries: Record<string, string>;
  strengthById: Record<string, number | null>;
};

export function derive(employees: Employee[], managers: Manager[], rubric: Rubric, overrides: Overrides): Derived {
  const scored: Scored[] = employees.map((e) => ({
    id: e.id, name: e.name, managerId: e.managerId, rating: e.rating,
    strength: strength(effectiveEvidence(e, overrides)),
    sufficiency: e.extraction.sufficiency,
  }));
  const pooled = pooledFit(usablePoints(scored));
  const fits: Record<string, Fit | null> = {};
  const summaries: Record<string, string> = {};
  for (const m of managers) {
    const own = scored.filter((s) => s.managerId === m.id);
    fits[m.id] = managerFit(usablePoints(own), pooled);
    summaries[m.id] = managerSummary(fits[m.id], own);
  }
  const strengthById = Object.fromEntries(scored.map((s) => [s.id, s.strength]));
  return { scored, fits, pooled, agenda: agenda(scored, rubric.ratings), summaries, strengthById };
}
```

`src/state/useDerived.ts`:
```ts
import { useMemo } from "react";
import { derive, type Derived } from "./derive";
import type { Employee } from "../lib/data";
import type { Manager, Rubric } from "../lib/schema";
import type { Overrides } from "./overrides";

export function useDerived(employees: Employee[], managers: Manager[], rubric: Rubric, overrides: Overrides): Derived {
  return useMemo(() => derive(employees, managers, rubric, overrides), [employees, managers, rubric, overrides]);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all pass. (`data.test.ts` in Task 6 uses `readFileSync`; the JSON imports here need `resolveJsonModule`, already on.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.ts src/state && git commit -m "Add data loading, overrides reducer, and derived scoring state"
```

---

### Task 11: App shell and calibration map

**Files:**
- Modify: `src/components/App.tsx`
- Create: `src/components/TopBar.tsx`, `src/components/CalibrationMap.tsx`, `src/components/colors.ts`

**Interfaces:**
- Produces:
  ```ts
  // colors.ts
  export const MANAGER_COLORS: string[]; // 6 distinguishable colours
  export function managerColor(index: number): string;
  // CalibrationMap props
  { employees: Employee[]; managers: Manager[]; derived: Derived; selectedId: string | null; onSelect: (id: string) => void; hiddenManagers: Set<string>; onToggleManager: (id: string) => void; overrideCount: number }
  // App: owns selectedId, overrides (useReducer), hiddenManagers, apiKey (useState<string|null>)
  ```

- [ ] **Step 1: `src/components/colors.ts`**

```ts
export const MANAGER_COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];
export function managerColor(index: number): string {
  return MANAGER_COLORS[index % MANAGER_COLORS.length];
}
```

- [ ] **Step 2: `src/components/TopBar.tsx`**

```tsx
export function TopBar({ hasKey, onKeyClick }: { hasKey: boolean; onKeyClick: () => void }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-200 px-6 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Calibration Map</h1>
        <p className="text-sm text-slate-600">
          Is this rating a property of the evidence, or of who wrote it? Each point is one employee: how strong the written
          evidence is (across) against the rating their manager gave (up).
        </p>
      </div>
      <button
        onClick={onKeyClick}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        title="Add an Anthropic API key to re-run extractions live"
      >
        {hasKey ? "🔑 key set" : "🔑 add key"}
      </button>
    </header>
  );
}
```

- [ ] **Step 3: `src/components/CalibrationMap.tsx`**

```tsx
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
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

export function CalibrationMap({ employees, managers, derived, selectedId, onSelect, hiddenManagers, onToggleManager, overrideCount }: Props) {
  const data: Datum[] = employees
    .filter((e) => !hiddenManagers.has(e.managerId))
    .map((e) => {
      const s = derived.strengthById[e.id];
      const mi = managers.findIndex((m) => m.id === e.managerId);
      return {
        x: s ?? 1, y: e.rating + jitter(e.id), id: e.id, name: e.name, managerName: e.manager.name,
        low: e.extraction.sufficiency === "low" || s === null, selected: e.id === selectedId, color: managerColor(mi),
      };
    });

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 pb-1 text-xs text-slate-600">
        <span>● solid = enough evidence · ○ hollow = too little to judge · dashed = rating matches evidence</span>
        {overrideCount > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">{overrideCount} override{overrideCount > 1 ? "s" : ""} applied</span>}
      </div>
      <div className="min-h-[360px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" domain={[0.8, 4.2]} ticks={RATING_TICKS} tickFormatter={(v) => LABELS[v] ?? ""} label={{ value: "Evidence strength", position: "bottom", offset: 10, fontSize: 12 }} />
            <YAxis type="number" dataKey="y" domain={[0.8, 4.2]} ticks={RATING_TICKS} tickFormatter={(v) => LABELS[v] ?? ""} width={90} label={{ value: "Manager rating", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <ReferenceLine segment={[{ x: 1, y: 1 }, { x: 4, y: 4 }]} stroke="#94a3b8" strokeDasharray="4 4" />
            {managers.map((m, i) => {
              const f = derived.fits[m.id];
              if (!f || hiddenManagers.has(m.id)) return null;
              return <ReferenceLine key={m.id} segment={[{ x: 1, y: f.a + f.b }, { x: 4, y: f.a + 4 * f.b }]} stroke={managerColor(i)} strokeWidth={1.5} strokeOpacity={0.7} />;
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
            <Scatter data={data} shape={<PointShape />} onClick={(d: Datum) => onSelect(d.id)} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-2 text-xs">
        {managers.map((m, i) => (
          <li key={m.id}>
            <button onClick={() => onToggleManager(m.id)} className={`flex items-center gap-1 ${hiddenManagers.has(m.id) ? "opacity-40" : ""}`}>
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: managerColor(i) }} />
              {m.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

If Recharts' `Scatter.onClick` passes an event object instead of the datum in the installed version, read `node_modules/recharts/types/cartesian/Scatter.d.ts` and use the documented signature (commonly `(data, index, event)`).

- [ ] **Step 4: `src/components/App.tsx`**

```tsx
import { useMemo, useReducer, useState } from "react";
import { loadData } from "../lib/data";
import { overridesReducer, countOverrides } from "../state/overrides";
import { useDerived } from "../state/useDerived";
import { TopBar } from "./TopBar";
import { CalibrationMap } from "./CalibrationMap";

export function App() {
  const { rubric, managers, employees } = useMemo(loadData, []);
  const [overrides, dispatch] = useReducer(overridesReducer, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenManagers, setHidden] = useState<Set<string>>(new Set());
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const derived = useDerived(employees, managers, rubric, overrides);

  const toggleManager = (id: string) =>
    setHidden((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  void dispatch; void apiKey; void setApiKey; void keyOpen; // used in later tasks

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
          {selectedId ? <p>Selected: {selectedId}</p> : <p>Agenda goes here.</p>}
        </aside>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Run and check visually**

Run: `npm run dev` and open the printed URL.
Expected: scatter with 30 points, 6 fit lines, hollow points for the terse team, clicking a point shows "Selected: eNN", legend toggles hide a manager. Also `npx tsc -b` passes.

- [ ] **Step 6: Commit**

```bash
git add src/components && git commit -m "Add app shell and calibration map with manager fit lines"
```

---

### Task 12: Agenda panel

**Files:**
- Create: `src/components/Agenda.tsx`
- Modify: `src/components/App.tsx`

**Interfaces:**
- Props: `{ employees: Employee[]; managers: Manager[]; derived: Derived; onSelect: (id: string) => void }`

- [ ] **Step 1: `src/components/Agenda.tsx`**

```tsx
import type { Employee } from "../lib/data";
import type { Manager } from "../lib/schema";
import type { AgendaGroup } from "../lib/scoring";
import type { Derived } from "../state/derive";
import { managerColor } from "./colors";

const GROUPS: { key: AgendaGroup; title: string; hint: string }[] = [
  { key: "discuss", title: "Discuss", hint: "rating and evidence disagree by a full step or more" },
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
```

- [ ] **Step 2: Wire into `App.tsx`**

Replace the `<aside>` body:
```tsx
{selectedId ? <p>Selected: {selectedId}</p> : <Agenda employees={employees} managers={managers} derived={derived} onSelect={setSelectedId} />}
```
and add `import { Agenda } from "./Agenda";`.

- [ ] **Step 3: Check visually**

Run: `npm run dev`
Expected: three groups with counts; planted cases in Discuss; terse team in Get more input; clicking a row selects; manager summaries read sensibly (lenient "runs +… above evidence", harsh "runs −… below evidence").

- [ ] **Step 4: Commit**

```bash
git add src/components && git commit -m "Add agenda panel with grouped cases and manager summaries"
```

---

### Task 13: Drilldown — review text and evidence overrides

**Files:**
- Create: `src/components/Drilldown.tsx`, `src/components/ReviewText.tsx`, `src/components/EvidenceList.tsx`, `src/components/dimensionColors.ts`
- Modify: `src/components/App.tsx`

**Interfaces:**
- `ReviewText` props: `{ review: string; evidence: EvidenceItem[]; activeIndex: number | null; onActivate: (i: number | null) => void }`
- `EvidenceList` props: `{ evidence: EvidenceItem[]; originals: EvidenceItem[]; activeIndex: number | null; onActivate: (i: number | null) => void; onSetLevel: (i: number, level: Level) => void; onReset: () => void; rubric: Rubric }`
- `Drilldown` props: `{ employee: Employee; rubric: Rubric; managers: Manager[]; derived: Derived; overrides: Overrides; dispatch: Dispatch<OverrideAction>; apiKey: string | null; onNeedKey: () => void; onBack: () => void }`
- Consumes: `effectiveEvidence`, `strength`, `ratingLabel`, `LEVELS`.

- [ ] **Step 1: `src/components/dimensionColors.ts`**

```ts
import type { Dimension } from "../lib/schema";
export const DIMENSION_COLORS: Record<Dimension, string> = {
  impact: "#fde68a", craft: "#bfdbfe", collaboration: "#bbf7d0", ownership: "#fbcfe8",
};
```

- [ ] **Step 2: `src/components/ReviewText.tsx`**

Highlights each evidence quote by finding its first occurrence in the review; quotes are guaranteed verbatim by `filterQuotes`. Overlapping quotes: the earlier-starting one wins; a later quote fully inside an already-highlighted span is skipped.

```tsx
import type { EvidenceItem } from "../lib/schema";
import { DIMENSION_COLORS } from "./dimensionColors";

type Span = { start: number; end: number; index: number };

export function ReviewText({ review, evidence, activeIndex, onActivate }: { review: string; evidence: EvidenceItem[]; activeIndex: number | null; onActivate: (i: number | null) => void }) {
  const spans: Span[] = [];
  evidence.forEach((e, index) => {
    const start = review.indexOf(e.quote);
    if (start < 0) return;
    const end = start + e.quote.length;
    if (spans.some((s) => start < s.end && end > s.start)) return; // overlap: skip
    spans.push({ start, end, index });
  });
  spans.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) parts.push(review.slice(cursor, s.start));
    const item = evidence[s.index];
    parts.push(
      <mark
        key={s.index}
        onClick={() => onActivate(activeIndex === s.index ? null : s.index)}
        className={`cursor-pointer rounded px-0.5 ${activeIndex === s.index ? "ring-2 ring-slate-500" : ""}`}
        style={{ background: DIMENSION_COLORS[item.dimension] }}
        title={`${item.dimension} · ${item.level}`}
      >
        {review.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  }
  if (cursor < review.length) parts.push(review.slice(cursor));
  return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}
```

- [ ] **Step 3: `src/components/EvidenceList.tsx`**

```tsx
import { LEVELS, type EvidenceItem, type Level, type Rubric } from "../lib/schema";
import { DIMENSION_COLORS } from "./dimensionColors";

const LEVEL_LABEL: Record<Level, string> = { well_below: "well below", below: "below", at: "at", above: "above", well_above: "well above" };

type Props = {
  evidence: EvidenceItem[]; originals: EvidenceItem[]; activeIndex: number | null;
  onActivate: (i: number | null) => void; onSetLevel: (i: number, level: Level) => void; onReset: () => void; rubric: Rubric;
};

export function EvidenceList({ evidence, originals, activeIndex, onActivate, onSetLevel, onReset, rubric }: Props) {
  const changed = evidence.some((e, i) => e.level !== originals[i].level);
  const dimName = (id: EvidenceItem["dimension"]) => rubric.dimensions.find((d) => d.id === id)?.name ?? id;
  if (evidence.length === 0) return <p className="text-slate-500">No concrete evidence was found in this review.</p>;
  return (
    <div>
      <ul className="space-y-1">
        {evidence.map((e, i) => (
          <li key={i} className={`rounded p-1.5 ${activeIndex === i ? "bg-slate-100" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="w-24 rounded px-1 text-xs" style={{ background: DIMENSION_COLORS[e.dimension] }}>{dimName(e.dimension)}</span>
              <select
                value={e.level}
                onChange={(ev) => onSetLevel(i, ev.target.value as Level)}
                className={`rounded border px-1 text-xs ${e.level !== originals[i].level ? "border-amber-400 bg-amber-50" : "border-slate-300"}`}
                aria-label={`Level for evidence ${i + 1}`}
              >
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]} the bar</option>)}
              </select>
              <button onClick={() => onActivate(activeIndex === i ? null : i)} className="truncate text-left text-xs text-slate-700 hover:underline">“{e.quote}”</button>
            </div>
            {activeIndex === i && <p className="mt-1 pl-1 text-xs text-slate-600">{e.rationale}</p>}
          </li>
        ))}
      </ul>
      {changed && <button onClick={onReset} className="mt-2 text-xs text-amber-700 hover:underline">Reset overrides for this employee</button>}
    </div>
  );
}
```

- [ ] **Step 4: `src/components/Drilldown.tsx`** (OtherBars and Rerun are added in Tasks 14–15; leave their slots as comments now)

```tsx
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
```

- [ ] **Step 5: Wire into `App.tsx`**

Replace the `<aside>` body:
```tsx
{selected ? (
  <Drilldown
    employee={selected} rubric={rubric} managers={managers} derived={derived}
    overrides={overrides} dispatch={dispatch}
    apiKey={apiKey} onNeedKey={() => setKeyOpen(true)} onBack={() => setSelectedId(null)}
  />
) : (
  <Agenda employees={employees} managers={managers} derived={derived} onSelect={setSelectedId} />
)}
```
with `const selected = employees.find((e) => e.id === selectedId) ?? null;` above the return, `import { Drilldown } from "./Drilldown";`, and remove the `void` line's `dispatch` entry.

- [ ] **Step 6: Check visually**

Run: `npm run dev`
Expected: clicking a point shows the review with coloured highlights; clicking a highlight shows its rationale; changing a level moves the point on the map and changes the header's evidence value; the override badge appears; reset clears it.

- [ ] **Step 7: Commit**

```bash
git add src/components && git commit -m "Add drilldown with highlighted evidence and level overrides"
```

---

### Task 14: "Under other managers' bars"

**Files:**
- Create: `src/components/OtherBars.tsx`
- Modify: `src/components/Drilldown.tsx`

**Interfaces:**
- Props: `{ employee: Employee; strengthValue: number | null; managers: Manager[]; derived: Derived; rubric: Rubric }`
- Consumes: `impliedRating`, `ratingLabel`.

- [ ] **Step 1: `src/components/OtherBars.tsx`**

```tsx
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
```

- [ ] **Step 2: Add to `Drilldown.tsx`**

Replace `{/* OtherBars (Task 14) */}` with:
```tsx
<section>
  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Under other managers' bars</h3>
  <OtherBars employee={e} strengthValue={s} managers={p.managers} derived={p.derived} rubric={rubric} />
</section>
```
and `import { OtherBars } from "./OtherBars";`.

- [ ] **Step 3: Check visually**

Run: `npm run dev`
Expected: one row per manager; the lenient manager's range sits higher than the harsh one's for the same employee; the terse manager shows "not enough evidence" if all their points are low-sufficiency; overriding evidence shifts all rows.

- [ ] **Step 4: Commit**

```bash
git add src/components && git commit -m "Add implied-rating comparison across managers' bars"
```

---

### Task 15: API key dialog and live re-run

**Files:**
- Create: `src/components/KeyDialog.tsx`, `src/components/Rerun.tsx`, `src/lib/mockExtract.ts`
- Modify: `src/components/Drilldown.tsx`, `src/components/App.tsx`

**Interfaces:**
- `KeyDialog` props: `{ open: boolean; onClose: () => void; onSave: (key: string | null) => void; hasKey: boolean }`
- `Rerun` props: `{ employee: Employee; rubric: Rubric; apiKey: string | null; onNeedKey: () => void; extractor?: Extractor }` where `export type Extractor = (apiKey: string, input: ExtractionInput) => Promise<{ extraction: Extraction; dropped: string[] }>`
- `mockExtract.ts`: `export const mockExtractor: Extractor` — waits 1.5 s, returns the bundled extraction with the first evidence item's level bumped one step and one extra note, so the diff view has something to show.
- Consumes: `makeClient`, `extractOne`, `strength`, `ratingLabel`.
- Dev switch: when `import.meta.env.VITE_MOCK_RERUN === "1"`, `App` passes `mockExtractor`; production builds never set it.

- [ ] **Step 1: `src/components/KeyDialog.tsx`**

```tsx
import { useState } from "react";

export function KeyDialog({ open, onClose, onSave, hasKey }: { open: boolean; onClose: () => void; onSave: (key: string | null) => void; hasKey: boolean }) {
  const [value, setValue] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">Anthropic API key</h2>
        <p className="mt-1 text-xs text-slate-600">
          Used only to re-run an extraction live from your browser to <code>api.anthropic.com</code>. Kept in memory for this tab and
          forgotten on reload; never written to storage or sent anywhere else.
        </p>
        <input
          type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="sk-ant-…"
          className="mt-3 w-full rounded border border-slate-300 px-2 py-1 text-sm" autoFocus
        />
        <div className="mt-3 flex justify-end gap-2 text-sm">
          {hasKey && <button onClick={() => { onSave(null); onClose(); }} className="px-2 py-1 text-slate-600 hover:underline">Forget key</button>}
          <button onClick={onClose} className="px-2 py-1 text-slate-600 hover:underline">Cancel</button>
          <button onClick={() => { if (value.trim()) { onSave(value.trim()); setValue(""); onClose(); } }} className="rounded bg-slate-800 px-3 py-1 text-white">Use key</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/components/Rerun.tsx`**

```tsx
import { useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import type { Employee } from "../lib/data";
import type { Extraction, Rubric } from "../lib/schema";
import { extractOne, makeClient, MODEL } from "../lib/anthropic";
import type { ExtractionInput } from "../lib/prompt";
import { ratingLabel, strength } from "../lib/scoring";

type State = { status: "idle" } | { status: "running" } | { status: "done"; live: Extraction; dropped: string[] } | { status: "error"; message: string };

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The API key was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited; try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach api.anthropic.com.";
  if (err instanceof Anthropic.APIError) return `API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : "Unknown error";
}

export type Extractor = (apiKey: string, input: ExtractionInput) => Promise<{ extraction: Extraction; dropped: string[] }>;

export const realExtractor: Extractor = async (apiKey, input) => {
  const client = makeClient({ apiKey, browser: true });
  const r = await extractOne(client, input);
  return { extraction: r.extraction, dropped: r.dropped };
};

export function Rerun({ employee: e, rubric, apiKey, onNeedKey, extractor = realExtractor }: { employee: Employee; rubric: Rubric; apiKey: string | null; onNeedKey: () => void; extractor?: Extractor }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    if (!apiKey) { onNeedKey(); return; }
    setState({ status: "running" });
    try {
      const r = await extractor(apiKey, { rubric, level: e.level, review: e.review, rating: e.rating });
      setState({ status: "done", live: r.extraction, dropped: r.dropped });
    } catch (err) {
      setState({ status: "error", message: describeError(err) });
    }
  }

  const bundled = e.extraction;
  const bs = strength(bundled.evidence);
  return (
    <div>
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={state.status === "running"} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">
          {state.status === "running" ? "Running…" : "Re-run with Claude"}
        </button>
        <span className="text-[11px] text-slate-500">{MODEL} · same prompt and validation as the bundled run{!apiKey && " · needs a key"}</span>
      </div>
      {state.status === "error" && <p className="mt-2 text-xs text-red-700">{state.message}</p>}
      {state.status === "done" && (() => {
        const ls = strength(state.live.evidence);
        const fmt = (x: number | null) => (x === null ? "none" : `${ratingLabel(x, rubric.ratings)} (${x.toFixed(1)})`);
        const bundledQuotes = new Set(bundled.evidence.map((i) => i.quote));
        const liveQuotes = new Set(state.live.evidence.map((i) => i.quote));
        return (
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="font-semibold">Bundled</div>
              <div>evidence {fmt(bs)} · sufficiency {bundled.sufficiency}</div>
              <ul className="mt-1 space-y-0.5">{bundled.evidence.map((i, k) => <li key={k} className={liveQuotes.has(i.quote) ? "" : "text-red-700 line-through"}>{i.dimension} · {i.level} · “{i.quote}”</li>)}</ul>
            </div>
            <div>
              <div className="font-semibold">Live</div>
              <div>evidence {fmt(ls)} · sufficiency {state.live.sufficiency}</div>
              <ul className="mt-1 space-y-0.5">{state.live.evidence.map((i, k) => <li key={k} className={bundledQuotes.has(i.quote) ? "" : "text-emerald-700"}>{i.dimension} · {i.level} · “{i.quote}”</li>)}</ul>
              {state.dropped.length > 0 && <div className="mt-1 text-slate-500">{state.dropped.length} quote(s) dropped as non-verbatim</div>}
            </div>
            <p className="col-span-2 text-slate-500">Struck = only in bundled; green = only in live. Bundled data is not replaced.</p>
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 3: `src/lib/mockExtract.ts`**

```ts
import type { Extractor } from "../components/Rerun";
import { LEVELS, type Extraction } from "./schema";

/** Dev-only stand-in for the live API: returns a slightly perturbed copy of a bundled extraction after a delay. */
export function makeMockExtractor(bundledFor: (review: string) => Extraction | undefined): Extractor {
  return async (_apiKey, input) => {
    await new Promise((r) => setTimeout(r, 1500));
    const base = bundledFor(input.review);
    if (!base) throw new Error("mock: no bundled extraction for this review");
    const evidence = base.evidence.map((item, i) => {
      if (i !== 0) return item;
      const idx = Math.min(LEVELS.length - 1, LEVELS.indexOf(item.level) + 1);
      return { ...item, level: LEVELS[idx] };
    });
    return { extraction: { ...base, evidence, notes: [...base.notes, "(mock) live re-run"] }, dropped: [] };
  };
}
```

- [ ] **Step 4: Add to `Drilldown.tsx`**

Add `extractor?: Extractor` to `DrilldownProps` (import the type from `./Rerun`) and replace `{/* Rerun (Task 15) */}` with:
```tsx
<section>
  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Check the model</h3>
  <p className="mb-1 text-xs text-slate-600">Bundled runs gave strength {e.strengthByRun.join(", ")} across {e.strengthByRun.length} runs.</p>
  <Rerun employee={e} rubric={rubric} apiKey={p.apiKey} onNeedKey={p.onNeedKey} extractor={p.extractor} />
</section>
```
and `import { Rerun, type Extractor } from "./Rerun";`.

- [ ] **Step 5: Wire `KeyDialog` and the dev mock into `App.tsx`**

After `</main>` add:
```tsx
<KeyDialog open={keyOpen} onClose={() => setKeyOpen(false)} onSave={setApiKey} hasKey={apiKey !== null} />
```
with `import { KeyDialog } from "./KeyDialog";` and delete the `void` line entirely. Above the return:
```tsx
const extractor = import.meta.env.VITE_MOCK_RERUN === "1"
  ? makeMockExtractor((review) => employees.find((x) => x.review === review)?.extraction)
  : undefined;
```
with `import { makeMockExtractor } from "../lib/mockExtract";`, and pass `extractor={extractor}` to `Drilldown`.

- [ ] **Step 6: Verify (no key available)**

Run: `npx tsc -b && npm run build`
Expected: build clean.

Success path (mock): `VITE_MOCK_RERUN=1 npm run dev`, open a drilldown, enter any text as the key, click Re-run. Expected: "Running…" for ~1.5 s, then bundled and live side by side with the first item's level changed and one green note.

Error path (real API): `npm run dev` (no mock), enter the key `sk-ant-bogus`, click Re-run. Expected: the request goes to `api.anthropic.com` (visible in DevTools → Network, status 401) and the panel shows "The API key was rejected." If instead a CORS error appears, confirm `dangerouslyAllowBrowser: true` is set in `makeClient`.

Storage: DevTools → Application → Local/Session Storage: nothing written. Reload: key forgotten.

Record in `docs/RATIONALE.md` (Task 16) that the live path was verified this way and not end to end.

- [ ] **Step 6: Commit**

```bash
git add src/components && git commit -m "Add in-memory API key dialog and live re-run with bundled/live diff"
```

---

### Task 16: README, rationale, deploy, transcript

**Files:**
- Create: `README.md`, `docs/RATIONALE.md`
- Modify: `docs/TIMELOG.md`

- [ ] **Step 1: `README.md`**

```markdown
# Calibration Map

Is a performance rating a property of the evidence, or of who wrote it?

This tool scores the written evidence in each performance review against a shared rubric (using Claude), then plots evidence against the manager's rating. Rating/evidence mismatches, lenient and harsh managers, and drifting standards all become visible on one chart. A facilitator can drill into any employee, override the model's reading of any quote, see how each manager's bar would rate the same evidence, and re-run the extraction live.

**Live demo:** <NETLIFY URL>

## Run locally

    npm install
    npm run dev

Everything needed is bundled (synthetic company + precomputed extractions). An Anthropic API key is only needed for the optional "Re-run with Claude" button; it is held in memory and never stored.

## Regenerate the data

    npm run extract   # 30 reviews × 3 runs, through Claude Code headless mode (`claude -p`), no API key needed
    npm run eval      # writes data/eval-report.md

The extraction prompt and validation are identical between the precompute and the in-browser re-run; only the transport differs (`claude -p` vs the Anthropic SDK). The browser path was verified with a mocked extractor (success) and against the real API with an invalid key (401 handling); it was not run end to end with a valid key during development.

## Layout

- `src/lib/scoring.ts` – strength rule, manager fits (with shrinkage), implied-rating bands, agenda ranking (unit-tested)
- `src/lib/prompt.ts`, `src/lib/anthropic.ts` – the extraction prompt and structured-output call, shared by the script and the browser
- `scripts/extract.ts`, `scripts/eval.ts` – precompute and evaluate the model-as-rater step
- `data/` – rubric, synthetic reviews with ground-truth tags, extractions, eval report
- `docs/RATIONALE.md` – design rationale and time spent

## AI transcripts

The Claude Code session used to design and build this: <TRANSCRIPT LINK>
```

- [ ] **Step 2: `docs/RATIONALE.md`**

Write it from the spec and the eval report. Required sections, in order:
1. **Why this theme and approach** — Theme 4 applied to the People domain; the three calibration failures; why comparing ratings across managers cannot separate leniency from team strength; the evidence-vs-rating reframe; connection to labeler auditing.
2. **What is non-obvious** — sufficiency ≠ strength (no evidence is not weak evidence); the model is itself a rater and must be evaluated; "under another manager's bar" falls out of the same fit; uncertainty that widens on extrapolation.
3. **Key decisions and trade-offs** — precompute + live re-run; precompute through Claude Code headless mode because no API key was available (same prompt and validation, different transport), and how the live path was verified (mock + 401) without a key; continuous strength; shrinkage k=3; SE band floor; manager identity withheld from the prompt; key in memory only; direct browser call as a demo trade-off; no manager rankings.
4. **What the eval found** — paste the numbers from `data/eval-report.md` and what was changed in response.
5. **What was cut** — auth, editing, export, multi-cycle, per-manager scorecards, shared test cases.
6. **With more time** — shared test cases for managers (rater calibration); multi-cycle drift; an MCP server exposing `extractOne` so it runs inside an HRIS; human-labelled evidence set to score the extractor properly.
7. **Time spent** — total from `docs/TIMELOG.md`, with the note that it excludes breaks and includes ~10 min of pre-reading.
8. **Disclosure** — dataset is synthetic; manager styles and planted cases are listed in `data/employees.json`; names were assigned to styles from a shuffled list.

- [ ] **Step 3: Deploy to Netlify**

Run: `npm run build && npx netlify-cli deploy --prod --dir=dist` (log in when prompted; or connect the GitHub repo in the Netlify UI with build `npm run build`, publish `dist`).
Expected: a `*.netlify.app` URL that loads the map. Put the URL in `README.md`.

- [ ] **Step 4: Push and export the transcript**

```bash
git add README.md docs/RATIONALE.md docs/TIMELOG.md && git commit -m "Add README, design rationale, and deploy URL"
git remote add origin <github url> && git push -u origin main
```
Then export the session with `simonw/claude-code-transcripts` (see its README: `uvx claude-code-transcripts` or `pipx run claude-code-transcripts`) and add the link to `README.md`; commit and push.

- [ ] **Step 5: Final check**

Open the Netlify URL in a private window: map loads, agenda populated, drilldown works, overrides move points, re-run asks for a key. `npm test` passes. Update `docs/TIMELOG.md` with the final total.

---

## Self-review

**Spec coverage:** §1–2 → RATIONALE (T16); §3 dataset → T6; §4 extraction, prompt, quote filter, precompute, eval → T2, T7, T8, T9; §5 scoring → T3–T5; §6 UI (map, agenda, drilldown, overrides, other bars, re-run, key dialog, responsive) → T11–T15 (responsive via `md:grid-cols`); §7 stack/repo → T1; §8 testing → each task; §9 deploy/deliverables → T16; §10 risks → prompt wording (T7), eval checks (T9), bands (T4), framing (T12/T14 copy), key handling (T15).

**Placeholder scan:** none of the forbidden patterns; T6's reviews are authored content with full specifications and examples; T16's RATIONALE has a required outline rather than prose because it depends on the eval results.

**Type consistency:** `strength(evidence)` returns `number | null` everywhere; `Fit` fields `{a,b,n,s,xbar,sxx}` used identically in T4, T10, T11, T14; `Scored.sufficiency` typed from `schema.ts`; `Overrides` keys `${id}:${index}` in T10 and T13; `extractOne` returns `{extraction, dropped, raw}` in T7, T8, T15; `Derived.fits` is `Record<string, Fit | null>` in T10, T11, T14.
