import type { ArchitectureIR } from "./types";

export type ArchitectureBranchStatus = "active" | "merged" | "abandoned";

export type ArchitectureBranch = {
  id: string;
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  name: string;
  description?: string;
  baseSnapshotId: string;
  status: ArchitectureBranchStatus;
  architectureIR: ArchitectureIR;
  canvasLayout: {
    nodes: Array<{
      id: string;
      type?: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
      [key: string]: unknown;
    }>;
    edges: Array<Record<string, unknown>>;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
};
