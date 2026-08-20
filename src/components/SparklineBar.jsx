import React, { useEffect, useRef } from 'react';

/**
 * SparklineBar — A 10-bar micro sparkline showing recent water level deltas.
 *
 * Maintains a ring buffer of deltas (Δ between consecutive readings).
 * Bar color encodes magnitude:
 *   green  = stable  (Δ < 0.01)
 *   amber  = rising  (Δ < 0.05)
 *   red    = surging (Δ >= 0.05)
 * Negative deltas (falling water) use blue bars.
 */

const MAX_BARS = 10;

export default function SparklineBar({ currentLevel }) {
  const bufferRef = useRef([]);
  const prevLevelRef = useRef(null);

  // Push new delta every time currentLevel changes
  if (prevLevelRef.current !== null && prevLevelRef.current !== currentLevel) {
    const delta = currentLevel - prevLevelRef.current;
    bufferRef.current = [...bufferRef.current, delta].slice(-MAX_BARS);
  }
  prevLevelRef.current = currentLevel;

  const deltas = bufferRef.current;

  // Pad with zeros if not enough history yet
  const bars = Array.from({ length: MAX_BARS }, (_, i) => deltas[i] ?? 0);
  const maxAbs = Math.max(0.01, ...bars.map(Math.abs));

  const barColor = (d) => {
    if (d < -0.005) return '#2b6e8f';   // falling — blue
    if (d < 0.005)  return '#2f9463';   // stable  — green
    if (d < 0.04)   return '#e69138';   // rising  — amber
    return '#e0522f';                    // surging — red
  };

  return (
    <span
      className="inline-flex items-end gap-[2px] h-4"
      title={`Last ${MAX_BARS} level change deltas (Δ m)`}
    >
      {bars.map((d, i) => {
        const heightPct = Math.max(15, (Math.abs(d) / maxAbs) * 100);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: '4px',
              height: `${heightPct}%`,
              borderRadius: '1px',
              background: barColor(d),
              opacity: 0.65 + (i / MAX_BARS) * 0.35, // fade in older bars
              transition: 'height 0.6s ease-out, background 0.4s',
            }}
          />
        );
      })}
    </span>
  );
}
