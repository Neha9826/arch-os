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

export type ArchitectureBranchMergeResult =
  | { status: "merged" }
  | { status: "conflict"; reason: "main-changed-since-base" }
  | { status: "invalid"; reason: "branch-not-active" };

export function evaluateFastForwardMerge(
  base: ArchitectureIR,
  main: ArchitectureIR,
  branch: ArchitectureIR,
  branchStatus: ArchitectureBranchStatus = "active",
): ArchitectureBranchMergeResult {
  if (branchStatus !== "active") {
    return { status: "invalid", reason: "branch-not-active" };
  }

  if (JSON.stringify(main) !== JSON.stringify(base)) {
    return { status: "conflict", reason: "main-changed-since-base" };
  }

  // The branch payload is intentionally accepted here so the merge decision
  // stays explicit about the proposed branch state. The fast-forward safety
  // check only depends on whether Main still equals the branch base.
  void branch;

  return { status: "merged" };
}
