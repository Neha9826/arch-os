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
import { lintArchitecture, type ArchitectureLintResult } from "@/domain/architecture/lint";
import { diffArchitectures, formatRelationDescription } from "@/domain/architecture/diff";

import { useAuth } from "@/context/AuthContext";
import {
  createArchitecture,
  getArchitecture,
  updateArchitecture,
} from "@/lib/repositories/architectures";
import { getFirestoreErrorCode } from "@/lib/repositories/errors";
import { ensurePersonalWorkspace } from "@/lib/repositories/workspaces";
import {
  createArchitectureSnapshot,
  listArchitectureSnapshots,
  updateArchitectureSnapshot,
  deleteArchitectureSnapshot,
  type ArchitectureSnapshot,
} from "@/lib/repositories/architectureSnapshots";
import {
  createArchitectureBranch,
  listArchitectureBranches,
  updateArchitectureBranch,
} from "@/lib/repositories/architectureBranches";
import type { ArchitectureBranch } from "@/domain/architecture/branches";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Share2,
  Check,
  Code,
  Copy,
  Bot,
  ShieldCheck,
  AlertTriangle,
  Info,
  History,
  Camera,
  Eye,
  GitCompareArrows,
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
  const [showLintModal, setShowLintModal] = useState(false);
  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [snapshots, setSnapshots] = useState<ArchitectureSnapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ArchitectureSnapshot | null>(null);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingSnapshotName, setEditingSnapshotName] = useState("");
  const [editingSnapshotMessage, setEditingSnapshotMessage] = useState("");
  const [snapshotActionId, setSnapshotActionId] = useState<string | null>(null);
  const [compareBeforeId, setCompareBeforeId] = useState("");
  const [compareAfterId, setCompareAfterId] = useState("");
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [branchSourceSnapshot, setBranchSourceSnapshot] = useState<ArchitectureSnapshot | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchDescription, setBranchDescription] = useState("");
  const [branchCreating, setBranchCreating] = useState(false);
  const [branches, setBranches] = useState<ArchitectureBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [lintResult, setLintResult] = useState<ArchitectureLintResult | null>(null);
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

  const selectedSnapshotLayout = selectedSnapshot
    ? architectureIRToReactFlow(selectedSnapshot.architectureIR, selectedSnapshot.canvasLayout)
    : null;

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
        const canvasLayout = architecture.canvasLayout ?? {
          nodes: architecture.nodes,
          edges: architecture.edges,
        };

        const architectureIR = architecture.architectureIR ??
          reactFlowToArchitectureIR(canvasLayout);

        const reactFlowState = architectureIRToReactFlow(
          architectureIR,
          canvasLayout,
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
          canvasLayout: persistenceState,
          architectureIR,
        });

        setHasUnsavedChanges(false);
        setShowSaveModal(false);

        if (andExit) {
          router.push("/");
        } else {
          router.replace(`/canvas/${architectureId}`);
        }
      } else if (selectedBranchId) {
        const activeBranch = branches.find((item) => item.id === selectedBranchId);

        if (!activeBranch) {
          throw new Error("The selected branch is no longer available.");
        }

        if (activeBranch.status !== "active") {
          setSaveError(`This branch is ${activeBranch.status} and cannot be edited.`);
          return;
        }

        await updateArchitectureBranch({
          architectureId: projectId,
          branchId: selectedBranchId,
          name: activeBranch.name,
          description: activeBranch.description,
          status: activeBranch.status,
          architectureIR,
          canvasLayout: persistenceState,
        });

        setBranches((current) =>
          current.map((item) =>
            item.id === selectedBranchId
              ? {
                  ...item,
                  architectureIR,
                  canvasLayout: persistenceState,
                }
              : item,
          ),
        );
        setHasUnsavedChanges(false);
        setSaveNotice(`Branch saved: ${activeBranch.name}`);

        if (andExit) {
          router.push("/");
        }
      } else {
        await updateArchitecture({
          id: projectId,
          name: finalTitle,
          workspaceId: resolvedWorkspaceId,
          nodes: persistenceState.nodes,
          edges: persistenceState.edges,
          canvasLayout: persistenceState,
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

  const handleBranchSelectionChange = async (branchId: string) => {
    if (branchId === selectedBranchId) return;

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Switching architecture branches will discard them. Continue?",
      );
      if (!confirmed) return;
    }

    setSaveError(null);
    setSaveNotice(null);
    setSelectedSnapshot(null);
    setBranchSourceSnapshot(null);
    isLoadingData.current = true;

    try {
      if (!branchId) {
        const architecture = await getArchitecture(projectId);
        if (!architecture || !user || architecture.ownerId !== user.uid) {
          throw new Error("Architecture not found or access denied.");
        }

        const canvasLayout = architecture.canvasLayout ?? {
          nodes: architecture.nodes,
          edges: architecture.edges,
        };
        const architectureIR = architecture.architectureIR ??
          reactFlowToArchitectureIR(canvasLayout);
        const reactFlowState = architectureIRToReactFlow(
          architectureIR,
          canvasLayout,
        );

        setNodes(reactFlowState.nodes);
        setEdges(reactFlowState.edges);
        setWorkspaceId(architecture.workspaceId);
        setProjectTitle(architecture.name);
        setInputTitle(architecture.name);
        setSelectedBranchId("");
        setHasUnsavedChanges(false);
        setSaveNotice("Switched to main architecture.");
        return;
      }

      const branchToLoad = branches.find((item) => item.id === branchId);
      if (!branchToLoad) {
        throw new Error("The selected branch could not be found.");
      }

      const reactFlowState = architectureIRToReactFlow(
        branchToLoad.architectureIR,
        branchToLoad.canvasLayout,
      );

      setNodes(reactFlowState.nodes);
      setEdges(reactFlowState.edges);
      setSelectedBranchId(branchId);
      setHasUnsavedChanges(false);
      setSaveNotice(`Switched to branch: ${branchToLoad.name}`);
    } catch (error) {
      console.error("Error switching branch:", error);
      setSaveError(
        getFirestoreErrorCode(error) === "permission-denied"
          ? "Permission denied. This branch could not be loaded."
          : error instanceof Error
            ? error.message
            : "Could not switch branches. Please try again.",
      );
    } finally {
      setTimeout(() => {
        isLoadingData.current = false;
      }, 0);
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

  const loadBranches = async () => {
    if (isNewProject) return;

    setBranchesLoading(true);
    try {
      const items = await listArchitectureBranches(projectId);
      setBranches(items);
      setSelectedBranchId((current) =>
        items.some((item) => item.id === current) ? current : "",
      );
    } catch (error) {
      console.error("Error loading branches:", error);
      setSnapshotError("Could not load branches. Check your connection and try again.");
    } finally {
      setBranchesLoading(false);
    }
  };

  const openSnapshots = async () => {
    if (isNewProject) {
      setSaveError("Save this architecture before creating a snapshot.");
      return;
    }

    setShowSnapshotsModal(true);
    setSnapshotsLoading(true);
    setSnapshotError(null);

    try {
      const [items] = await Promise.all([
        listArchitectureSnapshots(projectId),
        loadBranches(),
      ]);
      setSnapshots(items);
      setCompareBeforeId((current) => items.some((item) => item.id === current) ? current : (items[1]?.id ?? items[0]?.id ?? ""));
      setCompareAfterId((current) => items.some((item) => item.id === current) ? current : (items[0]?.id ?? ""));
    } catch (error) {
      console.error("Error loading snapshots:", error);
      setSnapshotError("Could not load snapshots. Check your connection and try again.");
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!user || isNewProject || snapshotSaving) return;

    const name = snapshotName.trim();
    if (!name) {
      setSnapshotError("Enter a name for this snapshot.");
      return;
    }

    setSnapshotSaving(true);
    setSnapshotError(null);

    try {
      const workspace = await ensurePersonalWorkspace(user.uid);
      const resolvedWorkspaceId = workspaceId || workspace.id;
      const architectureIR = reactFlowToArchitectureIR({ nodes, edges });
      const canvasLayout = architectureIRToReactFlow(architectureIR, { nodes, edges });

      // Persist the current editor state first, so the snapshot matches the canvas.
      await updateArchitecture({
        id: projectId,
        name: projectTitle,
        workspaceId: resolvedWorkspaceId,
        nodes: canvasLayout.nodes,
        edges: canvasLayout.edges,
        canvasLayout,
        architectureIR,
      });

      const snapshotId = await createArchitectureSnapshot({
        architectureId: projectId,
        workspaceId: resolvedWorkspaceId,
        ownerId: user.uid,
        createdBy: user.uid,
        name,
        message: snapshotMessage,
        architectureIR,
        canvasLayout,
      });

      setWorkspaceId(resolvedWorkspaceId);
      setHasUnsavedChanges(false);
      setSaveNotice("Architecture snapshot created.");
      setSnapshotName("");
      setSnapshotMessage("");
      const items = await listArchitectureSnapshots(projectId);
      setSnapshots(items);
      if (!items.some((item) => item.id === snapshotId)) {
        setSnapshotError("Snapshot was created, but the refreshed list did not include it. Reopen snapshots to refresh.");
      }
    } catch (error) {
      console.error("Error creating snapshot:", error);
      setSnapshotError(
        getFirestoreErrorCode(error) === "permission-denied"
          ? "Permission denied. Save the architecture and confirm you own its workspace."
          : "Could not create snapshot. Your current architecture may have been saved; please retry.",
      );
    } finally {
      setSnapshotSaving(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!user || isNewProject || !branchSourceSnapshot || branchCreating) return;

    const name = branchName.trim();
    if (!name) {
      setSnapshotError("Enter a name for this branch.");
      return;
    }

    setBranchCreating(true);
    setSnapshotError(null);

    try {
      const workspace = await ensurePersonalWorkspace(user.uid);
      const resolvedWorkspaceId = workspaceId || workspace.id;

      const sourceSnapshot = branchSourceSnapshot;

      await createArchitectureBranch({
        architectureId: projectId,
        workspaceId: resolvedWorkspaceId,
        ownerId: user.uid,
        createdBy: user.uid,
        name,
        description: branchDescription,
        baseSnapshotId: sourceSnapshot.id,
        architectureIR: sourceSnapshot.architectureIR,
        canvasLayout: sourceSnapshot.canvasLayout,
      });

      await loadBranches();
      setBranchSourceSnapshot(null);
      setBranchName("");
      setBranchDescription("");
      setSaveNotice("Branch created successfully.");
    } catch (error) {
      console.error("Error creating branch:", error);
      setSnapshotError(
        getFirestoreErrorCode(error) === "permission-denied"
          ? "Permission denied. Save the architecture and confirm you own its workspace."
          : "Could not create this branch. Please try again.",
      );
    } finally {
      setBranchCreating(false);
    }
  };

  const handleEditSnapshot = async (snapshot: ArchitectureSnapshot) => {
    if (snapshotActionId) return;
    const name = editingSnapshotName.trim();
    if (!name) {
      setSnapshotError("Snapshot name cannot be empty.");
      return;
    }

    setSnapshotActionId(snapshot.id);
    setSnapshotError(null);
    try {
      await updateArchitectureSnapshot(projectId, snapshot.id, {
        name,
        message: editingSnapshotMessage,
      });
      setSnapshots((current) => current.map((item) =>
        item.id === snapshot.id
          ? { ...item, name, message: editingSnapshotMessage.trim() || undefined }
          : item
      ));
      setEditingSnapshotId(null);
    } catch (error) {
      console.error("Error updating snapshot:", error);
      setSnapshotError(
        getFirestoreErrorCode(error) === "permission-denied"
          ? "Permission denied. This snapshot could not be edited."
          : "Could not edit this snapshot. Please try again.",
      );
    } finally {
      setSnapshotActionId(null);
    }
  };

  const handleDeleteSnapshot = async (snapshot: ArchitectureSnapshot) => {
    if (snapshotActionId) return;
    if (!window.confirm(`Delete snapshot "${snapshot.name}"? This cannot be undone.`)) return;

    setSnapshotActionId(snapshot.id);
    setSnapshotError(null);
    try {
      await deleteArchitectureSnapshot(projectId, snapshot.id);
      setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
      if (selectedSnapshot?.id === snapshot.id) setSelectedSnapshot(null);
      if (editingSnapshotId === snapshot.id) setEditingSnapshotId(null);
    } catch (error) {
      console.error("Error deleting snapshot:", error);
      setSnapshotError(
        getFirestoreErrorCode(error) === "permission-denied"
          ? "Permission denied. This snapshot could not be deleted."
          : "Could not delete this snapshot. Please try again.",
      );
    } finally {
      setSnapshotActionId(null);
    }
  };

  const handleRestoreSnapshot = async (snapshot: ArchitectureSnapshot) => {
    if (!user || isNewProject || restoringSnapshotId) return;

    const confirmed = window.confirm(
      `Restore "${snapshot.name}"? Your current canvas will first be saved as a safety snapshot.`,
    );
    if (!confirmed) return;

    setRestoringSnapshotId(snapshot.id);
    setSnapshotError(null);

    try {
      const currentIR = reactFlowToArchitectureIR({ nodes, edges });
      const currentLayout = architectureIRToReactFlow(currentIR, { nodes, edges });
      const architecture = await getArchitecture(projectId);
      if (!architecture || architecture.ownerId !== user.uid) {
        throw new Error("Architecture not found or access denied.");
      }
      const resolvedWorkspaceId = architecture.workspaceId || workspaceId || (await ensurePersonalWorkspace(user.uid)).id;

      // Preserve the current state before replacing it with the selected snapshot.
      await createArchitectureSnapshot({
        architectureId: projectId,
        workspaceId: resolvedWorkspaceId,
        ownerId: user.uid,
        createdBy: user.uid,
        name: `Before restore — ${new Date().toLocaleString()}`,
        message: `Automatic safety snapshot before restoring "${snapshot.name}".`,
        architectureIR: currentIR,
        canvasLayout: currentLayout,
      });

      const restoredLayout = architectureIRToReactFlow(
        snapshot.architectureIR,
        snapshot.canvasLayout,
      );

      await updateArchitecture({
        id: projectId,
        name: projectTitle,
        workspaceId: resolvedWorkspaceId,
        nodes: restoredLayout.nodes,
        edges: restoredLayout.edges,
        canvasLayout: restoredLayout,
        architectureIR: snapshot.architectureIR,
      });

      isLoadingData.current = true;
      setNodes(restoredLayout.nodes);
      setEdges(restoredLayout.edges);
      setWorkspaceId(resolvedWorkspaceId);
      setHasUnsavedChanges(false);
      setSaveNotice(`Restored snapshot: ${snapshot.name}`);
      setSelectedSnapshot(null);
      setShowSnapshotsModal(false);
      setTimeout(() => {
        isLoadingData.current = false;
      }, 0);

      const refreshedSnapshots = await listArchitectureSnapshots(projectId);
      setSnapshots(refreshedSnapshots);
    } catch (error) {
      console.error("Error restoring snapshot:", error);
      setSnapshotError(
        getFirestoreErrorCode(error) === "permission-denied"
          ? "Permission denied. The snapshot could not be restored."
          : error instanceof Error ? error.message : "Could not restore this snapshot. Please try again.",
      );
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const runArchitectureLint = () => {
    const architectureIR = reactFlowToArchitectureIR({ nodes, edges });
    setLintResult(lintArchitecture(architectureIR));
    setShowLintModal(true);
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

            {selectedBranchId && (() => {
              const activeBranch = branches.find((item) => item.id === selectedBranchId);
              return activeBranch ? (
                <span className="rounded-md border border-violet-800/60 bg-violet-950/50 px-2 py-1 text-xs font-medium text-violet-200">
                  Branch: {activeBranch.name}
                </span>
              ) : null;
            })()}

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
            onClick={() => void openSnapshots()}
            className="text-cyan-300 hover:text-cyan-200 border border-cyan-900/50 hover:bg-cyan-950/30 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <History size={16} /> Snapshots
          </button>

          <button
            onClick={runArchitectureLint}
            className="text-amber-300 hover:text-amber-200 border border-amber-900/50 hover:bg-amber-950/30 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <ShieldCheck size={16} /> Architecture Lint
          </button>

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

      {showSnapshotsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <History className="text-cyan-300" size={20} /> Architecture Snapshots
              </h3>
              <button onClick={() => setShowSnapshotsModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 mb-5">
              <h4 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <Camera size={16} className="text-cyan-300" /> Create immutable snapshot
              </h4>
              {selectedBranchId && (
                <p className="mb-3 rounded-lg border border-violet-900/50 bg-violet-950/20 px-3 py-2 text-xs text-violet-200">
                  Snapshot creation and restore operate on the main architecture. Switch to Main architecture to use them.
                </p>
              )}
              <label className="block text-xs text-slate-400 mb-1">Snapshot name</label>
              <input
                value={snapshotName}
                onChange={(event) => setSnapshotName(event.target.value)}
                maxLength={100}
                placeholder="e.g. Before database migration"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 mb-3"
              />
              <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
              <textarea
                value={snapshotMessage}
                onChange={(event) => setSnapshotMessage(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="What changed or why this version matters"
                className="w-full resize-y bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 mb-3"
              />
              {snapshotError && <p className="text-sm text-red-300 mb-3">{snapshotError}</p>}
              <div className="flex justify-end">
                <button
                  onClick={() => void handleCreateSnapshot()}
                  disabled={selectedBranchId !== "" || snapshotSaving || !snapshotName.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {snapshotSaving ? "Creating..." : "Create Snapshot"}
                </button>
              </div>
            </div>

            {snapshots.length >= 2 && (
              <div className="mb-5 rounded-xl border border-violet-900/50 bg-violet-950/20 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <GitCompareArrows size={16} className="text-violet-300" /> Compare snapshots
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-400">
                    Base version
                    <select value={compareBeforeId} onChange={(event) => setCompareBeforeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                      {snapshots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-400">
                    Compare with
                    <select value={compareAfterId} onChange={(event) => setCompareAfterId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                      {snapshots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                </div>
                {(() => {
                  const before = snapshots.find((item) => item.id === compareBeforeId);
                  const after = snapshots.find((item) => item.id === compareAfterId);
                  if (!before || !after) return <p className="mt-3 text-sm text-slate-400">Choose two snapshots to compare.</p>;
                  if (before.id === after.id) return <p className="mt-3 text-sm text-amber-200">Choose two different snapshots.</p>;
                  const diff = diffArchitectures(before.architectureIR, after.architectureIR);
                  const total = diff.components.length + diff.relations.length;
                  const renderChanges = (
                    title: string,
                    changes: Array<{
                      status: "added" | "removed" | "modified";
                      id: string;
                      before?: ArchitectureSnapshot["architectureIR"]["components"][number] | ArchitectureSnapshot["architectureIR"]["relations"][number];
                      after?: ArchitectureSnapshot["architectureIR"]["components"][number] | ArchitectureSnapshot["architectureIR"]["relations"][number];
                      changedFields: string[];
                    }>,
                    noun: string,
                  ) => (
                    <div className="mt-4">
                      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h5>
                      {changes.length === 0 ? (
                        <p className="text-sm text-slate-500">No {noun} changes.</p>
                      ) : (
                        <div className="space-y-2">
                          {changes.map((change) => {
                            const item = change.after ?? change.before;
                            const isRelation = item !== undefined && "source" in item;
                            const displayName = isRelation
                              ? change.status === "modified" && change.before && change.after && "source" in change.before && "source" in change.after
                                ? `${formatRelationDescription(change.before, before.architectureIR)} → ${formatRelationDescription(change.after, after.architectureIR)}`
                                : formatRelationDescription(
                                    item as ArchitectureSnapshot["architectureIR"]["relations"][number],
                                    change.status === "removed" ? before.architectureIR : after.architectureIR,
                                  )
                              : item && "name" in item ? item.name : change.id;
                            const statusStyle = change.status === "added"
                              ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200"
                              : change.status === "removed"
                                ? "border-red-900/60 bg-red-950/30 text-red-200"
                                : "border-amber-900/60 bg-amber-950/30 text-amber-200";
                            return (
                              <div key={change.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                                <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${statusStyle}`}>{change.status}</span>
                                <span className="text-sm text-slate-100">{displayName}</span>
                                {change.changedFields.length > 0 && <span className="text-xs text-slate-400">Changed: {change.changedFields.join(", ")}</span>}
                                {change.status === "modified" && change.before && change.after && (
                                  <span className="basis-full text-xs text-slate-400">
                                    {change.changedFields.map((field) => {
                                      const oldValue = (change.before as unknown as Record<string, unknown>)[field];
                                      const newValue = (change.after as unknown as Record<string, unknown>)[field];
                                      const formatValue = (value: unknown, architecture: ArchitectureSnapshot["architectureIR"]) => {
                                        if (isRelation && (field === "source" || field === "target") && typeof value === "string") {
                                          return architecture.components.find((component) => component.id === value)?.name ?? value;
                                        }
                                        return String(value ?? "—");
                                      };
                                      return `${field}: ${formatValue(oldValue, before.architectureIR)} → ${formatValue(newValue, after.architectureIR)}`;
                                    }).join(" · ")}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <p className="text-xs text-slate-400">Comparing <span className="text-slate-200">{before.name}</span> → <span className="text-slate-200">{after.name}</span></p>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {[
                          ["Components +", diff.summary.componentsAdded],
                          ["Components −", diff.summary.componentsRemoved],
                          ["Components ~", diff.summary.componentsModified],
                          ["Relations +", diff.summary.relationsAdded],
                          ["Relations −", diff.summary.relationsRemoved],
                          ["Relations ~", diff.summary.relationsModified],
                        ].map(([label, count]) => (
                          <div key={label} className="rounded-lg bg-slate-900 p-2 text-center">
                            <p className="text-lg font-semibold text-slate-100">{count}</p>
                            <p className="text-[10px] text-slate-400">{label}</p>
                          </div>
                        ))}
                      </div>
                      {total === 0 ? <p className="mt-4 text-sm text-emerald-200">No semantic architecture changes between these snapshots.</p> : (
                        <>
                          {renderChanges("Component changes", diff.components, "component")}
                          {renderChanges("Connection changes", diff.relations, "connection")}
                        </>
                      )}
                      <p className="mt-3 text-xs text-slate-500">This comparison covers architecture components and connections. Canvas position and styling changes are excluded.</p>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mb-5 rounded-xl border border-violet-900/50 bg-violet-950/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">Architecture branches</h4>
                  <p className="mt-1 text-xs text-slate-400">Saved working lines created from architecture snapshots.</p>
                </div>
                <span className="rounded-md bg-violet-950/70 px-2 py-1 text-xs text-violet-200">
                  {branches.length} {branches.length === 1 ? "branch" : "branches"}
                </span>
              </div>

              {branchesLoading ? (
                <p className="py-3 text-sm text-slate-400">Loading branches…</p>
              ) : branches.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                  No branches yet. Create one from a saved snapshot.
                </p>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-slate-400">
                    Branch switcher
                    <select
                      value={selectedBranchId}
                      onChange={(event) => void handleBranchSelectionChange(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">Main architecture</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} · {branch.status}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedBranchId && (() => {
                    const branch = branches.find((item) => item.id === selectedBranchId);
                    if (!branch) return null;
                    const baseSnapshot = snapshots.find((item) => item.id === branch.baseSnapshotId);
                    return (
                      <div className="rounded-lg border border-violet-900/50 bg-slate-950/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-100">{branch.name}</p>
                            {branch.description && <p className="mt-1 text-xs text-slate-400">{branch.description}</p>}
                            <p className="mt-2 text-xs text-slate-500">
                              Based on: <span className="text-slate-300">{baseSnapshot?.name ?? branch.baseSnapshotId}</span>
                            </p>
                          </div>
                          <span className="rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-1 text-[11px] font-medium capitalize text-violet-200">
                            {branch.status}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Changes are saved only to this branch. The main architecture remains unchanged.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-200">Saved snapshots</h4>
              {snapshotsLoading ? (
                <p className="text-sm text-slate-400 py-4">Loading snapshots…</p>
              ) : snapshots.length === 0 ? (
                <p className="text-sm text-slate-400 rounded-xl border border-dashed border-slate-700 p-4">No snapshots yet. Create one to preserve this version.</p>
              ) : snapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  {editingSnapshotId === snapshot.id ? (
                    <div className="space-y-3">
                      <label className="block text-xs text-slate-400">Snapshot name</label>
                      <input value={editingSnapshotName} onChange={(event) => setEditingSnapshotName(event.target.value)} maxLength={100} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
                      <label className="block text-xs text-slate-400">Note</label>
                      <textarea value={editingSnapshotMessage} onChange={(event) => setEditingSnapshotMessage(event.target.value)} maxLength={500} rows={2} className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingSnapshotId(null)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200">Cancel</button>
                        <button onClick={() => void handleEditSnapshot(snapshot)} disabled={snapshotActionId !== null} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{snapshotActionId === snapshot.id ? "Saving..." : "Save details"}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-100">{snapshot.name}</p>
                        {snapshot.message && <p className="mt-1 text-sm text-slate-400">{snapshot.message}</p>}
                        <p className="mt-2 text-xs text-slate-500">Snapshot ID: {snapshot.id}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-md bg-cyan-950/60 px-2 py-1 text-xs text-cyan-200">Saved version</span>
                        <button onClick={() => { setSelectedSnapshot(snapshot); setSnapshotError(null); }} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"><Eye size={14} /> Preview</button>
                        <button onClick={() => void handleRestoreSnapshot(snapshot)} disabled={selectedBranchId !== "" || restoringSnapshotId !== null || snapshotSaving || snapshotActionId !== null} className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-50">{restoringSnapshotId === snapshot.id ? "Restoring..." : "Restore"}</button>
                        <button
                          onClick={() => {
                            setBranchSourceSnapshot(snapshot);
                            setBranchName(snapshot.name + " branch");
                            setBranchDescription("");
                            setSnapshotError(null);
                          }}
                          disabled={snapshotActionId !== null || restoringSnapshotId !== null}
                          className="rounded-lg border border-violet-700/60 bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
                        >
                          Create Branch
                        </button>
                        <button onClick={() => { setEditingSnapshotId(snapshot.id); setEditingSnapshotName(snapshot.name); setEditingSnapshotMessage(snapshot.message ?? ""); setSnapshotError(null); }} disabled={snapshotActionId !== null} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">Edit</button>
                        <button onClick={() => void handleDeleteSnapshot(snapshot)} disabled={snapshotActionId !== null || restoringSnapshotId !== null} className="rounded-lg border border-red-900/70 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50">{snapshotActionId === snapshot.id ? "Working..." : "Delete"}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-5">
              <button onClick={() => setShowSnapshotsModal(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {branchSourceSnapshot && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-violet-900/60 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Create Architecture Branch</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Starting from <span className="text-violet-200">{branchSourceSnapshot.name}</span>.
                </p>
              </div>
              <button
                onClick={() => setBranchSourceSnapshot(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
              The branch starts exactly from this saved snapshot. Your current architecture and canvas will not be changed.
            </div>

            <label className="mb-1 block text-xs text-slate-400">Branch name</label>
            <input
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              maxLength={100}
              autoFocus
              placeholder="e.g. add-caching"
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none"
            />

            <label className="mb-1 block text-xs text-slate-400">Description (optional)</label>
            <textarea
              value={branchDescription}
              onChange={(event) => setBranchDescription(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What are you exploring on this branch?"
              className="mb-4 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none"
            />

            {snapshotError && (
              <p className="mb-4 text-sm text-red-300">{snapshotError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBranchSourceSnapshot(null)}
                disabled={branchCreating}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateBranch()}
                disabled={branchCreating || !branchName.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {branchCreating ? "Creating..." : "Create Branch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSnapshot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-100">Snapshot preview: {selectedSnapshot.name}</h3>
                <p className="mt-1 text-xs text-slate-400">Read-only view · Your current architecture is unchanged until you restore.</p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            {snapshotError && (
              <p className="shrink-0 border-b border-red-900/60 bg-red-950/40 px-5 py-3 text-sm text-red-200">{snapshotError}</p>
            )}
            <div className="relative min-h-[360px] w-full flex-none bg-slate-950" style={{ height: "65vh", width: "100%" }}>
              {selectedSnapshotLayout && selectedSnapshotLayout.nodes.length > 0 ? (
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={selectedSnapshotLayout.nodes}
                    edges={selectedSnapshotLayout.edges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.25, minZoom: 0.25, maxZoom: 1.5 }}
                    onInit={(instance) => {
                      requestAnimationFrame(() => {
                        instance.fitView({ padding: 0.25, minZoom: 0.25, maxZoom: 1.5 });
                      });
                    }}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    panOnDrag
                    zoomOnScroll
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#334155" gap={20} />
                    <Controls className="bg-slate-800 border-slate-700 fill-white" />
                  </ReactFlow>
                </ReactFlowProvider>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
                  This snapshot contains no components to preview.
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-800 px-5 py-4">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRestoreSnapshot(selectedSnapshot)}
                disabled={selectedBranchId !== "" || restoringSnapshotId !== null || snapshotSaving}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {restoringSnapshotId === selectedSnapshot.id ? "Restoring..." : "Restore this version"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLintModal && lintResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="text-amber-300" size={20} />
                Architecture Lint
              </h3>
              <button onClick={() => setShowLintModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
            </div>
            <div className="flex gap-3 mb-5 text-sm">
              <span className="rounded-lg bg-red-950/50 text-red-200 px-3 py-2">{lintResult.summary.errors} errors</span>
              <span className="rounded-lg bg-amber-950/50 text-amber-200 px-3 py-2">{lintResult.summary.warnings} warnings</span>
              <span className="rounded-lg bg-blue-950/50 text-blue-200 px-3 py-2">{lintResult.summary.info} info</span>
            </div>
            <div className="overflow-y-auto space-y-3 pr-1">
              {lintResult.findings.length === 0 ? (
                <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5 text-emerald-200">
                  No findings. The current architecture passed the available structural checks.
                </div>
              ) : lintResult.findings.map((finding, index) => (
                <div key={finding.code + (finding.componentId ?? finding.relationId ?? index)} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start gap-3">
                    {finding.severity === "error" ? <AlertTriangle className="mt-0.5 text-red-300" size={18} /> : finding.severity === "warning" ? <AlertTriangle className="mt-0.5 text-amber-300" size={18} /> : <Info className="mt-0.5 text-blue-300" size={18} />}
                    <div>
                      <p className="font-medium text-slate-100">{finding.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{finding.message}</p>
                      <p className="mt-2 text-sm text-slate-400">{finding.recommendation}</p>
                      <p className="mt-2 text-xs text-slate-500">Rule: {finding.code}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowLintModal(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">Close</button>
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