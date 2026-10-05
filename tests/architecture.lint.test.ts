import { describe, expect, test } from "vitest";
import { lintArchitecture } from "@/domain/architecture/lint";
import type { ArchitectureIR } from "@/domain/architecture/types";

const connectedArchitecture: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    { id: "client", kind: "client", name: "Web Client" },
    { id: "api", kind: "service", name: "API Service" },
  ],
  relations: [
    { id: "client-api", source: "client", target: "api", kind: "http" },
  ],
};

describe("Architecture lint", () => {
  test("reports an empty architecture as an error", () => {
    const result = lintArchitecture({
      schemaVersion: 1,
      components: [],
      relations: [],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "architecture.empty",
        severity: "error",
      }),
    );
    expect(result.summary).toEqual({ errors: 1, warnings: 0, info: 0 });
  });

  test("reports disconnected components without treating them as fatal", () => {
    const result = lintArchitecture({
      ...connectedArchitecture,
      components: [
        ...connectedArchitecture.components,
        { id: "cache", kind: "cache", name: "Redis Cache" },
      ],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "component.isolated",
        severity: "warning",
        componentId: "cache",
      }),
    );
    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBe(1);
  });

  test("reports a relation that connects a component to itself", () => {
    const result = lintArchitecture({
      ...connectedArchitecture,
      relations: [
        {
          id: "api-loop",
          source: "api",
          target: "api",
          kind: "depends-on",
        },
      ],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "relation.self_loop",
        severity: "warning",
        relationId: "api-loop",
        componentId: "api",
      }),
    );
  });

  test("reports duplicate relations with the same endpoints and kind", () => {
    const result = lintArchitecture({
      ...connectedArchitecture,
      relations: [
        ...connectedArchitecture.relations,
        {
          id: "client-api-duplicate",
          source: "client",
          target: "api",
          kind: "http",
        },
      ],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "relation.duplicate",
        severity: "warning",
        relationId: "client-api-duplicate",
      }),
    );
  });

  test("returns no findings for a connected architecture without duplicate relations", () => {
    const result = lintArchitecture(connectedArchitecture);

    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ errors: 0, warnings: 0, info: 0 });
  });

  test("does not treat a self-loop as a connection to another component", () => {
    const result = lintArchitecture({
      schemaVersion: 1,
      components: [{ id: "worker", kind: "service", name: "Worker" }],
      relations: [
        { id: "worker-loop", source: "worker", target: "worker", kind: "depends-on" },
      ],
    });

    expect(result.findings.map((finding) => finding.code)).toContain("component.isolated");
    expect(result.findings.map((finding) => finding.code)).toContain("relation.self_loop");
  });

  test("does not mutate the supplied architecture", () => {
    const architecture = structuredClone(connectedArchitecture);

    lintArchitecture(architecture);

    expect(architecture).toEqual(connectedArchitecture);
  });
});
