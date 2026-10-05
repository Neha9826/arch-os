"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Boxes } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getProject } from "@/lib/repositories/projects";
import { listArchitecturesForProject, type Architecture } from "@/lib/repositories/architectures";
import type { Project } from "@/domain/project/types";

export default function ProjectDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [fetching, setFetching] = useState(true);
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

  if (loading || fetching) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading project...</div>;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push("/projects")} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"><ArrowLeft size={16} /> Projects</button>
        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-red-200">{error}</div>
        ) : project ? (
          <>
            <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-7 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{project.name}</h1>
                  <span className="rounded-md bg-emerald-950/60 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-300">{project.status}</span>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">{project.description || "No project description yet."}</p>
              </div>
              <button onClick={() => router.push(\`/canvas/new?projectId=\${project.id}\`)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500"><Plus size={16} /> New Architecture</button>
            </div>

            <section className="mt-8">
              <div className="mb-4 flex items-center gap-2"><Boxes size={18} className="text-blue-400" /><h2 className="font-semibold">Architectures</h2></div>
              {architectures.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 py-20 text-center text-sm text-slate-500">No architectures in this project yet.</div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {architectures.map((architecture) => (
                    <button key={architecture.id} onClick={() => router.push(\`/canvas/\${architecture.id}\`)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-slate-700">
                      <h3 className="font-semibold text-white">{architecture.name}</h3>
                      <p className="mt-2 text-xs text-slate-500">Open architecture studio</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-sm font-semibold">Engineering surface</p>
              <p className="mt-1 text-xs text-slate-500">Planning · Requirements · Roadmap · Design · Architecture · API · Database · Infrastructure · Code · Testing · Documentation</p>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
