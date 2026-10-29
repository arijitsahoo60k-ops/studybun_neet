import { useEffect, useState } from "react";

/**
 * Natural, randomized blink timer shared by every mascot species.
 * Each species decides for itself how a "blink" actually looks
 * (a cat's slit narrows differently than a bear's eye closes),
 * this hook just supplies the *when*.
 */
export default function useBlink(mood) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let t;
    const cycle = () => {
      t = setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        setTimeout(() => {
          if (!cancelled) setBlink(false);
        }, 140);
        cycle();
      }, 4000 + Math.random() * 2000);
    };
    cycle();
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return blink && mood !== "sleepy";
}
