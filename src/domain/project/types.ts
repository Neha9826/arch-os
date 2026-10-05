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

export type Project = {
  id: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};
