# Changelog

A change in the rules is a new rules version. Earlier versions stay in `data/`.

## indicator-rules-v2 (14 November 2026)

A blind second extraction of all 83 indicator rules from JRC139118 was compared with version 1. It confirmed the rules of 80 indicators and found the differences below. Page numbers are the printed page numbers of the report.

| Indicator | Version 1 | Version 2, as in the report | Report |
|---|---|---|---|
| S.4.5 Public transportation systems: accessibility | Multiplied by 100 | Multiplied by 1000, as in the text, equation 85 and both worked examples | p. 103, 109, 110 |
| B.9.3 Improving preservation of cultural and natural heritage in renovated buildings | Short form (equation 217) applied at neighbourhood and urban scale | Short form applied to historic buildings of low architectural or cultural value, at any scale | p. 301, 302 |
| B.3.2 Hazard resilient design, flood | 11 damage-reduction rows | 12 rows: "Non-return valves are used in the drainage system", +2.5 | Table 65, p. 204 |
| B.3.2, earthquake | 3 analysis methods | 5: "Non-linear static analysis" +10, "Non-linear response history analysis" +15 | Table 66, p. 205 |
| B.3.2, tsunami | 3 modelling rows, 4 damage-limitation rows | "Non-linear static analysis appropriate for tsunami loading" +20; "Non-structural components ... designed to break-away" +10; the performance objectives are asked only after compliance; unique option keys | Table 69, p. 206 |
| B.3.2, fire | The design approach gave no points | Prescriptive approach +20, performance-based approach +40; unique option keys | Table 70, p. 207 |

Engine: any input can now depend on a choice made in another input (`requires`), not only checklists.

Tests: `tests/rules-v2-corrections.test.ts` holds the report's tables and worked examples for these rules.

## indicator-rules-v1 (12 November 2026)

First version.
