export type ArchitectureComponentKind =
  | "application"
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "storage"
  | "api"
  | "gateway"
  | "client"
  | "external-system"
  | "other";

export type ArchitectureComponent = {
  id: string;
  kind: ArchitectureComponentKind;
  name: string;
  technology?: string;
  description?: string;
};

export type ArchitectureRelationKind =
  | "http"
  | "grpc"
  | "graphql"
  | "event"
  | "message"
  | "database"
  | "depends-on"
  | "reads-from"
  | "writes-to"
  | "other";

export type ArchitectureRelation = {
  id: string;
  source: string;
  target: string;
  kind: ArchitectureRelationKind;
  label?: string;
};

export type ArchitectureIR = {
  schemaVersion: 1;
  components: ArchitectureComponent[];
  relations: ArchitectureRelation[];
};