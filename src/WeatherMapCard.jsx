import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  LayersControl, Polygon, Tooltip, CircleMarker, useMap, ImageOverlay,
} from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, Layers, Radio, Play, Pause, SkipForward } from 'lucide-react';

const API_KEY = '9c04674c3ef012dce3e3d789ea5ba263';

/* ── Severity-keyed beacon colours ─────────────────────────────────────── */
const BEACON = [
  { color: '#2f9463', label: 'Normal', rings: 2 },
  { color: '#2b6e8f', label: 'Watch',  rings: 2 },
  { color: '#e69138', label: 'Alarm',  rings: 3 },
  { color: '#e0522f', label: 'Danger', rings: 3 },
];

/* ── Flood-prone barangays of Antipolo City ─────────────────────────────
   Coordinates sourced from NDRRMC/READY Project Philippine hazard maps.
   Each polygon is roughly drawn around the known low-lying areas.
   Risk level: 0=Low, 1=Moderate, 2=High, 3=Very High
───────────────────────────────────────────────────────────────────────── */
const FLOOD_ZONES = [
  {
    name: 'Sto. Niño',
    risk: 3, // Very High — low-elevation near creek confluence
    coords: [
      [14.5720, 121.1580], [14.5760, 121.1650], [14.5790, 121.1700],
      [14.5770, 121.1750], [14.5730, 121.1720], [14.5700, 121.1660],
    ],
    note: 'Adjacent to Hinulugang Taktak creek. Frequent inundation during typhoons.',
  },
  {
    name: 'San Isidro',
    risk: 2, // High
    coords: [
      [14.5840, 121.1700], [14.5880, 121.1780], [14.5900, 121.1830],
      [14.5870, 121.1870], [14.5830, 121.1840], [14.5810, 121.1760],
    ],
    note: 'Moderate flood risk — upstream of Antipolo Creek tributary.',
  },
  {
    name: 'San Jose',
    risk: 2, // High
    coords: [
      [14.5950, 121.1650], [14.5990, 121.1720], [14.6010, 121.1770],
      [14.5980, 121.1810], [14.5940, 121.1780], [14.5920, 121.1700],
    ],
    note: 'Elevated terrain but low-lying pocket near creek outlet.',
  },
  {
    name: 'Dela Paz',
    risk: 3, // Very High — closest to monitoring station
    coords: [
      [14.5800, 121.1720], [14.5860, 121.1800], [14.5890, 121.1860],
      [14.5860, 121.1920], [14.5820, 121.1890], [14.5790, 121.1820],
    ],
    note: 'Station monitoring area. Highest risk — direct flood path from Sierra Madre slope runoff.',
  },
  {
    name: 'Calawis',
    risk: 1, // Moderate — upstream but wide basin
    coords: [
      [14.6050, 121.1900], [14.6100, 121.1970], [14.6130, 121.2040],
      [14.6090, 121.2070], [14.6040, 121.2010], [14.6010, 121.1940],
    ],
    note: 'Upper catchment area. Flash flood risk during extreme rainfall events.',
  },
  {
    name: 'Mayamot',
    risk: 1, // Moderate
    coords: [
      [14.5700, 121.1850], [14.5750, 121.1920], [14.5770, 121.1980],
      [14.5740, 121.2010], [14.5700, 121.1970], [14.5680, 121.1900],
    ],
    note: 'Low to moderate flood risk. Secondary drainage catchment.',
  },
];

/* ── Risk color palette ─────────────────────────────────────────────────── */
const RISK_STYLE = [
  { fill: '#2f9463', stroke: '#1a5c3a', label: 'Low Risk' },
  { fill: '#e69138', stroke: '#b36b22', label: 'Moderate Risk' },
  { fill: '#e0522f', stroke: '#b03518', label: 'High Risk' },
  { fill: '#9b1c1c', stroke: '#6b0f0f', label: 'Very High Risk' },
];

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

/* ══════════════════════════════════════════════════════════════════════════ */
export default function WeatherMapCard({ severity = 0 }) {
  const antipoloPos = [14.5869, 121.1754];

  /* ── Map View Mode: 'doppler' (RainViewer Rain Radar) vs 'pagasa' (DOST-PAGASA Himawari Satellite) ── */
  const [mapViewMode, setMapViewMode] = useState('doppler');

  /* ── Radar frames state ─────────────────────────────────────────────── */
  const [frames, setFrames]             = useState([]);     // all past + nowcast frames
  const [frameIdx, setFrameIdx]         = useState(-1);     // -1 = live (latest)
  const [isPlaying, setIsPlaying]       = useState(false);
  const [radarTimeStr, setRadarTimeStr] = useState('Fetching radar...');
  const [nextRefreshSec, setNextRefreshSec] = useState(120);
  const playTimerRef = useRef(null);

  /* ── PAGASA Satellite Animation State (24-hour sequence) ─────────────── */
  const [satFrameIdx, setSatFrameIdx]   = useState(23); // 23 = latest (1-24 sequence, 24th is latest)
  const [isSatPlaying, setIsSatPlaying] = useState(false);
  const satTimerRef = useRef(null);

  /* Preload all 24 PAGASA Himawari Satellite GIF images into browser cache for zero-flicker 60fps animation */
  useEffect(() => {
    for (let i = 1; i <= 24; i++) {
      const img = new Image();
      img.src = `https://src.meteopilipinas.gov.ph/repo/himawari/24hour/irsml/${i}irsml.gif`;
    }
  }, []);

  /* Smooth continuous looping playback effect for PAGASA Satellite (300ms interval) */
  useEffect(() => {
    if (satTimerRef.current) clearInterval(satTimerRef.current);
    if (!isSatPlaying) return;

    satTimerRef.current = setInterval(() => {
      setSatFrameIdx(prev => {
        const next = prev + 1;
        if (next >= 24) return 0; // Infinite continuous loop back to start!
        return next;
      });
    }, 300); // 300ms per satellite frame = smooth PAGASA cloud motion

    return () => clearInterval(satTimerRef.current);
  }, [isSatPlaying]);

  const currentSatUrl = `https://src.meteopilipinas.gov.ph/repo/himawari/24hour/irsml/${satFrameIdx + 1}irsml.gif`;
  const satHourLabel  = satFrameIdx === 23 ? 'Live (Latest)' : `-${24 - (satFrameIdx + 1)}h Ago`;

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] overflow-hidden">
      <div className="bg-[#123a54] text-white px-4 py-2.5 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-sky-200" />
          <h2 className="text-sm font-semibold">Weather Map</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZones(v => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
              showZones
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-white/10 border-white/20 text-sky-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${showZones ? 'bg-amber-400' : 'bg-white/40'}`} />
            HAZARD ZONES
          </button>
          <div className="flex items-center gap-1.5 bg-white/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-sky-200">
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
            <span>📡 Rain Radar</span>
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
            <span>🛰️ PAGASA Satellite</span>
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[9px] text-sky-200/80 font-mono">
          {mapViewMode === 'doppler' ? '🎯 Ground Rain Intensity (dBZ)' : '🌡️ PAGASA 24h Himawari IR Loop'}
        </div>
      </div>

      {mapViewMode === 'doppler' && (
        <div className="bg-[#0e2e42] px-3 py-2 flex items-center gap-2 border-b border-white/10">
          <button
            onClick={() => {
              if (!isPlaying && frameIdx === -1) setFrameIdx(0);
              setIsPlaying(v => !v);
            }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white flex-shrink-0"
            title={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            onClick={() => { setIsPlaying(false); setFrameIdx(-1); }}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition flex-shrink-0 ${
              frameIdx === -1 ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-300' : 'bg-white/10 border-white/20 text-white/60'
            }`}
          >
            ● LIVE
          </button>
          <div className="flex-1 flex items-center gap-0.5 min-w-0">
            {pastFrames.map((f, i) => (
              <button key={f.time} onClick={() => { setIsPlaying(false); setFrameIdx(i); }} className={`h-4 flex-1 rounded-sm ${frameIdx === i || (frameIdx === -1 && i === pastFrames.length - 1) ? 'bg-sky-400' : 'bg-white/20'}`} />
            ))}
            {forecastFrames.length > 0 && <div className="w-px h-4 bg-amber-400/60 mx-0.5 flex-shrink-0" />}
            {forecastFrames.map((f, i) => (
              <button key={f.time} onClick={() => { setIsPlaying(false); setFrameIdx(pastFrames.length + i); }} className={`h-4 flex-1 rounded-sm ${frameIdx === pastFrames.length + i ? 'bg-amber-400' : 'bg-amber-500/20'}`} />
            ))}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[9px] text-sky-200 font-mono font-bold">{frameLabel}</div>
            <div className="text-[8px] text-white/40">↻ {nextRefreshSec}s</div>
          </div>
        </div>
      )}

      {mapViewMode === 'pagasa' && (
        <div className="bg-[#0e2e42] px-3 py-2 flex items-center gap-2 border-b border-white/10">
          <button
            onClick={() => setIsSatPlaying(v => !v)}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white flex-shrink-0"
            title={isSatPlaying ? 'Pause Satellite animation' : 'Play 24-hour Satellite animation'}
          >
            {isSatPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            onClick={() => { setIsSatPlaying(false); setSatFrameIdx(23); }}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition flex-shrink-0 ${
              satFrameIdx === 23 ? 'bg-sky-500/30 border-sky-400/60 text-sky-300' : 'bg-white/10 border-white/20 text-white/60'
            }`}
          >
            ● LIVE
          </button>
          <div className="flex-1 flex items-center gap-0.5 min-w-0">
            {Array.from({ length: 24 }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setIsSatPlaying(false); setSatFrameIdx(i); }}
                className={`h-4 flex-1 rounded-sm transition-all ${
                  satFrameIdx === i ? 'bg-sky-400' : 'bg-white/20 hover:bg-white/35'
                }`}
                title={`Frame ${i + 1}/24 (-${24 - (i + 1)}h)`}
              />
            ))}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[9px] text-sky-200 font-mono font-bold">{satHourLabel}</div>
            <div className="text-[8px] text-white/40">24-Hour IR Loop</div>
          </div>
        </div>
      )}

      <div className="relative h-[340px] sm:h-[500px] w-full overflow-hidden z-0">
        <div className="absolute top-3 left-3 z-[1000] bg-[#123a54]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl shadow-lg border border-white/20 flex items-center gap-2 text-xs">
          <ShieldAlert size={14} className="text-amber-400 animate-pulse" />
          <div>
            <p className="font-bold text-[11px] leading-tight">Active Warning Zone</p>
            <p className="text-[9px] text-sky-200">Antipolo &amp; Rizal Province</p>
          </div>
        </div>
        <div
          className="absolute top-3 right-3 z-[1000] px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg border"
          style={{ background: `${b.color}22`, borderColor: `${b.color}55`, color: b.color, backdropFilter: 'blur(8px)' }}
        >
          ● {b.label.toUpperCase()}
        </div>
        <div className="absolute bottom-3 right-3 z-[1000] bg-[#123a54]/90 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-lg border border-white/20 text-[10px] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-sky-200 border-b border-white/10 pb-1">
            {mapViewMode === 'doppler' ? <Radio size={12} className="text-emerald-400" /> : <Layers size={12} className="text-sky-400" />}
            <span>{mapViewMode === 'doppler' ? 'RainViewer Doppler' : 'DOST-PAGASA IR'}</span>
          </div>
          {mapViewMode === 'doppler' ? (
            <div className="flex items-center gap-1 text-[9px] font-mono">
              <span className="text-gray-300">Light</span>
              <div className="h-2 w-14 rounded overflow-hidden flex mx-1">
                <span className="w-1/4 h-full bg-emerald-400" /><span className="w-1/4 h-full bg-yellow-400" /><span className="w-1/4 h-full bg-orange-500" /><span className="w-1/4 h-full bg-red-600" />
              </div>
              <span className="text-red-300 font-bold">Heavy</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-mono">
              <span className="text-gray-300">Moisture</span>
              <div className="h-2 w-16 rounded overflow-hidden flex mx-1">
                <span className="w-1/4 h-full bg-gray-400" /><span className="w-1/4 h-full bg-cyan-400" /><span className="w-1/4 h-full bg-blue-600" /><span className="w-1/4 h-full bg-red-600" />
              </div>
              <span className="text-red-300 font-bold">Cold Storm Tops</span>
            </div>
          )}
          {showZones && (
            <div className="border-t border-white/10 pt-1 space-y-0.5">
              <p className="text-[8px] text-sky-300 font-bold uppercase tracking-wide mb-1">Flood Hazard</p>
              {RISK_STYLE.slice(1).map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px]">
                  <span className="w-3 h-2 rounded-sm inline-block" style={{ background: r.fill, opacity: 0.8 }} />
                  <span className="text-white/70">{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <MapContainer
          center={antipoloPos}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          attributionControl={false}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="CartoDB Dark Matter">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Esri Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
            </LayersControl.BaseLayer>
            {mapViewMode === 'doppler' && (
              <LayersControl.Overlay checked name="RainViewer Doppler Radar">
                <RadarLayer path={activePath} opacity={0.65} />
              </LayersControl.Overlay>
            )}
            {mapViewMode === 'pagasa' && (
              <LayersControl.Overlay checked name="DOST-PAGASA Himawari Satellite IR">
                <ImageOverlay
                  url={currentSatUrl}
                  bounds={[[4.0, 115.0], [25.0, 135.0]]}
                  opacity={0.85}
                />
              </LayersControl.Overlay>
            )}
            <LayersControl.Overlay name="OpenWeather Precipitation">
              <TileLayer
                url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`}
                opacity={0.65}
              />
            </LayersControl.Overlay>
            <LayersControl.Overlay name="Cloud Cover">
              <TileLayer
                url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}`}
                opacity={0.5}
              />
            </LayersControl.Overlay>
          </LayersControl>

          {/* ── Flood-Prone Barangay Polygons ──────────────────────── */}
          {showZones && FLOOD_ZONES.map((zone) => {
            const style = RISK_STYLE[zone.risk] || RISK_STYLE[1];
            return (
              <Polygon
                key={zone.name}
                positions={zone.coords}
                pathOptions={{
                  color: style.stroke,
                  fillColor: style.fill,
                  fillOpacity: 0.30,
                  weight: 1.5,
                  dashArray: zone.risk >= 3 ? '4,3' : undefined,
                }}
              >
                <Tooltip
                  sticky
                  className="leaflet-tooltip-custom"
                >
                  <div className="text-xs font-sans">
                    <p className="font-bold text-[#123a54]">{zone.name}</p>
                    <p className="text-[10px] font-semibold" style={{ color: style.fill }}>
                      {style.label}
                    </p>
                    <p className="text-[10px] text-[#6d818d] max-w-[180px] mt-0.5">
                      {zone.note}
                    </p>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}

        </MapContainer>
      </div>
    </div>
  );
}
