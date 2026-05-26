"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

const traditionalItems = [
  "Paying thousands for a website",
  "Spending weeks rebuilding something that already exists",
  "Learning design just to launch a product",
  "Waiting on a freelancer who delivers late and over budget",
  "Starting from a blank page every single time",
  "Manual rebuild",
  "Days of work",
  "High cost"
];

const clonyfyItems = [
  "Clone any site in 2 minutes, full code, yours forever",
  "Redesign it visually, no coding required",
  "Export to Figma, ZIP, or deploy directly",
  "Launch today, not next month",
  "Instant extraction",
  "Minutes",
  "Low cost",
  "Complete code ownership, no lock-in" // Added to balance 8 items and keep rows aligned
];

const roles = [
  {
    emoji: "🌐",
    title: "Online Hustlers",
    description: "See a site that works. Clone it, make it yours, launch it today."
  },
  {
    emoji: "👨‍💻",
    title: "Developers",
    description: "Speed up frontend development and skip repetitive rebuilds."
  },
  {
    emoji: "🏢",
    title: "Agencies",
    description: "Deliver client websites faster and increase margins."
  }
];

export function ProblemSection() {
  return (
    <section id="problem-solution" className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      {/* Background gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 65%)",
        }}
      />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-red-500/[0.015] blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.015] blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center mb-6"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] px-4.5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/50 backdrop-blur-md">
              THE PROBLEM
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.08 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] text-balance"
          >
            Stop doing it the hard way.
          </motion.h2>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          
          {/* Traditional Way */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex items-center justify-center lg:justify-start gap-3 mb-8"
            >
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Traditional Way
              </h3>
              <span className="text-xl">❌</span>
            </motion.div>

            <div className="flex flex-col gap-4">
              {traditionalItems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  className="rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/[0.08] p-5 flex items-center gap-4 transition-all duration-300 group"
                >
                  <div className="w-8 h-8 rounded-full border border-red-500/20 bg-red-500/[0.07] text-red-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-hover:scale-105 transition-transform">
                    <X size={14} className="stroke-[2.5]" />
                  </div>
                  <span className="text-sm sm:text-[15px] font-medium text-white/50 group-hover:text-white/70 transition-colors">
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* The Clonyfy Way */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex items-center justify-center lg:justify-start gap-3 mb-8"
            >
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                The Clonyfy way
              </h3>
              <span className="text-xl">✅</span>
            </motion.div>

            <div className="flex flex-col gap-4">
              {clonyfyItems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  className="rounded-2xl border border-emerald-500/10 bg-emerald-950/[0.04] hover:bg-emerald-950/[0.08] hover:border-emerald-500/25 p-5 flex items-center gap-4 transition-all duration-300 group"
                >
                  <div className="w-8 h-8 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:scale-105 transition-transform">
                    <Check size={14} className="stroke-[2.5]" />
                  </div>
                  <span className="text-sm sm:text-[15px] font-semibold text-white group-hover:text-white transition-colors">
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

        </div>

        {/* Spacer before Audience Boxes */}
        <div className="mt-32 mb-16 h-px bg-white/[0.06] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Audience Grid - 3 Boxes */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
        >
          {roles.map((role, idx) => (
            <div
              key={role.title}
              className="group relative rounded-3xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] p-8 transition-all duration-300"
            >
              {/* Box Icon wrapper */}
              <div className="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-xl mb-6 shadow-inner group-hover:scale-105 group-hover:border-white/20 transition-all duration-300">
                {role.emoji}
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5 tracking-tight group-hover:translate-x-0.5 transition-transform">
                {role.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/45 font-medium group-hover:text-white/60 transition-colors">
                {role.description}
              </p>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
