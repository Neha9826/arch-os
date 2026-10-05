import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  assertValidProject,
  isValidProjectDescription,
  isValidProjectName,
} from "@/domain/project/validation";
import type { Project, ProjectStatus } from "@/domain/project/types";

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
    status:
      data.status === "archived" ? "archived" : "active",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listProjectsForWorkspace(
  workspaceId: string,
): Promise<Project[]> {
  const projectsQuery = query(
    collection(db, PROJECTS_COLLECTION),
    where("workspaceId", "==", workspaceId),
  );
  const snapshot = await getDocs(projectsQuery);

  return snapshot.docs.map((project) =>
    toProject(project.id, project.data()),
  );
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
  };

  assertValidProject(project);

  await setDoc(projectRef, {
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    createdBy: project.createdBy,
    name: project.name,
    ...(project.description ? { description: project.description } : {}),
    status: project.status,
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
