import {
  PROJECT_SECTION_KEYS,
  type Project,
  type ProjectSectionKey,
  type ProjectStatus,
} from "./types";

const PROJECT_NAME_MAX_LENGTH = 120;
const PROJECT_DESCRIPTION_MAX_LENGTH = 1000;
const PROJECT_PLANNING_FIELD_MAX_LENGTH = 5000;
const PROJECT_REQUIREMENT_TITLE_MAX_LENGTH = 200;
const PROJECT_REQUIREMENT_DESCRIPTION_MAX_LENGTH = 2000;

export function isProjectSectionKey(value: unknown): value is ProjectSectionKey {
  return (
    typeof value === "string" &&
    (PROJECT_SECTION_KEYS as readonly string[]).includes(value)
  );
}

export function isProjectSectionStatus(value: unknown): value is import("./types").ProjectSectionStatus {
  return value === "not-started" || value === "in-progress" || value === "complete";
}

export function createDefaultProjectSections(): Record<ProjectSectionKey, import("./types").ProjectSectionStatus> {
  return Object.fromEntries(
    PROJECT_SECTION_KEYS.map((key) => [key, "not-started"]),
  ) as Record<ProjectSectionKey, import("./types").ProjectSectionStatus>;
}

export function isValidProjectSections(
  sections: unknown,
): sections is Record<ProjectSectionKey, import("./types").ProjectSectionStatus> {
  if (typeof sections !== "object" || sections === null) return false;
  const value = sections as Record<string, unknown>;
  return PROJECT_SECTION_KEYS.every((key) => isProjectSectionStatus(value[key]));
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
    isProjectStatus(project.status) &&
    (project.sections === undefined || isValidProjectSections(project.sections))
  );
}

export function assertValidProject(project: Project): void {
  if (!isValidProject(project)) {
    throw new Error("Invalid project.");
  }
}

export function isValidProjectPlanning(
  planning: import("./types").ProjectPlanning | undefined,
): boolean {
  if (planning === undefined) return true;
  return (
    typeof planning.objective === "string" &&
    planning.objective.length <= PROJECT_PLANNING_FIELD_MAX_LENGTH &&
    typeof planning.scope === "string" &&
    planning.scope.length <= PROJECT_PLANNING_FIELD_MAX_LENGTH &&
    typeof planning.constraints === "string" &&
    planning.constraints.length <= PROJECT_PLANNING_FIELD_MAX_LENGTH &&
    typeof planning.successCriteria === "string" &&
    planning.successCriteria.length <= PROJECT_PLANNING_FIELD_MAX_LENGTH
  );
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


export function isProjectRequirementPriority(value: unknown): value is import("./types").ProjectRequirementPriority {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

export function isProjectRequirementStatus(value: unknown): value is import("./types").ProjectRequirementStatus {
  return value === "todo" || value === "in-progress" || value === "done";
}

export function isValidProjectRequirement(requirement: import("./types").ProjectRequirement): boolean {
  return (
    typeof requirement.id === "string" && requirement.id.length > 0 &&
    typeof requirement.projectId === "string" && requirement.projectId.length > 0 &&
    typeof requirement.ownerId === "string" && requirement.ownerId.length > 0 &&
    typeof requirement.title === "string" && requirement.title.trim().length > 0 &&
    requirement.title.trim().length <= PROJECT_REQUIREMENT_TITLE_MAX_LENGTH &&
    (requirement.description === undefined ||
      (typeof requirement.description === "string" && requirement.description.length <= PROJECT_REQUIREMENT_DESCRIPTION_MAX_LENGTH)) &&
    isProjectRequirementPriority(requirement.priority) &&
    isProjectRequirementStatus(requirement.status)
  );
}


export function isProjectMilestoneStatus(value: unknown): value is import("./types").ProjectMilestoneStatus {
  return value === "planned" || value === "in-progress" || value === "done";
}

export function isValidProjectMilestone(milestone: import("./types").ProjectMilestone): boolean {
  return (
    typeof milestone.id === "string" && milestone.id.length > 0 &&
    typeof milestone.projectId === "string" && milestone.projectId.length > 0 &&
    typeof milestone.ownerId === "string" && milestone.ownerId.length > 0 &&
    typeof milestone.title === "string" && milestone.title.trim().length > 0 &&
    milestone.title.trim().length <= 200 &&
    (milestone.description === undefined || (typeof milestone.description === "string" && milestone.description.length <= 2000)) &&
    isProjectMilestoneStatus(milestone.status) &&
    (milestone.targetDate === undefined || (typeof milestone.targetDate === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(milestone.targetDate)))
  );
}


export function isProjectDesignDecisionStatus(value: unknown): value is import("./types").ProjectDesignDecisionStatus {
  return value === "proposed" || value === "accepted" || value === "superseded";
}

export function isValidProjectDesignDecision(decision: import("./types").ProjectDesignDecision): boolean {
  return (
    typeof decision.id === "string" && decision.id.length > 0 &&
    typeof decision.projectId === "string" && decision.projectId.length > 0 &&
    typeof decision.ownerId === "string" && decision.ownerId.length > 0 &&
    typeof decision.title === "string" && decision.title.trim().length > 0 && decision.title.trim().length <= 200 &&
    typeof decision.decision === "string" && decision.decision.trim().length > 0 && decision.decision.length <= 5000 &&
    typeof decision.rationale === "string" && decision.rationale.length <= 5000 &&
    isProjectDesignDecisionStatus(decision.status)
  );
}


export function isProjectApiMethod(value: unknown): value is import("./types").ProjectApiMethod {
  return value === "GET" || value === "POST" || value === "PUT" || value === "PATCH" || value === "DELETE";
}

export function isProjectApiStatus(value: unknown): value is import("./types").ProjectApiStatus {
  return value === "draft" || value === "active" || value === "deprecated";
}

export function isValidProjectApiContract(contract: import("./types").ProjectApiContract): boolean {
  return (
    typeof contract.id === "string" && contract.id.length > 0 &&
    typeof contract.projectId === "string" && contract.projectId.length > 0 &&
    typeof contract.ownerId === "string" && contract.ownerId.length > 0 &&
    isProjectApiMethod(contract.method) &&
    typeof contract.path === "string" && /^\\/.test(contract.path) && contract.path.length <= 300 &&
    typeof contract.title === "string" && contract.title.trim().length > 0 && contract.title.trim().length <= 200 &&
    (contract.description === undefined || (typeof contract.description === "string" && contract.description.length <= 2000)) &&
    isProjectApiStatus(contract.status)
  );
}
