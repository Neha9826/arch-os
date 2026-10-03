import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ArchitectureIR } from "@/domain/architecture/types";
import {
  assertValidArchitectureIR,
  isValidArchitectureIR,
} from "@/domain/architecture/validation";
import type {
  ArchitectureBranch,
  ArchitectureBranchStatus,
} from "@/domain/architecture/branches";
import type { Edge, Node } from "reactflow";

const BRANCHES_SUBCOLLECTION = "branches";

type CanvasLayout = {
  nodes: Array<Node<{ label: string }>>;
  edges: Edge[];
};

function toFirestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toBranch(
  id: string,
  data: Record<string, unknown>,
): ArchitectureBranch {
  return {
    id,
    architectureId:
      typeof data.architectureId === "string" ? data.architectureId : "",
    workspaceId:
      typeof data.workspaceId === "string" ? data.workspaceId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    name: typeof data.name === "string" ? data.name : "Untitled branch",
    description:
      typeof data.description === "string" ? data.description : undefined,
    baseSnapshotId:
      typeof data.baseSnapshotId === "string" ? data.baseSnapshotId : "",
    status:
      data.status === "merged" || data.status === "abandoned"
        ? data.status
        : "active",
    architectureIR: isValidArchitectureIR(data.architectureIR)
      ? data.architectureIR
      : {
          schemaVersion: 1,
          components: [],
          relations: [],
        },
    canvasLayout:
      typeof data.canvasLayout === "object" && data.canvasLayout !== null
        ? (data.canvasLayout as CanvasLayout)
        : { nodes: [], edges: [] },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function createArchitectureBranch(input: {
  architectureId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  name: string;
  description?: string;
  baseSnapshotId: string;
  architectureIR: ArchitectureIR;
  canvasLayout: CanvasLayout;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Branch name is required.");
  if (!input.baseSnapshotId.trim()) {
    throw new Error("A base snapshot is required.");
  }

  assertValidArchitectureIR(input.architectureIR);

  const branchRef = await addDoc(
    collection(
      db,
      "architectures",
      input.architectureId,
      BRANCHES_SUBCOLLECTION,
    ),
    {
      architectureId: input.architectureId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      createdBy: input.createdBy,
      name,
      ...(input.description?.trim()
        ? { description: input.description.trim() }
        : {}),
      baseSnapshotId: input.baseSnapshotId,
      status: "active",
      architectureIR: toFirestoreSafe(input.architectureIR),
      canvasLayout: toFirestoreSafe(input.canvasLayout),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );

  return branchRef.id;
}

export async function getArchitectureBranch(
  architectureId: string,
  branchId: string,
): Promise<ArchitectureBranch | null> {
  const snapshot = await getDoc(
    doc(db, "architectures", architectureId, BRANCHES_SUBCOLLECTION, branchId),
  );

  if (!snapshot.exists()) return null;

  return toBranch(snapshot.id, snapshot.data());
}

export async function listArchitectureBranches(
  architectureId: string,
): Promise<ArchitectureBranch[]> {
  const branchesQuery = query(
    collection(
      db,
      "architectures",
      architectureId,
      BRANCHES_SUBCOLLECTION,
    ),
    orderBy("updatedAt", "desc"),
  );

  const snapshot = await getDocs(branchesQuery);
  return snapshot.docs.map((item) => toBranch(item.id, item.data()));
}

export async function updateArchitectureBranch(input: {
  architectureId: string;
  branchId: string;
  name: string;
  description?: string;
  status?: ArchitectureBranchStatus;
  architectureIR: ArchitectureIR;
  canvasLayout: CanvasLayout;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("Branch name is required.");

  assertValidArchitectureIR(input.architectureIR);

  await updateDoc(
    doc(
      db,
      "architectures",
      input.architectureId,
      BRANCHES_SUBCOLLECTION,
      input.branchId,
    ),
    {
      name,
      description: input.description?.trim() || "",
      ...(input.status ? { status: input.status } : {}),
      architectureIR: toFirestoreSafe(input.architectureIR),
      canvasLayout: toFirestoreSafe(input.canvasLayout),
      updatedAt: serverTimestamp(),
    },
  );
}

export async function deleteArchitectureBranch(
  architectureId: string,
  branchId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, "architectures", architectureId, BRANCHES_SUBCOLLECTION, branchId),
  );
}
