import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Manager" | "Employee";

export interface ApiUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string;
  profile_image: string | null;
  phone: string;
  bio: string;
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
  assigned_by: ApiUser | null;
}

/** Frontend Announcement shape */
export interface Announcement {
  id: number;
  title: string;
  content: string;
  is_high_priority: boolean;
  created_at: string;
  author: ApiUser | null;
}

/** Represents a real user from the backend (used by UserManagement page) */
export interface MockEmployee {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active";
  department: string;
  joinDate: string;
  djangoRole?: string;
}

// ─── Context shape ─────────────────────────────────────────────────────────────

interface UserState {
  isAuthenticated: boolean;
  role: "admin" | "user" | null;
  djangoRole: UserRole | null;
  username: string | null;
  email: string | null;
  id: number | null;
}

interface UserContextType {
  user: UserState;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // Announcements
  announcements: Announcement[];
  loadingAnnouncements: boolean;
  addAnnouncement: (a: { title: string; content: string; is_high_priority: boolean }) => Promise<void>;
  deleteAnnouncement: (id: number) => Promise<void>;
  refreshAnnouncements: () => void;

  // Tasks
  tasks: Task[];
  loadingTasks: boolean;
  addTask: (t: { title: string; description: string; priority: string; dueDate: string; assigned_to_id?: number }) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  updateTask: (id: number, updates: Partial<{ status: string; priority: string; title: string; description: string; dueDate: string; assigned_to_id: number | null }>) => Promise<void>;
  refreshTasks: (filter?: string) => void;

  // Employees
  employees: MockEmployee[];
  addEmployee: (e: Omit<MockEmployee, "id">) => void;
  updateEmployee: (id: number, updates: Partial<MockEmployee>) => void;
  deleteEmployee: (id: number) => void;
  loadingEmployees: boolean;
  employeeError: string | null;
  refreshEmployees: () => void;
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
    department: u.department || "",
    joinDate: "",
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
    } else {
      setAnnouncements([]);
      setTasks([]);
      setEmployees([]);
    }
  }, [user.isAuthenticated, fetchAnnouncements, fetchTasks, fetchEmployees]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Step 1: Get JWT tokens
      const tokenRes = await api.post("/auth/token/", { username: usernameOrEmail, password });
      const { access, refresh } = tokenRes.data;
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);

      // Step 2: Fetch user profile
      const meRes = await api.get("/users/me/");
      const apiUser: ApiUser = meRes.data;

      setUser({
        isAuthenticated: true,
        role: mapDjangoRole(apiUser.role),
        djangoRole: apiUser.role,
        username: apiUser.username,
        email: apiUser.email,
        id: apiUser.id,
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
    setUser({ isAuthenticated: false, role: null, djangoRole: null, username: null, email: null, id: null });
  };

  // ── Announcement CRUD ─────────────────────────────────────────────────────
  const addAnnouncement = async (a: { title: string; content: string; is_high_priority: boolean }) => {
    await api.post("/announcements/", a);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: number) => {
    await api.delete(`/announcements/${id}/`);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const addTask = async (t: { title: string; description: string; priority: string; dueDate: string; assigned_to_id?: number }) => {
    const { dueDate, ...rest } = t;
    await api.post("/tasks/", { ...rest, due_date: dueDate || null });
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await api.delete(`/tasks/${id}/`);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = async (id: number, updates: Partial<{ status: string; priority: string; title: string; description: string; dueDate: string; assigned_to_id: number | null }>) => {
    // Optimistic update for instant drag-drop feel
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } as Task : t));
    try {
      const { dueDate, ...rest } = updates;
      const payload: Record<string, unknown> = { ...rest };
      if (dueDate !== undefined) payload.due_date = dueDate || null;
      await api.patch(`/tasks/${id}/`, payload);
    } catch {
      // Roll back on error
      fetchTasks();
    }
  };

  // ── Employee CRUD ─────────────────────────────────────────────────────────
  const addEmployee = async (e: Omit<MockEmployee, "id">) => {
    try {
      await api.post("/users/", {
        username: e.name,
        email: e.email,
        role: e.djangoRole || (e.role === "admin" ? "Admin" : "Employee"),
        password: "changeme123",
      });
      fetchEmployees();
    } catch {
      setEmployeeError("Failed to create user.");
    }
  };

  const updateEmployee = async (id: number, updates: Partial<MockEmployee>) => {
    try {
      const payload: Record<string, string> = {};
      if (updates.name) payload.username = updates.name;
      if (updates.email) payload.email = updates.email;
      if (updates.role) payload.role = updates.role === "admin" ? "Admin" : "Employee";
      await api.patch(`/users/${id}/`, payload);
      fetchEmployees();
    } catch {
      setEmployeeError("Failed to update user.");
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
