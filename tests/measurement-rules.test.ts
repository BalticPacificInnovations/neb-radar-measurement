/**
 * Measurement rules: every JRC139118 indicator has a machine-readable rule, the rules are
 * internally consistent, and the engine reproduces the report's own worked examples. This file is the
 * repeatability gate: the same answers must always give the same score.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateRule, evaluateHazardPair, exprIds, resolveRule, evalExpr,
  type IndicatorRule, type CalcRule, type ChoiceRule, type PerHazardRule, type RuleContext,
} from "../src/rules-engine";
import { allRules, ruleFor, RULES_VERSION } from "../src/indicator-rules";
import { KPIS as JRC_KPIS } from "../src/kpis";

const CONTEXTS: RuleContext[] = [];
for (const scale of ["building", "neighbourhood", "urban"]) for (const use of ["residential", "non_residential"]) CONTEXTS.push({ scale, use });

function concreteRules(rule: IndicatorRule): Array<ChoiceRule | CalcRule> {
  if (rule.kind === "per_hazard") return Object.values(rule.hazards).flatMap((h) => (h.rule ? concreteRules(h.rule) : []));
  if (rule.kind === "variants") return rule.variants.map((v) => v.rule);
  return [rule];
}

describe("indicator rules data", () => {
  const rules = allRules();

  it("has a rule for each of the 83 indicators, under a version", () => {
    expect(RULES_VERSION).toMatch(/^indicator-rules-v\d+$/);
    expect(rules.length).toBe(83);
    for (const r of rules) expect(r.rule, r.code).toBeTruthy();
  });

  it("covers exactly the 29 KPIs", () => {
    const kpis = new Set(rules.map((r) => r.kpi));
    expect([...kpis].sort()).toEqual(JRC_KPIS.map((k) => k.code).sort());
  });

  it("cites the report for every rule", () => {
    for (const r of rules) expect(r.ref ?? "", r.code).toMatch(/JRC139118/);
  });

  it("uses only declared inputs in every expression and gate", () => {
    for (const r of rules) for (const c of concreteRules(r.rule!)) {
      if (c.kind !== "calc") continue;
      const ids = new Set(c.inputs.map((i) => i.id));
      expect(ids.size, `${r.code} duplicate input id`).toBe(c.inputs.length);
      for (const id of [...exprIds(c.expr), ...(c.gate ? exprIds(c.gate) : [])]) expect(ids.has(id), `${r.code}: ${id}`).toBe(true);
      for (const i of c.inputs) if (i.type === "checklist" && i.requires) expect(ids.has(i.requires.input), `${r.code} requires ${i.requires.input}`).toBe(true);
    }
  });

  it("gives every choice combination a score or an explicit 'no score'", () => {
    for (const r of rules) for (const c of concreteRules(r.rule!)) {
      if (c.kind !== "choice") continue;
      const ctxKeys = c.context ? Object.keys(c.context.options) : ["_"];
      for (const k of ctxKeys) for (const m of Object.keys(c.metric.options)) {
        expect(c.scores[k], `${r.code} context ${k}`).toBeDefined();
        expect(m in c.scores[k], `${r.code} ${k}/${m}`).toBe(true);
        const s = c.scores[k][m];
        if (s !== null) expect(s >= 0 && s <= 100, `${r.code} ${k}/${m} = ${s}`).toBe(true);
      }
    }
  });

  it("finds a rule for every scale and use where the method has one", () => {
    for (const r of rules) {
      if (r.rule!.kind !== "variants") continue;
      const hits = CONTEXTS.filter((ctx) => resolveRule(r.rule, ctx));
      expect(hits.length, r.code).toBeGreaterThan(0);
    }
  });

  it("pairs B.3.1 and B.3.2 hazard by hazard", () => {
    const a = ruleFor("B.3.1")!.rule as PerHazardRule;
    const b = ruleFor("B.3.2")!.rule as PerHazardRule;
    expect(a.kind).toBe("per_hazard");
    expect(Object.keys(a.hazards).sort()).toEqual(Object.keys(b.hazards).sort());
    expect(a.hazards.fire.same_as).toBe("B.3.2");
    expect(a.hazards.blast.same_as).toBe("B.3.2");
  });
});

describe("engine", () => {
  it("evaluates expressions without eval and rejects anything else", () => {
    expect(evalExpr("min(100, a + b * 2)", { a: 10, b: 5 })).toBe(20);
    expect(evalExpr("if(x >= 10, 100, x * 10)", { x: 4 })).toBe(40);
    expect(() => evalExpr("process.exit(1)", {})).toThrow();
    expect(() => evalExpr("a; b", { a: 1, b: 2 })).toThrow();
  });

  it("refuses a baseline without a source", () => {
    const r = ruleFor("S.3.1")!.rule!;
    expect(evaluateRule(r, { O: 18.1, T: 44.7 }).status).toBe("incomplete");
    expect(evaluateRule(r, { O: 18.1, T: { value: 44.7, source: "" } }).status).toBe("incomplete");
  });

  it("chooses the hazard with the lowest sum for both indicators (eq. 157-158)", () => {
    const sel = (v: number): CalcRule => ({ kind: "calc", inputs: [{ id: "x", type: "number", label: "x", min: 0, max: 100 }], expr: "x" });
    const first: PerHazardRule = { kind: "per_hazard", hazards: { wind: { label: "Wind", rule: sel(0) }, flood: { label: "Flood", rule: sel(0) }, fire: { label: "Fire", same_as: "B.3.2" } } };
    const second: PerHazardRule = { kind: "per_hazard", hazards: { wind: { label: "Wind", rule: sel(0) }, flood: { label: "Flood", rule: sel(0) }, fire: { label: "Fire", rule: sel(0) } } };
    const out = evaluateHazardPair(first, { by: { wind: { x: 80 }, flood: { x: 40 } } }, second, { relevant: ["wind", "flood", "fire"], by: { wind: { x: 70 }, flood: { x: 60 }, fire: { x: 55 } } });
    expect(out).toEqual({ status: "scored", hazard: "flood", first: 40, second: 60 });
    expect(evaluateHazardPair(first, {}, second, {}).status).toBe("incomplete");
    expect(evaluateRule(first, {}).status).toBe("no_score");
  });
});

// The report's worked examples, run through the stored rules. These numbers are the report's, not ours.
describe("JRC139118 worked examples", () => {
  const src = "JRC139118 worked example";

  it("S.3.1: 18.1 against the Italian zone E baseline 44.7 gives 59.5 (eq. 65)", () => {
    const out = evaluateRule(ruleFor("S.3.1")!.rule, { O: 18.1, T: { value: 44.7, source: src } }, { scale: "building", use: "residential" });
    expect(out.status).toBe("scored");
    if (out.status === "scored") expect(out.score).toBeCloseTo(59.5, 1);
  });

  it("S.5.1: 1800 ppm CO2 against 1000 ppm gives 0 (eq. 110)", () => {
    const out = evaluateRule(ruleFor("S.5.1")!.rule, { pollutant: "co2", C: 1800, T: { value: 1000, source: src } });
    expect(out).toEqual({ status: "scored", score: 0 });
  });

  it("S.7.2: five disciplines with acceptable engagement (0.6) gives 30 (eq. 129)", () => {
    const out = evaluateRule(ruleFor("S.7.2")!.rule, { N: 5, LE: "0.6" });
    expect(out).toEqual({ status: "scored", score: 30 });
  });

  it("B.1.2: premanufactured cost 49 % of capital cost gives 54 (example B.1)", () => {
    const out = evaluateRule(ruleFor("B.1.2")!.rule, { PMC: 1_470_000, GCC: 3_000_000 });
    expect(out.status).toBe("scored");
    if (out.status === "scored") expect(Math.round(out.score)).toBe(54);
  });

  it("B.6.1: the residential timber and concrete example gives 80.2 (Table 106)", () => {
    const out = evaluateRule(ruleFor("B.6.1")!.rule, { SM: "100", EF: "67", IF: "100", PI: "h2", EQ: "67" }, { scale: "building", use: "residential" });
    expect(out).toEqual({ status: "scored", score: 80.2 });
  });

  it("gives the same score every time (repeatability gate)", () => {
    const cases: Array<[string, Record<string, unknown>, RuleContext]> = [
      ["S.3.1", { O: 18.1, T: { value: 44.7, source: src } }, { scale: "building", use: "residential" }],
      ["S.7.2", { N: 5, LE: "0.6" }, {}],
      ["B.6.1", { SM: "100", EF: "67", IF: "100", PI: "h2", EQ: "67" }, { scale: "building", use: "residential" }],
    ];
    for (const [code, answers, ctx] of cases) {
      const first = JSON.stringify(evaluateRule(ruleFor(code)!.rule, answers, ctx));
      for (let i = 0; i < 50; i++) expect(JSON.stringify(evaluateRule(ruleFor(code)!.rule, structuredClone(answers), ctx))).toBe(first);
    }
  });
});

describe("every rule runs", () => {
  it("parses and scores a complete set of answers for every concrete rule", () => {
    const problems: string[] = [];
    for (const r of allRules()) for (const c of concreteRules(r.rule!)) {
      if (c.kind !== "calc") continue;
      const a: Record<string, unknown> = {};
      for (const i of c.inputs) {
        if (i.type === "number") a[i.id] = i.baseline ? { value: 2, source: "test value" } : Math.max(i.min ?? 0, 1);
        else if (i.type === "select") a[i.id] = i.options[i.options.length - 1].key;
        else if (i.type === "rating") a[i.id] = i.max;
        else a[i.id] = i.mode === "single" ? [i.items[0].key] : [];
      }
      const out = evaluateRule(c, a);
      if (out.status !== "scored") problems.push(`${r.code}: ${JSON.stringify(out)}`);
      else if (!(out.score >= 0 && out.score <= 100)) problems.push(`${r.code}: ${out.score}`);
    }
    expect(problems).toEqual([]);
  });
});

describe("scores from answers (server side)", async () => {
  const { computeScores, inconsistentRows } = await import("../src/score-from-answers");
  const ctx = { scale: "building", use: "residential" };

  it("computes the stored score from the answers and flags typed scores", () => {
    const answers = { "S.7.2": { N: 5, LE: "0.6" } };
    expect(computeScores(answers, ctx)["S.7.2"].score).toBe(30);
    expect(inconsistentRows([{ indicator_code: "S.7.2", score: 30, answers: answers["S.7.2"] }], ctx)).toEqual([]);
    expect(inconsistentRows([{ indicator_code: "S.7.2", score: 75, answers: answers["S.7.2"] }], ctx)).toEqual(["S.7.2"]);
    expect(inconsistentRows([{ indicator_code: "S.1.1", score: 60, answers: null }], ctx)).toEqual(["S.1.1"]);
  });

  it("leaves B.3.1 and B.3.2 open until the relevant hazards are answered", () => {
    const r = computeScores({ "B.3.1": { by: {} } }, ctx);
    expect(r["B.3.1"].score).toBeNull();
    expect(r["B.3.1"].outcome.status).toBe("incomplete");
  });
});
