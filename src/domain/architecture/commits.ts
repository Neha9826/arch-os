import type { ArchitectureIR } from "./types";

import type { ReactFlowArchitectureState } from "./reactFlowAdapter";

export type ArchitectureCommit = {
  id: string;
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  message: string;
  parentCommitId?: string;
  architectureIR: ArchitectureIR;
  canvasLayout: ReactFlowArchitectureState;
  createdAt?: unknown;
};

export function isValidCommitMessage(message: string): boolean {
  const value = message.trim();
  return value.length > 0 && value.length <= 200;
}

export function canCreateCommitFromParent(
  parentCommitId: string | undefined,
  commits: Set<string>,
): boolean {
  return !parentCommitId || commits.has(parentCommitId);
}
