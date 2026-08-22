import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  CircleMarker, useMap, ImageOverlay,
} from 'react-leaflet';
import L from 'leaflet';
import { Layers, Radio, Play, Pause, SkipForward, Info } from 'lucide-react';
import DataSourcesDisclaimerModal from './components/DataSourcesDisclaimerModal';

const API_KEY = '9c04674c3ef012dce3e3d789ea5ba263';

/* ── Severity-keyed beacon colours ─────────────────────────────────────── */
const BEACON = [
  { color: '#2f9463', label: 'Normal', rings: 2 },
  { color: '#2b6e8f', label: 'Watch',  rings: 2 },
  { color: '#e69138', label: 'Alarm',  rings: 3 },
  { color: '#e0522f', label: 'Danger', rings: 3 },
];

/* ── Flood-prone barangays of Antipolo City ─────────────────────────────


/* ── Severity beacon DivIcon ────────────────────────────────────────────── */
function buildBeaconIcon(severityId = 0) {
  const b = BEACON[severityId] || BEACON[0];
  const c = b.color;
  const ringsHtml = Array.from({ length: b.rings })
    .map((_, i) => `
      <div style="
        position:absolute; inset:0; border-radius:50%;
        border:2.5px solid ${c};
        animation:ping-ring 2s ease-out ${i * 0.6}s infinite;
        pointer-events:none;
        box-sizing:border-box;
      "></div>
    `).join('');
  return L.divIcon({
    className: 'station-beacon-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
    html: `
      <div style="position:relative;width:32px;height:32px;box-sizing:border-box;">
        ${ringsHtml}
        <div style="
          position:absolute;inset:6px;border-radius:50%;
          background:${c};border:2.5px solid white;
          box-shadow:0 0 10px ${c}cc;
          box-sizing:border-box;
        "></div>
      </div>
    `,
  });
}

/* ── Inner component: swaps TileLayer URL when frame changes ────────────── */
function RadarLayer({ path, opacity = 0.65 }) {
  if (!path) return null;
  return (
    <TileLayer
      key={path}
      url={`https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`}
      opacity={opacity}
      maxZoom={18}
      maxNativeZoom={6}
    />
  );
}

/* ── Philippine Area Boundary & Map Limits ──────────────────────────────── */
const PAGASA_SAT_BOUNDS = [
  [-1.0, 102.0],  // Southwest corner (expanded full-bleed to cover container width)
  [25.5, 144.0], // Northeast corner (expanded full-bleed to cover container width)
];

const PH_RADAR_BOUNDS = [
  [4.0, 115.0],
  [22.0, 132.0],
];

/* ── Dynamic Camera & Boundary Lock Controller ──────────────────────────── */
function MapViewController({ mapViewMode }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size to ensure container dimensions are computed cleanly (prevents grey screen)
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    if (mapViewMode === 'pagasa') {
      // Fit bounds to cover 100% of container width without side gaps
      map.fitBounds(PAGASA_SAT_BOUNDS, { animate: true, padding: [0, 0] });
      map.setMinZoom(4);
      map.setMaxBounds(PAGASA_SAT_BOUNDS);
    } else {
      // Return to local flood radar view centered on Antipolo
      map.setMinZoom(6);
      map.setMaxBounds(PH_RADAR_BOUNDS);
      map.flyTo([14.5869, 121.1754], 10, { animate: true, duration: 0.8 });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapViewMode, map]);

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function WeatherMapCard({ severity = 0 }) {
  const antipoloPos = [14.5869, 121.1754];

  /* ── Map View Mode: default 'pagasa' (DOST-PAGASA Himawari Satellite IR) ── */
  const [mapViewMode, setMapViewMode] = useState('pagasa');

  /* ── Radar frames state ─────────────────────────────────────────────── */
  const [frames, setFrames]             = useState([]);     // all past + nowcast frames
  const [frameIdx, setFrameIdx]         = useState(-1);     // -1 = live (latest)
  const [isPlaying]                     = useState(true);   // Permanent active loop
  const [radarTimeStr, setRadarTimeStr] = useState('Fetching radar...');
  const [nextRefreshSec, setNextRefreshSec] = useState(120);
  const playTimerRef = useRef(null);

  /* ── PAGASA Satellite Animation State (Chronological loop: 24irsml.gif [-23h] → 1irsml.gif [Live]) ── */
  const [satFrameIdx, setSatFrameIdx]   = useState(23); // 23 = 24irsml.gif (oldest past scan), decrements forward to 0 (1irsml.gif = Live)
  const [isSatPlaying]                  = useState(true);
  const satTimerRef = useRef(null);

  /* Preload all 24 PAGASA Himawari Satellite GIF images into browser cache for zero-flicker 60fps animation */
  useEffect(() => {
    for (let i = 1; i <= 24; i++) {
      const img = new Image();
      img.src = `https://src.meteopilipinas.gov.ph/repo/himawari/24hour/irsml/${i}irsml.gif`;
    }
  }, []);

  /* Chronological forward playback: from Past (-23h) → Live (1irsml.gif) */
  useEffect(() => {
    if (satTimerRef.current) clearInterval(satTimerRef.current);
    if (!isSatPlaying) return;

    satTimerRef.current = setInterval(() => {
      setSatFrameIdx(prev => (prev <= 0 ? 23 : prev - 1));
    }, 350); // 350ms per frame = smooth chronological PAGASA cloud motion

    return () => clearInterval(satTimerRef.current);
  }, [isSatPlaying]);

  const currentSatUrl = `https://src.meteopilipinas.gov.ph/repo/himawari/24hour/irsml/${satFrameIdx + 1}irsml.gif`;

  /* ── Flood zone toggle ──────────────────────────────────────────────── */
  const [showZones, setShowZones] = useState(true);

  /* ── Inject ping-ring keyframes once ────────────────────────────────── */
  useEffect(() => {
    const styleId = 'beacon-keyframes';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes ping-ring {
        0%   { transform: scale(1);   opacity: 0.75; }
        100% { transform: scale(2.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  /* ── Fetch RainViewer frames (past + nowcast) ───────────────────────── */
  const fetchFrames = useCallback(async () => {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) return;
      const data = await res.json();

      const past    = data.radar?.past    || [];
      const nowcast = data.radar?.nowcast || [];
      const allFrames = [
        ...past.map(f => ({ ...f, type: 'past' })),
        ...nowcast.map(f => ({ ...f, type: 'forecast' })),
      ];

      setFrames(allFrames);
      const lastPast = past[past.length - 1];
      if (lastPast) {
        const dateObj = new Date(lastPast.time * 1000);
        setRadarTimeStr(`Live · ${dateObj.toLocaleTimeString('en-PH', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        })}`);
      }
      setNextRefreshSec(120);
    } catch (err) {
      console.error('Failed to update radar tiles:', err);
      setRadarTimeStr('Radar stream active');
    }
  }, []);

  useEffect(() => {
    fetchFrames();
    const interval = setInterval(fetchFrames, 120000);
    const countdown = setInterval(() => {
      setNextRefreshSec(s => (s <= 1 ? 120 : s - 1));
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [fetchFrames]);

  /* ── Radar Playback logic (continuous infinite loop at 550ms interval) ── */
  useEffect(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    if (!isPlaying || frames.length === 0) return;

    playTimerRef.current = setInterval(() => {
      setFrameIdx(prev => {
        const next = prev + 1;
        if (next >= frames.length) return 0; // Infinite continuous loop back to start!
        return next;
      });
    }, 550);

    return () => clearInterval(playTimerRef.current);
  }, [isPlaying, frames]);

  const activeFrame = frameIdx === -1
    ? frames.filter(f => f.type === 'past').slice(-1)[0]
    : frames[frameIdx];
  const activePath = activeFrame?.path || null;

  const frameLabel = (() => {
    if (!activeFrame) return '—';
    const d = new Date(activeFrame.time * 1000);
    const timeStr = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (activeFrame.type === 'forecast') return `+Forecast ${timeStr}`;
    if (frameIdx === -1) return `Live ${timeStr}`;
    return timeStr;
  })();

  const pastFrames     = frames.filter(f => f.type === 'past');
  const forecastFrames = frames.filter(f => f.type === 'forecast');

  const b = BEACON[severity] || BEACON[0];
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] overflow-hidden">
      <div className="bg-[#123a54] text-white px-4 py-2.5 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-sky-200" />
          <h2 className="text-sm font-semibold">Weather Map</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDisclaimer(true)}
            className="flex items-center gap-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 px-2.5 py-1 rounded-full text-[9px] font-bold transition cursor-pointer"
            title="View Data Sources & Disclaimers"
          >
            <Info size={11} />
            <span>Sources &amp; Disclaimers</span>
          </button>
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[9px] font-bold text-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            {radarTimeStr}
          </div>
        </div>
      </div>

      <div className="bg-[#0b2434] px-3 py-1.5 flex items-center justify-between gap-2 border-b border-white/10 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMapViewMode('doppler')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-xs flex items-center gap-1.5 transition-all ${
              mapViewMode === 'doppler'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white/10 text-sky-200 hover:bg-white/20'
            }`}
          >
            <Radio size={12} className={mapViewMode === 'doppler' ? 'animate-pulse' : ''} />
            <span>Rain Radar</span>
          </button>
          <button
            onClick={() => setMapViewMode('pagasa')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-xs flex items-center gap-1.5 transition-all ${
              mapViewMode === 'pagasa'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white/10 text-sky-200 hover:bg-white/20'
            }`}
          >
            <Layers size={12} className={mapViewMode === 'pagasa' ? 'animate-pulse' : ''} />
            <span>PAGASA Satellite</span>
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[9px] text-sky-200/80 font-mono">
          {mapViewMode === 'doppler' ? 'Ground Rain Intensity (dBZ)' : 'PAGASA 24h Himawari IR Loop'}
        </div>
      </div>

      <div className="relative h-[340px] sm:h-[500px] w-full overflow-hidden z-0 bg-[#05131e]">
        {/* Top Right Severity Status Badge */}

        <div
          className="absolute top-3 right-3 z-[1000] px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg border"
          style={{ background: `${b.color}22`, borderColor: `${b.color}55`, color: b.color, backdropFilter: 'blur(8px)' }}
        >
          ● {b.label.toUpperCase()}
        </div>

        {/* Bottom Floating Legend Badge (Only for Rain Radar Doppler) */}
        {mapViewMode === 'doppler' && (
          <div className="absolute bottom-3 right-3 z-[1000] bg-[#123a54]/90 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-lg border border-white/20 text-[10px] space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-sky-200 border-b border-white/10 pb-1">
              <Radio size={12} className="text-emerald-400" />
              <span>RainViewer Doppler</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono">
              <span className="text-gray-300">Light</span>
              <div className="h-2 w-14 rounded overflow-hidden flex mx-1">
                <span className="w-1/4 h-full bg-emerald-400" /><span className="w-1/4 h-full bg-yellow-400" /><span className="w-1/4 h-full bg-orange-500" /><span className="w-1/4 h-full bg-red-600" />
              </div>
              <span className="text-red-300 font-bold">Heavy</span>
            </div>
          </div>
        )}

        {/* 🛰️ MODE 1: PAGASA Satellite Viewport (Full-bleed edge-to-edge coverage, zero spaces) */}
        {mapViewMode === 'pagasa' ? (
          <div className="w-full h-full bg-[#05131e] relative overflow-hidden">
            <img
              src={currentSatUrl}
              alt="DOST-PAGASA Himawari Satellite IR Scan"
              className="w-full h-full object-cover transition-all duration-300"
            />
          </div>
        ) : (
          /* 🌧️ MODE 2: Rain Doppler Radar Map (Interactive Leaflet Dark Mode Map) */
          <MapContainer
            center={antipoloPos}
            zoom={10}
            minZoom={6}
            maxZoom={18}
            maxBounds={PH_RADAR_BOUNDS}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
            attributionControl={false}
          >
            <MapViewController mapViewMode={mapViewMode} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
            <RadarLayer path={activePath} opacity={0.70} />
          </MapContainer>
        )}
      </div>

      {/* Data Sources & Disclaimers Modal */}
      <DataSourcesDisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
      />
    </div>
  );
}
