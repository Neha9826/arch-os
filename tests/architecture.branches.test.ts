import { describe, expect, test } from "vitest";
import { evaluateFastForwardMerge } from "@/domain/architecture/branches";
import type { ArchitectureIR } from "@/domain/architecture/types";

const base: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    { id: "api", kind: "service", name: "API" },
  ],
  relations: [],
};

const changed: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    { id: "api", kind: "service", name: "API v2" },
  ],
  relations: [],
};

describe("Architecture branch merge evaluation", () => {
  test("allows an active branch when Main is unchanged from the base", () => {
    expect(evaluateFastForwardMerge(base, base, changed)).toEqual({
      status: "merged",
    });
  });

  test("blocks the merge when Main changed after the branch base", () => {
    expect(evaluateFastForwardMerge(base, changed, changed)).toEqual({
      status: "conflict",
      reason: "main-changed-since-base",
    });
  });

  test("rejects non-active branches", () => {
    expect(evaluateFastForwardMerge(base, base, changed, "merged")).toEqual({
      status: "invalid",
      reason: "branch-not-active",
    });
  });
});
