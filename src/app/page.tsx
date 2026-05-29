import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { StatsSection } from "@/components/landing/stats-section";
import { DemoSection } from "@/components/landing/demo-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProblemSection } from "@/components/landing/problem-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FreedomSection } from "@/components/landing/freedom-section";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ForWhoSection } from "@/components/landing/for-who-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FaqSection } from "@/components/landing/faq-section";
import { JoinSection } from "@/components/landing/join-section";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <DemoSection />
        <StatsSection />
        <HowItWorks />
        <ProblemSection />
        <FeaturesSection />
        <FreedomSection />
        <BenefitsSection />
        <ForWhoSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <JoinSection />
        {/* <CtaSection /> */}
      </main>
      <Footer />
    </div>
  );
}
