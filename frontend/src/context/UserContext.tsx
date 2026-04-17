import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Manager" | "Employee";
export type Seniority = "Senior" | "Junior";
export type Department = "HR" | "IT" | "FINANCE";
export type AudienceType = "All" | "Senior" | "Junior";

export interface ApiUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  seniority: Seniority;
  section: string;
  department: Department;
  avatar: string;
  profile_image: string | null;
  phone: string;
  bio: string;
  manager?: ApiUser | null;
}

/** Frontend Task shape (matches backend TaskSerializer) */
export interface Task {
  id: number;
  title: string;
  description: string;
  status: "todo" | "inprogress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  created_at: string;
  assigned_to: ApiUser | null;
  assigned_to_department?: Department | null;
  assigned_users?: ApiUser[];
  assigned_by: ApiUser | null;
}

/** Frontend Announcement shape */
export interface Announcement {
  id: number;
  title: string;
  content: string;
  is_high_priority: boolean;
  audience_type: AudienceType;
  department: Department;
  created_at: string;
  author: ApiUser | null;
}

/** Group chat group */
export interface ChatGroup {
  id: number;
  name: string;
  created_by: ApiUser | null;
  members: ApiUser[];
  member_count: number;
  created_at: string;
}

/** Group message */
export interface GroupMessage {
  id: number;
  sender: ApiUser | null;
  content: string;
  timestamp: string;
  is_read: boolean;
}

/** Represents a real user from the backend (used by UserManagement page) */
export interface MockEmployee {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active";
  department: Department;
  seniority: Seniority;
  section: string;
  joinDate: string;
  djangoRole?: string;
  manager?: ApiUser | null;
}

// ─── Context shape ─────────────────────────────────────────────────────────────

interface UserState {
  isAuthenticated: boolean;
  role: "admin" | "user" | null;
  djangoRole: UserRole | null;
  username: string | null;
  email: string | null;
  id: number | null;
  seniority: Seniority | null;
  department: Department | null;
  section: string | null;
  manager?: ApiUser | null;
}

interface UserContextType {
  user: UserState;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // Announcements
  announcements: Announcement[];
  loadingAnnouncements: boolean;
  addAnnouncement: (a: {
    title: string;
    content: string;
    is_high_priority: boolean;
    audience_type: AudienceType;
    department: Department;
  }) => Promise<void>;
  deleteAnnouncement: (id: number) => Promise<void>;
  refreshAnnouncements: () => void;

  // Tasks
  tasks: Task[];
  loadingTasks: boolean;
  addTask: (t: { title: string; description: string; priority: string; dueDate: string; assigned_to_id?: number | null; assigned_to_department?: string | null }) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  updateTask: (id: number, updates: Partial<{ status: string; priority: string; title: string; description: string; dueDate: string; assigned_to_id: number | null; assigned_to_department: string | null }>) => Promise<void>;
  refreshTasks: (filter?: string) => void;

  // Employees
  employees: MockEmployee[];
  addEmployee: (e: {
    name: string;
    email: string;
    role: "admin" | "user";
    djangoRole?: string;
    seniority: Seniority;
    section: string;
    department: Department;
    password: string;
  }) => Promise<void>;
  updateEmployee: (id: number, updates: Partial<MockEmployee> & { new_password?: string; confirm_password?: string }) => Promise<void>;
  deleteEmployee: (id: number) => Promise<void>;
  loadingEmployees: boolean;
  employeeError: string | null;
  refreshEmployees: () => void;

  // Groups
  groups: ChatGroup[];
  loadingGroups: boolean;
  fetchGroups: () => Promise<void>;
  createGroup: (name: string, memberIds: number[]) => Promise<ChatGroup>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mapDjangoRole(role: string): "admin" | "user" {
  return role === "Admin" ? "admin" : "user";
}

function mapApiUserToEmployee(u: ApiUser): MockEmployee {
  return {
    id: u.id,
    name: u.username,
    email: u.email,
    role: mapDjangoRole(u.role),
    djangoRole: u.role,
    status: "active",
    department: u.department || "HR",
    seniority: u.seniority || "Junior",
    section: u.section || "",
    joinDate: "",
    manager: u.manager,
  };
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the YYYY-MM-DD string as-is for the Django DateField.
 * The timezone-safe parsing is handled on the display side (parseLocalDate in Tasks.tsx).
 * We do NOT send a full ISO timestamp because Django's DateField only accepts YYYY-MM-DD.
 */
function toNoonISO(dateStr: string): string {
  // Just clean the string — strip any time component if it somehow arrives with one.
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserState>(() =>
    loadFromStorage("worknest_user", {
      isAuthenticated: false,
      role: null,
      djangoRole: null,
      username: null,
      email: null,
      id: null,
      seniority: null,
      department: null,
      section: null,
      manager: null,
    })
  );

  // ── Announcements ─────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!localStorage.getItem("accessToken")) return;
    setLoadingAnnouncements(true);
    try {
      const res = await api.get("/announcements/");
      const results = res.data.results ?? res.data;
      setAnnouncements(results);
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoadingAnnouncements(false);
    }
  }, []);

  // ── Groups ──────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!localStorage.getItem("accessToken")) return;
    setLoadingGroups(true);
    try {
      const res = await api.get("/groups/");
      const results = res.data.results ?? res.data;
      setGroups(results);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const createGroup = async (name: string, memberIds: number[]): Promise<ChatGroup> => {
    const res = await api.post("/groups/", { name, member_ids: memberIds });
    fetchGroups();
    return res.data as ChatGroup;
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchTasks = useCallback(async (filterParam?: string) => {
    if (!localStorage.getItem("accessToken")) return;
    setLoadingTasks(true);
    try {
      const url = filterParam && filterParam !== "all"
        ? `/tasks/?filter=${filterParam}`
        : "/tasks/";
      const res = await api.get(url);
      const results = res.data.results ?? res.data;
      setTasks(results);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // ── Employees ─────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<MockEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!localStorage.getItem("accessToken")) return;
    setLoadingEmployees(true);
    setEmployeeError(null);
    try {
      const res = await api.get("/users/");
      const results = res.data.results ?? res.data;
      setEmployees(results.map(mapApiUserToEmployee));
    } catch (err) {
      console.error("Failed to load users:", err);
      setEmployeeError("Could not load users from server.");
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // Persist user state
  useEffect(() => {
    localStorage.setItem("worknest_user", JSON.stringify(user));
  }, [user]);

  // Fetch data when authenticated
  useEffect(() => {
    if (user.isAuthenticated) {
      fetchAnnouncements();
      fetchTasks();
      fetchEmployees();
      fetchGroups();
    } else {
      setAnnouncements([]);
      setTasks([]);
      setEmployees([]);
      setGroups([]);
    }
  }, [user.isAuthenticated, fetchAnnouncements, fetchTasks, fetchEmployees, fetchGroups]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const tokenRes = await api.post("/auth/token/", { username: usernameOrEmail, password });
      const { access, refresh } = tokenRes.data;
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);

      const meRes = await api.get("/users/me/");
      const apiUser: ApiUser = meRes.data;

      setUser({
        isAuthenticated: true,
        role: mapDjangoRole(apiUser.role),
        djangoRole: apiUser.role,
        username: apiUser.username,
        email: apiUser.email,
        id: apiUser.id,
        seniority: apiUser.seniority,
        department: apiUser.department,
        section: apiUser.section,
        manager: apiUser.manager,
      });
      return { success: true };
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string; username?: string[] } } })?.response?.data;
      const message = detail?.detail || (detail?.username?.[0]) || "Invalid credentials. Please try again.";
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser({ isAuthenticated: false, role: null, djangoRole: null, username: null, email: null, id: null, seniority: null, department: null, section: null, manager: null });
  };

  // ── Announcement CRUD ─────────────────────────────────────────────────────
  const addAnnouncement = async (a: {
    title: string;
    content: string;
    is_high_priority: boolean;
    audience_type: AudienceType;
    department: Department;
  }) => {
    await api.post("/announcements/", a);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: number) => {
    await api.delete(`/announcements/${id}/`);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const addTask = async (t: { title: string; description: string; priority: string; dueDate: string; assigned_to_id?: number | null; assigned_to_department?: string | null }) => {
    const { dueDate, ...rest } = t;
    // ✅ CRITICAL FIX: send 'dueDate' (camelCase) to match TaskSerializer field name.
    // Also convert YYYY-MM-DD to noon local ISO to prevent UTC midnight off-by-one day in IST.
    const safeDueDate = dueDate ? toNoonISO(dueDate) : null;
    await api.post("/tasks/", { ...rest, dueDate: safeDueDate });
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await api.delete(`/tasks/${id}/`);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = async (id: number, updates: Partial<{ status: string; priority: string; title: string; description: string; dueDate: string; assigned_to_id: number | null; assigned_to_department: string | null }>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } as Task : t));
    try {
      const { dueDate, ...rest } = updates;
      const payload: Record<string, unknown> = { ...rest };
      // ✅ FIX: send 'dueDate' (camelCase) to match serializer; convert to noon ISO for timezone safety
      if (dueDate !== undefined) payload.dueDate = dueDate ? toNoonISO(dueDate) : null;
      await api.patch(`/tasks/${id}/`, payload);
    } catch {
      fetchTasks();
    }
  };

  // ── Employee CRUD ─────────────────────────────────────────────────────────
  const addEmployee = async (e: {
    name: string;
    email: string;
    role: "admin" | "user";
    djangoRole?: string;
    seniority: Seniority;
    section: string;
    department: Department;
    password: string;
  }) => {
    try {
      await api.post("/users/", {
        username: e.name,
        email: e.email,
        role: e.djangoRole || (e.role === "admin" ? "Admin" : "Employee"),
        seniority: e.seniority,
        section: e.section,
        department: e.department,
        password: e.password,
      });
      fetchEmployees();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const messages = data ? Object.values(data).flat().join(" ") : "Failed to create user.";
      setEmployeeError(messages);
      throw err;
    }
  };

  const updateEmployee = async (id: number, updates: Partial<MockEmployee> & { new_password?: string; confirm_password?: string }) => {
    try {
      const payload: Record<string, string> = {};
      if (updates.name) payload.username = updates.name;
      if (updates.email) payload.email = updates.email;
      if (updates.role) payload.role = updates.role === "admin" ? "Admin" : "Employee";
      if (updates.seniority) payload.seniority = updates.seniority;
      if (updates.section !== undefined) payload.section = updates.section;
      if (updates.department) payload.department = updates.department;
      if (updates.new_password) {
        payload.new_password = updates.new_password;
        payload.confirm_password = updates.confirm_password || "";
      }
      await api.patch(`/users/${id}/`, payload);
      fetchEmployees();
      
      // OPTION A (REAL-TIME UPDATE): Update global context if the user edited themselves
      if (id === user.id) {
         setUser(prev => ({
           ...prev,
           department: payload.department as Department || prev.department,
           section: payload.section !== undefined ? payload.section : prev.section
         }));
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const messages = data ? Object.values(data).flat().join(" ") : "Failed to update user.";
      setEmployeeError(messages);
      throw err;
    }
  };

  const deleteEmployee = async (id: number) => {
    try {
      await api.delete(`/users/${id}/`);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch {
      setEmployeeError("Failed to delete user.");
    }
  };

  return (
    <UserContext.Provider value={{
      user, login, logout,
      announcements, loadingAnnouncements, addAnnouncement, deleteAnnouncement, refreshAnnouncements: fetchAnnouncements,
      tasks, loadingTasks, addTask, deleteTask, updateTask, refreshTasks: fetchTasks,
      employees, addEmployee, updateEmployee, deleteEmployee,
      loadingEmployees, employeeError, refreshEmployees: fetchEmployees,
      groups, loadingGroups, fetchGroups, createGroup,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
