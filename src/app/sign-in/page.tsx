import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/shared/logo";
import Link from "next/link";

export const metadata = {
  title: "Sign in — Clonyfy",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[520px_1fr] bg-black">

      {/* ── LEFT: dark decorative panel ── */}
      <div className="hidden lg:flex relative overflow-hidden bg-black flex-col items-center justify-center p-12">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,255,255,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 text-center w-full max-w-sm">
          {/* Clonyfy logo */}
          <div className="flex justify-center mb-12">
            <Logo size="md" variant="light" />
          </div>

          {/* Floating card mockup */}
          <div className="mb-10 bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-sm text-left">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="13" cy="6" r="5" fill="white" fillOpacity="0.85" />
                  <rect x="2" y="8" width="9" height="9" rx="2" fill="white" fillOpacity="0.35" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="h-2.5 w-28 rounded bg-white/20 mb-1.5" />
                <div className="h-2 w-16 rounded bg-white/10" />
              </div>
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <span className="text-[10px] font-medium text-emerald-400">● Done</span>
              </div>
            </div>
            {/* Progress bars */}
            <div className="space-y-2.5">
              {[80, 100, 65].map((w, i) => (
                <div key={i} className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-white/25" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            {/* Grid of mini cards */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-white/[0.04] border border-white/[0.07]" />
              ))}
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-2.5 tracking-tight">
            Clone. Edit. Ship.
          </h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
            50,000+ developers trust Clonyfy to turn inspiration into
            production-ready code, faster than ever.
          </p>

          {/* Avatar row */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="flex -space-x-2">
              {["A", "B", "C", "D"].map((l) => (
                <div
                  key={l}
                  className="w-8 h-8 rounded-full bg-white/10 border-2 border-black flex items-center justify-center text-[10px] font-bold text-white/70"
                >
                  {l}
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40">
              <strong className="text-white/70">2,400+</strong> clones today
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: sign-in form ── */}
      <div className="relative flex flex-col min-h-screen bg-black">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Left border separator */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.07] hidden lg:block" />

        <div className="relative z-10 flex items-center justify-between px-6 h-16 border-b border-white/[0.06]">
          {/* Show logo only on mobile */}
          <div className="lg:hidden">
            <Logo size="sm" variant="light" />
          </div>
          <div className="hidden lg:block" />
          <p className="text-sm text-white/35">
            New to Clonyfy?{" "}
            <Link href="/sign-up" className="font-medium text-white hover:text-white/70 transition-colors">
              Create account
            </Link>
          </p>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-lg rounded-3xl p-6 sm:p-8"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <SignInForm />
          </div>
        </div>

        <footer className="relative z-10 px-6 h-12 flex items-center border-t border-white/[0.06]">
          <p className="text-xs text-white/25">
            © 2025 Clonyfy, Inc. ·{" "}
            <Link href="#" className="hover:text-white/50 transition-colors">Privacy</Link>{" "}
            ·{" "}
            <Link href="#" className="hover:text-white/50 transition-colors">Terms</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
