import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
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

  if (input.parentCommitId) {
    const parentCommits = await listArchitectureCommits(input.architectureId);
    if (!canCreateCommitFromParent(
      input.parentCommitId,
      new Set(parentCommits.map((commit) => commit.id)),
    )) {
      throw new Error("Parent commit not found.");
    }
  }

  const commitRef = await addDoc(
    collection(db, "architectures", input.architectureId, COMMITS_SUBCOLLECTION),
    {
      architectureId: input.architectureId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      createdBy: input.createdBy,
      message: input.message.trim(),
      ...(input.parentCommitId ? { parentCommitId: input.parentCommitId } : {}),
      architectureIR: toSafe(input.architectureIR),
      canvasLayout: toSafe(input.canvasLayout),
      createdAt: serverTimestamp(),
    },
  );

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

  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
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
  });
}
