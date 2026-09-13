# Design rationale

## 1. Why this theme and approach

I took Theme 4 (Evaluation & Data Quality) into the People domain: calibration is where that theme already lives inside a company, settled by argument rather than measurement.

Three things go wrong in those meetings. A rating does not match the written review, in either direction. The same work gets a different rating depending on which manager wrote it up. And "Exceeds" or "L5 scope" quietly comes to mean different things on different teams.

The usual instrument — this manager gave three Exceeds, that one gave none — cannot settle any of them. A manager whose ratings skew high is either lenient or has a stronger team, and ratings alone contain nothing that separates the two.

So I reframed the unit of analysis: score the **written evidence** against one shared rubric, then compare **rating against evidence**. On one chart, a point far from the diagonal is a rating/evidence mismatch; a manager whose fitted line sits above or below the others is lenient or harsh; managers whose lines differ in slope are asking for different amounts of evidence before they will say "Exceeds".

This is what ML teams do when they audit human labelers, applied to managers — and why the model's reliability is treated as first-class here: Claude maps the evidence to the rubric, so Claude is one more rater in the room.

## 2. What is non-obvious

**Sufficiency is not strength.** A review that says nothing concrete is not evidence of weak work; it is evidence of a weak review, and collapsing the two punishes employees for their manager's writing habits. So `sufficiency` is returned separately from `strength`, and low-sufficiency points are drawn hollow, excluded from manager fits, and given their own agenda group ("Get more input") rather than ranked as mismatches.

**The model is a rater, and raters get evaluated.** The extraction step gets an eval script with pass/fail checks instead of my trust that its output looks plausible; the report ships with the data.

**"Under another manager's bar" falls out of the same fit.** Once each manager has a fitted line of rating on evidence, asking what this employee would have scored on another team is just evaluating that line at this employee's evidence. No new model call, no new concept.

**Uncertainty has to widen where it should.** That comparison extrapolates whenever the evidence lies outside the range a manager has actually rated, so the band is the standard error of the fitted line: it widens both when a manager is inconsistent and when the evidence is outside their observed range.

## 3. Key decisions and trade-offs

**Precompute plus a live re-run.** The demo has to work for a reviewer with no key, so all 30 extractions are bundled; one button re-runs a single extraction live. I had no Anthropic API key, so rather than fake the extractions I ran all ninety precompute calls through Claude Code headless mode (`claude -p`): same prompt, same zod validation, different transport. The browser path uses the SDK, and I verified it without a key two ways — a mocked extractor for the success path, a real call with an invalid key for the 401 path. It was never run end to end with a valid key, the biggest untested seam in the project.

**A zod version trap.** The SDK's structured-output helper needs zod-v4-core schema objects and zod 3.25 defaults to v3 shapes, so I migrated `src/lib/schema.ts` to `zod/v4` rather than keep a mirror schema: one definition serves the API call, the script and the browser.

**Continuous strength.** The rule maps each evidence level to −2…+2, averages within a dimension, averages across the dimensions present, and returns `2 + mean` clamped to 1–4. It runs client-side so an override recomputes everything instantly, and being continuous it gives the map a real x-axis rather than a 4×4 grid of overlapping dots.

**Shrinkage, and a floor on the band.** Five points per manager is not enough for a stable slope, so each manager's fit is shrunk toward the pooled fit with weight `n / (n + 3)`; k = 3 is a judgment call, not a tuned value. The implied-rating half-width is `max(0.5, s · sqrt(1/n + (x − x̄)² / Sxx))` — half a rating step is the smallest honest resolution on a 4-point integer scale, so the band never claims more precision than the scale has.

**Manager identity is withheld from the prompt.** The extractor sees the rubric, the level, the review text and the rating, and nothing about who wrote it; the rating is there only so the model can flag a contradiction, with an instruction not to anchor on it.

**Key in memory, and no league table.** The API key lives in React state, is never written to storage, and is gone on reload. The browser calls `api.anthropic.com` directly with the direct-browser-access header — a demo trade-off; a real deployment would proxy. There are no manager rankings or scorecards: the object under discussion is the gap between a rating and its evidence.

## 4. What the eval found

`scripts/eval.ts` checks 30 reviews × 3 runs (`data/eval-report.md`):

- **Stability:** strength identical across all three runs for 28/30 employees; the other two moved one point.
- **Quote fidelity:** 186 quotes returned, 0 dropped as non-verbatim.
- **Rule vs model:** the client-side rule lands within 0.5 of the model's own holistic integer for 23/29 employees. The rule averages and therefore compresses; the model commits to a whole number. The UI uses the rule everywhere, so bundled and overridden values stay comparable.
- **Planted truth, first run:** 4 of 10 checks failed. Lenient offset +0.50, harsh −0.42, calibrated +0.44, and the planted contradictory case (e13) landed in "Looks consistent" instead of Discuss.

Two real flaws sat behind those failures. Manager offsets included each manager's own planted anomaly, dragging every offset — the calibrated baseline included — toward the mean, and because the strength rule compresses, fixed absolute thresholds were the wrong test; I excluded planted employees from the offsets and made the lenient/harsh checks relative to the calibrated baseline. The second was a product defect: a single averaged gap hides a spiky per-dimension profile — one dimension well above the bar and another well below cancel to zero, which is exactly what a contradictory review looks like. So `scoring.ts` gained `dimensionSpread`, and an "uneven profile" rule that routes a case to Discuss when its dimension spread is ≥ 2, whatever the average gap.

The prompt and the data were not changed. On re-run all 10 checks pass: offsets +0.92 (lenient), −0.53 (harsh), +0.30 (calibrated), and the non-native-English team's mean strength at 2.30 against the calibrated team's 2.36 — both were written at the same true quality, so that comparison isolates writing style.

## 5. What was cut

Authentication, editing reviews, export, multi-cycle history, per-manager scorecards or rankings — the last on framing grounds rather than time — and the "shared test cases" idea below, left as future work.

## 6. With more time

**Shared test cases for managers.** Have every manager rate the same two or three anonymized reviews. That measures rater calibration directly instead of inferring it from their own team, and removes the team-strength confound entirely.

**Multi-cycle drift.** The same chart across cycles shows whether a team's bar is moving — the thing calibration is really protecting against.

**An MCP server exposing `extractOne`,** so the scoring runs inside an HRIS, where the reviews already live, instead of on a copy.

**A human-labeled evidence set.** The eval measures self-consistency, quote fidelity and recovery of planted structure, not agreement with human judgment — I have no human labels. That, with a sample of 30 synthetic reviews, is the ceiling on what the report can claim.

## 7. Time spent

About 234 minutes of active work as of the last entry in `docs/TIMELOG.md`, excluding breaks and including roughly 10 minutes of pre-reading on the day the brief arrived.

## 8. Disclosure

The dataset is entirely synthetic: 30 employees, 6 managers × 5 reports, one rubric. Each manager was written to a style (calibrated, lenient, harsh, verbose-but-vague, non-native English, terse), and four cases were planted (over-rated, under-rated, contradictory evidence, self-contradicting review). Both are recorded in `data/employees.json` and read only by the eval script. Names were assigned to the styles from a shuffled list, so no name carries an intended association with the behavior it illustrates.
