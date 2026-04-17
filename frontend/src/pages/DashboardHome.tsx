import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { motion } from "framer-motion";
import {
  CheckSquare, Megaphone, MessageCircle, Users,
  ArrowRight, TrendingUp, Clock, AlertTriangle
} from "lucide-react";

export default function DashboardHome() {
  const navigate = useNavigate();
  const { tasks, announcements, user, employees } = useUser();

  const pendingTasks = tasks.filter(t => t.status !== "done").length;
  const completedTasks = tasks.filter(t => t.status === "done").length;
  const highPriAnnouncements = announcements.filter(a => a.is_high_priority).length;

  const userStats = [
    { label: "Pending Tasks", value: pendingTasks, icon: CheckSquare, color: "text-primary", bg: "bg-primary/10", to: "/dashboard/tasks" },
    { label: "Completed", value: completedTasks, icon: TrendingUp, color: "text-success", bg: "bg-success/10", to: "/dashboard/tasks" },
    { label: "Announcements", value: announcements.length, icon: Megaphone, color: "text-warning", bg: "bg-warning/10", to: "/dashboard/announcements" },
    { label: "Team Chat", value: "Live", icon: MessageCircle, color: "text-primary", bg: "bg-primary/10", to: "/dashboard/chat" },
  ];

  const adminStats = [
    { label: "Total Users", value: employees.length, icon: Users, color: "text-primary", bg: "bg-primary/10", to: "/dashboard/users" },
    { label: "Active Tasks", value: pendingTasks, icon: CheckSquare, color: "text-warning", bg: "bg-warning/10", to: "/dashboard/tasks" },
    { label: "High Priority", value: highPriAnnouncements, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", to: "/dashboard/announcements" },
  ];

  const stats = user.role === "admin" ? adminStats : userStats;
  const recentAnnouncements = announcements.slice(0, 3);
  const urgentTasks = tasks.filter(t => t.status !== "done" && t.priority === "high").slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:flex gap-4">
        {stats.map((s, i) => (
          <motion.button
            key={s.label}
            onClick={() => navigate(s.to)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bento-item group flex-1"
          >
            <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-display font-bold mt-1">{s.value}</p>
            <ArrowRight className="h-4 w-4 mt-2 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </motion.button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
        {/* Recent Announcements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Recent Announcements</h3>
            <button onClick={() => navigate("/dashboard/announcements")} className="text-xs text-primary hover:underline font-medium">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {recentAnnouncements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${a.is_high_priority ? "bg-destructive" : "bg-primary"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.author?.username || "Admin"} · {new Date(a.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  a.is_high_priority ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"
                }`}>
                  {a.is_high_priority ? "High Priority" : "General"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Urgent Tasks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <h3 className="font-display font-bold text-lg mb-3">Urgent Tasks</h3>
            {urgentTasks.length > 0 ? (
              <div className="space-y-2">
                {urgentTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-destructive/5 border border-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No date"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No urgent tasks 🎉</p>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6 space-y-3"
          >
            <h3 className="font-display font-bold text-lg">Quick Actions</h3>
            <button onClick={() => navigate("/dashboard/tasks")} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
              + New Task
            </button>
            <button onClick={() => navigate("/dashboard/ai")} className="w-full py-2.5 rounded-xl border border-primary/30 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors">
              ✨ AI Copilot
            </button>
            <button onClick={() => navigate("/dashboard/chat")} className="w-full py-2.5 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-secondary transition-colors">
              Open Chat
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
