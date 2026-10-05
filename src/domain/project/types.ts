export type ProjectStatus = "active" | "archived";

export const PROJECT_SECTION_KEYS = [
  "planning",
  "requirements",
  "roadmap",
  "design",
  "architecture",
  "api",
  "database",
  "infrastructure",
  "code",
  "testing",
  "documentation",
] as const;

export type ProjectSectionKey = (typeof PROJECT_SECTION_KEYS)[number];

export type ProjectSectionStatus = "not-started" | "in-progress" | "complete";

export type ProjectRequirementPriority = "low" | "medium" | "high" | "critical";
export type ProjectRequirementStatus = "todo" | "in-progress" | "done";

export type ProjectRequirement = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  description?: string;
  priority: ProjectRequirementPriority;
  status: ProjectRequirementStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProjectMilestoneStatus = "planned" | "in-progress" | "done";

export type ProjectMilestone = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  description?: string;
  status: ProjectMilestoneStatus;
  targetDate?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProjectDesignDecisionStatus = "proposed" | "accepted" | "superseded";

export type ProjectDesignDecision = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  decision: string;
  rationale: string;
  status: ProjectDesignDecisionStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProjectApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ProjectApiStatus = "draft" | "active" | "deprecated";

export type ProjectApiContract = {
  id: string;
  projectId: string;
  ownerId: string;
  method: ProjectApiMethod;
  path: string;
  title: string;
  description?: string;
  status: ProjectApiStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProjectDatabaseEntityStatus = "draft" | "active" | "deprecated";

export type ProjectDatabaseEntity = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  purpose: string;
  status: ProjectDatabaseEntityStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProjectPlanning = {
  objective: string;
  scope: string;
  constraints: string;
  successCriteria: string;
};

export type ProjectSection = {
  key: ProjectSectionKey;
  status: ProjectSectionStatus;
};

export type Project = {
  id: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  name: string;
  description?: string;
  planning?: ProjectPlanning;
  status: ProjectStatus;
  sections?: Record<ProjectSectionKey, ProjectSectionStatus>;
  createdAt?: unknown;
  updatedAt?: unknown;
};
