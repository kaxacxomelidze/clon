"use client";

import { Globe, Cpu, Wand2, GitBranch, Download } from "lucide-react";
import { motion } from "framer-motion";

const figmaLogo = (
  <svg viewBox="0 0 38 57" fill="currentColor" className="h-[15px] w-[15px]">
    <path d="M19 28.5a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM0 47.5A9.5 9.5 0 019.5 38H19v9.5a9.5 9.5 0 01-19 0zM19 0v19h9.5a9.5 9.5 0 000-19H19zM0 9.5A9.5 9.5 0 019.5 0H19v19H9.5A9.5 9.5 0 010 9.5zM0 28.5A9.5 9.5 0 019.5 19H19v19H9.5A9.5 9.5 0 010 28.5z" />
  </svg>
);

function StepVisual({ step }: { step: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-10">
      {/* STEP 1 */}
      {step === 0 && (
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border border-white/10 bg-white/[0.04]">
            <Globe size={14} className="text-white/40 shrink-0" />

            <span className="text-sm font-mono text-white/60 truncate">
              https://website.com/pricing
            </span>

            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.07] text-white/40 shrink-0">
              ↩ Enter
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full mt-4">
            {["website.com", "aisaas.app", "hello.com"].map((s) => (
              <div
                key={s}
                className="rounded-lg px-2 py-1.5 text-center text-[10px] font-mono bg-white/[0.04] border border-white/10 text-white/40"
              >
                {s}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-center text-white/25 mt-4">
            Works with any public URL
          </p>
        </div>
      )}

      {/* STEP 2 */}
      {step === 1 && (
        <div className="w-full max-w-sm">
          <div className="space-y-3">
            {[
              {
                label: "Fetching page structure",
                done: true,
                active: false,
                time: "0.8s",
              },
              {
                label: "Parsing layout & components",
                done: true,
                active: false,
                time: "1.4s",
              },
              {
                label: "Analyzing styles & tokens",
                done: true,
                active: false,
                time: "2.1s",
              },
              {
                label: "Generating React + Tailwind",
                done: false,
                active: true,
                time: "…",
              },
              {
                label: "Optimizing output",
                done: false,
                active: false,
                time: "",
              },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    s.done
                      ? "bg-emerald-500 text-white"
                      : s.active
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/30"
                  }`}
                >
                  {s.done ? "✓" : s.active ? "●" : "○"}
                </div>

                <span
                  className={`text-xs flex-1 ${
                    s.done
                      ? "text-white/25 line-through"
                      : s.active
                      ? "text-white"
                      : "text-white/25"
                  }`}
                >
                  {s.label}
                </span>

                {s.time && (
                  <span
                    className={`text-[10px] ${
                      s.done
                        ? "text-emerald-400"
                        : "text-white/25"
                    }`}
                  >
                    {s.time}
                  </span>
                )}
              </div>
            ))}

            <div className="mt-5">
              <div className="flex justify-between text-[10px] text-white/30 mb-2">
                <span>Processing</span>
                <span className="text-white/50">72%</span>
              </div>

              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[72%] rounded-full bg-white/60" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 2 && (
        <div className="w-full max-w-sm">
          <div className="rounded-xl overflow-hidden border border-white/10">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.04]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
              </div>

              <span className="text-[10px] font-mono text-white/30">
                PricingSection.tsx
              </span>
            </div>

            <div className="p-3 font-mono text-[10px] leading-relaxed bg-[#0d0d14]">
              <div>
                <span className="text-purple-400">
                  export function
                </span>{" "}
                <span className="text-white/70">
                  PricingSection
                </span>
              </div>

              <div className="ml-4 text-white/25">
                return (
              </div>

              <div className="ml-6 text-emerald-400">
                &lt;section
              </div>

              <div className="ml-8 text-lime-300">
                className="py-24"
              </div>

              <div className="ml-6 opacity-25">
                // AI-generated ✓
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              "React",
              "HTML",
              "GitHub",
            ].map((item, idx) => (
              <div
                key={item}
                className={`rounded-lg py-2 text-center text-[11px] font-semibold border ${
                  idx === 0
                    ? "bg-white text-black border-white"
                    : "bg-white/[0.04] border-white/10 text-white/35"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { number: "01", icon: <Globe size={18} />, title: "Paste any URL", headline: "Any site. Any framework.", description: "Drop in any public website URL, Clonyfy handles any complexity, any stack.", detail: "Works with React, Vue, Next.js, Webflow, Framer, and plain HTML." },
  { number: "02", icon: <Cpu size={18} />, title: "Clonyfy Analyze & Extraction", headline: "Deep structural understanding.", description: "Our Vision + Code engine parses layout, component hierarchy, spacing, typography, colors, and interaction patterns. Not just screenshots.", detail: "Use the visual editor to tweak any captured page. Changes persist immediately, no build step." },
  { number: "03", icon: <Download size={18} />, title: "Re-build & Export", headline: "Production-ready output.", description: "Visually edit the content without touching the code. Once ready, download the full Next.js project as a ZIP or deploy directly. One-click deploy to Vercel, GitHub, Netlify, or any host. Figma exportation is also available. Dockerfile included.", detail: "Multi-page cloning supported. Full ownership of your code." },
];

export function HowItWorks() {
  return (
    <section id="process" className="relative overflow-hidden bg-black border-b border-white/[0.06]">
      {/* Header */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-24 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-6 text-white/30"
        >
          Process
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 }}
          className="whitespace-nowrap bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-[clamp(34px,5.5vw,72px)] font-black tracking-tight text-transparent leading-tight"
        >
          Process
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto text-white/45"
        >
          Copy a URL, let our AI analyze and clone it, then edit and deploy. That&apos;s it.
        </motion.p>
      </div>

      {/* Alternating rows */}
      {STEPS.map((step, i) => {
        const isEven = i % 2 === 0;
        return (
          <div key={i} className="border-t border-white/[0.06]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              {/* Text */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`${isEven ? "lg:order-1" : "lg:order-2"} flex flex-col`}
              >
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-[11px] font-mono font-bold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/40">
                    Step {step.number}
                  </span>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.06] border border-white/10 text-white/50">{step.icon}</div>
                </div>
                <p className="text-sm font-semibold mb-3 text-white/35">{step.headline}</p>
                <h3 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6">{step.title}</h3>
                <p className="text-lg leading-relaxed mb-8 text-white/50">{step.description}</p>
                <div className="flex items-start gap-3 rounded-xl px-5 py-4 bg-white/[0.04] border border-white/[0.07]">
                  <span className="text-white/25 text-sm mt-0.5">→</span>
                  <p className="text-sm text-white/45">{step.detail}</p>
                </div>
              </motion.div>

              {/* Visual */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
                className={`${isEven ? "lg:order-2" : "lg:order-1"} relative rounded-2xl overflow-hidden border border-white/[0.08]`}
                style={{ minHeight: "320px", background: "rgba(255,255,255,0.025)" }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
                <StepVisual step={i} />
              </motion.div>
            </div>
          </div>
        );
      })}

      {/* Bottom pills */}
      <div className="border-t border-white/[0.06] py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-6"
        >
          {[{ icon: <Globe size={15} />, label: "Multi-page Cloning" }, { icon: <Wand2 size={15} />, label: "Re-Build Mode" }, { icon: <GitBranch size={15} />, label: "GitHub Push" }, { icon: figmaLogo, label: "Figma Export" }].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 text-sm font-medium text-white/35 hover:text-white/70 transition-colors">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/10">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
