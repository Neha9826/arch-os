import { describe, expect, test } from "vitest";
import type { ProjectApiContract } from "@/domain/project/types";
import { buildOpenApiDocument } from "@/domain/project/openapi";

function contract(overrides: Partial<ProjectApiContract> = {}): ProjectApiContract {
  return {
    id: "contract-1",
    projectId: "project-1",
    ownerId: "owner-1",
    method: "GET",
    path: "/users/{userId}",
    title: "Get user",
    description: "Returns a user by ID.",
    status: "active",
    ...overrides,
  };
}

describe("buildOpenApiDocument", () => {
  test("builds an OpenAPI 3.1 document with operation metadata and required path parameters", () => {
    const document = buildOpenApiDocument([contract()], "Accounts API");
    const operation = document.paths["/users/{userId}"].get;

    expect(document.openapi).toBe("3.1.0");
    expect(document.info).toEqual({ title: "Accounts API", version: "1.0.0" });
    expect(operation?.operationId).toBe("get_user");
    expect(operation?.summary).toBe("Get user");
    expect(operation?.description).toBe("Returns a user by ID.");
    expect(operation?.parameters).toEqual([
      { name: "userId", in: "path", required: true, schema: { type: "string" } },
    ]);
    expect(operation?.responses["200"]).toEqual({ description: "Successful response." });
  });

  test("groups different HTTP methods under the same path", () => {
    const document = buildOpenApiDocument([
      contract({ id: "read", method: "GET", title: "Read user" }),
      contract({ id: "update", method: "PATCH", title: "Update user", description: undefined }),
    ], "Accounts API");

    expect(Object.keys(document.paths["/users/{userId}"])).toEqual(["get", "patch"]);
    expect(document.paths["/users/{userId}"].patch?.description).toBeUndefined();
  });

  test("marks deprecated contracts and preserves their status as an extension", () => {
    const document = buildOpenApiDocument([
      contract({ status: "deprecated" }),
    ], "Accounts API");
    const operation = document.paths["/users/{userId}"].get;

    expect(operation?.deprecated).toBe(true);
    expect(operation?.["x-archos-status"]).toBe("deprecated");
  });

  test("creates unique operation IDs when titles normalize to the same value", () => {
    const document = buildOpenApiDocument([
      contract({ id: "one", title: "Get user" }),
      contract({ id: "two", method: "POST", path: "/users", title: "Get user" }),
    ], "Accounts API");

    expect(document.paths["/users/{userId}"].get?.operationId).toBe("get_get_user");
    expect(document.paths["/users"].post?.operationId).toBe("post_get_user");
  });

  test("rejects duplicate contracts for the same method and path", () => {
    expect(() => buildOpenApiDocument([
      contract({ id: "one" }),
      contract({ id: "two" }),
    ], "Accounts API")).toThrow("Duplicate API contract for GET /users/{userId}.");
  });

  test("uses a fallback title for blank project names", () => {
    expect(buildOpenApiDocument([], " ").info.title).toBe("Project API");
  });
});
