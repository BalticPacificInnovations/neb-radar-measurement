# NEB RADAR Measurement Library

Machine-readable scoring rules for the New European Bauhaus indicators, with a deterministic reference engine and repeatability tests.

The European Commission's Joint Research Centre (JRC) published the New European Bauhaus self-assessment method in report JRC139118. It defines 29 key performance indicators (KPIs) made up of 83 indicators. Each indicator has its own formula, baseline or rating scale. This library turns those rules into data and code that any software can use, so that the same answers always give the same score.

**Independent implementation.** This library is an independent implementation of the method published in JRC139118. It is not affiliated with, endorsed by or maintained by the Joint Research Centre or the European Commission. For the official method, read the report; the JRC also offers its own online application of the method on the New European Bauhaus Knowledge Management Platform.

## What is in it

| Path | What it is | Licence |
|---|---|---|
| `data/indicator_rules_v2.json` | The scoring rules for all 83 indicators: inputs, units, baseline requirements, choice tables or expressions, variants by scale and building use, and the report reference for every rule | CC BY 4.0 |
| `data/indicator_rules_v1.json` | The previous rules version, kept so that results computed with it can be traced. See `CHANGELOG.md` | CC BY 4.0 |
| `src/rules-engine.ts` | The reference engine: evaluates a rule against answers, without `eval` | Apache-2.0 |
| `src/score-from-answers.ts` | Computes the scores for a set of answers and finds stored scores that do not follow from their answers | Apache-2.0 |
| `src/indicator-rules.ts` | Loads the rules and exposes the rules version | Apache-2.0 |
| `src/kpis.ts` | The 29 KPIs and their dimensions | Apache-2.0 |
| `tests/` | Consistency checks on the rules, the report's worked examples and the repeatability gate | Apache-2.0 |

## How a score is produced

A score is never typed in. A person, a document or a data source supplies answers and measured values; the engine applies the rule for that indicator and returns either a score from 0 to 100 or an explicit "no score" with the reason.

Three kinds of rule cover the method:

- **Choice**: the answers to one or more questions select a score from a table.
- **Calculation**: measured values are compared with a baseline by the report's formula, then clamped to 0 to 100. A baseline must carry its source. Some indicators have variants by scale (building, neighbourhood, urban) and by building use (residential, non-residential).
- **Per hazard**: indicators B.3.1 and B.3.2 are answered per hazard and coupled exactly as the report's equations 157 and 158 require.

Every result records the rules version it was computed with. A change in the rules is a new version, never a silent edit.

## Tests

```
bun install
bunx vitest run
```

The tests check that every one of the 83 indicators has a rule, that the rules cover exactly the 29 KPIs, that every rule cites the report, that expressions use only declared inputs, and that every choice combination gives a score or an explicit "no score". They reproduce the report's own worked examples, among them:

- S.3.1: 18.1 against the Italian zone E baseline 44.7 gives 59.5 (eq. 65)
- S.5.1: 1800 ppm CO2 against 1000 ppm gives 0 (eq. 110)
- S.7.2: five disciplines with acceptable engagement gives 30 (eq. 129)
- B.1.2: premanufactured cost at 49 % of capital cost gives 54 (example B.1)
- B.6.1: the residential timber and concrete example gives 80.2 (Table 106)

The repeatability gate runs the same answers many times and requires the same score every time.

## Planned

A JSON schema for rules, answers and results; a Python package with full parity; and a language-neutral conformance test suite, so any implementation can prove that it produces the same scores.

## Source and attribution

The rules are derived from: European Commission, Joint Research Centre (2024), *A practical guide to the New European Bauhaus self-assessment method and tool*, JRC139118, published under CC BY 4.0: https://publications.jrc.ec.europa.eu/repository/handle/JRC139118

Changes made: the rules were extracted from the report and restructured as machine-readable data, with short descriptions. Any errors in the extraction are ours, not the JRC's.

## Licences

- Code (`src/`, `tests/`): Apache License 2.0, see `LICENSE`.
- Rules data (`data/`): Creative Commons Attribution 4.0 International, see `LICENSES/CC-BY-4.0.txt`. When you reuse the data, credit both the JRC report above and this library.

The name NEB RADAR is not licensed by either licence.
