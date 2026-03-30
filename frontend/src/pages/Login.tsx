import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Lock, Mail, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login } = useUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await login(email.trim(), password);
    if (!result.success) {
      setError(result.error || "Login failed.");
      setLoading(false);
      return;
    }
    navigate("/dashboard");
    setLoading(false);
  };

  const fillDemo = (type: "admin" | "user") => {
    // Django authenticates by username, not email.
    // Use the usernames created in Django admin.
    setEmail(type === "admin" ? "admin" : "user");
    setPassword("password");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex flex-1 bg-foreground text-background relative overflow-hidden items-center justify-center p-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/20 rounded-full blur-[100px]" />
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-card flex items-center justify-center">
              <span className="text-foreground font-display font-bold text-xl">W</span>
            </div>
            <span className="font-display font-bold text-2xl">WorkNest</span>
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-4 leading-tight">
            Your team's command center starts here.
          </h2>
          <p className="text-background/60 text-lg leading-relaxed">
            Tasks, chat, announcements & AI — all unified in one elegant workspace designed for modern teams.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["SC", "MR", "EZ", "JL"].map((initials, i) => (
                <div key={i} className="h-8 w-8 rounded-full bg-background/10 border-2 border-foreground flex items-center justify-center text-[10px] font-bold">
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-sm text-background/50">10,000+ teams already onboard</span>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>

          {/* Logo on mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-xl">W</span>
            </div>
            <span className="font-display font-bold text-xl">WorkNest</span>
          </div>

          <h1 className="font-display text-2xl font-extrabold tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to your WorkNest account</p>

          {/* Quick Demo */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => fillDemo("admin")}
              className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-all"
            >
              🛡️ Demo Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemo("user")}
              className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-all"
            >
              👤 Demo User
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="admin"
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-xs font-medium"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Authorized employees only · Contact IT for access
          </p>
        </motion.div>
      </div>
    </div>
  );
}
