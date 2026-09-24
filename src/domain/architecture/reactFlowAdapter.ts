import type { Edge, Node } from "reactflow";
import type {
  ArchitectureComponent,
  ArchitectureComponentKind,
  ArchitectureIR,
  ArchitectureRelation,
  ArchitectureRelationKind,
} from "./types";

type ReactFlowNodeData = {
  label: string;
  kind?: ArchitectureComponentKind;
  technology?: string;
  description?: string;
};

type ReactFlowEdgeData = {
  label?: string;
};

export type ArchitectureNode = Node<ReactFlowNodeData>;
export type ArchitectureEdge = Edge<ReactFlowEdgeData>;

export type ReactFlowArchitectureState = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};

function normalizeName(label: string | undefined, fallback: string): string {
  const value = label?.trim();

  return value || fallback;
}

export function reactFlowToArchitectureIR(
  state: ReactFlowArchitectureState,
): ArchitectureIR {
  const components: ArchitectureComponent[] = state.nodes.map((node) => ({
    id: node.id,
    kind: node.data?.kind ?? "other",
    name: normalizeName(node.data?.label, node.id),
    ...(node.data?.technology
      ? { technology: node.data.technology }
      : {}),
    ...(node.data?.description
      ? { description: node.data.description }
      : {}),
  }));

  const relations: ArchitectureRelation[] = state.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    kind: relationKindFromEdge(edge),
    ...(typeof edge.label === "string" && edge.label.trim()
      ? { label: edge.label.trim() }
      : {}),
  }));

  return {
    schemaVersion: 1,
    components,
    relations,
  };
}

export function architectureIRToReactFlow(
  architecture: ArchitectureIR,
  previousState?: ReactFlowArchitectureState,
): ReactFlowArchitectureState {
  const previousNodes = new Map(
    (previousState?.nodes ?? []).map((node) => [node.id, node]),
  );

  const nodes: ArchitectureNode[] = architecture.components.map(
    (component) => {
      const previousNode = previousNodes.get(component.id);

      return {
        id: component.id,
        type: previousNode?.type ?? "tech",
        position: previousNode?.position ?? { x: 0, y: 0 },
        data: {
          label: component.name,
          kind: component.kind,
          ...(component.technology
            ? { technology: component.technology }
            : {}),
          ...(component.description
            ? { description: component.description }
            : {}),
        },
      };
    },
  );

  const edges: ArchitectureEdge[] = architecture.relations.map(
    (relation) => {
      const previousEdge = previousState?.edges.find(
        (edge) => edge.id === relation.id,
      );

      return {
        id: relation.id,
        source: relation.source,
        target: relation.target,
        ...(relation.label ? { label: relation.label } : {}),
        ...(previousEdge?.animated !== undefined
          ? { animated: previousEdge.animated }
          : {}),
        ...(previousEdge?.style
          ? { style: previousEdge.style }
          : {}),
      };
    },
  );

  return {
    nodes,
    edges,
  };
}

function relationKindFromEdge(
  edge: ArchitectureEdge,
): ArchitectureRelationKind {
  const label =
    typeof edge.label === "string"
      ? edge.label.trim().toLowerCase()
      : "";

  switch (label) {
    case "http":
    case "rest":
      return "http";

    case "grpc":
      return "grpc";

    case "graphql":
      return "graphql";

    case "event":
      return "event";

    case "message":
      return "message";

    case "database":
      return "database";

    case "depends-on":
      return "depends-on";

    case "reads-from":
      return "reads-from";

    case "writes-to":
      return "writes-to";

    default:
      return "other";
  }
}