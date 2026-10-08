"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  createProjectRequirement,
  deleteProjectRequirement,
  getProject,
  listProjectRequirements,
  updateProjectRequirement,
  updateProjectRequirementStatus,
} from "@/lib/repositories/projects";
import type {
  Project,
  ProjectRequirement,
  ProjectRequirementPriority,
  ProjectRequirementStatus,
  ProjectSectionStatus,
} from "@/domain/project/types";
import { updateProjectSectionStatus } from "@/lib/repositories/projects";
import { createDefaultProjectSections } from "@/domain/project/validation";

const PRIORITIES: ProjectRequirementPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const STATUSES: ProjectRequirementStatus[] = ["todo", "in-progress", "done"];

const priorityClass: Record<ProjectRequirementPriority, string> = {
  low: "border-slate-700 bg-slate-800/70 text-slate-400",
  medium: "border-blue-800/70 bg-blue-950/50 text-blue-300",
  high: "border-amber-800/70 bg-amber-950/50 text-amber-300",
  critical: "border-red-800/70 bg-red-950/50 text-red-300",
};

const statusLabel: Record<ProjectRequirementStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

export default function ProjectRequirementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<ProjectRequirement[]>([]);
  const [sectionStatus, setSectionStatus] =
    useState<ProjectSectionStatus>("not-started");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<ProjectRequirementPriority>("medium");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingPriority, setEditingPriority] =
    useState<ProjectRequirementPriority>("medium");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;

    const current = await getProject(projectId);
    if (!current || current.ownerId !== user.uid || current.status !== "active") {
      throw new Error("Project is unavailable or archived.");
    }

    const items = await listProjectRequirements(projectId, user.uid);
    setProject(current);
    setRequirements(items);
    setSectionStatus(current.sections?.requirements ?? "not-started");
  }, [projectId, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Requirements workspace could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const counts = useMemo(
    () => ({
      total: requirements.length,
      done: requirements.filter((item) => item.status === "done").length,
      critical: requirements.filter((item) => item.priority === "critical").length,
    }),
    [requirements],
  );

  const createRequirement = async () => {
    if (!user || !project || saving || !title.trim()) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await createProjectRequirement({
        projectId: project.id,
        ownerId: user.uid,
        title,
        description,
        priority,
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      await load();
      setMessage("Requirement created.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Requirement could not be created.",
      );
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (item: ProjectRequirement) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingDescription(item.description ?? "");
    setEditingPriority(item.priority);
    setError(null);
    setMessage(null);
  };

  const saveEdit = async (item: ProjectRequirement) => {
    if (!user || savingId || !editingTitle.trim()) return;

    setSavingId(item.id);
    setError(null);
    setMessage(null);

    try {
      await updateProjectRequirement({
        projectId: projectId,
        requirementId: item.id,
        ownerId: user.uid,
        title: editingTitle,
        description: editingDescription,
        priority: editingPriority,
      });
      setEditingId(null);
      await load();
      setMessage("Requirement updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Requirement could not be updated.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const changeRequirementStatus = async (
    item: ProjectRequirement,
    nextStatus: ProjectRequirementStatus,
  ) => {
    if (!user || savingId) return;

    setSavingId(item.id);
    setError(null);
    setMessage(null);

    try {
      await updateProjectRequirementStatus({
        projectId: projectId,
        requirementId: item.id,
        ownerId: user.uid,
        status: nextStatus,
      });
      setRequirements((current) =>
        current.map((requirement) =>
          requirement.id === item.id
            ? { ...requirement, status: nextStatus }
            : requirement,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Requirement status could not be updated.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const removeRequirement = async (item: ProjectRequirement) => {
    if (!user || savingId) return;
    if (!window.confirm(`Delete requirement "${item.title}"?`)) return;

    setSavingId(item.id);
    setError(null);
    setMessage(null);

    try {
      await deleteProjectRequirement({
        projectId,
        requirementId: item.id,
        ownerId: user.uid,
      });
      setRequirements((current) =>
        current.filter((requirement) => requirement.id !== item.id),
      );
      setMessage("Requirement deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Requirement could not be deleted.",
      );
    } finally {
      setSavingId(null);
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
        section: "requirements",
        status,
      });
      setSectionStatus(status);
      setProject((current) =>
        current
          ? {
              ...current,
              sections: {
                ...createDefaultProjectSections(),
                ...(current.sections ?? {}),
                requirements: status,
              },
            }
          : current,
      );
      setMessage("Requirements section status updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Section status could not be updated.",
      );
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading requirements workspace...
      </div>
    );
  }

  if (!user) return null;

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl">
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
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft size={16} /> {project.name}
        </button>

        <header className="border-b border-slate-800 pb-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-950/60 text-violet-400">
                  <ClipboardPlus size={21} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
                    Engineering section
                  </p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight">
                    Requirements
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                Capture functional and technical commitments before they become
                roadmap, architecture, or implementation work.
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
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-violet-500 disabled:opacity-50"
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

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Requirements", counts.total],
            ["Completed", counts.done],
            ["Critical", counts.critical],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <p className="text-xs uppercase tracking-wider text-slate-600">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Add requirement</h2>
            <p className="mt-1 text-xs text-slate-500">
              Keep each requirement independently testable and concise.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
            <div>
              <label
                htmlFor="requirement-title"
                className="mb-2 block text-xs font-medium text-slate-400"
              >
                Title
              </label>
              <input
                id="requirement-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="e.g. Users can invite workspace members"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label
                htmlFor="requirement-priority"
                className="mb-2 block text-xs font-medium text-slate-400"
              >
                Priority
              </label>
              <select
                id="requirement-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as ProjectRequirementPriority)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            htmlFor="requirement-description"
            className="mt-4 mb-2 block text-xs font-medium text-slate-400"
          >
            Description
          </label>
          <textarea
            id="requirement-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Describe the expected behavior, constraints, or acceptance context."
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-700 focus:border-violet-500"
          />

          <button
            type="button"
            onClick={() => void createRequirement()}
            disabled={saving || !title.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} /> {saving ? "Creating..." : "Add requirement"}
          </button>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Requirement register</h2>
            <p className="mt-1 text-xs text-slate-500">
              Requirements are project-owned records and can be refined as the
              project evolves.
            </p>
          </div>

          {requirements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">
              No requirements yet.
            </div>
          ) : (
            <div className="space-y-4">
              {requirements.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  {editingId === item.id ? (
                    <div className="space-y-4">
                      <input
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        maxLength={200}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                      />
                      <textarea
                        value={editingDescription}
                        onChange={(event) =>
                          setEditingDescription(event.target.value)
                        }
                        maxLength={2000}
                        rows={4}
                        className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white"
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={editingPriority}
                          onChange={(event) =>
                            setEditingPriority(
                              event.target.value as ProjectRequirementPriority,
                            )
                          }
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                        >
                          {PRIORITIES.map((value) => (
                            <option key={value} value={value}>
                              {value[0].toUpperCase() + value.slice(1)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void saveEdit(item)}
                          disabled={savingId === item.id || !editingTitle.trim()}
                          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {savingId === item.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={savingId === item.id}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col justify-between gap-4 md:flex-row">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">
                              {item.title}
                            </h3>
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase ${priorityClass[item.priority]}`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                            {item.description || "No description provided."}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <select
                            value={item.status}
                            disabled={savingId === item.id}
                            onChange={(event) =>
                              void changeRequirementStatus(
                                item,
                                event.target.value as ProjectRequirementStatus,
                              )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"
                          >
                            {STATUSES.map((value) => (
                              <option key={value} value={value}>
                                {statusLabel[value]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-violet-700 hover:text-violet-300"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeRequirement(item)}
                            disabled={savingId === item.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-900/70 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
