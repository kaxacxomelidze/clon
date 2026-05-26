"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Cloud, FileArchive, Rocket, Zap } from "lucide-react";

export function FreedomSection() {
  return (
    <section id="freedom" className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-6 text-white/30"
          >
            Freedom
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.08 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight text-balance"
          >
            Zero dependencies, total freedom.
            <br />
            <span className="text-white/30">Your code. Your rules.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-8 text-lg sm:text-xl leading-relaxed text-white/45"
          >
            Export your project as a clean ZIP, push it to GitHub, or deploy instantly to Vercel, Netlify, or any host you want. No lock-in, no restrictions. If you ever decide to leave, your code leaves with you, fully yours, forever.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-5 text-sm text-white/35"
          >
            We don’t help you start from scratch. We help you start from reality.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="mt-10 flex items-center justify-center"
          >
            <Link href="/sign-up">
              <button className="group h-12 px-8 text-[15px] font-semibold text-black bg-white hover:bg-white/90 rounded-full transition-all duration-200 flex items-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.15)]">
                Get Started
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </motion.div>
        </div>

        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 55% at 50% 25%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0) 60%)",
              }}
            />

            <div className="relative px-6 sm:px-10 py-14 flex items-center justify-center">
              <div className="relative w-full max-w-[520px] aspect-[16/10]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-3xl border border-white/[0.08]"
                  style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(18px)" }}
                />

                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 28, ease: "linear", repeat: Infinity }}
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-white/15"
                      style={{
                        transform: `rotate(${(i / 20) * 360}deg) translateX(210px)`,
                      }}
                    />
                  ))}
                </motion.div>

                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 36, ease: "linear", repeat: Infinity }}
                >
                  {[
                    { icon: <FileArchive size={16} className="text-white/70" />, angle: 20 },
                    {
                      icon: (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/70">
                          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                      ),
                      angle: 110,
                    },
                    { icon: <Cloud size={16} className="text-white/70" />, angle: 200 },
                    { icon: <Rocket size={16} className="text-white/70" />, angle: 290 },
                  ].map((o) => (
                    <div
                      key={o.angle}
                      className="absolute w-10 h-10 rounded-2xl border border-white/[0.10] bg-white/[0.05] flex items-center justify-center"
                      style={{ transform: `rotate(${o.angle}deg) translateX(170px)` }}
                    >
                      <div style={{ transform: `rotate(${-o.angle}deg)` }}>{o.icon}</div>
                    </div>
                  ))}
                </motion.div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[260px] sm:w-[300px] rounded-3xl border border-white/[0.10] bg-black/40 px-6 py-5 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center">
                        <Zap size={18} className="text-white/70" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Export anywhere</p>
                        <p className="text-xs text-white/40 mt-0.5">ZIP · GitHub · Vercel · Netlify</p>
                      </div>
                    </div>
                    <div className="mt-5 h-px bg-white/[0.08]" />
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {[
                        { label: "ZIP Export", value: "1 click" },
                        { label: "GitHub Push", value: "Instant" },
                        { label: "Deploy", value: "Any host" },
                        { label: "Lock-in", value: "None" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">{s.label}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
