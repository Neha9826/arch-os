import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  canOpenPullRequestFromBranch,
  canTransitionPullRequestStatus,
  type ArchitecturePullRequest,
  type ArchitecturePullRequestStatus,
} from "@/domain/architecture/pullRequests";

const PR_SUBCOLLECTION = "pullRequests";

function toPullRequest(id: string, data: Record<string, unknown>): ArchitecturePullRequest {
  return {
    id,
    architectureId: typeof data.architectureId === "string" ? data.architectureId : "",
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    sourceBranchId: typeof data.sourceBranchId === "string" ? data.sourceBranchId : "",
    sourceBranchName: typeof data.sourceBranchName === "string" ? data.sourceBranchName : "",
    baseSnapshotId: typeof data.baseSnapshotId === "string" ? data.baseSnapshotId : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : undefined,
    status: data.status === "merged" || data.status === "closed" ? data.status : "open",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function createArchitecturePullRequest(input: {
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  sourceBranchId: string;
  title: string;
  description?: string;
}): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Pull request title is required.");
  if (title.length > 120) throw new Error("Pull request title must be 120 characters or fewer.");

  const architectureRef = doc(db, "architectures", input.architectureId);
  const branchRef = doc(
    db,
    "architectures",
    input.architectureId,
    "branches",
    input.sourceBranchId,
  );
  const prRef = doc(
    db,
    "architectures",
    input.architectureId,
    PR_SUBCOLLECTION,
    input.sourceBranchId,
  );

  await runTransaction(db, async (transaction) => {
    const architectureSnapshot = await transaction.get(architectureRef);
    const branchSnapshot = await transaction.get(branchRef);

    if (!architectureSnapshot.exists()) throw new Error("Architecture not found.");
    if (!branchSnapshot.exists()) throw new Error("Branch not found.");

    const architecture = architectureSnapshot.data();
    const branch = branchSnapshot.data();

    if (
      architecture.ownerId !== input.ownerId ||
      architecture.workspaceId !== input.workspaceId ||
      branch.ownerId !== input.ownerId ||
      branch.workspaceId !== input.workspaceId
    ) {
      throw new Error("Architecture, workspace, and branch ownership do not match.");
    }

    if (!canOpenPullRequestFromBranch(branch.status)) {
      throw new Error("Only an active branch can open a pull request.");
    }

    const existing = await transaction.get(prRef);
    if (existing.exists()) {
      const current = toPullRequest(existing.id, existing.data());
      if (!canOpenPullRequestFromBranch(branch.status, current.status)) {
        throw new Error("This branch already has an open or merged pull request.");
      }

      transaction.update(prRef, {
        title,
        description: input.description?.trim() || "",
        status: "open",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    transaction.set(prRef, {
      architectureId: input.architectureId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      createdBy: input.createdBy,
      sourceBranchId: input.sourceBranchId,
      sourceBranchName: typeof branch.name === "string" ? branch.name : "",
      baseSnapshotId: typeof branch.baseSnapshotId === "string" ? branch.baseSnapshotId : "",
      title,
      description: input.description?.trim() || "",
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(branchRef, {
      pullRequestId: prRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return prRef.id;
}

export async function listArchitecturePullRequests(
  architectureId: string,
): Promise<ArchitecturePullRequest[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "architectures", architectureId, PR_SUBCOLLECTION),
      orderBy("updatedAt", "desc"),
    ),
  );
  return snapshot.docs.map((item) => toPullRequest(item.id, item.data()));
}

export async function getArchitecturePullRequest(
  architectureId: string,
  pullRequestId: string,
): Promise<ArchitecturePullRequest | null> {
  const snapshot = await getDoc(
    doc(db, "architectures", architectureId, PR_SUBCOLLECTION, pullRequestId),
  );
  return snapshot.exists() ? toPullRequest(snapshot.id, snapshot.data()) : null;
}

export async function updateArchitecturePullRequestStatus(input: {
  architectureId: string;
  pullRequestId: string;
  status: ArchitecturePullRequestStatus;
}): Promise<void> {
  const prRef = doc(
    db,
    "architectures",
    input.architectureId,
    PR_SUBCOLLECTION,
    input.pullRequestId,
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(prRef);
    if (!snapshot.exists()) throw new Error("Pull request not found.");

    const current = toPullRequest(snapshot.id, snapshot.data());
    if (input.status === "merged") {
      throw new Error(
        "Pull request merge must be performed through the architecture branch merge.",
      );
    }

    if (!canTransitionPullRequestStatus(current.status, input.status)) {
      throw new Error("Pull request is already closed or merged.");
    }

    transaction.update(prRef, {
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  });
}
