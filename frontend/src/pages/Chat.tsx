import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, ApiUser } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, Circle, ChevronLeft, Sparkles, Loader2, FileText, X } from "lucide-react";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────
interface ChatMessage {
  id: number;
  sender: ApiUser | null;
  sender_id?: number;
  sender_name?: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────
function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────
export default function Chat() {
  const { user, employees } = useUser();

  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);

  // AI state
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Convert employees list to ApiUser shape for the sidebar
  const contactList: ApiUser[] = employees
    .filter(e => e.id !== user.id)
    .map(e => ({
      id: e.id,
      username: e.name,
      first_name: "",
      last_name: "",
      email: e.email,
      role: (e.djangoRole || "Employee") as ApiUser["role"],
      department: e.department,
      avatar: "",
    }));

  // ── Load history from REST ──────────────────────────────────────────
  const loadHistory = useCallback(async (otherUser: ApiUser) => {
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

  // ── Open WebSocket ──────────────────────────────────────────────────
  const openWebSocket = useCallback((otherUser: ApiUser) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

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
          const incomingMsg: ChatMessage = {
            id: data.id,
            sender: null,
            sender_id: data.sender_id,
            sender_name: data.sender_name,
            content: data.content,
            timestamp: data.timestamp,
            is_read: false,
          };
          setMessages(prev => [...prev, incomingMsg]);
        }
      } catch { /* ignore */ }
    };

    wsRef.current = ws;
  }, []);

  // ── Select a user to chat with ──────────────────────────────────────
  const selectUser = useCallback((contact: ApiUser) => {
    setSelectedUser(contact);
    loadHistory(contact);
    openWebSocket(contact);
  }, [loadHistory, openWebSocket]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────
  const sendMessage = () => {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ action: "send", content }));
    setInput("");
    setAiSuggestions([]); // clear suggestions on new send
  };

  // ── AI Suggest Reply ────────────────────────────────────────────────
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

  // ── AI Summarize ────────────────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="glass-card overflow-hidden flex h-[calc(100vh-180px)] min-h-[400px]">

      {/* Sidebar: contact list */}
      <aside className={`w-64 flex-shrink-0 border-r border-border flex flex-col bg-secondary/30 ${selectedUser ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-bold text-sm">Direct Messages</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{contactList.length} contacts</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {contactList.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-6 px-4">No contacts available.</p>
          )}
          {contactList.map(contact => (
            <button
              key={contact.id}
              onClick={() => selectUser(contact)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                selectedUser?.id === contact.id
                  ? "bg-primary/10 text-primary border-r-2 border-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {getInitials(contact.username)}
              </div>
              <div className="text-left min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{contact.username}</span>
                <span className="text-[10px] text-muted-foreground">{contact.role}</span>
              </div>
              <Circle className="h-2 w-2 fill-muted-foreground/40 text-muted-foreground/40 flex-shrink-0" />
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      {!selectedUser ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base">Start a conversation</h3>
            <p className="text-sm text-muted-foreground mt-1">Select a contact from the left panel to start messaging.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-card flex-shrink-0">
            <button
              onClick={() => setSelectedUser(null)}
              className="md:hidden p-1 rounded-lg hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {getInitials(selectedUser.username)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm truncate">{selectedUser.username}</p>
              <p className="text-[10px] text-muted-foreground">{selectedUser.role}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              <span className="text-muted-foreground">{wsConnected ? "Connected" : "Connecting…"}</span>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3">
            {loadingHistory && (
              <div className="text-center py-8 text-sm text-muted-foreground">Loading messages…</div>
            )}

            {!loadingHistory && messages.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No messages yet. Say hi! 👋
              </div>
            )}

            {messages.map((msg, i) => {
              // Determine sender - fallback to sender_id comparison
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
                    <div className={`max-w-xs sm:max-w-md rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}>
                      {!isMe && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">{senderName}</p>
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
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
                <button
                  onClick={() => setAiSuggestions([])}
                  className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="border-t border-border p-3 bg-card space-y-2">
            {/* AI Toolbar */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestReply}
                disabled={messages.length === 0 || loadingSuggestions}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:bg-primary/10 disabled:opacity-40 transition-all"
              >
                {loadingSuggestions
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Sparkles className="h-3 w-3" />
                }
                ✨ Suggest Reply
              </button>
              <button
                onClick={handleSummarize}
                disabled={messages.length === 0 || loadingSummary}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
              >
                {loadingSummary
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <FileText className="h-3 w-3" />
                }
                Summarize
              </button>
            </div>
            {/* Message input */}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder={`Message ${selectedUser.username}…`}
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

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setShowSummaryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
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
