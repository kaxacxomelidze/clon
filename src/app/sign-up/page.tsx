import { SignUpForm } from "@/components/auth/sign-up-form";
import { Logo } from "@/components/shared/logo";
import Link from "next/link";

export const metadata = {
  title: "Sign up — Clonyfy",
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[520px_1fr] bg-black">
      {/* ── LEFT: dark decorative panel ── */}
      <div className="hidden lg:flex relative overflow-hidden bg-black flex-col justify-between p-12">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,255,255,0.05) 0%, transparent 70%)",
          }}
        />

        {/* Logo top */}
        <div className="relative z-10">
          <Logo size="md" variant="light" />
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-5">
          {[
            { emoji: "⚡", title: "Clone in 8 seconds", desc: "The fastest AI cloning engine on the market." },
            { emoji: "✏️", title: "Visual editor included", desc: "Edit every element without touching code." },
            { emoji: "📦", title: "Export clean React", desc: "Production-grade components with Tailwind." },
            { emoji: "🔁", title: "Auto-sync on change", desc: "Webhooks keep your clone always fresh." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg shrink-0">
                {f.emoji}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{f.title}</p>
                <p className="text-xs text-white/45 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="relative z-10">
          <p className="text-sm text-white/50 italic leading-relaxed">
            &ldquo;Clonyfy halved our design sprint time. The output code is actually
            clean — I&apos;d write it the same way.&rdquo;
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs font-bold">
              MO
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Marcus Okonkwo</p>
              <p className="text-[10px] text-white/35">Senior Engineer, Liftoff</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: sign-up form ── */}
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
          <div className="lg:hidden">
            <Logo size="sm" variant="light" href="/" />
          </div>
          <div className="hidden lg:block" />
          <p className="text-sm text-white/35">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-white hover:text-white/70 transition-colors">
              Sign in
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
            <SignUpForm />
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
