import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Zap, Shield, BarChart3, MessageCircle,
  CheckSquare, Sparkles, Globe, Lock, Star, Users,
  Layers, ChevronRight, Check, Play, ArrowUpRight,
  Twitter, Linkedin, Github,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const features = [
  { icon: Zap, title: "Lightning Fast", desc: "Real-time updates across your entire workspace with sub-200ms response times.", color: "bg-amber-50 text-amber-600" },
  { icon: Shield, title: "Role-Based Access", desc: "Admin & user roles with granular permission controls and secure authentication.", color: "bg-blue-50 text-blue-600" },
  { icon: BarChart3, title: "Smart Dashboard", desc: "Bento-grid analytics with beautiful data visualizations and actionable insights.", color: "bg-emerald-50 text-emerald-600" },
  { icon: MessageCircle, title: "Team Chat", desc: "Instant messaging with organized channels, threads, and real-time presence.", color: "bg-purple-50 text-purple-600" },
  { icon: CheckSquare, title: "Kanban Board", desc: "Visual task management with drag-and-drop, priorities, and due date tracking.", color: "bg-rose-50 text-rose-600" },
  { icon: Sparkles, title: "AI Copilot", desc: "Intelligent assistant that summarizes, drafts emails, and prioritizes your work.", color: "bg-indigo-50 text-indigo-600" },
];

const stats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "10k+", label: "Active Teams" },
  { value: "<200ms", label: "Avg Response" },
  { value: "4.9/5", label: "User Rating" },
];

const testimonials = [
  { name: "Sarah Chen", role: "Head of Product, Acme Inc", content: "WorkNest transformed how our team communicates. The AI copilot alone saves us hours every week.", avatar: "SC" },
  { name: "Marcus Rivera", role: "CTO, TechFlow", content: "We evaluated 12 tools before choosing WorkNest. The Kanban board and real-time chat integration is unmatched.", avatar: "MR" },
  { name: "Emily Zhang", role: "VP Eng, ScaleUp", content: "The cleanest internal comms tool we've ever used. Our team adoption rate was 95% in the first week.", avatar: "EZ" },
];

const pricingPlans = [
  { name: "Starter", price: "$0", period: "/month", desc: "For small teams getting started", features: ["Up to 10 users", "Basic Kanban board", "5 channels", "Community support"], cta: "Get Started Free", popular: false },
  { name: "Pro", price: "$12", period: "/user/mo", desc: "For growing teams that need more", features: ["Unlimited users", "Advanced analytics", "AI Copilot", "Priority support", "Custom integrations"], cta: "Start Free Trial", popular: true },
  { name: "Enterprise", price: "Custom", period: "", desc: "For large organizations", features: ["Everything in Pro", "SSO & SAML", "Dedicated CSM", "99.99% SLA", "On-premise option"], cta: "Contact Sales", popular: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-lg font-display">W</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight">WorkNest</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link to="/login" className="btn-primary text-sm px-5 py-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 animated-gradient-bg">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] float-orb" />
        <div className="absolute top-40 right-1/4 w-[350px] h-[350px] bg-purple-500/5 rounded-full blur-[100px] float-orb-delayed" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="section-badge mb-8">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Now in Public Beta — Free to use
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground">
              The Operating System{" "}
              <br className="hidden sm:block" />
              for{" "}
              <span className="gradient-text-hero">Modern Teams</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Tasks, announcements, chat & AI — unified in one beautiful platform.
              Built for teams that move fast and think bigger.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login" className="btn-primary text-base px-8 py-4 rounded-2xl group shadow-md shadow-primary/20">
                Start For Free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#features" className="btn-ghost text-base px-8 py-4 rounded-2xl group">
                <Play className="h-4 w-4" />
                Watch Demo
              </a>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              No credit card required · Free plan available · Setup in 2 minutes
            </p>
          </motion.div>

          {/* Product Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 relative"
          >
            <div className="relative mx-auto max-w-4xl">
              <div className="bg-card rounded-2xl border border-border shadow-2xl shadow-primary/5 overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 mx-8">
                    <div className="h-7 bg-background rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                      app.worknest.io/dashboard
                    </div>
                  </div>
                </div>
                {/* Mock dashboard */}
                <div className="p-6 bg-background/50">
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {["12 Tasks", "4 Unread", "3 Updates", "AI Ready"].map((label, i) => (
                      <div key={i} className="bg-card rounded-xl p-4 border border-border">
                        <div className={`h-8 w-8 rounded-lg mb-2 ${["bg-blue-50", "bg-purple-50", "bg-amber-50", "bg-emerald-50"][i]}`} />
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="text-lg font-display font-bold mt-1">{["12", "4", "3", "✨"][i]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-card rounded-xl p-4 border border-border h-32">
                      <div className="text-sm font-semibold mb-2">Recent Activity</div>
                      <div className="space-y-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <div className="h-2.5 bg-secondary rounded-full" style={{ width: `${60 + i * 12}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-card rounded-xl p-4 border border-border h-32">
                      <div className="text-sm font-semibold mb-2">Quick Actions</div>
                      <div className="space-y-2">
                        <div className="h-8 bg-primary/10 rounded-lg" />
                        <div className="h-8 bg-secondary rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5 rounded-3xl blur-2xl -z-10" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Logos / Social Proof */}
      <section className="py-12 px-6 border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-6 uppercase tracking-wider font-medium">Trusted by forward-thinking teams</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 text-muted-foreground/40">
            {["Acme Corp", "TechFlow", "ScaleUp", "Velocity", "NexGen"].map(name => (
              <span key={name} className="font-display font-bold text-xl tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-card">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              {...fadeUp}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <p className="text-3xl sm:text-4xl font-display font-extrabold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div className="section-badge mb-4 mx-auto w-fit">
              <Layers className="h-3.5 w-3.5" /> Features
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold mb-4">
              Everything your team needs
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              One platform. Zero friction. Built for teams that demand the best.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ delay: i * 0.08 }}
                className="glass-card-hover p-6 group"
              >
                <div className={`h-12 w-12 rounded-xl ${f.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ChevronRight className="h-4 w-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Section */}
      <section className="py-24 px-6 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div {...fadeUp}>
            <div className="section-badge mb-4">
              <Sparkles className="h-3.5 w-3.5" /> AI-Powered
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
              Your AI workspace copilot
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Let AI handle the busy work. Summarize updates, draft communications,
              and intelligently prioritize your tasks — all from one command interface.
            </p>
            <ul className="space-y-3">
              {["Summarize announcements in seconds", "Draft professional emails automatically", "Smart task prioritization", "Context-aware team messages"].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/login" className="btn-primary mt-8 group">
              Try AI Copilot <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="relative">
            <div className="bg-background rounded-2xl border border-border p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">AI Copilot</div>
                  <div className="text-xs text-muted-foreground">Your workspace assistant</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 text-sm max-w-xs">
                    Summarize today's announcements
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 text-sm max-w-sm">
                    <p className="font-medium mb-1">📋 Here's your summary:</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      2 high-priority items: Q2 launch timeline (May) and security training deadline. 1 general update on the new hybrid work policy.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {["📧 Draft email", "🎯 Priorities", "💬 Message"].map(label => (
                  <div key={label} className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground bg-background">
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -inset-4 bg-primary/3 rounded-3xl blur-2xl -z-10" />
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div className="section-badge mb-4 mx-auto w-fit">
              <Star className="h-3.5 w-3.5" /> Testimonials
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
              Loved by teams everywhere
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              See why thousands of teams rely on WorkNest every day.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                {...fadeUp}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  "{t.content}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div className="section-badge mb-4 mx-auto w-fit">
              <Layers className="h-3.5 w-3.5" /> Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Start free. Upgrade when you need to. No surprises.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                {...fadeUp}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-6 border ${
                  plan.popular
                    ? "border-primary bg-background shadow-lg shadow-primary/5 relative"
                    : "border-border bg-background"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-display font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all block ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                      : "border border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeUp} className="relative">
            <div className="rounded-3xl p-12 sm:p-16 bg-foreground text-background relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px]" />
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
                  Ready to transform your team?
                </h2>
                <p className="text-background/70 mb-8 max-w-lg mx-auto text-lg">
                  Join 10,000+ teams already using WorkNest to work smarter, not harder.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-card text-foreground font-semibold text-base hover:bg-card/90 transition-all group shadow-lg">
                    Get Started Free
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
                <p className="text-xs text-background/50 mt-6">
                  Demo: admin@worknest.com / user@worknest.com · password: <code className="text-background/70">password</code>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">W</span>
                </div>
                <span className="font-display font-bold text-lg">WorkNest</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The modern workspace platform for teams that demand excellence.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© 2026 WorkNest. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Linkedin className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Github className="h-5 w-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
