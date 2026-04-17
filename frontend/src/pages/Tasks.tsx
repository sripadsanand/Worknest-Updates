import { useState, useEffect } from "react";
import { useUser, Task, ApiUser } from "@/context/UserContext";
import api from "@/services/api";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, GripVertical, X, Calendar, Loader2, Filter, AlertCircle, Building2, Users } from "lucide-react";

const COLUMNS: { key: Task["status"]; title: string; dotColor: string }[] = [
  { key: "todo", title: "To Do", dotColor: "bg-muted-foreground" },
  { key: "inprogress", title: "In Progress", dotColor: "bg-primary" },
  { key: "done", title: "Done", dotColor: "bg-success" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-success/10 text-success border-success/20",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Parse YYYY-MM-DD without UTC-midnight timezone shift */
function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Return today's date as YYYY-MM-DD in local time */
function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Return tomorrow's date as YYYY-MM-DD in local time */
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Tasks() {
  const { tasks, employees, loadingTasks, addTask, deleteTask, updateTask, refreshTasks, user } = useUser();
  const isSenior = user.djangoRole === "Employee" && user.seniority === "Senior";
  const canCreate = user.djangoRole === "Admin" || user.djangoRole === "Manager" || isSenior;

  const [juniors, setJuniors] = useState<ApiUser[]>([]);

  useEffect(() => {
    if (isSenior) {
      api.get("/users/juniors/")
        .then(res => setJuniors(res.data.juniors || []))
        .catch(err => console.error("Failed to load juniors", err));
    }
  }, [isSenior]);

  const [dragItem, setDragItem] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDueDate, setNewDueDate] = useState(todayStr());
  const [newDescription, setNewDescription] = useState("");
  const [newAssignment, setNewAssignment] = useState<string>("");
  const [overrideUser, setOverrideUser] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<"all" | "my" | "assigned_by_me">(
    user.djangoRole === "Employee" ? "my" : "all"
  );
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "tomorrow" | "overdue" | "this_week" | "next_7_days">("all");

  useEffect(() => {
    refreshTasks(dateFilter);
  }, [dateFilter, refreshTasks]);

  const assignableEmployees = employees.filter(e => {
    if (user.djangoRole === "Admin") return true;
    if (user.djangoRole === "Manager") return e.djangoRole === "Employee" && e.department === user.department;
    return false;
  });

  const openModal = () => {
    setNewTitle("");
    setNewPriority("medium");
    setNewDueDate(todayStr());  // always reset to today
    setNewDescription("");
    setNewAssignment("");
    setOverrideUser("");
    setDateError(null);
    setShowModal(true);
  };

  const handleDateChange = (val: string) => {
    setDateError(null);
    if (val && val < todayStr()) {
      setDateError("Due date cannot be in the past. Please select today or a future date.");
    }
    setNewDueDate(val);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Frontend guard: reject past dates
    if (newDueDate && newDueDate < todayStr()) {
      setDateError("Due date cannot be in the past. Please select today or a future date.");
      return;
    }

    setSaving(true);
    try {
      const dept = newAssignment.startsWith("dept:") ? newAssignment.split(":")[1] : null;
      const userId = newAssignment.startsWith("user:") ? Number(newAssignment.split(":")[1]) : (overrideUser ? Number(overrideUser) : undefined);

      await addTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        dueDate: newDueDate,   // pass raw YYYY-MM-DD; UserContext converts it to noon-ISO
        assigned_to_id: userId,
        assigned_to_department: dept,
      });
      setShowModal(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (data?.due_date || data?.dueDate) {
        setDateError((data.due_date ?? data.dueDate ?? []).join(" "));
      } else {
        alert("Failed to create task. You may not have permission.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (status: Task["status"]) => {
    if (dragItem !== null) {
      try {
        await updateTask(dragItem, { status });
      } catch {
        alert("Failed to update task.");
      }
      setDragItem(null);
    }
  };

  const handleAssign = async (taskId: number, mixedVal: string) => {
    try {
      const dept = mixedVal.startsWith("dept:") ? mixedVal.split(":")[1] : null;
      const userId = mixedVal.startsWith("user:") ? Number(mixedVal.split(":")[1]) : null;
      await updateTask(taskId, {
        assigned_to_id: userId,
        assigned_to_department: dept,
      });
    } catch {
      alert("Failed to re-assign task.");
    }
  };

  /**
   * Timezone-safe, colour-coded due date badge.
   * Parses YYYY-MM-DD locally (avoids UTC midnight off-by-one in IST).
   */
  const formatDueDate = (d: string | null) => {
    if (!d) return <span className="text-muted-foreground/60 italic">No due date</span>;

    // Strip time component if ISO string was returned (e.g. "2026-04-10T12:00:00Z")
    const datePart = d.includes("T") ? d.split("T")[0] : d;
    const today = todayStr();
    const tomorrow = tomorrowStr();

    if (datePart < today) {
      // Overdue
      const label = parseLocalDate(datePart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return (
        <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
          {label} <span className="text-[9px] bg-red-500/10 border border-red-500/20 rounded px-1 py-0.5 uppercase tracking-wide">Overdue</span>
        </span>
      );
    }
    if (datePart === today) {
      const label = parseLocalDate(datePart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return (
        <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
          {label} <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5 uppercase tracking-wide">Today</span>
        </span>
      );
    }
    if (datePart === tomorrow) {
      const label = parseLocalDate(datePart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return (
        <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
          {label} <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 rounded px-1 py-0.5 uppercase tracking-wide">Tomorrow</span>
        </span>
      );
    }
    // Future date — normal
    return (
      <span className="text-muted-foreground">
        {parseLocalDate(datePart).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </span>
    );
  };

  if (loadingTasks) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading tasks…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Task Board</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              onClick={() => setOwnerFilter("all")}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${ownerFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
              style={{ display: user.djangoRole === "Employee" ? "none" : "block" }}
            >
              All Tasks
            </button>
            <button
              onClick={() => setOwnerFilter("my")}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${ownerFilter === "my" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setOwnerFilter("assigned_by_me")}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${ownerFilter === "assigned_by_me" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
              style={{ display: user.djangoRole === "Employee" ? "none" : "block" }}
            >
              Assigned by Me
            </button>

            <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block"></div>

            <div className="flex items-center gap-1.5 ml-1 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {(["all", "today", "tomorrow", "overdue", "this_week", "next_7_days"] as const).map(df => (
                <button
                  key={df}
                  onClick={() => setDateFilter(df)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-all font-semibold border ${
                    dateFilter === df
                      ? df === "overdue"
                        ? "bg-red-500 text-white border-red-500 shadow-sm"
                        : df === "today"
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-foreground text-background border-foreground shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-secondary"
                  }`}
                >
                  {df === "all" ? "Any Date"
                    : df === "this_week" ? "This Week"
                    : df === "next_7_days" ? "Next 7 Days"
                    : df.charAt(0).toUpperCase() + df.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {canCreate && (
          <button onClick={openModal} className="btn-primary">
            <Plus className="h-4 w-4" /> New Task
          </button>
        )}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => {
            if (t.status !== col.key) return false;
            if (ownerFilter === "my" && t.assigned_to?.id !== user.id) return false;
            if (ownerFilter === "assigned_by_me" && t.assigned_by?.id !== user.id) return false;
            return true;
          });

          return (
            <div
              key={col.key}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/30"); }}
              onDragLeave={e => { e.currentTarget.classList.remove("ring-2", "ring-primary/30"); }}
              onDrop={e => { e.currentTarget.classList.remove("ring-2", "ring-primary/30"); handleDrop(col.key); }}
              className="glass-card p-4 min-h-[320px] transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-display font-semibold text-sm">{col.title}</h3>
                <span className="ml-auto text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="space-y-2.5">
                {colTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    draggable={canCreate || user.djangoRole === "Employee"}
                    onDragStart={() => setDragItem(task.id)}
                    onDragEnd={() => setDragItem(null)}
                    className={`group glass-card-hover p-3.5 cursor-grab active:cursor-grabbing ${
                      dragItem === task.id ? "opacity-40 ring-2 ring-primary scale-[0.97]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
                        <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1 ml-5">{task.description}</p>
                    )}
                    <div className="flex flex-col gap-2 mt-3 ml-1">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1.5 items-start">
                          {canCreate ? (
                            <select
                              value={task.assigned_to_department ? `dept:${task.assigned_to_department}` : (task.assigned_to?.id ? `user:${task.assigned_to.id}` : "")}
                              onChange={(e) => handleAssign(task.id, e.target.value)}
                              className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 max-w-[140px] text-muted-foreground hover:bg-secondary/80 outline-none"
                              onClick={(e) => e.stopPropagation()}
                              disabled={isSenior && juniors.length === 0}
                            >
                              <option value="">Unassigned</option>
                              {!isSenior && (
                                <optgroup label="--- Departments ---">
                                  <option value="dept:HR">HR Department</option>
                                  <option value="dept:IT">IT Department</option>
                                  <option value="dept:FINANCE">Finance Department</option>
                                </optgroup>
                              )}
                              {isSenior && juniors.length === 0 ? (
                                <option value="" disabled>No junior members available in your department</option>
                              ) : (
                                <optgroup label="--- Users ---">
                                  {isSenior ? (
                                    juniors.map(j => (
                                      <option key={j.id} value={`user:${j.id}`}>{j.username}</option>
                                    ))
                                  ) : (
                                    assignableEmployees.map(e => (
                                      <option key={e.id} value={`user:${e.id}`}>{e.name} ({e.djangoRole})</option>
                                    ))
                                  )}
                                </optgroup>
                              )}
                            </select>
                          ) : null}

                          <div className="flex gap-2 items-center flex-wrap mt-0.5">
                            {task.assigned_to_department && (
                              <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/5 px-2 py-0.5 rounded-md text-primary" title={`Assigned to ${task.assigned_to_department} Department`}>
                                 <Users className="h-3 w-3" />
                                 <span className="text-[10px] font-bold tracking-wide">{task.assigned_to_department} Dept</span>
                                 {task.assigned_users && <span className="text-[9px] opacity-70">({task.assigned_users.length} users)</span>}
                              </div>
                            )}

                            {task.assigned_to ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-4 w-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-bold text-foreground" title={`Assigned to ${task.assigned_to.username}`}>
                                  {task.assigned_to.username[0].toUpperCase()}
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">{task.assigned_to.username} {task.assigned_to_department && "(Override)"}</span>
                              </div>
                            ) : task.assigned_to_department ? null : (
                              <div className="flex items-center gap-1.5">
                                <div className="h-4 w-4 rounded-full border border-dashed border-border flex items-center justify-center text-[8px]" title="Unassigned">?</div>
                                <span className="text-[10px] text-muted-foreground">Unassigned</span>
                              </div>
                            )}
                          </div>
                          
                          {task.assigned_by && (
                            <span title={`Created by: ${task.assigned_by.username}`} className="text-[9px] text-muted-foreground/40 hidden sm:inline-block">
                              creator: {task.assigned_by.username}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDueDate(task.dueDate)}
                        </span>
                        {canCreate && (
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="glass-surface p-6 w-full max-w-lg"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg">Create New Task</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Task Title <span className="text-destructive">*</span></label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input-field" placeholder="What needs to be done?" autoFocus required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Description (optional)</label>
                  <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} className="input-field resize-none" placeholder="Add more details..." />
                </div>

                {canCreate && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Assign To</label>
                    <select
                      value={newAssignment}
                      onChange={e => {
                         setNewAssignment(e.target.value);
                         setOverrideUser("");
                      }}
                      className="input-field appearance-none w-full bg-card"
                      disabled={isSenior && juniors.length === 0}
                    >
                      <option value="">Unassigned</option>
                      {!isSenior && (
                        <optgroup label="--- Departments ---">
                           <option value="dept:HR">HR Department</option>
                           <option value="dept:IT">IT Department</option>
                           <option value="dept:FINANCE">Finance Department</option>
                        </optgroup>
                      )}
                      {isSenior && juniors.length === 0 ? (
                        <option value="" disabled>No junior members available in your department</option>
                      ) : (
                        <optgroup label="--- Users ---">
                           {isSenior ? (
                             juniors.map(j => (
                               <option key={j.id} value={`user:${j.id}`}>👤 {j.username} (Junior)</option>
                             ))
                           ) : (
                             assignableEmployees.map(e => (
                               <option key={e.id} value={`user:${e.id}`}>👤 {e.name} ({e.djangoRole})</option>
                             ))
                           )}
                        </optgroup>
                      )}
                    </select>

                    {isSenior && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground font-semibold">
                        You can assign tasks only to junior team members
                      </p>
                    )}

                    {!isSenior && newAssignment.startsWith("dept:") && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 pl-3 border-l-2 border-primary/30">
                            <label className="block text-[11px] font-semibold mb-1 text-muted-foreground flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Specific User Override (PRO Bonus)
                            </label>
                            <select value={overrideUser} onChange={e => setOverrideUser(e.target.value === "" ? "" : Number(e.target.value))} className="input-field py-1.5 text-xs bg-secondary/30">
                                <option value="">No Override - Broadcast to entire department</option>
                                {assignableEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </motion.div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Priority</label>
                    <div className="flex gap-2">
                      {(["high", "medium", "low"] as const).map(p => (
                        <button
                          key={p} type="button" onClick={() => setNewPriority(p)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            newPriority === p ? PRIORITY_STYLES[p] : "border-border text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">
                      Due Date <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      min={todayStr()}
                      onChange={e => handleDateChange(e.target.value)}
                      className={`input-field max-w-full ${dateError ? "border-destructive ring-1 ring-destructive/30" : ""}`}
                    />
                    {dateError && (
                      <p className="mt-1.5 flex items-start gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        {dateError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                  <button type="submit" disabled={saving || !!dateError} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {saving ? "Creating…" : "Create Task"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
