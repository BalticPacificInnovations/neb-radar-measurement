// An indicator score is never typed. It is computed from the answers to the method's questions
// with the versioned rules, and recomputed the same way at save, submit and approval.
import { evaluateHazardPair, evaluateRule, type Answers, type HazardAnswers, type PerHazardRule, type RuleContext, type RuleOutcome } from "./rules-engine";
import { ruleFor, RULES_VERSION } from "./indicator-rules";

/** Indicators scored as a pair (JRC139118 eq. 157-158). */
export const HAZARD_PAIR = ["B.3.1", "B.3.2"] as const;

export type ComputedScore = { code: string; score: number | null; outcome: RuleOutcome | { status: "scored"; score: number; hazard: string }; rulesVersion: string };

export function ruleContext(c: { scale?: string; use?: string } | null | undefined): RuleContext {
  return { scale: c?.scale, use: c?.use };
}

/** Score for every indicator that has answers. B.3.1 and B.3.2 are computed together. */
export function computeScores(answersByCode: Record<string, Answers | null | undefined>, ctx: RuleContext): Record<string, ComputedScore> {
  const out: Record<string, ComputedScore> = {};
  for (const [code, answers] of Object.entries(answersByCode)) {
    if (answers == null || (HAZARD_PAIR as readonly string[]).includes(code)) continue;
    const outcome = evaluateRule(ruleFor(code)?.rule, answers, ctx);
    out[code] = { code, score: outcome.status === "scored" ? outcome.score : null, outcome, rulesVersion: RULES_VERSION };
  }
  const [c1, c2] = HAZARD_PAIR;
  if (answersByCode[c1] != null || answersByCode[c2] != null) {
    const pair = evaluateHazardPair(
      ruleFor(c1)!.rule as PerHazardRule, answersByCode[c1] as HazardAnswers | null,
      ruleFor(c2)!.rule as PerHazardRule, answersByCode[c2] as HazardAnswers | null, ctx,
    );
    if (pair.status === "scored") {
      out[c1] = { code: c1, score: pair.first, outcome: { status: "scored", score: pair.first, hazard: pair.hazard }, rulesVersion: RULES_VERSION };
      out[c2] = { code: c2, score: pair.second, outcome: { status: "scored", score: pair.second, hazard: pair.hazard }, rulesVersion: RULES_VERSION };
    } else {
      for (const c of HAZARD_PAIR) if (answersByCode[c] != null) out[c] = { code: c, score: null, outcome: pair, rulesVersion: RULES_VERSION };
    }
  }
  return out;
}

/** Stored rows whose score does not follow from their answers (typed earlier, edited elsewhere, or an older rule version). */
export function inconsistentRows(
  rows: Array<{ indicator_code: string; score: number | null; answers: Answers | null }>,
  ctx: RuleContext,
): string[] {
  const computed = computeScores(Object.fromEntries(rows.map((r) => [r.indicator_code, r.answers])), ctx);
  return rows
    .filter((r) => r.score !== null || r.answers !== null)
    .filter((r) => {
      const c = computed[r.indicator_code];
      if (!c) return r.score !== null; // a score without answers was typed, not computed
      return (c.score === null) !== (r.score === null) || (c.score !== null && Math.abs(c.score - Number(r.score)) > 0.005);
    })
    .map((r) => r.indicator_code);
}
