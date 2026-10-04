import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ArchitectureIR } from "@/domain/architecture/types";
import type { ReactFlowArchitectureState } from "@/domain/architecture/reactFlowAdapter";
import {
  canCreateCommitFromParent,
  isValidCommitMessage,
  type ArchitectureCommit,
} from "@/domain/architecture/commits";
import { assertValidArchitectureIR } from "@/domain/architecture/validation";

const COMMITS_SUBCOLLECTION = "commits";

function toSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toCommit(
  id: string,
  architectureId: string,
  data: Record<string, unknown>,
): ArchitectureCommit {
  return {
    id,
    architectureId,
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    message: typeof data.message === "string" ? data.message : "",
    parentCommitId:
      typeof data.parentCommitId === "string"
        ? data.parentCommitId
        : undefined,
    architectureIR: data.architectureIR as ArchitectureIR,
    canvasLayout: data.canvasLayout as ReactFlowArchitectureState,
    createdAt: data.createdAt,
  };
}

export async function createArchitectureCommit(input: {
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  message: string;
  parentCommitId?: string;
  architectureIR: ArchitectureIR;
  canvasLayout: ReactFlowArchitectureState;
}): Promise<string> {
  if (!isValidCommitMessage(input.message)) {
    throw new Error("Commit message is required and must be 200 characters or fewer.");
  }

  assertValidArchitectureIR(input.architectureIR);

  const architectureRef = doc(db, "architectures", input.architectureId);
  const commitRef = doc(
    collection(db, "architectures", input.architectureId, COMMITS_SUBCOLLECTION),
  );

  await runTransaction(db, async (transaction) => {
    const architectureSnapshot = await transaction.get(architectureRef);

    if (!architectureSnapshot.exists()) {
      throw new Error("Architecture not found.");
    }

    const architectureData = architectureSnapshot.data();
    if (architectureData.ownerId !== input.ownerId) {
      throw new Error("You do not own this architecture.");
    }

    if (architectureData.workspaceId !== input.workspaceId) {
      throw new Error("Architecture workspace mismatch.");
    }

    const currentHeadCommitId =
      typeof architectureData.headCommitId === "string"
        ? architectureData.headCommitId
        : undefined;

    if (!canCreateCommitFromParent(currentHeadCommitId, input.parentCommitId)) {
      throw new Error("Commit parent is not the current architecture history head.");
    }

    if (input.parentCommitId) {
      const parentRef = doc(
        db,
        "architectures",
        input.architectureId,
        COMMITS_SUBCOLLECTION,
        input.parentCommitId,
      );
      const parentSnapshot = await transaction.get(parentRef);

      if (!parentSnapshot.exists()) {
        throw new Error("Parent commit not found.");
      }

      const parentData = parentSnapshot.data();
      if (
        parentData.ownerId !== input.ownerId
        || parentData.architectureId !== input.architectureId
        || parentData.workspaceId !== input.workspaceId
      ) {
        throw new Error("Parent commit does not belong to this architecture.");
      }
    }

    transaction.set(commitRef, {
      architectureId: input.architectureId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      createdBy: input.createdBy,
      message: input.message.trim(),
      ...(input.parentCommitId ? { parentCommitId: input.parentCommitId } : {}),
      architectureIR: toSafe(input.architectureIR),
      canvasLayout: toSafe(input.canvasLayout),
      createdAt: serverTimestamp(),
    });

    transaction.update(architectureRef, {
      headCommitId: commitRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return commitRef.id;
}

export async function listArchitectureCommits(
  architectureId: string,
): Promise<ArchitectureCommit[]> {
  const commitsQuery = query(
    collection(db, "architectures", architectureId, COMMITS_SUBCOLLECTION),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(commitsQuery);

  return snapshot.docs.map((item) =>
    toCommit(item.id, architectureId, item.data()),
  );
}
