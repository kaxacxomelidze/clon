"use client";

import { motion } from "framer-motion";

const testimonials = [
  { quote: "Clonyfy saved us 3 weeks of work. We cloned a competitor's pricing page, tweaked it to match our brand, and shipped the same day. Insane ROI.", name: "Sarah Chen", title: "Head of Growth, Orbit SaaS", avatar: "SC", color: "#a78bfa" },
  { quote: "The code output is actually clean. I was expecting messy div soup but it exports proper components with Tailwind. I'd write it similarly myself.", name: "Marcus Okonkwo", title: "Senior Engineer, Liftoff", avatar: "MO", color: "#e2e8f0" },
  { quote: "As a freelancer, I quote clients on day one and deliver prototypes the same afternoon. Clonyfy is essentially a second developer on my team.", name: "Priya Nair", title: "Freelance Product Designer", avatar: "PN", color: "#f472b6" },
  { quote: "We use it to build rapid reference designs before sprints. Cloning existing great UIs as a starting point is way faster than building from scratch.", name: "Jake Morrison", title: "Design Lead, Cascade", avatar: "JM", color: "#fbbf24" },
  { quote: "The AI redesign mode is what keeps me here. I clone a site, then tell it 'make it more minimalist'. It just works every single time.", name: "Aiko Watanabe", title: "Product Manager, Synthex", avatar: "AW", color: "#34d399" },
  { quote: "Setup was zero. Paste URL, wait 7 seconds, done. No API keys, no config. The competition takes 10 steps just to get started.", name: "Dmitri Volkov", title: "CTO, Refract", avatar: "DV", color: "#818cf8" },
  { quote: "We replaced our entire prototyping workflow with Clonyfy. The visual editor alone is worth the subscription. Super polished tool.", name: "Maya Patel", title: "UX Director, Cloudform", avatar: "MP", color: "#fb7185" },
  { quote: "Exported clean Next.js code on first try. I just had to swap in our actual data and it was basically production-ready. Wild.", name: "Ben Hartley", title: "Fullstack Dev, Stackflow", avatar: "BH", color: "#2dd4bf" },
];

function TestimonialCard({ t }: { t: (typeof testimonials)[0] }) {
  return (
    <div
      className="w-80 shrink-0 rounded-2xl p-6 mx-2 flex flex-col gap-4 transition-all duration-200"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white/40">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <p className="text-sm text-white/50 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: t.color + "18", border: `1px solid ${t.color}30`, color: t.color }}
        >
          {t.avatar}
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80 leading-tight">{t.name}</p>
          <p className="text-xs text-white/30">{t.title}</p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const row1 = [...testimonials.slice(0, 4), ...testimonials.slice(0, 4)];
  const row2 = [...testimonials.slice(4), ...testimonials.slice(4)];

  return (
    <section className="relative py-40 bg-black overflow-hidden border-b border-white/[0.06]">
      <div className="max-w-3xl mx-auto text-center mb-20 px-4">
        <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-6 text-white/30">
          Social Proof
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight text-balance">
          Loved by builders everywhere.
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-lg sm:text-xl leading-relaxed text-white/45 max-w-2xl mx-auto">
          50,000+ developers and designers trust Clonyfy for rapid prototyping and production deployments.
        </motion.p>
      </div>

      {/* Lane 1 */}
      <div className="relative mb-4">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex overflow-hidden">
          <div className="flex" style={{ animation: "marquee 40s linear infinite", willChange: "transform" }}>
            {row1.map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        </div>
      </div>

      {/* Lane 2 */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex overflow-hidden">
          <div className="flex" style={{ animation: "marquee-reverse 36s linear infinite", willChange: "transform" }}>
            {row2.map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
