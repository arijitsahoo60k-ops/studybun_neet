import React, { useEffect } from "react";
import LandingStyle from "./LandingStyle";
import NavBar from "./sections/NavBar";
import Hero from "./sections/Hero";
import FeatureShowcase from "./sections/FeatureShowcase";
import ThemeGallery from "./sections/ThemeGallery";
import TrustSection from "./sections/TrustSection";
import DuskBridge from "./sections/DuskBridge";
import FaqSection from "./sections/FaqSection";
import ClosingCta from "./sections/ClosingCta";
import Footer from "./sections/Footer";

/*
 * The "front door" of StudyBun. The page is one long sky: a plush wordmark
 * floating at dusk, a cream daylight stretch for the actual product, then
 * back to night for the FAQ and a sleeping bunny. `onGetStarted` is called
 * from every CTA and hands control back to AppRoot, which swaps this out
 * for the Auth screen.
 */
const NIGHT = "#0A1138";

export default function Landing({ onGetStarted }) {
  // Tint the mobile browser chrome to match the hero sky while this page is up.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return undefined;
    const prev = meta.getAttribute("content");
    meta.setAttribute("content", NIGHT);
    return () => { if (prev) meta.setAttribute("content", prev); };
  }, []);

  return (
    <div className="lp">
      <LandingStyle />
      <NavBar onGetStarted={onGetStarted} />
      <Hero onGetStarted={onGetStarted} />
      <FeatureShowcase />
      <ThemeGallery />
      <TrustSection />
      <DuskBridge />
      <div className="lp-night">
        <FaqSection />
        <ClosingCta onGetStarted={onGetStarted} />
        <Footer />
      </div>
    </div>
  );
}
