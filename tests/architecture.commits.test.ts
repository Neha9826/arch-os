import { describe, expect, test } from "vitest";
import {
  canCreateCommitFromParent,
  isCommitHeadAdvanced,
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

  test("allows a root commit when Main has no history head", () => {
    expect(canCreateCommitFromParent(undefined, undefined)).toBe(true);
  });

  test("requires the supplied parent to equal the current history head", () => {
    expect(canCreateCommitFromParent("c1", "c1")).toBe(true);
    expect(canCreateCommitFromParent("c1", "c2")).toBe(false);
    expect(canCreateCommitFromParent("c1", undefined)).toBe(false);
  });

  test("requires the Main history head to advance to the new commit", () => {
    expect(isCommitHeadAdvanced(undefined, "c1")).toBe(true);
    expect(isCommitHeadAdvanced("c1", "c2")).toBe(true);
    expect(isCommitHeadAdvanced("c1", "c1")).toBe(false);
  });
});
