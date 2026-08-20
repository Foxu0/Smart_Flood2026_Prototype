import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Info, CloudRain,
  Droplets, Phone, MapPin, ChevronDown, ChevronUp,
  Zap, Shield, Waves, Radio, Timer, Lock, ArrowRight,
  HelpCircle, Compass, LifeBuoy, ExternalLink
} from 'lucide-react';
import RainOverlay from '../RainOverlay.jsx';
import WeatherMapCard from '../WeatherMapCard.jsx';
import WaterTankGauge from '../components/WaterTankGauge.jsx';
import SparklineBar from '../components/SparklineBar.jsx';
import SkeletonDashboard from '../components/SkeletonDashboard.jsx';
import useCountUp from '../hooks/useCountUp.js';
import { API_BASE_URL, WS_BASE_URL } from '../config.js';

// ─── Helper: live Philippine Standard Time clock ─────────────────────────────
function usePSTClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pst = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }).format(now);
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  }).format(now);
  return { pst, date };
}

// ─── Flood level thresholds & theme configuration ────────────────────────────
const FLOOD_LEVELS = [
  { id: 0, min: 0, max: 1.0, label: 'All Clear', color: '#2f9463', soft: '#e5f6ec', border: '#bfe6cf' },
  { id: 1, min: 1.0, max: 1.4, label: 'Advisory', color: '#2b6e8f', soft: '#e6f2f8', border: '#bfdbe8' },
  { id: 2, min: 1.4, max: 1.6, label: 'Watch Closely', color: '#e69138', soft: '#fdf1de', border: '#f4d6a4' },
  { id: 3, min: 1.6, max: 1.8, label: 'EVACUATE NOW', color: '#e0522f', soft: '#fce7e0', border: '#f2bfab' },
];

function getFloodLevel(waterM) {
  return FLOOD_LEVELS.find(l => waterM >= l.min && waterM < l.max) || FLOOD_LEVELS[3];
}

function getFriendlyContent(level, telemetry, aiPrediction) {
  switch (level.id) {
    case 0:
      return {
        badge: 'All Clear', icon: CheckCircle2,
        heroTitle: 'Everything looks calm',
        heroMsg: "Water near your area is well within the normal range, and no heavy rain is expected soon. Nothing for you to do right now — we're keeping watch.",
        actionTitle: 'Normal Safety Guidelines',
        actionItems: [
          'Keep emergency contact numbers handy.',
          'Ensure household drainage and gutters are free of debris.',
          'Monitor official PAGASA weather advisories during rainy periods.'
        ]
      };
    case 1:
      return {
        badge: 'Water Rising', icon: Info,
        heroTitle: 'Water is starting to rise',
        heroMsg: "It's been raining and water levels are slightly elevated. Roads remain passable, but stay updated if rain continues.",
        actionTitle: 'Precautionary Steps',
        actionItems: [
          'Charge your phones, power banks, and emergency flashlights.',
          'Move valuable belongings and electronics away from ground floor level.',
          'Identify your nearest designated barangay evacuation center.'
        ]
      };
    case 2:
      return {
        badge: 'Watch Closely', icon: AlertTriangle,
        heroTitle: 'Prepare your emergency supplies',
        heroMsg: "Water levels are approaching critical lines. Prepare your go-bags and keep children and pets indoors.",
        actionTitle: 'Urgent Preparedness Actions',
        actionItems: [
          'Pack important documents, medicines, water, and emergency food.',
          'Disconnect non-essential electrical appliances from wall outlets.',
          'Coordinate with local barangay officers if you require special assistance.'
        ]
      };
    case 3:
      return {
        badge: 'DANGER LEVEL', icon: AlertTriangle,
        heroTitle: 'Move to higher ground immediately!',
        heroMsg: "Water levels have reached danger thresholds. Please move to designated high ground or evacuation shelters right now.",
        actionTitle: 'Immediate Evacuation Order',
        actionItems: [
          'Evacuate immediately — do not wait for floodwaters to enter your home.',
          'Proceed safely to your assigned high-ground evacuation center.',
          'Avoid walking or driving through fast-flowing floodwaters.'
        ]
      };
    default:
      return getFriendlyContent(FLOOD_LEVELS[0], telemetry, aiPrediction);
  }
}

function rainDescription(mmHr) {
  if (mmHr < 2.5) return 'No rain / Dry';
  if (mmHr < 7.5) return 'Light rain';
  if (mmHr < 15) return 'Moderate rain';
  if (mmHr < 30) return 'Heavy rain';
  return 'Torrential rain';
}

function rainIntensityKey(mmHr) {
  if (mmHr < 2.5) return 'none';
  if (mmHr < 8) return 'light';
  if (mmHr < 25) return 'moderate';
  return 'heavy';
}

// ─── Stat Card component ──────────────────────────────────────────────────────
function AnimatedStatCard({ icon: Icon, label, value, numericValue, decimals = 1, sub, bar, color, tooltip, delay = 0 }) {
  const displayed = useCountUp(numericValue ?? 0, 900, decimals);
  return (
    <div
      className={`bg-white rounded-2xl p-3.5 sm:p-4 border border-[#e4edf0] shadow-sm flex flex-col justify-between card-enter card-enter-d${delay} hover:shadow-md transition-shadow duration-300`}
      title={tooltip}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#6d818d]">{label}</span>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110" style={{ background: `${color}18`, color }}>
            <Icon size={14} />
          </div>
        </div>
        <p className="font-display text-lg sm:text-xl font-semibold text-[#123a54] mb-0.5">
          {numericValue !== undefined ? `${displayed}${value.replace(/^[\d.]+/, '')}` : value}
        </p>
        <p className="text-[10px] text-[#6d818d] mb-2 leading-tight">{sub}</p>
      </div>
      <div className="h-1.5 rounded-full bg-[#eef4f6] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${bar}%`, background: color, transition: 'width 1s ease-out' }} />
      </div>
    </div>
  );
}

// ─── Emergency contacts data ──────────────────────────────────────────────────
const EMERGENCY = {
  hotlines: [
    { label: 'Antipolo CDRRMO',         number: '(02) 8475-5278', note: '24/7 Emergency Operations' },
    { label: 'Antipolo City Hall',       number: '(02) 8475-0011', note: 'Main Trunkline' },
    { label: 'PAGASA Weather Desk',     number: '(02) 8284-0800', note: 'National Forecast Desk' },
    { label: 'NDRRMC Hotline',           number: '8911',           note: 'National Emergency Line' },
    { label: 'PNP Antipolo Station',     number: '(02) 8697-0401', note: 'Police Hotline' },
    { label: 'BFP Antipolo Rescue',      number: '(02) 8697-1240', note: 'Fire & Rescue Unit' },
  ],
  shelters: [
    { name: 'Antipolo City Covered Court',          brgy: 'Dela Paz',    capacity: '500 Families',  elevation: 'High Ground' },
    { name: 'San Isidro Barangay Hall',             brgy: 'San Isidro',  capacity: '200 Families',  elevation: 'Elevated Zone' },
    { name: 'Sto. Niño Elementary School',          brgy: 'Sto. Niño',   capacity: '300 Families',  elevation: 'Concrete 2F' },
    { name: 'Antipolo National High School',        brgy: 'Ynares',      capacity: '800 Families',  elevation: 'High Ground' },
    { name: 'Rizal Sports Complex',                 brgy: 'Masinag',     capacity: '1000 Families', elevation: 'Elevated Plateau' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function PublicPortal() {
  const { pst, date } = usePSTClock();
  const [initialLoading, setInitialLoading] = useState(true);

  const [wsConnected, setWsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState({
    waterLevelM: 1.05,
    waterDistanceCm: 75,
    rainRateMmHr: 14.5,
  });

  const [aiPrediction, setAiPrediction] = useState({
    riskScore: 58,
    predicted30m: 1.18,
    predicted60m: 1.30,
    timeToCriticalMins: 42,
    modelConfidence: 94,
  });

  const [secondsAgo, setSecondsAgo] = useState(0);
  const secRef = useRef(null);
  const [showContacts, setShowContacts] = useState(false);

  const resetSecondsAgo = () => {
    setSecondsAgo(0);
    if (secRef.current) clearInterval(secRef.current);
    secRef.current = setInterval(() => setSecondsAgo(s => s + 1), 1000);
  };

  useEffect(() => {
    resetSecondsAgo();
    return () => { if (secRef.current) clearInterval(secRef.current); };
  }, []);

  // ── Real-Time WebSocket Telemetry Stream ───────────────────────────────────
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connectWS = () => {
      ws = new WebSocket(WS_BASE_URL);

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWS, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY' && msg.data) {
            const d = msg.data;
            setTelemetry(prev => ({
              ...prev,
              waterLevelM: parseFloat(d.water_level_m ?? d.waterLevel ?? prev.waterLevelM),
              waterDistanceCm: parseInt(d.water_distance_cm ?? d.waterDistanceCm ?? prev.waterDistanceCm),
              rainRateMmHr: parseFloat(d.rainfall_rate ?? d.rainRateMmHr ?? prev.rainRateMmHr),
            }));
            resetSecondsAgo();
          }
          if (msg.type === 'PROJECTION' && msg.data) {
            const p = msg.data;
            setAiPrediction(prev => ({
              ...prev,
              predicted30m: parseFloat(p.horizon_30m_m),
              predicted60m: parseFloat(p.horizon_60m_m),
              riskScore: Math.round(parseFloat(p.risk_score ?? prev.riskScore)),
              modelConfidence: Math.round(parseFloat(p.confidence_score ?? prev.modelConfidence)),
            }));
          }
        } catch (err) {
          console.error('[Public Portal WS Message Error]', err);
        }
      };
    };

    connectWS();
    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // ── Initial Fetch for Latest Telemetry & Projection ───────────────────────
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/telemetry/latest`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          setTelemetry(prev => ({
            ...prev,
            waterLevelM: parseFloat(j.data.water_level_m),
            waterDistanceCm: parseInt(j.data.water_distance_cm),
            rainRateMmHr: parseFloat(j.data.rainfall_rate),
          }));
        }
      }).catch(() => {});

    fetch(`${API_BASE_URL}/api/v1/telemetry/projection`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          setAiPrediction(prev => ({
            ...prev,
            predicted30m: parseFloat(j.data.horizon_30m_m),
            predicted60m: parseFloat(j.data.horizon_60m_m),
            riskScore: Math.round(parseFloat(j.data.risk_score ?? prev.riskScore)),
            modelConfidence: Math.round(parseFloat(j.data.confidence_score ?? prev.modelConfidence)),
          }));
        }
      }).catch(() => {});
  }, []);

  const floodLevel = getFloodLevel(telemetry.waterLevelM);
  const friendly = getFriendlyContent(floodLevel, telemetry, aiPrediction);
  const rainKey = rainIntensityKey(telemetry.rainRateMmHr);
  const surgeRate = Math.max(0.04, +(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2));

  // ── Initial Skeleton Loader Timer ──────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  if (initialLoading) {
    return <SkeletonDashboard publicMode />;
  }

  return (
    <div className="min-h-screen w-full font-sans text-[#3f5361] py-0 md:py-6 px-0 sm:px-3 md:px-6 lg:px-8 xl:px-12 flex flex-col justify-start items-center">

      <div className="w-full max-w-6xl bg-[#123a54] backdrop-blur-xl shadow-2xl rounded-none md:rounded-[28px] border-none overflow-hidden min-h-screen md:min-h-0">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-white">
          <div className="max-w-full px-3 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-4 text-center sm:text-left flex-wrap justify-center sm:justify-start">
              <img src="/PUBMAT3.png" alt="SmartFlood Logo"
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 border-white/60 object-cover bg-white p-0.5 shadow-md flex-shrink-0" />
              <div>
                <h1 className="font-display text-lg sm:text-2xl font-bold leading-tight tracking-wide">Smart Flood</h1>
                <p className="text-[11px] sm:text-xs text-sky-100/90">Public Resident Portal · Real-Time Flood Monitoring &amp; Safety</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
              {/* WS Status Pill */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                wsConnected
                  ? 'bg-[#2f9463]/25 border border-[#2f9463]/50 text-emerald-300'
                  : 'bg-amber-500/25 border border-amber-500/50 text-amber-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#2f9463] animate-ping' : 'bg-amber-400'}`} />
                {wsConnected ? 'LIVE WS' : 'CONNECTING WS'}
              </div>

              {/* Local Clock */}
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-sky-200 uppercase tracking-wide">Local time</p>
                <p className="text-base font-mono font-semibold leading-tight">{pst}</p>
                <p className="text-[10px] text-sky-100/80">{date}</p>
              </div>
            </div>
          </div>
        </header>

        {/* ── MAIN GRID LAYOUT ────────────────────────────────────────────── */}
        <main className="bg-[#f4f7f8] px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          {/* LEFT COLUMN: Hero Status, Water Gauge, Metrics & Safety Guidelines (7/12 width) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">

            {/* ── HERO STATUS CARD ────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[24px] border shadow-sm p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center card-enter card-enter-d1"
              style={{ background: `linear-gradient(135deg, ${floodLevel.soft}, #ffffff 70%)`, borderColor: floodLevel.border }}>
              <RainOverlay intensity={rainKey} />
              <div className="relative z-[1]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2 float-badge" style={{ color: floodLevel.color }}>
                  <MapPin size={13} /> Resident Status Advisory
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#123a54] mb-2 leading-tight">{friendly.heroTitle}</h2>
                <p className="text-xs sm:text-sm text-[#3f5361] max-w-[42ch] leading-relaxed mb-3">{friendly.heroMsg}</p>

                {/* Last updated badge */}
                <div className="flex items-center gap-1.5 text-[10px] text-[#6d818d]">
                  <Timer size={11} className="text-[#2b6e8f]" />
                  {secondsAgo < 5
                    ? 'Just updated'
                    : `Updated ${secondsAgo}s ago`}
                  <span className="mx-1 opacity-40">·</span>
                  <span>Auto-updates continuously</span>
                </div>

                <div className="flex flex-wrap gap-4 sm:gap-5 mt-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#6d818d]">
                    <CloudRain size={15} className="text-[#2b6e8f]" />
                    <span><b className="text-[#123a54]">{rainDescription(telemetry.rainRateMmHr)}</b> right now</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6d818d]">
                    <Zap size={15} className="text-[#e69138]" />
                    <span>Surge Rate: <b className="text-[#123a54] font-mono">+{surgeRate} m/h</b></span>
                    <SparklineBar currentLevel={telemetry.waterLevelM} />
                  </div>
                </div>
              </div>

              {/* Water Tank SVG Gauge */}
              <div className="relative z-[1] flex justify-center">
                <WaterTankGauge levelM={telemetry.waterLevelM} color={floodLevel.color} />
              </div>
            </div>

            {/* ── STAT CARDS GRID ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
              <AnimatedStatCard
                icon={Droplets}
                label="Water Level"
                value={`${telemetry.waterLevelM.toFixed(2)} m`}
                numericValue={telemetry.waterLevelM}
                decimals={2}
                sub={telemetry.waterDistanceCm <= 25 ? '⚠️ Transducer Blind Spot' : `${telemetry.waterDistanceCm} cm to sensor`}
                bar={Math.min(100, (telemetry.waterLevelM / 1.8) * 100)}
                color={floodLevel.color}
                tooltip="JSN-SR04T ultrasonic sensor water column height"
                delay={2}
              />
              <AnimatedStatCard
                icon={CloudRain}
                label="Rainfall Rate"
                value={`${telemetry.rainRateMmHr.toFixed(1)} mm/h`}
                numericValue={telemetry.rainRateMmHr}
                decimals={1}
                sub={rainDescription(telemetry.rainRateMmHr)}
                bar={Math.min(100, (telemetry.rainRateMmHr / 60) * 100)}
                color="#2b6e8f"
                tooltip="Station rain gauge tip accumulation"
                delay={3}
              />
              <AnimatedStatCard
                icon={Zap}
                label="AI Forecast (+30m)"
                value={`${aiPrediction.predicted30m.toFixed(2)} m`}
                numericValue={aiPrediction.predicted30m}
                decimals={2}
                sub={`+60m: ${aiPrediction.predicted60m.toFixed(2)}m (${aiPrediction.modelConfidence}% conf)`}
                bar={Math.min(100, (aiPrediction.predicted30m / 1.8) * 100)}
                color="#e69138"
                tooltip="LSTM deep learning projection 30 minutes ahead"
                delay={4}
              />
            </div>

            {/* ── SAFETY GUIDANCE CARD ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-3 card-enter card-enter-d5">
              <div className="flex items-center justify-between border-b border-[#f1f5f6] pb-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#2b6e8f]" />
                  <h3 className="text-sm font-semibold text-[#123a54]">{friendly.actionTitle}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${floodLevel.color}15`, color: floodLevel.color }}>
                  {friendly.badge}
                </span>
              </div>

              <ul className="space-y-2 text-xs text-[#3f5361]">
                {friendly.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 bg-[#fbfdfe] p-2.5 rounded-xl border border-[#eef2f3]">
                    <span className="w-5 h-5 rounded-full bg-[#123a54]/10 text-[#123a54] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── EMERGENCY CONTACTS & EVACUATION SHELTERS ──────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] overflow-hidden card-enter card-enter-d6">
              <button
                onClick={() => setShowContacts(v => !v)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-[#123a54] hover:bg-[#fbfdfe] transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-[#e0522f]" />
                  <div>
                    <h3 className="text-sm font-semibold leading-tight">Emergency Hotlines &amp; Evacuation Shelters</h3>
                    <p className="text-[10px] text-[#6d818d] mt-0.5">Antipolo CDRRMO hotlines, barangay rescue &amp; high-ground centers</p>
                  </div>
                </div>
                {showContacts ? <ChevronUp size={16} className="text-[#6d818d]" /> : <ChevronDown size={16} className="text-[#6d818d]" />}
              </button>

              {showContacts && (
                <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-[#f1f5f6]">

                  {/* Hotlines */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#e0522f] mb-2 flex items-center gap-1">
                      <LifeBuoy size={12} /> Emergency Hotlines
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EMERGENCY.hotlines.map((h) => (
                        <div key={h.label} className="bg-[#fbfdfe] rounded-xl p-2.5 border border-[#eef2f3] flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-[#123a54]">{h.label}</p>
                            <p className="text-[10px] text-[#6d818d]">{h.note}</p>
                          </div>
                          <a
                            href={`tel:${h.number.replace(/[^0-9+]/g, '')}`}
                            className="px-2.5 py-1 rounded-lg bg-[#2b6e8f]/10 text-[#2b6e8f] hover:bg-[#2b6e8f] hover:text-white font-mono font-bold text-xs transition-colors flex-shrink-0"
                          >
                            {h.number}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evacuation Shelters */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#e69138] mb-2 flex items-center gap-1">
                      <Compass size={12} /> Designated High-Ground Shelters
                    </h4>
                    <div className="space-y-2">
                      {EMERGENCY.shelters.map((s) => (
                        <div key={s.name} className="bg-[#fbfdfe] rounded-xl p-2.5 border border-[#eef2f3] flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-[#123a54]">{s.name}</p>
                            <p className="text-[10px] text-[#6d818d]">Brgy. {s.brgy} · {s.elevation}</p>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#2f9463]/15 text-[#2f9463] flex-shrink-0">
                            {s.capacity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive Weather Map Card (5/12 width) */}
          <div className="lg:col-span-5 flex flex-col justify-between">

            {/* Weather Map Component */}
            <WeatherMapCard severity={floodLevel.id} />

            {/* Quick Public Alert Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 mt-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-[#f1f5f6] pb-2">
                <Radio size={15} className="text-[#2b6e8f]" />
                <h3 className="text-xs font-bold text-[#123a54]">Live Telemetry Feed Notice</h3>
              </div>
              <p className="text-xs text-[#6d818d] leading-relaxed">
                This portal displays real-time readings measured directly at the Antipolo Flood Station (JSN-SR04T ultrasonic sensor &amp; tipping-bucket rain gauge).
              </p>
              <div className="pt-2 border-t border-[#f1f5f6] flex items-center justify-between text-[11px]">
                <span className="text-[#6d818d]">Command Center Status:</span>
                <span className="font-bold text-[#2f9463]">● 24/7 Monitoring Active</span>
              </div>
            </div>

          </div>

        </main>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-sky-200/90 text-center text-[10px] sm:text-xs py-3.5 px-4 flex items-center justify-between gap-2 flex-wrap border-t border-white/10">
          <div className="flex items-center gap-2">
            <img src="/PUBMAT3.png" alt="logo" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white p-0.5" />
            <span>Smart Flood · Real-Time Monitoring &amp; Early Warning System · Capstone 2026</span>
          </div>
          <a
            href="/admin/login"
            className="text-[10px] text-sky-300/40 hover:text-sky-200 transition-colors flex items-center gap-1"
            title="Authorized BDRRMC/CDRRMO Personnel Only"
          >
            <Lock size={10} />
            <span>EOC Staff Access</span>
          </a>
        </footer>

      </div>
    </div>
  );
}
