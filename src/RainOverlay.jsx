import React, { useMemo } from 'react';

// ─── Animated rain layer ───────────────────────────────────────────────────
// intensity: 'none' | 'light' | 'moderate' | 'heavy'
// Purely decorative CSS-driven raindrops; count + speed scale with intensity
// so the animation actually reflects the current rain reading.
export default function RainOverlay({ intensity = 'light', className = '' }) {
  const count = { none: 0, light: 16, moderate: 32, heavy: 54 }[intensity] ?? 16;

  const drops = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      duration: 0.55 + Math.random() * 0.6,
      delay: Math.random() * 2.4,
      opacity: 0.25 + Math.random() * 0.45,
      drift: (Math.random() * 14 - 7).toFixed(1),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count === 0) return null;

  return (
    <div className={`raindrop-layer ${className}`} aria-hidden="true">
      {drops.map(d => (
        <span
          key={d.id}
          className="raindrop"
          style={{
            left: `${d.left}%`,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
            opacity: d.opacity,
            '--drift': `${d.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
