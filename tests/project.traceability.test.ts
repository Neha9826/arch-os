import { describe, expect, it } from "vitest";
import { buildProjectTraceability } from "@/domain/project/traceability";
import type { ProjectExecutionTask } from "@/domain/project/types";

const task = (overrides: Partial<ProjectExecutionTask>): ProjectExecutionTask => ({
  id: "task-1",
  projectId: "project-1",
  ownerId: "owner-1",
  title: "Implement API",
  priority: "medium",
  status: "todo",
  ...overrides,
});

describe("buildProjectTraceability", () => {
  it("links execution tasks to architectures by sourceId and calculates progress", () => {
    const result = buildProjectTraceability(
      [
        { id: "arch-1", name: "Checkout Architecture" },
        { id: "arch-2", name: "Notifications Architecture" },
      ],
      [
        task({ id: "task-1", sourceId: "arch-1", status: "done" }),
        task({ id: "task-2", sourceId: "arch-1", status: "in-progress" }),
        task({ id: "task-3", sourceId: "arch-1", status: "blocked" }),
        task({ id: "task-4", sourceId: "unknown-architecture" }),
        task({ id: "task-5" }),
      ],
    );

    expect(result.architectures[0]).toMatchObject({
      architecture: { id: "arch-1", name: "Checkout Architecture" },
      completedTasks: 1,
      blockedTasks: 1,
      progress: 33,
    });
    expect(result.architectures[0].tasks).toHaveLength(3);
    expect(result.architectures[1].tasks).toHaveLength(0);
    expect(result.unlinkedTasks.map((item) => item.id)).toEqual(["task-4", "task-5"]);
    expect(result.linkedTaskCount).toBe(3);
    expect(result.totalTaskCount).toBe(5);
    expect(result.linkedCompletedTaskCount).toBe(1);
  });

  it("handles projects with no architectures or execution tasks", () => {
    const result = buildProjectTraceability([], []);

    expect(result.architectures).toEqual([]);
    expect(result.unlinkedTasks).toEqual([]);
    expect(result.linkedTaskCount).toBe(0);
    expect(result.totalTaskCount).toBe(0);
    expect(result.linkedCompletedTaskCount).toBe(0);
  });
});
