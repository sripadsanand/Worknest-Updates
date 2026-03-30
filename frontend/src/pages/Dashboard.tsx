import { Outlet, NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, MessageCircle, CheckSquare, Megaphone,
  Sparkles, LogOut, Users, Menu, X, Bell, Search,
  ChevronLeft, ChevronRight, User as UserIcon
} from "lucide-react";
import { useState } from "react";
import CopilotPopup from "@/components/CopilotPopup";

export default function Dashboard() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard, end: true },
    { name: "My Profile", to: "/dashboard/profile", icon: UserIcon },
    { name: "Tasks", to: "/dashboard/tasks", icon: CheckSquare },
    { name: "Announcements", to: "/dashboard/announcements", icon: Megaphone },
    { name: "Chat", to: "/dashboard/chat", icon: MessageCircle },
    { name: "AI Copilot", to: "/dashboard/ai", icon: Sparkles },
    ...(user.djangoRole === "Admin" || user.role === "admin" ? [{ name: "User Mgmt", to: "/dashboard/users", icon: Users }] : []),
  ];

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Brand */}
      <div className={`h-16 flex items-center ${collapsed ? "justify-center px-2" : "px-5"} border-b border-border`}>
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-primary-foreground font-display font-bold text-lg">W</span>
        </div>
        {!collapsed && (
          <div className="ml-3">
            <div className="font-display font-bold text-sm tracking-wide text-foreground">WorkNest</div>
            <div className="text-[10px] text-muted-foreground capitalize">{user.role} Portal</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`
              }
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className={`border-t border-border p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          <Link to="/dashboard/profile" className="p-2 rounded-xl hover:bg-secondary transition-colors" title="Profile">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {(user.username || "U")[0].toUpperCase()}
            </div>
          </Link>
        ) : (
          <Link to="/dashboard/profile" className="flex items-center justify-between hover:bg-secondary p-1.5 -mx-1.5 rounded-xl transition-colors cursor-pointer overflow-hidden">
            <div className="flex flex-1 items-center gap-2.5 min-w-0 text-left">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {(user.username || "U")[0].toUpperCase()}
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-foreground truncate">{user.username}</p>
                <p className="text-[10px] text-muted-foreground capitalize truncate">{user.role}</p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen ${collapsed ? "w-[72px]" : "w-64"} flex-shrink-0 flex-col bg-card border-r border-border transition-all duration-300 z-40`}
      >
        <SidebarContent />
        <div className="px-2 pb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col bg-card border-r border-border md:hidden shadow-xl"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-all duration-300 ${collapsed ? "md:ml-[72px]" : "md:ml-64"}`}>
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-card sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <h1 className="font-display text-lg font-semibold">
              Welcome back, <span className="text-primary">{user.username || "User"}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-xl hover:bg-secondary transition-colors hidden sm:block">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs text-muted-foreground font-medium mr-2">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="capitalize">{user.role} Access</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 text-muted-foreground transition-all ml-1 sm:ml-0 shadow-sm" title="Log out of your account">
              <LogOut className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline-block">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Global Floating AI Copilot — visible on every dashboard page */}
      <CopilotPopup />
    </div>
  );
}
