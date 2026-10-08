import { describe, expect, test } from "vitest";
import {
  createDefaultProjectSections,
  isValidProjectPlanning,
  isValidProjectSections,
} from "@/domain/project/validation";

describe("Project planning domain", () => {
  test("creates the canonical eleven-section baseline", () => {
    const sections = createDefaultProjectSections();

    expect(Object.keys(sections)).toHaveLength(11);
    expect(Object.values(sections).every((status) => status === "not-started")).toBe(true);
    expect(isValidProjectSections(sections)).toBe(true);
  });

  test("accepts a complete planning brief within field limits", () => {
    expect(
      isValidProjectPlanning({
        objective: "Build a durable architecture engineering workspace.",
        scope: "Planning through execution.",
        constraints: "Owner-scoped Firestore data.",
        successCriteria: "Architecture decisions remain traceable to delivery.",
      }),
    ).toBe(true);
  });

  test("rejects planning fields above 5000 characters", () => {
    expect(
      isValidProjectPlanning({
        objective: "x".repeat(5001),
        scope: "",
        constraints: "",
        successCriteria: "",
      }),
    ).toBe(false);
  });

  test("allows an omitted planning record for legacy projects", () => {
    expect(isValidProjectPlanning(undefined)).toBe(true);
  });
});
