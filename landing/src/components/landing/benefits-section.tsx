"use client";

import { motion } from "framer-motion";
import { Clock, Wand2, Rocket } from "lucide-react";

function FigmaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 22a3 3 0 1 1 0-6h3v3a3 3 0 0 1-3 3z" />
      <path d="M9 16a3 3 0 1 1 0-6h3v6z" />
      <path d="M9 10a3 3 0 1 1 0-6h3v6z" />
      <path d="M12 10a3 3 0 1 1 0-6h3v3a3 3 0 0 1-3 3z" />
      <path d="M12 16a3 3 0 1 1 0-6h3v6z" />
    </svg>
  );
}

const benefits = [
  {
    icon: <Clock size={20} className="text-white/70" />,
    title: "+7 Days → 2 Minutes",
    description: "Stop rebuilding what already exists. Clone it, adapt it, ship it."
  },
  {
    icon: <Wand2 size={20} className="text-white/70" />,
    title: "Edit without coding",
    description: "The visual editor lets you modify any page directly in the browser."
  },
  {
    icon: <FigmaIcon size={20} />,
    title: "Figma file included",
    description: "Every clone generates a ready-to-share Figma file."
  },
  {
    icon: <Rocket size={20} className="text-white/70" />,
    title: "Deploy in 1 click",
    description: "Next.js 14, Dockerfile included. Vercel, Netlify, Railway, your own VPS — ready to ship in 2 minutes."
  }
];

export function BenefitsSection() {
  return (
    <section id="benefits" className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 65% 50% at 50% 60%, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center mb-6"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] px-4.5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/50 backdrop-blur-md">
              WHAT YOU ACTUALLY GAIN
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.08 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight text-balance"
          >
            <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
              The fastest way to rebuild, redesign and ship any website.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-5 text-base sm:text-lg text-white/45 max-w-2xl mx-auto font-medium"
          >
            We turn a $1,000–$5,000 website cost into $10 and a few minutes.
          </motion.p>
        </div>

        {/* Benefits 2x2 Grid (Flighty Design Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {benefits.map((benefit, idx) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.65, delay: idx * 0.08 }}
              className="group relative rounded-[32px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] p-8 sm:p-10 transition-all duration-300 flex flex-col items-start shadow-xl"
            >
              {/* Premium Icon Container */}
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-inner mb-6 group-hover:scale-105 group-hover:border-white/20 transition-all duration-300 text-white/70">
                {benefit.icon}
              </div>

              {/* Typography block */}
              <p className="text-base sm:text-[17px] leading-relaxed text-white/45 font-medium">
                <span className="font-bold text-white text-base sm:text-[17px] mr-1.5 group-hover:text-white transition-colors duration-300">
                  {benefit.title}.
                </span>
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
