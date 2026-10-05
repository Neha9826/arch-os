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

export type ProjectPlanning = {\n  objective: string;\n  scope: string;\n  constraints: string;\n  successCriteria: string;\n};\n\nexport type ProjectSection = {
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
  status: ProjectStatus;
  sections?: Record<ProjectSectionKey, ProjectSectionStatus>;
  createdAt?: unknown;
  updatedAt?: unknown;
};
