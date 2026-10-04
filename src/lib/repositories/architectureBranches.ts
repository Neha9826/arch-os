import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
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
import type { ReactFlowArchitectureState } from "@/domain/architecture/reactFlowAdapter";
import { architectureIRToReactFlow } from "@/domain/architecture/reactFlowAdapter";

const BRANCHES_SUBCOLLECTION = "branches";

type CanvasLayout = ReactFlowArchitectureState;

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


export class ArchitectureBranchMergeConflictError extends Error {
  readonly code = "merge-conflict";

  constructor(message = "Main changed since this branch was created.") {
    super(message);
    this.name = "ArchitectureBranchMergeConflictError";
  }
}

export async function mergeArchitectureBranch(input: {
  architectureId: string;
  branchId: string;
}): Promise<ArchitectureBranch> {
  const architectureRef = doc(db, "architectures", input.architectureId);
  const branchRef = doc(
    db,
    "architectures",
    input.architectureId,
    BRANCHES_SUBCOLLECTION,
    input.branchId,
  );
  const baseSnapshotRef = (baseSnapshotId: string) =>
    doc(
      db,
      "architectures",
      input.architectureId,
      "snapshots",
      baseSnapshotId,
    );

  return runTransaction(db, async (transaction) => {
    const [architectureSnapshot, branchSnapshot] = await Promise.all([
      transaction.get(architectureRef),
      transaction.get(branchRef),
    ]);

    if (!architectureSnapshot.exists()) {
      throw new Error("Architecture not found.");
    }

    if (!branchSnapshot.exists()) {
      throw new Error("Branch not found.");
    }

    const architectureData = architectureSnapshot.data();
    const branch = toBranch(branchSnapshot.id, branchSnapshot.data());

    if (branch.status !== "active") {
      throw new Error("Only active branches can be merged.");
    }

    if (
      typeof architectureData.ownerId !== "string" ||
      architectureData.ownerId !== branch.ownerId
    ) {
      throw new Error("Architecture and branch ownership do not match.");
    }

    if (!branch.baseSnapshotId) {
      throw new Error("The branch base snapshot is missing.");
    }

    const baseSnapshot = await transaction.get(
      baseSnapshotRef(branch.baseSnapshotId),
    );

    if (!baseSnapshot.exists()) {
      throw new Error("The branch base snapshot is unavailable.");
    }

    const baseData = baseSnapshot.data();
    if (!isValidArchitectureIR(baseData.architectureIR)) {
      throw new Error("The branch base snapshot contains invalid Architecture IR.");
    }

    const baseLayout =
      typeof baseData.canvasLayout === "object" && baseData.canvasLayout !== null
        ? (baseData.canvasLayout as CanvasLayout)
        : { nodes: [], edges: [] };

    const mainLayout =
      typeof architectureData.canvasLayout === "object" &&
      architectureData.canvasLayout !== null
        ? (architectureData.canvasLayout as CanvasLayout)
        : {
            nodes: Array.isArray(architectureData.nodes)
              ? (architectureData.nodes as CanvasLayout["nodes"])
              : [],
            edges: Array.isArray(architectureData.edges)
              ? (architectureData.edges as CanvasLayout["edges"])
              : [],
          };

    const mainIR = isValidArchitectureIR(architectureData.architectureIR)
      ? architectureData.architectureIR
      : reactFlowToArchitectureIR(mainLayout);

    const mainUnchanged =
      JSON.stringify(mainIR) === JSON.stringify(baseData.architectureIR) &&
      JSON.stringify(mainLayout) === JSON.stringify(baseLayout);

    if (!mainUnchanged) {
      throw new ArchitectureBranchMergeConflictError();
    }

    assertValidArchitectureIR(branch.architectureIR);

    const mergedLayout = architectureIRToReactFlow(
      branch.architectureIR,
      branch.canvasLayout,
    );

    transaction.update(architectureRef, {
      nodes: mergedLayout.nodes,
      edges: mergedLayout.edges,
      canvasLayout: toFirestoreSafe(mergedLayout),
      architectureIR: toFirestoreSafe(branch.architectureIR),
      updatedAt: serverTimestamp(),
    });

    transaction.update(branchRef, {
      status: "merged",
      updatedAt: serverTimestamp(),
    });

    return {
      ...branch,
      status: "merged",
      canvasLayout: mergedLayout,
    };
  });
}
