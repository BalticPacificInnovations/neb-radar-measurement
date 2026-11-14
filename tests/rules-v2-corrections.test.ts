/**
 * Rules version 2 (14 Nov 2026): corrections found by a blind second extraction of JRC139118.
 * Each test states the report's own table or worked example, so the rule cannot drift back.
 */
import { describe, expect, it } from "vitest";
import { evaluateRule, type CalcRule, type PerHazardRule } from "../src/rules-engine";
import { ruleFor, RULES_VERSION } from "../src/indicator-rules";

const src = "JRC139118 worked example";
const hazard = (h: string) => (ruleFor("B.3.2")!.rule as PerHazardRule).hazards[h].rule as CalcRule;
const items = (r: CalcRule, id: string) => { const i = r.inputs.find((x) => x.id === id)!; return i.type === "checklist" ? i.items : []; };
const score = (r: CalcRule, a: Record<string, unknown>) => { const o = evaluateRule(r, a); return o.status === "scored" ? o.score : o.status; };

describe("rules version 2", () => {
  it("is the version in use", () => expect(RULES_VERSION).toBe("indicator-rules-v2"));

  it("S.4.5 multiplies by 1000 and reproduces the report's examples (eq. 96: 33.3; eq. 100: 111 capped to 100)", () => {
    const r = ruleFor("S.4.5")!.rule;
    const a = evaluateRule(r, { NI: 672892, P: 723540, T: { value: 90, source: src } });
    expect(a.status).toBe("scored");
    if (a.status === "scored") expect(a.score).toBeCloseTo(33.3, 1);
    expect(evaluateRule(r, { NI: 723540, P: 723540, T: { value: 90, source: src } })).toEqual({ status: "scored", score: 100 });
  });

  it("B.9.3 uses the short form for buildings of low value, at any scale, and reproduces Table 142 (68)", () => {
    const r = ruleFor("B.9.3")!.rule!;
    expect(r.kind).toBe("calc");
    const full = { val: "sig", PSE: 40, FLO: 100, POp: 70, POt: 100, PEGa: 60, PEGt: 100, IIS1: 5, IIS2: 4, PKF1: 4, PKF2: 4 };
    for (const scale of ["building", "neighbourhood"]) expect(evaluateRule(r, full, { scale, use: "residential" })).toEqual({ status: "scored", score: 68 });
    // Low value: structural elements, openings and key features are not asked; (0.2*60 + 0.2*90) / 0.4 = 75.
    expect(evaluateRule(r, { val: "low", PEGa: 60, PEGt: 100, IIS1: 5, IIS2: 4 }, { scale: "building", use: "residential" })).toEqual({ status: "scored", score: 75 });
    expect(evaluateRule(r, { val: "sig", PEGa: 60, PEGt: 100, IIS1: 5, IIS2: 4 }).status).toBe("incomplete");
  });

  it("B.3.2 flood has the twelve damage-reduction rows of Table 65", () => {
    const g4 = items(hazard("flood"), "g4").filter((i) => !i.na);
    expect(g4.map((i) => i.points)).toEqual([5, 5, 10, 5, 5, 5, 2.5, 5, 2.5, 2.5, 2.5, 2.5]);
    expect(g4.at(-1)!.label).toMatch(/^Non-return valves/);
  });

  it("B.3.2 earthquake has the five analysis methods of Table 66", () => {
    expect(items(hazard("earthquake"), "g4").map((i) => i.points)).toEqual([0, 0, 5, 10, 15]);
  });

  it("B.3.2 tsunami has the rows of Table 69 and asks the performance objectives only after compliance", () => {
    const r = hazard("tsunami");
    expect(items(r, "g2").map((i) => i.points)).toEqual([10, 10, 20, 15]);
    expect(items(r, "g3").filter((i) => !i.na).map((i) => i.points)).toEqual([5, 10, 10, 10, 20]);
    const gate = r.inputs.find((x) => x.id === "gate")!;
    expect(gate.type === "select" && new Set(gate.options.map((o) => o.key)).size).toBe(3);
    expect(score(r, { gate: "no", g2: ["g2i3"], g3: [] })).toBe(0);
    expect(score(r, { gate: "notreq", g2: ["g2i3"], g3: ["g3i4"] })).toBe(30);
    expect(score(r, { gate: "yes", g1: ["g1i1"], g2: ["g2i3"], g3: ["g3i4_na"] })).toBe(80);
    expect(score(r, { gate: "yes", g2: [], g3: [] })).toBe("incomplete");
  });

  it("B.3.2 fire gives +20 for the prescriptive and +40 for the performance-based approach (Table 70)", () => {
    const r = hazard("fire");
    const none = { g1: [], g2: [], g3: [], g4: [] };
    expect(score(r, { gate: "no", ...none })).toBe(0);
    expect(score(r, { gate: "prescriptive", ...none })).toBe(20);
    expect(score(r, { gate: "performance", ...none })).toBe(40);
  });

  it("no select or checklist has two entries with the same key", () => {
    const dup: string[] = [];
    const walk = (rule: unknown, path: string) => {
      const r = rule as { kind: string; inputs?: Array<{ id: string; options?: Array<{ key: string }>; items?: Array<{ key: string }> }>; variants?: Array<{ rule: unknown }>; hazards?: Record<string, { rule?: unknown }> };
      if (r.kind === "calc") for (const i of r.inputs ?? []) { const k = [...(i.options ?? []), ...(i.items ?? [])].map((x) => x.key); if (new Set(k).size !== k.length) dup.push(`${path} ${i.id}`); }
      if (r.kind === "variants") r.variants!.forEach((v, n) => walk(v.rule, `${path}/${n}`));
      if (r.kind === "per_hazard") for (const [h, v] of Object.entries(r.hazards!)) if (v.rule) walk(v.rule, `${path}/${h}`);
    };
    for (const code of ["B.3.1", "B.3.2", "B.5.1", "B.5.2", "B.5.3", "B.4.1", "B.4.2", "B.2.1", "S.7.1"]) walk(ruleFor(code)!.rule, code);
    expect(dup).toEqual([]);
  });
});
