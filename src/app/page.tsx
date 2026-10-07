'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  Activity, Archive, ArrowRight, Boxes, CheckCircle2,
  Cpu, FolderKanban, LogOut, Plus, ShieldCheck, Workflow,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { ensurePersonalWorkspace } from '@/lib/repositories/workspaces';
import { listProjectsForWorkspace } from '@/lib/repositories/projects';
import type { Project } from '@/domain/project/types';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const workspace = await ensurePersonalWorkspace(user.uid);
        const items = await listProjectsForWorkspace(workspace.id, user.uid);
        if (!cancelled) setProjects(items);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Your projects could not be loaded.');
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'active'), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.status === 'archived'), [projects]);
  const sectionStats = useMemo(() => {
    const statuses = projects.flatMap((project) => Object.values(project.sections ?? {}));
    return {
      complete: statuses.filter((status) => status === 'complete').length,
      inProgress: statuses.filter((status) => status === 'in-progress').length,
      total: projects.length * 11,
    };
  }, [projects]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  if (loading || fetching) {
    return <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-950 text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />Loading your workspace…</div>;
  }
  if (!user) return null;

  const displayName = user.displayName?.trim().split(/\s+/)[0] || 'there';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="z-20 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 sm:px-8">
        <button onClick={() => router.push('/')} className="flex items-center gap-3" aria-label="ArchOS dashboard">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/25"><Cpu size={21} /></span>
          <span className="text-lg font-bold tracking-tight">arch-os</span>
          <span className="hidden rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400 sm:inline">Engineering workspace</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-400 sm:inline">{user.displayName || user.email}</span>
          <button onClick={() => void handleSignOut()} title="Sign out" aria-label="Sign out" className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40 p-4 md:flex">
          <nav className="space-y-1">
            <button onClick={() => router.push('/')} className="flex w-full items-center gap-3 rounded-xl bg-blue-600 px-3.5 py-3 text-sm font-semibold text-white"><Activity size={18} /> Overview</button>
            <button onClick={() => router.push('/projects')} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"><FolderKanban size={18} /> Projects <ArrowRight size={15} className="ml-auto" /></button>
            <button onClick={() => router.push('/projects')} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"><Workflow size={18} /> Engineering workspaces</button>
          </nav>
          <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-semibold">A product by <span className="text-blue-400">Dev Engine AI</span></p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Engineering better systems, from idea to infrastructure.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8 sm:py-9">
          <div className="mx-auto max-w-7xl space-y-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Workspace overview</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {displayName}.</h1>
                <p className="mt-3 text-sm text-slate-400">A factual snapshot of your project portfolio and engineering progress.</p>
              </div>
              <button onClick={() => router.push('/projects')} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"><Plus size={17} /> New project</button>
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio metrics">
              <Metric icon={<FolderKanban size={19} />} label="Total projects" value={projects.length} note="Across your workspace" />
              <Metric icon={<Activity size={19} />} label="Active projects" value={activeProjects.length} note="Currently in progress" />
              <Metric icon={<CheckCircle2 size={19} />} label="Sections completed" value={sectionStats.complete} note={sectionStats.total ? `Of ${sectionStats.total} tracked sections` : 'No project sections yet'} />
              <Metric icon={<Archive size={19} />} label="Archived projects" value={archivedProjects.length} note="Retained for reference" />
            </section>

            <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400"><ShieldCheck size={22} /></div>
                  <div><h2 className="font-semibold">Engineering progress</h2><p className="mt-1 text-sm text-slate-400">Progress is calculated from the status of your project sections.</p></div>
                </div>
                <div className="text-sm text-slate-400"><span className="text-xl font-semibold text-white">{sectionStats.complete}</span> complete <span className="mx-1 text-slate-600">·</span> <span className="text-white">{sectionStats.inProgress}</span> in progress</div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: sectionStats.total ? `${Math.round((sectionStats.complete / sectionStats.total) * 100)}%` : '0%' }} /></div>
              <p className="mt-2 text-right text-xs text-slate-500">{sectionStats.total ? Math.round((sectionStats.complete / sectionStats.total) * 100) : 0}% of tracked sections complete</p>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div><h2 className="text-xl font-semibold">Your projects</h2><p className="mt-1 text-sm text-slate-500">Open a project to continue its engineering workflow.</p></div>
                <button onClick={() => router.push('/projects')} className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300">All projects <ArrowRight size={16} /></button>
              </div>
              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-6 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400"><FolderKanban size={22} /></div>
                  <h3 className="mt-4 font-semibold">Your project portfolio starts here</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create a software project to organize planning, requirements, architecture, implementation, testing, and documentation.</p>
                  <button onClick={() => router.push('/projects')} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500">Create your first project</button>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {projects.slice(0, 6).map((project) => {
                    const statuses = Object.values(project.sections ?? {});
                    const completed = statuses.filter((status) => status === 'complete').length;
                    const inProgress = statuses.filter((status) => status === 'in-progress').length;
                    const progress = Math.round((completed / 11) * 100);
                    return (
                      <button key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-left transition hover:border-slate-700 hover:bg-slate-900 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-slate-800 p-2.5 text-blue-400"><Boxes size={20} /></div><div className="min-w-0"><h3 className="truncate font-semibold text-white">{project.name}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description || 'No description provided.'}</p></div></div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${project.status === 'active' ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>{project.status}</span>
                        </div>
                        <div className="mt-6 flex items-center justify-between text-xs text-slate-500"><span>{completed}/11 sections complete</span><span>{inProgress} in progress</span></div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>
                        <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-sm font-medium text-blue-400"><span>Open project</span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5 text-xs text-slate-600">
              <span>ArchOS · Engineering workspace</span><span>{user.email || 'Signed in'} · Session expires after 24 hours</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><span className="rounded-lg bg-slate-800 p-2 text-blue-400">{icon}</span></div><p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}
