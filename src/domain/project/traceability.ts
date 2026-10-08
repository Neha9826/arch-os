import type { ProjectExecutionTask } from "@/domain/project/types";

export type TraceabilityArchitecture = {
  id: string;
  name: string;
};

export type ArchitectureTraceabilityItem = {
  architecture: TraceabilityArchitecture;
  tasks: ProjectExecutionTask[];
  completedTasks: number;
  blockedTasks: number;
  progress: number;
};

export type ProjectTraceability = {
  architectures: ArchitectureTraceabilityItem[];
  unlinkedTasks: ProjectExecutionTask[];
  linkedTaskCount: number;
  totalTaskCount: number;
  linkedCompletedTaskCount: number;
};

export function buildProjectTraceability(
  architectures: TraceabilityArchitecture[],
  tasks: ProjectExecutionTask[],
): ProjectTraceability {
  const taskMap = new Map<string, ProjectExecutionTask[]>();

  for (const task of tasks) {
    if (!task.sourceId) continue;
    const existing = taskMap.get(task.sourceId) ?? [];
    existing.push(task);
    taskMap.set(task.sourceId, existing);
  }

  const architectureIds = new Set(architectures.map((architecture) => architecture.id));
  const linkedTaskIds = new Set<string>();

  const items = architectures.map((architecture) => {
    const linkedTasks = taskMap.get(architecture.id) ?? [];
    linkedTasks.forEach((task) => linkedTaskIds.add(task.id));

    const completedTasks = linkedTasks.filter((task) => task.status === "done").length;
    const blockedTasks = linkedTasks.filter((task) => task.status === "blocked").length;

    return {
      architecture,
      tasks: linkedTasks,
      completedTasks,
      blockedTasks,
      progress: linkedTasks.length === 0 ? 0 : Math.round((completedTasks / linkedTasks.length) * 100),
    };
  });

  const unlinkedTasks = tasks.filter(
    (task) => !task.sourceId || !architectureIds.has(task.sourceId) || !linkedTaskIds.has(task.id),
  );

  const linkedTaskCount = tasks.length - unlinkedTasks.length;
  const linkedCompletedTaskCount = tasks.filter(
    (task) => linkedTaskIds.has(task.id) && task.status === "done",
  ).length;

  return {
    architectures: items,
    unlinkedTasks,
    linkedTaskCount,
    totalTaskCount: tasks.length,
    linkedCompletedTaskCount,
  };
}
