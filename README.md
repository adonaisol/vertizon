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
