import type {
  ArchitectureComponentKind,
  ArchitectureIR,
  ArchitectureRelationKind,
} from "./types";

const COMPONENT_KINDS = new Set<ArchitectureComponentKind>([
  "application",
  "service",
  "database",
  "cache",
  "queue",
  "storage",
  "api",
  "gateway",
  "client",
  "external-system",
  "other",
]);

const RELATION_KINDS = new Set<ArchitectureRelationKind>([
  "http",
  "grpc",
  "graphql",
  "event",
  "message",
  "database",
  "depends-on",
  "reads-from",
  "writes-to",
  "other",
]);

export type ArchitectureValidationIssue = {
  path: string;
  message: string;
};

export type ArchitectureValidationResult = {
  valid: boolean;
  issues: ArchitectureValidationIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateArchitectureIR(
  architecture: unknown,
): ArchitectureValidationResult {
  const issues: ArchitectureValidationIssue[] = [];

  if (!isRecord(architecture)) {
    return {
      valid: false,
      issues: [
        {
          path: "",
          message: "Architecture must be an object.",
        },
      ],
    };
  }

  if (architecture.schemaVersion !== 1) {
    issues.push({
      path: "schemaVersion",
      message: "Unsupported architecture schema version.",
    });
  }

  if (!Array.isArray(architecture.components)) {
    issues.push({
      path: "components",
      message: "Components must be an array.",
    });
  }

  if (!Array.isArray(architecture.relations)) {
    issues.push({
      path: "relations",
      message: "Relations must be an array.",
    });
  }

  if (
    !Array.isArray(architecture.components) ||
    !Array.isArray(architecture.relations)
  ) {
    return {
      valid: issues.length === 0,
      issues,
    };
  }

  const componentIds = new Set<string>();

  architecture.components.forEach((rawComponent, index) => {
    const path = `components[${index}]`;

    if (!isRecord(rawComponent)) {
      issues.push({
        path,
        message: "Component must be an object.",
      });
      return;
    }

    const id = typeof rawComponent.id === "string"
      ? rawComponent.id
      : "";

    const name = typeof rawComponent.name === "string"
      ? rawComponent.name
      : "";

    const kind = rawComponent.kind;

    if (!id.trim()) {
      issues.push({
        path: `${path}.id`,
        message: "Component ID is required.",
      });
    } else if (componentIds.has(id)) {
      issues.push({
        path: `${path}.id`,
        message: `Duplicate component ID "${id}".`,
      });
    } else {
      componentIds.add(id);
    }

    if (!name.trim()) {
      issues.push({
        path: `${path}.name`,
        message: "Component name is required.",
      });
    }

    if (
      typeof kind !== "string" ||
      !COMPONENT_KINDS.has(kind as ArchitectureComponentKind)
    ) {
      issues.push({
        path: `${path}.kind`,
        message: `Unsupported component kind "${String(kind)}".`,
      });
    }
  });

  const relationIds = new Set<string>();

  architecture.relations.forEach((rawRelation, index) => {
    const path = `relations[${index}]`;

    if (!isRecord(rawRelation)) {
      issues.push({
        path,
        message: "Relation must be an object.",
      });
      return;
    }

    const id = typeof rawRelation.id === "string"
      ? rawRelation.id
      : "";

    const source = typeof rawRelation.source === "string"
      ? rawRelation.source
      : "";

    const target = typeof rawRelation.target === "string"
      ? rawRelation.target
      : "";

    const kind = rawRelation.kind;

    if (!id.trim()) {
      issues.push({
        path: `${path}.id`,
        message: "Relation ID is required.",
      });
    } else if (relationIds.has(id)) {
      issues.push({
        path: `${path}.id`,
        message: `Duplicate relation ID "${id}".`,
      });
    } else {
      relationIds.add(id);
    }

    if (!source.trim() || !componentIds.has(source)) {
      issues.push({
        path: `${path}.source`,
        message: `Source component "${source}" does not exist.`,
      });
    }

    if (!target.trim() || !componentIds.has(target)) {
      issues.push({
        path: `${path}.target`,
        message: `Target component "${target}" does not exist.`,
      });
    }

    if (
      typeof kind !== "string" ||
      !RELATION_KINDS.has(kind as ArchitectureRelationKind)
    ) {
      issues.push({
        path: `${path}.kind`,
        message: `Unsupported relation kind "${String(kind)}".`,
      });
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function isValidArchitectureIR(
  architecture: unknown,
): architecture is ArchitectureIR {
  return validateArchitectureIR(architecture).valid;
}

/**
 * Enforces the Architecture IR contract at write boundaries.
 * Callers receive a useful error before invalid data can be persisted.
 */
export function assertValidArchitectureIR(
  architecture: unknown,
): asserts architecture is ArchitectureIR {
  const result = validateArchitectureIR(architecture);

  if (!result.valid) {
    const details = result.issues
      .map((issue) => `${issue.path || "architecture"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid Architecture IR. ${details}`);
  }
}

