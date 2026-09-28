import type {
  ArchitectureComponent,
  ArchitectureIR,
  ArchitectureRelation,
} from "./types";

export type ArchitectureDiffStatus = "added" | "removed" | "modified";

export type ComponentDiff = {
  status: ArchitectureDiffStatus;
  id: string;
  before?: ArchitectureComponent;
  after?: ArchitectureComponent;
  changedFields: string[];
};

export type RelationDiff = {
  status: ArchitectureDiffStatus;
  id: string;
  before?: ArchitectureRelation;
  after?: ArchitectureRelation;
  changedFields: string[];
};

export type ArchitectureDiff = {
  components: ComponentDiff[];
  relations: RelationDiff[];
  summary: {
    componentsAdded: number;
    componentsRemoved: number;
    componentsModified: number;
    relationsAdded: number;
    relationsRemoved: number;
    relationsModified: number;
  };
};

function compareById<T extends { id: string }>(
  beforeItems: T[],
  afterItems: T[],
  fields: (keyof T)[],
): Array<{
  status: ArchitectureDiffStatus;
  id: string;
  before?: T;
  after?: T;
  changedFields: string[];
}> {
  const beforeById = new Map(beforeItems.map((item) => [item.id, item]));
  const afterById = new Map(afterItems.map((item) => [item.id, item]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();

  return ids.flatMap((id) => {
    const before = beforeById.get(id);
    const after = afterById.get(id);

    if (!before && after) {
      return [{ status: "added" as const, id, after, changedFields: [] }];
    }
    if (before && !after) {
      return [{ status: "removed" as const, id, before, changedFields: [] }];
    }
    if (!before || !after) return [];

    const changedFields = fields
      .filter((field) => before[field] !== after[field])
      .map(String);

    return changedFields.length
      ? [{ status: "modified" as const, id, before, after, changedFields }]
      : [];
  });
}

/**
 * Compares semantic Architecture IR only. Canvas positions and styling are
 * intentionally excluded so layout-only changes do not appear as architecture changes.
 */
export function diffArchitectures(
  before: ArchitectureIR,
  after: ArchitectureIR,
): ArchitectureDiff {
  const components = compareById(
    before.components,
    after.components,
    ["kind", "name", "technology", "description"],
  ) as ComponentDiff[];

  const relations = compareById(
    before.relations,
    after.relations,
    ["source", "target", "kind", "label"],
  ) as RelationDiff[];

  return {
    components,
    relations,
    summary: {
      componentsAdded: components.filter((item) => item.status === "added").length,
      componentsRemoved: components.filter((item) => item.status === "removed").length,
      componentsModified: components.filter((item) => item.status === "modified").length,
      relationsAdded: relations.filter((item) => item.status === "added").length,
      relationsRemoved: relations.filter((item) => item.status === "removed").length,
      relationsModified: relations.filter((item) => item.status === "modified").length,
    },
  };
}


/** Returns a readable connection description using component names, not internal IDs. */
export function formatRelationDescription(
  relation: ArchitectureRelation,
  architecture: ArchitectureIR,
): string {
  const componentName = (id: string) =>
    architecture.components.find((component) => component.id === id)?.name ?? id;
  const label = relation.label?.trim();
  const detail = label || relation.kind;
  return `${componentName(relation.source)} → ${componentName(relation.target)} (${detail})`;
}
