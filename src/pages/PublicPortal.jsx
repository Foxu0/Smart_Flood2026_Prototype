import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Info, CloudRain,
  Droplets, Phone, MapPin, ChevronDown, ChevronUp,
  Zap, Shield, Timer, Lock,
  LifeBuoy
} from 'lucide-react';
import RainOverlay from '../RainOverlay.jsx';
import WeatherMapCard from '../WeatherMapCard.jsx';
import WaterTankGauge from '../components/WaterTankGauge.jsx';
import SkeletonDashboard from '../components/SkeletonDashboard.jsx';
import EmailSubscriptionCard from '../components/EmailSubscriptionCard.jsx';
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

function formatTimeOffset(minutesOffset = 0) {
  const d = new Date(Date.now() + minutesOffset * 60000);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

// ─── Flood level thresholds & theme configuration ────────────────────────────
const FLOOD_LEVELS = [
  { id: 0, min: 0, max: 1.2, label: 'All Clear', color: '#2f9463', soft: '#e5f6ec', border: '#bfe6cf' },
  { id: 1, min: 1.2, max: 1.6, label: 'Advisory', color: '#2b6e8f', soft: '#e6f2f8', border: '#bfdbe8' },
  { id: 2, min: 1.6, max: 2.0, label: 'Watch Closely', color: '#e69138', soft: '#fdf1de', border: '#f4d6a4' },
  { id: 3, min: 2.0, max: 2.4, label: 'EVACUATE NOW', color: '#e0522f', soft: '#fce7e0', border: '#f2bfab' },
];

function getFloodLevel(waterM) {
  return FLOOD_LEVELS.find(l => waterM >= l.min && waterM < l.max) || FLOOD_LEVELS[3];
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
        heroMsg: 'Rainfall has increased upstream water levels. The river channel is slightly elevated but remains within monitored advisory limits.',
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
        badge: 'DANGER LEVEL', icon: AlertTriangle,
        heroTitle: 'Danger Level Reached',
        heroMsg: 'Water levels have reached critical danger thresholds. Please move immediately to designated high-ground evacuation shelters.',
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

// ─── Line Graph for Water Level (Bottom: Timeframe, Right: Meter Scale) ──────
function WaterLevelSparkline({ history = [], currentLevel = 0.35, color = '#2f9463' }) {
  const width = 240;
  const height = 72;
  const padY = 8;
  const padX = 8;
  const drawW = width - padX * 2;
  const drawH = height - padY * 2;

  // Build a normalized series of 6 to 12 points
  const ptsRaw = (Array.isArray(history) && history.length >= 2)
    ? history
    : [
        +(currentLevel * 0.96).toFixed(2),
        +(currentLevel * 0.98).toFixed(2),
        +(currentLevel * 0.97).toFixed(2),
        +(currentLevel * 0.99).toFixed(2),
        +(currentLevel * 1.00).toFixed(2),
        +currentLevel.toFixed(2),
      ];

  const dataMin = Math.min(...ptsRaw);
  const dataMax = Math.max(...ptsRaw);
  const rawSpan = dataMax - dataMin;
  const minV = rawSpan >= 0.02 ? dataMin : Math.max(0, dataMin - 0.02);
  const maxV = rawSpan >= 0.02 ? dataMax : dataMax + 0.02;
  const range = (maxV - minV) || 0.04;
  const midV = (minV + maxV) / 2;

  const coords = ptsRaw.map((v, i) => ({
    x: padX + (i / Math.max(1, ptsRaw.length - 1)) * drawW,
    y: padY + drawH - ((v - minV) / range) * drawH,
  }));

  let pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const c = coords[i];
    const n = coords[i + 1];
    const mx = (c.x + n.x) / 2;
    pathD += ` C ${mx.toFixed(1)} ${c.y.toFixed(1)}, ${mx.toFixed(1)} ${n.y.toFixed(1)}, ${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
  }

  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaD = `${pathD} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;
  const gradId = `waterSparkGrad_${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  const time30mAgo = formatTimeOffset(-30);
  const time15mAgo = formatTimeOffset(-15);
  const timeNow = formatTimeOffset(0);

  return (
    <div className="w-full pt-2 border-t border-[#f1f5f6] select-none">
      <div className="grid grid-cols-[1fr_auto] gap-x-2 items-stretch">
        {/* Plot Area with Grid & Axes */}
        <div className="relative bg-[#f8fbfc] border-b border-r border-[#cbdbe2] rounded-tl-lg overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 block">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Y-axis grid lines (Top, Mid, Bottom) */}
            <line x1="0" y1={padY} x2={width} y2={padY} stroke="#dde8ed" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1={padY + drawH * 0.5} x2={width} y2={padY + drawH * 0.5} stroke="#dde8ed" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1={padY + drawH} x2={width} y2={padY + drawH} stroke="#dde8ed" strokeWidth="1" strokeDasharray="3 3" />

            {/* Vertical X-axis timeframe grid lines (Left, Center, Right) */}
            <line x1={padX} y1="0" x2={padX} y2={height} stroke="#e6eff2" strokeWidth="1" strokeDasharray="2 3" />
            <line x1={width * 0.5} y1="0" x2={width * 0.5} y2={height} stroke="#e6eff2" strokeWidth="1" strokeDasharray="2 3" />
            <line x1={width - padX} y1="0" x2={width - padX} y2={height} stroke="#e6eff2" strokeWidth="1" strokeDasharray="2 3" />

            {/* Gradient fill under curve */}
            <path d={areaD} fill={`url(#${gradId})`} />

            {/* Line graph stroke */}
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Start & Live endpoint markers */}
            <circle cx={first.x} cy={first.y} r="2.8" fill="#ffffff" stroke={color} strokeWidth="1.8" />
            <circle cx={last.x} cy={last.y} r="3.8" fill={color} stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Right Side: Y-Axis Meter Scale */}
        <div className="flex flex-col justify-between text-[10.5px] font-mono font-semibold text-[#5a7180] py-1 text-right min-w-[44px]">
          <span className="leading-none" style={{ color }}>{maxV.toFixed(2)} m</span>
          <span className="leading-none">{midV.toFixed(2)} m</span>
          <span className="leading-none">{minV.toFixed(2)} m</span>
        </div>

        {/* Bottom: X-Axis Timeframe Scale */}
        <div className="flex items-center justify-between text-[10.5px] text-[#5a7180] pt-1.5">
          <span className="font-medium">{time30mAgo}</span>
          <span className="font-medium text-[#7b909d]">{time15mAgo}</span>
          <span className="font-bold text-[#123a54]">{timeNow} (Now)</span>
        </div>

        {/* Bottom-Right Empty Corner */}
        <div />
      </div>
    </div>
  );
}

// ─── AI Forecast Line Graph (Bottom: Timeframe, Right: Meter Scale) ──────────
function AiForecastSparkline({ currentM = 0.35, p30M = 0.38, p60M = 0.41, color = '#e69138' }) {
  const width = 240;
  const height = 72;
  const padY = 8;
  const padX = 10;
  const drawW = width - padX * 2;
  const drawH = height - padY * 2;

  const vals = [Number(currentM) || 0, Number(p30M) || 0, Number(p60M) || 0];
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const rawSpan = dataMax - dataMin;
  const minV = rawSpan >= 0.02 ? dataMin : Math.max(0, dataMin - 0.02);
  const maxV = rawSpan >= 0.02 ? dataMax : dataMax + 0.02;
  const range = (maxV - minV) || 0.04;
  const midV = (minV + maxV) / 2;

  const getY = (val) => padY + drawH - ((val - minV) / range) * drawH;

  const pt0 = { x: padX, y: getY(vals[0]) };
  const pt30 = { x: width * 0.5, y: getY(vals[1]) };
  const pt60 = { x: width - padX, y: getY(vals[2]) };

  // Confidence error margins (±1.5cm at 30m, ±2.2cm at 60m)
  const offset30 = Math.min(12, Math.max(4, (0.015 / range) * drawH));
  const offset60 = Math.min(16, Math.max(5, (0.022 / range) * drawH));

  const coneD = `M ${pt0.x.toFixed(1)} ${pt0.y.toFixed(1)} ` +
    `L ${pt30.x.toFixed(1)} ${Math.max(2, pt30.y - offset30).toFixed(1)} ` +
    `L ${pt60.x.toFixed(1)} ${Math.max(2, pt60.y - offset60).toFixed(1)} ` +
    `L ${pt60.x.toFixed(1)} ${Math.min(height - 2, pt60.y + offset60).toFixed(1)} ` +
    `L ${pt30.x.toFixed(1)} ${Math.min(height - 2, pt30.y + offset30).toFixed(1)} Z`;

  const lineD = `M ${pt0.x.toFixed(1)} ${pt0.y.toFixed(1)} L ${pt30.x.toFixed(1)} ${pt30.y.toFixed(1)} L ${pt60.x.toFixed(1)} ${pt60.y.toFixed(1)}`;
  const areaD = `${lineD} L ${pt60.x.toFixed(1)} ${height} L ${pt0.x.toFixed(1)} ${height} Z`;

  const timeNow = formatTimeOffset(0);
  const time30m = formatTimeOffset(30);
  const time60m = formatTimeOffset(60);

  return (
    <div className="w-full pt-2 border-t border-[#f1f5f6] select-none">
      <div className="grid grid-cols-[1fr_auto] gap-x-2 items-stretch">
        {/* Plot Area with Grid & Axes */}
        <div className="relative bg-[#f8fbfc] border-b border-r border-[#cbdbe2] rounded-tl-lg overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 block">
            <defs>
              <linearGradient id="aiForecastArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="aiConfidenceCone" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity="0.08" />
                <stop offset="100%" stopColor={color} stopOpacity="0.22" />
              </linearGradient>
            </defs>

            {/* Horizontal Y-axis grid lines (Top, Mid, Bottom) */}
            <line x1="0" y1={padY} x2={width} y2={padY} stroke="#dde8ed" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1={padY + drawH * 0.5} x2={width} y2={padY + drawH * 0.5} stroke="#dde8ed" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1={padY + drawH} x2={width} y2={padY + drawH} stroke="#dde8ed" strokeWidth="1" strokeDasharray="3 3" />

            {/* Vertical X-axis timeframe grid lines (Now, +30m, +60m) */}
            <line x1={pt0.x} y1="0" x2={pt0.x} y2={height} stroke="#e6eff2" strokeWidth="1" strokeDasharray="2 3" />
            <line x1={pt30.x} y1="0" x2={pt30.x} y2={height} stroke="#e6eff2" strokeWidth="1" strokeDasharray="2 3" />
            <line x1={pt60.x} y1="0" x2={pt60.x} y2={height} stroke="#e6eff2" strokeWidth="1" strokeDasharray="2 3" />

            {/* Shaded Confidence Cone */}
            <path d={coneD} fill="url(#aiConfidenceCone)" />

            {/* Under-line gradient */}
            <path d={areaD} fill="url(#aiForecastArea)" />

            {/* Forecast Trajectory Line */}
            <path
              d={lineD}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeDasharray="5 3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Point: Now */}
            <circle cx={pt0.x} cy={pt0.y} r="3.2" fill="#123a54" stroke="#ffffff" strokeWidth="1.4" />

            {/* Point: +30m */}
            <circle cx={pt30.x} cy={pt30.y} r="3.6" fill={color} stroke="#ffffff" strokeWidth="1.5" />

            {/* Point: +60m */}
            <circle cx={pt60.x} cy={pt60.y} r="3.6" fill="#ffffff" stroke={color} strokeWidth="2" />
          </svg>
        </div>

        {/* Right Side: Y-Axis Meter Scale */}
        <div className="flex flex-col justify-between text-[10.5px] font-mono font-semibold text-[#5a7180] py-0.5 text-right min-w-[44px]">
          <span className="leading-none" style={{ color }}>{maxV.toFixed(2)} m</span>
          <span className="leading-none">{midV.toFixed(2)} m</span>
          <span className="leading-none text-[#123a54]">{minV.toFixed(2)} m</span>
        </div>

        {/* Bottom: X-Axis Timeframe Scale */}
        <div className="grid grid-cols-3 items-center text-[10.5px] text-[#5a7180] pt-1.5">
          <span className="text-left font-medium text-[#123a54]">{timeNow} (Now)</span>
          <span className="text-center font-bold" style={{ color }}>{time30m}</span>
          <span className="text-right font-medium">{time60m}</span>
        </div>

        {/* Bottom-Right Empty Corner */}
        <div />
      </div>
    </div>
  );
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
          <WaterLevelSparkline history={history} currentLevel={validNum} color={color} />
        )}
        {variant === 'ai' && (
          <AiForecastSparkline currentM={currentLevel} p30M={predicted30m} p60M={predicted60m} color={color} />
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
    rainRateMmHr: 0.0,
  });

  const [aiPrediction, setAiPrediction] = useState({
    riskScore: 0,
    predicted30m: 0.00,
    predicted60m: 0.00,
    timeToCriticalMins: null,
    modelConfidence: 96.5,
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

  // Poll latest telemetry from GET /api/v1/telemetry/latest every 3s
  useEffect(() => {
    async function fetchLatest() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/latest`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const level = parseFloat(d.water_level_m ?? d.waterLevelM ?? 0.00);
          const dist = parseFloat(d.raw_distance_cm ?? d.rawDistanceCm ?? Math.round((2.4 - level) * 100));
          const rain = parseFloat(d.rainfallRateMmh ?? d.rainfall_rate_mm_h ?? d.rainfall_rate ?? 0.0);
          setTelemetry(prev => ({
            ...prev,
            waterLevelM: level,
            waterDistanceCm: dist,
            rainRateMmHr: Number.isNaN(rain) ? 0.0 : rain,
          }));
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
            rainRateMmHr: 0.0,
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
  }, []);

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
          if (msg.type === 'TELEMETRY' && msg.data) {
            const d = msg.data;
            const rain = parseFloat(d.rainfallRateMmh ?? d.rainfall_rate_mm_h ?? d.rainfall_rate ?? d.rain_rate_mm_hr ?? 0.0);
            const newLevel = parseFloat(d.water_level_m ?? d.waterLevel ?? 0.0);
            setTelemetry(prev => ({
              ...prev,
              waterLevelM: parseFloat(d.water_level_m ?? d.waterLevel ?? prev.waterLevelM),
              waterDistanceCm: parseInt(d.water_distance_cm ?? d.waterDistanceCm ?? prev.waterDistanceCm),
              rainRateMmHr: Number.isNaN(rain) ? prev.rainRateMmHr : rain,
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
              modelConfidence: 96.5,
            });
            resetSecondsAgo();
          }
          if (msg.type === 'PROJECTION' && msg.data) {
            const p = msg.data;
            const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
            const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
            const conf = Math.round(parseFloat(p.confidenceScore ?? p.confidence_score ?? prev.modelConfidence));
            setAiPrediction(prev => ({
              ...prev,
              predicted30m: Number.isNaN(p30) ? 0.00 : p30,
              predicted60m: Number.isNaN(p60) ? 0.00 : p60,
              riskScore: Math.round(parseFloat(p.risk_score ?? prev.riskScore)),
              modelConfidence: Number.isNaN(conf) ? 96.5 : conf,
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
            waterLevelM: parseFloat(j.data.waterLevelM ?? j.data.water_level_m ?? 0.00),
            waterDistanceCm: parseInt(j.data.rawDistanceCm ?? j.data.water_distance_cm ?? 240),
          }));
        }
      }).catch(() => {});

    fetch(`${API_BASE_URL}/api/v1/telemetry/projection`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          const p = j.data;
          const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
          const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
          const conf = Math.round(parseFloat(p.confidenceScore ?? p.confidence_score ?? 96.5));
          setAiPrediction(prev => ({
            ...prev,
            predicted30m: Number.isNaN(p30) ? 0.00 : p30,
            predicted60m: Number.isNaN(p60) ? 0.00 : p60,
            riskScore: Math.round(parseFloat(p.risk_score ?? prev.riskScore)),
            modelConfidence: Number.isNaN(conf) ? 96.5 : conf,
          }));
        }
      }).catch(() => {});

    // Fetch initial 30m historical trend for the sparkline graph
    fetch(`${API_BASE_URL}/api/v1/telemetry/history?range=30m`)
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data) && j.data.length > 0) {
          const pts = j.data.map(d => parseFloat(d.water_level_m ?? d.waterLevelM ?? 0)).filter(n => !Number.isNaN(n));
          if (pts.length > 0) setLevelHistory(pts.slice(-15));
        }
      }).catch(() => {});
  }, []);

  const floodLevel = getFloodLevel(telemetry.waterLevelM);
  const friendly = getFriendlyContent(floodLevel, telemetry, aiPrediction);
  const rainKey = rainIntensityKey(telemetry.rainRateMmHr);
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

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
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
              <RainOverlay intensity={rainKey} />
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
                trendText={
                  telemetry.waterLevelM < 1.2
                    ? 'Normal'
                    : telemetry.waterLevelM < 1.6
                    ? 'Advisory'
                    : telemetry.waterLevelM < 2.0
                    ? 'Warning'
                    : 'Danger'
                }
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
                tooltip="Antipolo river level forecast for the next 30 and 60 minutes based on real-time upstream conditions"
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

            {/* Emergency Email Subscription Card */}
            <div id="email-alerts">
              <EmailSubscriptionCard />
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive Weather Map Card (5/12 width) */}
          <div className="lg:col-span-5 min-w-0 w-full flex flex-col gap-4">

            {/* Weather Map Component */}
            <WeatherMapCard severity={floodLevel.id} />

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
