"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap, Code2, Layers, Wand2, GitBranch, Shield, Repeat2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";

const figmaLogo = (
  <svg viewBox="0 0 38 57" fill="currentColor" className="h-[18px] w-[18px]">
    <path d="M19 28.5a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM0 47.5A9.5 9.5 0 019.5 38H19v9.5a9.5 9.5 0 01-19 0zM19 0v19h9.5a9.5 9.5 0 000-19H19zM0 9.5A9.5 9.5 0 019.5 0H19v19H9.5A9.5 9.5 0 010 9.5zM0 28.5A9.5 9.5 0 019.5 19H19v19H9.5A9.5 9.5 0 010 28.5z" />
  </svg>
);

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  size: "normal" | "large";
  visual: string;
};

const FEATURE_SPEED: Feature = {
  icon: <Zap size={18} />,
  title: "2 min cloning",
  description: "Distributed AI pipeline processes even complex sites in about 2 minutes.",
  tag: "Speed",
  size: "large",
  visual: "speed",
};

const FEATURE_CODE: Feature = {
  icon: <Code2 size={18} />,
  title: "Clean code output",
  description: "Export semantic React + Tailwind components. Production-ready architecture.",
  tag: "Code",
  size: "normal",
  visual: "code",
};

const FEATURE_EDITOR: Feature = {
  icon: <Layers size={18} />,
  title: "Visual editor",
  description: "Click any element to edit text, colors, spacing or layout. Pixel-level precision.",
  tag: "Editor",
  size: "normal",
  visual: "editor",
};



const FEATURE_FIGMA: Feature = {
  icon: figmaLogo,
  title: "Figma export",
  description: "Convert any website into editable Figma designs.",
  tag: "Design",
  size: "normal",
  visual: "figma",
};

const FEATURE_GITHUB: Feature = {
  icon: <GitBranch size={18} />,
  title: "GitHub integration",
  description: "Push clones directly to a repo. Commit history, branches, and PRs built in.",
  tag: "DevOps",
  size: "large",
  visual: "github",
};

const FEATURE_SECURITY: Feature = {
  icon: <Shield size={18} />,
  title: "Privacy-first",
  description: "We never store your website content beyond your session. SOC 2 Type II.",
  tag: "Security",
  size: "normal",
  visual: "security",
};

const FEATURE_MULTIPAGE: Feature = {
  icon: <Globe size={18} />,
  title: "Multi-page cloning",
  description: "Clone entire site structures — linked pages, shared layouts — all in one pass.",
  tag: "Scale",
  size: "normal",
  visual: "multipage",
};



function FeatureVisual({ visual }: { visual: string }) {
  if (visual === "speed") return (
    <div className="space-y-2.5 mt-auto pt-4">
      {["Fetch", "Parse", "Generate", "Optimize"].map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <div className="h-1.5 rounded-full flex-1 overflow-hidden bg-white/10">
            <div className="h-full rounded-full bg-white/60" style={{ width: `${[85, 65, 72, 90][i]}%` }} />
          </div>
          <span className="text-[10px] font-mono w-10 text-right shrink-0 text-white/35">{["18s", "32s", "51s", "…"][i]}</span>
        </div>
      ))}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.08]">
        <span className="text-xs text-white/40">Total</span>
        <span className="text-lg font-bold text-white">2m</span>
      </div>
    </div>
  );

  if (visual === "code") return (
    <div className="mt-auto rounded-xl overflow-hidden border border-white/10 text-[10px] font-mono leading-relaxed bg-[#0d0d14]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-white/[0.04]">
        <div className="w-2 h-2 rounded-full bg-red-500/50" /><div className="w-2 h-2 rounded-full bg-yellow-500/50" /><div className="w-2 h-2 rounded-full bg-green-500/50" />
        <span className="ml-1 text-white/25">HeroSection.tsx</span>
      </div>
      <div className="p-3">
        <div><span className="text-purple-400">export function </span><span className="text-white/70">Hero</span><span className="text-white/30">() {"{"}</span></div>
        <div className="ml-4"><span className="text-white/25">return (</span></div>
        <div className="ml-6"><span className="text-white/25">{"<"}</span><span className="text-emerald-400">section</span></div>
        <div className="ml-8"><span className="text-amber-300">className</span><span className="text-white/25">="</span><span className="text-lime-300">py-24</span><span className="text-white/25">"</span></div>
        <div className="ml-6 opacity-20">{"// AI-generated ✓"}</div>
      </div>
    </div>
  );

  if (visual === "ai") return (
    <div className="mt-auto space-y-2">
      <div className="rounded-xl p-3 bg-white/[0.05] border border-white/10">
        <p className="text-[10px] mb-1 text-white/30 font-medium">You</p>
        <p className="text-xs italic text-white/50">&ldquo;Make it more minimal, clean white.&rdquo;</p>
      </div>
      <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.07]">
        <p className="text-[10px] font-semibold mb-1.5 text-white/50">Clonyfy</p>
        <p className="text-xs text-white/40">Redesigning hero, nav, CTA…</p>
        <div className="flex gap-1 mt-2">{[0,1,2].map((i)=><div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" style={{ animation: `pulse-brand 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
      </div>
    </div>
  );

  if (visual === "github") return (
    <div className="mt-auto space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center"><GitBranch size={11} className="text-white/40" /></div>
        <span className="text-xs font-mono text-white/35">myorg / clone-output</span>
      </div>
      {[{ msg: "feat: add pricing section", time: "2m ago", color: "bg-emerald-500" }, { msg: "feat: update hero layout", time: "1h ago", color: "bg-sky-500" }, { msg: "chore: initial clone", time: "2h ago", color: "bg-violet-500" }].map((c) => (
        <div key={c.msg} className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${c.color} shrink-0`} />
          <span className="text-[11px] font-mono flex-1 truncate text-white/40">{c.msg}</span>
          <span className="text-[10px] text-white/25 shrink-0">{c.time}</span>
        </div>
      ))}
    </div>
  );

  if (visual === "security") return (
    <div className="mt-auto flex flex-col items-center text-center space-y-3 pt-2">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Shield size={24} className="text-emerald-400" /></div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {["SOC 2 Type II", "AES-256", "Zero logs", "GDPR"].map((b) => (<span key={b} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-white/40">{b}</span>))}
      </div>
    </div>
  );

  if (visual === "sync") return (
    <div className="mt-auto space-y-2">
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/[0.04] border border-white/[0.08]">
        <div className="w-2 h-2 rounded-full animate-pulse bg-white/40 shrink-0" />
        <span className="text-xs text-white/45">Watching website.com/pricing…</span>
        <span className="text-[10px] ml-auto text-white/25 shrink-0">Active</span>
      </div>
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20">
        <span className="text-[10px] font-semibold text-emerald-400">↺ Re-cloned</span>
        <span className="text-[10px] text-emerald-400/60">Source changed — synced in 8s</span>
      </div>
    </div>
  );

  if (visual === "editor") return (
    <div className="mt-auto space-y-2">
      <div className="rounded-xl p-3 space-y-2.5 bg-white/[0.04] border border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Selected: Button</span>
          <span className="text-[10px] text-white/25">1 element</span>
        </div>
        {[{ label: "Background", value: "#0e0e16" }, { label: "Font size", value: "14px" }, { label: "Radius", value: "12px" }].map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-white/35">{p.label}</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/10"><span className="text-[10px] font-mono text-white/55">{p.value}</span></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (visual === "figma") return (
    <div className="mt-auto pt-3">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/45">Figma file</span>
          <span className="text-[10px] text-white/25">Editable</span>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg border border-white/[0.08] bg-white/[0.04]" />
          ))}
          <div className="col-span-3 h-10 rounded-lg border border-white/[0.08] bg-white/[0.02]" />
        </div>
      </div>
    </div>
  );

  if (visual === "multipage") return (
    <div className="mt-auto space-y-1.5">
      {[{ label: "/ Homepage", active: false }, { label: "/pricing", active: true }, { label: "/features", active: false }, { label: "/docs · 12 sub-pages", active: false }].map((p) => (
        <div key={p.label} className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${p.active ? "bg-white/[0.08] border-white/20" : "bg-white/[0.03] border-white/[0.07]"}`}>
          <span className={`text-[10px] font-mono flex-1 ${p.active ? "text-white font-medium" : "text-white/35"}`}>{p.label}</span>
          <span className="text-[10px] text-white/25">Cloned ✓</span>
        </div>
      ))}
    </div>
  );

  return null;
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export function FeaturesSection() {
  const [hovered, setHovered] = useState<string | null>(null);

  const features = [FEATURE_SPEED, FEATURE_CODE, FEATURE_EDITOR, FEATURE_FIGMA, FEATURE_GITHUB, FEATURE_SECURITY, FEATURE_MULTIPAGE];

  return (
    <section id="features" className="relative py-40 overflow-hidden bg-black border-b border-white/[0.06]">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-24">
          <motion.p
            initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] mb-6 px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] text-white/55"
          >
            THE FEATURES
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 }}
            className="whitespace-nowrap bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-[clamp(16px,4.1vw,50px)] font-black tracking-tight text-transparent leading-tight"
          >
            Everything you need, nothing you don't.
          </motion.h2>
         
        </div>

        {/* Bento grid */}
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-200px" }}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr grid-flow-dense"
        >
          {features.map((f, i) => {
            const isHovered = hovered === f.title;
            const cardVariant: Variants = { hidden: { opacity: 0, y: 40, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: "easeOut" } } };
            return (
              <motion.div
                key={f.title} variants={cardVariant} layout="position"
                className={cn("relative rounded-2xl p-8 flex flex-col cursor-default transition-all duration-300 overflow-hidden group", f.size === "large" ? "lg:col-span-2" : "")}
                style={{
                  background: isHovered ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isHovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: isHovered ? "0 0 0 1px rgba(255,255,255,0.06) inset" : "none",
                }}
                whileHover={{ y: -6 }}
                onMouseEnter={() => setHovered(f.title)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Top line on hover */}
                {isHovered && (
                  <div className="absolute top-0 inset-x-0 h-px pointer-events-none bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                )}

                {/* Tag + Icon */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/40">{f.tag}</span>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border", isHovered ? "bg-white text-black border-white shadow-lg shadow-white/10" : "bg-white/[0.06] border-white/10 text-white/50")}>{f.icon}</div>
                </div>

                <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/45 flex-1">{f.description}</p>
                <FeatureVisual visual={f.visual} />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
