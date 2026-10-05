import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isProjectExecutionTaskPriority, isProjectExecutionTaskStatus, isProjectSectionKey, isValidProjectExecutionTask } from "@/domain/project/validation";
import type { ProjectExecutionTask, ProjectExecutionTaskPriority, ProjectExecutionTaskStatus, ProjectSectionKey } from "@/domain/project/types";

const PROJECTS_COLLECTION = "projects";
const PROJECT_EXECUTION_SUBCOLLECTION = "executionTasks";

function toProjectExecutionTask(id: string, data: Record<string, unknown>): ProjectExecutionTask {
  return {
    id,
    projectId: typeof data.projectId === "string" ? data.projectId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : undefined,
    priority: isProjectExecutionTaskPriority(data.priority) ? data.priority : "medium",
    status: isProjectExecutionTaskStatus(data.status) ? data.status : "todo",
    section: isProjectSectionKey(data.section) ? data.section : undefined,
    sourceId: typeof data.sourceId === "string" ? data.sourceId : undefined,
    dueDate: typeof data.dueDate === "string" ? data.dueDate : undefined,
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

export async function listProjectExecutionTasks(projectId: string, ownerId: string): Promise<ProjectExecutionTask[]> {
  const projectRef = await assertActiveProjectOwner(projectId, ownerId);
  const snapshot = await getDocs(collection(projectRef, PROJECT_EXECUTION_SUBCOLLECTION));
  return snapshot.docs.map((item) => toProjectExecutionTask(item.id, item.data())).sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return a.title.localeCompare(b.title);
  });
}

export async function createProjectExecutionTask(input: {
  projectId: string; ownerId: string; title: string; description?: string;
  priority: ProjectExecutionTaskPriority; section?: ProjectSectionKey; sourceId?: string; dueDate?: string;
}): Promise<string> {
  const projectRef = await assertActiveProjectOwner(input.projectId, input.ownerId);
  const taskRef = doc(collection(projectRef, PROJECT_EXECUTION_SUBCOLLECTION));
  const task: ProjectExecutionTask = {
    id: taskRef.id, projectId: input.projectId, ownerId: input.ownerId, title: input.title.trim(),
    description: input.description?.trim() || undefined, priority: input.priority, status: "todo",
    section: input.section, sourceId: input.sourceId?.trim() || undefined, dueDate: input.dueDate || undefined,
  };
  if (!isValidProjectExecutionTask(task)) throw new Error("Invalid execution task.");
  await setDoc(taskRef, {
    projectId: task.projectId, ownerId: task.ownerId, title: task.title,
    ...(task.description ? { description: task.description } : {}),
    priority: task.priority, status: task.status,
    ...(task.section ? { section: task.section } : {}),
    ...(task.sourceId ? { sourceId: task.sourceId } : {}),
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return taskRef.id;
}

export async function updateProjectExecutionTask(input: {
  projectId: string;
  taskId: string;
  ownerId: string;
  title: string;
  description?: string;
  priority: ProjectExecutionTaskPriority;
  status: ProjectExecutionTaskStatus;
  section?: ProjectSectionKey;
  sourceId?: string;
  dueDate?: string;
}): Promise<void> {
  if (!isProjectExecutionTaskPriority(input.priority)) throw new Error("Invalid execution task priority.");
  if (!isProjectExecutionTaskStatus(input.status)) throw new Error("Invalid execution task status.");

  const projectRef = await assertActiveProjectOwner(input.projectId, input.ownerId);
  const taskRef = doc(projectRef, PROJECT_EXECUTION_SUBCOLLECTION, input.taskId);
  const snapshot = await getDoc(taskRef);
  if (!snapshot.exists()) throw new Error("Execution task not found.");

  const existing = toProjectExecutionTask(snapshot.id, snapshot.data());
  if (existing.ownerId !== input.ownerId) throw new Error("You do not have access to this task.");

  const task: ProjectExecutionTask = {
    id: existing.id,
    projectId: existing.projectId,
    ownerId: existing.ownerId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    priority: input.priority,
    status: input.status,
    section: input.section,
    sourceId: input.sourceId?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  };

  if (!isValidProjectExecutionTask(task)) throw new Error("Invalid execution task.");

  await updateDoc(taskRef, {
    title: task.title,
    ...(task.description ? { description: task.description } : { description: deleteField() }),
    priority: task.priority,
    status: task.status,
    ...(task.section ? { section: task.section } : { section: deleteField() }),
    ...(task.sourceId ? { sourceId: task.sourceId } : { sourceId: deleteField() }),
    ...(task.dueDate ? { dueDate: task.dueDate } : { dueDate: deleteField() }),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProjectExecutionTaskStatus(input: {
  projectId: string; taskId: string; ownerId: string; status: ProjectExecutionTaskStatus;
}): Promise<void> {
  if (!isProjectExecutionTaskStatus(input.status)) throw new Error("Invalid execution task status.");
  const projectRef = await assertActiveProjectOwner(input.projectId, input.ownerId);
  const taskRef = doc(projectRef, PROJECT_EXECUTION_SUBCOLLECTION, input.taskId);
  const snapshot = await getDoc(taskRef);
  if (!snapshot.exists()) throw new Error("Execution task not found.");
  const task = toProjectExecutionTask(snapshot.id, snapshot.data());
  if (task.ownerId !== input.ownerId) throw new Error("You do not have access to this task.");
  await updateDoc(taskRef, { status: input.status, updatedAt: serverTimestamp() });
}

export async function deleteProjectExecutionTask(input: {
  projectId: string; taskId: string; ownerId: string;
}): Promise<void> {
  const projectRef = await assertActiveProjectOwner(input.projectId, input.ownerId);
  const taskRef = doc(projectRef, PROJECT_EXECUTION_SUBCOLLECTION, input.taskId);
  const snapshot = await getDoc(taskRef);
  if (!snapshot.exists()) throw new Error("Execution task not found.");
  const task = toProjectExecutionTask(snapshot.id, snapshot.data());
  if (task.ownerId !== input.ownerId) throw new Error("You do not have access to this task.");
  await deleteDoc(taskRef);
}
