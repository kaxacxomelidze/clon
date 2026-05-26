"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Starter",
    price: { monthly: 19.99, annual: 15.99 },
    description: "For testing on real projects before committing.",
    cta: "Get started",
    featured: false,
    subTag: "≈ 1 coffee per week",
    features: [
      "10 Website Clones / Month",
      "Unlimited Screens",
      "Code & ZIP Export",
      "Visual Builder & Editor",
      "6 Days/Week Support",
      "Cancel Anytime",
    ],
    limits: [],
  },
  {
    name: "Growth",
    price: { monthly: 29.99, annual: 23.99 },
    description: "For growing teams shipping faster every week.",
    cta: "Start now",
    featured: true,
    badge: "Most popular",
    features: [
      "25 Website Clones / Month",
      "Unlimited Screens",
      "Code & ZIP Export",
      "Figma Export ",
      "Visual Builder & Editor",
      "Access to Templates",
      "API Access",
      "6 Days/Week Support",
      "Cancel Anytime",
    ],
    limits: [],
  },
  {
    name: "Scale",
    price: { monthly: 59.99, annual: 47.99 },
    description: "For high-volume cloning with priority support.",
    cta: "Start now",
    featured: false,
    features: [
      "Unlimited Website Clones",
      "Unlimited Screens",
      "Code & ZIP Export",
      "Figma Export ",
      "Visual Builder & Editor",
      "Access to Templates",
      "API Access",
      "7 Days/Week Priority Support",
      "Cancel Anytime",
    ],
    limits: [],
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const cardAnim = { hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } };

export function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const formatPrice = (value: number) => `$${value.toFixed(2)}`;

  return (
    <section id="pricing" className="relative py-32 bg-black border-b border-white/[0.06] overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-6 text-white/30">
            Transparent Pricing
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight text-balance">Cheaper than a developer's hour
          </motion.h2>

          {/* Toggle */}
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.24 }}
            className="mt-8 inline-flex items-center gap-1 bg-white/[0.05] border border-white/10 rounded-xl p-1.5">
            {["monthly", "annual"].map((b) => (
              <button key={b} onClick={() => setBilling(b as "monthly" | "annual")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billing === b ? "bg-white text-black shadow-sm" : "text-white/40 hover:text-white"}`}>
                {b === "annual" ? "Yearly" : "Monthly"}
                {b === "annual" && (
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${billing === b ? "bg-black text-white" : "bg-white/15 text-white/60"}`}>
                    −20%
                  </span>
                )}
              </button>
            ))}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.32 }}
            className="mt-3 text-xs text-white/35"
          >
            Yearly (−20% — Save 2 Months)
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto mb-10">
          <div className="rounded-2xl px-6 py-5 border border-white/[0.08] bg-white/[0.03]">
            <p className="text-2xl font-black tracking-tight text-emerald-300">$2,000+</p>
            <p className="mt-1 text-sm text-white/45">Average dev cost for one site</p>
          </div>
          <div className="rounded-2xl px-6 py-5 border border-white/[0.08] bg-white/[0.03]">
            <p className="text-2xl font-black tracking-tight text-emerald-300">2 Min</p>
            <p className="mt-1 text-sm text-white/45">To clone any website, fully</p>
          </div>
        </div>

        {/* Plans */}
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={cardAnim}
              className={`relative rounded-2xl p-7 flex flex-col ${plan.featured ? "bg-white text-black shadow-2xl shadow-black/40 scale-[1.02]" : ""}`}
              style={!plan.featured ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" } : {}}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span
                    className="inline-flex
        items-center
        rounded-full
        px-5
        py-2
        text-sm
        font-bold
        text-emerald-950
        bg-emerald-400
        border
        border-emerald-300
        shadow-[0_0_40px_rgba(74,222,128,0.35)]"
                  >
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className={`text-base font-semibold mb-1 ${plan.featured ? "text-black/60" : "text-white/40"}`}>{plan.name}</h3>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-4xl font-bold tracking-tight ${plan.featured ? "text-black" : "text-white"}`}>
                    {formatPrice(plan.price[billing])}
                  </span>
                  <span className={`text-sm mb-1.5 ${plan.featured ? "text-black/50" : "text-white/35"}`}>/mo</span>
                </div>
                {"subTag" in plan && plan.subTag && (
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold bg-emerald-200 text-emerald-950">
                      {plan.subTag}
                    </span>
                  </div>
                )}
                <p className={`text-sm ${plan.featured ? "text-black/55" : "text-white/35"}`}>{plan.description}</p>
              </div>
              <Link href="/sign-up" className="mb-6">
                <Button
                  className={`w-full h-11 font-semibold rounded-xl gap-2 group border-none ${plan.featured ? "bg-black text-white hover:bg-black/85" : "bg-white text-black hover:bg-white/90"}`}
                >
                  {plan.cta}
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <div className={`h-px mb-6 ${plan.featured ? "bg-black/10" : "bg-white/[0.08]"}`} />
              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={14} className={`mt-0.5 shrink-0 ${plan.featured ? "text-black/60" : "text-white/50"}`} />
                    <span className={`text-sm ${plan.featured ? "text-black/80" : "text-white/60"}`}>{f}</span>
                  </li>
                ))}
                {plan.limits.map((l) => (
                  <li key={l} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 text-xs w-3.5 shrink-0 text-center ${plan.featured ? "text-black/20" : "text-white/20"}`}>—</span>
                    <span className={`text-sm ${plan.featured ? "text-black/30" : "text-white/25"}`}>{l}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>


      </div>
    </section>
  );
}
