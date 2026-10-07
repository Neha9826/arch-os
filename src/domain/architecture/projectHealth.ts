import { lintArchitecture, type ArchitectureHealthStatus } from "./lint";
import type { ArchitectureIR } from "./types";

export type ProjectArchitectureHealthInput = {
  id: string;
  name: string;
  architectureIR: ArchitectureIR;
};

export type ArchitectureHealthSummary = {
  id: string;
  name: string;
  score: number;
  status: ArchitectureHealthStatus;
  errors: number;
  warnings: number;
  components: number;
  relations: number;
  isolatedComponents: number;
};

export type ProjectArchitectureHealth = {
  architectureCount: number;
  averageScore: number;
  healthyCount: number;
  goodCount: number;
  needsAttentionCount: number;
  criticalCount: number;
  totalComponents: number;
  totalRelations: number;
  totalErrors: number;
  totalWarnings: number;
  architectures: ArchitectureHealthSummary[];
};

export function buildProjectArchitectureHealth(
  architectures: ProjectArchitectureHealthInput[],
): ProjectArchitectureHealth {
  const summaries = architectures.map(({ id, name, architectureIR }) => {
    const result = lintArchitecture(architectureIR);

    return {
      id,
      name,
      score: result.health.score,
      status: result.health.status,
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      components: result.health.metrics.components,
      relations: result.health.metrics.relations,
      isolatedComponents: result.health.metrics.isolatedComponents,
    };
  });

  const scoreTotal = summaries.reduce((total, item) => total + item.score, 0);

  return {
    architectureCount: summaries.length,
    averageScore:
      summaries.length > 0 ? Math.round(scoreTotal / summaries.length) : 0,
    healthyCount: summaries.filter((item) => item.status === "healthy").length,
    goodCount: summaries.filter((item) => item.status === "good").length,
    needsAttentionCount: summaries.filter(
      (item) => item.status === "needs-attention",
    ).length,
    criticalCount: summaries.filter((item) => item.status === "critical").length,
    totalComponents: summaries.reduce(
      (total, item) => total + item.components,
      0,
    ),
    totalRelations: summaries.reduce(
      (total, item) => total + item.relations,
      0,
    ),
    totalErrors: summaries.reduce((total, item) => total + item.errors, 0),
    totalWarnings: summaries.reduce(
      (total, item) => total + item.warnings,
      0,
    ),
    architectures: summaries,
  };
}
