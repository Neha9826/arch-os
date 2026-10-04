import { describe, expect, test } from "vitest";
import {
  canCreateCommitFromParent,
  isValidCommitMessage,
} from "@/domain/architecture/commits";

describe("Architecture commit foundation", () => {
  test("requires a non-empty commit message", () => {
    expect(isValidCommitMessage("")).toBe(false);
    expect(isValidCommitMessage("   ")).toBe(false);
    expect(isValidCommitMessage("capture baseline")).toBe(true);
  });

  test("enforces the commit message length boundary", () => {
    expect(isValidCommitMessage("x".repeat(200))).toBe(true);
    expect(isValidCommitMessage("x".repeat(201))).toBe(false);
  });

  test("allows a root commit without a parent", () => {
    expect(canCreateCommitFromParent(undefined, new Set())).toBe(true);
  });

  test("requires an existing parent when one is supplied", () => {
    expect(canCreateCommitFromParent("c1", new Set(["c1"]))).toBe(true);
    expect(canCreateCommitFromParent("missing", new Set(["c1"]))).toBe(false);
  });
});
