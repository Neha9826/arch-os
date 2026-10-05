import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  assertValidProject,
  createDefaultProjectSections,
  isProjectSectionKey,
  isValidProjectDescription,
  isValidProjectName,
  isProjectSectionStatus,\n  isValidProjectPlanning,
} from "@/domain/project/validation";
import type {
  Project,
  ProjectSectionKey,
  ProjectSectionStatus,
  ProjectStatus,
} from "@/domain/project/types";

const PROJECTS_COLLECTION = "projects";

function toProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    workspaceId:
      typeof data.workspaceId === "string" ? data.workspaceId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    name: typeof data.name === "string" ? data.name : "",
    description:
      typeof data.description === "string" ? data.description : undefined,
    status: data.status === "archived" ? "archived" : "active",
    planning: data.planning as Project["planning"],\n    sections: data.sections as Project["sections"],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listProjectsForWorkspace(
  workspaceId: string,
  ownerId: string,
): Promise<Project[]> {
  const projectsQuery = query(
    collection(db, PROJECTS_COLLECTION),
    where("ownerId", "==", ownerId),
  );
  const snapshot = await getDocs(projectsQuery);

  return snapshot.docs
    .map((project) => toProject(project.id, project.data()))
    .filter((project) => project.workspaceId === workspaceId);
}

export async function getProject(projectId: string): Promise<Project | null> {
  const snapshot = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));

  if (!snapshot.exists()) {
    return null;
  }

  return toProject(snapshot.id, snapshot.data());
}

export async function createProject(input: {
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  name: string;
  description?: string;
}): Promise<string> {
  if (!isValidProjectName(input.name)) {
    throw new Error("Project name must be between 1 and 120 characters.");
  }

  if (!isValidProjectDescription(input.description)) {
    throw new Error("Project description must be 1000 characters or fewer.");
  }

  const projectRef = doc(collection(db, PROJECTS_COLLECTION));
  const project: Project = {
    id: projectRef.id,
    workspaceId: input.workspaceId,
    ownerId: input.ownerId,
    createdBy: input.createdBy,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    status: "active",
    sections: createDefaultProjectSections(),
  };

  assertValidProject(project);

  await setDoc(projectRef, {
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    createdBy: project.createdBy,
    name: project.name,
    ...(project.description ? { description: project.description } : {}),\n    planning: { objective: "", scope: "", constraints: "", successCriteria: "" },
    status: project.status,
    sections: project.sections,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return projectRef.id;
}

export async function updateProject(input: {
  projectId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
}): Promise<void> {
  if (!isValidProjectName(input.name)) {
    throw new Error("Project name must be between 1 and 120 characters.");
  }

  if (!isValidProjectDescription(input.description)) {
    throw new Error("Project description must be 1000 characters or fewer.");
  }

  await updateDoc(doc(db, PROJECTS_COLLECTION, input.projectId), {
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    status: input.status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateProjectSectionStatus(input: {
  projectId: string;
  ownerId: string;
  section: ProjectSectionKey;
  status: ProjectSectionStatus;
}): Promise<void> {
  if (!isProjectSectionKey(input.section)) {
    throw new Error("Invalid project section.");
  }

  if (!isProjectSectionStatus(input.status)) {
    throw new Error("Invalid project section status.");
  }

  const projectRef = doc(db, PROJECTS_COLLECTION, input.projectId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(projectRef);

    if (!snapshot.exists()) {
      throw new Error("Project not found.");
    }

    const project = toProject(snapshot.id, snapshot.data());

    if (project.ownerId !== input.ownerId) {
      throw new Error("You do not have access to this project.");
    }

    if (project.status !== "active") {
      throw new Error("Archived projects are read-only.");
    }

    const sections = {
      ...(project.sections ?? createDefaultProjectSections()),
    };
    sections[input.section] = input.status;

    transaction.update(projectRef, {
      sections,
      updatedAt: serverTimestamp(),
    });
  });
}
\nexport async function updateProjectPlanning(input: {
  projectId: string;
  ownerId: string;
  planning: ProjectPlanning;
}): Promise<void> {
  if (!isValidProjectPlanning(input.planning)) {
    throw new Error("Invalid project planning data.");
  }

  const projectRef = doc(db, PROJECTS_COLLECTION, input.projectId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(projectRef);
    if (!snapshot.exists()) throw new Error("Project not found.");

    const project = toProject(snapshot.id, snapshot.data());
    if (project.ownerId !== input.ownerId) {
      throw new Error("You do not have access to this project.");
    }
    if (project.status !== "active") {
      throw new Error("Archived projects are read-only.");
    }

    transaction.update(projectRef, {
      planning: input.planning,
      updatedAt: serverTimestamp(),
    });
  });
}
