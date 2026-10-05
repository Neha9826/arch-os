import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const PERSONAL_WORKSPACE_PREFIX = "personal-";
const PERSONAL_WORKSPACE_NAME = "Personal workspace";

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function personalWorkspaceId(userId: string) {
  return `${PERSONAL_WORKSPACE_PREFIX}${encodeURIComponent(userId)}`;
}

function toWorkspace(id: string, data: Record<string, unknown>): Workspace {
  return {
    id,
    name: typeof data.name === "string" ? data.name : PERSONAL_WORKSPACE_NAME,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function ensurePersonalWorkspace(userId: string): Promise<Workspace> {
  const workspaceRef = doc(db, "workspaces", personalWorkspaceId(userId));

  return runTransaction(db, async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceRef);

    if (workspaceSnapshot.exists()) {
      const workspace = toWorkspace(workspaceSnapshot.id, workspaceSnapshot.data());

      if (workspace.ownerId !== userId) {
        throw new Error("The personal workspace is owned by another user.");
      }

      return workspace;
    }

    transaction.set(workspaceRef, {
      name: PERSONAL_WORKSPACE_NAME,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: workspaceRef.id,
      name: PERSONAL_WORKSPACE_NAME,
      ownerId: userId,
    };
  });
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const workspaceSnapshot = await getDoc(doc(db, "workspaces", workspaceId));

  if (!workspaceSnapshot.exists()) {
    return null;
  }

  return toWorkspace(workspaceSnapshot.id, workspaceSnapshot.data());
}
