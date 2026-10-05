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
  isProjectSectionStatus,
  isValidProjectPlanning,
  isProjectRequirementPriority,
  isProjectRequirementStatus,
  isValidProjectRequirement,
  isProjectMilestoneStatus,
  isValidProjectMilestone,
} from "@/domain/project/validation";
import type {
  Project,
  ProjectSectionKey,
  ProjectSectionStatus,
  ProjectStatus,
  ProjectPlanning,
  ProjectRequirement,
  ProjectRequirementPriority,
  ProjectRequirementStatus,
  ProjectMilestone,
  ProjectMilestoneStatus,
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
    planning: data.planning as Project["planning"],
    sections: data.sections as Project["sections"],
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
    ...(project.description ? { description: project.description } : {}),
    planning: { objective: "", scope: "", constraints: "", successCriteria: "" },
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

export async function updateProjectPlanning(input: {
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


const PROJECT_REQUIREMENTS_SUBCOLLECTION = "requirements";

function toProjectRequirement(id: string, data: Record<string, unknown>): ProjectRequirement {
  return {
    id,
    projectId: typeof data.projectId === "string" ? data.projectId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : undefined,
    priority: isProjectRequirementPriority(data.priority) ? data.priority : "medium",
    status: isProjectRequirementStatus(data.status) ? data.status : "todo",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listProjectRequirements(projectId: string, ownerId: string): Promise<ProjectRequirement[]> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const project = await getDoc(projectRef);
  if (!project.exists()) throw new Error("Project not found.");
  if (project.data().ownerId !== ownerId) throw new Error("You do not have access to this project.");

  const snapshot = await getDocs(collection(projectRef, PROJECT_REQUIREMENTS_SUBCOLLECTION));
  return snapshot.docs.map((item) => toProjectRequirement(item.id, item.data()));
}

export async function createProjectRequirement(input: {
  projectId: string;
  ownerId: string;
  title: string;
  description?: string;
  priority: ProjectRequirementPriority;
}): Promise<string> {
  const projectRef = doc(db, PROJECTS_COLLECTION, input.projectId);
  const projectSnapshot = await getDoc(projectRef);
  if (!projectSnapshot.exists()) throw new Error("Project not found.");
  const project = projectSnapshot.data();
  if (project.ownerId !== input.ownerId) throw new Error("You do not have access to this project.");
  if (project.status !== "active") throw new Error("Archived projects are read-only.");

  const requirementRef = doc(collection(projectRef, PROJECT_REQUIREMENTS_SUBCOLLECTION));
  const requirement: ProjectRequirement = {
    id: requirementRef.id,
    projectId: input.projectId,
    ownerId: input.ownerId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    priority: input.priority,
    status: "todo",
  };
  if (!isValidProjectRequirement(requirement)) throw new Error("Invalid project requirement.");

  await setDoc(requirementRef, {
    projectId: requirement.projectId,
    ownerId: requirement.ownerId,
    title: requirement.title,
    ...(requirement.description ? { description: requirement.description } : {}),
    priority: requirement.priority,
    status: requirement.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return requirementRef.id;
}

export async function updateProjectRequirementStatus(input: {
  projectId: string;
  requirementId: string;
  ownerId: string;
  status: ProjectRequirementStatus;
}): Promise<void> {
  if (!isProjectRequirementStatus(input.status)) throw new Error("Invalid requirement status.");
  const requirementRef = doc(db, PROJECTS_COLLECTION, input.projectId, PROJECT_REQUIREMENTS_SUBCOLLECTION, input.requirementId);
  const snapshot = await getDoc(requirementRef);
  if (!snapshot.exists()) throw new Error("Requirement not found.");
  const requirement = toProjectRequirement(snapshot.id, snapshot.data());
  if (requirement.ownerId !== input.ownerId) throw new Error("You do not have access to this requirement.");
  await updateDoc(requirementRef, { status: input.status, updatedAt: serverTimestamp() });
}


const PROJECT_ROADMAP_SUBCOLLECTION = "roadmap";

function toProjectMilestone(id: string, data: Record<string, unknown>): ProjectMilestone {
  return {
    id,
    projectId: typeof data.projectId === "string" ? data.projectId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : undefined,
    status: isProjectMilestoneStatus(data.status) ? data.status : "planned",
    targetDate: typeof data.targetDate === "string" ? data.targetDate : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function assertActiveProjectOwner(projectId: string, ownerId: string) {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const snapshot = await getDoc(projectRef);
  if (!snapshot.exists()) throw new Error("Project not found.");
  const project = snapshot.data();
  if (project.ownerId !== ownerId) throw new Error("You do not have access to this project.");
  if (project.status !== "active") throw new Error("Archived projects are read-only.");
  return projectRef;
}

export async function listProjectMilestones(projectId: string, ownerId: string): Promise<ProjectMilestone[]> {
  const projectRef = await assertActiveProjectOwner(projectId, ownerId);
  const snapshot = await getDocs(collection(projectRef, PROJECT_ROADMAP_SUBCOLLECTION));
  return snapshot.docs.map((item) => toProjectMilestone(item.id, item.data()));
}

export async function createProjectMilestone(input: {
  projectId: string;
  ownerId: string;
  title: string;
  description?: string;
  targetDate?: string;
}): Promise<string> {
  const projectRef = await assertActiveProjectOwner(input.projectId, input.ownerId);
  const milestoneRef = doc(collection(projectRef, PROJECT_ROADMAP_SUBCOLLECTION));
  const milestone: ProjectMilestone = {
    id: milestoneRef.id,
    projectId: input.projectId,
    ownerId: input.ownerId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    status: "planned",
    targetDate: input.targetDate || undefined,
  };
  if (!isValidProjectMilestone(milestone)) throw new Error("Invalid project milestone.");
  await setDoc(milestoneRef, {
    projectId: milestone.projectId,
    ownerId: milestone.ownerId,
    title: milestone.title,
    ...(milestone.description ? { description: milestone.description } : {}),
    status: milestone.status,
    ...(milestone.targetDate ? { targetDate: milestone.targetDate } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return milestoneRef.id;
}

export async function updateProjectMilestoneStatus(input: {
  projectId: string;
  milestoneId: string;
  ownerId: string;
  status: ProjectMilestoneStatus;
}): Promise<void> {
  if (!isProjectMilestoneStatus(input.status)) throw new Error("Invalid milestone status.");
  const projectRef = await assertActiveProjectOwner(input.projectId, input.ownerId);
  const milestoneRef = doc(projectRef, PROJECT_ROADMAP_SUBCOLLECTION, input.milestoneId);
  const snapshot = await getDoc(milestoneRef);
  if (!snapshot.exists()) throw new Error("Milestone not found.");
  const milestone = toProjectMilestone(snapshot.id, snapshot.data());
  if (milestone.ownerId !== input.ownerId) throw new Error("You do not have access to this milestone.");
  await updateDoc(milestoneRef, { status: input.status, updatedAt: serverTimestamp() });
}
