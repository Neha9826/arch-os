"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, FolderKanban, Plus, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ensurePersonalWorkspace } from "@/lib/repositories/workspaces";
import { createProject, listProjectsForWorkspace, updateProject } from "@/lib/repositories/projects";
import type { Project } from "@/domain/project/types";

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [fetching, setFetching] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const workspace = await ensurePersonalWorkspace(user.uid);
        const items = await listProjectsForWorkspace(workspace.id, user.uid);
        if (!cancelled) {
          setWorkspaceId(workspace.id);
          setProjects(items);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Projects could not be loaded.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const handleCreate = async () => {
    if (!user || !workspaceId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createProject({ workspaceId, ownerId: user.uid, createdBy: user.uid, name, description });
      const created = await listProjectsForWorkspace(workspaceId, user.uid);
      setProjects(created);
      setName("");
      setDescription("");
      setShowCreate(false);
      router.push(\`/projects/\${id}\`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const archiveProject = async (project: Project) => {
    if (!confirm(\`Archive "\${project.name}"?\`)) return;
    try {
      await updateProject({ projectId: project.id, name: project.name, description: project.description, status: "archived" });
      setProjects((items) => items.map((item) => item.id === project.id ? { ...item, status: "archived" } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project could not be archived.");
    }
  };

  if (loading || fetching) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading projects...</div>;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <button onClick={() => router.push("/")} className="mb-4 text-sm text-slate-500 hover:text-slate-300">← Back to workspace</button>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="mt-2 text-sm text-slate-400">Your engineering workspaces, from planning to infrastructure.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500"><Plus size={16} /> New Project</button>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>}

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 py-24 text-center">
            <FolderKanban size={44} className="mx-auto mb-4 text-slate-600" />
            <p className="font-medium text-slate-300">No projects yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a project before building its engineering system.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">{project.name}</h2>
                    <span className="mt-2 inline-block rounded-md bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">{project.status}</span>
                  </div>
                  {project.status === "active" && <button onClick={() => void archiveProject(project)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-amber-300" title="Archive"><Archive size={16} /></button>}
                </div>
                <p className="mt-4 min-h-10 text-sm text-slate-400">{project.description || "No project description yet."}</p>
                <button onClick={() => router.push(\`/projects/\${project.id}\`)} className="mt-5 flex w-full items-center justify-between border-t border-slate-800 pt-4 text-sm font-medium text-blue-400 hover:text-blue-300">Open project <ArrowRight size={16} /></button>
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold">Create project</h2>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="mt-5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you building?" rows={4} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setShowCreate(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm">Cancel</button>
                <button onClick={() => void handleCreate()} disabled={saving || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? "Creating..." : "Create Project"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
