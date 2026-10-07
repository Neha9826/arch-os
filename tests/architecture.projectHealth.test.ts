import { describe, expect, test } from "vitest";
import { buildProjectArchitectureHealth } from "@/domain/architecture/projectHealth";
import type { ArchitectureIR } from "@/domain/architecture/types";

const empty: ArchitectureIR = {
  schemaVersion: 1,
  components: [],
  relations: [],
};

const healthy: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    { id: "client", kind: "client", name: "Client" },
    { id: "api", kind: "service", name: "API" },
  ],
  relations: [
    { id: "client-api", source: "client", target: "api", kind: "http" },
  ],
};

describe("project architecture health", () => {
  test("aggregates architecture health without mutating the source models", () => {
    const result = buildProjectArchitectureHealth([
      { id: "a", name: "Empty", architectureIR: empty },
      { id: "b", name: "Healthy", architectureIR: healthy },
    ]);

    expect(result.architectureCount).toBe(2);
    expect(result.averageScore).toBe(50);
    expect(result.criticalCount).toBe(1);
    expect(result.healthyCount).toBe(1);
    expect(result.totalComponents).toBe(2);
    expect(result.totalRelations).toBe(1);
    expect(result.totalErrors).toBe(1);
    expect(result.totalWarnings).toBe(0);
    expect(result.architectures[0]).toMatchObject({
      id: "a",
      score: 0,
      status: "critical",
      errors: 1,
    });
  });

  test("returns an empty baseline when a project has no architectures", () => {
    expect(buildProjectArchitectureHealth([])).toEqual({
      architectureCount: 0,
      averageScore: 0,
      healthyCount: 0,
      goodCount: 0,
      needsAttentionCount: 0,
      criticalCount: 0,
      totalComponents: 0,
      totalRelations: 0,
      totalErrors: 0,
      totalWarnings: 0,
      architectures: [],
    });
  });
});
