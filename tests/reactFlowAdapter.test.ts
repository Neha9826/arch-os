import { describe, expect, test } from "vitest";
import {
  architectureIRToReactFlow,
  reactFlowToArchitectureIR,
  type ReactFlowArchitectureState,
} from "@/domain/architecture/reactFlowAdapter";
import type { ArchitectureIR } from "@/domain/architecture/types";

describe("React Flow ↔ Architecture IR adapter", () => {
  test("converts React Flow nodes and edges into Architecture IR", () => {
    const state: ReactFlowArchitectureState = {
      nodes: [
        {
          id: "client-1",
          type: "tech",
          position: { x: 100, y: 200 },
          data: {
            label: "Next.js Client",
            kind: "client",
            technology: "Next.js",
          },
        },
        {
          id: "api-1",
          type: "tech",
          position: { x: 400, y: 200 },
          data: {
            label: "API Service",
            kind: "service",
            technology: "Node.js",
          },
        },
      ],
      edges: [
        {
          id: "client-api",
          source: "client-1",
          target: "api-1",
          animated: true,
          label: "REST",
        },
      ],
    };

    const result = reactFlowToArchitectureIR(state);

    expect(result).toEqual({
      schemaVersion: 1,
      components: [
        {
          id: "client-1",
          kind: "client",
          name: "Next.js Client",
          technology: "Next.js",
        },
        {
          id: "api-1",
          kind: "service",
          name: "API Service",
          technology: "Node.js",
        },
      ],
      relations: [
        {
          id: "client-api",
          source: "client-1",
          target: "api-1",
          kind: "http",
          label: "REST",
        },
      ],
    });
  });

  test("does not infer component kind from the component label", () => {
    const state: ReactFlowArchitectureState = {
      nodes: [
        {
          id: "node-1",
          type: "tech",
          position: { x: 0, y: 0 },
          data: {
            label: "PostgreSQL",
          },
        },
      ],
      edges: [],
    };

    const result = reactFlowToArchitectureIR(state);

    expect(result.components[0]).toEqual({
      id: "node-1",
      kind: "other",
      name: "PostgreSQL",
    });
  });

  test("preserves React Flow layout metadata when converting IR back", () => {
    const architecture: ArchitectureIR = {
      schemaVersion: 1,
      components: [
        {
          id: "client-1",
          kind: "client",
          name: "Web Client",
        },
        {
          id: "api-1",
          kind: "service",
          name: "API",
        },
      ],
      relations: [
        {
          id: "client-api",
          source: "client-1",
          target: "api-1",
          kind: "http",
          label: "REST",
        },
      ],
    };

    const previousState: ReactFlowArchitectureState = {
      nodes: [
        {
          id: "client-1",
          type: "tech",
          position: { x: 125, y: 250 },
          data: { label: "Old Client" },
        },
        {
          id: "api-1",
          type: "tech",
          position: { x: 500, y: 250 },
          data: { label: "Old API" },
        },
      ],
      edges: [
        {
          id: "client-api",
          source: "client-1",
          target: "api-1",
          animated: true,
          style: { strokeWidth: 2 },
        },
      ],
    };

    const result = architectureIRToReactFlow(
      architecture,
      previousState,
    );

    expect(result.nodes).toEqual([
      {
        id: "client-1",
        type: "tech",
        position: { x: 125, y: 250 },
        data: {
          label: "Web Client",
          kind: "client",
        },
      },
      {
        id: "api-1",
        type: "tech",
        position: { x: 500, y: 250 },
        data: {
          label: "API",
          kind: "service",
        },
      },
    ]);

    expect(result.edges).toEqual([
      {
        id: "client-api",
        source: "client-1",
        target: "api-1",
        label: "REST",
        animated: true,
        style: { strokeWidth: 2 },
      },
    ]);
  });

  test("uses safe defaults when converting IR without previous canvas state", () => {
    const architecture: ArchitectureIR = {
      schemaVersion: 1,
      components: [
        {
          id: "service-1",
          kind: "service",
          name: "Orders API",
        },
      ],
      relations: [],
    };

    const result = architectureIRToReactFlow(architecture);

    expect(result.nodes).toEqual([
      {
        id: "service-1",
        type: "tech",
        position: { x: 0, y: 0 },
        data: {
          label: "Orders API",
          kind: "service",
        },
      },
    ]);

    expect(result.edges).toEqual([]);
  });
});