import { useState, useEffect } from "react";
import { useUser, Task } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, GripVertical, X, Calendar, Loader2, Filter } from "lucide-react";

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

export default function Tasks() {
  const { tasks, employees, loadingTasks, addTask, deleteTask, updateTask, refreshTasks, user } = useUser();
  const canCreate = user.djangoRole === "Admin" || user.djangoRole === "Manager";

  const [dragItem, setDragItem] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [ownerFilter, setOwnerFilter] = useState<"all" | "my" | "assigned_by_me">(
    user.djangoRole === "Employee" ? "my" : "all"
  );
  
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "tomorrow" | "overdue">("all");

  useEffect(() => {
    refreshTasks(dateFilter);
  }, [dateFilter, refreshTasks]);

  const assignableEmployees = employees.filter(e => {
    if (user.djangoRole === "Admin") return true;
    if (user.djangoRole === "Manager") return e.djangoRole === "Employee";
    return false;
  });

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await addTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        dueDate: newDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        assigned_to_id: newAssignedTo ? Number(newAssignedTo) : undefined,
      });
      setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDescription(""); setNewAssignedTo("");
      setShowModal(false);
    } catch {
      alert("Failed to create task based on permission rules.");
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

  const handleAssign = async (taskId: number, newAssigneeId: number | "") => {
    try {
      // Direct API call implemented in updateTask using assigned_to_id
      await updateTask(taskId, { assigned_to_id: newAssigneeId === "" ? null : newAssigneeId });
    } catch {
      alert("Failed to re-assign task.");
    }
  };

  const formatDueDate = (d: string | null) => {
    if (!d) return "No date";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
            
            <div className="flex items-center gap-1.5 ml-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {(["all", "today", "tomorrow", "overdue"] as const).map(df => (
                <button
                  key={df}
                  onClick={() => setDateFilter(df)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-all font-semibold border ${
                    dateFilter === df 
                      ? "bg-foreground text-background border-foreground shadow-sm" 
                      : "bg-background text-muted-foreground border-border hover:bg-secondary"
                  } ${df === "overdue" && dateFilter === df ? "bg-destructive text-destructive-foreground border-destructive" : ""}`}
                >
                  {df === "all" ? "Any Date" : df.charAt(0).toUpperCase() + df.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => {
            if (t.status !== col.key) return false;
            // role filters
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
                        <div className="flex items-center gap-2">
                          {/* Assignment UI - allows inline reassignment for privileged users */}
                          {canCreate ? (
                            <select 
                              value={task.assigned_to?.id || ""} 
                              onChange={(e) => handleAssign(task.id, e.target.value ? Number(e.target.value) : "")}
                              className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 w-24 text-muted-foreground hover:bg-secondary/80 outline-none"
                              onClick={(e) => e.stopPropagation()} // Prevent drag start when clicking dropdown
                            >
                              <option value="">Unassigned</option>
                              {assignableEmployees.map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.djangoRole})</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex gap-1.5 items-center">
                              {task.assigned_to ? (
                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary" title={`Assigned to ${task.assigned_to.username}`}>
                                  {task.assigned_to.username[0].toUpperCase()}
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full border border-dashed border-border flex items-center justify-center text-[9px]" title="Unassigned">?</div>
                              )}
                              <span className="text-[10px] text-muted-foreground">{task.assigned_to ? task.assigned_to.username : "Unassigned"}</span>
                            </div>
                          )}
                          
                          {task.assigned_by && (
                            <span title={`Created by: ${task.assigned_by.username}`} className="text-[10px] text-muted-foreground/50 hidden sm:inline-block ml-2">
                              creator: {task.assigned_by.username}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDueDate(task.dueDate)}
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
                  <label className="block text-xs font-medium mb-1.5">Task Title</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input-field" placeholder="What needs to be done?" autoFocus required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Description (optional)</label>
                  <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} className="input-field resize-none" placeholder="Add more details..." />
                </div>
                
                {/* Assignee selector explicitly shown for admins/managers */}
                {canCreate && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Assign To</label>
                    <div className="relative">
                      <select 
                        value={newAssignedTo} 
                        onChange={e => setNewAssignedTo(e.target.value === "" ? "" : Number(e.target.value))} 
                        className="input-field appearance-none w-full bg-card"
                      >
                        <option value="">Unassigned</option>
                        {assignableEmployees.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.djangoRole})</option>
                        ))}
                      </select>
                    </div>
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
                    <label className="block text-xs font-medium mb-1.5">Due Date</label>
                    <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="input-field max-w-full" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary text-xs px-5 py-2">
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
