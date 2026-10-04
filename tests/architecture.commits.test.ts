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

  test("allows a root commit when Main has no history head", () => {
    expect(canCreateCommitFromParent(undefined, undefined)).toBe(true);
  });

  test("requires the new commit parent to equal the current Main head", () => {
    expect(canCreateCommitFromParent("c1", "c1")).toBe(true);
    expect(canCreateCommitFromParent("c1", undefined)).toBe(false);
    expect(canCreateCommitFromParent("c1", "c2")).toBe(false);
  });
});
