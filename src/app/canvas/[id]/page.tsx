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

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Share2, Check, Code, Copy, Eye } from "lucide-react";

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
    { id: "1", type: "tech", position: { x: 250, y: 150 }, data: { label: "💻 Client / UI" } },
    { id: "2", type: "tech", position: { x: 250, y: 300 }, data: { label: "⚙️ API Service" } }
  ];
  const defaultEdges = [{ id: "e1-2", source: "1", target: "2", animated: true }];

  const [nodes, setNodes, onNodesChange] = useNodesState(isNewProject ? defaultNodes : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(isNewProject ? defaultEdges : []);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [projectTitle, setProjectTitle] = useState(isNewProject ? "Untitled Architecture" : "Loading Architecture...");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [inputTitle, setInputTitle] = useState("My Architecture");

  const [isReadOnly, setIsReadOnly] = useState(false);
  const isLoadingData = useRef(true);

  useEffect(() => {
    if (isLoadingData.current || isReadOnly) return;
    setHasUnsavedChanges(true);
  }, [nodes, edges, isReadOnly]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!isNewProject && projectId) {
        isLoadingData.current = true; 
        try {
          const docRef = doc(db, "projects", projectId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProjectTitle(data.title || "Untitled Architecture");
            setInputTitle(data.title || "Untitled Architecture");
            if (data.nodes) setNodes(data.nodes);
            if (data.edges) setEdges(data.edges);

            if (data.nodes && data.nodes.length > 0) {
              const maxId = Math.max(...data.nodes.map((n: any) => parseInt(n.id) || 0));
              id = maxId + 1;
            }

            if (data.ownerId !== currentUser?.uid) {
              setIsReadOnly(true);
            } else {
              setIsReadOnly(false);
            }

            setHasUnsavedChanges(false);
          } else {
            setProjectTitle("Project not found");
            setIsReadOnly(true);
          }
        } catch (error) {
          console.error("Error loading project:", error);
          setProjectTitle("Error loading project");
          setIsReadOnly(true);
        } finally {
          setTimeout(() => {
            isLoadingData.current = false;
          }, 300);
        }
      } else {
        isLoadingData.current = false; 
        setIsReadOnly(false);
      }
    });
    return () => unsubscribe();
  }, [projectId, isNewProject, setNodes, setEdges]);

  const handleSaveAction = async (titleToSave?: string, andExit: boolean = false) => {
    if (!user || isReadOnly) return;

    setIsSaving(true);
    try {
      const finalTitle = titleToSave || projectTitle;

      if (isNewProject) {
        const docRef = await addDoc(collection(db, "projects"), {
          title: finalTitle,
          ownerId: user.uid,
          nodes,
          edges,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setHasUnsavedChanges(false);
        setShowSaveModal(false);
        setIsSaving(false);

        if (andExit) {
          router.push("/");
        } else {
          router.replace(`/canvas/${docRef.id}`);
        }
      } else {
        const docRef = doc(db, "projects", projectId);
        await updateDoc(docRef, {
          title: finalTitle,
          nodes,
          edges,
          updatedAt: new Date().toISOString(),
        });
        setProjectTitle(finalTitle);
        setHasUnsavedChanges(false);
        setIsSaving(false);

        if (andExit) {
          router.push("/");
        } else {
          alert("Architecture saved successfully!");
        }
      }
    } catch (error) {
      console.error("Error saving:", error);
      setIsSaving(false);
      alert("Failed to save architecture.");
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges && !isReadOnly) {
      setShowExitModal(true);
    } else {
      router.push("/");
    }
  };

  const generateIaC = () => {
    let yaml = `version: '3.8'\n\nservices:\n`;
    nodes.forEach(node => {
      const label = node.data.label.toLowerCase();
      let serviceName = label.replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
      if (!serviceName) serviceName = `service_${node.id}`;

      yaml += `  ${serviceName}:\n`;
      if (label.includes('client') || label.includes('ui') || label.includes('frontend')) {
        yaml += `    build: ./${serviceName}\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=development\n`;
      } else if (label.includes('api') || label.includes('service') || label.includes('backend')) {
        yaml += `    build: ./${serviceName}\n    ports:\n      - "8080:8080"\n    environment:\n      - DB_HOST=database\n`;
      } else if (label.includes('database') || label.includes('db') || label.includes('postgres')) {
        yaml += `    image: postgres:15-alpine\n    ports:\n      - "5432:5432"\n    environment:\n      - POSTGRES_USER=admin\n      - POSTGRES_PASSWORD=secret\n    volumes:\n      - ${serviceName}_data:/var/lib/postgresql/data\n`;
      } else if (label.includes('redis') || label.includes('cache')) {
        yaml += `    image: redis:alpine\n    ports:\n      - "6379:6379"\n`;
      } else {
        yaml += `    image: alpine:latest\n    command: tail -f /dev/null\n`;
      }
      yaml += `\n`;
    });

    yaml += `volumes:\n`;
    nodes.forEach(node => {
      const label = node.data.label.toLowerCase();
      if (label.includes('database') || label.includes('db') || label.includes('postgres')) {
        const serviceName = label.replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
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
      alert("Please save your architecture first to generate a shareable link!");
      return;
    }
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      if (isReadOnly) return;
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges, isReadOnly]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (isReadOnly) return;
      
      const type = event.dataTransfer.getData("application/reactflow/type");
      const label = event.dataTransfer.getData("application/reactflow/label");

      if (typeof type === "undefined" || !type || !reactFlowInstance) return;

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
    [reactFlowInstance, setNodes, isReadOnly]
  );

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
            {hasUnsavedChanges && !isReadOnly && <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />}
            {isReadOnly && (
              <span className="flex items-center gap-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-md ml-2 font-medium">
                <Eye size={12} /> View Only
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={generateIaC}
            className="text-emerald-400 hover:text-emerald-300 border border-emerald-900/50 hover:bg-emerald-950/30 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Code size={16} /> Export Code
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {!isReadOnly && (
            <>
              <button 
                onClick={copyShareLink}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
                {copied ? "Copied!" : "Share"}
              </button>

              <button 
                onClick={() => isNewProject ? setShowSaveModal(true) : handleSaveAction()}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? "Saving..." : "Save Canvas"}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex w-full h-full overflow-hidden">
        {!isReadOnly && <Sidebar />}
        
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
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
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable={!isReadOnly}
            deleteKeyCode={isReadOnly ? null : 'Backspace'}
          >
            <Background color="#334155" gap={16} />
            <Controls className="bg-slate-800 border-slate-700 fill-white" />
            
            {!isReadOnly && (
              <Panel position="top-right" className="bg-slate-800/80 backdrop-blur-md border border-slate-700 text-slate-300 p-4 rounded-lg shadow-xl text-sm max-w-xs pointer-events-none">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span>💡</span> Studio Controls
                </h3>
                <ul className="space-y-2">
                  <li><strong className="text-blue-400">Connect:</strong> Drag a line between the blue dots.</li>
                  <li><strong className="text-orange-400">Delete:</strong> Click a node or line and press <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-600 text-xs">Backspace</kbd></li>
                </ul>
              </Panel>
            )}
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
              We parsed your visual architecture and generated the foundational infrastructure code. 
            </p>

            <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-xl border border-slate-800 bg-[#0d1117]">
              <button 
                onClick={copyGeneratedCode}
                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg transition-colors z-10 flex items-center gap-2 text-xs font-medium"
              >
                {codeCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
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
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-slate-400 mb-6">You have unsaved changes in your architecture. Do you want to save them before leaving, or discard your changes?</p>
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
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Name Your Architecture</h3>
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
                onClick={() => handleSaveAction(inputTitle, showExitModal)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Save to Cloud
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