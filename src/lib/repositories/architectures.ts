import type { Edge, Node } from "reactflow";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ArchitectureIR } from "@/domain/architecture/types";
import { isValidArchitectureIR } from "@/domain/architecture/validation";

const ARCHITECTURES_COLLECTION = "architectures";

export type Architecture = {
  id: string;
  name: string;
  ownerId: string;
  workspaceId?: string;
  nodes: Array<Node<{ label: string }>>;
  edges: Edge[];
  architectureIR?: ArchitectureIR;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toArchitecture(id: string, data: Record<string, unknown>): Architecture {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "Untitled Architecture",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : undefined,
    nodes: Array.isArray(data.nodes)
      ? (data.nodes as Array<Node<{ label: string }>>)
      : [],
    edges: Array.isArray(data.edges) ? (data.edges as Edge[]) : [],
    architectureIR: isValidArchitectureIR(data.architectureIR)
      ? data.architectureIR
      : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function toFirestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function listArchitecturesForOwner(userId: string): Promise<Architecture[]> {
  const architecturesQuery = query(
    collection(db, ARCHITECTURES_COLLECTION),
    where("ownerId", "==", userId),
  );
  const snapshot = await getDocs(architecturesQuery);

  return snapshot.docs.map((architecture) =>
    toArchitecture(architecture.id, architecture.data()),
  );
}

export async function getArchitecture(architectureId: string): Promise<Architecture | null> {
  const architectureSnapshot = await getDoc(
    doc(db, ARCHITECTURES_COLLECTION, architectureId),
  );

  if (!architectureSnapshot.exists()) {
    return null;
  }

  return toArchitecture(architectureSnapshot.id, architectureSnapshot.data());
}

export async function createArchitecture(input: {
  name: string;
  ownerId: string;
  workspaceId: string;
  nodes: Array<Node<{ label: string }>>;
  edges: Edge[];
  architectureIR: ArchitectureIR;
}): Promise<string> {
  const architectureRef = await addDoc(collection(db, ARCHITECTURES_COLLECTION), {
    name: input.name,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    nodes: toFirestoreSafe(input.nodes),
    edges: toFirestoreSafe(input.edges),
    architectureIR: toFirestoreSafe(input.architectureIR),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return architectureRef.id;
}

export async function updateArchitecture(input: {
  id: string;
  name: string;
  workspaceId?: string;
  nodes: Array<Node<{ label: string }>>;
  edges: Edge[];
  architectureIR: ArchitectureIR;
}): Promise<void> {
  const update: Record<string, unknown> = {
    name: input.name,
    nodes: toFirestoreSafe(input.nodes),
    edges: toFirestoreSafe(input.edges),
    architectureIR: toFirestoreSafe(input.architectureIR),
    updatedAt: serverTimestamp(),
  };

  if (input.workspaceId) {
    update.workspaceId = input.workspaceId;
  }

  await updateDoc(doc(db, ARCHITECTURES_COLLECTION, input.id), update);
}

export async function renameArchitecture(
  architectureId: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, ARCHITECTURES_COLLECTION, architectureId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteArchitecture(architectureId: string): Promise<void> {
  await deleteDoc(doc(db, ARCHITECTURES_COLLECTION, architectureId));
}
