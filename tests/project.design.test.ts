import { describe, expect, test } from "vitest";
import {
  isProjectDesignDecisionStatus,
  isValidProjectDesignDecision,
} from "@/domain/project/validation";

const base = {
  id: "decision-1",
  projectId: "project-1",
  ownerId: "user-1",
  title: "Use a component library",
  decision: "Use the existing UI component library for shared primitives.",
  rationale: "It reduces duplicated UI work and keeps interaction patterns consistent.",
  status: "proposed" as const,
};

describe("Project design decisions domain", () => {
  test("accepts a valid design decision", () => {
    expect(isValidProjectDesignDecision(base)).toBe(true);
  });

  test("supports canonical decision statuses", () => {
    expect(isProjectDesignDecisionStatus("proposed")).toBe(true);
    expect(isProjectDesignDecisionStatus("accepted")).toBe(true);
    expect(isProjectDesignDecisionStatus("superseded")).toBe(true);
    expect(isProjectDesignDecisionStatus("rejected")).toBe(false);
  });

  test("bounds title and decision content", () => {
    expect(isValidProjectDesignDecision({ ...base, title: "x".repeat(200) })).toBe(true);
    expect(isValidProjectDesignDecision({ ...base, title: "x".repeat(201) })).toBe(false);
    expect(isValidProjectDesignDecision({ ...base, decision: "x".repeat(5000) })).toBe(true);
    expect(isValidProjectDesignDecision({ ...base, decision: "x".repeat(5001) })).toBe(false);
    expect(isValidProjectDesignDecision({ ...base, rationale: "x".repeat(5000) })).toBe(true);
    expect(isValidProjectDesignDecision({ ...base, rationale: "x".repeat(5001) })).toBe(false);
  });

  test("requires project ownership fields", () => {
    expect(isValidProjectDesignDecision({ ...base, ownerId: "" })).toBe(false);
    expect(isValidProjectDesignDecision({ ...base, projectId: "" })).toBe(false);
  });
});
