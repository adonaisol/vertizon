# Extraction eval report

Model: claude-opus-5. 30 reviews × 3 runs. Generated 2026-09-13.

## 1. Stability
Identical strength across runs: 28/30. Max spread histogram: {"0":28,"1":2}.

## 2. Quote fidelity
Quotes kept: 186. Dropped (not verbatim): 0. Fidelity: 100.0%.

## 3. Rule vs model strength
Client-side strength rule within 0.5 of the model's own strength: 23/29.

## 4. Manager offsets (mean rating − evidence, usable points only)
| Manager | Style | Offset | n |
|---|---|---|---|
| Priya Nair | calibrated | 0.44 | 5 |
| Tom Whitaker | lenient | 0.50 | 5 |
| Marcus Bell | harsh | -0.42 | 5 |
| Sofia Ramos | verbose | n/a | 0 |
| Lena Fischer | nonnative | 0.10 | 5 |
| Omar Haddad | terse | n/a | 0 |

## 5. Planted-truth checks
| Check | Result | Detail |
|---|---|---|
| lenient manager offset > +0.5 | FAIL | 0.50 |
| harsh manager offset < -0.5 | FAIL | -0.42 |
| calibrated manager |offset| < 0.4 | FAIL | 0.44 |
| terse team >= 80% low sufficiency | PASS | 100% |
| verbose team not scored high on prose alone (mean strength <= 2.5) | PASS | 2.01 |
| non-native team scored on work: mean strength within 0.5 of calibrated team | PASS | 2.30 vs 2.36 |
| planted over_rated (e03) lands in Discuss | PASS | group=discuss |
| planted under_rated (e08) lands in Discuss | PASS | group=discuss |
| planted contradictory (e13) lands in Discuss or is noted as contradictory | FAIL | group=consistent noted=false |
| planted self_contradicting (e19) lands in Discuss or is noted as contradictory | PASS | group=more_input noted=true |

Note: the non-native and calibrated teams were written at the same true quality (two Exceeds, three Meets), so comparing their mean strength isolates the effect of writing style.

## 6. Changes made in response
See notes below.

No changes were made to the extraction prompt or to `data/employees.json` / `data/extractions.json`. Four of the ten planted-truth checks in section 5 FAIL:

- lenient manager offset > +0.5 — FAIL, actual 0.50 (at the boundary, not strictly above it)
- harsh manager offset < -0.5 — FAIL, actual -0.42
- calibrated manager |offset| < 0.4 — FAIL, actual 0.44
- planted contradictory (e13) lands in Discuss or is noted as contradictory — FAIL, group=consistent, notes contain no `/contradict/i` match

The remaining six checks PASS, including both stability (28/30 identical across 3 runs) and quote fidelity (100%, 0 dropped).

Per the task instructions, these are reported here as a concern for the controller rather than resolved by editing the prompt or data: the three manager-offset misses are all near-miss magnitude issues (each within ~0.08-0.1 of its threshold) rather than sign errors, and the e13 case is a single planted example, not a systemic pattern. Only one model (`claude-opus-5`) was used for extraction in this run, so the two-model note does not apply.
