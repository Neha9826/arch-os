"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Filter, ListTodo, Pencil, Search, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createProjectExecutionTask, deleteProjectExecutionTask, listProjectExecutionTasks, updateProjectExecutionTask, updateProjectExecutionTaskStatus } from "@/lib/repositories/projectExecution";
import type { ProjectExecutionTask, ProjectExecutionTaskPriority, ProjectExecutionTaskStatus, ProjectSectionKey } from "@/domain/project/types";
import { getProject } from "@/lib/repositories/projects";

const STATUS_META: Record<ProjectExecutionTaskStatus, string> = { todo: "To do", "in-progress": "In progress", blocked: "Blocked", done: "Done" };
const SECTION_LABELS: Record<ProjectSectionKey, string> = {
  planning: "Planning", requirements: "Requirements", roadmap: "Roadmap", design: "Design", architecture: "Architecture",
  api: "API", database: "Database", infrastructure: "Infrastructure", code: "Code", testing: "Testing", documentation: "Documentation",
};

export default function ProjectExecutionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [tasks, setTasks] = useState<ProjectExecutionTask[]>([]);
  const [projectName, setProjectName] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProjectExecutionTask | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectExecutionTaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ProjectExecutionTaskPriority>("all");
  const [sectionFilter, setSectionFilter] = useState<ProjectSectionKey | "all">("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "title">("dueDate");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: ProjectExecutionTaskPriority; section: ProjectSectionKey | ""; sourceId: string; dueDate: string }>({
    title: "", description: "", priority: "medium", section: "", sourceId: "", dueDate: "",
  });

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const loadExecutionWorkspace = async () => {
      setFetching(true);
      setError(null);

      try {
        const project = await getProject(projectId);
        if (!project || project.ownerId !== user.uid || project.status !== "active") {
          throw new Error("Project is unavailable or archived.");
        }

        const loadedTasks = await listProjectExecutionTasks(projectId, user.uid);
        setProjectName(project.name);
        setTasks(loadedTasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Execution workspace could not be loaded.");
      } finally {
        setFetching(false);
      }
    };

    void loadExecutionWorkspace();
  }, [projectId, user]);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const formatDueDate = (dueDate: string, status: ProjectExecutionTaskStatus) => {
    const [year, month, day] = dueDate.split("-").map(Number);
    const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
    const dueDay = Date.UTC(year, month - 1, day);
    const currentDay = Date.UTC(todayYear, todayMonth - 1, todayDay);
    const daysUntilDue = Math.round((dueDay - currentDay) / 86_400_000);
    if (status === "done") return dueDate;
    if (daysUntilDue < 0) {
      const overdueDays = Math.abs(daysUntilDue);
      return `Overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"} · ${dueDate}`;
    }
    if (daysUntilDue === 0) return `Due today · ${dueDate}`;
    if (daysUntilDue === 1) return `Due tomorrow · ${dueDate}`;
    if (daysUntilDue <= 7) return `Due in ${daysUntilDue} days · ${dueDate}`;
    return dueDate;
  };

  const summary = useMemo(() => ({
    total: tasks.length, active: tasks.filter((task) => task.status !== "done").length,
    blocked: tasks.filter((task) => task.status === "blocked").length, done: tasks.filter((task) => task.status === "done").length,
    overdue: tasks.filter((task) => task.status !== "done" && Boolean(task.dueDate) && task.dueDate! < todayKey).length,
  }), [tasks, todayKey]);

  const completionRate = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const priorityRank: Record<ProjectExecutionTaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return tasks.filter((task) => {
      const matchesSearch = !query || [task.title, task.description, task.sourceId].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesSection = sectionFilter === "all" || task.section === sectionFilter;
      const matchesOverdue = !overdueOnly || (task.status !== "done" && Boolean(task.dueDate) && task.dueDate! < todayKey);
      return matchesSearch && matchesStatus && matchesPriority && matchesSection && matchesOverdue;
    }).sort((a, b) => {
      if (sortBy === "priority") return priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title);
      if (sortBy === "title") return a.title.localeCompare(b.title);
      const aDue = a.dueDate || "9999-12-31";
      const bDue = b.dueDate || "9999-12-31";
      return aDue.localeCompare(bDue) || (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || a.title.localeCompare(b.title);
    });
  }, [tasks, search, statusFilter, priorityFilter, sectionFilter, sortBy, overdueOnly, todayKey]);

  const addTask = async () => {
    if (!user || !newTask.title.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      await createProjectExecutionTask({ projectId, ownerId: user.uid, title: newTask.title, description: newTask.description, priority: newTask.priority, section: newTask.section || undefined, sourceId: newTask.sourceId, dueDate: newTask.dueDate });
      setNewTask({ title: "", description: "", priority: "medium", section: "", sourceId: "", dueDate: "" });
      const project = await getProject(projectId);
      if (!project || project.ownerId !== user.uid || project.status !== "active") {
        throw new Error("Project is unavailable or archived.");
      }
      setProjectName(project.name);
      setTasks(await listProjectExecutionTasks(projectId, user.uid));
    } catch (err) { setError(err instanceof Error ? err.message : "Task could not be created."); }
    finally { setSaving(false); }
  };

  const startEditing = (task: ProjectExecutionTask) => {
    setEditing({ ...task });
    setError(null);
  };

  const saveEdit = async () => {
    if (!user || !editing || !editing.title.trim() || editingSaving) return;
    setEditingSaving(true);
    setError(null);
    try {
      await updateProjectExecutionTask({
        projectId,
        taskId: editing.id,
        ownerId: user.uid,
        title: editing.title,
        description: editing.description,
        priority: editing.priority,
        status: editing.status,
        section: editing.section,
        sourceId: editing.sourceId,
        dueDate: editing.dueDate,
      });
      setTasks((items) => items.map((item) => item.id === editing.id ? { ...item, ...editing, title: editing.title.trim(), description: editing.description?.trim() || undefined, sourceId: editing.sourceId?.trim() || undefined, section: editing.section || undefined, dueDate: editing.dueDate || undefined } : item));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task could not be updated.");
    } finally {
      setEditingSaving(false);
    }
  };

  const changeStatus = async (task: ProjectExecutionTask, status: ProjectExecutionTaskStatus) => {
    if (!user) return;
    try {
      await updateProjectExecutionTaskStatus({ projectId, taskId: task.id, ownerId: user.uid, status });
      setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status } : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Task status could not be updated."); }
  };

  const removeTask = async (task: ProjectExecutionTask) => {
    if (!user || !window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteProjectExecutionTask({ projectId, taskId: task.id, ownerId: user.uid });
      setTasks((items) => items.filter((item) => item.id !== task.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Task could not be deleted."); }
  };

  if (loading || fetching) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading execution workspace...</div>;
  if (!user) return null;

  const exportTasksCsv = () => {
    const headers = ["Title", "Description", "Status", "Priority", "Section", "Source ID", "Due Date"];
    const escapeCsv = (value: string | undefined) => {
      const normalized = value ?? "";
      // Prevent spreadsheet applications from evaluating user-controlled cells as formulas.
      const safeValue = /^[\t\r ]*[=+@-]/.test(normalized) ? `'${normalized}` : normalized;
      return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const rows = filteredTasks.map((task) => [
      task.title,
      task.description,
      STATUS_META[task.status],
      task.priority,
      task.section ? SECTION_LABELS[task.section] : "",
      task.sourceId,
      task.dueDate,
    ].map(escapeCsv).join(","));
    const csv = [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const projectSlug = (projectName || "project").trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "project";
    link.download = `${projectSlug}-execution-tasks.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"><ArrowLeft size={16} /> {projectName || "Project"}</button>
        {error ? <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
        <header className="border-b border-slate-800 pb-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><div className="flex items-center gap-3"><ListTodo size={22} className="text-blue-400" /><h1 className="text-3xl font-bold tracking-tight">Execution</h1></div><p className="mt-2 max-w-2xl text-sm text-slate-400">Turn project definitions into actionable, traceable engineering work.</p></div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">{[["Total", summary.total], ["Active", summary.active], ["Blocked", summary.blocked], ["Overdue", summary.overdue], ["Done", summary.done]].map(([label, value]) => <div key={label} className={`rounded-xl border px-3 py-2 ${label === "Overdue" && Number(value) > 0 ? "border-red-900/70 bg-red-950/30" : "border-slate-800 bg-slate-900"}`}><div className={`text-lg font-semibold ${label === "Overdue" && Number(value) > 0 ? "text-red-300" : ""}`}>{value}</div><div className="text-slate-500">{label}</div></div>)}</div>
          </div>
        </header>
        <section aria-label="Execution progress" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Project execution progress</h2>
              <p className="mt-1 text-xs text-slate-500">{summary.done} of {summary.total} tasks completed</p>
            </div>
            <span className="text-xl font-semibold tabular-nums text-slate-100">{completionRate}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Task completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionRate}
            className="h-2.5 overflow-hidden rounded-full bg-slate-800"
          >
            <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${completionRate}%` }} />
          </div>
          {summary.total === 0 ? <p className="mt-3 text-xs text-slate-500">Create your first execution task to start tracking progress.</p> : null}
        </section>
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="font-semibold">Create execution task</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={newTask.title} onChange={(e) => setNewTask((v) => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Task title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <select value={newTask.priority} onChange={(e) => setNewTask((v) => ({ ...v, priority: e.target.value as ProjectExecutionTaskPriority }))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option><option value="critical">Critical priority</option></select>
            <textarea value={newTask.description} onChange={(e) => setNewTask((v) => ({ ...v, description: e.target.value }))} maxLength={2000} rows={4} placeholder="What needs to be done?" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 md:col-span-2" />
            <select value={newTask.section} onChange={(e) => setNewTask((v) => ({ ...v, section: e.target.value as ProjectSectionKey | "" }))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"><option value="">No engineering section</option>{Object.entries(SECTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input value={newTask.sourceId} onChange={(e) => setNewTask((v) => ({ ...v, sourceId: e.target.value }))} maxLength={160} placeholder="Source artifact ID (optional)" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((v) => ({ ...v, dueDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
            <div className="flex items-center justify-end"><button disabled={saving || !newTask.title.trim()} onClick={() => void addTask()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{saving ? "Creating..." : "Create task"}</button></div>
          </div>
        </section>
        <section className="mt-8">
          <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks, descriptions, or source IDs..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={exportTasksCsv} disabled={filteredTasks.length === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-blue-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Export CSV ({filteredTasks.length})</button>
                <div className="flex items-center gap-1 text-slate-600"><Filter size={14} /></div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  <option value="all">All statuses</option>
                  {Object.entries(STATUS_META).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  <option value="all">All priorities</option>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
                <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value as typeof sectionFilter)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  <option value="all">All sections</option>
                  {Object.entries(SECTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <select aria-label="Sort tasks" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  <option value="dueDate">Sort: due date</option><option value="priority">Sort: priority</option><option value="title">Sort: title</option>
                </select>
                <button type="button" aria-pressed={overdueOnly} onClick={() => setOverdueOnly((value) => !value)} className={`rounded-lg border px-3 py-2 text-xs ${overdueOnly ? "border-red-800 bg-red-950/40 text-red-200" : "border-slate-700 text-slate-300 hover:border-red-900"}`}>
                  {overdueOnly ? "Showing overdue" : "Overdue only"}
                </button>
              </div>
            </div>
            {(search || statusFilter !== "all" || priorityFilter !== "all" || sectionFilter !== "all" || overdueOnly) ? (
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
                <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
                <button onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setSectionFilter("all"); setOverdueOnly(false); }} className="text-blue-400 hover:text-blue-300">Clear filters</button>
              </div>
            ) : null}
          </div>
          {tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">No execution tasks yet.</div> : filteredTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">No tasks match the current filters.</div> : <div className="space-y-3">{filteredTasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{task.status === "done" ? <CheckCircle2 size={16} className="text-emerald-400" /> : task.status === "blocked" ? <CircleAlert size={16} className="text-red-400" /> : <ListTodo size={16} className="text-blue-400" />}<h3 className="font-semibold">{task.title}</h3><span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">{task.priority}</span>{task.section ? <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-500">{SECTION_LABELS[task.section]}</span> : null}</div>{task.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.description}</p> : null}<div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">{task.sourceId ? <span>Source: {task.sourceId}</span> : null}{task.dueDate ? <span className={task.status !== "done" && task.dueDate < todayKey ? "font-semibold text-red-300" : task.status !== "done" && task.dueDate === todayKey ? "font-semibold text-amber-300" : ""}>{formatDueDate(task.dueDate, task.status)}</span> : null}</div></div>
                <div className="flex items-center gap-2"><select value={task.status} onChange={(e) => void changeStatus(task, e.target.value as ProjectExecutionTaskStatus)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">{Object.entries(STATUS_META).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={() => startEditing(task)} className="rounded-lg border border-slate-800 p-2 text-slate-500 hover:border-blue-900 hover:text-blue-400" title="Edit task"><Pencil size={15} /></button><button onClick={() => void removeTask(task)} className="rounded-lg border border-slate-800 p-2 text-slate-500 hover:border-red-900 hover:text-red-400" title="Delete task"><Trash2 size={15} /></button></div>
              </div>
            </article>
          ))}</div>}
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Pencil size={18} className="text-blue-400" /> Edit execution task</h2>
                <p className="mt-1 text-xs text-slate-500">Update task details without changing its project ownership.</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input value={editing.title} onChange={(e) => setEditing((v) => v ? { ...v, title: e.target.value } : v)} maxLength={200} placeholder="Task title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <select value={editing.priority} onChange={(e) => setEditing((v) => v ? { ...v, priority: e.target.value as ProjectExecutionTaskPriority } : v)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option><option value="critical">Critical priority</option>
              </select>
              <textarea value={editing.description ?? ""} onChange={(e) => setEditing((v) => v ? { ...v, description: e.target.value } : v)} maxLength={2000} rows={4} placeholder="What needs to be done?" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 md:col-span-2" />
              <select value={editing.section ?? ""} onChange={(e) => setEditing((v) => v ? { ...v, section: e.target.value as ProjectSectionKey | undefined } : v)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                <option value="">No engineering section</option>{Object.entries(SECTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input value={editing.sourceId ?? ""} onChange={(e) => setEditing((v) => v ? { ...v, sourceId: e.target.value } : v)} maxLength={160} placeholder="Source artifact ID (optional)" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <input type="date" value={editing.dueDate ?? ""} onChange={(e) => setEditing((v) => v ? { ...v, dueDate: e.target.value } : v)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
              <select value={editing.status} onChange={(e) => setEditing((v) => v ? { ...v, status: e.target.value as ProjectExecutionTaskStatus } : v)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                {Object.entries(STATUS_META).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800">Cancel</button>
              <button disabled={editingSaving || !editing.title.trim()} onClick={() => void saveEdit()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{editingSaving ? "Saving..." : "Save changes"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
