/**
 * The rules data on the NEB RADAR platform and in the NEB RADAR Measurement Library must be the same file.
 * Both repositories hold this fingerprint of the canonical JSON; when one side changes the rules data, its test
 * fails until the other side carries the same change and both fingerprints are updated together.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const RULES_FINGERPRINT = "53159d19af54e13ec45506d8c6ffec9e138812ab8575de6996d73c5ae7c3c7b6";

const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
  : v;

describe("rules data in step with the other repository", () => {
  it("has the shared fingerprint", () => {
    const json = JSON.stringify(canonical(JSON.parse(readFileSync("data/indicator_rules_v2.json", "utf8"))));
    expect(createHash("sha256").update(json, "utf8").digest("hex")).toBe(RULES_FINGERPRINT);
  });
});
