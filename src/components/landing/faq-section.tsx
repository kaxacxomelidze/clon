"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ArrowRight } from "lucide-react";

const faqs = [
  {
    question: "Is it legal to clone websites?",
    answer: "CLONYFY is designed for legitimate use cases: prototyping, client pitches, competitive analysis, archival, and reference implementations. You are responsible for complying with each website's terms of service. We enforce robots.txt by default and never crawl at disruptive rates. Always ensure you have permission to capture and use a site's content.",
  },
  {
    question: "What kinds of sites work best??",
    answer: "CLONYFY works best on publicly accessible marketing sites, documentation, portfolios, and SaaS landing pages. Sites behind authentication, heavy client-side rendering with private APIs, or those using anti-bot measures may produce partial results. JavaScript-rendered SPAs are fully supported — we use a real Chromium browser for every page.",
  },
  {
    question: "How long does cloning take? ?",
    answer: "Most sites clone in under 60 seconds. A site with 50 pages and 150 assets typically completes in 45–90 seconds depending on page complexity and server response times. We cap each page at 120 seconds and run up to 2 pages in parallel by default. Paid users can increase concurrency.",
  },
  {
    question: "Can I deploy the generated project to Vercel?",
    answer: "Yes. The generated output is a standard Next.js 14 project. Export it as a ZIP, push to GitHub, and deploy to Vercel, Netlify, Railway, or any other Next.js-compatible host. A Dockerfile and docker-compose.yml are included if you prefer self-hosting.",
  },
  {
    question: "Do you store the captured pages on your servers?",
    answer: "Clones are stored on the server you run CLONYFY on — either your local machine (when using the desktop app) or your own VPS. We never store your captured content on our infrastructure. Your data stays yours. See our Privacy Policy for details.",
  }
];

function FaqItem({ item, isOpen, onToggle }: { item: (typeof faqs)[0]; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.07] last:border-b-0">
      <button
        className="w-full text-left py-6 flex items-start justify-between gap-6 group"
        onClick={onToggle}
      >
        <span className={`text-[15px] sm:text-base font-medium leading-snug transition-colors duration-200 ${isOpen ? "text-white" : "text-white/55 group-hover:text-white"}`}>
          {item.question}
        </span>
        <span className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 mt-0.5 ${isOpen ? "border-white/40 bg-white text-black" : "border-white/15 text-white/35 group-hover:border-white/30 group-hover:text-white/60"}`}>
          {isOpen ? <Minus size={13} /> : <Plus size={13} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[14px] sm:text-[15px] leading-relaxed text-white/40 max-w-3xl">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-16 lg:gap-24">

          {/* Left — sticky */}
          <div className="lg:sticky lg:top-28 self-start">
            <motion.p
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/25 mb-5"
            >
              FAQ
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.08 }}
              className="whitespace-nowrap bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-[clamp(30px,4.6vw,52px)] font-black tracking-tight text-transparent leading-tight"
            >
              Everything you want to know.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-5 text-[15px] leading-relaxed text-white/40"
            >
              Can&apos;t find the answer? Reach out to our{" "}
              <a href="mailto:support@clonyfy.com" className="text-white underline underline-offset-2 hover:no-underline">
                support team
              </a>.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5"
            >
              <p className="text-sm font-semibold text-white">Join +9000 entrepreneurs</p>
              <p className="mt-1 text-xs text-white/45 leading-relaxed">
                Get instant access to Clonyfy and ship faster with pixel-perfect clones.
              </p>
              <Link href="/app" className="inline-flex mt-4">
                <button className="group h-9 px-4 rounded-full bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-all flex items-center gap-2">
                  Get instant access
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </motion.div>
          </div>

          {/* Right — accordion */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay: 0.1 }}
          >
            {faqs.map((item, i) => (
              <FaqItem key={i} item={item} isOpen={openIndex === i} onToggle={() => toggle(i)} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
