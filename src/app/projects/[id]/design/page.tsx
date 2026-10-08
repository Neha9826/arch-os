"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, Palette, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  createProjectDesignDecision,
  deleteProjectEngineeringRecord,
  getProject,
  listProjectDesignDecisions,
  updateProjectDesignDecision,
  updateProjectDesignDecisionStatus,
  updateProjectSectionStatus,
} from "@/lib/repositories/projects";
import { createDefaultProjectSections } from "@/domain/project/validation";
import type { Project, ProjectDesignDecision, ProjectDesignDecisionStatus, ProjectSectionStatus } from "@/domain/project/types";

const STATUSES: ProjectDesignDecisionStatus[] = ["proposed", "accepted", "superseded"];
const statusLabel: Record<ProjectDesignDecisionStatus, string> = { proposed: "Proposed", accepted: "Accepted", superseded: "Superseded" };
const sectionLabel: Record<ProjectSectionStatus, string> = { "not-started": "Not started", "in-progress": "In progress", complete: "Complete" };

export default function ProjectDesignPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ProjectDesignDecision[]>([]);
  const [sectionStatus, setSectionStatus] = useState<ProjectSectionStatus>("not-started");
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDecision, setEditDecision] = useState("");
  const [editRationale, setEditRationale] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = async () => {
      try {
        const current = await getProject(projectId);
        if (!current || current.ownerId !== user.uid || current.status !== "active") throw new Error("Project is unavailable or archived.");
        const decisions = await listProjectDesignDecisions(projectId, user.uid);
        if (cancelled) return;
        setProject(current);
        setSectionStatus(current.sections?.design ?? "not-started");
        setItems(decisions);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Design workspace could not be loaded.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [projectId, user]);

  const counts = useMemo(() => ({
    total: items.length,
    proposed: items.filter((item) => item.status === "proposed").length,
    accepted: items.filter((item) => item.status === "accepted").length,
    superseded: items.filter((item) => item.status === "superseded").length,
  }), [items]);

  const addDecision = async () => {
    if (!user || !project || saving || !title.trim() || !decision.trim()) return;
    setSaving(true); setError(null);
    try {
      const id = await createProjectDesignDecision({ projectId: project.id, ownerId: user.uid, title, decision, rationale });
      setItems((current) => [...current, { id, projectId: project.id, ownerId: user.uid, title: title.trim(), decision: decision.trim(), rationale: rationale.trim(), status: "proposed" }]);
      setTitle(""); setDecision(""); setRationale("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Design decision could not be created.");
    } finally { setSaving(false); }
  };

  const changeSectionStatus = async (status: ProjectSectionStatus) => {
    if (!user || !project || savingStatus) return;
    setSavingStatus(true); setError(null);
    try {
      await updateProjectSectionStatus({ projectId: project.id, ownerId: user.uid, section: "design", status });
      setSectionStatus(status);
      setProject((current) => current ? { ...current, sections: { ...createDefaultProjectSections(), ...(current.sections ?? {}), design: status } } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section status could not be updated.");
    } finally { setSavingStatus(false); }
  };

  const startEdit = (item: ProjectDesignDecision) => {
    setEditingId(item.id); setEditTitle(item.title); setEditDecision(item.decision); setEditRationale(item.rationale); setError(null);
  };

  const saveEdit = async (item: ProjectDesignDecision) => {
    if (!user || !editTitle.trim() || !editDecision.trim()) return;
    setSaving(true); setError(null);
    try {
      await updateProjectDesignDecision({ projectId, decisionId: item.id, ownerId: user.uid, title: editTitle, decision: editDecision, rationale: editRationale });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, title: editTitle.trim(), decision: editDecision.trim(), rationale: editRationale.trim() } : entry));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Design decision could not be updated.");
    } finally { setSaving(false); }
  };

  const changeDecisionStatus = async (item: ProjectDesignDecision, status: ProjectDesignDecisionStatus) => {
    if (!user) return;
    try {
      await updateProjectDesignDecisionStatus({ projectId, decisionId: item.id, ownerId: user.uid, status });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Design decision status could not be updated.");
    }
  };

  const removeDecision = async (item: ProjectDesignDecision) => {
    if (!user || !window.confirm(`Delete design decision "${item.title}"?`)) return;
    try {
      await deleteProjectEngineeringRecord({ projectId, recordId: item.id, ownerId: user.uid, collectionName: "designDecisions" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Design decision could not be deleted.");
    }
  };

  if (loading || fetching) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading design workspace...</div>;
  if (!user) return null;
  if (!project) return <main className="min-h-screen bg-slate-950 p-8 text-red-200">{error ?? "Project could not be loaded."}</main>;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => router.push(`/projects/${project.id}`)} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"><ArrowLeft size={16} /> {project.name}</button>
        <header className="border-b border-slate-800 pb-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><div className="flex items-center gap-3"><Palette className="text-blue-400" size={22} /><div><p className="text-xs uppercase tracking-wider text-blue-400">Engineering section</p><h1 className="mt-1 text-3xl font-bold">Design</h1></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">Capture design decisions, the chosen direction, and the reasoning behind it.</p></div>
            <select value={sectionStatus} disabled={savingStatus} onChange={(event) => void changeSectionStatus(event.target.value as ProjectSectionStatus)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs">{(Object.keys(sectionLabel) as ProjectSectionStatus[]).map((status) => <option key={status} value={status}>{sectionLabel[status]}</option>)}</select>
          </div>
        </header>

        {error ? <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-4">
          {[["Decisions", counts.total], ["Proposed", counts.proposed], ["Accepted", counts.accepted], ["Superseded", counts.superseded]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs uppercase tracking-wider text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Record a design decision</h2>
          <p className="mt-1 text-sm text-slate-500">Keep the decision and its rationale together.</p>
          <div className="mt-5 space-y-4">
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Decision title" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <textarea value={decision} onChange={(event) => setDecision(event.target.value)} maxLength={5000} rows={4} placeholder="What design direction was chosen?" className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={5000} rows={4} placeholder="Why was this direction chosen?" className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <button type="button" onClick={() => void addDecision()} disabled={saving || !title.trim() || !decision.trim()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Plus size={16} /> {saving ? "Saving..." : "Add decision"}</button>
        </section>

        <section className="mt-8 space-y-4">
          <div><h2 className="text-lg font-semibold">Decision register</h2><p className="mt-1 text-xs text-slate-500">Project-owned design decisions.</p></div>
          {items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">No design decisions yet.</div> : items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              {editingId === item.id ? (
                <div className="space-y-4">
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
                  <textarea value={editDecision} onChange={(event) => setEditDecision(event.target.value)} maxLength={5000} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
                  <textarea value={editRationale} onChange={(event) => setEditRationale(event.target.value)} maxLength={5000} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
                  <div className="flex gap-2"><button type="button" disabled={saving || !editTitle.trim() || !editDecision.trim()} onClick={() => void saveEdit(item)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save"}</button><button type="button" disabled={saving} onClick={() => setEditingId(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Cancel</button></div>
                </div>
              ) : (
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-medium uppercase text-slate-400">{statusLabel[item.status]}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.decision}</p><div className="mt-4 border-l border-slate-700 pl-4"><p className="text-[10px] uppercase tracking-wider text-slate-600">Rationale</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-500">{item.rationale || "No rationale provided."}</p></div></div>
                  <div className="flex shrink-0 flex-wrap gap-2"><select value={item.status} onChange={(event) => void changeDecisionStatus(item, event.target.value as ProjectDesignDecisionStatus)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">{STATUSES.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select><button type="button" onClick={() => startEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs"><Edit3 size={13} /> Edit</button><button type="button" onClick={() => void removeDecision(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-900/70 px-3 py-2 text-xs text-red-300"><Trash2 size={13} /> Delete</button></div>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
