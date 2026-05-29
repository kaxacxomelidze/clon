"use client";

import { motion } from "framer-motion";
import { AnimatedCounter } from "./animated-counter";

export function StatsSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] bg-black py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="mx-auto whitespace-nowrap bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-[clamp(22px,4vw,52px)] font-black leading-tight tracking-tight text-transparent"
        >
          Website Cloned with Clonyfy
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.1 }}
          className="mt-5 flex items-center justify-center whitespace-nowrap text-[clamp(58px,12vw,160px)] font-black leading-none tracking-tight text-white"
        >
          <AnimatedCounter target={14600} duration={1800} />
        </motion.div>
      </div>
    </section>
  );
}
