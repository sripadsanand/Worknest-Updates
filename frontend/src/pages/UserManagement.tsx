import { useState } from "react";
import { useUser, MockEmployee } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, User, Trash2, Plus, X, Edit2, Search, RefreshCw, Loader2 } from "lucide-react";

export default function UserManagement() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, loadingEmployees, employeeError, refreshEmployees } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "user" as "admin" | "user", status: "active" as "active", department: "" });

  const filtered = employees.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", email: "", role: "user", status: "active", department: "" });
    setShowModal(true);
  };

  const openEdit = (u: MockEmployee) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status, department: u.department || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (editingId) {
      await updateEmployee(editingId, { name: form.name, email: form.email, role: form.role });
    } else {
      await addEmployee({ name: form.name, email: form.email, role: form.role, status: "active", department: "", joinDate: "" });
    }
    setShowModal(false);
  };

  const roleLabel = (u: MockEmployee) => u.djangoRole || (u.role === "admin" ? "Admin" : "Employee");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">User Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage team members, roles, and permissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium flex items-center gap-1.5">
            <Shield className="h-3 w-3" /> Admin Only
          </div>
          <button onClick={refreshEmployees} className="btn-ghost p-2" title="Refresh users">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> Add User</button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input-field pl-10" />
      </div>

      {employeeError && (
        <div className="px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
          {employeeError}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {loadingEmployees ? (
          <div className="p-12 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading users from server...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-secondary/50">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                          {u.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                        {u.role === "admin" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {roleLabel(u)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-success">
                        <span className="h-2 w-2 rounded-full bg-success" /> active
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => deleteEmployee(u.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loadingEmployees && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                {employees.length === 0 ? "No users found on the server. Make sure the backend is running." : "No users match your search."}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="glass-surface p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg">{editingId ? "Edit User" : "Add User"}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Username</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input-field" placeholder="johndoe" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input-field" placeholder="john@worknest.io" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as "admin" | "user" }))} className="input-field">
                    <option value="user">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {!editingId && (
                  <p className="text-xs text-muted-foreground">New users will be created with a temporary password: <code className="bg-secondary px-1 rounded">changeme123</code></p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                  <button type="submit" className="btn-primary text-xs px-5 py-2">{editingId ? "Save Changes" : "Add User"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
