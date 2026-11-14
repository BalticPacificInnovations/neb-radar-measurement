/**
 * NEB RADAR Measurement Library: rules engine.
 *
 * Every indicator score is computed from answers with the fixed scoring rules of JRC139118. Nobody types a score
 * and no AI sets one: people (or open data, or an AI indication that is labelled as such) supply answers and
 * measured values, and this module turns them into the indicator score. Same answers, same rules, same result, every time.
 *
 * Pure and browser-safe. The rule data lives in data/indicator_rules_v2.json.
 */

export type OptionMap = Record<string, string>;

/** Fixed questionnaire: one answer, optionally read against a context answer (JRC score matrix). */
export type ChoiceRule = {
  kind: "choice";
  context: { question: string; options: OptionMap } | null;
  metric: { question: string; options: OptionMap };
  /** scores[contextKey or "_"][metricKey] = score, or null where the method gives no score for that pair. */
  scores: Record<string, Record<string, number | null>>;
};

export type NumberInput = {
  id: string;
  type: "number";
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  /** A baseline value: must carry a source (EU-level baselines). */
  baseline?: boolean;
  /** Only asked and counted when one of these keys is chosen in another input (the method's "If [...] has been selected"); worth 0 otherwise. */
  requires?: { input: string; keys: string[] };
  help?: string;
};
export type SelectInput = { id: string; type: "select"; label: string; options: Array<{ key: string; label: string; value: number }>; requires?: { input: string; keys: string[] }; help?: string };
export type ChecklistInput = {
  id: string;
  type: "checklist";
  label: string;
  /** single: one item counts (the chosen one); multi: every ticked item adds its points. */
  mode: "single" | "multi";
  /** excl: items sharing a value are mutually exclusive (for example an item and its "not applicable" twin). */
  items: Array<{ key: string; label: string; points: number; excl?: string; na?: boolean }>;
  /** Only counts when one of these keys is chosen in another checklist (the method's "If [...] has been selected"). */
  requires?: { input: string; keys: string[] };
  /** Points from this list are capped (the method's per-category maximum). */
  cap?: number;
  help?: string;
};
export type RatingInput = { id: string; type: "rating"; label: string; min: number; max: number; anchors: Record<string, string>; requires?: { input: string; keys: string[] }; help?: string };
export type RuleInput = NumberInput | SelectInput | ChecklistInput | RatingInput;

/** Formula, checklist or composite rule: inputs, then one expression that gives the score. */
export type CalcRule = {
  kind: "calc";
  inputs: RuleInput[];
  /** Arithmetic over input ids: + - * / ( ), min(a,b,...), max(a,b,...), clamp(x,lo,hi), if(cond,a,b), comparisons. */
  expr: string;
  /** Final score is clamped to this range (the method's indicator scores run from 0 to 100). */
  clamp?: [number, number];
  /** Optional gate: when the expression is 0 (false), the score is 0 whatever the rest says. */
  gate?: string;
};

/** Different rules for different scales or uses of the same indicator (for example S.4.2 building / neighbourhood). */
export type VariantRule = {
  kind: "variants";
  variants: Array<{ when: { scale?: string[]; use?: string[] }; label: string; rule: ChoiceRule | CalcRule }>;
};

/**
 * B.3.1 and B.3.2: one rule per natural or man-made hazard (JRC139118 Table 56). The method scores the pair
 * together: the hazard that gives the lowest B.3.1 + B.3.2 counts for both (eq. 157-158). A hazard marked
 * `same_as` takes its score from the other indicator for that hazard (Table 63: fire and blast).
 */
export type PerHazardRule = {
  kind: "per_hazard";
  hazards: Record<string, { label: string; rule?: ChoiceRule | CalcRule | VariantRule; same_as?: string }>;
};

export type IndicatorRule = ChoiceRule | CalcRule | VariantRule | PerHazardRule;

/** What the rule needs to know about the assessed place or project. */
export type RuleContext = { scale?: string; use?: string };

/** The concrete rule for this place, or undefined when no variant applies. */
export function resolveRule(rule: IndicatorRule | undefined, ctx: RuleContext = {}): ChoiceRule | CalcRule | undefined {
  if (!rule || rule.kind === "per_hazard") return undefined;
  if (rule.kind !== "variants") return rule;
  const v = rule.variants.find((x) =>
    (!x.when.scale || (ctx.scale !== undefined && x.when.scale.includes(ctx.scale))) &&
    (!x.when.use || (ctx.use !== undefined && x.when.use.includes(ctx.use))));
  return v?.rule;
}

export type IndicatorRuleEntry = {
  code: string;
  kpi: string;
  name: string;
  format: string;
  rule_summary: string;
  input_sources: string[];
  /** JRC139118 table or equation numbers and page, for traceability. */
  ref?: string;
  rule?: IndicatorRule;
};

export type Answers = Record<string, unknown>;

export type RuleOutcome =
  | { status: "scored"; score: number }
  | { status: "incomplete"; missing: string[] }
  | { status: "no_score"; reason: string }
  | { status: "no_rule" };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function evaluateRule(ruleIn: IndicatorRule | undefined, answers: Answers | null | undefined, ctx: RuleContext = {}): RuleOutcome {
  if (ruleIn?.kind === "per_hazard") {
    return { status: "no_score", reason: "Scored together with the other hazard indicator (B.3.1 with B.3.2), see evaluateHazardPair." };
  }
  const rule = resolveRule(ruleIn, ctx);
  if (!rule) return { status: "no_rule" };
  const a = answers ?? {};
  if (rule.kind === "choice") {
    const missing: string[] = [];
    const ctx = rule.context ? (typeof a.context === "string" ? a.context : null) : "_";
    if (rule.context && !ctx) missing.push("context");
    const met = typeof a.metric === "string" ? a.metric : null;
    if (!met) missing.push("metric");
    if (missing.length) return { status: "incomplete", missing };
    const row = rule.scores[ctx as string];
    if (!row || !(met! in row)) return { status: "incomplete", missing: ["metric"] };
    const s = row[met!];
    if (s === null || s === undefined) return { status: "no_score", reason: "The method gives no score for this combination of answers." };
    return { status: "scored", score: s };
  }
  const vars: Record<string, number> = {};
  const missing: string[] = [];
  for (const inp of rule.inputs) {
    // An input that only counts after a given choice elsewhere: not needed (and worth 0) until that choice is made.
    if (inp.requires) {
      const other = a[inp.requires.input];
      const chosen = Array.isArray(other) ? other.map(String) : typeof other === "string" ? [other] : [];
      if (!chosen.some((k) => inp.requires!.keys.includes(k))) { vars[inp.id] = 0; continue; }
    }
    const v = inputValue(inp, a[inp.id]);
    if (v === null) missing.push(inp.id);
    else vars[inp.id] = v;
  }
  // The method's gate (for example "does not comply with EN 17210: score 0, no further points") decides alone.
  if (rule.gate && exprIds(rule.gate).every((id) => id in vars)) {
    try { if (evalExpr(rule.gate, vars) === 0) return { status: "scored", score: 0 }; } catch { /* fall through */ }
  }
  if (missing.length) return { status: "incomplete", missing };
  try {
    let s = evalExpr(rule.expr, vars);
    if (!Number.isFinite(s)) return { status: "no_score", reason: "The values give no finite result (for example a baseline of zero)." };
    const [lo, hi] = rule.clamp ?? [0, 100];
    s = Math.min(hi, Math.max(lo, s));
    return { status: "scored", score: round2(s) };
  } catch (e) {
    return { status: "no_score", reason: e instanceof Error ? e.message : String(e) };
  }
}

/** The numeric value an answer contributes, or null when it is missing or invalid. */
export function inputValue(inp: RuleInput, raw: unknown): number | null {
  switch (inp.type) {
    case "number": {
      // A baseline answer is { value, source }; plain numbers otherwise.
      const v = inp.baseline && raw && typeof raw === "object" ? (raw as { value?: unknown }).value : raw;
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
      if (!Number.isFinite(n)) return null;
      if (inp.min !== undefined && n < inp.min) return null;
      if (inp.max !== undefined && n > inp.max) return null;
      if (inp.baseline) {
        const src = raw && typeof raw === "object" ? (raw as { source?: unknown }).source : null;
        if (typeof src !== "string" || src.trim().length < 3) return null;
      }
      return n;
    }
    case "select": {
      const o = inp.options.find((x) => x.key === raw);
      return o ? o.value : null;
    }
    case "rating": {
      const n = typeof raw === "number" ? raw : NaN;
      return Number.isInteger(n) && n >= inp.min && n <= inp.max ? n : null;
    }
    case "checklist": {
      // An explicit empty selection is an answer (nothing applies); undefined is missing.
      if (raw === undefined || raw === null) return null;
      const keys = Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? [raw] : null;
      if (!keys) return null;
      if (inp.mode === "single" && keys.length > 1) return null;
      let sum = 0;
      const seen = new Set<string>();
      for (const k of keys) {
        const it = inp.items.find((x) => x.key === k);
        if (!it) return null;
        if (it.excl) {
          if (seen.has(it.excl)) return null;
          seen.add(it.excl);
        }
        sum += it.points;
      }
      return inp.cap !== undefined ? Math.min(inp.cap, sum) : sum;
    }
  }
}

/* ---------- a small, safe expression evaluator (no eval) ---------- */

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.eE]/.test(src[j])) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "==", "!=", "&&", "||"].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/(),<>".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}" in rule expression`);
  }
  return out;
}

export function evalExpr(src: string, vars: Record<string, number>): number {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => {
    const t = toks[p++];
    if (!t || (v !== undefined && t.v !== v)) throw new Error(`Rule expression: expected ${v ?? "a value"}`);
    return t;
  };
  const FUN: Record<string, (args: number[]) => number> = {
    min: (a) => Math.min(...a),
    max: (a) => Math.max(...a),
    clamp: ([x, lo, hi]) => Math.min(hi, Math.max(lo, x)),
    abs: ([x]) => Math.abs(x),
    if: ([c, a, b]) => (c !== 0 ? a : b),
  };
  function primary(): number {
    const t = eat();
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") { const v = orExpr(); eat(")"); return v; }
    if (t.t === "op" && t.v === "-") return -primary();
    if (t.t === "id") {
      if (peek()?.t === "op" && peek()!.v === "(") {
        eat("(");
        const args: number[] = [];
        if (!(peek()?.t === "op" && peek()!.v === ")")) {
          args.push(orExpr());
          while (peek()?.t === "op" && peek()!.v === ",") { eat(","); args.push(orExpr()); }
        }
        eat(")");
        const f = FUN[t.v];
        if (!f) throw new Error(`Unknown function ${t.v}`);
        return f(args);
      }
      if (!(t.v in vars)) throw new Error(`Unknown value ${t.v}`);
      return vars[t.v];
    }
    throw new Error("Rule expression: unexpected token");
  }
  function mul(): number {
    let v = primary();
    while (peek()?.t === "op" && (peek()!.v === "*" || peek()!.v === "/")) {
      const op = eat().v; const r = primary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function add(): number {
    let v = mul();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = eat().v; const r = mul();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function cmp(): number {
    let v = add();
    while (peek()?.t === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(String(peek()!.v))) {
      const op = eat().v; const r = add();
      v = (op === "<" ? v < r : op === ">" ? v > r : op === "<=" ? v <= r : op === ">=" ? v >= r : op === "==" ? v === r : v !== r) ? 1 : 0;
    }
    return v;
  }
  function andExpr(): number {
    let v = cmp();
    while (peek()?.t === "op" && peek()!.v === "&&") { eat(); const r = cmp(); v = v !== 0 && r !== 0 ? 1 : 0; }
    return v;
  }
  function orExpr(): number {
    let v = andExpr();
    while (peek()?.t === "op" && peek()!.v === "||") { eat(); const r = andExpr(); v = v !== 0 || r !== 0 ? 1 : 0; }
    return v;
  }
  const v = orExpr();
  if (p !== toks.length) throw new Error("Rule expression: unexpected text at the end");
  return v;
}

/** Ids every expression in a rule refers to, for data checks. */
export function exprIds(src: string): string[] {
  return lex(src).filter((t, i, all) => t.t === "id" && !(all[i + 1]?.t === "op" && all[i + 1].v === "(")).map((t) => String(t.v));
}

/** Answers for a per-hazard indicator: the hazards relevant to the site, and the answers for each one. */
export type HazardAnswers = { relevant?: string[]; by?: Record<string, Answers> };

export type HazardPairOutcome =
  | { status: "scored"; hazard: string; first: number; second: number }
  | { status: "incomplete"; missing: string[] }
  | { status: "no_score"; reason: string };

/**
 * JRC139118 eq. 157-158: evaluate B.3.1 and B.3.2 for every relevant hazard and keep the hazard with the lowest
 * sum; both indicators take their score for that hazard. Ties go to the hazard listed first in the rule.
 */
export function evaluateHazardPair(
  first: PerHazardRule, firstAnswers: HazardAnswers | null | undefined,
  second: PerHazardRule, secondAnswers: HazardAnswers | null | undefined,
  ctx: RuleContext = {},
): HazardPairOutcome {
  const relevant = secondAnswers?.relevant ?? firstAnswers?.relevant;
  if (!relevant || relevant.length === 0) return { status: "incomplete", missing: ["relevant hazards"] };
  const order = Object.keys(second.hazards);
  const unknown = relevant.filter((h) => !order.includes(h) || !(h in first.hazards));
  if (unknown.length) return { status: "no_score", reason: `Unknown hazard: ${unknown.join(", ")}` };
  const missing: string[] = [];
  const scored: Array<{ h: string; a: number; b: number }> = [];
  const one = (rule: PerHazardRule, ans: HazardAnswers | null | undefined, h: string, tag: string): number | null => {
    const def = rule.hazards[h];
    const out = evaluateRule(def.rule, ans?.by?.[h], ctx);
    if (out.status === "scored") return out.score;
    if (out.status === "incomplete") missing.push(...out.missing.map((m) => `${tag} ${h}: ${m}`));
    else missing.push(`${tag} ${h}: ${out.status === "no_score" ? out.reason : "no rule"}`);
    return null;
  };
  for (const h of order.filter((x) => relevant.includes(x))) {
    const b = one(second, secondAnswers, h, "second");
    const a = first.hazards[h].same_as ? b : one(first, firstAnswers, h, "first");
    if (a !== null && b !== null) scored.push({ h, a, b });
  }
  if (missing.length) return { status: "incomplete", missing };
  const best = scored.reduce((m, x) => (x.a + x.b < m.a + m.b ? x : m));
  return { status: "scored", hazard: best.h, first: best.a, second: best.b };
}
