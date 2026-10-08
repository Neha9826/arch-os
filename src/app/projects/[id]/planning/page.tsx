"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ClipboardList, ListTodo, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProject,
  updateProjectPlanning,
  updateProjectSectionStatus,
} from "@/lib/repositories/projects";
import { createDefaultProjectSections } from "@/domain/project/validation";
import type {
  Project,
  ProjectPlanning,
  ProjectSectionStatus,
} from "@/domain/project/types";

const EMPTY_PLANNING: ProjectPlanning = {
  objective: "",
  scope: "",
  constraints: "",
  successCriteria: "",
};

const FIELDS: Array<{
  key: keyof ProjectPlanning;
  label: string;
  placeholder: string;
}> = [
  {
    key: "objective",
    label: "Objective",
    placeholder: "What outcome is this project intended to achieve?",
  },
  {
    key: "scope",
    label: "Scope",
    placeholder: "What is included in this project, and what is explicitly out of scope?",
  },
  {
    key: "constraints",
    label: "Constraints",
    placeholder:
      "Capture technical, product, delivery, security, or operational constraints.",
  },
  {
    key: "successCriteria",
    label: "Success criteria",
    placeholder: "How will you know the project is successful?",
  },
];

export default function ProjectPlanningPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<ProjectPlanning>(EMPTY_PLANNING);
  const [sectionStatus, setSectionStatus] =
    useState<ProjectSectionStatus>("not-started");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const load = async () => {
      try {
        const current = await getProject(projectId);

        if (
          !current ||
          current.ownerId !== user.uid ||
          current.status !== "active"
        ) {
          setError("Project is unavailable or archived.");
          return;
        }

        if (!cancelled) {
          setProject(current);
          setDraft({
            ...EMPTY_PLANNING,
            ...(current.planning ?? {}),
          });
          setSectionStatus(current.sections?.planning ?? "not-started");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Planning workspace could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  const savePlanning = async () => {
    if (!user || !project || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateProjectPlanning({
        projectId: project.id,
        ownerId: user.uid,
        planning: draft,
      });

      setProject((current) =>
        current ? { ...current, planning: draft } : current,
      );
      setMessage("Planning brief saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Planning brief could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeSectionStatus = async (status: ProjectSectionStatus) => {
    if (!user || !project || savingStatus) return;

    setSavingStatus(true);
    setError(null);
    setMessage(null);

    try {
      await updateProjectSectionStatus({
        projectId: project.id,
        ownerId: user.uid,
        section: "planning",
        status,
      });

      setSectionStatus(status);
      setProject((current) => {
        if (!current) return current;
        const sections = {
          ...createDefaultProjectSections(),
          ...(current.sections ?? {}),
          planning: status,
        };
        return { ...current, sections };
      });
      setMessage("Planning section status updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Planning status could not be updated.",
      );
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading planning workspace...
      </div>
    );
  }

  if (!user) return null;

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft size={16} /> Projects
          </button>
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
            {error ?? "Project could not be loaded."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft size={16} /> {project.name}
        </button>

        <header className="border-b border-slate-800 pb-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-950/60 text-blue-400">
                  <ClipboardList size={21} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                    Engineering section
                  </p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight">
                    Planning
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                Establish the project intent before requirements, roadmap,
                architecture, and execution work become commitments.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
                Section status
              </span>
              <select
                value={sectionStatus}
                disabled={savingStatus}
                onChange={(event) =>
                  void changeSectionStatus(
                    event.target.value as ProjectSectionStatus,
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="not-started">Not started</option>
                <option value="in-progress">In progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>
        </header>

        {message ? (
          <div
            role="status"
            className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3 text-sm text-emerald-200"
          >
            <Check size={15} /> {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mt-8">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Project brief</h2>
            <p className="mt-1 text-xs text-slate-500">
              Keep this at the project level. Detailed requirements and
              implementation tasks belong in their respective workspaces.
            </p>
          </div>

          <div className="space-y-5">
            {FIELDS.map((field) => (
              <div
                key={field.key}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
              >
                <label
                  htmlFor={`planning-${field.key}`}
                  className="block text-sm font-semibold text-slate-200"
                >
                  {field.label}
                </label>
                <textarea
                  id={`planning-${field.key}`}
                  value={draft[field.key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  maxLength={5000}
                  rows={field.key === "objective" ? 4 : 6}
                  placeholder={field.placeholder}
                  className="mt-3 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-700 focus:border-blue-500"
                />
                <div className="mt-2 text-right text-[11px] text-slate-600">
                  {draft[field.key].length}/5000
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void savePlanning()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            >
              <Save size={16} /> {saving ? "Saving..." : "Save planning brief"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/projects/${project.id}/execution`)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-blue-700 hover:text-blue-300"
            >
              <ListTodo size={16} /> Open execution
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
