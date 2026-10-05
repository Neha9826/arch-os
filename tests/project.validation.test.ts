import { describe, expect, test } from "vitest";
import {
  assertValidProject,
  isProjectSectionKey,
  isProjectStatus,
  isValidProject,
  isValidProjectDescription,
  isValidProjectName,
  isValidProjectMilestone,
  isValidProjectApiContract,
} from "@/domain/project/validation";
import type { Project } from "@/domain/project/types";

const validProject: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  ownerId: "user-1",
  createdBy: "user-1",
  name: "Commerce Platform",
  description: "Engineering workspace for the commerce platform.",
  status: "active",
};

describe("Project domain validation", () => {
  test("accepts a valid project", () => {
    expect(isValidProject(validProject)).toBe(true);
    expect(() => assertValidProject(validProject)).not.toThrow();
  });

  test("requires a bounded project name", () => {
    expect(isValidProjectName("")).toBe(false);
    expect(isValidProjectName("   ")).toBe(false);
    expect(isValidProjectName("a".repeat(120))).toBe(true);
    expect(isValidProjectName("a".repeat(121))).toBe(false);
  });

  test("bounds project descriptions", () => {
    expect(isValidProjectDescription(undefined)).toBe(true);
    expect(isValidProjectDescription("a".repeat(1000))).toBe(true);
    expect(isValidProjectDescription("a".repeat(1001))).toBe(false);
  });

  test("accepts only supported project statuses", () => {
    expect(isProjectStatus("active")).toBe(true);
    expect(isProjectStatus("archived")).toBe(true);
    expect(isProjectStatus("deleted")).toBe(false);
  });

  test("recognizes the canonical engineering sections", () => {
    expect(isProjectSectionKey("architecture")).toBe(true);
    expect(isProjectSectionKey("database")).toBe(true);
    expect(isProjectSectionKey("unknown")).toBe(false);
  });

  test("validates roadmap target dates as YYYY-MM-DD", () => {
    const base = {
      id: "milestone-1",
      projectId: "project-1",
      ownerId: "user-1",
      title: "Launch",
      status: "planned" as const,
    };

    expect(isValidProjectMilestone({ ...base, targetDate: "2026-10-05" })).toBe(true);
    expect(isValidProjectMilestone({ ...base, targetDate: "2026/10/05" })).toBe(false);
  });

  test("requires API contract paths to start with /", () => {
    const base = {
      id: "api-1",
      projectId: "project-1",
      ownerId: "user-1",
      method: "GET" as const,
      title: "Get users",
      status: "draft" as const,
    };

    expect(isValidProjectApiContract({ ...base, path: "/users" })).toBe(true);
    expect(isValidProjectApiContract({ ...base, path: "users" })).toBe(false);
  });

  test("rejects projects without tenant ownership", () => {
    expect(
      isValidProject({
        ...validProject,
        workspaceId: "",
      }),
    ).toBe(false);
    expect(
      isValidProject({
        ...validProject,
        ownerId: "",
      }),
    ).toBe(false);
  });
});
