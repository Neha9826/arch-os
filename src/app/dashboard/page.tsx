"use client";

import React, { useEffect, useState, useRef } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plus, Folder, LogOut, ArrowRight, Layers, MoreVertical, Trash2, Edit2 } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserProjects(currentUser.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserProjects = async (uid: string) => {
    try {
      const q = query(collection(db, "projects"), where("ownerId", "==", uid));
      const querySnapshot = await getDocs(q);
      const userProjects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(userProjects);
    } catch (error) {
      try {
        const allDocs = await getDocs(collection(db, "projects"));
        const filtered = allDocs.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(p => p.ownerId === uid);
        setProjects(filtered);
      } catch (fallbackError) {
        console.error("Error fetching projects:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const createNewProject = () => {
    if (!user) return;
    router.push(`/canvas/new`);
  };

  const deleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this architecture?")) return;
    try {
      await deleteDoc(doc(db, "projects", projectId));
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const renameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editingProject.id) return;

    try {
      const docRef = doc(db, "projects", editingProject.id);
      const updatedTitle = newTitle.trim() || "Untitled Architecture";
      
      await updateDoc(docRef, { 
        title: updatedTitle,
        updatedAt: new Date().toISOString()
      });
      
      setProjects(projects.map(p => p.id === editingProject.id ? { ...p, title: updatedTitle } : p));
      setEditingProject(null);
      setNewTitle("");
    } catch (error) {
      console.error("Error renaming project:", error);
      alert("Failed to rename project.");
    }
  };

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-y-auto">
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="text-blue-500" size={24} />
          <h1 className="font-bold text-xl tracking-wide">ArchLog <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full ml-2">Studio OS</span></h1>
        </div>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">{user.displayName}</span>
              <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={login} className="bg-white text-slate-950 font-medium px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors">
              Sign In with Google
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-10 max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Architectures</h2>
            <p className="text-slate-400 text-sm mt-1">Manage, design, and scale your system layouts.</p>
          </div>
          {user && (
            <button 
              onClick={createNewProject}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus size={18} /> New Architecture
            </button>
          )}
        </div>

        {!user ? (
          <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
            <Folder className="mx-auto text-slate-600 mb-4" size={48} />
            <h3 className="text-lg font-medium text-slate-300">Sign in to view your workspaces</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6">Your cloud architectures will appear here once authenticated.</p>
            <button onClick={login} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors">
              Get Started
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-slate-500">Loading your workspaces...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-400 mb-4">No architectures found yet.</p>
            <button onClick={createNewProject} className="text-blue-400 font-medium text-sm hover:underline">
              Create your first architecture layout →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div 
                key={project.id}
                onClick={() => router.push(`/canvas/${project.id}`)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl cursor-pointer transition-all group flex flex-col justify-between h-44 shadow-sm hover:shadow-md relative overflow-visible"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate pr-6">{project.title}</h3>
                    
                    {/* 3-Dot Menu Button */}
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === project.id ? null : project.id);
                        }}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === project.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              setEditingProject(project);
                              setNewTitle(project.title || "Untitled Architecture");
                            }}
                            className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                          >
                            <Edit2 size={12} /> Rename
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => deleteProject(project.id, e)}
                            className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Nodes: {project.nodes?.length || 0}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 text-xs text-slate-400">
                  <span>Open workspace</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform text-blue-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rename Modal */}
        {editingProject && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Rename Architecture</h3>
              <form onSubmit={renameProject}>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 mb-6"
                  placeholder="Enter new title..."
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setEditingProject(null)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}