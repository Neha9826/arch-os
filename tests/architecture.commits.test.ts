import { describe, expect, test } from "vitest";
import {
  canCreateCommitFromParent,
  diffArchitectureCommits,
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

  test("compares two commits by semantic architecture and canvas state", () => {
    const base = {
      id: "c1",
      architectureId: "a1",
      workspaceId: "w1",
      ownerId: "u1",
      createdBy: "u1",
      message: "base",
      architectureIR: { schemaVersion: 1, components: [], relations: [] },
      canvasLayout: { nodes: [], edges: [] },
    };
    const next = {
      ...base,
      id: "c2",
      message: "next",
      architectureIR: {
        schemaVersion: 1,
        components: [{ id: "api", kind: "service" as const, name: "API" }],
        relations: [],
      },
      canvasLayout: { nodes: [{ id: "api", type: "tech", position: { x: 10, y: 20 }, data: { label: "API" } }], edges: [] },
    };

    const result = diffArchitectureCommits(base, next);
    expect(result.semantic.summary.componentsAdded).toBe(1);
    expect(result.canvasChanged).toBe(true);
  });

  test("requires the Main history head to advance to the new commit", () => {
    expect(isCommitHeadAdvanced(undefined, "c1")).toBe(true);
    expect(isCommitHeadAdvanced("c1", "c2")).toBe(true);
    expect(isCommitHeadAdvanced("c1", "c1")).toBe(false);
  });
});
