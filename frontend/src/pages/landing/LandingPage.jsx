import React from 'react';
import { LandingNavbar } from '../../components/landing/LandingNavbar';
import { HeroSection } from '../../components/landing/HeroSection';
import { HowItWorksSection } from '../../components/landing/HowItWorksSection';
import { FeaturesSection } from '../../components/landing/FeaturesSection';
import { PricingSection } from '../../components/landing/PricingSection';
import { FaqSection } from '../../components/landing/FaqSection';
import { LandingFooter } from '../../components/landing/LandingFooter';

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white text-[#292929] flex flex-col font-sans selection:bg-[#b2c147] selection:text-[#292929]">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
};
