"use client";

import { motion } from "framer-motion";
import { Cloud, FileArchive, GitBranch, Rocket, ShieldCheck } from "lucide-react";

const exportOptions = [
  { icon: <FileArchive size={20} />, label: "Clean ZIP", detail: "Download the full project" },
  { icon: <GitBranch size={20} />, label: "GitHub", detail: "Push code to your repo" },
  { icon: <Rocket size={20} />, label: "Vercel", detail: "Deploy in one click" },
  { icon: <Cloud size={20} />, label: "Netlify", detail: "Ship to any host" },
];

export function FreedomSection() {
  return (
    <section id="freedom" className="relative overflow-hidden border-b border-white/[0.06] bg-black py-32">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 40%, rgba(255,255,255,0.055) 0%, rgba(0,0,0,0) 64%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/30"
          >
            Freedom
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.08 }}
            className="mx-auto max-w-6xl text-[clamp(18px,5.2vw,72px)] font-black leading-tight tracking-tight text-white"
          >
            <span className="whitespace-nowrap bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
              Zero dependencies, total freedom.
            </span>
            <br />
            <span className="whitespace-nowrap text-white/35">Your code. Your rules.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mx-auto mt-8 max-w-4xl text-base leading-relaxed text-white/45 sm:text-xl"
          >
            Export your project as a clean ZIP, push it to GitHub, or deploy instantly to Vercel, Netlify, or any host you want. No lock-in, no restrictions. If you ever decide to leave, your code leaves with you, fully yours, forever.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mx-auto mt-5 max-w-3xl text-sm font-medium text-white/45 sm:text-base"
          >
            We don't help you start from scratch. We help you start from reality.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.75, delay: 0.12 }}
          className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {exportOptions.map((option) => (
            <div
              key={option.label}
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.055]"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.05] text-white/70">
                  {option.icon}
                </div>
                <ShieldCheck size={17} className="text-emerald-300/70" />
              </div>
              <p className="text-lg font-bold text-white">{option.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{option.detail}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
