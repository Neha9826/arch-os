import type { ArchitectureBranchStatus } from "./branches";

export type ArchitecturePullRequestStatus = "open" | "merged" | "closed";

export type ArchitecturePullRequest = {
  id: string;
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  sourceBranchId: string;
  sourceBranchName: string;
  baseSnapshotId: string;
  title: string;
  description?: string;
  status: ArchitecturePullRequestStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function canTransitionPullRequestStatus(
  current: ArchitecturePullRequestStatus,
  next: ArchitecturePullRequestStatus,
): boolean {
  if (current !== "open") return current === next;
  return next === "open" || next === "closed";
}

export function canOpenPullRequestFromBranch(
  branchStatus: ArchitectureBranchStatus,
  pullRequestStatus?: ArchitecturePullRequestStatus,
): boolean {
  return branchStatus === "active" && (!pullRequestStatus || pullRequestStatus === "closed");
}
