import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import api from "@/services/api";
import { useUser, MockEmployee, Seniority, Department } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, User, Trash2, Plus, X, Edit2, Search, RefreshCw, Loader2,
  KeyRound, Building2, Layers, BadgeCheck,
} from "lucide-react";

const DEPARTMENTS: Department[] = ["HR", "IT", "FINANCE"];
const DEPT_LABELS: Record<Department, string> = { HR: "HR", IT: "IT", FINANCE: "Finance" };
const DEPT_COLORS: Record<Department, string> = {
  HR: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  IT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  FINANCE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
const SENIORITY_COLORS: Record<Seniority, string> = {
  Senior: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Junior: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

interface FormState {
  name: string;
  email: string;
  role: "admin" | "user";
  djangoRole: string;
  seniority: Seniority;
  section: string;
  department: Department;
  password: string;
  new_password: string;
  confirm_password: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  role: "user",
  djangoRole: "Employee",
  seniority: "Junior",
  section: "",
  department: "HR",
  password: "",
  new_password: "",
  confirm_password: "",
};

export default function UserManagement() {
  const {
    employees, addEmployee, updateEmployee, deleteEmployee,
    loadingEmployees, employeeError, refreshEmployees,
  } = useUser();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Dynamic Sections State
  const [sectionsCache, setSectionsCache] = useState<Record<string, string[]>>({});
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  const filtered = employees.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (u: MockEmployee) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      djangoRole: u.djangoRole || "Employee",
      seniority: u.seniority,
      section: u.section || "",
      department: u.department,
      password: "",
      new_password: "",
      confirm_password: "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const set = (key: keyof FormState, value: string) =>
    setForm(p => ({ ...p, [key]: value }));

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDept = e.target.value as Department;
    setForm(p => ({ ...p, department: newDept, section: "" }));
  };

  // Fetch sections dynamically on department change
  useEffect(() => {
    if (!form.department) {
      setAvailableSections([]);
      return;
    }
    
    const deptKey = form.department.toUpperCase();
    if (sectionsCache[deptKey]) {
      setAvailableSections(sectionsCache[deptKey]);
      return;
    }

    let isMounted = true;
    const fetchSections = async () => {
      setLoadingSections(true);
      try {
        const res = await api.get(`/departments/${form.department}/sections/`);
        if (isMounted) {
          const fetchedSections = res.data.sections || [];
          setSectionsCache(prev => ({ ...prev, [deptKey]: fetchedSections }));
          setAvailableSections(fetchedSections);
        }
      } catch (err) {
        console.error("Failed to fetch sections:", err);
        if (isMounted) setAvailableSections([]);
      } finally {
        if (isMounted) setLoadingSections(false);
      }
    };

    fetchSections();
    return () => { isMounted = false; };
  }, [form.department, sectionsCache]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Frontend validation
    if (!form.name.trim()) return setFormError("Username is required.");
    if (!form.email.trim()) return setFormError("Email is required.");
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email)) return setFormError("Please enter a valid email address.");

    if (!editingId) {
      if (!isPasswordValid) return setFormError("Password does not meet security requirements.");
    } else {
      if (form.new_password || form.confirm_password) {
        if (!isPasswordValid) return setFormError("Password does not meet security requirements.");
        if (!passwordMatch) return setFormError("Passwords do not match.");
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateEmployee(editingId, {
          name: form.name,
          email: form.email,
          role: form.role,
          djangoRole: form.djangoRole,
          seniority: form.seniority,
          section: form.section,
          department: form.department,
          new_password: form.new_password || undefined,
          confirm_password: form.confirm_password || undefined,
        });
      } else {
        await addEmployee({
          name: form.name,
          email: form.email,
          role: form.role,
          djangoRole: form.djangoRole,
          seniority: form.seniority,
          section: form.section,
          department: form.department,
          password: form.password,
        });
      }
      setShowModal(false);
    } catch {
      // error already set by context via setEmployeeError — but let's also show in modal
      setFormError("Failed to save user. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  const pw = editingId ? form.new_password : form.password;
  const isEditingPassword = !!editingId && form.new_password.length > 0;
  const isCreatingUser = !editingId;
  const needsValidation = isCreatingUser || isEditingPassword;
  
  const hasLength = pw.length >= 8 && pw.length <= 64;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[@$!%*?&]/.test(pw);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordMatch = !editingId || form.new_password === form.confirm_password;
  const isValidToSave = !needsValidation || (isPasswordValid && passwordMatch);

  const roleLabel = (u: MockEmployee) => u.djangoRole || (u.role === "admin" ? "Admin" : "Employee");

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input-field pl-10" />
      </div>

      {employeeError && (
        <div className="px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
          {employeeError}
        </div>
      )}

      {/* Table */}
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
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seniority</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Section</th>
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
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${SENIORITY_COLORS[u.seniority]}`}>
                        <BadgeCheck className="h-3 w-3" />
                        {u.seniority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${DEPT_COLORS[u.department]}`}>
                        <Building2 className="h-3 w-3" />
                        {DEPT_LABELS[u.department]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {u.section || <span className="italic opacity-50">—</span>}
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

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-surface p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg">{editingId ? "Edit User" : "Add User"}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {formError && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Row: Username + Email */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Username <span className="text-destructive">*</span></label>
                    <input value={form.name} onChange={e => set("name", e.target.value)} className="input-field" placeholder="johndoe" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Email <span className="text-destructive">*</span></label>
                    <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="input-field" placeholder="john@company.io" required />
                  </div>
                </div>

                {/* Row: Role + Seniority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Role</label>
                    <select value={form.djangoRole} onChange={e => set("djangoRole", e.target.value)} className="input-field">
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> Seniority <span className="text-destructive">*</span></label>
                    <select value={form.seniority} onChange={e => set("seniority", e.target.value as Seniority)} className="input-field">
                      <option value="Junior">Junior</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>
                </div>

                {/* Row: Department + Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1"><Building2 className="h-3 w-3" /> Department <span className="text-destructive">*</span></label>
                    <select value={form.department} onChange={handleDepartmentChange} className="input-field">
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{DEPT_LABELS[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1"><Layers className="h-3 w-3" /> Section</label>
                    <div className="relative">
                      <select
                        value={form.section}
                        onChange={e => set("section", e.target.value)}
                        className="input-field"
                        disabled={loadingSections || !form.department || availableSections.length === 0}
                      >
                        <option value="">
                          {loadingSections ? "Loading roles..." : availableSections.length === 0 ? "No roles available" : "Select Section"}
                        </option>
                        {availableSections.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {loadingSections && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Password section */}
                <div className="pt-1 border-t border-border">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5 text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    {editingId ? "Update Password (optional)" : "Set Password"}
                  </p>
                  {!editingId ? (
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Password <span className="text-destructive">*</span></label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={e => set("password", e.target.value)}
                        className="input-field"
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5">New Password</label>
                        <input
                          type="password"
                          value={form.new_password}
                          onChange={e => set("new_password", e.target.value)}
                          className="input-field"
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5">Confirm Password</label>
                        <input
                          type="password"
                          value={form.confirm_password}
                          onChange={e => set("confirm_password", e.target.value)}
                          className="input-field"
                          placeholder="Repeat password"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  )}
                  {editingId && isEditingPassword && !passwordMatch && (
                    <div className="text-xs text-destructive mt-2 font-medium flex items-center gap-1.5"><X className="h-3.5 w-3.5"/> Passwords do not match</div>
                  )}
                  
                  {needsValidation && (
                    <div className="mt-4 space-y-2 text-xs px-1 bg-secondary/30 p-3 rounded-lg border border-border">
                       <p className="font-semibold text-muted-foreground mb-1">Security Requirements:</p>
                       <div className={`flex items-center gap-2 ${hasLength ? 'text-emerald-500' : 'text-muted-foreground'}`}>{hasLength ? <Check className="h-3.5 w-3.5"/> : <X className="h-3.5 w-3.5 opacity-50"/>} 8 to 64 characters</div>
                       <div className={`flex items-center gap-2 ${hasUpper ? 'text-emerald-500' : 'text-muted-foreground'}`}>{hasUpper ? <Check className="h-3.5 w-3.5"/> : <X className="h-3.5 w-3.5 opacity-50"/>} One uppercase letter</div>
                       <div className={`flex items-center gap-2 ${hasLower ? 'text-emerald-500' : 'text-muted-foreground'}`}>{hasLower ? <Check className="h-3.5 w-3.5"/> : <X className="h-3.5 w-3.5 opacity-50"/>} One lowercase letter</div>
                       <div className={`flex items-center gap-2 ${hasNumber ? 'text-emerald-500' : 'text-muted-foreground'}`}>{hasNumber ? <Check className="h-3.5 w-3.5"/> : <X className="h-3.5 w-3.5 opacity-50"/>} One number</div>
                       <div className={`flex items-center gap-2 ${hasSpecial ? 'text-emerald-500' : 'text-muted-foreground'}`}>{hasSpecial ? <Check className="h-3.5 w-3.5"/> : <X className="h-3.5 w-3.5 opacity-50"/>} One special char (!@#$%^&*)</div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                  <button type="submit" disabled={saving || !isValidToSave} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 focus:ring-2 focus:ring-primary/20">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {saving ? "Saving…" : editingId ? "Save Changes" : "Add User"}
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
