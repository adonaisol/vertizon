No changes were made to the extraction prompt or to `data/employees.json` / `data/extractions.json`. Four of the ten planted-truth checks in section 5 FAIL:

- lenient manager offset > +0.5 — FAIL, actual 0.50 (at the boundary, not strictly above it)
- harsh manager offset < -0.5 — FAIL, actual -0.42
- calibrated manager |offset| < 0.4 — FAIL, actual 0.44
- planted contradictory (e13) lands in Discuss or is noted as contradictory — FAIL, group=consistent, notes contain no `/contradict/i` match

The remaining six checks PASS, including both stability (28/30 identical across 3 runs) and quote fidelity (100%, 0 dropped).

Per the task instructions, these are reported here as a concern for the controller rather than resolved by editing the prompt or data: the three manager-offset misses are all near-miss magnitude issues (each within ~0.08-0.1 of its threshold) rather than sign errors, and the e13 case is a single planted example, not a systemic pattern. Only one model (`claude-opus-5`) was used for extraction in this run, so the two-model note does not apply.
