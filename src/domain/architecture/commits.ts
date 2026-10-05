import type { ArchitectureIR } from "./types";
import { diffArchitectures, type ArchitectureDiff } from "./diff";

import type { ReactFlowArchitectureState } from "./reactFlowAdapter";

export type ArchitectureCommitDiff = {
  semantic: ArchitectureDiff;
  canvasChanged: boolean;
};

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
  currentHeadCommitId: string | undefined,
  parentCommitId: string | undefined,
): boolean {
  return currentHeadCommitId === parentCommitId;
}

export function diffArchitectureCommits(
  before: ArchitectureCommit,
  after: ArchitectureCommit,
): ArchitectureCommitDiff {
  return {
    semantic: diffArchitectures(before.architectureIR, after.architectureIR),
    canvasChanged: JSON.stringify(before.canvasLayout) !== JSON.stringify(after.canvasLayout),
  };
}

export function isCommitHeadAdvanced(
  previousHeadCommitId: string | undefined,
  nextHeadCommitId: string,
): boolean {
  return previousHeadCommitId !== nextHeadCommitId;
}
