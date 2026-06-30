"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";

const excuses = [
  "I CAN'T AFFORD A DEVELOPER",
  "I SAW THE PERFECT WEBSITE",
  "BUILDERS ARE TOO LIMITING",
  "I DON'T HAVE TIME TO LEARN",
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] },
  }),
};

function FloatingExcusePill({
  text,
  initialX,
  initialY,
  rotate,
  delay,
}: {
  text: string;
  initialX: number;
  initialY: number;
  rotate: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, rotate }}
      animate={{
        opacity: 1,
        x: [0, 26, 0, -18, 0],
        y: [0, -18, 0, 14, 0],
        rotate: [rotate, rotate + 5, rotate],
      }}
      transition={{
        duration: 9,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileHover={{ scale: 1.05, zIndex: 50 }}
      whileDrag={{ scale: 1.1, zIndex: 100, cursor: "grab" }}
      className="absolute z-30 cursor-grab active:cursor-grabbing"
      style={{ left: `${initialX}%`, top: `${initialY}%` }}
    >
      <div
        className="whitespace-nowrap rounded-full border px-4 py-2 text-[10px] font-bold tracking-[0.08em] text-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:text-xs"
        style={{
          background: "linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(244, 114, 182, 0.15))",
          borderColor: "rgba(167, 139, 250, 0.3)",
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
        const baseY = canvas.height * 0.86;
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
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-black px-0 pb-16 pt-24 sm:pt-28">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <FloatingExcusePill text={excuses[0]} initialX={4} initialY={20} rotate={-10} delay={0.1} />
      <FloatingExcusePill text={excuses[1]} initialX={74} initialY={18} rotate={10} delay={0.7} />
      <FloatingExcusePill text={excuses[2]} initialX={6} initialY={72} rotate={10} delay={1.2} />
      <FloatingExcusePill text={excuses[3]} initialX={70} initialY={72} rotate={-10} delay={1.8} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-gradient-to-t from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48 bg-gradient-to-b from-black/70 to-transparent" />

      <div className="relative z-20 mx-auto flex w-full max-w-[960px] flex-col items-center px-4 text-center sm:px-8">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
            +14,600 WEBSITES CLONED
          </span>
        </motion.div>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-[clamp(36px,7vw,80px)] font-black leading-[0.96] tracking-tight text-white"
        >
          Clone any website.
          <br />
          <span className="inline-block whitespace-nowrap bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
            Rebuild & export in seconds.
          </span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-8 max-w-xl text-[17px] font-normal leading-relaxed text-white/45 sm:text-xl"
        >
          Paste a URL & get any website. No limits. Save thousands in dev fees.
        </motion.p>

        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-12 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/app">
            <button className="group flex h-[52px] items-center gap-2.5 rounded-full bg-white px-9 text-[15px] font-semibold text-black shadow-[0_0_40px_rgba(167,139,250,0.35)] transition-all duration-200 hover:bg-white/90">
              Start Cloning
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
