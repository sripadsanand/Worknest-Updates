import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, ApiUser, ChatGroup, GroupMessage } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, MessageCircle, Circle, ChevronLeft, Sparkles, Loader2, FileText,
  X, Plus, Users, Search, Hash, Shield, Check,
} from "lucide-react";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────
interface ChatMessage {
  id: number;
  sender: ApiUser | null;
  sender_id?: number;
  sender_name?: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

type ConversationMode = "dm" | "group";

// ─── Helpers ──────────────────────────────────────────────────────
function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function groupInitials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-rose-500/20 text-rose-400",
  Manager: "bg-violet-500/20 text-violet-400",
  Employee: "bg-blue-500/20 text-blue-400",
};

// ─── Component ────────────────────────────────────────────────────
export default function Chat() {
  const { user, employees, groups, loadingGroups, fetchGroups, createGroup } = useUser();

  // ── Conversation state ─────────────────────────────────────────
  const [mode, setMode] = useState<ConversationMode>("dm");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);

  // ── Sidebar search ─────────────────────────────────────────────
  const [contactSearch, setContactSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  // ── AI state ──────────────────────────────────────────────────
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // ── Create group modal ─────────────────────────────────────────
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Contact list (exclude self)
  const contactList: ApiUser[] = employees
    .filter(e => e.id !== user.id)
    .filter(e => e.name.toLowerCase().includes(contactSearch.toLowerCase()))
    .map(e => ({
      id: e.id,
      username: e.name,
      first_name: "",
      last_name: "",
      email: e.email,
      role: (e.djangoRole || "Employee") as ApiUser["role"],
      seniority: e.seniority,
      section: e.section,
      department: e.department,
      avatar: "",
      profile_image: null,
      phone: "",
      bio: "",
    }));

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  // Members available for group creation (exclude self)
  const memberCandidates = employees.filter(
    e => e.id !== user.id && e.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // ── Load DM history ────────────────────────────────────────────
  const loadDmHistory = useCallback(async (otherUser: ApiUser) => {
    setLoadingHistory(true);
    setMessages([]);
    try {
      const res = await api.get(`/chat/history/?with_user=${otherUser.id}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ── Load group message history ─────────────────────────────────
  const loadGroupHistory = useCallback(async (group: ChatGroup) => {
    setLoadingHistory(true);
    setMessages([]);
    try {
      const res = await api.get(`/groups/${group.id}/messages/`);
      const msgs: GroupMessage[] = res.data;
      setMessages(msgs.map(m => ({
        id: m.id,
        sender: m.sender,
        sender_id: m.sender?.id,
        sender_name: m.sender?.username,
        content: m.content,
        timestamp: m.timestamp,
        is_read: m.is_read,
      })));
    } catch (err) {
      console.error("Failed to load group history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────
  const openDmSocket = useCallback((otherUser: ApiUser) => {
    wsRef.current?.close();
    wsRef.current = null;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const wsBase = (import.meta.env.VITE_WS_URL as string | undefined) || "ws://127.0.0.1:8000";
    const ws = new WebSocket(`${wsBase}/ws/chat/${otherUser.id}/?token=${token}`);
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === "message") {
          setMessages(prev => [...prev, {
            id: data.id,
            sender: null,
            sender_id: data.sender_id,
            sender_name: data.sender_name,
            content: data.content,
            timestamp: data.timestamp,
            is_read: false,
          }]);
        }
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  const openGroupSocket = useCallback((group: ChatGroup) => {
    wsRef.current?.close();
    wsRef.current = null;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const wsBase = (import.meta.env.VITE_WS_URL as string | undefined) || "ws://127.0.0.1:8000";
    const ws = new WebSocket(`${wsBase}/ws/group/${group.id}/?token=${token}`);
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === "message") {
          setMessages(prev => [...prev, {
            id: data.id,
            sender: null,
            sender_id: data.sender_id,
            sender_name: data.sender_name,
            content: data.content,
            timestamp: data.timestamp,
            is_read: false,
          }]);
        }
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  // ── Select conversation ────────────────────────────────────────
  const selectContact = useCallback((contact: ApiUser) => {
    setMode("dm");
    setSelectedUser(contact);
    setSelectedGroup(null);
    setAiSuggestions([]);
    loadDmHistory(contact);
    openDmSocket(contact);
  }, [loadDmHistory, openDmSocket]);

  const selectGroup = useCallback((group: ChatGroup) => {
    setMode("group");
    setSelectedGroup(group);
    setSelectedUser(null);
    setAiSuggestions([]);
    loadGroupHistory(group);
    openGroupSocket(group);
  }, [loadGroupHistory, openGroupSocket]);

  // ── Cleanup WS on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = () => {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "send", content }));
    setInput("");
    setAiSuggestions([]);
  };

  // ── AI Features ────────────────────────────────────────────────
  const handleSuggestReply = async () => {
    if (messages.length === 0 || loadingSuggestions) return;
    setLoadingSuggestions(true);
    setAiSuggestions([]);
    try {
      const snippets = messages.slice(-8).map(m => {
        const name = m.sender ? m.sender.username : (m.sender_name || "?");
        return `${name}: ${m.content}`;
      });
      const { data } = await api.post("/ai/suggest-reply/", { messages: snippets });
      setAiSuggestions(data.suggestions || []);
    } catch {
      setAiSuggestions(["Got it!", "I'll look into this.", "Thanks for letting me know."]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSummarize = async () => {
    if (messages.length === 0 || loadingSummary) return;
    setLoadingSummary(true);
    setSummary(null);
    setShowSummaryModal(true);
    try {
      const snippets = messages.map(m => {
        const name = m.sender ? m.sender.username : (m.sender_name || "?");
        return `${name}: ${m.content}`;
      });
      const { data } = await api.post("/ai/summarize/", { messages: snippets });
      setSummary(data.summary);
    } catch {
      setSummary("Unable to summarize at the moment.");
    } finally {
      setLoadingSummary(false);
    }
  };

  // ── Create Group ───────────────────────────────────────────────
  const toggleMember = (id: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError(null);
    if (!groupName.trim()) return setGroupError("Group name is required.");
    if (selectedMemberIds.length < 1) return setGroupError("Select at least 1 other member.");
    setCreatingGroup(true);
    try {
      const newGroup = await createGroup(groupName.trim(), selectedMemberIds);
      setShowGroupModal(false);
      setGroupName("");
      setSelectedMemberIds([]);
      setMemberSearch("");
      selectGroup(newGroup);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setGroupError(data?.error || "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  // ── Derived header info ────────────────────────────────────────
  const headerTitle = mode === "group"
    ? (selectedGroup?.name ?? "")
    : (selectedUser?.username ?? "");

  const headerSub = mode === "group"
    ? `${selectedGroup?.member_count ?? 0} members`
    : (selectedUser?.role ?? "");

  const isConversationOpen = mode === "dm" ? !!selectedUser : !!selectedGroup;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="glass-card overflow-hidden flex h-[calc(100vh-180px)] min-h-[400px]">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`w-64 flex-shrink-0 border-r border-border flex flex-col bg-secondary/30 ${isConversationOpen ? "hidden md:flex" : "flex"}`}>
        
        {/* Direct Messages */}
        <div className="p-3 border-b border-border">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest mb-2 px-1">Direct Messages</p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {contactList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No contacts</p>
            )}
            {contactList.map(contact => (
              <button
                key={contact.id}
                onClick={() => selectContact(contact)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all ${
                  mode === "dm" && selectedUser?.id === contact.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                  {getInitials(contact.username)}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{contact.username}</span>
                  <span className="text-[10px] text-muted-foreground">{contact.role}</span>
                </div>
                <Circle className="h-2 w-2 fill-muted-foreground/30 text-muted-foreground/30 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Groups */}
        <div className="p-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest">Groups</p>
            <button
              onClick={() => { setShowGroupModal(true); setGroupError(null); setGroupName(""); setSelectedMemberIds([]); setMemberSearch(""); }}
              className="h-5 w-5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
              title="Create group"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              placeholder="Search groups…"
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {loadingGroups && (
              <div className="flex items-center justify-center py-4 gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            )}
            {!loadingGroups && filteredGroups.length === 0 && (
              <div className="py-6 text-center">
                <Users className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No groups yet.</p>
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Create one →
                </button>
              </div>
            )}
            {filteredGroups.map(group => (
              <button
                key={group.id}
                onClick={() => selectGroup(group)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all ${
                  mode === "group" && selectedGroup?.id === group.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {/* Group avatar */}
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0">
                  {groupInitials(group.name)}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{group.name}</span>
                  <span className="text-[10px] text-muted-foreground">{group.member_count} members</span>
                </div>
                <Hash className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
              </button>
            ))}
          </div>
          <button
            onClick={fetchGroups}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground text-center transition-colors"
          >
            ↻ Refresh groups
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      {!isConversationOpen ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base">Start a conversation</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a contact for direct messaging, or join a group chat.
            </p>
          </div>
          <button
            onClick={() => setShowGroupModal(true)}
            className="btn-primary text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Create Group
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-card flex-shrink-0">
            <button
              onClick={() => { setSelectedUser(null); setSelectedGroup(null); }}
              className="md:hidden p-1 rounded-lg hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {mode === "group" ? (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
                {groupInitials(headerTitle)}
              </div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {getInitials(headerTitle)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm truncate flex items-center gap-1.5">
                {mode === "group" && <Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                {headerTitle}
              </p>
              <p className="text-[10px] text-muted-foreground">{headerSub}</p>
            </div>
            {/* Member avatars for group */}
            {mode === "group" && selectedGroup && (
              <div className="flex -space-x-1.5 mr-2">
                {selectedGroup.members.slice(0, 4).map(m => (
                  <div
                    key={m.id}
                    title={m.username}
                    className="h-6 w-6 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary"
                  >
                    {m.username[0].toUpperCase()}
                  </div>
                ))}
                {selectedGroup.members.length > 4 && (
                  <div className="h-6 w-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] text-muted-foreground font-bold">
                    +{selectedGroup.members.length - 4}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              <span className="text-muted-foreground">{wsConnected ? "Live" : "Connecting…"}</span>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3">
            {loadingHistory && (
              <div className="text-center py-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
              </div>
            )}
            {!loadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                {mode === "group"
                  ? <Hash className="h-10 w-10 opacity-20" />
                  : <MessageCircle className="h-10 w-10 opacity-20" />
                }
                <p className="text-sm">No messages yet. Say hi! 👋</p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isMe = msg.sender
                ? msg.sender.id === user.id
                : msg.sender_id === user.id;
              const senderName = msg.sender ? msg.sender.username : (msg.sender_name || "Unknown");
              const showDateSep = i === 0 || formatDate(messages[i - 1].timestamp) !== formatDate(msg.timestamp);

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground">{formatDate(msg.timestamp)}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {/* Avatar for non-self in group */}
                    {!isMe && mode === "group" && (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary mr-1.5 mt-1 flex-shrink-0">
                        {senderName[0].toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-xs sm:max-w-md rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}>
                      {!isMe && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">{senderName}</p>
                      )}
                      {isMe && (
                        <p className="text-[10px] font-semibold text-primary-foreground/60 mb-0.5 text-right">You</p>
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/50 text-right" : "text-muted-foreground"}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* AI Suggestion Chips */}
          <AnimatePresence>
            {(aiSuggestions.length > 0 || loadingSuggestions) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-border px-3 py-2 bg-primary/3 flex items-center gap-2 flex-wrap"
              >
                <span className="text-[10px] text-primary font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI suggests:
                </span>
                {loadingSuggestions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(s); setAiSuggestions([]); }}
                      className="text-[11px] px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))
                )}
                <button onClick={() => setAiSuggestions([])} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input area */}
          <div className="border-t border-border p-3 bg-card space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestReply}
                disabled={messages.length === 0 || loadingSuggestions}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:bg-primary/10 disabled:opacity-40 transition-all"
              >
                {loadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                ✨ Suggest Reply
              </button>
              <button
                onClick={handleSummarize}
                disabled={messages.length === 0 || loadingSummary}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
              >
                {loadingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                Summarize
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={mode === "group"
                  ? `Message #${selectedGroup?.name ?? "group"}…`
                  : `Message ${selectedUser?.username ?? ""}…`
                }
                className="input-field flex-1"
                disabled={!wsConnected}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !wsConnected}
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {!wsConnected && (
              <p className="text-[10px] text-muted-foreground text-center">Connecting to chat server…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Create Group Modal ──────────────────────────────── */}
      <AnimatePresence>
        {showGroupModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setShowGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-surface p-6 w-full max-w-md max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Create Group
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {groupError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {groupError}
                </div>
              )}

              <form onSubmit={handleCreateGroup} className="flex flex-col gap-4 flex-1 min-h-0">
                {/* Group name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5">Group Name <span className="text-destructive">*</span></label>
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="input-field"
                    placeholder="e.g. Design Team, Sprint 42…"
                    autoFocus
                    required
                  />
                </div>

                {/* Member selection */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-medium mb-1.5">
                    Add Members <span className="text-muted-foreground">(you are included automatically)</span>
                  </label>
                  {selectedMemberIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedMemberIds.map(id => {
                        const emp = employees.find(e => e.id === id);
                        return emp ? (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                            {emp.name}
                            <button type="button" onClick={() => toggleMember(id)} className="hover:text-destructive transition-colors">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search teammates…"
                      className="input-field pl-8 text-sm"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 max-h-48 border border-border rounded-xl p-1 bg-background/50">
                    {memberCandidates.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                    )}
                    {memberCandidates.map(emp => {
                      const isSelected = selectedMemberIds.includes(emp.id);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleMember(emp.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground"
                          }`}
                        >
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            ROLE_COLORS[emp.djangoRole || "Employee"]
                          }`}>
                            {emp.name[0].toUpperCase()}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{emp.name}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.djangoRole} · {emp.department}</p>
                          </div>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          {emp.djangoRole === "Admin" && (
                            <Shield className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? "s" : ""} selected
                    {selectedMemberIds.length > 0 ? ` + you = ${selectedMemberIds.length + 1} total` : ""}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowGroupModal(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                  <button
                    type="submit"
                    disabled={creatingGroup || !groupName.trim() || selectedMemberIds.length < 1}
                    className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {creatingGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {creatingGroup ? "Creating…" : "Create Group"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Summary Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showSummaryModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setShowSummaryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-surface p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Conversation Summary
                </h3>
                <button onClick={() => setShowSummaryModal(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {loadingSummary ? (
                <div className="flex items-center gap-2 py-6 text-muted-foreground justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Generating summary…</span>
                </div>
              ) : (
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/40 rounded-xl p-4">
                  {summary}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
