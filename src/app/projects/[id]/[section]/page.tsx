"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, CheckCircle2, Circle, Clock3, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createProjectApiContract, createProjectDatabaseEntity, createProjectDesignDecision, createProjectMilestone, createProjectRequirement, getProject, listProjectApiContracts, listProjectDatabaseEntities, listProjectDesignDecisions, listProjectMilestones, listProjectRequirements, updateProjectApiContractStatus, updateProjectDatabaseEntityStatus, updateProjectDesignDecisionStatus, updateProjectMilestoneStatus, updateProjectPlanning, updateProjectRequirementStatus, updateProjectSectionStatus } from "@/lib/repositories/projects";
import { listArchitecturesForProject, type Architecture } from "@/lib/repositories/architectures";
import { PROJECT_SECTION_KEYS, type Project, type ProjectPlanning, type ProjectRequirement, type ProjectRequirementPriority, type ProjectDesignDecision, type ProjectApiContract, type ProjectApiMethod, type ProjectApiStatus, type ProjectDatabaseEntity, type ProjectDatabaseEntityStatus, type ProjectDesignDecisionStatus, ProjectMilestone, type ProjectMilestoneStatus, type ProjectSectionKey, type ProjectSectionStatus } from "@/domain/project/types";
import { createDefaultProjectSections } from "@/domain/project/validation";

const META: Record<ProjectSectionKey, { label: string; description: string }> = {
  planning: { label: "Planning", description: "Goals, scope and project direction." },
  requirements: { label: "Requirements", description: "Functional and technical requirements." },
  roadmap: { label: "Roadmap", description: "Milestones, sequencing and delivery." },
  design: { label: "Design", description: "UX, UI and design system work." },
  architecture: { label: "Architecture", description: "System topology and architecture decisions." },
  api: { label: "API", description: "Contracts, endpoints and integrations." },
  database: { label: "Database", description: "Data models, schemas and storage." },
  infrastructure: { label: "Infrastructure", description: "Cloud, environments and deployment." },
  code: { label: "Code", description: "Implementation and engineering work." },
  testing: { label: "Testing", description: "Quality, verification and test coverage." },
  documentation: { label: "Documentation", description: "Technical docs and project knowledge." },
};

const STATUS: Record<ProjectSectionStatus, { label: string; icon: typeof Circle }> = {
  "not-started": { label: "Not started", icon: Circle },
  "in-progress": { label: "In progress", icon: Clock3 },
  complete: { label: "Complete", icon: CheckCircle2 },
};

export default function ProjectSectionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const section = PROJECT_SECTION_KEYS.find((key) => key === params.section) as ProjectSectionKey | undefined;
  const [project, setProject] = useState<Project | null>(null);
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState<ProjectPlanning>({ objective: "", scope: "", constraints: "", successCriteria: "" });
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [requirements, setRequirements] = useState<ProjectRequirement[]>([]);
  const [newRequirement, setNewRequirement] = useState({ title: "", description: "", priority: "medium" as ProjectRequirementPriority });
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", targetDate: "" });
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [designDecisions, setDesignDecisions] = useState<ProjectDesignDecision[]>([]);
  const [newDesignDecision, setNewDesignDecision] = useState({ title: "", decision: "", rationale: "" });
  const [savingDesignDecision, setSavingDesignDecision] = useState(false);
  const [apiContracts, setApiContracts] = useState<ProjectApiContract[]>([]);
  const [newApiContract, setNewApiContract] = useState({ method: "GET" as ProjectApiMethod, path: "", title: "", description: "" });
  const [savingApiContract, setSavingApiContract] = useState(false);
  const [databaseEntities, setDatabaseEntities] = useState<ProjectDatabaseEntity[]>([]);
  const [newDatabaseEntity, setNewDatabaseEntity] = useState({ name: "", purpose: "" });
  const [savingDatabaseEntity, setSavingDatabaseEntity] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !section) return;
    let cancelled = false;
    const load = async () => {
      setBusy(true);
      try {
        const current = await getProject(projectId);
        if (!current || current.ownerId !== user.uid || current.status !== "active") {
          throw new Error("Project is unavailable or archived.");
        }
        const items = section === "architecture"
          ? await listArchitecturesForProject(projectId, user.uid)
          : [];
        if (!cancelled) {
          setProject(current);
          setArchitectures(items);
        }
        if (section === "database") {
          const entityItems = await listProjectDatabaseEntities(projectId, user.uid);
          if (!cancelled) setDatabaseEntities(entityItems);
        }
        if (section === "api") {
          const contractItems = await listProjectApiContracts(projectId, user.uid);
          if (!cancelled) setApiContracts(contractItems);
        }
        if (section === "design") {
          const decisionItems = await listProjectDesignDecisions(projectId, user.uid);
          if (!cancelled) setDesignDecisions(decisionItems);
        }
        if (section === "roadmap") {
          const milestoneItems = await listProjectMilestones(projectId, user.uid);
          if (!cancelled) setMilestones(milestoneItems);
        }
        if (section === "requirements") {
          const requirementItems = await listProjectRequirements(projectId, user.uid);
          if (!cancelled) setRequirements(requirementItems);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Section could not be loaded.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId, user, section]);

  const currentStatus = project?.sections?.[section ?? "planning"] ?? "not-started";
  const StatusIcon = STATUS[currentStatus].icon;

  const changeStatus = async (next: ProjectSectionStatus) => {
    if (!user || !project || !section || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProjectSectionStatus({ projectId: project.id, ownerId: user.uid, section, status: next });
      setProject((current) => {
        if (!current) return current;
        const sections = createDefaultProjectSections();
        Object.assign(sections, current.sections ?? {});
        sections[section] = next;
        return { ...current, sections };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section status could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || busy) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading section...</div>;
  if (!user) return null;

  if (!section) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
        <div className="mx-auto max-w-5xl">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="mr-2 inline" size={15} /> Project
          </button>
          <div className="mt-8 rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-red-200">Unknown engineering section.</div>
        </div>
      </main>
    );
  }

  const meta = META[section];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300">
          <ArrowLeft size={16} /> {project?.name ?? "Project"}
        </button>

        {error && <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>}

        {project && (
          <>
            <header className="border-b border-slate-800 pb-7">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">{project.name}</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight">{meta.label}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-400">{meta.description}</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                  <StatusIcon size={16} className="text-blue-400" /> {STATUS[currentStatus].label}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {PROJECT_SECTION_KEYS.map((key) => (
                  <button key={key} onClick={() => router.push(`/projects/${projectId}/${key}`)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${key === section ? "border-blue-700 bg-blue-950/50 text-blue-300" : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"}`}>
                    {META[key].label}
                  </button>
                ))}
              </div>
            </header>

            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <h2 className="font-semibold">Section status</h2>
                  <p className="mt-1 text-sm text-slate-500">Track this engineering area independently.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["not-started", "in-progress", "complete"] as ProjectSectionStatus[]).map((value) => (
                    <button key={value} disabled={saving} onClick={() => void changeStatus(value)}
                      className={`rounded-lg border px-3 py-2 text-xs ${currentStatus === value ? "border-blue-700 bg-blue-950/60 text-blue-300" : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"} disabled:opacity-50`}>
                      {STATUS[value].label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {section === "database" ? (
              <section className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="font-semibold">Add database entity</h2>
                  <div className="mt-5 grid gap-4">
                    <input value={newDatabaseEntity.name} onChange={(e) => setNewDatabaseEntity((v) => ({ ...v, name: e.target.value }))} maxLength={120} placeholder="Table / entity name" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <textarea value={newDatabaseEntity.purpose} onChange={(e) => setNewDatabaseEntity((v) => ({ ...v, purpose: e.target.value }))} maxLength={2000} rows={4} placeholder="What data does this entity own?" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <div className="flex justify-end">
                      <button disabled={savingDatabaseEntity || !newDatabaseEntity.name.trim()} onClick={async () => {
                        if (!user || !project) return;
                        setSavingDatabaseEntity(true); setError(null);
                        try {
                          await createProjectDatabaseEntity({ projectId: project.id, ownerId: user.uid, ...newDatabaseEntity });
                          setDatabaseEntities(await listProjectDatabaseEntities(project.id, user.uid));
                          setNewDatabaseEntity({ name: "", purpose: "" });
                        } catch (err) { setError(err instanceof Error ? err.message : "Database entity could not be created."); }
                        finally { setSavingDatabaseEntity(false); }
                      }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{savingDatabaseEntity ? "Adding..." : "Add entity"}</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {databaseEntities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center text-sm text-slate-500">No database entities defined yet.</div>
                  ) : databaseEntities.map((entity) => (
                    <div key={entity.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div>
                          <code className="text-sm text-blue-300">{entity.name}</code>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">{entity.purpose || "No purpose documented."}</p>
                        </div>
                        <select value={entity.status} onChange={async (e) => {
                          if (!user || !project) return;
                          const status = e.target.value as ProjectDatabaseEntityStatus;
                          try {
                            await updateProjectDatabaseEntityStatus({ projectId: project.id, entityId: entity.id, ownerId: user.uid, status });
                            setDatabaseEntities((items) => items.map((item) => item.id === entity.id ? { ...item, status } : item));
                          } catch (err) { setError(err instanceof Error ? err.message : "Database entity status could not be updated."); }
                        }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                          <option value="draft">Draft</option><option value="active">Active</option><option value="deprecated">Deprecated</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : section === "api" ? (
              <section className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="font-semibold">Add API contract</h2>
                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                      <select value={newApiContract.method} onChange={(e) => setNewApiContract((v) => ({ ...v, method: e.target.value as ProjectApiMethod }))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                        <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
                      </select>
                      <input value={newApiContract.path} onChange={(e) => setNewApiContract((v) => ({ ...v, path: e.target.value }))} maxLength={300} placeholder="/api/v1/resource" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <input value={newApiContract.title} onChange={(e) => setNewApiContract((v) => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Contract title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <textarea value={newApiContract.description} onChange={(e) => setNewApiContract((v) => ({ ...v, description: e.target.value }))} maxLength={2000} rows={3} placeholder="Purpose and expected behavior." className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <div className="flex justify-end">
                      <button disabled={savingApiContract || !newApiContract.path.trim() || !newApiContract.title.trim()} onClick={async () => {
                        if (!user || !project) return;
                        setSavingApiContract(true); setError(null);
                        try {
                          await createProjectApiContract({ projectId: project.id, ownerId: user.uid, ...newApiContract });
                          setApiContracts(await listProjectApiContracts(project.id, user.uid));
                          setNewApiContract({ method: "GET", path: "", title: "", description: "" });
                        } catch (err) { setError(err instanceof Error ? err.message : "API contract could not be created."); }
                        finally { setSavingApiContract(false); }
                      }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{savingApiContract ? "Adding..." : "Add contract"}</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {apiContracts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center text-sm text-slate-500">No API contracts defined yet.</div>
                  ) : apiContracts.map((contract) => (
                    <div key={contract.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-blue-900/60 bg-blue-950/40 px-2 py-1 text-[10px] font-semibold text-blue-300">{contract.method}</span>
                            <code className="text-sm text-slate-300">{contract.path}</code>
                            <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">{contract.status}</span>
                          </div>
                          <h3 className="mt-3 font-semibold">{contract.title}</h3>
                          {contract.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">{contract.description}</p>}
                        </div>
                        <select value={contract.status} onChange={async (e) => {
                          if (!user || !project) return;
                          const status = e.target.value as ProjectApiStatus;
                          try {
                            await updateProjectApiContractStatus({ projectId: project.id, contractId: contract.id, ownerId: user.uid, status });
                            setApiContracts((items) => items.map((item) => item.id === contract.id ? { ...item, status } : item));
                          } catch (err) { setError(err instanceof Error ? err.message : "API contract status could not be updated."); }
                        }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                          <option value="draft">Draft</option><option value="active">Active</option><option value="deprecated">Deprecated</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : section === "design" ? (
              <section className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="font-semibold">Add design decision</h2>
                  <div className="mt-5 grid gap-4">
                    <input value={newDesignDecision.title} onChange={(e) => setNewDesignDecision((v) => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Decision title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <textarea value={newDesignDecision.decision} onChange={(e) => setNewDesignDecision((v) => ({ ...v, decision: e.target.value }))} maxLength={5000} rows={4} placeholder="What design choice are we making?" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <textarea value={newDesignDecision.rationale} onChange={(e) => setNewDesignDecision((v) => ({ ...v, rationale: e.target.value }))} maxLength={5000} rows={4} placeholder="Why is this the right choice?" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <div className="flex justify-end">
                      <button disabled={savingDesignDecision || !newDesignDecision.title.trim() || !newDesignDecision.decision.trim()} onClick={async () => {
                        if (!user || !project) return;
                        setSavingDesignDecision(true); setError(null);
                        try {
                          await createProjectDesignDecision({ projectId: project.id, ownerId: user.uid, ...newDesignDecision });
                          setDesignDecisions(await listProjectDesignDecisions(project.id, user.uid));
                          setNewDesignDecision({ title: "", decision: "", rationale: "" });
                        } catch (err) { setError(err instanceof Error ? err.message : "Design decision could not be created."); }
                        finally { setSavingDesignDecision(false); }
                      }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{savingDesignDecision ? "Adding..." : "Add decision"}</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {designDecisions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center text-sm text-slate-500">No design decisions recorded yet.</div>
                  ) : designDecisions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">{item.status}</span></div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.decision}</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500"><span className="text-slate-400">Rationale:</span> {item.rationale || "Not provided."}</p>
                        </div>
                        <select value={item.status} onChange={async (e) => {
                          if (!user || !project) return;
                          const status = e.target.value as ProjectDesignDecisionStatus;
                          try {
                            await updateProjectDesignDecisionStatus({ projectId: project.id, decisionId: item.id, ownerId: user.uid, status });
                            setDesignDecisions((items) => items.map((current) => current.id === item.id ? { ...current, status } : current));
                          } catch (err) { setError(err instanceof Error ? err.message : "Design decision status could not be updated."); }
                        }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                          <option value="proposed">Proposed</option><option value="accepted">Accepted</option><option value="superseded">Superseded</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : section === "roadmap" ? (
              <section className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="font-semibold">Add milestone</h2>
                  <div className="mt-5 grid gap-4">
                    <input value={newMilestone.title} onChange={(e) => setNewMilestone((v) => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Milestone title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <textarea value={newMilestone.description} onChange={(e) => setNewMilestone((v) => ({ ...v, description: e.target.value }))} maxLength={2000} rows={3} placeholder="Describe the milestone outcome." className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <input type="date" value={newMilestone.targetDate} onChange={(e) => setNewMilestone((v) => ({ ...v, targetDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm" />
                      <button disabled={savingMilestone || !newMilestone.title.trim()} onClick={async () => {
                        if (!user || !project) return;
                        setSavingMilestone(true); setError(null);
                        try {
                          await createProjectMilestone({ projectId: project.id, ownerId: user.uid, title: newMilestone.title, description: newMilestone.description, targetDate: newMilestone.targetDate });
                          setMilestones(await listProjectMilestones(project.id, user.uid));
                          setNewMilestone({ title: "", description: "", targetDate: "" });
                        } catch (err) { setError(err instanceof Error ? err.message : "Milestone could not be created."); }
                        finally { setSavingMilestone(false); }
                      }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{savingMilestone ? "Adding..." : "Add milestone"}</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {milestones.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center text-sm text-slate-500">No milestones defined yet.</div>
                  ) : milestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div>
                          <h3 className="font-semibold">{milestone.title}</h3>
                          {milestone.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">{milestone.description}</p>}
                          {milestone.targetDate && <p className="mt-3 text-xs text-slate-600">Target: {milestone.targetDate}</p>}
                        </div>
                        <select value={milestone.status} onChange={async (e) => {
                          if (!user || !project) return;
                          const status = e.target.value as ProjectMilestoneStatus;
                          try {
                            await updateProjectMilestoneStatus({ projectId: project.id, milestoneId: milestone.id, ownerId: user.uid, status });
                            setMilestones((items) => items.map((item) => item.id === milestone.id ? { ...item, status } : item));
                          } catch (err) { setError(err instanceof Error ? err.message : "Milestone status could not be updated."); }
                        }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                          <option value="planned">Planned</option><option value="in-progress">In progress</option><option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : section === "planning" ? (
              <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-6">
                  <h2 className="font-semibold">Project planning</h2>
                  <p className="mt-1 text-sm text-slate-500">Define the intent, boundaries and measurable outcome for this project.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {([
                    ["objective", "Objective", "What are we building and why?"],
                    ["scope", "Scope", "What is included and explicitly excluded?"],
                    ["constraints", "Constraints", "Budget, technical, delivery or operational constraints."],
                    ["successCriteria", "Success criteria", "How will we know the project achieved its intended outcome?"],
                  ] as const).map(([key, label, placeholder]) => (
                    <label key={key} className="block">
                      <span className="text-xs font-medium text-slate-300">{label}</span>
                      <textarea
                        value={planning[key]}
                        onChange={(event) => setPlanning((current) => ({ ...current, [key]: event.target.value }))}
                        maxLength={5000}
                        rows={6}
                        placeholder={placeholder}
                        className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <span className="text-xs text-slate-600">Up to 5,000 characters per field</span>
                  <button
                    disabled={savingPlanning}
                    onClick={async () => {
                      if (!user || !project) return;
                      setSavingPlanning(true);
                      setError(null);
                      try {
                        await updateProjectPlanning({ projectId: project.id, ownerId: user.uid, planning });
                        setProject((current) => current ? { ...current, planning } : current);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Planning could not be saved.");
                      } finally {
                        setSavingPlanning(false);
                      }
                    }}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {savingPlanning ? "Saving..." : "Save planning"}
                  </button>
                </div>
              </section>
            ) : section === "requirements" ? (
              <section className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="font-semibold">Add requirement</h2>
                  <div className="mt-5 grid gap-4">
                    <input value={newRequirement.title} onChange={(e) => setNewRequirement((v) => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Requirement title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <textarea value={newRequirement.description} onChange={(e) => setNewRequirement((v) => ({ ...v, description: e.target.value }))} maxLength={2000} rows={4} placeholder="Describe the requirement and expected behavior." className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <select value={newRequirement.priority} onChange={(e) => setNewRequirement((v) => ({ ...v, priority: e.target.value as ProjectRequirementPriority }))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm">
                        <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option><option value="critical">Critical priority</option>
                      </select>
                      <button disabled={savingRequirement || !newRequirement.title.trim()} onClick={async () => {
                        if (!user || !project) return;
                        setSavingRequirement(true); setError(null);
                        try {
                          await createProjectRequirement({ projectId: project.id, ownerId: user.uid, title: newRequirement.title, description: newRequirement.description, priority: newRequirement.priority });
                          const items = await listProjectRequirements(project.id, user.uid);
                          setRequirements(items);
                          setNewRequirement({ title: "", description: "", priority: "medium" });
                        } catch (err) { setError(err instanceof Error ? err.message : "Requirement could not be created."); }
                        finally { setSavingRequirement(false); }
                      }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{savingRequirement ? "Adding..." : "Add requirement"}</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {requirements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center text-sm text-slate-500">No requirements defined yet.</div>
                  ) : requirements.map((requirement) => (
                    <div key={requirement.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{requirement.title}</h3>
                            <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">{requirement.priority}</span>
                          </div>
                          {requirement.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">{requirement.description}</p>}
                        </div>
                        <select value={requirement.status} onChange={async (e) => {
                          if (!user || !project) return;
                          const status = e.target.value as "todo" | "in-progress" | "done";
                          try {
                            await updateProjectRequirementStatus({ projectId: project.id, requirementId: requirement.id, ownerId: user.uid, status });
                            setRequirements((items) => items.map((item) => item.id === requirement.id ? { ...item, status } : item));
                          } catch (err) { setError(err instanceof Error ? err.message : "Requirement status could not be updated."); }
                        }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                          <option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : section === "architecture" ? (
              <section className="mt-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">Architecture workspace</h2>
                    <p className="mt-1 text-xs text-slate-500">Architecture artifacts already linked to this project.</p>
                  </div>
                  <button onClick={() => router.push(`/canvas/new?projectId=${project.id}`)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500">
                    New Architecture
                  </button>
                </div>
                {architectures.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">No architectures in this project yet.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {architectures.map((architecture) => (
                      <button key={architecture.id} onClick={() => router.push(`/canvas/${architecture.id}`)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-slate-700">
                        <div className="flex items-center justify-between"><Boxes size={18} className="text-blue-400" /><ExternalLink size={14} className="text-slate-600" /></div>
                        <h3 className="mt-4 font-semibold">{architecture.name}</h3>
                        <p className="mt-2 text-xs text-slate-500">Open architecture studio</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
                <h2 className="text-lg font-semibold">{meta.label} workspace ready</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  This section has its own project workspace and persistent status. Its domain artifact model will be added here as the engineering workflow matures.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
