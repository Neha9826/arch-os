import { describe, expect, test } from "vitest";
import { diffArchitectures } from "@/domain/architecture/diff";
import type { ArchitectureIR } from "@/domain/architecture/types";

const before: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    { id: "api", kind: "service", name: "API", technology: "Node.js" },
    { id: "db", kind: "database", name: "Database" },
    { id: "old-cache", kind: "cache", name: "Old cache" },
  ],
  relations: [
    { id: "api-db", source: "api", target: "db", kind: "http", label: "REST" },
    { id: "old-link", source: "api", target: "old-cache", kind: "depends-on" },
  ],
};

const after: ArchitectureIR = {
  schemaVersion: 1,
  components: [
    { id: "api", kind: "service", name: "API v2", technology: "Node.js" },
    { id: "db", kind: "database", name: "Database" },
    { id: "redis", kind: "cache", name: "Redis" },
  ],
  relations: [
    { id: "api-db", source: "api", target: "db", kind: "http", label: "REST v2" },
    { id: "redis-link", source: "api", target: "redis", kind: "depends-on" },
  ],
};

describe("Architecture diff", () => {
  test("reports added, removed, and modified components", () => {
    const diff = diffArchitectures(before, after);
    expect(diff.components).toEqual([
      expect.objectContaining({ id: "api", status: "modified", changedFields: ["name"] }),
      expect.objectContaining({ id: "old-cache", status: "removed" }),
      expect.objectContaining({ id: "redis", status: "added" }),
    ]);
    expect(diff.summary.componentsAdded).toBe(1);
    expect(diff.summary.componentsRemoved).toBe(1);
    expect(diff.summary.componentsModified).toBe(1);
  });

  test("reports relation changes by stable relation ID", () => {
    const diff = diffArchitectures(before, after);
    expect(diff.relations).toEqual([
      expect.objectContaining({ id: "api-db", status: "modified", changedFields: ["label"] }),
      expect.objectContaining({ id: "old-link", status: "removed" }),
      expect.objectContaining({ id: "redis-link", status: "added" }),
    ]);
    expect(diff.summary.relationsAdded).toBe(1);
    expect(diff.summary.relationsRemoved).toBe(1);
    expect(diff.summary.relationsModified).toBe(1);
  });

  test("ignores canvas-only metadata because it compares Architecture IR", () => {
    expect(diffArchitectures(before, structuredClone(before)).summary).toEqual({
      componentsAdded: 0,
      componentsRemoved: 0,
      componentsModified: 0,
      relationsAdded: 0,
      relationsRemoved: 0,
      relationsModified: 0,
    });
  });
});
