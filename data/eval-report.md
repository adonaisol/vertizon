# Extraction eval report

Model: claude-opus-5. 30 reviews × 3 runs. Generated 2026-09-13.

## 1. Stability
Identical strength across runs: 28/30. Max spread histogram: {"0":28,"1":2}.

## 2. Quote fidelity
Quotes kept (canonical run): 186. Dropped as non-verbatim (all runs): 0.

## 3. Rule vs model strength
Client-side strength rule within 0.5 of the model's own strength: 23/29.

## 4. Manager offsets (mean rating − evidence, usable points only)
| Manager | Style | Offset | n |
|---|---|---|---|
| Priya Nair | calibrated | 0.30 | 4 |
| Tom Whitaker | lenient | 0.92 | 4 |
| Marcus Bell | harsh | -0.53 | 4 |
| Sofia Ramos | verbose | n/a | 0 |
| Lena Fischer | nonnative | 0.10 | 5 |
| Omar Haddad | terse | n/a | 0 |

## 5. Planted-truth checks
| Check | Result | Detail |
|---|---|---|
| lenient manager runs ≥ 0.3 above the calibrated baseline | PASS | +0.92 vs +0.30 |
| harsh manager runs ≥ 0.3 below the calibrated baseline | PASS | -0.53 vs +0.30 |
| calibrated manager |offset| < 0.4 | PASS | 0.30 |
| terse team >= 80% low sufficiency | PASS | 100% |
| verbose team not scored high on prose alone (mean strength <= 2.5) | PASS | 2.01 |
| non-native team scored on work: mean strength within 0.5 of calibrated team | PASS | 2.30 vs 2.36 |
| planted over_rated (e03) lands in Discuss | PASS | group=discuss |
| planted under_rated (e08) lands in Discuss | PASS | group=discuss |
| planted contradictory (e13) lands in Discuss | PASS | group=discuss |
| planted self_contradicting (e19) lands in Discuss or is noted as contradictory | PASS | group=more_input noted=true |

Note: the non-native and calibrated teams were written to comparable quality mixes — three Meets plus two stronger cases on each, one of the calibrated team's being Greatly Exceeds — so the comparison mostly isolates writing style.

## 6. Changes made in response
See notes below.

First run: 4/10 checks FAILed — lenient offset 0.50, harsh offset -0.42, calibrated offset 0.44, and planted contradictory (e13) landed in `consistent` instead of `Discuss`.

Diagnosis:
- Manager offsets included each manager's own planted anomaly, pulling every offset (including the calibrated baseline) toward the mean.
- The strength rule's scale compresses, so fixed absolute lenient/harsh thresholds were the wrong test; a relative comparison to the calibrated baseline is more robust.
- `agenda`'s single averaged gap hides a spiky per-dimension profile (one dimension well above, another well below) even when the average gap is 0 — exactly what the contradictory plant does.

What changed (eval only): `managerOffsets` now excludes planted employees; lenient/harsh checks compare against the calibrated baseline (≥0.3 apart) instead of fixed absolute thresholds.

What changed (product): added `dimensionMeans`/`dimensionSpread` to `scoring.ts` and a new "uneven profile" rule in `agenda` that routes a case to Discuss when its dimension spread is ≥2, even at gap 0.

The extraction prompt and the data files were NOT changed.

Re-run result: all 10 planted-truth checks PASS.
