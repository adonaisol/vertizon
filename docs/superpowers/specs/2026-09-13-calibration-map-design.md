# Calibration Map: design spec

Date: 2026-09-13
Context: Anthropic SWE take-home (`.assets/take_home.pdf`), Theme 4 (Evaluation & Data Quality) applied to the People domain.
Target role: Staff Software Engineer, People Products.

## 1. Problem and insight

Performance-review calibration meetings try to make ratings consistent across managers. Three things go wrong in practice:

1. **Rating doesn't match evidence.** The written review does not support the rating, in either direction.
2. **Lenient vs harsh managers.** The same quality of work gets different ratings depending on who wrote it up.
3. **Standards drift.** "Exceeds" or "L5 scope" means different things on different teams.

Comparing rating distributions across managers cannot separate "lenient manager" from "stronger team". The reframe: score the **written evidence** against one shared rubric, then compare **rating against evidence**. All three problems become visible on one chart:

- an individual far from the diagonal is a rating/evidence mismatch;
- a manager whose fitted line sits above or below the others is lenient or harsh;
- managers whose lines have different slopes set the bar for "Exceeds" at different amounts of evidence.

This is how ML teams audit human labelers (inter-rater agreement, rater bias), applied to managers.

The step that maps evidence to the rubric is done by Claude, which makes the model itself a rater whose reliability must be checked. Treating that seriously (stability, quote fidelity, fairness to non-native writing, distinguishing "no evidence" from "weak evidence") is the core of the submission.

## 2. Scope

**In:** one screen with a calibration map, an agenda panel, and an employee drilldown; bundled synthetic dataset with precomputed Claude extractions; facilitator overrides; "under other managers' bars" comparison; live re-run of one extraction with a user-supplied API key; an eval report on the extraction step.

**Out (deliberate):** authentication; editing reviews; export; multi-cycle history; per-manager scorecards or rankings (framing risk); the "shared test cases" idea (future work); any server.

## 3. Synthetic dataset

- 30 employees, 6 managers × 5 reports, all engineers at L3–L5 sharing one rubric.
- Rubric: 4 dimensions (Impact, Craft, Collaboration, Ownership), each with a written bar for below / at / above level, per level.
- Rating scale (4 points, integers): 1 Below, 2 Meets, 3 Exceeds, 4 Greatly Exceeds.
- Each employee record: id, name, level, managerId, review text, managerRating, plus **ground-truth tags** used only by the eval script (planted case type, if any).

**Manager personalities** (ground truth, recorded in `data/employees.json` and disclosed in the rationale):

| Manager | Behaviour | What a correct scorer shows |
|---|---|---|
| Lenient | ratings ~1 point above evidence | line above the diagonal |
| Harsh | ratings ~1 point below evidence | line below the diagonal |
| Verbose-but-vague | long glowing prose, little concrete evidence | medium/low sufficiency, not high strength |
| Non-native English | rough, hard-to-follow writing about genuinely solid work | strength reflects the work, not the prose |
| Terse | two or three sentences, no examples | low sufficiency, strength close to the manager's rating with wide uncertainty |
| Calibrated | ratings match evidence | line on the diagonal |

**Planted individual cases** (3–4): an Exceeds with Meets-level evidence; a Meets with Exceeds-level evidence; one with contradictory evidence across dimensions; one where the manager's review contradicts itself.

Reviews are drafted with Claude's help from these specifications, then hand-edited so the plants are real.

## 4. Extraction (model-as-rater)

**Input per employee:** rubric, employee level, review text, manager rating. Manager identity and other reviews are **not** included, so the scorer cannot be influenced by who wrote it.

**Model:** Claude Sonnet 5 (`claude-sonnet-5`), temperature 0.

**Output**, validated with zod:

```ts
{
  strength: 1 | 2 | 3 | 4,          // evidence-implied rating, same scale as managerRating
  sufficiency: 'low' | 'medium' | 'high',
  evidence: Array<{
    quote: string,                   // verbatim substring of the review; checked programmatically
    dimension: 'impact' | 'craft' | 'collaboration' | 'ownership',
    level: 'well_below' | 'below' | 'at' | 'above' | 'well_above',
    rationale: string,
  }>,
  notes: string[],
}
```

Quotes that are not an exact substring of the review are dropped and logged. If all quotes are dropped, sufficiency is forced to `low`.

**Prompt requirements:** judge the work described, not the writing quality; return low sufficiency rather than guess; cite verbatim; use the rubric's level bars.

**Precompute:** `scripts/extract.ts` runs each review 3× and stores all runs in `data/extractions.json` (`strengthByRun`, plus the first run's full extraction as the canonical one).

**Eval** (`scripts/eval.ts` → `data/eval-report.md`):

1. Stability: share of employees whose `strength` is identical across the 3 runs; distribution of max spread.
2. Quote fidelity: share of returned quotes that appear verbatim (before dropping).
3. Planted-truth recovery: lenient and harsh managers' fitted offsets have the expected sign; the non-native-English team's mean strength is within 0.5 of the calibrated team's for equal ground-truth quality; the terse team is ≥80% low sufficiency; each planted individual case appears in the agenda's Discuss group.

If check 3 fails, the prompt is revised, not the data; the report records what failed and what changed.

## 5. Scoring (`src/lib/scoring.ts`, pure functions, unit-tested)

- `strength(evidence)`: computed client-side from evidence levels so overrides work. Rule: map each item's level to −2/−1/0/+1/+2, average per dimension, average across dimensions present, then `2 + mean` clamped to 1–4. The result is **continuous**; it is the map's x-coordinate (no jitter needed) and is rounded only for labels ("evidence ≈ Exceeds"). The model's own `strength` is kept in the data for the eval report (which records disagreement with this rule) but the UI always uses the rule, so bundled and overridden values are comparable.
- `managerFit(points)`: least-squares line of rating on strength for one manager's employees, using only points with medium/high sufficiency. To stabilise small samples, the manager's slope and intercept are **shrunk toward the pooled fit** (all managers' usable points) with weight `n / (n + k)`, k = 3. Returns `{a, b, n, s, xbar, sxx}` where `s` is the residual standard error. If n = 0 the fit is `null` and the UI shows "not enough evidence to infer this manager's bar". If n = 1 or all x are equal, the manager's own slope is undefined and the pooled slope is used with the intercept shrunk as above.
- `impliedRating(strength, fit)`: point estimate `a + b·strength` and a range with half-width `max(0.5, s · sqrt(1/n + (strength − xbar)² / sxx))`, i.e. the standard error of the fitted line, floored at half a rating step. The band therefore widens when the manager is inconsistent and when the employee's evidence lies outside the range this manager has rated before. Shown in the UI as a range on the rating scale with "based on N reviews"; the method is disclosed in a footnote and in the rationale.
- `agenda(employees)`: rank by `|rating − strength|`; group as **Discuss** (gap ≥ 1, sufficiency medium/high), **Get more input** (sufficiency low), **Looks consistent** (the rest). Each row carries a one-sentence reason.
- `managerSummary(fit)`: one sentence per manager, e.g. "runs +0.8 above evidence", "steeper bar for Exceeds", "on the diagonal".

## 6. UI

Layout and interaction flow are in `docs/ui-design.md` (wireframe + Mermaid). Summary:

- **Top bar:** title, one-line reading guide, key icon (BYOK dialog).
- **Map (left, ~60%):** X = evidence strength (continuous, 1–4), Y = manager rating (integer, small vertical jitter only); points coloured by manager, hollow when sufficiency is low; diagonal reference line; per-manager fitted lines toggleable via legend; hover tooltip; click opens drilldown. A badge shows "N overrides applied" when any exist.
- **Agenda (right, default):** three groups with counts; rows open the drilldown. Below: manager summaries.
- **Drilldown (right, on selection):** header (name, level, manager, rating vs strength); review text with evidence quotes highlighted by dimension, click for rationale; evidence list with level dropdowns (overrides); "Under other managers' bars" rows with range and n; "Re-run with Claude" button.
- **Overrides:** stored in a `useReducer` store keyed by employee + evidence index; recompute strength, fits, agenda, and other-bars live. Reset per employee and globally.
- **Re-run:** if no key, open the key dialog. Call `api.anthropic.com` directly from the browser with the direct-browser-access header; same prompt and zod validation as the script. Show live result beside the bundled one with changed items marked. Errors (bad key, network, invalid JSON) shown inline; bundled data is never replaced.
- **API key:** React state only; never written to storage; cleared on reload. Stated in the dialog.

**Responsive:** below ~900px the panel stacks under the map.

## 7. Stack and repo

Vite + React + TypeScript, Tailwind, Recharts (fallback: plain SVG), zod, vitest. Node scripts use `@anthropic-ai/sdk` with `ANTHROPIC_API_KEY` from the environment.

```
data/           rubric.json, employees.json, extractions.json, eval-report.md
scripts/        generate-reviews.ts, extract.ts, eval.ts
src/lib/        schema.ts, scoring.ts, prompt.ts, anthropic.ts
src/components/ Map, Agenda, Drilldown/{Review,EvidenceList,OtherBars,Rerun}, KeyDialog
src/state/      overrides reducer
docs/           RATIONALE.md, TIMELOG.md, superpowers/{specs,plans}
```

## 8. Testing

- vitest unit tests on `scoring.ts`: strength rule (anchors: all "at" → 2, all "well_above" → 4, per-dimension averaging), fits (n=5, n=1, n=0, degenerate x, shrinkage weight), implied-rating ranges (floor at 0.5, widening on extrapolation), agenda grouping and ranking, override recomputation.
- zod schema tests: rejects malformed extraction; quote-fidelity filter drops non-substrings.
- `scripts/eval.ts` is the test for the extraction step; its report is committed.
- No component tests.

## 9. Deployment and deliverables

- Netlify static deploy of `dist/`; `netlify.toml` with build command and publish dir. README fallback: `npm install && npm run dev`.
- `docs/RATIONALE.md`: problem and reframe; sufficiency vs strength; eval findings; cuts; extensions (shared test cases for managers, multi-cycle drift, an MCP server exposing extraction for use inside an HRIS); time spent from `docs/TIMELOG.md`.
- Video: recorded by the author.
- Transcript: exported with `simonw/claude-code-transcripts`, linked from README.

## 10. Risks

- **Model scores prose, not work.** Mitigated by prompt wording and the non-native-English eval check.
- **False precision in "under other bars".** Mitigated by standard-error bands that widen on inconsistency and extrapolation, shrinkage toward the pooled fit, n labels, and disclosure of the method.
- **Reads as AI judging people.** Mitigated by framing (evidence vs rating, not employee vs employee), no manager rankings, and overrides that keep the facilitator in charge.
- **Browser API call.** Demo trade-off; a real deployment would proxy. Key never persisted.
