"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import { ArrowRight } from "lucide-react";

const footerLinks = {
  Product: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Changelog", href: "#" }, { label: "Roadmap", href: "#" }],
  Developers: [{ label: "Documentation", href: "#" }, { label: "API Reference", href: "#" }, { label: "GitHub", href: "#" }, { label: "Status", href: "#" }],
  Company: [{ label: "About", href: "#" }, { label: "Blog", href: "#" }, { label: "Careers", href: "#" }, { label: "Contact", href: "#" }],
  Legal: [{ label: "Privacy", href: "#" }, { label: "Terms", href: "#" }, { label: "Cookies", href: "#" }, { label: "Security", href: "#" }],
};

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/clonyfy",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M7.5 2.5h9A5 5 0 0 1 21.5 7.5v9A5 5 0 0 1 16.5 21.5h-9A5 5 0 0 1 2.5 16.5v-9A5 5 0 0 1 7.5 2.5Zm0 2A3 3 0 0 0 4.5 7.5v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-9Zm9.65 1.85a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.625 5.906-5.625zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M16.7 2h-2.7v12.7a3.3 3.3 0 1 1-2.6-3.2V8.7a6 6 0 1 0 5.3 5.96V9.2c1.34.98 2.95 1.56 4.7 1.56V8.1c-1.9 0-3.62-.88-4.7-2.25V2Z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    label: "Discord",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.05a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.1.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
      </svg>
    ),
  },
];

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <footer ref={ref} className={`border-t border-white/[0.06] bg-black overflow-hidden transition-all duration-300 ${visible ? "footer-visible" : ""}`}>
      {/* Wordmark CTA */}
      <div className="relative overflow-hidden border-b border-white/[0.05]">
        <div
          className="text-center py-10 px-4 select-none pointer-events-none"
          style={{
            fontSize: "clamp(48px, 12vw, 140px)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Clonyfy
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.22em] mb-3">Ready to build?</p>
            <Link href="/sign-up">
              <button className="group h-10 px-6 rounded-full gap-2 font-semibold text-sm text-black bg-white hover:bg-white/90 transition-all duration-200 flex items-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
                Start for free
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className={`grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12 ${visible ? "footer-visible" : ""}`}>
          <div className="col-span-2 footer-item">
            <Logo size="sm" variant="light" />
            <p className="mt-4 text-sm text-white/35 leading-relaxed max-w-[240px]">
                The fastest way to turn any website into a fully editable Next.js project. Clone, edit, and ship.       
             </p>
            <div className="flex items-center gap-2.5 mt-6">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 text-white/35 hover:text-white hover:border-white/25 hover:bg-white/[0.07] transition-all">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([group, links], gi) => (
            <div key={group} className="footer-item" style={{ "--delay": `${(gi + 1) * 80}ms` } as React.CSSProperties}>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.18em] mb-4">{group}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/30 hover:text-white/70 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="my-8 h-px bg-white/[0.06]" />

        <div className="footer-item flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/25">
          <p>© 2025 Clonyfy, Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <p className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </p>
            <span className="text-white/10">·</span>
            <p>v2.0.1</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
