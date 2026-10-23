import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Info,
  Phone, MapPin, ChevronDown, ChevronUp,
  Zap, Timer, Lock,
  LifeBuoy
} from 'lucide-react';
import FloodHeatMap from '../components/dashboard/FloodHeatMap.jsx';
import WaterTankGauge from '../components/WaterTankGauge.jsx';
import SkeletonDashboard from '../components/SkeletonDashboard.jsx';
import AlertSignupCard from '../components/AlertSignupCard.jsx';
import useCountUp from '../hooks/useCountUp.js';
import { API_BASE_URL, WS_BASE_URL } from '../config.js';
import { FLOOD_LEVELS, getFloodLevel } from '../lib/floodLevels.js';
import { WaterLevelSparkline, AiForecastSparkline } from '../components/dashboard/Sparklines.jsx';

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


function getFriendlyContent(level, telemetry, aiPrediction) {
  switch (level.id) {
    case 0:
      return {
        badge: 'All Clear', icon: CheckCircle2,
        heroTitle: 'Normal Conditions',
        heroMsg: 'Water levels at the monitoring station remain normal and well within safe operational limits. No immediate flood threat detected.',
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
        heroTitle: 'Water Level Rising',
        heroMsg: 'The river is rising. The water level is slightly elevated but remains within monitored advisory limits.',
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
        heroTitle: 'Flood Warning Active',
        heroMsg: 'Water levels are approaching critical warning thresholds. Prepare emergency go-bags and stay prepared for potential evacuation orders.',
        actionTitle: 'Urgent Preparedness Actions',
        actionItems: [
          'Pack important documents, medicines, water, and emergency food.',
          'Disconnect non-essential electrical appliances from wall outlets.',
          'Coordinate with local barangay officers if you require special assistance.'
        ]
      };
    case 3:
      return {
        badge: 'SPILL LEVEL', icon: AlertTriangle,
        heroTitle: 'River Is Spilling Over',
        heroMsg: 'The water has reached the spill level and may overflow onto roads and homes. Please move immediately to designated high-ground evacuation shelters.',
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

// ─── Stat Card component ──────────────────────────────────────────────────────
function AnimatedStatCard({
  label,
  value,
  numericValue,
  decimals = 1,
  trendText,
  sub,
  color,
  tooltip,
  delay = 0,
  variant = 'water',
  history = [],
  currentLevel = 0,
  predicted30m = 0,
  predicted60m = 0,
}) {
  const validNum = (numericValue != null && !Number.isNaN(Number(numericValue))) ? Number(numericValue) : 0;
  const valid30m = (predicted30m != null && !Number.isNaN(Number(predicted30m))) ? Number(predicted30m) : 0;
  const valid60m = (predicted60m != null && !Number.isNaN(Number(predicted60m))) ? Number(predicted60m) : 0;
  const displayed = useCountUp(validNum, 900, decimals);
  const displayed30m = useCountUp(valid30m, 900, decimals);
  const displayed60m = useCountUp(valid60m, 900, decimals);
  const cleanVal = (value || '').replace(/NaN/g, '').trim();

  return (
    <div
      className={`bg-white rounded-2xl p-4 sm:p-5 border border-[#e4edf0] shadow-sm flex flex-col justify-between gap-3 card-enter card-enter-d${delay} hover:shadow-md transition-shadow duration-300`}
      title={tooltip}
    >
      {/* Top Header & Reading */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6d818d]">{label}</span>
          {trendText && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {trendText}
            </span>
          )}
        </div>

        {variant === 'ai' ? (
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-baseline justify-between bg-[#f8fbfc] px-3 py-1.5 rounded-xl border border-[#eef4f6]">
              <span className="text-xs sm:text-sm font-semibold text-[#5a7180]">In 30 mins:</span>
              <span className="font-display text-lg sm:text-xl font-bold text-[#123a54] tracking-tight leading-none">
                {displayed30m} m
              </span>
            </div>
            <div className="flex items-baseline justify-between bg-[#f8fbfc] px-3 py-1.5 rounded-xl border border-[#eef4f6]">
              <span className="text-xs sm:text-sm font-semibold text-[#5a7180]">In 60 mins:</span>
              <span className="font-display text-lg sm:text-xl font-bold text-[#123a54] tracking-tight leading-none">
                {displayed60m} m
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="font-display text-3xl sm:text-4xl font-bold text-[#123a54] tracking-tight leading-none">
              {numericValue != null && !Number.isNaN(Number(numericValue))
                ? `${displayed}${cleanVal.replace(/^[\d.\s-]+/, ' ')}`
                : (cleanVal || '0.00 m')}
            </span>
            {sub && (
              <p className="text-xs text-[#6d818d] font-medium leading-snug">
                {sub}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom Full-Width Graph with Crisp Time and Meter Labels */}
      <div className="w-full">
        {variant === 'water' && (
          <WaterLevelSparkline history={history} currentLevel={validNum} color={color} framed />
        )}
        {variant === 'ai' && (
          <AiForecastSparkline currentM={currentLevel} p30M={predicted30m} p60M={predicted60m} color={color} framed />
        )}
      </div>
    </div>
  );
}

// ─── Emergency contacts data ──────────────────────────────────────────────────
const EMERGENCY = {
  hotlines: [
    { label: 'Antipolo CDRRMO (EOC)',    number: '(02) 8689-4564', note: '24/7 Operations: 8689-4564 / 0927-755-9911' },
    { label: 'National Emergency Line',  number: '911',           note: '24/7 National Emergency & Rescue' },
    { label: 'Antipolo City Hall',       number: '(02) 8689-4500', note: 'Government Center Trunkline' },
    { label: 'PAGASA Weather Desk',     number: '(02) 8284-0800', note: 'DOST Weather Forecasting Center' },
    { label: 'Antipolo Police (PNP)',    number: '(02) 8697-2409', note: 'Station Hotline / 0917-157-7627' },
    { label: 'Antipolo Fire (BFP)',      number: '(02) 8871-2865', note: 'Central Station / 0945-155-6015' },
    { label: 'Philippine Red Cross',     number: '143',            note: 'National Hotline / (02) 8635-0922' },
  ],
  shelters: [
    { name: 'Antipolo City Covered Court',          brgy: 'Dela Paz',    capacity: '500 Families',  elevation: 'High Ground' },
    { name: 'San Isidro Barangay Hall',             brgy: 'San Isidro',  capacity: '200 Families',  elevation: 'Elevated Zone' },
    { name: 'Sto. Niño Elementary School',          brgy: 'Sto. Niño',   capacity: '300 Families',  elevation: 'Concrete 2F' },
    { name: 'Antipolo National High School',        brgy: 'Ynares',      capacity: '800 Families',  elevation: 'High Ground' },
    { name: 'Rizal Sports Complex',                 brgy: 'Masinag',     capacity: '1000 Families', elevation: 'Elevated Plateau' },
  ],
};

export default function PublicPortal() {
  const { pst, date } = usePSTClock();
  const [initialLoading, setInitialLoading] = useState(true);

  const [telemetry, setTelemetry] = useState({
    waterLevelM: 0.00,
    waterDistanceCm: 240,
  });

  const [aiPrediction, setAiPrediction] = useState({
    riskScore: 0,
    predicted30m: 0.00,
    predicted60m: 0.00,
    timeToCriticalMins: null,
    methodLabel: 'Loading…', testScores: null,
  });

  const [secondsAgo, setSecondsAgo] = useState(0);
  const secRef = useRef(null);
  const [showContacts, setShowContacts] = useState(false);
  const [levelHistory, setLevelHistory] = useState([]);

  const resetSecondsAgo = () => {
    setSecondsAgo(0);
    if (secRef.current) clearInterval(secRef.current);
    secRef.current = setInterval(() => setSecondsAgo(s => s + 1), 1000);
  };

  useEffect(() => {
    resetSecondsAgo();
    return () => { if (secRef.current) clearInterval(secRef.current); };
  }, []);

  const [thresholds, setThresholds] = useState({});

  // ── Which station the resident is looking at (remembered on this phone) ──
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState(() => {
    try { return Number(localStorage.getItem('sf_station')) || null; } catch { return null; }
  });
  const stationRef = useRef(stationId);
  useEffect(() => { stationRef.current = stationId; }, [stationId]);

  useEffect(() => {
    const loadStations = () => fetch(`${API_BASE_URL}/api/v1/telemetry/stations`)
      .then(r => r.json())
      .then(j => {
        const list = j.data || [];
        setStations(list);
        // Keep the saved station if it still exists, otherwise show the first one
        setStationId(cur => (list.some(s => s.id === cur) ? cur : list[0]?.id ?? null));
      })
      .catch(() => {});
    loadStations();
    const t = setInterval(loadStations, 30000);
    return () => clearInterval(t);
  }, []);

  const chooseStation = (id) => {
    setStationId(id);
    try { localStorage.setItem('sf_station', String(id)); } catch { /* private mode */ }
  };
  const station = stations.find(s => s.id === stationId);
  const forStation = (sep) => (stationId ? `${sep}nodeId=${stationId}` : '');

  // Clear the old station's numbers when switching
  useEffect(() => {
    setTelemetry({ waterLevelM: 0.00, waterDistanceCm: 240 });
    setLevelHistory([]);
    setAiPrediction(prev => ({ ...prev, predicted30m: 0.00, predicted60m: 0.00 }));
    setThresholds({});
  }, [stationId]);

  // Poll latest telemetry from GET /api/v1/telemetry/latest every 3s
  useEffect(() => {
    async function fetchLatest() {
      try {
        if (!stationId) return;
        const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/latest${forStation('?')}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const level = parseFloat(d.water_level_m ?? d.waterLevelM ?? 0.00);
          const dist = parseFloat(d.raw_distance_cm ?? d.rawDistanceCm ?? Math.round((2.4 - level) * 100));
          setTelemetry(prev => ({
            ...prev,
            waterLevelM: level,
            waterDistanceCm: dist,
          }));
          if (d.thresholds) setThresholds(d.thresholds);
          if (!Number.isNaN(level)) {
            setLevelHistory(prev => {
              if (prev.length === 0) return [level];
              const last = prev[prev.length - 1];
              if (Math.abs(last - level) < 0.005) return prev;
              return [...prev.slice(-14), level];
            });
          }
        } else if (json.success && json.data === null) {
          // Empty database — reset to 0.00m / 0 mm/h
          setTelemetry({
            waterLevelM: 0.00,
            waterDistanceCm: 240,
          });
          setLevelHistory([0.00]);
          setAiPrediction(prev => ({
            ...prev,
            riskScore: 0,
            predicted30m: 0.00,
            predicted60m: 0.00,
          }));
        }
      } catch (err) {
        console.error('[Public Portal Fetch Latest Error]', err);
      } finally {
        setInitialLoading(false);
      }
    }

    fetchLatest();
    const interval = setInterval(fetchLatest, 3000);
    return () => clearInterval(interval);
  }, [stationId]);

  // ── Real-Time WebSocket Telemetry Stream ───────────────────────────────────
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connectWS = () => {
      ws = new WebSocket(WS_BASE_URL);

      ws.onopen = () => {};
      ws.onclose = () => {
        reconnectTimer = setTimeout(connectWS, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const fromOtherStation = (d) => d?.nodeId != null && Number(d.nodeId) !== stationRef.current;
          if (msg.type === 'TELEMETRY' && msg.data && !fromOtherStation(msg.data)) {
            const d = msg.data;
            const newLevel = parseFloat(d.water_level_m ?? d.waterLevel ?? 0.0);
            setTelemetry(prev => ({
              ...prev,
              waterLevelM: parseFloat(d.water_level_m ?? d.waterLevel ?? prev.waterLevelM),
              waterDistanceCm: parseInt(d.water_distance_cm ?? d.waterDistanceCm ?? prev.waterDistanceCm),
            }));
            if (!Number.isNaN(newLevel)) {
              setLevelHistory(prev => {
                if (prev.length === 0) return [newLevel];
                const last = prev[prev.length - 1];
                if (Math.abs(last - newLevel) < 0.005) return prev;
                return [...prev.slice(-14), newLevel];
              });
            }
            resetSecondsAgo();
          } else if (msg.type === 'TEST_RESET' || msg.type === 'TELEMETRY_RESET') {
            setTelemetry({
              waterLevelM: 0.00,
              waterDistanceCm: 240,
            });
            setLevelHistory([0.00]);
            setAiPrediction({
              riskScore: 0,
              predicted30m: 0.00,
              predicted60m: 0.00,
              timeToCriticalMins: null,
              methodLabel: 'Loading…', testScores: null,
            });
            resetSecondsAgo();
          }
          if (msg.type === 'PROJECTION' && msg.data && !fromOtherStation(msg.data)) {
            const p = msg.data;
            const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
            const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
            setAiPrediction(prev => ({
              ...prev,
              predicted30m: Number.isNaN(p30) ? 0.00 : p30,
              predicted60m: Number.isNaN(p60) ? 0.00 : p60,
              riskScore: Math.round(parseFloat(p.risk_score ?? prev.riskScore)),
              methodLabel: p.methodLabel ?? prev.methodLabel, testScores: p.testScores ?? prev.testScores,
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
    if (!stationId) return;
    fetch(`${API_BASE_URL}/api/v1/telemetry/latest${forStation('?')}`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          setTelemetry(prev => ({
            ...prev,
            waterLevelM: parseFloat(j.data.waterLevelM ?? j.data.water_level_m ?? 0.00),
            waterDistanceCm: parseInt(j.data.rawDistanceCm ?? j.data.water_distance_cm ?? 240),
          }));
        }
      }).catch(() => {});

    fetch(`${API_BASE_URL}/api/v1/telemetry/projection${forStation('?')}`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          const p = j.data;
          const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
          const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
          setAiPrediction(prev => ({
            ...prev,
            predicted30m: Number.isNaN(p30) ? 0.00 : p30,
            predicted60m: Number.isNaN(p60) ? 0.00 : p60,
            riskScore: Math.round(parseFloat(p.risk_score ?? prev.riskScore)),
            methodLabel: p.methodLabel ?? prev.methodLabel, testScores: p.testScores ?? prev.testScores,
          }));
        }
      }).catch(() => {});

    // Fetch initial 30m historical trend for the sparkline graph
    fetch(`${API_BASE_URL}/api/v1/telemetry/history?range=30m${forStation('&')}`)
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data) && j.data.length > 0) {
          const pts = j.data.map(d => parseFloat(d.water_level_m ?? d.waterLevelM ?? 0)).filter(n => !Number.isNaN(n));
          if (pts.length > 0) setLevelHistory(pts.slice(-15));
        }
      }).catch(() => {});
  }, [stationId]);

  const floodLevel = getFloodLevel(telemetry.waterLevelM, thresholds);
  const friendly = getFriendlyContent(floodLevel, telemetry, aiPrediction);
  const surgeDelta = +(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2);
  const surgeRateText = surgeDelta > 0.01 ? `+${surgeDelta.toFixed(2)} m/h` : '0.00 m/h (Steady)';

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

      <div className="w-full max-w-7xl shadow-2xl rounded-none md:rounded-[28px] border-none min-h-screen md:min-h-0">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-white md:rounded-t-[28px]">
          <div className="max-w-full px-3 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-4 text-center sm:text-left flex-wrap justify-center sm:justify-start">
              <img src="/PUBMAT3.png" alt="SmartFlood Logo"
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 border-white/60 object-cover bg-white p-0.5 shadow-md flex-shrink-0" />
              <div>
                <h1 className="font-display text-lg sm:text-2xl font-bold leading-tight tracking-wide">Smart Flood</h1>
                <p className="text-[11px] sm:text-xs text-sky-100/90">Public Resident Portal · Real-Time Flood Monitoring &amp; Safety</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center">
              {/* Your barangay (only barangays with a flood station) — the whole page follows this.
                  Shown as plain white text like the clock; an invisible dropdown on top opens the list. */}
              {stations.length > 0 && (
                <div className="sm:pr-5 sm:border-r sm:border-white/20">
                  <label className="relative inline-flex items-center gap-1.5 text-white cursor-pointer hover:text-sky-100" title={station ? `Showing ${station.name}` : undefined}>
                    <MapPin size={16} className="text-sky-200 flex-shrink-0" />
                    <span className="text-base font-semibold">{station?.barangay ?? 'Choose barangay'}</span>
                    <ChevronDown size={15} className="text-sky-200" />
                    <select
                      value={stationId ?? ''}
                      onChange={(e) => chooseStation(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-white text-black"
                      aria-label="Choose your barangay"
                    >
                      {/* Dark text on white in the opened list (the header text is white) */}
                      {stations.map(st => (
                        <option key={st.id} value={st.id} style={{ color: '#000', backgroundColor: '#fff' }}>{st.barangay}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

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
        <main className="bg-white/80 backdrop-blur-md px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          {/* LEFT COLUMN: Hero Status, Water Gauge, Metrics & Safety Guidelines (7/12 width) */}
          <div className="lg:col-span-7 min-w-0 w-full flex flex-col justify-start space-y-4">

            {/* ── HERO STATUS CARD ────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[24px] border shadow-sm p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center card-enter card-enter-d1"
              style={{ background: `linear-gradient(135deg, ${floodLevel.soft}, #ffffff 70%)`, borderColor: floodLevel.border }}>
              <div className="relative z-[1]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: floodLevel.color }}>
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
                    <Zap size={15} className="text-[#e69138]" />
                    <span>Surge Rate: <b className="text-[#123a54] font-mono">{surgeRateText}</b></span>
                  </div>
                </div>
              </div>

              {/* Water Tank SVG Gauge */}
              <div className="relative z-[1] flex justify-center">
                <WaterTankGauge levelM={telemetry.waterLevelM} color={floodLevel.color} />
              </div>
            </div>

            {/* ── STAT CARDS GRID ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatedStatCard
                label="Water Level"
                value={`${telemetry.waterLevelM.toFixed(2)} m`}
                numericValue={telemetry.waterLevelM}
                decimals={2}
                trendText={['Normal', 'Advisory', 'Warning', 'Spill'][floodLevel.id]}
                sub={
                  telemetry.waterDistanceCm <= 25
                    ? 'Sensor Limit Reached'
                    : telemetry.waterLevelM < 1.2
                    ? 'Normal River Depth'
                    : telemetry.waterLevelM < 1.6
                    ? 'Advisory Stage'
                    : 'Critical Level'
                }
                color={floodLevel.color}
                tooltip="Real-time river stage height monitored at Antipolo basin"
                delay={2}
                variant="water"
                history={levelHistory}
                currentLevel={telemetry.waterLevelM}
              />

              <AnimatedStatCard
                label="Flood Forecast"
                value={`${aiPrediction.predicted30m.toFixed(2)} m`}
                numericValue={aiPrediction.predicted30m}
                decimals={2}
                color="#e69138"
                tooltip="Forecast of the river level 30 and 60 minutes from now, based on the last hour of readings from the river sensor"
                delay={4}
                variant="ai"
                currentLevel={telemetry.waterLevelM}
                predicted30m={aiPrediction.predicted30m}
                predicted60m={aiPrediction.predicted60m}
              />
            </div>

            {/* ── SAFETY GUIDANCE CARD ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-3 card-enter card-enter-d5">
              <div className="flex items-center justify-between border-b border-[#f1f5f6] pb-2">
                <h3 className="text-sm font-semibold text-[#123a54]">{friendly.actionTitle}</h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
                  style={{ background: `${floodLevel.color}15`, color: floodLevel.color }}>
                  <friendly.icon size={11} className="flex-shrink-0" />
                  <span>{friendly.badge}</span>
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
                    <h3 className="text-sm font-semibold leading-tight">Verified Emergency Hotlines</h3>
                    <p className="text-[10px] text-[#6d818d] mt-0.5">Antipolo CDRRMO, City Hall, PAGASA, NDRRMC, Police &amp; Fire Rescue</p>
                  </div>
                </div>
                {showContacts ? <ChevronUp size={16} className="text-[#6d818d]" /> : <ChevronDown size={16} className="text-[#6d818d]" />}
              </button>

              {showContacts && (
                <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-[#f1f5f6]">

                  {/* Hotlines */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#e0522f] mb-2 flex items-center gap-1">
                      <LifeBuoy size={12} /> Verified Emergency Hotlines
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
                    <div className="mt-2.5 pt-2 flex items-center justify-between text-[10px] text-[#6d818d] border-t border-[#f1f5f6]">
                      <span>Source: City Government of Antipolo Official Emergency Directory (antipolo.ph) &amp; Antipolo CDRRMO EOC</span>
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Flood map + flood alert sign-up (5/12 width) */}
          <div className="lg:col-span-5 min-w-0 w-full flex flex-col gap-4">

            {/* Flood heat map of Antipolo (the resident's barangay is highlighted) */}
            <FloodHeatMap highlightId={stationId} onSelect={chooseStation} title="Flood map of Antipolo" />

            {/* Sign up for flood alerts (SMS or email, by barangay) */}
            <div id="alert-signup">
              <AlertSignupCard
                barangays={[...new Set(stations.map(s => s.barangay))]}
                defaultBarangay={station?.barangay}
              />
            </div>

          </div>

        </main>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-sky-200/90 text-center text-[10px] sm:text-xs py-3.5 px-4 flex items-center justify-between gap-2 flex-wrap border-t border-white/10 md:rounded-b-[28px]">
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
