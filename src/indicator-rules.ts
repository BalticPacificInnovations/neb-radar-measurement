// Indicator scoring rules of JRC139118 in machine-readable form. Versioned: a result always
// records the rules version it was computed with, and a change in the rules is a new version.
import data from "../data/indicator_rules_v1.json";
import type { IndicatorRuleEntry } from "./rules-engine";

export const RULES_VERSION = "indicator-rules-v1";

const ENTRIES = (data as unknown as { indicators: IndicatorRuleEntry[] }).indicators;
const BY_CODE = new Map(ENTRIES.map((e) => [e.code, e]));

export function ruleFor(code: string): IndicatorRuleEntry | undefined {
  return BY_CODE.get(code);
}
export function allRules(): IndicatorRuleEntry[] {
  return ENTRIES;
}
export const RULES_SOURCE = (data as unknown as { source: { attribution: string; licence: string } }).source;
