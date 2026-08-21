import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const RISE_MS  = 680;
const FALL_MS  = 720;
const HOLD_MS  = 80;   // brief peak hold before falling

/* ─────────────────────────────────────────────────────────────────────────────
   FloodTransition
   • Children is a render-prop: children(displayLocation)
   • We pass a *delayed* location so Routes renders the OLD page while water rises
   • At the peak the real location is shown; then water recedes revealing it
───────────────────────────────────────────────────────────────────────────── */
export default function FloodTransition({ children }) {
  const location      = useLocation();
  const [displayLoc, setDisplayLoc] = useState(location);
  // 'initial' | 'rising' | 'falling' | 'idle'
  const [phase, setPhase] = useState('initial');
  const prevKeyRef   = useRef(location.key);
  const timersRef    = useRef([]);

  function clearTimers() {
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];
  }

  /* ── Initial page-load reveal ─────────────────────────────────────────── */
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      setPhase('idle');
      return;
    }
    const raf = requestAnimationFrame(() => {
      setPhase('falling');
      const t = setTimeout(() => setPhase('idle'), FALL_MS + 200);
      timersRef.current.push(t);
    });
    return () => { cancelAnimationFrame(raf); clearTimers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Route-change transition ─────────────────────────────────────────── */
  useEffect(() => {
    if (location.key === prevKeyRef.current) return;
    prevKeyRef.current = location.key;
    clearTimers();

    if (location.pathname.startsWith('/admin')) {
      setDisplayLoc(location);
      setPhase('idle');
      return;
    }

    setPhase('rising');

    const t1 = setTimeout(() => {
      setDisplayLoc(location);
      window.scrollTo({ top: 0 });
      setPhase('falling');
    }, RISE_MS + HOLD_MS);

    const t2 = setTimeout(() => {
      setPhase('idle');
    }, RISE_MS + HOLD_MS + FALL_MS);

    timersRef.current = [t1, t2];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <>
      {children(displayLoc)}
      <WaterOverlay phase={phase} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Memoised data generators
───────────────────────────────────────────────────────────────────────────── */
function useRainDrops(count) {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left:     `${(Math.random() * 100).toFixed(1)}%`,
      delay:    `${(Math.random() * 2).toFixed(2)}s`,
      duration: `${(0.3 + Math.random() * 0.55).toFixed(2)}s`,
      width:    (1 + Math.random() * 1.5).toFixed(1),
      height:   Math.round(9 + Math.random() * 20),
      opacity:  (0.1 + Math.random() * 0.35).toFixed(2),
    })),
  [count]);
}

function useBubbles(count) {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id:       i,
      left:     `${(5 + Math.random() * 90).toFixed(1)}%`,
      bottom:   `${(Math.random() * 15).toFixed(1)}%`,
      size:     Math.round(4 + Math.random() * 12),
      delay:    `${(Math.random() * 2.5).toFixed(2)}s`,
      duration: `${(1.8 + Math.random() * 2.5).toFixed(2)}s`,
    })),
  [count]);
}

/* ─────────────────────────────────────────────────────────────────────────────
   WaterOverlay component
───────────────────────────────────────────────────────────────────────────── */
function WaterOverlay({ phase }) {
  const rainDrops = useRainDrops(52);
  const bubbles   = useBubbles(14);

  if (phase === 'idle') return null;

  const isHigh = phase === 'initial' || phase === 'rising';

  const bodyStyle = {
    position:   'absolute',
    bottom:     0,
    left:       0,
    right:      0,
    height:     isHigh ? '115%' : '0%',
    transition: phase === 'initial'
      ? 'none'
      : isHigh
        ? `height ${RISE_MS}ms cubic-bezier(0.55,0,0.45,1)`
        : `height ${FALL_MS}ms cubic-bezier(0.55,0,0.45,1)`,
    overflow: 'visible',
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        9999,
        overflow:      'hidden',
        pointerEvents: phase === 'rising' ? 'all' : 'none',
      }}
    >
      <div style={bodyStyle}>
        {/* ── Animated wave top-edge (overflows above water surface) ──── */}
        <div style={{ position: 'absolute', top: -76, left: 0, right: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
          {/* Wave 1 — teal, medium speed */}
          <div className="flood-wave-anim" style={{ animationDuration: '4.8s', width: '200%' }}>
            <svg viewBox="0 0 2880 80" style={{ width: '100%', display: 'block', height: 80 }} preserveAspectRatio="none">
              <path
                d="M0,40 C100,75 260,75 360,40 C460,5 620,5 720,40 C820,75 980,75 1080,40 C1180,5 1340,5 1440,40 C1540,75 1700,75 1800,40 C1900,5 2060,5 2160,40 C2260,75 2420,75 2520,40 C2620,5 2780,5 2880,40 L2880,120 L0,120 Z"
                fill="rgba(31,111,148,0.9)"
              />
            </svg>
          </div>
        </div>

        {/* ── Water body ───────────────────────────────────────────────── */}
        <div style={{
          position:   'absolute',
          inset:      0,
          background: 'linear-gradient(180deg, #1a5575 0%, #123a54 30%, #0d2b42 65%, #07182a 100%)',
          overflow:   'hidden',
        }}>
          {/* Inner wave 2 — darker, opposite direction */}
          <div style={{ position: 'absolute', top: -68, left: 0, right: 0, overflow: 'hidden', zIndex: 1 }}>
            <div className="flood-wave-anim" style={{ animationDuration: '6.5s', animationDirection: 'reverse', width: '200%' }}>
              <svg viewBox="0 0 2880 80" style={{ width: '100%', display: 'block', height: 80 }} preserveAspectRatio="none">
                <path
                  d="M0,40 C100,5 260,5 360,40 C460,75 620,75 720,40 C820,5 980,5 1080,40 C1180,75 1340,75 1440,40 C1540,5 1700,5 1800,40 C1900,75 2060,75 2160,40 C2260,5 2420,5 2520,40 C2620,75 2780,75 2880,40 L2880,120 L0,120 Z"
                  fill="rgba(13,43,66,0.7)"
                />
              </svg>
            </div>
          </div>

          {/* Inner wave 3 — very dark, slowest */}
          <div style={{ position: 'absolute', top: -55, left: 0, right: 0, overflow: 'hidden', zIndex: 0 }}>
            <div className="flood-wave-anim" style={{ animationDuration: '9s', width: '200%' }}>
              <svg viewBox="0 0 2880 80" style={{ width: '100%', display: 'block', height: 80 }} preserveAspectRatio="none">
                <path
                  d="M0,50 C120,75 240,25 360,50 C480,75 600,25 720,50 C840,75 960,25 1080,50 C1200,75 1320,25 1440,50 C1560,75 1680,25 1800,50 C1920,75 2040,25 2160,50 C2280,75 2400,25 2520,50 C2640,75 2760,25 2880,50 L2880,120 L0,120 Z"
                  fill="rgba(7,24,42,0.75)"
                />
              </svg>
            </div>
          </div>

          {/* Horizontal shimmer streak */}
          <div className="flood-shimmer" />

          {/* Rain drops */}
          {rainDrops.map(d => (
            <span key={d.id} className="flood-rain-drop" style={{
              left:              d.left,
              animationDelay:    d.delay,
              animationDuration: d.duration,
              width:             `${d.width}px`,
              height:            `${d.height}px`,
              opacity:           d.opacity,
            }} />
          ))}

          {/* Bubbles */}
          {bubbles.map(b => (
            <div key={b.id} className="flood-bubble" style={{
              left:              b.left,
              bottom:            b.bottom,
              width:             b.size,
              height:            b.size,
              animationDelay:    b.delay,
              animationDuration: b.duration,
            }} />
          ))}

          {/* ── Center Branding ─────────────────────────────────────── */}
          <div style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            20,
            paddingBottom:  60,
          }}>
            {/* Logo + ripple rings */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/PUBMAT3.png"
                alt="SmartFlood"
                style={{
                  width:        80,
                  height:       80,
                  borderRadius: '50%',
                  objectFit:    'cover',
                  border:       '3px solid rgba(255,255,255,0.28)',
                  boxShadow:    '0 0 50px rgba(31,111,148,0.9), 0 0 100px rgba(31,111,148,0.4)',
                  position:     'relative',
                  zIndex:       2,
                  animation:    'flood-logo-pulse 2s ease-in-out infinite',
                }}
              />
              <div className="flood-ripple" style={{ animationDelay: '0s'   }} />
              <div className="flood-ripple" style={{ animationDelay: '0.8s' }} />
              <div className="flood-ripple" style={{ animationDelay: '1.6s' }} />
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{
                fontSize:      32,
                fontWeight:    800,
                fontFamily:    'Outfit, sans-serif',
                letterSpacing: 5,
                lineHeight:    1,
                textShadow:    '0 2px 40px rgba(0,0,0,0.7)',
                animation:     'fadeIn 0.4s ease-out both',
              }}>
                SmartFlood
              </div>
              <div style={{
                fontSize:      9,
                fontFamily:    'JetBrains Mono, monospace',
                letterSpacing: 5,
                opacity:       0.45,
                marginTop:     8,
                textTransform: 'uppercase',
                animation:     'fadeIn 0.6s ease-out both',
              }}>
                Real-Time Flood Monitoring
              </div>
            </div>

            {/* Animated loading dots */}
            <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="flood-dot" style={{ animationDelay: `${i * 0.22}s` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
