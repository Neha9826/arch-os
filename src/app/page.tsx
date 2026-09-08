"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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

// --- FIREBASE IMPORTS ---
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const nodeTypes = {
  tech: TechNode,
};

const initialNodes = [
  { id: "1", type: "tech", position: { x: 250, y: 100 }, data: { label: "💻 React Client" } },
  { id: "2", type: "tech", position: { x: 250, y: 250 }, data: { label: "⚙️ API Gateway" } },
  { id: "3", type: "tech", position: { x: 250, y: 400 }, data: { label: "🗄️ Firestore DB" } },
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
];

let id = 4;
const getId = () => `${id++}`;

function FlowEditor() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // --- AUTH & CLOUD STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Listen for user login/logout
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadArchitecture(currentUser.uid); // Load their saved work immediately!
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setNodes(initialNodes); // Reset canvas on logout
    setEdges(initialEdges);
  };

  // Push Canvas JSON to Firestore
  const saveArchitecture = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "architectures", user.uid);
      await setDoc(docRef, {
        nodes,
        edges,
        updatedAt: new Date().toISOString()
      });
      alert("Architecture saved successfully to the cloud! 🚀");
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save architecture.");
    } finally {
      setIsSaving(false);
    }
  };

  // Pull Canvas JSON from Firestore
  const loadArchitecture = async (uid: string) => {
    try {
      const docRef = doc(db, "architectures", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
        
        // Prevent ID collisions for new dragged nodes
        if (data.nodes.length > 0) {
            const maxId = Math.max(...data.nodes.map((n: any) => parseInt(n.id) || 0));
            id = maxId + 1;
        }
      }
    } catch (error) {
      console.error("Error loading:", error);
    }
  };

  // --- DRAG & DROP HANDLERS ---
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
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
    [reactFlowInstance, setNodes]
  );

  return (
    <div className="w-screen h-screen flex flex-col font-sans bg-slate-950 overflow-hidden">
      
      {/* CLOUD-CONNECTED HEADER */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10 shrink-0">
        <h1 className="text-white font-bold text-xl tracking-wide flex items-center gap-2">
          ArchLog 
          <span className="text-slate-500 font-normal text-sm border-l border-slate-700 pl-2 ml-1">
            Studio Workspace
          </span>
        </h1>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-slate-400 text-sm hidden md:block">Hi, {user.displayName}</span>
              <button 
                onClick={saveArchitecture}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Cloud State"}
              </button>
              <button 
                onClick={logout}
                className="text-slate-400 hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-slate-700 hover:bg-slate-800"
              >
                Logout
              </button>
            </>
          ) : (
            <button 
              onClick={login}
              className="bg-white hover:bg-slate-200 text-slate-900 px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
            >
              Login to Save
            </button>
          )}
        </div>
      </header>

      {/* CANVAS WORKSPACE */}
      <div className="flex-1 flex w-full h-full overflow-hidden">
        <Sidebar />
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
          >
            <Background color="#334155" gap={16} />
            <Controls className="bg-slate-800 border-slate-700 fill-white" />
            
            <Panel position="top-right" className="bg-slate-800/80 backdrop-blur-md border border-slate-700 text-slate-300 p-4 rounded-lg shadow-xl text-sm max-w-xs pointer-events-none">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <span>💡</span> Studio Controls
              </h3>
              <ul className="space-y-2">
                <li><strong className="text-blue-400">Connect:</strong> Drag a line between the blue dots.</li>
                <li><strong className="text-orange-400">Delete:</strong> Click a node or line and press <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-600 text-xs">Backspace</kbd></li>
                <li><strong className="text-green-400">Pan:</strong> Click and drag the empty grid space.</li>
              </ul>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function ArchitectureStudio() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}