"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Check,
  ClipboardList,
  FileText,
  Map,
  Palette,
  Network,
  Braces,
  Database,
  Server,
  Code2,
  FlaskConical,
  BookOpen,
  Circle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getProject,
  updateProjectSectionStatus,
} from "@/lib/repositories/projects";
import {
  listArchitecturesForProject,
  type Architecture,
} from "@/lib/repositories/architectures";
import {
  PROJECT_SECTION_KEYS,
  type Project,
  type ProjectSectionKey,
  type ProjectSectionStatus,
} from "@/domain/project/types";

const SECTION_META: Record<
  ProjectSectionKey,
  { label: string; description: string; icon: typeof Circle }
> = {
  planning: { label: "Planning", description: "Goals, scope and project direction.", icon: ClipboardList },
  requirements: { label: "Requirements", description: "Functional and technical requirements.", icon: FileText },
  roadmap: { label: "Roadmap", description: "Milestones, sequencing and delivery.", icon: Map },
  design: { label: "Design", description: "UX, UI and design system work.", icon: Palette },
  architecture: { label: "Architecture", description: "System topology and architecture decisions.", icon: Network },
  api: { label: "API", description: "Contracts, endpoints and integrations.", icon: Braces },
  database: { label: "Database", description: "Data models, schemas and storage.", icon: Database },
  infrastructure: { label: "Infrastructure", description: "Cloud, environments and deployment.", icon: Server },
  code: { label: "Code", description: "Implementation and engineering work.", icon: Code2 },
  testing: { label: "Testing", description: "Quality, verification and test coverage.", icon: FlaskConical },
  documentation: { label: "Documentation", description: "Technical docs and project knowledge.", icon: BookOpen },
};

const STATUS_META: Record<ProjectSectionStatus, { label: string; className: string }> = {
  "not-started": { label: "Not started", className: "border-slate-700 bg-slate-800/70 text-slate-400" },
  "in-progress": { label: "In progress", className: "border-blue-800/70 bg-blue-950/50 text-blue-300" },
  complete: { label: "Complete", className: "border-emerald-800/70 bg-emerald-950/50 text-emerald-300" },
};

export default function ProjectDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [fetching, setFetching] = useState(true);
  const [savingSection, setSavingSection] = useState<ProjectSectionKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const current = await getProject(projectId);
        if (!current || current.ownerId !== user.uid || current.status !== "active") {
          setError("Project is unavailable or archived.");
          return;
        }
        const items = await listArchitecturesForProject(projectId, user.uid);
        if (!cancelled) {
          setProject(current);
          setArchitectures(items);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Project could not be loaded.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId, user]);

  const sections = project?.sections;
  const completedSections = useMemo(
    () => PROJECT_SECTION_KEYS.filter((key) => sections?.[key] === "complete").length,
    [sections],
  );
  const progress = Math.round((completedSections / PROJECT_SECTION_KEYS.length) * 100);

  const changeSectionStatus = async (
    section: ProjectSectionKey,
    status: ProjectSectionStatus,
  ) => {
    if (!user || !project || savingSection) return;
    setSavingSection(section);
    setError(null);
    try {
      await updateProjectSectionStatus({
        projectId: project.id,
        ownerId: user.uid,
        section,
        status,
      });
      setProject((current) => {
        if (!current) return current;

        const nextSections: Record<ProjectSectionKey, ProjectSectionStatus> = {
          ...(current.sections ?? {}),
          [section]: status,
        };

        return {
          ...current,
          sections: nextSections,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section status could not be updated.");
    } finally {
      setSavingSection(null);
    }
  };

  if (loading || fetching) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading project...</div>;
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.push("/projects")}
          className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft size={16} /> Projects
        </button>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        {project ? (
          <>
            <header className="border-b border-slate-800 pb-8">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                    <span className="rounded-md bg-emerald-950/60 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-300">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    {project.description || "Engineering workspace for this product."}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/canvas/new?projectId=${project.id}`)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500"
                >
                  <Network size={16} /> New Architecture
                </button>
              </div>

              <div className="mt-7 max-w-2xl">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Engineering progress</span>
                  <span className="text-slate-500">{completedSections}/{PROJECT_SECTION_KEYS.length} complete</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </header>

            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Engineering surface</h2>
                <p className="mt-1 text-xs text-slate-500">The project is the container; each section becomes a first-class engineering workspace.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {PROJECT_SECTION_KEYS.map((key) => {
                  const meta = SECTION_META[key];
                  const status = sections?.[key] ?? "not-started";
                  const statusMeta = STATUS_META[status];
                  const Icon = meta.icon;
                  return (
                    <article
                      key={key}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-blue-400">
                          <Icon size={19} />
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <h3 className="mt-4 font-semibold">{meta.label}</h3>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{meta.description}</p>

                      <select
                        value={status}
                        disabled={savingSection !== null}
                        onChange={(event) =>
                          void changeSectionStatus(key, event.target.value as ProjectSectionStatus)
                        }
                        className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        <option value="not-started">Not started</option>
                        <option value="in-progress">In progress</option>
                        <option value="complete">Complete</option>
                      </select>
                      {savingSection === key ? (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                          <Circle size={9} className="animate-pulse" /> Saving...
                        </div>
                      ) : status === "complete" ? (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                          <Check size={11} /> Section complete
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-4 flex items-center gap-2">
                <Boxes size={18} className="text-blue-400" />
                <h2 className="font-semibold">Architectures</h2>
              </div>
              {architectures.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">
                  No architectures in this project yet.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {architectures.map((architecture) => (
                    <button
                      key={architecture.id}
                      onClick={() => router.push(`/canvas/${architecture.id}`)}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-slate-700"
                    >
                      <h3 className="font-semibold text-white">{architecture.name}</h3>
                      <p className="mt-2 text-xs text-slate-500">Open architecture studio</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
