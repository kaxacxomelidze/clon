"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";

const excuses = [
  "“I can’t afford a developer”",
  "“I saw the perfect website”",
  "“builders are too limiting”",
  "“I don’t have time to learn”",
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] } }),
};

function FloatingExcusePill({ text, initialX, initialY, rotate, delay }: { text: string; initialX: number; initialY: number; rotate: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: initialX - 50, y: initialY - 50, rotate: rotate - 10 }}
      animate={{ 
        opacity: 1, 
        x: [initialX, initialX + 30, initialX],
        y: [initialY, initialY - 20, initialY],
        rotate: [rotate, rotate + 5, rotate],
      }}
      transition={{ 
        duration: 8 + Math.random() * 4, 
        repeat: Infinity, 
        repeatType: "reverse",
        ease: "easeInOut",
        delay: delay,
      }}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileHover={{ scale: 1.05, zIndex: 50 }}
      whileDrag={{ scale: 1.1, zIndex: 100, cursor: "grab" }}
      className="absolute cursor-grab active:cursor-grabbing z-30"
      style={{ left: `${initialX}%`, top: `${initialY}%` }}
    >
      <div 
        className="px-4 py-2 rounded-full border backdrop-blur-xl text-xs sm:text-sm font-semibold shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        style={{
          background: "linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(244, 114, 182, 0.15))",
          borderColor: "rgba(167, 139, 250, 0.3)",
          color: "rgba(255, 255, 255, 0.85)"
        }}
      >
        {text}
      </div>
    </motion.div>
  );
}

export function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const lineCount = 72;
    const colors = [
      { r: 167, g: 139, b: 250 }, 
      { r: 244, g: 114, b: 182 }, 
      { r: 96, g: 165, b: 250 }, 
      { r: 52, g: 211, b: 153 }, 
    ];
    const lines = Array.from({ length: lineCount }, (_, i) => ({
      x: (i / lineCount) * 1,
      height: Math.random() * 0.55 + 0.1,
      speed: Math.random() * 1.2 + 0.6,
      offset: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const draw = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Colorful blobs
      const drawBlob = (x: number, y: number, radius: number, color: string, alpha: number) => {
        const radial = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radial.addColorStop(0, `rgba(${color}, ${alpha})`);
        radial.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      };

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      drawBlob(cx - canvas.width * 0.25, cy - canvas.height * 0.2, canvas.width * 0.4, "167, 139, 250", 0.15);
      drawBlob(cx + canvas.width * 0.25, cy + canvas.height * 0.15, canvas.width * 0.35, "244, 114, 182", 0.12);
      drawBlob(cx, cy + canvas.height * 0.3, canvas.width * 0.3, "96, 165, 250", 0.1);

      lines.forEach((line) => {
        const wave = Math.sin(time * line.speed + line.offset);
        const h = line.height * (0.35 + wave * 0.65) * canvas.height * 0.5;
        const baseY = canvas.height * 0.84;
        const lx = line.x * canvas.width;
        const bw = (canvas.width / lineCount) * 0.5;
        const alpha = 0.08 + (wave * 0.5 + 0.5) * 0.15;

        const g = ctx.createLinearGradient(lx, baseY - h, lx, baseY);
        g.addColorStop(0, `rgba(${line.color.r}, ${line.color.g}, ${line.color.b}, 0)`);
        g.addColorStop(0.4, `rgba(${line.color.r}, ${line.color.g}, ${line.color.b}, ${alpha * 0.5})`);
        g.addColorStop(0.75, `rgba(${line.color.r}, ${line.color.g}, ${line.color.b}, ${alpha})`);
        g.addColorStop(1, `rgba(${line.color.r}, ${line.color.g}, ${line.color.b}, ${alpha * 0.6})`);
        ctx.fillStyle = g;
        ctx.fillRect(lx - bw / 2, baseY - h, bw, h);
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <section className="relative min-h-[calc(100vh+220px)] flex flex-col items-center justify-start overflow-hidden bg-black pt-36 sm:pt-40 pb-28">
      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Floating excuse pills */}
      <FloatingExcusePill text={excuses[0]} initialX={5} initialY={15} rotate={-12} delay={0.1} />
      <FloatingExcusePill text={excuses[1]} initialX={80} initialY={12} rotate={12} delay={0.2} />
      <FloatingExcusePill text={excuses[2]} initialX={8} initialY={75} rotate={12} delay={0.3} />
      <FloatingExcusePill text={excuses[3]} initialX={78} initialY={78} rotate={-12} delay={0.4} />

      {/* Vignettes */}
      <div className="absolute bottom-0 inset-x-0 h-72 bg-gradient-to-t from-black to-transparent pointer-events-none z-10" />
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10" />

      {/* Content */}
      <div className="relative z-20 w-full max-w-[900px] mx-auto px-4 sm:px-8 flex flex-col items-center text-center">

        {/* Eyebrow */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.12em] px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.05] text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
             +14 600 Websites Cloned
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="text-[clamp(36px,7vw,80px)] font-black leading-[0.96] tracking-[-0.045em] text-white"
        >
          Clone any website.
          <br />
          <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
            Rebuild & export in seconds.
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="mt-8 text-[17px] sm:text-xl text-white/45 max-w-xl leading-relaxed font-normal"
        >
          Paste a URL &amp; Get any website. No limits. Save thousands in dev fees.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3} variants={fadeUp} initial="hidden" animate="show"
          className="mt-12 flex flex-col sm:flex-row items-center gap-3"
        >
          <Link href="/sign-up">
            <button className="group h-[52px] px-9 text-[15px] font-semibold text-black bg-white rounded-full hover:bg-white/92 transition-all duration-200 flex items-center gap-2.5 shadow-[0_0_40px_rgba(167,139,250,0.35)]">
              Start Cloning
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </Link>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          custom={5} variants={fadeUp} initial="hidden" animate="show"
          className="mt-20 sm:mt-24 w-full grid grid-cols-2 sm:grid-cols-4 rounded-3xl overflow-hidden border border-white/[0.10] bg-white/[0.03] backdrop-blur-xl shadow-[0_35px_90px_rgba(0,0,0,0.55)]"
        >
          {[
            { value: "2min", label: "Avg. clone time" },
            { value: "99.2%", label: "Accuracy rate" },
            { value: "+9,000", label: "Active Users" },
            { value: "★ 4.9/5", label: "User Rating" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08, duration: 0.5, ease: "easeOut" }}
              className={[
                "text-center py-7 px-4",
                i < 3 ? "border-r border-white/[0.07]" : "",
                i >= 2 ? "border-t sm:border-t-0 border-white/[0.07]" : "",
              ].join(" ")}
            >
              <div className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-none flex items-center justify-center h-8">{stat.value}</div>
              <p className="text-[11px] text-white/30 mt-2 font-medium uppercase tracking-[0.1em]">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
