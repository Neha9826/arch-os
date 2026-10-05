import {
  PROJECT_SECTION_KEYS,
  type Project,
  type ProjectSectionKey,
  type ProjectStatus,
} from "./types";

const PROJECT_NAME_MAX_LENGTH = 120;
const PROJECT_DESCRIPTION_MAX_LENGTH = 1000;

export function isProjectSectionKey(value: unknown): value is ProjectSectionKey {
  return (
    typeof value === "string" &&
    (PROJECT_SECTION_KEYS as readonly string[]).includes(value)
  );
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "active" || value === "archived";
}

export function isValidProject(project: Project): boolean {
  return (
    typeof project.id === "string" &&
    project.id.length > 0 &&
    typeof project.workspaceId === "string" &&
    project.workspaceId.length > 0 &&
    typeof project.ownerId === "string" &&
    project.ownerId.length > 0 &&
    typeof project.createdBy === "string" &&
    project.createdBy.length > 0 &&
    typeof project.name === "string" &&
    project.name.trim().length > 0 &&
    project.name.trim().length <= PROJECT_NAME_MAX_LENGTH &&
    (project.description === undefined ||
      (typeof project.description === "string" &&
        project.description.length <= PROJECT_DESCRIPTION_MAX_LENGTH)) &&
    isProjectStatus(project.status)
  );
}

export function assertValidProject(project: Project): void {
  if (!isValidProject(project)) {
    throw new Error("Invalid project.");
  }
}

export function isValidProjectName(name: string): boolean {
  const value = name.trim();
  return value.length > 0 && value.length <= PROJECT_NAME_MAX_LENGTH;
}

export function isValidProjectDescription(description: string | undefined): boolean {
  return (
    description === undefined ||
    description.length <= PROJECT_DESCRIPTION_MAX_LENGTH
  );
}
