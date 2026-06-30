"use client";

import { motion } from "framer-motion";

const excuses = [
  "“I can’t afford a developer”",
  "“I saw the perfect website”",
  "“builders are too limiting”",
  "“I don’t have time to learn”",
];

function ExcusePill({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -10, scale: 0.8 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      animate={{ 
        y: [0, -8, 0],
        rotate: [0, 2, 0, -2, 0],
      }}
      transition={{ 
        duration: 0.7, 
        delay, 
        ease: [0.16, 1, 0.3, 1],
        y: { repeat: Infinity, repeatType: "reverse", duration: 5, ease: "easeInOut", delay: delay + 0.7 },
        rotate: { repeat: Infinity, repeatType: "reverse", duration: 8, ease: "easeInOut", delay: delay + 0.7 },
      }}
      className={className}
    >
      <div 
        className="px-4 py-2 rounded-full border backdrop-blur-xl text-xs sm:text-sm font-semibold shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        style={{
          background: "linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(244, 114, 182, 0.12))",
          borderColor: "rgba(167, 139, 250, 0.25)",
          color: "rgba(255, 255, 255, 0.85)"
        }}
      >
        {text}
      </div>
    </motion.div>
  );
}

export function NoExcuseSection() {
  return (
    <section className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 35%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 62%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative max-w-5xl mx-auto rounded-3xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-white/[0.05] blur-3xl" />
          </div>

          <ExcusePill
            text={excuses[0]}
            delay={0.1}
            className="absolute left-6 sm:left-10 top-10 sm:top-12 -rotate-12"
          />
          <ExcusePill
            text={excuses[1]}
            delay={0.18}
            className="absolute right-6 sm:right-10 top-14 sm:top-16 rotate-12"
          />
          <ExcusePill
            text={excuses[2]}
            delay={0.26}
            className="absolute left-6 sm:left-10 bottom-10 sm:bottom-12 rotate-12"
          />
          <ExcusePill
            text={excuses[3]}
            delay={0.34}
            className="absolute right-6 sm:right-10 bottom-14 sm:bottom-16 -rotate-12"
          />

          <div className="relative px-6 sm:px-12 py-20 sm:py-24 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight text-balance"
            >
              You don’t need excuses, you need clonyfy.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 text-[15px] sm:text-lg leading-relaxed text-white/50 max-w-3xl mx-auto"
            >
              We are not building a website builder. We are building a website production accelerator that integrates into existing workflows and reduces site creation from days to minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-12"
            >
              <p className="text-sm sm:text-base text-white/45">
                While competitors build websites costing thousands of dollars, get yours for just{" "}
                <span className="text-white font-semibold">$19.99</span>.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
