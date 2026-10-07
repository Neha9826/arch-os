"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getProject } from "@/lib/repositories/projects";
import { listArchitecturesForProject } from "@/lib/repositories/architectures";
import {
  buildProjectArchitectureHealth,
  type ProjectArchitectureHealth,
} from "@/domain/architecture/projectHealth";

function statusLabel(status: ProjectArchitectureHealth["architectures"][number]["status"]) {
  if (status === "healthy") return "Healthy";
  if (status === "good") return "Good";
  if (status === "needs-attention") return "Needs attention";
  return "Critical";
}

function statusIcon(status: ProjectArchitectureHealth["architectures"][number]["status"]) {
  if (status === "healthy") return CheckCircle2;
  if (status === "good") return Activity;
  if (status === "needs-attention") return AlertTriangle;
  return CircleAlert;
}

export default function ProjectArchitectureHealthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [health, setHealth] = useState<ProjectArchitectureHealth | null>(null);
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

        const architectures = await listArchitecturesForProject(projectId, user.uid);
        const projectHealth = buildProjectArchitectureHealth(
          architectures
            .filter((architecture) => architecture.architectureIR)
            .map((architecture) => ({
              id: architecture.id,
              name: architecture.name,
              architectureIR: architecture.architectureIR!,
            })),
        );

        if (!cancelled) {
          setProjectName(project.name);
          setHealth(projectHealth);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Architecture health could not be loaded.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  if (loading || busy) {
    return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-300">Loading architecture health...</main>;
  }

  if (error || !health) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">
        <div className="mx-auto max-w-5xl">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back to project
          </button>
          <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6 text-sm text-red-200">
            {error ?? "Architecture health is unavailable."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Back to project
        </button>

        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Architecture health</p>
              <h1 className="mt-2 text-3xl font-semibold">{projectName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                A deterministic project-level view of the architecture signals already produced by the ArchOS health engine.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Average score</div>
              <div className="mt-1 text-3xl font-semibold">{health.averageScore}<span className="text-base text-slate-500">/100</span></div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Architectures", health.architectureCount],
            ["Components", health.totalComponents],
            ["Relations", health.totalRelations],
            ["Findings", health.totalErrors + health.totalWarnings],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Healthy", health.healthyCount, "text-emerald-400"],
            ["Good", health.goodCount, "text-blue-400"],
            ["Needs attention", health.needsAttentionCount, "text-amber-400"],
            ["Critical", health.criticalCount, "text-red-400"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
              <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Architecture health by artifact</h2>
              <p className="mt-1 text-sm text-slate-500">Scores and findings are calculated from each architecture&apos;s canonical Architecture IR.</p>
            </div>
            <div className="text-xs text-slate-500">
              {health.totalErrors} errors · {health.totalWarnings} warnings
            </div>
          </div>

          {health.architectures.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-sm text-slate-500">
              No architecture with canonical health data is linked to this project yet.
            </div>
          ) : (
            <div className="space-y-3">
              {health.architectures.map((item) => {
                const Icon = statusIcon(item.status);
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <Icon size={20} className="mt-1 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{item.name}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {statusLabel(item.status)} · {item.components} components · {item.relations} relations · {item.isolatedComponents} isolated
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-semibold">{item.score}<span className="text-xs text-slate-500">/100</span></div>
                          <div className="text-[11px] text-slate-600">{item.errors} errors · {item.warnings} warnings</div>
                        </div>
                        <button onClick={() => router.push(`/canvas/${item.id}`)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-blue-500 hover:text-white" aria-label={`Open ${item.name}`}>
                          <ExternalLink size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
