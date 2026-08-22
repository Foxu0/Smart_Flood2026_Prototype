import React, { useEffect, useRef, useState } from 'react';
import useCountUp from '../hooks/useCountUp.js';

/**
 * WaterTankGauge — Premium animated SVG water tank
 *
 * Features:
 * - Animated sine wave water surface (requestAnimationFrame)
 * - Smooth fill height transition by level
 * - Rising bubble particles inside the water column
 * - Danger dashed line at 1.60 m
 * - Circular arc progress ring behind the tank
 * - Animated digit readout via useCountUp
 */
export default function WaterTankGauge({ levelM, maxM = 1.8, dangerM = 1.6, color }) {
  const pct    = Math.min(100, Math.max(0, (levelM / maxM) * 100));
  const fillH  = 160; // inner drawable height in SVG units
  const tankW  = 120; // wider tank width in SVG units
  const fillY  = fillH * (1 - pct / 100);

  // Animated wave path via rAF
  const [waveOffset, setWaveOffset] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    let startT = null;
    const step = (t) => {
      if (!startT) startT = t;
      setWaveOffset(((t - startT) / 1200) * Math.PI * 2);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Build sine-wave SVG path along the water surface (width 120)
  const wavePoints = [];
  for (let x = 0; x <= tankW; x += 5) {
    const y = fillY + Math.sin((x / tankW) * Math.PI * 2 + waveOffset) * 3.5;
    wavePoints.push(`${x},${y}`);
  }
  const wavePath = `M 0,${fillY} L ${wavePoints.join(' L ')} L ${tankW},${fillH} L 0,${fillH} Z`;

  // Danger line in SVG units
  const dangerVal = dangerM || 1.6;
  const dangerY = fillH * (1 - Math.min(maxM, Math.max(0, dangerVal)) / maxM);

  // Animated counter
  const displayVal = useCountUp(levelM, 900, 2);

  // Circular progress ring
  const radius = 75;
  const circ   = 2 * Math.PI * radius;
  const dash   = circ * (pct / 100);

  return (
    <div className="flex flex-col items-center gap-3 flex-shrink-0 select-none">
      {/* Circular progress arc behind tank */}
      <div className="relative flex items-center justify-center">
        <svg
          width="178"
          height="178"
          viewBox="-89 -89 178 178"
          className="absolute top-0 left-0"
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        >
          {/* Track ring */}
          <circle r={radius} fill="none" stroke={`${color}18`} strokeWidth="6" />
          {/* Progress ring */}
          <circle
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            style={{ transition: 'stroke-dasharray 1s ease-out' }}
            opacity="0.55"
          />
        </svg>

        {/* Tank SVG */}
        <svg
          width="130"
          height="180"
          viewBox="-5 -10 130 186"
          className="relative z-10"
        >
          <defs>
            <clipPath id="tankClip">
              <rect x="0" y="0" width={tankW} height={fillH} rx="18" />
            </clipPath>
            <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.65" />
              <stop offset="100%" stopColor={color} stopOpacity="0.95" />
            </linearGradient>
            <filter id="tankInnerShadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#123a54" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Tank body (outer border) */}
          <rect x="0" y="0" width={tankW} height={fillH} rx="18"
            fill="#f4fbfd" stroke="#123a54" strokeWidth="3.5"
            filter="url(#tankInnerShadow)" />

          {/* Water fill with animated wave */}
          <g clipPath="url(#tankClip)">
            <path d={wavePath} fill="url(#waterGrad)"
              style={{ transition: 'all 1s ease-out' }} />

            {/* Bubbles */}
            {[
              { cx: 25, cy: fillH - 12, r: 3.5, dur: '2.4s', delay: '0s' },
              { cx: 60, cy: fillH - 20, r: 2.5, dur: '3.1s', delay: '0.8s' },
              { cx: 95, cy: fillH - 8,  r: 3.0, dur: '2.7s', delay: '1.5s' },
            ].map((b, i) => (
              pct > 5 && (
                <circle key={i}
                  cx={b.cx} cy={b.cy} r={b.r}
                  fill="rgba(255,255,255,0.55)"
                  className="bubble"
                  style={{ animationDuration: b.dur, animationDelay: b.delay }}
                />
              )
            ))}
          </g>

          {/* Danger dashed line */}
          <line x1="0" y1={dangerY} x2={tankW} y2={dangerY}
            stroke="#e0522f" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
          <text x="6" y={dangerY - 4} fontSize="7.5" fill="#e0522f" fontWeight="bold">
            DANGER {dangerVal.toFixed(1)}m
          </text>

          {/* Scale ticks on right edge */}
          {[0.5, 1.0, 1.5].map(v => {
            const ty = fillH * (1 - v / maxM);
            return (
              <g key={v}>
                <line x1="110" y1={ty} x2="120" y2={ty}
                  stroke="#123a5466" strokeWidth="1" />
                <text x="108" y={ty + 3} textAnchor="end" fontSize="6.5"
                  fill="#123a54aa" fontWeight="600">
                  {v.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Animated digit readout */}
      <div className="text-center">
        <div
          className="font-display font-bold text-3xl leading-none"
          style={{ color: '#123a54' }}
        >
          {displayVal} <span className="text-lg font-semibold opacity-60">m</span>
        </div>
        <div className="text-[10px] text-[#6d818d] mt-1 leading-snug">
          Water Level · Danger at {dangerVal.toFixed(2)} m
        </div>
        {/* Pct bar relative to Danger Level */}
        {(() => {
          const dangerPct = Math.min(100, Math.max(0, (levelM / dangerVal) * 100));
          return (
            <>
              <div className="mt-2 w-32 h-1.5 bg-[#eef4f6] rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${dangerPct}%`,
                    background: color,
                    transition: 'width 1s ease-out',
                  }}
                />
              </div>
              <div className="text-[9px] text-[#6d818d] mt-0.5">
                {dangerPct.toFixed(0)}% of danger capacity
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
