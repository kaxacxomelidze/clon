"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function CtaSection() {
  return (
    <section className="relative py-40 bg-black overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden p-12 sm:p-20"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
          {/* Top glow line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <motion.p
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}
              className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.28em] mb-6"
            >
              Ready to build?
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.18 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight max-w-3xl mx-auto text-balance"
            >
              Your next site in seconds.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.26 }}
              className="mt-8 text-lg sm:text-xl leading-relaxed text-white/45 max-w-2xl mx-auto"
            >
              Copy a URL. Wait 8 seconds. Deploy. That&apos;s it. Join 50,000+ builders who ship faster.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.34 }}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/app">
                <button className="group h-12 px-8 text-[15px] font-semibold text-black bg-white hover:bg-white/90 rounded-full transition-all duration-200 flex items-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.15)]">
                  Start for free
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
              <Link href="#how-it-works">
                <button className="h-12 px-8 text-[15px] font-medium text-white/55 hover:text-white rounded-full border border-white/12 hover:border-white/25 transition-all duration-200 hover:bg-white/[0.05]">
                  Learn more
                </button>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.42 }}
              className="mt-10 text-sm text-white/25"
            >
              No credit card required · Free tier: 10 clones/month
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
