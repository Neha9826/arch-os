"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Map, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  createProjectMilestone,
  deleteProjectEngineeringRecord,
  updateProjectMilestone,
  getProject,
  listProjectMilestones,
  updateProjectMilestoneStatus,
  updateProjectSectionStatus,
} from "@/lib/repositories/projects";
import { createDefaultProjectSections } from "@/domain/project/validation";
import type { Project, ProjectMilestone, ProjectMilestoneStatus, ProjectSectionStatus } from "@/domain/project/types";

const STATUSES: ProjectMilestoneStatus[] = ["planned", "in-progress", "done"];

export default function ProjectRoadmapPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [sectionStatus, setSectionStatus] = useState<ProjectSectionStatus>("not-started");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingTargetDate, setEditingTargetDate] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    const current = await getProject(projectId);
    if (!current || current.ownerId !== user.uid || current.status !== "active") {
      throw new Error("Project is unavailable or archived.");
    }
    setProject(current);
    setSectionStatus(current.sections?.roadmap ?? "not-started");
    setMilestones(await listProjectMilestones(projectId, user.uid));
  }, [projectId, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void load().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Roadmap workspace could not be loaded.");
    }).finally(() => {
      if (!cancelled) setFetching(false);
    });
    return () => { cancelled = true; };
  }, [load, user]);

  const counts = useMemo(() => ({
    total: milestones.length,
    planned: milestones.filter((item) => item.status === "planned").length,
    active: milestones.filter((item) => item.status === "in-progress").length,
    done: milestones.filter((item) => item.status === "done").length,
  }), [milestones]);

  const addMilestone = async () => {
    if (!user || !project || saving || !title.trim()) return;
    setSaving(true); setError(null);
    try {
      await createProjectMilestone({ projectId: project.id, ownerId: user.uid, title, description, targetDate });
      setTitle(""); setDescription(""); setTargetDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Milestone could not be created.");
    } finally { setSaving(false); }
  };

  const changeStatus = async (status: ProjectSectionStatus) => {
    if (!user || !project || savingStatus) return;
    setSavingStatus(true); setError(null);
    try {
      await updateProjectSectionStatus({ projectId: project.id, ownerId: user.uid, section: "roadmap", status });
      setSectionStatus(status);
      setProject((current) => current ? { ...current, sections: { ...createDefaultProjectSections(), ...(current.sections ?? {}), roadmap: status } } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section status could not be updated.");
    } finally { setSavingStatus(false); }
  };

  const startEditing = (item: ProjectMilestone) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingDescription(item.description ?? "");
    setEditingTargetDate(item.targetDate ?? "");
    setError(null);
  };

  const saveEdit = async (item: ProjectMilestone) => {
    if (!user || !editingTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateProjectMilestone({
        projectId,
        milestoneId: item.id,
        ownerId: user.uid,
        title: editingTitle,
        description: editingDescription,
        targetDate: editingTargetDate,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Milestone could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const changeMilestoneStatus = async (item: ProjectMilestone, status: ProjectMilestoneStatus) => {
    if (!user) return;
    try {
      await updateProjectMilestoneStatus({ projectId, milestoneId: item.id, ownerId: user.uid, status });
      setMilestones((items) => items.map((current) => current.id === item.id ? { ...current, status } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Milestone status could not be updated.");
    }
  };

  const removeMilestone = async (item: ProjectMilestone) => {
    if (!user || !window.confirm(`Delete milestone "${item.title}"?`)) return;
    try {
      await deleteProjectEngineeringRecord({ projectId, recordId: item.id, ownerId: user.uid, collectionName: "roadmap" });
      setMilestones((items) => items.filter((current) => current.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Milestone could not be deleted.");
    }
  };

  if (loading || fetching) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading roadmap workspace...</div>;
  if (!user) return null;
  if (!project) return <main className="min-h-screen bg-slate-950 p-8 text-red-200">{error ?? "Project could not be loaded."}</main>;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => router.push(`/projects/${project.id}`)} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"><ArrowLeft size={16} /> {project.name}</button>
        <header className="border-b border-slate-800 pb-8">
          <div className="flex items-end justify-between gap-6">
            <div><div className="flex items-center gap-3"><Map className="text-blue-400" size={22} /><div><p className="text-xs uppercase tracking-wider text-blue-400">Engineering section</p><h1 className="mt-1 text-3xl font-bold">Roadmap</h1></div></div><p className="mt-4 max-w-3xl text-sm text-slate-400">Turn project intent into sequenced delivery milestones, separate from implementation tasks.</p></div>
            <select value={sectionStatus} disabled={savingStatus} onChange={(e) => void changeStatus(e.target.value as ProjectSectionStatus)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs"><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option></select>
          </div>
        </header>

        {error ? <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-4">{[["Milestones", counts.total], ["Planned", counts.planned], ["In progress", counts.active], ["Completed", counts.done]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs uppercase tracking-wider text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Add milestone</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Milestone title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder="Describe the milestone outcome." className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          <button type="button" onClick={() => void addMilestone()} disabled={saving || !title.trim()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Plus size={16} /> {saving ? "Creating..." : "Add milestone"}</button>
        </section>

        <section className="mt-8 space-y-4">
          <div><h2 className="text-lg font-semibold">Milestone register</h2><p className="mt-1 text-xs text-slate-500">Project-owned roadmap checkpoints.</p></div>
          {milestones.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">No milestones yet.</div> : milestones.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              {editingId === item.id ? (
                <div className="space-y-4">
                  <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
                  <textarea value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
                  <input type="date" value={editingTargetDate} onChange={(e) => setEditingTargetDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" disabled={saving || !editingTitle.trim()} onClick={() => void saveEdit(item)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                    <button type="button" disabled={saving} onClick={() => setEditingId(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div><h3 className="font-semibold">{item.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{item.description || "No description provided."}</p>{item.targetDate ? <p className="mt-3 text-xs text-slate-600">Target: {item.targetDate}</p> : null}</div>
                <div className="flex flex-wrap gap-2">
                  <select value={item.status} onChange={(e) => void changeMilestoneStatus(item, e.target.value as ProjectMilestoneStatus)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">{STATUSES.map((status) => <option key={status} value={status}>{status === "in-progress" ? "In progress" : status[0].toUpperCase() + status.slice(1)}</option>)}</select>
                  <button type="button" onClick={() => startEditing(item)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Edit</button><button type="button" onClick={() => void removeMilestone(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-900/70 px-3 py-2 text-xs text-red-300"><Trash2 size={13} /> Delete</button>
                </div>
              </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
