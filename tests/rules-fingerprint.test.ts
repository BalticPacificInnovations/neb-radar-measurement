/**
 * The rules data on the NEB RADAR platform and in the NEB RADAR Measurement Library must be the same file.
 * Both repositories hold this fingerprint of the canonical JSON; when one side changes the rules data, its test
 * fails until the other side carries the same change and both fingerprints are updated together.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const RULES_FINGERPRINT = "47c9dd8da260a59c9f5cfe157f471e38ccb1b741dcc6cc2bd67c1e615d1b57cc";

const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
  : v;

describe("rules data in step with the other repository", () => {
  it("has the shared fingerprint", () => {
    const json = JSON.stringify(canonical(JSON.parse(readFileSync("data/indicator_rules_v1.json", "utf8"))));
    expect(createHash("sha256").update(json, "utf8").digest("hex")).toBe(RULES_FINGERPRINT);
  });
});
