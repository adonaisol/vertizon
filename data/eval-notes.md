First run: 4/10 checks FAILed — lenient offset 0.50, harsh offset -0.42, calibrated offset 0.44, and planted contradictory (e13) landed in `consistent` instead of `Discuss`.

Diagnosis:
- Manager offsets included each manager's own planted anomaly, pulling every offset (including the calibrated baseline) toward the mean.
- The strength rule's scale compresses, so fixed absolute lenient/harsh thresholds were the wrong test; a relative comparison to the calibrated baseline is more robust.
- `agenda`'s single averaged gap hides a spiky per-dimension profile (one dimension well above, another well below) even when the average gap is 0 — exactly what the contradictory plant does.

What changed (eval only): `managerOffsets` now excludes planted employees; lenient/harsh checks compare against the calibrated baseline (≥0.3 apart) instead of fixed absolute thresholds.

What changed (product): added `dimensionMeans`/`dimensionSpread` to `scoring.ts` and a new "uneven profile" rule in `agenda` that routes a case to Discuss when its dimension spread is ≥2, even at gap 0.

The extraction prompt and the data files were NOT changed.

Re-run result: all 10 planted-truth checks PASS.
