import { describe, expect, test } from "vitest";
import {
  isProjectMilestoneStatus,
  isValidProjectMilestone,
} from "@/domain/project/validation";

describe("Project roadmap domain", () => {
  const milestone = {
    id: "milestone-1",
    projectId: "project-1",
    ownerId: "owner-1",
    title: "Architecture review complete",
    description: "The architecture has passed review.",
    status: "planned" as const,
    targetDate: "2026-12-01",
  };

  test("accepts a valid milestone", () => {
    expect(isValidProjectMilestone(milestone)).toBe(true);
  });

  test("supports the canonical milestone statuses", () => {
    expect(["planned", "in-progress", "done"].every(isProjectMilestoneStatus)).toBe(true);
  });

  test("bounds milestone title and description", () => {
    expect(isValidProjectMilestone({ ...milestone, title: "x".repeat(201) })).toBe(false);
    expect(isValidProjectMilestone({ ...milestone, description: "x".repeat(2001) })).toBe(false);
  });

  test("requires tenant ownership fields", () => {
    expect(isValidProjectMilestone({ ...milestone, ownerId: "" })).toBe(false);
    expect(isValidProjectMilestone({ ...milestone, projectId: "" })).toBe(false);
  });

  test("validates the optional target date format", () => {
    expect(isValidProjectMilestone({ ...milestone, targetDate: "2026-12-01" })).toBe(true);
    expect(isValidProjectMilestone({ ...milestone, targetDate: "12/01/2026" })).toBe(false);
  });
});
