import { useState, useEffect, useRef } from 'react';

/**
 * useCountUp — Smoothly animates a number from its old value to a new target value.
 * Uses requestAnimationFrame for a 60fps lerp over `duration` milliseconds.
 *
 * @param {number} target   - The target value to animate toward
 * @param {number} duration - Animation duration in ms (default 800)
 * @param {number} decimals - Number of decimal places in the output string
 * @returns {string}        - The current animated display value (as a formatted string)
 */
export default function useCountUp(target, duration = 800, decimals = 2) {
  const [display, setDisplay] = useState(target);
  const startRef = useRef(null);
  const fromRef  = useRef(target);
  const rafRef   = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to   = target;

    // No animation needed if value hasn't changed
    if (from === to) return;

    // Cancel any in-flight animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    startRef.current = null;

    const step = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return typeof display === 'number'
    ? display.toFixed(decimals)
    : String(display);
}
