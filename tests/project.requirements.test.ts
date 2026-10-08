import { describe, expect, test } from "vitest";
import {
  isProjectRequirementPriority,
  isProjectRequirementStatus,
  isValidProjectRequirement,
} from "@/domain/project/validation";

const base = {
  id: "requirement-1",
  projectId: "project-1",
  ownerId: "user-1",
  title: "Users can invite workspace members",
  priority: "medium" as const,
  status: "todo" as const,
};

describe("Project requirements domain", () => {
  test("accepts a valid requirement", () => {
    expect(isValidProjectRequirement(base)).toBe(true);
  });

  test("supports the canonical priority and status values", () => {
    expect(isProjectRequirementPriority("critical")).toBe(true);
    expect(isProjectRequirementPriority("urgent")).toBe(false);
    expect(isProjectRequirementStatus("in-progress")).toBe(true);
    expect(isProjectRequirementStatus("blocked")).toBe(false);
  });

  test("bounds requirement title and description", () => {
    expect(isValidProjectRequirement({ ...base, title: "x".repeat(200) })).toBe(true);
    expect(isValidProjectRequirement({ ...base, title: "x".repeat(201) })).toBe(false);
    expect(
      isValidProjectRequirement({
        ...base,
        description: "x".repeat(2000),
      }),
    ).toBe(true);
    expect(
      isValidProjectRequirement({
        ...base,
        description: "x".repeat(2001),
      }),
    ).toBe(false);
  });

  test("requires tenant ownership fields", () => {
    expect(isValidProjectRequirement({ ...base, ownerId: "" })).toBe(false);
    expect(isValidProjectRequirement({ ...base, projectId: "" })).toBe(false);
  });
});
