/**
 * CopilotPopup.tsx
 * Floating AI Copilot button + expandable chat window.
 * Lives in the bottom-right corner of the app, always visible after login.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, ChevronDown, User } from "lucide-react";
import { useUser } from "@/context/UserContext";
import api from "@/services/api";

interface AiMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS: { label: string; msg: string }[] = [
  { label: "📋 My priorities", msg: "What are my current priorities?" },
  { label: "📝 Draft update", msg: "Draft a quick status update email for my tasks." },
  { label: "📢 Explain announcements", msg: "Summarize the latest announcements for me." },
  { label: "💡 Help me reply", msg: "Help me write a professional message to my manager." },
];

function renderMarkdown(text: string) {
  // Very lightweight: bold **text**, bullet points
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[•\-]\s(.+)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul class='list-disc list-inside space-y-1'>$1</ul>")
    .replace(/\n/g, "<br/>");
}

export default function CopilotPopup() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 0,
        role: "assistant",
        content: `Hey ${user.username || "there"} 👋 I'm your WorkNest Copilot.\n\nI know your role (**${user.djangoRole || "Employee"}**), your tasks, and latest announcements. Ask me anything!`,
      }]);
    }
  }, [open]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: AiMsg = { id: Date.now(), role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const { data } = await api.post("/ai/chat/", { message: msg, history });
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: data.response }]);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      const errText = errData?.error || "I couldn't reach the AI service. Please try again.";
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: `⚠️ ${errText}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!user.isAuthenticated) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="w-[360px] h-[500px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold font-display">WorkNest Copilot</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> AI · {user.djangoRole || "Employee"} Mode
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[260px] rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  }`}>
                    {msg.role === "assistant" ? (
                      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-6 w-6 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3 w-3 text-primary animate-pulse" />
                  </div>
                  <div className="bg-secondary rounded-xl rounded-bl-sm px-3 py-2.5">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                          style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Quick actions (only show if few messages) */}
              {messages.length <= 1 && !loading && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_ACTIONS.map(a => (
                    <button
                      key={a.label}
                      onClick={() => send(a.msg)}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 bg-card">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask me anything..."
                  disabled={loading}
                  className="flex-1 bg-secondary rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 disabled:opacity-50 transition-all"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="relative h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        style={{ boxShadow: "0 4px 24px rgba(var(--primary-rgb, 99,102,241),0.5)" }}
        aria-label="Open AI Copilot"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Pulse ring */}
        {!open && (
          <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/30 pointer-events-none" style={{ animationDuration: "2.5s" }} />
        )}
      </motion.button>
    </div>
  );
}
