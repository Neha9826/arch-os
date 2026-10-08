"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Link2, ListTodo } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject } from "@/lib/repositories/projects";
import { listArchitecturesForProject } from "@/lib/repositories/architectures";
import { listProjectExecutionTasks } from "@/lib/repositories/projectExecution";
import { buildProjectTraceability, type ProjectTraceability } from "@/domain/project/traceability";

export default function ProjectTraceabilityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [projectName, setProjectName] = useState("");
  const [traceability, setTraceability] = useState<ProjectTraceability | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !projectId) return;
    let cancelled = false;

    const load = async () => {
      setBusy(true);
      setError(null);
      try {
        const project = await getProject(projectId);
        if (!project || project.ownerId !== user.uid || project.status !== "active") {
          throw new Error("Project is unavailable or archived.");
        }
        const [architectures, tasks] = await Promise.all([
          listArchitecturesForProject(projectId, user.uid),
          listProjectExecutionTasks(projectId, user.uid),
        ]);
        if (!cancelled) {
          setProjectName(project.name);
          setTraceability(
            buildProjectTraceability(
              architectures.map((architecture) => ({ id: architecture.id, name: architecture.name })),
              tasks,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Traceability could not be loaded.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId, user]);

  if (loading || busy) {
    return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-300">Loading traceability...</main>;
  }

  if (error || !traceability) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">
        <div className="mx-auto max-w-6xl">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back to project
          </button>
          <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6 text-sm text-red-200">
            {error ?? "Traceability is unavailable."}
          </div>
        </div>
      </main>
    );
  }

  const linkedPercent = traceability.totalTaskCount === 0
    ? 0
    : Math.round((traceability.linkedTaskCount / traceability.totalTaskCount) * 100);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> {projectName || "Project"}
        </button>

        <header className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Engineering traceability</p>
              <h1 className="mt-2 text-3xl font-semibold">Architecture → Execution</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                See which execution work is connected to each architecture and where delivery work is still unlinked.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Tasks linked</div>
              <div className="mt-1 text-3xl font-semibold">{linkedPercent}<span className="text-base text-slate-500">%</span></div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Architectures", traceability.architectures.length],
            ["Execution tasks", traceability.totalTaskCount],
            ["Linked tasks", traceability.linkedTaskCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-blue-400" />
            <h2 className="font-semibold">Architecture coverage</h2>
          </div>

          {traceability.architectures.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-sm text-slate-500">
              No architectures are linked to this project yet.
            </div>
          ) : (
            <div className="space-y-4">
              {traceability.architectures.map((item) => (
                <article key={item.architecture.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <button type="button" onClick={() => router.push(`/canvas/${item.architecture.id}`)} className="text-left hover:text-blue-300">
                        <h3 className="font-semibold">{item.architecture.name}</h3>
                      </button>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.tasks.length} linked tasks · {item.completedTasks} complete · {item.blockedTasks} blocked
                      </p>
                    </div>
                    <div className="min-w-48">
                      <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                        <span>Execution coverage</span><span>{item.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </div>

                  {item.tasks.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {item.tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {task.status === "done" ? <CheckCircle2 size={15} className="shrink-0 text-emerald-400" /> : task.status === "blocked" ? <CircleAlert size={15} className="shrink-0 text-red-400" /> : <ListTodo size={15} className="shrink-0 text-blue-400" />}
                            <span className="truncate text-sm text-slate-300">{task.title}</span>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600">{task.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-800 px-4 py-3 text-xs text-slate-600">
                      No execution task is linked to this architecture.
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="font-semibold">Unlinked execution work</h2>
            <p className="mt-1 text-xs text-slate-500">Tasks without a valid architecture source reference remain visible here.</p>
          </div>
          {traceability.unlinkedTasks.length === 0 ? (
            <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5 text-sm text-emerald-300">
              All execution tasks are linked to project architectures.
            </div>
          ) : (
            <div className="space-y-2">
              {traceability.unlinkedTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <div className="font-medium text-slate-300">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {task.sourceId ? `Source: ${task.sourceId}` : "No source reference"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
