"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function AnimatedCounter({ initialValue = 14600 }: { initialValue?: number }) {
  const [count, setCount] = useState(initialValue);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      let current = initialValue;
      
      const liveTimer = setInterval(() => {
        current += Math.floor(Math.random() * 2) + 1;
        setCount(current);
      }, 5000);

      return () => clearInterval(liveTimer);
    }
  }, [initialValue, hasStarted]);

  return <span>+{count.toLocaleString()}</span>;
}

export function StatsSection() {
  return (
    <section className="relative py-20 bg-black border-b border-white/[0.06] overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden p-10 sm:p-14"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mb-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/30">
                Milestone
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tight leading-tight"
            >
              <AnimatedCounter initialValue={14600} />
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-4 text-xl sm:text-2xl font-medium text-white/45"
            >
              Websites Cloned with Clonyfy
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
