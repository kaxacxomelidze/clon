"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Globe, Rocket, Wand2 } from "lucide-react";

const items = [
  {
    icon: <Globe size={18} className="text-white/70" />,
    title: "Agencies",
    description:
      "Clone a client's inspiration site in seconds. Redesign it, export clean code, deliver faster than your competitors quote.",
  },
  {
    icon: <Wand2 size={18} className="text-white/70" />,
    title: "Freelancers",
    description:
      "Stop rebuilding from scratch. Clone the structure, make it yours, ship it tonight.",
  },
  {
    icon: <Rocket size={18} className="text-white/70" />,
    title: "Online Entrepreneurs",
    description:
      "See a site that converts. Clone the layout, swap the content, launch your offer.",
  },
];

export function ForWhoSection() {
  return (
    <section id="for-who" className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 62%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] mb-6 px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] text-white/55"
          >
            FOR WHO ?
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.08 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight text-balance"
          >
            BUILT FOR PEOPLE WHO SHIP.
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl p-7 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.04] transition-colors"
            >
              <div className="w-11 h-11 rounded-2xl border border-white/[0.10] bg-white/[0.04] flex items-center justify-center">
                {item.icon}
              </div>
              <p className="mt-5 text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{item.description}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-12 flex items-center justify-center"
        >
          <Link href="/app">
            <button className="group h-12 px-8 text-[15px] font-semibold text-black bg-white hover:bg-white/90 rounded-full transition-all duration-200 flex items-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.15)]">
              Start Cloning
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
