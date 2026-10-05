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


export type ProjectInfrastructureResourceStatus = "planned" | "active" | "retired";
export type ProjectInfrastructureEnvironment = "development" | "staging" | "production" | "shared";

export type ProjectInfrastructureResource = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  provider: string;
  environment: ProjectInfrastructureEnvironment;
  purpose: string;
  status: ProjectInfrastructureResourceStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};


export type ProjectCodeArtifactStatus = "planned" | "active" | "deprecated";

export type ProjectCodeArtifact = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  language: string;
  runtime: string;
  path: string;
  purpose: string;
  status: ProjectCodeArtifactStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};


export type ProjectTestType = "unit" | "integration" | "e2e" | "security" | "performance" | "other";
export type ProjectTestStatus = "planned" | "passing" | "failing" | "skipped";

export type ProjectTestCase = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  type: ProjectTestType;
  path: string;
  purpose: string;
  status: ProjectTestStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};


export type ProjectDocumentationType =
  | "readme"
  | "api"
  | "architecture"
  | "runbook"
  | "decision"
  | "guide"
  | "other";

export type ProjectDocumentationStatus = "planned" | "draft" | "published" | "deprecated";

export type ProjectDocumentationEntry = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  type: ProjectDocumentationType;
  path: string;
  summary: string;
  status: ProjectDocumentationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};


export type ProjectExecutionTaskPriority = "low" | "medium" | "high" | "critical";
export type ProjectExecutionTaskStatus = "todo" | "in-progress" | "blocked" | "done";

export type ProjectExecutionTask = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  description?: string;
  priority: ProjectExecutionTaskPriority;
  status: ProjectExecutionTaskStatus;
  section?: ProjectSectionKey;
  sourceId?: string;
  dueDate?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProjectExecutionTaskPriority = "low" | "medium" | "high" | "critical";
export type ProjectExecutionTaskStatus = "todo" | "in-progress" | "blocked" | "done";

export type ProjectExecutionTask = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  description?: string;
  priority: ProjectExecutionTaskPriority;
  status: ProjectExecutionTaskStatus;
  section?: ProjectSectionKey;
  sourceId?: string;
  dueDate?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
