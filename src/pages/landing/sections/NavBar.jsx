import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/*
 * Landing nav, rebuilt from zero on GSAP -- nothing here reuses the old
 * markup, class names, or timing. Every moving part is choreographed by
 * gsap instead of leaning on CSS transitions:
 *
 *   - mount:      a timeline drops the rail in and staggers brand/links/CTA
 *   - scroll:     a ScrollTrigger crosses a threshold once and tweens the
 *                 rail from a loose floating pill into a tight compact bar
 *   - active link: an IntersectionObserver-free ScrollTrigger per section
 *                 drives a pill that *morphs* (x + width) to sit under
 *                 whichever link is current, with an elastic settle
 *   - hover:      quickTo-based magnetic pull on every link + the CTA
 *   - mobile:     a hand-built 3-bar burger morphs into an X, and a
 *                 full-bleed overlay staggers its links in on open
 *
 * Section ids it targets (unchanged, defined by the sections themselves):
 * sb-land-features, sb-land-themes, sb-land-faq.
 */

const LINKS = [
  { id: "sb-land-features", label: "Features" },
  { id: "sb-land-themes", label: "Themes" },
  { id: "sb-land-faq", label: "FAQ" },
];

const NAV_OFFSET = 88; // keeps scrolled-to sections clear of the floating rail

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
}

export default function NavBar({ onGetStarted }) {
  const rootRef = useRef(null);
  const railRef = useRef(null);
  const brandRef = useRef(null);
  const linksWrapRef = useRef(null);
  const linkRefs = useRef([]);
  const pillRef = useRef(null);
  const ctaRef = useRef(null);
  const burgerRef = useRef(null);
  const burgerBarRefs = useRef([]);
  const overlayRef = useRef(null);
  const overlayItemRefs = useRef([]);

  const [activeId, setActiveId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // ---- mount entrance + scroll-compress + active-section tracking ----
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(rootRef.current, { autoAlpha: 1 });

      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from(railRef.current, { y: -76, duration: 0.75 })
        .from(brandRef.current, { autoAlpha: 0, x: -16, duration: 0.5, ease: "power2.out" }, "-=0.4")
        .from(
          linkRefs.current.filter(Boolean),
          { autoAlpha: 0, y: -12, stagger: 0.08, duration: 0.45, ease: "power2.out" },
          "-=0.3"
        )
        .from(ctaRef.current, { autoAlpha: 0, scale: 0.6, duration: 0.5, ease: "back.out(2.2)" }, "-=0.35")
        .from(burgerRef.current, { autoAlpha: 0, scale: 0.6, duration: 0.4, ease: "back.out(2.2)" }, "-=0.4");

      const sections = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean);
      let compact = false;
      let lastActive;

      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate(self) {
          // compact the rail past a small threshold
          const shouldCompact = self.scroll() > 30;
          if (shouldCompact !== compact) {
            compact = shouldCompact;
            gsap.to(railRef.current, {
              marginTop: compact ? 6 : 14,
              paddingTop: compact ? 7 : 10,
              paddingBottom: compact ? 7 : 10,
              boxShadow: compact ? "0 8px 22px rgba(6,10,50,.4)" : "0 12px 34px rgba(6,10,50,.32)",
              duration: 0.45,
              ease: "power3.out",
            });
          }

          // single source of truth for which section is "active" --
          // whichever section's midpoint the viewport center has passed
          const viewportMid = self.scroll() + window.innerHeight / 2;
          let current = null;
          for (const section of sections) {
            if (viewportMid >= section.getBoundingClientRect().top + window.scrollY) current = section.id;
          }
          if (current !== lastActive) {
            lastActive = current;
            setActiveId(current);
          }
        },
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // ---- morph the pill under whichever link is active ----
  useEffect(() => {
    const idx = LINKS.findIndex((l) => l.id === activeId);
    const target = linkRefs.current[idx];
    if (!target || !pillRef.current || !linksWrapRef.current) {
      gsap.to(pillRef.current, { autoAlpha: 0, duration: 0.25, ease: "power2.out" });
      return;
    }
    const targetBox = target.getBoundingClientRect();
    const wrapBox = linksWrapRef.current.getBoundingClientRect();
    gsap.to(pillRef.current, {
      autoAlpha: 1,
      x: targetBox.left - wrapBox.left,
      width: targetBox.width,
      duration: 0.55,
      ease: "elastic.out(1, 0.75)",
    });
  }, [activeId]);

  // ---- magnetic hover pull on links + CTA ----
  useEffect(() => {
    const targets = [...linkRefs.current, ctaRef.current].filter(Boolean);
    const teardowns = targets.map((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3" });
      function onMove(e) {
        const box = el.getBoundingClientRect();
        xTo((e.clientX - box.left - box.width / 2) * 0.28);
        yTo((e.clientY - box.top - box.height / 2) * 0.4);
      }
      function onLeave() {
        xTo(0);
        yTo(0);
      }
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      };
    });
    return () => teardowns.forEach((fn) => fn());
  }, []);

  // ---- burger morph + full-bleed mobile overlay ----
  useEffect(() => {
    const bars = burgerBarRefs.current;
    if (!bars.length) return;

    if (menuOpen) {
      document.body.style.overflow = "hidden";
      gsap.to(bars[0], { rotate: 45, y: 6, duration: 0.35, ease: "power3.inOut" });
      gsap.to(bars[1], { autoAlpha: 0, duration: 0.2, ease: "power2.out" });
      gsap.to(bars[2], { rotate: -45, y: -6, duration: 0.35, ease: "power3.inOut" });

      gsap.set(overlayRef.current, { display: "flex" });
      gsap.fromTo(
        overlayRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" }
      );
      gsap.fromTo(
        overlayItemRefs.current.filter(Boolean),
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.5, ease: "back.out(1.8)", delay: 0.08 }
      );
    } else {
      document.body.style.overflow = "";
      gsap.to(bars[0], { rotate: 0, y: 0, duration: 0.3, ease: "power3.inOut" });
      gsap.to(bars[1], { autoAlpha: 1, duration: 0.25, delay: 0.1, ease: "power2.out" });
      gsap.to(bars[2], { rotate: 0, y: 0, duration: 0.3, ease: "power3.inOut" });
      gsap.to(overlayRef.current, {
        autoAlpha: 0,
        duration: 0.28,
        ease: "power2.in",
        onComplete() {
          gsap.set(overlayRef.current, { display: "none" });
        },
      });
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // ---- escape key + resize safety net for the overlay ----
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onResize() {
      if (window.innerWidth > 640) setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function go(id) {
    setMenuOpen(false);
    scrollToId(id);
  }

  return (
    <>
      <div className="sb-nav" ref={rootRef}>
        <div className="sb-nav-rail" ref={railRef}>
          <button
            type="button"
            className="sb-nav-brand"
            ref={brandRef}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="StudyBun home"
          >
            <img src="/landing/bunny-sit.webp" width="34" height="34" alt="" />
            <span className="sb-nav-brand-title">StudyBun</span>
          </button>

          <div className="sb-nav-links" ref={linksWrapRef}>
            <span className="lp-nav-pill" ref={pillRef} aria-hidden="true" />
            {LINKS.map((link, i) => (
              <button
                key={link.id}
                type="button"
                ref={(el) => (linkRefs.current[i] = el)}
                className={`sb-nav-link${activeId === link.id ? " is-active" : ""}`}
                onClick={() => go(link.id)}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="sb-nav-actions">
            <button type="button" className="sb-nav-cta" ref={ctaRef} onClick={onGetStarted}>
              Sign in
            </button>

            <button
              type="button"
              className="sb-nav-burger"
              ref={burgerRef}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span ref={(el) => (burgerBarRefs.current[0] = el)} />
              <span ref={(el) => (burgerBarRefs.current[1] = el)} />
              <span ref={(el) => (burgerBarRefs.current[2] = el)} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="sb-nav-overlay"
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) setMenuOpen(false);
        }}
      >
        {LINKS.map((link, i) => (
          <button
            key={link.id}
            type="button"
            ref={(el) => (overlayItemRefs.current[i] = el)}
            className="sb-nav-overlay-link"
            onClick={() => go(link.id)}
          >
            {link.label}
          </button>
        ))}
        <button
          type="button"
          ref={(el) => (overlayItemRefs.current[LINKS.length] = el)}
          className="sb-nav-overlay-cta"
          onClick={() => {
            setMenuOpen(false);
            onGetStarted?.();
          }}
        >
          Sign in
        </button>
      </div>

      <style>{`
        .lp .sb-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; visibility: hidden; padding: 0 clamp(12px, 3vw, 28px); pointer-events: none; }
        .lp .sb-nav-rail {
          pointer-events: auto; max-width: 1120px; margin: 14px auto 0; display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 10px 12px 10px 18px; border-radius: 999px; background: rgba(255, 246, 236, .93);
          border: 1px solid rgba(255, 255, 255, .7); box-shadow: 0 12px 34px rgba(6, 10, 50, .32);
        }

        .sb-nav-brand { display: flex; align-items: center; gap: 9px; background: none; border: none; padding: 0; cursor: pointer; }
        .sb-nav-brand img { width: 34px; height: 34px; object-fit: cover; object-position: 50% 6%; }
        .sb-nav-brand-title { font: 800 19px/1 var(--lp-display); color: var(--lp-ink); }

        .sb-nav-links { position: relative; display: flex; align-items: center; gap: 2px; }
        .lp-nav-pill { position: absolute; left: 0; top: 3px; bottom: 3px; width: 0; border-radius: 999px; background: rgba(232, 115, 95, .16); opacity: 0; z-index: 0; }
        .sb-nav-link {
          position: relative; z-index: 1; background: none; border: none; font: 700 14px/1 var(--lp-body);
          color: var(--lp-ink-soft); padding: 11px 16px; border-radius: 999px; cursor: pointer;
        }
        .sb-nav-link:hover, .sb-nav-link.is-active { color: var(--lp-ink); }
        @media (max-width: 640px) { .sb-nav-links { display: none; } }

        .sb-nav-actions { display: flex; align-items: center; gap: 10px; }
        .sb-nav-cta {
          display: inline-flex; align-items: center; background: var(--lp-ink); color: var(--lp-cream); border: 0; border-radius: 999px;
          padding: 12px 22px; font: 800 14px/1 var(--lp-body); cursor: pointer; box-shadow: 0 6px 16px rgba(42, 27, 77, .3);
        }
        @media (max-width: 640px) { .sb-nav-cta { display: none; } }

        .sb-nav-burger {
          display: none; position: relative; width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--lp-line);
          background: #fff; cursor: pointer; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
        }
        .sb-nav-burger span { display: block; width: 18px; height: 2.5px; border-radius: 2px; background: var(--lp-ink); transform-origin: center; }
        @media (max-width: 640px) { .sb-nav-burger { display: flex; } }

        .sb-nav-overlay {
          display: none; position: fixed; inset: 0; z-index: 70; flex-direction: column; align-items: center; justify-content: center;
          gap: 22px; background: var(--lp-night); opacity: 0;
        }
        .sb-nav-overlay-link { background: none; border: none; font: 800 32px/1.1 var(--lp-display); color: var(--lp-cream); cursor: pointer; }
        .sb-nav-overlay-cta {
          margin-top: 10px; display: inline-flex; align-items: center; color: var(--lp-ink); border: 0; border-radius: 999px; padding: 16px 32px;
          font: 800 16px/1 var(--lp-body); cursor: pointer; background: linear-gradient(180deg, #FFF3DF 0%, #FFD9A6 100%);
        }
      `}</style>
    </>
  );
}
