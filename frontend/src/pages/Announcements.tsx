import { useState } from "react";
import { useUser, Announcement } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Search, Loader2 } from "lucide-react";

export default function Announcements() {
  const { user, announcements, loadingAnnouncements, addAnnouncement, deleteAnnouncement } = useUser();
  const canManage = user.djangoRole === "Admin" || user.djangoRole === "Manager";

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newHighPriority, setNewHighPriority] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "high" | "general">("all");
  const [saving, setSaving] = useState(false);

  const filtered = announcements.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filterType === "all" ||
      (filterType === "high" && a.is_high_priority) ||
      (filterType === "general" && !a.is_high_priority);
    return matchSearch && matchFilter;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await addAnnouncement({
        title: newTitle.trim(),
        content: newContent.trim(),
        is_high_priority: newHighPriority,
      });
      setNewTitle(""); setNewContent(""); setNewHighPriority(false); setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  if (loadingAnnouncements) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading announcements…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Announcements</h2>
          <p className="text-sm text-muted-foreground mt-1">Company-wide updates and important notices.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> New Post
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search announcements..." className="input-field pl-10" />
        </div>
        <div className="flex gap-2">
          {(["all", "high", "general"] as const).map(f => (
            <button
              key={f} onClick={() => setFilterType(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                filterType === f ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "high" ? "🔴 High" : "🟢 General"}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center text-muted-foreground text-sm">No announcements found.</div>
        )}
        {filtered.map((item, i) => (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card-hover p-5 relative group"
          >
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                item.is_high_priority
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-secondary text-muted-foreground border border-border"
              }`}>
                {item.is_high_priority ? "High Priority" : "General"}
              </span>
              {canManage && (
                <button
                  onClick={() => deleteAnnouncement(item.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <header className="mb-3 pr-48">
              <h3 className="text-base font-display font-bold">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Posted by <span className="font-medium text-foreground">{item.author?.username || "Admin"}</span> · {formatDate(item.created_at)}
              </p>
            </header>
            <p className={`text-sm text-muted-foreground leading-relaxed transition-all ${expandedId === item.id ? "" : "line-clamp-2"}`}>
              {item.content}
            </p>
            <button
              onClick={() => setExpandedId(curr => (curr === item.id ? null : item.id))}
              className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {expandedId === item.id ? "Show Less" : "Read More →"}
            </button>
          </motion.article>
        ))}
      </div>

      {/* Create Modal */}
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
                <h3 className="font-display font-bold text-lg">New Announcement</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Title</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input-field" placeholder="Announcement title" autoFocus required />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox" id="highprio" checked={newHighPriority}
                    onChange={e => setNewHighPriority(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="highprio" className="text-xs font-medium">Mark as high priority</label>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Content</label>
                  <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={4} className="input-field resize-none" placeholder="Write your announcement..." required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary text-xs px-5 py-2">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {saving ? "Publishing…" : "Publish"}
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
