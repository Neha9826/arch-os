import type { ArchitectureIR } from "./types";

export type ArchitectureLintSeverity = "error" | "warning" | "info";
export type ArchitectureHealthStatus = "healthy" | "good" | "needs-attention" | "critical";

export type ArchitectureLintFinding = {
  code: string;
  severity: ArchitectureLintSeverity;
  title: string;
  message: string;
  recommendation: string;
  componentId?: string;
  relationId?: string;
};

export type ArchitectureHealthMetrics = {
  components: number;
  relations: number;
  connectedComponents: number;
  isolatedComponents: number;
  maxIncomingRelations: number;
  maxOutgoingRelations: number;
};

export type ArchitectureLintResult = {
  findings: ArchitectureLintFinding[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  health: {
    score: number;
    status: ArchitectureHealthStatus;
    metrics: ArchitectureHealthMetrics;
  };
};

function getHealthStatus(score: number): ArchitectureHealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 70) return "good";
  if (score >= 40) return "needs-attention";
  return "critical";
}

function calculateHealthScore(
  findings: ArchitectureLintFinding[],
  componentCount: number,
): number {
  if (componentCount === 0) return 0;

  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === "error") return total + 35;
    if (finding.severity === "warning") return total + 10;
    return total + 2;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * Runs deterministic, local checks against the canonical Architecture IR.
 * Findings are advisory: they never mutate the architecture.
 *
 * The returned health score is intentionally explainable: every deduction
 * comes from a finding produced by the same deterministic lint pass.
 */
export function lintArchitecture(
  architecture: ArchitectureIR,
): ArchitectureLintResult {
  const findings: ArchitectureLintFinding[] = [];
  const components = architecture.components;
  const relations = architecture.relations;

  if (components.length === 0) {
    findings.push({
      code: "architecture.empty",
      severity: "error",
      title: "Architecture is empty",
      message: "This architecture does not contain any components.",
      recommendation: "Add the systems or services that make up this architecture.",
    });
  }

  const componentById = new Map(components.map((component) => [component.id, component]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const component of components) {
    incoming.set(component.id, 0);
    outgoing.set(component.id, 0);
  }

  const seenRelations = new Set<string>();

  for (const relation of relations) {
    if (relation.source === relation.target) {
      const component = componentById.get(relation.source);
      findings.push({
        code: "relation.self_loop",
        severity: "warning",
        title: "Component connects to itself",
        message: `"${component?.name ?? relation.source}" has a relation to itself.`,
        recommendation: "Confirm that this self-reference represents an intentional recursive or looped interaction.",
        componentId: relation.source,
        relationId: relation.id,
      });
    } else {
      outgoing.set(relation.source, (outgoing.get(relation.source) ?? 0) + 1);
      incoming.set(relation.target, (incoming.get(relation.target) ?? 0) + 1);
    }

    const relationKey = JSON.stringify([
      relation.source,
      relation.target,
      relation.kind,
    ]);

    if (seenRelations.has(relationKey)) {
      findings.push({
        code: "relation.duplicate",
        severity: "warning",
        title: "Duplicate relation",
        message: `More than one ${relation.kind} relation connects "${componentById.get(relation.source)?.name ?? relation.source}" to "${componentById.get(relation.target)?.name ?? relation.target}".`,
        recommendation: "Check whether the repeated relation is intentional; remove redundant connections if not.",
        relationId: relation.id,
      });
    } else {
      seenRelations.add(relationKey);
    }
  }

  let isolatedComponents = 0;
  let maxIncomingRelations = 0;
  let maxOutgoingRelations = 0;

  for (const component of components) {
    const incomingCount = incoming.get(component.id) ?? 0;
    const outgoingCount = outgoing.get(component.id) ?? 0;

    maxIncomingRelations = Math.max(maxIncomingRelations, incomingCount);
    maxOutgoingRelations = Math.max(maxOutgoingRelations, outgoingCount);

    if (incomingCount === 0 && outgoingCount === 0) {
      isolatedComponents += 1;
      findings.push({
        code: "component.isolated",
        severity: "warning",
        title: "Disconnected component",
        message: `"${component.name}" has no connections to other components.`,
        recommendation: "Connect this component to the systems it interacts with, or keep it disconnected if it is intentionally out of scope.",
        componentId: component.id,
      });
    }
  }

  const healthScore = calculateHealthScore(findings, components.length);

  return {
    findings,
    summary: {
      errors: findings.filter((finding) => finding.severity === "error").length,
      warnings: findings.filter((finding) => finding.severity === "warning").length,
      info: findings.filter((finding) => finding.severity === "info").length,
    },
    health: {
      score: healthScore,
      status: getHealthStatus(healthScore),
      metrics: {
        components: components.length,
        relations: relations.length,
        connectedComponents: components.length - isolatedComponents,
        isolatedComponents,
        maxIncomingRelations,
        maxOutgoingRelations,
      },
    },
  };
}
