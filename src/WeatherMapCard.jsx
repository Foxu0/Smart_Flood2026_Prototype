import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Layers, Radio, Info } from 'lucide-react';
import DataSourcesDisclaimerModal from './components/DataSourcesDisclaimerModal';

/* ── Philippine Area Boundary & Map Limits ──────────────────────────────── */
const PAGASA_SAT_BOUNDS = [
  [-1.0, 102.0],  // Southwest corner
  [25.5, 144.0], // Northeast corner
];

const PH_RADAR_BOUNDS = [
  [4.0, 115.0],
  [22.0, 132.0],
];

/* ── Dynamic Camera & Boundary Lock Controller ──────────────────────────── */
function MapViewController({ mapViewMode }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    if (mapViewMode === 'pagasa') {
      map.fitBounds(PAGASA_SAT_BOUNDS, { animate: true, padding: [0, 0] });
      map.setMinZoom(4);
      map.setMaxBounds(PAGASA_SAT_BOUNDS);
    } else {
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
export default function WeatherMapCard() {
  const antipoloPos = [14.5869, 121.1754];

  /* ── Map View Mode: default 'pagasa' or 'doppler' ── */
  const [mapViewMode, setMapViewMode] = useState('pagasa');

  /* ── Radar frames state ─────────────────────────────────────────────── */
  const [frames, setFrames] = useState([]);
  const [activeLoopIdx, setActiveLoopIdx] = useState(0);

  /* ── PAGASA Satellite Animation State ───────────────────────────────── */
  const [satFrameIdx, setSatFrameIdx] = useState(23);
  const [isSatPlaying] = useState(true);
  const satTimerRef = useRef(null);

  /* Preload all 24 PAGASA Himawari Satellite GIF images */
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
    }, 350);

    return () => clearInterval(satTimerRef.current);
  }, [isSatPlaying]);

  const currentSatUrl = `https://src.meteopilipinas.gov.ph/repo/himawari/24hour/irsml/${satFrameIdx + 1}irsml.gif`;

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
      const pastCount = past.length > 0 ? past.length : allFrames.length;
      const loopLen = Math.min(6, pastCount);
      setActiveLoopIdx(Math.max(0, loopLen - 1));
    } catch (err) {
      console.error('Failed to update radar tiles:', err);
    }
  }, []);

  useEffect(() => {
    fetchFrames();
    const interval = setInterval(fetchFrames, 120000);
    return () => clearInterval(interval);
  }, [fetchFrames]);

  /* ── High-Performance Frame Buffer (last 6 frames for instant, smooth loop) ── */
  const radarLoopFrames = useMemo(() => {
    if (!frames || frames.length === 0) return [];
    const past = frames.filter(f => f.type === 'past');
    const subset = past.slice(-6); // last 6 frames (~50-60 mins)
    return subset.length > 0 ? subset : frames.slice(-6);
  }, [frames]);

  /* Background preload tiles for the Antipolo basin to eliminate latency */
  useEffect(() => {
    if (radarLoopFrames.length === 0) return;
    [913, 914].forEach(x => {
      [477, 478].forEach(y => {
        radarLoopFrames.forEach(f => {
          const img = new Image();
          img.src = `https://tilecache.rainviewer.com${f.path}/256/10/${x}/${y}/2/1_1.png`;
        });
      });
    });
  }, [radarLoopFrames]);

  /* ── Intelligent Radar Loop Pacing (750ms on past, 2.2s pause on Live) ── */
  useEffect(() => {
    if (radarLoopFrames.length === 0) return;

    const isLive = activeLoopIdx === radarLoopFrames.length - 1;
    const delay = isLive ? 2200 : 750; // Pause longer on current live frame

    const timer = setTimeout(() => {
      setActiveLoopIdx(prev => (prev + 1) % radarLoopFrames.length);
    }, delay);

    return () => clearTimeout(timer);
  }, [activeLoopIdx, radarLoopFrames.length]);

  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 flex flex-col justify-between min-w-0 w-full overflow-hidden">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#2b6e8f]" />
          <h2 className="text-sm font-semibold text-[#123a54]">Weather Map</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowDisclaimer(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#123a54]/10 hover:bg-[#123a54]/20 text-[#123a54] rounded-full text-xs font-bold transition border border-[#123a54]/15 cursor-pointer"
            title="View Data Sources & Disclaimers"
          >
            <Info size={13} />
            <span>Sources &amp; Disclaimers</span>
          </button>
        </div>
      </div>

      {/* Segmented Control & Meta Caption Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="bg-[#f1f5f7] p-1 rounded-xl flex items-center gap-1 border border-[#e4edf0]">
          <button
            onClick={() => setMapViewMode('doppler')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              mapViewMode === 'doppler'
                ? 'bg-[#2b6e8f] text-white shadow-sm'
                : 'text-[#6d818d] hover:text-[#123a54] hover:bg-white/60 font-semibold'
            }`}
          >
            <Radio size={13} className={mapViewMode === 'doppler' ? 'animate-pulse' : ''} />
            <span>Rain Radar</span>
          </button>
          <button
            onClick={() => setMapViewMode('pagasa')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              mapViewMode === 'pagasa'
                ? 'bg-[#2b6e8f] text-white shadow-sm'
                : 'text-[#6d818d] hover:text-[#123a54] hover:bg-white/60 font-semibold'
            }`}
          >
            <Layers size={13} className={mapViewMode === 'pagasa' ? 'animate-pulse' : ''} />
            <span>PAGASA Satellite</span>
          </button>
        </div>
        <div className="text-[11px] sm:text-xs text-[#6d818d] font-mono font-medium">
          {mapViewMode === 'doppler' ? 'Ground Rain Intensity (dBZ)' : 'PAGASA 24h Himawari IR Loop'}
        </div>
      </div>

      {/* Inset Satellite / Radar Viewport Frame */}
      <div className={`relative w-full overflow-hidden rounded-xl border border-[#e4edf0] transition-all duration-300 ${
        mapViewMode === 'pagasa' 
          ? 'w-full aspect-[748/750] bg-black' 
          : 'h-[340px] sm:h-[460px] bg-[#05131e]'
      }`}>

        {/* 🌧️ Sleek Modern Glassmorphic Radar Scale Capsule */}
        {mapViewMode === 'doppler' && (
          <div className="absolute bottom-3 right-3 z-[1000] bg-slate-900/80 hover:bg-slate-900/90 backdrop-blur-md border border-white/15 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2.5 transition-all select-none">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-300 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Rain Intensity</span>
            </div>
            <div className="h-3 w-px bg-white/20" />
            <div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-400">
              <span>Light</span>
              <div
                className="h-1.5 w-16 sm:w-20 rounded-full shadow-inner"
                style={{
                  background: 'linear-gradient(90deg, #38bdf8 0%, #22c55e 28%, #eab308 55%, #f97316 78%, #ef4444 100%)',
                }}
              />
              <span>Heavy</span>
            </div>
          </div>
        )}

        {/* 🛰️ MODE 1: PAGASA Satellite Viewport (Adaptive Aspect Ratio Fill) */}
        {mapViewMode === 'pagasa' ? (
          <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
            <img
              src={currentSatUrl}
              alt="DOST-PAGASA Himawari Satellite IR Scan"
              className="w-full h-full object-contain block transition-opacity duration-300"
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
            {/* Base: Esri World Imagery (satellite) */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              attribution="Tiles &copy; Esri"
            />
            {/* Labels overlay on top of satellite */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.6}
            />

            {/* 🚀 High-Performance Multi-Layer Radar Buffer: Preloaded in memory, zero re-mounts, 60 FPS instant opacity swapping */}
            {radarLoopFrames.map((f, i) => (
              <TileLayer
                key={f.path}
                url={`https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/2/1_1.png`}
                opacity={i === activeLoopIdx ? 0.75 : 0}
                maxZoom={18}
                maxNativeZoom={6}
                zIndex={100 + i}
              />
            ))}
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
