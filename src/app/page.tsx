'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import {
  deleteArchitecture,
  listArchitecturesForOwner,
  renameArchitecture,
} from '@/lib/repositories/architectures';
import { getFirestoreErrorCode } from '@/lib/repositories/errors';
import { ensurePersonalWorkspace } from '@/lib/repositories/workspaces';
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Search, 
  FolderKanban, 
  BookTemplate, 
  Settings, 
  LogOut, 
  Cpu, 
  ChevronRight,
  User as UserIcon
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  updatedAt?: unknown;
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('projects');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      try {
        setWorkspaceError(null);
        await ensurePersonalWorkspace(user.uid);
        const architectures = await listArchitecturesForOwner(user.uid);
        setProjects(architectures);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setWorkspaceError(
          getFirestoreErrorCode(error) === 'permission-denied'
            ? 'You do not have permission to access this workspace.'
            : 'Your workspace could not be loaded. Please try again.',
        );
      } finally {
        setFetching(false);
      }
    };
    fetchProjects();
  }, [user]);

  const createNewProject = () => {
    router.push('/canvas/new');
  };

  const deleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this architecture?')) return;
    
    try {
      await deleteArchitecture(id);
      setProjects((currentProjects) => currentProjects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
      setWorkspaceError(
        getFirestoreErrorCode(error) === 'permission-denied'
          ? 'You do not have permission to delete this architecture.'
          : 'The architecture could not be deleted. Please try again.',
      );
    }
  };

  const renameProject = async (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    const newName = prompt('Enter new architecture name:', currentName);
    if (!newName || newName === currentName) return;
    
    try {
      await renameArchitecture(id, newName);
      setProjects((currentProjects) => currentProjects.map((project) =>
        project.id === id ? { ...project, name: newName } : project,
      ));
    } catch (error) {
      console.error('Error renaming project:', error);
      setWorkspaceError(
        getFirestoreErrorCode(error) === 'permission-denied'
          ? 'You do not have permission to rename this architecture.'
          : 'The architecture could not be renamed. Please try again.',
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || (fetching && user)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400 gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading workspace...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/30">
            <Cpu size={20} />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">arch-os</span>
          <span className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full ml-2">Enterprise Workspace</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            {user.photoURL ? (
              <Image src={user.photoURL} alt="Avatar" width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-semibold text-xs">
                <UserIcon size={14} />
              </div>
            )}
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-slate-200 leading-none">{user.displayName || 'Developer'}</p>
              <p className="text-[10px] text-slate-500 leading-none mt-1">{user.email}</p>
            </div>
          </div>

          <button 
            onClick={handleSignOut}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Operations Sidebar */}
        <aside className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 hidden md:flex flex-col shrink-0">
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'projects' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FolderKanban size={18} /> Projects
            </button>
            <button 
              onClick={() => setActiveTab('templates')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'templates' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <BookTemplate size={18} /> Templates
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Settings size={18} /> Settings
            </button>
          </div>

          <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-900/30">
            <p className="text-sm font-semibold text-slate-200">
              A product by <span className="text-blue-400">Dev Engine AI</span>
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Engineering better systems, from idea to infrastructure.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-slate-950 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Architectures</h1>
                <p className="text-sm text-slate-400 mt-1">Manage, review, and export your distributed system designs.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search architectures..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <button 
                  onClick={createNewProject}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 shrink-0"
                >
                  <Plus size={16} /> New Canvas
                </button>
              </div>
            </div>

            {/* Content Switcher */}
            {activeTab !== 'projects' ? (
              <div className="text-center py-32 bg-slate-900/40 rounded-2xl border border-slate-800/80">
                <p className="text-slate-400 font-medium">Coming soon in the next release pipeline.</p>
              </div>
            ) : workspaceError ? (
              <div className="text-center py-20 bg-red-950/20 rounded-2xl border border-red-900/60">
                <h3 className="text-red-200 font-semibold mb-2">Workspace unavailable</h3>
                <p className="text-sm text-red-300/80">{workspaceError}</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-28 bg-slate-900/30 rounded-2xl border border-slate-800/80 border-dashed">
                <FolderKanban size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-slate-300 font-semibold mb-1">No architectures found</h3>
                <p className="text-slate-500 text-sm mb-6">Create your first cloud infrastructure map to get started.</p>
                <button 
                  onClick={createNewProject}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Create Canvas
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <div 
                    key={project.id} 
                    onClick={() => router.push(`/canvas/${project.id}`)}
                    className="group bg-slate-900 hover:bg-slate-800/80 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 shadow-xl cursor-pointer transition-all flex flex-col justify-between h-48 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div>
                      <div className="flex justify-between items-start pr-12">
                        <h2 className="text-base font-semibold text-white tracking-wide truncate" title={project.name}>
                          {project.name}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 font-mono">ID: {project.id.slice(0, 8)}...</p>
                    </div>

                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => renameProject(e, project.id, project.name)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                        title="Rename"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={(e) => deleteProject(e, project.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs font-medium text-blue-400 group-hover:text-blue-300">
                      <span>Launch Studio</span>
                      <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
