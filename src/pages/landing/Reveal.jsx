import React, { useEffect, useRef, useState } from "react";

/*
 * Lightweight scroll-reveal wrapper — no animation library needed.
 * Watches its own element with an IntersectionObserver and flips a class
 * on once it enters the viewport (and never removes it again, so the
 * page doesn't jitter if someone scrolls back up past it).
 */
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, style, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // If the browser has no IntersectionObserver, just show it immediately.
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setInView(true); io.unobserve(node); }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`sb-reveal${inView ? " sb-reveal-in" : ""}${className ? ` ${className}` : ""}`}
      style={{ ...style, transitionDelay: inView ? `${delay}ms` : "0ms" }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
