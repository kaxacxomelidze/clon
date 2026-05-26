"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    setIsAuthenticated(!!token);
  }, []);

  return (
    <>
      {/* Backdrop blur overlay for dark hero */}
      <div className="fixed top-0 inset-x-0 z-50">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn(
            "w-full transition-all duration-300",
            scrolled
              ? "bg-black/95 backdrop-blur-2xl border-b border-white/[0.08]"
              : "bg-transparent"
          )}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <nav className="flex items-center justify-between gap-6 h-[60px]">
              {/* Logo */}
              <Logo size="sm" variant="light" />

              {/* Center nav links */}
              <ul className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        className="text-[13px] px-4 py-2 rounded-lg font-medium text-white/60 hover:text-white transition-colors hover:bg-white/[0.06]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[13px] px-4 py-2 rounded-lg font-medium text-white/60 hover:text-white transition-colors hover:bg-white/[0.06]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>

              {/* Right CTA */}
              <div className="hidden lg:flex items-center gap-3">
                {isAuthenticated ? (
                  <a
                    href="/app"
                    className="inline-flex items-center justify-center relative h-9 px-5 text-[13px] font-semibold text-black bg-white rounded-full hover:bg-white/90 transition-all duration-200 shadow-[0_0_0_1px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                  >
                    Dashboard
                  </a>
                ) : (
                  <>
                    <a
                      href="/app"
                      className="inline-flex items-center justify-center text-[13px] font-medium text-white/60 hover:text-white transition-colors px-3 py-2"
                    >
                      Log in
                    </a>
                    <a
                      href="/app"
                      className="inline-flex items-center justify-center relative h-9 px-5 text-[13px] font-semibold text-black bg-white rounded-full hover:bg-white/90 transition-all duration-200 shadow-[0_0_0_1px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                    >
                      Get started
                    </a>
                  </>
                )}
              </div>

              {/* Mobile burger */}
              <button
                className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </nav>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="lg:hidden overflow-hidden border-t border-white/[0.08] bg-black/95 backdrop-blur-2xl"
              >
                <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col gap-1">
                  {navLinks.map((link) =>
                    link.href.startsWith("#") ? (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-sm font-medium text-white/60 hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/[0.07] transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="text-sm font-medium text-white/60 hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/[0.07] transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </Link>
                    )
                  )}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.08]">
                    {isAuthenticated ? (
                      <a
                        href="/app"
                        className="flex-1 inline-flex items-center justify-center h-9 text-sm bg-white text-black hover:bg-white/90 rounded-xl font-semibold"
                      >
                        Dashboard
                      </a>
                    ) : (
                      <>
                        <a
                          href="/app"
                          className="flex-1 inline-flex items-center justify-center h-9 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
                        >
                          Sign in
                        </a>
                        <a
                          href="/app"
                          className="flex-1 inline-flex items-center justify-center h-9 text-sm bg-white text-black hover:bg-white/90 rounded-xl font-semibold"
                        >
                          Get started
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      </div>
    </>
  );
}
