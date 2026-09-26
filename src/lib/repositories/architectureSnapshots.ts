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
import type { Edge, Node } from "reactflow";

const SNAPSHOTS_SUBCOLLECTION = "snapshots";

export type ArchitectureSnapshot = {
  id: string;
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  message?: string;
  architectureIR: ArchitectureIR;
  canvasLayout: {
    nodes: Array<Node<{ label: string }>>;
    edges: Edge[];
  };
  createdAt?: unknown;
  createdBy: string;
};

export async function createArchitectureSnapshot(input: {
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  name: string;
  message?: string;
  architectureIR: ArchitectureIR;
  canvasLayout: {
    nodes: Array<Node<{ label: string }>>;
    edges: Edge[];
  };
}): Promise<string> {
  const snapshotRef = await addDoc(
    collection(db, "architectures", input.architectureId, SNAPSHOTS_SUBCOLLECTION),
    {
      architectureId: input.architectureId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      createdBy: input.createdBy,
      name: input.name.trim(),
      ...(input.message?.trim() ? { message: input.message.trim() } : {}),
      architectureIR: JSON.parse(JSON.stringify(input.architectureIR)),
      canvasLayout: JSON.parse(JSON.stringify(input.canvasLayout)),
      createdAt: serverTimestamp(),
    },
  );

  return snapshotRef.id;
}

export async function listArchitectureSnapshots(
  architectureId: string,
): Promise<ArchitectureSnapshot[]> {
  const snapshotsQuery = query(
    collection(db, "architectures", architectureId, SNAPSHOTS_SUBCOLLECTION),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(snapshotsQuery);

  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      architectureId: typeof data.architectureId === "string" ? data.architectureId : architectureId,
      workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
      ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
      createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
      name: typeof data.name === "string" ? data.name : "Untitled snapshot",
      message: typeof data.message === "string" ? data.message : undefined,
      architectureIR: data.architectureIR as ArchitectureIR,
      canvasLayout: data.canvasLayout as ArchitectureSnapshot["canvasLayout"],
      createdAt: data.createdAt,
    };
  });
}
