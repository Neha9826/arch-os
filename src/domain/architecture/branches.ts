import type { ReactFlowArchitectureState } from "./reactFlowAdapter";

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
  canvasLayout: ReactFlowArchitectureState;
  createdAt?: unknown;
  updatedAt?: unknown;
};
