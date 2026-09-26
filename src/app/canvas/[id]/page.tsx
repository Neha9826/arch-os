"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
  ReactFlowInstance,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import Sidebar from "@/components/Sidebar";
import TechNode from "@/components/TechNode";

import {
  architectureIRToReactFlow,
  reactFlowToArchitectureIR,
} from "@/domain/architecture/reactFlowAdapter";

import { useAuth } from "@/context/AuthContext";
import {
  createArchitecture,
  getArchitecture,
  updateArchitecture,
} from "@/lib/repositories/architectures";
import { getFirestoreErrorCode } from "@/lib/repositories/errors";
import { ensurePersonalWorkspace } from "@/lib/repositories/workspaces";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Share2,
  Check,
  Code,
  Copy,
  Bot,
} from "lucide-react";

const nodeTypes = {
  tech: TechNode,
};

let id = 10;

const getId = () => `${id++}`;

function StudioEditor() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;
  const isNewProject = projectId === "new";

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const defaultNodes = [
    {
      id: "1",
      type: "tech",
      position: { x: 250, y: 150 },
      data: { label: "💻 Client / UI" },
    },
    {
      id: "2",
      type: "tech",
      position: { x: 250, y: 300 },
      data: { label: "⚙️ API Service" },
    },
  ];

  const defaultEdges = [
    {
      id: "e1-2",
      source: "1",
      target: "2",
      animated: true,
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(
    isNewProject ? defaultNodes : [],
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    isNewProject ? defaultEdges : [],
  );

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const [showAIReviewModal, setShowAIReviewModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const { user, loading: authLoading } = useAuth();

  const [projectTitle, setProjectTitle] = useState(
    isNewProject ? "Untitled Architecture" : "Loading Architecture...",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [inputTitle, setInputTitle] = useState("My Architecture");

  const [workspaceId, setWorkspaceId] = useState<string | undefined>();

  const [accessState, setAccessState] = useState<
    "loading" | "ready" | "unauthorized" | "not-found" | "error"
  >("loading");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const isLoadingData = useRef(true);

  useEffect(() => {
    if (isLoadingData.current) return;

    setHasUnsavedChanges(true);
  }, [nodes, edges]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    const loadArchitecture = async () => {
      if (isNewProject) {
        isLoadingData.current = false;
        setAccessState("ready");
        return;
      }

      isLoadingData.current = true;
      setAccessState("loading");

      try {
        const architecture = await getArchitecture(projectId);

        if (cancelled) return;

        if (!architecture) {
          setAccessState("not-found");
          return;
        }

        // Firestore rules are the authorization boundary.
        // This is only a defensive consistency check for malformed
        // or migrated data.
        if (architecture.ownerId !== user.uid) {
          setAccessState("unauthorized");
          return;
        }

        setProjectTitle(architecture.name);
        setInputTitle(architecture.name);
        setWorkspaceId(architecture.workspaceId);

        /*
         * Architecture IR is now the domain boundary.
         *
         * Existing Firestore data is still stored using the current
         * React Flow-compatible shape. We convert it to the canonical
         * IR and then back to React Flow while preserving the existing
         * canvas positions and visual metadata.
         */
        const architectureIR = architecture.architectureIR ??
          reactFlowToArchitectureIR({
            nodes: architecture.nodes,
            edges: architecture.edges,
          });

        const reactFlowState = architectureIRToReactFlow(
          architectureIR,
          {
            nodes: architecture.nodes,
            edges: architecture.edges,
          },
        );

        setNodes(reactFlowState.nodes);
        setEdges(reactFlowState.edges);

        setHasUnsavedChanges(false);
        setAccessState("ready");
      } catch (error) {
        if (cancelled) return;

        console.error("Error loading project:", error);

        setAccessState(
          getFirestoreErrorCode(error) === "permission-denied"
            ? "unauthorized"
            : "error",
        );
      } finally {
        setTimeout(() => {
          if (!cancelled) {
            isLoadingData.current = false;
          }
        }, 300);
      }
    };

    void loadArchitecture();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    isNewProject,
    projectId,
    router,
    setEdges,
    setNodes,
    user,
  ]);

  const handleSaveAction = async (
    titleToSave?: string,
    andExit: boolean = false,
  ) => {
    if (!user || accessState !== "ready") return;

    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    try {
      const finalTitle = titleToSave || projectTitle;

      const workspace = await ensurePersonalWorkspace(user.uid);
      const resolvedWorkspaceId = workspaceId || workspace.id;

      /*
       * Convert the current React Flow state into the canonical
       * Architecture IR before persistence.
       */
      const architectureIR = reactFlowToArchitectureIR({
        nodes,
        edges,
      });

      /*
       * For this milestone the Firestore repository still expects
       * React Flow-compatible nodes and edges.
       *
       * The adapter converts the canonical IR back to that persistence
       * representation while preserving the current canvas metadata.
       */
      const persistenceState = architectureIRToReactFlow(
        architectureIR,
        {
          nodes,
          edges,
        },
      );

      if (isNewProject) {
        const architectureId = await createArchitecture({
          name: finalTitle,
          ownerId: user.uid,
          workspaceId: resolvedWorkspaceId,
          nodes: persistenceState.nodes,
          edges: persistenceState.edges,
          architectureIR,
        });

        setHasUnsavedChanges(false);
        setShowSaveModal(false);

        if (andExit) {
          router.push("/");
        } else {
          router.replace(`/canvas/${architectureId}`);
        }
      } else {
        await updateArchitecture({
          id: projectId,
          name: finalTitle,
          workspaceId: resolvedWorkspaceId,
          nodes: persistenceState.nodes,
          edges: persistenceState.edges,
          architectureIR,
        });

        setProjectTitle(finalTitle);
        setWorkspaceId(resolvedWorkspaceId);
        setHasUnsavedChanges(false);

        if (andExit) {
          router.push("/");
        } else {
          setSaveNotice("Architecture saved.");
        }
      }
    } catch (error) {
      console.error("Error saving:", error);

      if (getFirestoreErrorCode(error) === "permission-denied") {
        setAccessState("unauthorized");
      } else {
        setSaveError(
          "The architecture could not be saved. Please try again.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowExitModal(true);
    } else {
      router.push("/");
    }
  };

  const generateIaC = () => {
    let yaml = `version: '3.8'\n\nservices:\n`;

    nodes.forEach((node) => {
      const label = node.data.label.toLowerCase();

      let serviceName = label
        .replace(/[^a-z0-9]/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");

      if (!serviceName) {
        serviceName = `service_${node.id}`;
      }

      yaml += `  ${serviceName}:\n`;

      if (
        label.includes("client") ||
        label.includes("ui") ||
        label.includes("frontend")
      ) {
        yaml += `    build: ./${serviceName}\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=development\n`;
      } else if (
        label.includes("api") ||
        label.includes("service") ||
        label.includes("backend")
      ) {
        yaml += `    build: ./${serviceName}\n    ports:\n      - "8080:8080"\n    environment:\n      - DB_HOST=database\n`;
      } else if (
        label.includes("database") ||
        label.includes("db") ||
        label.includes("postgres")
      ) {
        yaml += `    image: postgres:15-alpine\n    ports:\n      - "5432:5432"\n    environment:\n      - POSTGRES_USER=admin\n      - POSTGRES_PASSWORD=secret\n    volumes:\n      - ${serviceName}_data:/var/lib/postgresql/data\n`;
      } else if (
        label.includes("redis") ||
        label.includes("cache")
      ) {
        yaml += `    image: redis:alpine\n    ports:\n      - "6379:6379"\n`;
      } else {
        yaml += `    image: alpine:latest\n    command: tail -f /dev/null\n`;
      }

      yaml += `\n`;
    });

    yaml += `volumes:\n`;

    nodes.forEach((node) => {
      const label = node.data.label.toLowerCase();

      if (
        label.includes("database") ||
        label.includes("db") ||
        label.includes("postgres")
      ) {
        const serviceName = label
          .replace(/[^a-z0-9]/g, "_")
          .replace(/^_+|_+$/g, "")
          .replace(/_+/g, "_");

        yaml += `  ${serviceName}_data:\n`;
      }
    });

    setGeneratedCode(yaml);
    setShowExportModal(true);
  };

  const copyGeneratedCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyShareLink = () => {
    if (isNewProject) {
      alert(
        "Please save your architecture first to generate a shareable link!",
      );
      return;
    }

    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateAIReviewPrompt = () => {
    let architectureText = "System Architecture Nodes:\n";

    nodes.forEach((n) => {
      architectureText += `- [Node ID: ${n.id}] ${n.data.label}\n`;
    });

    architectureText += "\nData Flow & Connections:\n";

    edges.forEach((e) => {
      const sourceNode =
        nodes.find((n) => n.id === e.source)?.data.label || e.source;

      const targetNode =
        nodes.find((n) => n.id === e.target)?.data.label || e.target;

      const protocol = e.label ? ` via ${e.label}` : "";

      architectureText += `- ${sourceNode} connects to ${targetNode}${protocol}\n`;
    });

    const masterPrompt = `Please review the following cloud architecture design:

${architectureText}

Your goal is to analyze this system for single points of failure, scaling bottlenecks, and security gaps.

CRITICAL TONE DIRECTIVES:
Act as a supportive, highly collaborative tech lead reviewing a peer's design. You must explain and point out potential improvements gracefully and constructively. Under no circumstances should you use the word "junior" or any other demeaning, arrogant, or condescending labels to describe the design choices. Maintain a respectful, team-oriented tone throughout the analysis.`;

    setAiPrompt(masterPrompt);
    setShowAIReviewModal(true);
  };

  const copyAIPrompt = () => {
    navigator.clipboard.writeText(aiPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      const connectionType = prompt(
        "Enter connection protocol (e.g., REST, GraphQL, gRPC, TCP) or leave blank:",
      );

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            label: connectionType || undefined,
            labelStyle: {
              fill: "#cbd5e1",
              fontWeight: 600,
              fontSize: 12,
            },
            labelBgStyle: {
              fill: "#1e293b",
              fillOpacity: 0.8,
            },
            labelBgPadding: [8, 4],
            labelBgBorderRadius: 4,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
            },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        "application/reactflow/type",
      );

      const label = event.dataTransfer.getData(
        "application/reactflow/label",
      );

      if (
        typeof type === "undefined" ||
        !type ||
        !reactFlowInstance
      ) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  if (authLoading || accessState === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400 gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading architecture...
      </div>
    );
  }

  if (!user) return null;

  if (accessState !== "ready") {
    const isUnauthorized = accessState === "unauthorized";

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-white">
            {isUnauthorized
              ? "Architecture unavailable"
              : "Architecture not found"}
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            {isUnauthorized
              ? "You do not have permission to access this architecture."
              : "This architecture could not be loaded. It may have been deleted."}
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Return to workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col font-sans bg-slate-950 overflow-hidden">
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackClick}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Dashboard
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          <h1 className="text-white font-semibold text-lg tracking-wide flex items-center gap-2">
            {projectTitle}

            {hasUnsavedChanges && (
              <span
                className="w-2 h-2 rounded-full bg-amber-500"
                title="Unsaved changes"
              />
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generateAIReviewPrompt}
            className="text-purple-400 hover:text-purple-300 border border-purple-900/50 hover:bg-purple-950/30 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Bot size={16} /> AI Review
          </button>

          <button
            onClick={generateIaC}
            className="text-emerald-400 hover:text-emerald-300 border border-emerald-900/50 hover:bg-emerald-950/30 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Code size={16} /> Export Code
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          <button
            onClick={copyShareLink}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            {copied ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Share2 size={16} />
            )}
            {copied ? "Copied!" : "Share"}
          </button>

          <button
            onClick={() =>
              isNewProject
                ? setShowSaveModal(true)
                : handleSaveAction()
            }
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Save size={16} />
            {isSaving ? "Saving..." : "Save Canvas"}
          </button>
        </div>
      </header>

      {(saveError || saveNotice) && (
        <div
          className={`px-6 py-2 text-sm ${
            saveError
              ? "bg-red-950/50 text-red-200"
              : "bg-emerald-950/50 text-emerald-200"
          }`}
        >
          {saveError || saveNotice}
        </div>
      )}

      <div className="flex-1 flex w-full h-full overflow-hidden">
        <Sidebar />

        <div
          className="flex-1 h-full relative"
          ref={reactFlowWrapper}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
            className="bg-slate-950"
            nodesDraggable
            nodesConnectable
            elementsSelectable
            deleteKeyCode="Backspace"
          >
            <Background color="#334155" gap={16} />

            <Controls className="bg-slate-800 border-slate-700 fill-white" />

            <Panel
              position="top-right"
              className="bg-slate-800/80 backdrop-blur-md border border-slate-700 text-slate-300 p-4 rounded-lg shadow-xl text-sm max-w-xs pointer-events-none"
            >
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <span>💡</span> Studio Controls
              </h3>

              <ul className="space-y-2">
                <li>
                  <strong className="text-blue-400">
                    Connect:
                  </strong>{" "}
                  Drag a line between the blue dots.
                </li>

                <li>
                  <strong className="text-orange-400">
                    Delete:
                  </strong>{" "}
                  Click a node or line and press{" "}
                  <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-600 text-xs">
                    Backspace
                  </kbd>
                </li>
              </ul>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Code className="text-emerald-400" size={20} />
                Generated docker-compose.yml
              </h3>

              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-4">
              We parsed your visual architecture and generated the
              foundational infrastructure code.
            </p>

            <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-xl border border-slate-800 bg-[#0d1117]">
              <button
                onClick={copyGeneratedCode}
                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg transition-colors z-10 flex items-center gap-2 text-xs font-medium"
              >
                {codeCopied ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
                {codeCopied ? "Copied" : "Copy YAML"}
              </button>

              <pre className="p-6 text-sm text-slate-300 font-mono overflow-auto h-full whitespace-pre-wrap">
                <code>{generatedCode}</code>
              </pre>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              Unsaved Changes
            </h3>

            <p className="text-sm text-slate-400 mb-6">
              You have unsaved changes in your architecture. Do you
              want to save them before leaving, or discard your
              changes?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setShowExitModal(false);
                  router.push("/");
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-slate-800 transition-colors"
              >
                Discard Changes
              </button>

              <button
                onClick={() => {
                  setShowExitModal(false);

                  if (isNewProject) {
                    setShowSaveModal(true);
                  } else {
                    handleSaveAction(undefined, true);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Save & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Name Your Architecture
            </h3>

            <input
              type="text"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 mb-6"
              placeholder="e.g. E-Commerce Microservices"
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  handleSaveAction(inputTitle, showExitModal)
                }
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Save to Cloud
              </button>
            </div>
          </div>
        </div>
      )}

      {showAIReviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Bot className="text-purple-400" size={20} />
                AI Architecture Review
              </h3>

              <button
                onClick={() => setShowAIReviewModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-4">
              Copy this strictly engineered prompt into ChatGPT,
              Claude, or your copilot. It contains your exact canvas
              structure and instructions forcing the AI to provide a
              supportive, constructive review without any
              condescending tone.
            </p>

            <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-xl border border-slate-800 bg-[#0d1117]">
              <button
                onClick={copyAIPrompt}
                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg transition-colors z-10 flex items-center gap-2 text-xs font-medium"
              >
                {promptCopied ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
                {promptCopied ? "Copied" : "Copy Prompt"}
              </button>

              <pre className="p-6 text-sm text-slate-300 font-mono overflow-auto h-full whitespace-pre-wrap">
                <code>{aiPrompt}</code>
              </pre>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAIReviewModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <StudioEditor />
    </ReactFlowProvider>
  );
}