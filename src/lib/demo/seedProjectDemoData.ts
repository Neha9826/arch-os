import {
  createProjectApiContract,
  createProjectCodeArtifact,
  createProjectDatabaseEntity,
  createProjectDesignDecision,
  createProjectDocumentation,
  createProjectInfrastructureResource,
  createProjectMilestone,
  createProjectRequirement,
  createProjectTestCase,
  listProjectApiContracts,
  listProjectCodeArtifacts,
  listProjectDatabaseEntities,
  listProjectDesignDecisions,
  listProjectDocumentation,
  listProjectInfrastructureResources,
  listProjectMilestones,
  listProjectRequirements,
  listProjectTestCases,
  updateProjectPlanning,
} from "@/lib/repositories/projects";
import { createProjectExecutionTask, listProjectExecutionTasks } from "@/lib/repositories/projectExecution";
import { createArchitecture, listArchitecturesForProject } from "@/lib/repositories/architectures";
import type { Project } from "@/domain/project/types";

const DEMO_PREFIX = "DEMO ·";

function hasDemoRecord(items: Array<{ title?: string; name?: string }>) {
  return items.some((item) => (item.title ?? item.name ?? "").startsWith(DEMO_PREFIX));
}

/**
 * Seeds one realistic, clearly labelled record per engineering module.
 * Existing user records are preserved; each demo record is only added once.
 * Intended for local development/testing only.
 */
export async function seedProjectDemoData(project: Project, ownerId: string) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo data is only available in development mode.");
  }
  if (project.ownerId !== ownerId || project.status !== "active") {
    throw new Error("Only your active project can be seeded.");
  }

  const results: string[] = [];
  const planning = project.planning;
  if (!planning?.objective && !planning?.scope && !planning?.constraints && !planning?.successCriteria) {
    await updateProjectPlanning({
      projectId: project.id,
      ownerId,
      planning: {
        objective: "Build a secure multi-tenant SaaS workspace for planning, designing, and tracking software delivery.",
        scope: "Project planning, requirements, architecture canvas, API contracts, data models, infrastructure, implementation tracking, testing, and documentation.",
        constraints: "Protect tenant data, preserve ownership boundaries, keep architecture changes auditable, and support responsive desktop and laptop layouts.",
        successCriteria: "A project owner can define the system, track delivery, review architecture health, and verify changes without losing saved work.",
      },
    });
    results.push("planning");
  }

  if (!hasDemoRecord(await listProjectRequirements(project.id, ownerId))) {
    await createProjectRequirement({ projectId: project.id, ownerId, title: `${DEMO_PREFIX} Workspace isolation`, description: "Users can read and modify only projects and engineering records they own.", priority: "critical" });
    results.push("requirements");
  }
  if (!hasDemoRecord(await listProjectMilestones(project.id, ownerId))) {
    await createProjectMilestone({ projectId: project.id, ownerId, title: `${DEMO_PREFIX} MVP validation`, description: "Complete the core engineering workflow and verify persistence and access control.", targetDate: "2026-11-15" });
    results.push("roadmap");
  }
  if (!hasDemoRecord(await listProjectDesignDecisions(project.id, ownerId))) {
    await createProjectDesignDecision({ projectId: project.id, ownerId, title: `${DEMO_PREFIX} Keep domain logic separate`, decision: "Keep validation and architecture rules in domain modules, with Firestore access behind repositories.", rationale: "This makes core rules testable and keeps UI components from owning persistence or security decisions." });
    results.push("design");
  }
  if (!hasDemoRecord(await listProjectApiContracts(project.id, ownerId))) {
    await createProjectApiContract({ projectId: project.id, ownerId, method: "GET", path: "/api/v1/projects/:projectId/health", title: `${DEMO_PREFIX} Project health summary`, description: "Returns project-scoped engineering progress and architecture health for the authenticated owner." });
    results.push("api");
  }
  if (!hasDemoRecord(await listProjectDatabaseEntities(project.id, ownerId))) {
    await createProjectDatabaseEntity({ projectId: project.id, ownerId, name: `${DEMO_PREFIX} project_memberships`, purpose: "Maps authenticated users to project roles and enforces workspace ownership boundaries." });
    results.push("database");
  }
  if (!hasDemoRecord(await listProjectInfrastructureResources(project.id, ownerId))) {
    await createProjectInfrastructureResource({ projectId: project.id, ownerId, name: `${DEMO_PREFIX} Local development environment`, provider: "Docker Compose", environment: "development", purpose: "Run the web application and supporting services consistently for local validation." });
    results.push("infrastructure");
  }
  if (!hasDemoRecord(await listProjectCodeArtifacts(project.id, ownerId))) {
    await createProjectCodeArtifact({ projectId: project.id, ownerId, name: `${DEMO_PREFIX} Project repository layer`, language: "TypeScript", runtime: "Next.js 16 / React 19", path: "src/lib/repositories/projects.ts", purpose: "Validates project ownership and persists engineering records through Firestore." });
    results.push("code");
  }
  if (!hasDemoRecord(await listProjectTestCases(project.id, ownerId))) {
    await createProjectTestCase({ projectId: project.id, ownerId, name: `${DEMO_PREFIX} Owner isolation check`, type: "security", path: "tests/firestore.rules.test.ts", purpose: "Verify a different authenticated user cannot read or mutate this project's records." });
    results.push("testing");
  }
  if (!hasDemoRecord(await listProjectDocumentation(project.id, ownerId))) {
    await createProjectDocumentation({ projectId: project.id, ownerId, title: `${DEMO_PREFIX} Local validation runbook`, type: "runbook", path: "docs/local-validation.md", summary: "Start the app and Firestore emulator, sign in, exercise project workflows, and verify saved records survive reload." });
    results.push("documentation");
  }
  if (!hasDemoRecord(await listProjectExecutionTasks(project.id, ownerId))) {
    await createProjectExecutionTask({ projectId: project.id, ownerId, title: `${DEMO_PREFIX} Verify project persistence`, description: "Create a record, reload the page, and confirm the record remains available to its owner.", priority: "high", section: "testing", sourceId: "demo-persistence-check", dueDate: "2026-11-10" });
    results.push("execution");
  }
  if (!hasDemoRecord(await listArchitecturesForProject(project.id, ownerId))) {
    const nodes = [
      { id: "demo-client", type: "default", position: { x: 80, y: 120 }, data: { label: "Web Client" } },
      { id: "demo-api", type: "default", position: { x: 340, y: 120 }, data: { label: "Application API" } },
      { id: "demo-db", type: "default", position: { x: 600, y: 120 }, data: { label: "PostgreSQL" } },
    ];
    const edges = [
      { id: "demo-client-api", source: "demo-client", target: "demo-api", label: "HTTPS", type: "default" },
      { id: "demo-api-db", source: "demo-api", target: "demo-db", label: "SQL", type: "default" },
    ];
    await createArchitecture({
      name: `${DEMO_PREFIX} SaaS reference architecture`,
      ownerId,
      workspaceId: project.workspaceId,
      projectId: project.id,
      nodes,
      edges,
      canvasLayout: { nodes, edges },
      architectureIR: {
        schemaVersion: 1,
        components: [
          { id: "demo-client", kind: "client", name: "Web Client", technology: "Next.js", description: "Authenticated browser application" },
          { id: "demo-api", kind: "service", name: "Application API", technology: "Node.js", description: "Validates requests and enforces access rules" },
          { id: "demo-db", kind: "database", name: "PostgreSQL", technology: "PostgreSQL", description: "Persistent application data" },
        ],
        relations: [
          { id: "demo-client-api", source: "demo-client", target: "demo-api", kind: "http", label: "HTTPS" },
          { id: "demo-api-db", source: "demo-api", target: "demo-db", kind: "database", label: "SQL" },
        ],
      },
    });
    results.push("architecture");
  }

  return results;
}
