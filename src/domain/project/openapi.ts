import type { ProjectApiContract, ProjectApiMethod } from "./types";

type OpenApiParameter = {
  name: string;
  in: "path";
  required: true;
  schema: { type: "string" };
};

type OpenApiOperation = {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  deprecated?: boolean;
  "x-archos-status": ProjectApiContract["status"];
  parameters?: OpenApiParameter[];
  responses: Record<string, { description: string }>;
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: { title: string; version: "1.0.0" };
  paths: Record<string, Record<string, OpenApiOperation>>;
};

const HTTP_METHODS: Record<ProjectApiMethod, string> = {
  GET: "get",
  POST: "post",
  PUT: "put",
  PATCH: "patch",
  DELETE: "delete",
};

function toOperationId(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || "operation";
}

function getPathParameters(path: string): OpenApiParameter[] {
  if (path.includes("?") || path.includes("#")) {
    throw new Error(`Invalid OpenAPI path "${path}": query strings and fragments are not allowed.`);
  }

  const names = Array.from(path.matchAll(/\{([^{}]+)\}/g), (match) => match[1]);
  const pathWithoutParameters = path.replace(/\{[^{}]+\}/g, "");
  if (/[{}]/.test(pathWithoutParameters) || names.some((name) => !/^[A-Za-z0-9_.-]+$/.test(name))) {
    throw new Error(`Invalid OpenAPI path parameter syntax in "${path}".`);
  }

  return [...new Set(names)].map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

export function buildOpenApiDocument(
  contracts: ProjectApiContract[],
  projectName: string,
): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  const usedOperationIds = new Set<string>();

  for (const contract of contracts) {
    const method = HTTP_METHODS[contract.method];
    const pathItem = paths[contract.path] ?? {};
    if (pathItem[method]) {
      throw new Error(`Duplicate API contract for ${contract.method} ${contract.path}.`);
    }

    const baseId = toOperationId(contract.title);
    let operationId = baseId;
    let suffix = 2;
    while (usedOperationIds.has(operationId)) {
      operationId = `${baseId}_${suffix++}`;
    }
    usedOperationIds.add(operationId);

    const pathParameters = getPathParameters(contract.path);
    const operation: OpenApiOperation = {
      operationId,
      summary: contract.title.trim(),
      ...(contract.description?.trim() ? { description: contract.description.trim() } : {}),
      tags: ["API"],
      "x-archos-status": contract.status,
      ...(contract.status === "deprecated" ? { deprecated: true } : {}),
      ...(pathParameters.length > 0 ? { parameters: pathParameters } : {}),
      responses: {
        [contract.method === "POST" ? "201" : contract.method === "DELETE" ? "204" : "200"]: {
          description: contract.method === "DELETE" ? "Resource deleted." : "Successful response.",
        },
      },
    };

    paths[contract.path] = { ...pathItem, [method]: operation };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: projectName.trim() || "Project API",
      version: "1.0.0",
    },
    paths,
  };
}
