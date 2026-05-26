"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Cpu, Edit3, Download, ArrowRight, Play, RefreshCw, Check } from "lucide-react";

type DemoStep = {
  id: number;
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const steps: DemoStep[] = [
  {
    id: 1,
    label: "Paste URL",
    icon: <Link2 size={16} />,
    title: "Paste any URL",
    description: "Input any public website URL to start. Clonyfy will analyze the structure."
  },
  {
    id: 2,
    label: "AI Clone",
    icon: <Cpu size={16} />,
    title: "AI parsing & cloning",
    description: "Our Vision AI crawls the assets and structures the React components."
  },
  {
    id: 3,
    label: "Visual Edit",
    icon: <Edit3 size={16} />,
    title: "Redesign in browser",
    description: "Click any text, image, or section to edit visually. Code updates instantly."
  },
  {
    id: 4,
    label: "Export & Ship",
    icon: <Download size={16} />,
    title: "1-Click deploy",
    description: "Export as React + Tailwind code, Figma file, or deploy directly to Vercel."
  }
];

export function DemoSection() {
  const [activeStep, setActiveStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto cycle logic
  useEffect(() => {
    if (!isPlaying) return;

    setProgress(0);
    const duration = 6000; // 6 seconds per step
    const intervalTime = 100;
    const increment = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveStep((curr) => (curr === 4 ? 1 : curr + 1));
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeStep, isPlaying]);

  const handleStepSelect = (stepId: number) => {
    setActiveStep(stepId);
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <section id="demo" className="relative py-28 bg-black border-b border-white/[0.06] overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-white/[0.01] blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] px-4.5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/50 backdrop-blur-md mb-6">
            HOW IT WORKS
          </span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            See the cloning process in action
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/45 max-w-xl mx-auto">
            From raw URL to production-ready React component in under two minutes.
          </p>
        </div>

        {/* main container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left panel - Steps list */}
          <div className="lg:col-span-5 flex flex-col justify-center gap-3">
            {steps.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => handleStepSelect(step.id)}
                  className={`group text-left p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden flex items-start gap-4 ${
                    isActive
                      ? "bg-white/[0.03] border-white/[0.08]"
                      : "bg-transparent border-transparent hover:bg-white/[0.01]"
                  }`}
                >
                  {/* Progress background bar */}
                  {isActive && isPlaying && (
                    <div
                      className="absolute bottom-0 left-0 h-[2px] bg-white/20 transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  )}

                  {/* Icon wrapper */}
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? "bg-white text-black border-white"
                        : "bg-white/[0.04] border-white/[0.08] text-white/40 group-hover:text-white/60"
                    }`}
                  >
                    {step.icon}
                  </div>

                  {/* Text block */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-base font-bold transition-colors ${
                        isActive ? "text-white" : "text-white/45 group-hover:text-white/60"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p
                      className={`text-sm leading-relaxed mt-1 font-medium transition-colors ${
                        isActive ? "text-white/60" : "text-white/25 group-hover:text-white/35"
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Play/Pause controls */}
            <div className="mt-4 flex items-center justify-center lg:justify-start gap-4 px-6">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-2 text-xs font-semibold text-white/40 hover:text-white/80 transition-colors py-2"
              >
                {isPlaying ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Autoplay Active (Pause)</span>
                  </>
                ) : (
                  <>
                    <Play size={10} className="fill-current" />
                    <span>Autoplay Paused (Resume)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right panel - Visual Simulator Browser */}
          <div className="lg:col-span-7 flex items-center justify-center">
            <div className="w-full rounded-3xl border border-white/[0.08] bg-[#07070b]/60 overflow-hidden shadow-2xl relative aspect-[16/10] flex flex-col">
              
              {/* Browser chrome header */}
              <div className="h-11 px-4 border-b border-white/[0.06] bg-black/40 flex items-center gap-4 shrink-0">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
                </div>
                <div className="flex-1 max-w-md h-6.5 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center px-3 gap-2 shrink-0">
                  <span className="text-[10px] text-white/20">https://</span>
                  <span className="text-[10px] text-white/40 select-none truncate font-mono">
                    {activeStep === 1
                      ? "clonyfy.com"
                      : activeStep === 2
                      ? "clonyfy.com/cloning"
                      : activeStep === 3
                      ? "clonyfy.com/editor/project"
                      : "my-clone.vercel.app"}
                  </span>
                </div>
                <div className="w-[30px]" />
              </div>

              {/* Browser viewport */}
              <div className="flex-1 bg-black p-6 relative overflow-hidden flex flex-col justify-center">
                
                <AnimatePresence mode="wait">
                  {/* STEP 1: PASTE URL */}
                  {activeStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.4 }}
                      className="w-full max-w-md mx-auto space-y-4"
                    >
                      <h4 className="text-sm font-semibold text-white/40 text-center uppercase tracking-wider">
                        1. Input Target website URL
                      </h4>
                      <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5 flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <input
                          type="text"
                          readOnly
                          className="bg-transparent border-0 text-white placeholder-white/25 focus:ring-0 focus:outline-none text-xs sm:text-sm pl-4 flex-1 font-mono"
                          value="https://website.com/pricing"
                        />
                        <button className="h-10 px-5 text-xs font-bold text-black bg-white rounded-xl shadow-lg flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
                          <span>Clone</span>
                          <ArrowRight size={12} className="stroke-[2.5]" />
                        </button>
                      </div>
                      
                      {/* Fake typing cursor simulation */}
                      <div className="flex items-center justify-center gap-2 text-[10px] text-white/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>Simulating input stream</span>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: CLONING */}
                  {activeStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full max-w-sm mx-auto space-y-5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={14} className="text-white/40 animate-spin" />
                          <span className="text-xs font-bold text-white">AI Vision Extractor</span>
                        </div>
                        <span className="text-xs font-mono text-emerald-400">76%</span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
                        <div className="h-full rounded-full bg-white" style={{ width: "76%" }} />
                      </div>

                      {/* Scanning visual laser */}
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-[1px] animate-[scanY_2.2s_infinite]" />

                      {/* Checklists */}
                      <div className="space-y-2.5">
                        {[
                          { text: "Crawling structure and nodes", done: true },
                          { text: "Extracting CSS stylesheet layouts", done: true },
                          { text: "Mapping semantic asset URLs", done: true },
                          { text: "Compiling Clean React & Tailwind", done: false }
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div
                              className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border text-[9px] font-bold ${
                                item.done
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-white/[0.04] border-white/[0.08] text-white/20 animate-pulse"
                              }`}
                            >
                              {item.done ? <Check size={8} className="stroke-[3]" /> : "●"}
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                item.done ? "text-white/60" : "text-white/25"
                              }`}
                            >
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: VISUAL EDIT */}
                  {activeStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-full flex flex-col relative"
                    >
                      {/* Mock editor UI */}
                      <div className="absolute top-2 right-2 rounded-lg border border-white/[0.08] bg-[#0d0d12]/90 p-2 flex items-center gap-2 shadow-lg backdrop-blur-md z-20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-white/50 font-mono">Editor Active</span>
                      </div>

                      {/* Visual canvas */}
                      <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
                        
                        {/* Simulated landing page layout */}
                        <div className="relative p-6 rounded-2xl border border-dashed border-white/20 bg-white/[0.01] max-w-sm group">
                          
                          {/* Element selector box (Hover ring) */}
                          <div className="absolute -inset-1 border border-sky-500 rounded-2xl pointer-events-none">
                            <span className="absolute -top-3.5 left-2 px-1.5 py-0.5 rounded bg-sky-500 text-[8px] font-mono font-bold text-white">
                              hero.headline
                            </span>
                          </div>

                          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                            Clonyfy makes frontend fast.
                          </h3>
                          <p className="text-xs text-white/40 mt-2">
                            Paste URL, edit visuals, export clean React.
                          </p>
                        </div>
                      </div>

                      {/* Mock editing cursor */}
                      <motion.div
                        className="absolute w-4 h-4 pointer-events-none z-30"
                        initial={{ x: "80%", y: "80%" }}
                        animate={{ x: "55%", y: "55%" }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                      >
                        <svg viewBox="0 0 24 24" className="w-full h-full text-white fill-current drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                          <path d="M4.5 3v15.2l4.7-4.6 2.7 6.4 2.7-1.1-2.7-6.4h6.1L4.5 3z" />
                        </svg>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* STEP 4: EXPORT & SHIP */}
                  {activeStep === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.4 }}
                      className="w-full max-w-md mx-auto space-y-6"
                    >
                      <h4 className="text-sm font-semibold text-white/45 text-center">
                        Choose Export &amp; Ship format
                      </h4>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { title: "React Code", desc: "Tailwind CSS", active: false },
                          { title: "Figma File", desc: "Full Vector", active: false },
                          { title: "Vercel Deploy", desc: "1-Click Ship", active: true }
                        ].map((opt) => (
                          <div
                            key={opt.title}
                            className={`rounded-2xl p-4 border text-center relative flex flex-col justify-center ${
                              opt.active
                                ? "bg-white border-white text-black"
                                : "bg-white/[0.02] border-white/[0.06] text-white/40"
                            }`}
                          >
                            <p className="text-[11px] font-bold">{opt.title}</p>
                            <p className={`text-[8px] mt-0.5 ${opt.active ? "text-black/55" : "text-white/20"}`}>
                              {opt.desc}
                            </p>
                            {opt.active && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center border border-white">
                                ✓
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Mock Terminal/Console feedback */}
                      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12] p-4.5 font-mono text-[10px] space-y-1.5 shadow-inner">
                        <div className="flex justify-between">
                          <span className="text-emerald-400">✓ Deployment finished</span>
                          <span className="text-white/25">my-clone.vercel.app</span>
                        </div>
                        <div className="h-px bg-white/[0.06] my-2" />
                        <div className="text-white/40">Live production deployment completed in 12.8s.</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Global CSS scanning animation helpers */}
      <style jsx global>{`
        @keyframes scanY {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(280px); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
