import { describe, expect, test } from "vitest";
import {
  assertValidArchitectureIR,
  validateArchitectureIR,
} from "@/domain/architecture/validation";
import type { ArchitectureIR } from "@/domain/architecture/types";

const validArchitecture: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    {
      id: "client",
      kind: "client",
      name: "Web Client",
      technology: "Next.js",
    },
    {
      id: "api",
      kind: "service",
      name: "API Service",
      technology: "Node.js",
    },
    {
      id: "database",
      kind: "database",
      name: "PostgreSQL",
      technology: "PostgreSQL",
    },
  ],
  relations: [
    {
      id: "client-api",
      source: "client",
      target: "api",
      kind: "http",
      label: "REST",
    },
    {
      id: "api-database",
      source: "api",
      target: "database",
      kind: "database",
    },
  ],
};

describe("Architecture IR validation", () => {
  test("accepts a valid architecture", () => {
    const result = validateArchitectureIR(validArchitecture);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test("rejects an unsupported schema version", () => {
    const architecture = {
      ...validArchitecture,
      schemaVersion: 2,
    } as unknown as ArchitectureIR;

    const result = validateArchitectureIR(architecture);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: "schemaVersion",
      message: "Unsupported architecture schema version.",
    });
  });

  test("rejects duplicate component IDs", () => {
    const architecture: ArchitectureIR = {
      ...validArchitecture,
      components: [
        ...validArchitecture.components,
        {
          id: "api",
          kind: "service",
          name: "Another API",
        },
      ],
    };

    const result = validateArchitectureIR(architecture);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: "components[3].id",
      message: 'Duplicate component ID "api".',
    });
  });

  test("rejects components without names", () => {
    const architecture: ArchitectureIR = {
      ...validArchitecture,
      components: [
        {
          id: "unnamed",
          kind: "service",
          name: "   ",
        },
      ],
      relations: [],
    };

    const result = validateArchitectureIR(architecture);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: "components[0].name",
      message: "Component name is required.",
    });
  });

  test("rejects relations pointing to missing components", () => {
    const architecture: ArchitectureIR = {
      ...validArchitecture,
      relations: [
        {
          id: "broken",
          source: "client",
          target: "missing-service",
          kind: "http",
        },
      ],
    };

    const result = validateArchitectureIR(architecture);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: "relations[0].target",
      message: 'Target component "missing-service" does not exist.',
    });
  });

  test("rejects duplicate relation IDs", () => {
    const architecture: ArchitectureIR = {
      ...validArchitecture,
      relations: [
        ...validArchitecture.relations,
        {
          id: "client-api",
          source: "api",
          target: "database",
          kind: "database",
        },
      ],
    };

    const result = validateArchitectureIR(architecture);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: "relations[2].id",
      message: 'Duplicate relation ID "client-api".',
    });
  });

  test("asserts when an architecture is invalid", () => {
    const invalidArchitecture = {
      schemaVersion: 1,
      components: [
        {
          id: "service",
          kind: "not-a-kind",
          name: "Service",
        },
      ],
      relations: [],
    };

    expect(() => assertValidArchitectureIR(invalidArchitecture)).toThrow(
      'Invalid Architecture IR. components[0].kind: Unsupported component kind "not-a-kind".',
    );
  });

  test("does not throw for a valid architecture", () => {
    expect(() => assertValidArchitectureIR(validArchitecture)).not.toThrow();
  });

  test("rejects empty component IDs", () => {
    const architecture: ArchitectureIR = {
      ...validArchitecture,
      components: [
        {
          id: "   ",
          kind: "service",
          name: "Invalid Service",
        },
      ],
      relations: [],
    };

    const result = validateArchitectureIR(architecture);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: "components[0].id",
      message: "Component ID is required.",
    });
  });
});