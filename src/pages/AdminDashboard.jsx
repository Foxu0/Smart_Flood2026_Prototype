import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, CheckCircle2, CloudRain, Cpu,
  Droplets, Info, MapPin, RefreshCw,
  Sliders, Volume2, VolumeX, Wifi, Zap, Activity,
  Radio, Globe, Send, Download, FileSpreadsheet, Timer, LogOut,
  Play, RotateCcw, Target, TrendingUp, BarChart3, Square, Mail
} from 'lucide-react';
import RainOverlay from '../RainOverlay.jsx';
import WeatherMapCard from '../WeatherMapCard.jsx';
import WaterTankGauge from '../components/WaterTankGauge.jsx';
import ToastContainer, { useToast } from '../components/ToastNotification.jsx';
import DataSourcesDisclaimerModal from '../components/DataSourcesDisclaimerModal.jsx';
import EmailSubscribersModal from '../components/EmailSubscribersModal.jsx';
import SkeletonDashboard from '../components/SkeletonDashboard.jsx';
import useCountUp from '../hooks/useCountUp.js';
import { API_BASE_URL, WS_BASE_URL } from '../config.js';

// ─── Helper: live Philippine Standard Time ───────────────────────────────────
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

const logIdRef = { current: 100 };

// ─── Flood level thresholds (kept for the underlying logic) ──────────────────
const FLOOD_LEVELS = [
  { id: 0, min: 0, max: 1.2, color: '#2f9463', soft: '#e5f6ec', border: '#bfe6cf' },
  { id: 1, min: 1.2, max: 1.6, color: '#2b6e8f', soft: '#e6f2f8', border: '#bfdbe8' },
  { id: 2, min: 1.6, max: 2.0, color: '#e69138', soft: '#fdf1de', border: '#f4d6a4' },
  { id: 3, min: 2.0, max: 2.4, color: '#e0522f', soft: '#fce7e0', border: '#f2bfab' },
];
function getFloodLevel(waterM, thresholds) {
  const l1 = thresholds?.level1_watch ?? 1.2;
  const l2 = thresholds?.level2_alarm ?? 1.6;
  const l3 = thresholds?.level3_danger ?? 2.0;

  if (waterM < l1) return { ...FLOOD_LEVELS[0], min: 0.0, max: l1 };
  if (waterM < l2) return { ...FLOOD_LEVELS[1], min: l1, max: l2 };
  if (waterM < l3) return { ...FLOOD_LEVELS[2], min: l2, max: l3 };
  return { ...FLOOD_LEVELS[3], min: l3, max: 2.4 };
}

// ─── Plain-language content, keyed by flood level id ─────────────────────────
function getFriendlyContent(level, telemetry, aiPrediction) {
  switch (level.id) {
    case 0:
      return {
        badge: 'All Clear', icon: CheckCircle2,
        heroTitle: 'Normal Conditions',
        heroMsg: 'Water levels at the monitoring station remain normal and well within safe operational limits. No immediate flood threat detected.',
        adviceTitle: 'Station Status',
        advice: [
          'Station telemetry operating normally within baseline thresholds.',
          'Continuous automated monitoring of water stage and rainfall active.',
          'No emergency alerts or manual overrides required at this time.',
        ],
      };
    case 1:
      return {
        badge: 'Keep an Eye Out', icon: Info,
        heroTitle: 'Water Level Rising',
        heroMsg: 'Rainfall has increased upstream water levels. The river channel is slightly elevated but remains within monitored advisory limits.',
        adviceTitle: 'Operational Readiness',
        advice: [
          'Verify telemetry stream continuity and battery supply voltages.',
          'Keep active surveillance on upstream rainfall accumulation trends.',
          'Notify duty operators to maintain standby alert readiness.',
        ],
      };
    case 2:
      return {
        badge: 'Watch Closely', icon: AlertTriangle,
        heroTitle: 'Flood Warning Active',
        heroMsg: `Telemetry detects accelerated water accumulation. Projected to approach ${aiPrediction.predicted60m.toFixed(2)} m within 60 minutes. Warning protocol active.`,
        adviceTitle: 'Active Warning Protocols',
        advice: [
          'Alert CDRRMO and barangay disaster response teams.',
          'Prepare automated siren broadcast triggers if warning levels persist.',
          'Dispatch situational advisories to registered email subscribers.',
        ],
      };
    default:
      return {
        badge: 'EVACUATE NOW', icon: AlertTriangle,
        heroTitle: 'Danger Level Reached',
        heroMsg: `Station water level has reached critical danger stage (${telemetry.waterLevelM.toFixed(2)} m). Immediate disaster evacuation protocols in effect.`,
        adviceTitle: 'Immediate Emergency Directives',
        advice: [
          'Sound emergency siren if not already activated.',
          'Coordinate emergency evacuation routes with Antipolo CDRRMO EOC.',
          'Issue mandatory high-ground evacuation broadcast.',
        ],
      };
  }
}

function rainDescription(mmHr) {
  if (mmHr < 5) return 'Just a light drizzle';
  if (mmHr < 15) return 'Light to moderate rain';
  if (mmHr < 30) return 'Moderate to heavy rain';
  return 'Heavy, non-stop rain';
}
function rainIntensityKey(mmHr) {
  if (mmHr < 2) return 'none';
  if (mmHr < 8) return 'light';
  if (mmHr < 25) return 'moderate';
  return 'heavy';
}

// ─── JarGauge replaced by WaterTankGauge (imported above) ───────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Time Offset Helper ──────────────────────────────────────────────────────
function formatTimeOffset(minutesOffset = 0) {
  const d = new Date(Date.now() + minutesOffset * 60000);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

// ─── Line Graph for Water Level (Bottom: Timeframe, Right: Meter Scale) ──────
function WaterLevelSparkline({ history = [], currentLevel = 0.35, color = '#2f9463' }) {
  const width = 260;
  const height = 72;
  const padY = 8;
  const padX = 8;
  const drawW = width - padX * 2;
  const drawH = height - padY * 2;

  const pts = Array.isArray(history) && history.length >= 2
    ? history
    : [
        +(currentLevel * 0.96).toFixed(2),
        +(currentLevel * 0.98).toFixed(2),
        +(currentLevel * 0.97).toFixed(2),
        +(currentLevel * 0.99).toFixed(2),
        +(currentLevel * 1.0).toFixed(2),
        +currentLevel.toFixed(2),
      ];

  const dataMin = Math.min(...pts);
  const dataMax = Math.max(...pts);
  const rawSpan = dataMax - dataMin;
  const minVal = rawSpan >= 0.02 ? dataMin : Math.max(0, dataMin - 0.02);
  const maxVal = rawSpan >= 0.02 ? dataMax : dataMax + 0.02;
  const range = (maxVal - minVal) || 0.04;
  const midVal = (minVal + maxVal) / 2;

  const coords = pts.map((val, idx) => {
    const x = padX + (idx / Math.max(1, pts.length - 1)) * drawW;
    const y = padY + drawH - ((val - minVal) / range) * drawH;
    return { x, y, val };
  });

  let pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const mx = (p0.x + p1.x) / 2;
    pathD += ` C ${mx.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaD = `${pathD} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;
  const gradId = `adminWaterSparkGrad_${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  const time30mAgo = formatTimeOffset(-30);
  const time15mAgo = formatTimeOffset(-15);
  const timeNow = formatTimeOffset(0);

  return (
    <div className="relative w-full my-auto select-none">
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
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

            {/* Start & Live endpoint markers */}
            <circle cx={first.x} cy={first.y} r="2.8" fill="#ffffff" stroke={color} strokeWidth="1.8" />
            <circle cx={last.x} cy={last.y} r="3.8" fill={color} stroke="#ffffff" strokeWidth="1.6" />
          </svg>
        </div>

        {/* Right Side: Y-Axis Meter Scale */}
        <div className="flex flex-col justify-between text-[10.5px] font-mono font-semibold text-[#5a7180] py-1 text-right min-w-[44px]">
          <span className="leading-none" style={{ color }}>{maxVal.toFixed(2)} m</span>
          <span className="leading-none">{midVal.toFixed(2)} m</span>
          <span className="leading-none">{minVal.toFixed(2)} m</span>
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
  const width = 260;
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
    <div className="relative w-full my-auto select-none">
      <div className="grid grid-cols-[1fr_auto] gap-x-2 items-stretch">
        {/* Plot Area with Grid & Axes */}
        <div className="relative bg-[#f8fbfc] border-b border-r border-[#cbdbe2] rounded-tl-lg overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 block">
            <defs>
              <linearGradient id="adminAiForecastArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="adminAiConfidenceCone" x1="0" y1="0" x2="1" y2="0">
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
            <path d={coneD} fill="url(#adminAiConfidenceCone)" />

            {/* Under-line gradient */}
            <path d={areaD} fill="url(#adminAiForecastArea)" />

            {/* Forecast Trajectory Line */}
            <path
              d={lineD}
              fill="none"
              stroke={color}
              strokeWidth="2.6"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Point: Now */}
            <circle cx={pt0.x} cy={pt0.y} r="3.5" fill="#123a54" stroke="#ffffff" strokeWidth="1.5" />

            {/* Point: +30m */}
            <circle cx={pt30.x} cy={pt30.y} r="4" fill={color} stroke="#ffffff" strokeWidth="1.8" />

            {/* Point: +60m */}
            <circle cx={pt60.x} cy={pt60.y} r="4" fill="#ffffff" stroke={color} strokeWidth="2.2" />
          </svg>
        </div>

        {/* Right Side: Y-Axis Meter Scale */}
        <div className="flex flex-col justify-between text-[10.5px] font-mono font-semibold text-[#5a7180] py-1 text-right min-w-[44px]">
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

// ─── Station Vitals Mini-Readout (for health card) ────────────────────────────
function StationVitalsReadout({ rssi, voltage, wsConnected }) {
  const rssiPct = Math.max(0, Math.min(100, ((rssi + 100) / 50) * 100));
  const voltPct = Math.max(0, Math.min(100, ((voltage - 10) / 4) * 100));

  const rssiColor = rssi > -60 ? '#2f9463' : rssi > -75 ? '#e69138' : '#e0522f';
  const voltColor = voltage >= 12.0 ? '#2f9463' : voltage >= 11.0 ? '#e69138' : '#e0522f';

  const rows = [
    { label: 'Wi-Fi RSSI', val: `${rssi} dBm`, pct: rssiPct, color: rssiColor },
    { label: 'Supply V', val: `${voltage.toFixed(1)} V`, pct: voltPct, color: voltColor },
    { label: 'WS Link', val: wsConnected ? 'LIVE' : 'RECONNECT', pct: wsConnected ? 100 : 0, color: wsConnected ? '#2f9463' : '#e69138' },
  ];

  return (
    <div className="flex flex-col gap-2 w-full">
      {rows.map(({ label, val, pct, color }) => (
        <div key={label}>
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9.5px] font-bold text-[#6d818d] uppercase tracking-wide">{label}</span>
            <span className="text-[10px] font-mono font-bold" style={{ color }}>{val}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#eef4f6] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Rain Rate Sparkline (bar-chart style) ─────────────────────────────────────
function RainRateSparkline({ history = [], currentRate = 0, color = '#2b6e8f' }) {
  const width = 280;
  const height = 82;
  const padY = 18;
  const padX = 10;
  const drawW = width - padX * 2;
  const drawH = height - padY * 2;

  // use history waterLevel as proxy for rain intensity, or fallback
  const pts = Array.isArray(history) && history.length >= 2
    ? history.slice(-8).map(h => h.waterLevel * 12)
    : [currentRate * 0.7, currentRate * 0.8, currentRate * 0.9, currentRate * 0.95, currentRate];

  const maxV = Math.max(...pts, 1);
  const barW = Math.max(4, (drawW / pts.length) - 2);

  return (
    <div className="relative w-full my-auto select-none">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-20 sm:h-24 overflow-visible">
        <defs>
          <linearGradient id="rainBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <text x={padX} y={13} textAnchor="start" fontSize="10" fill="#6d818d" fontWeight="600">mm/hr</text>
        <text x={width - padX} y={13} textAnchor="end" fontSize="11" fill={color} fontWeight="700">
          {currentRate.toFixed(1)} mm/hr ●
        </text>

        {pts.map((v, i) => {
          const bh = Math.max(2, (v / maxV) * drawH);
          const x = padX + (i / pts.length) * drawW + 1;
          const y = padY + drawH - bh;
          const isLast = i === pts.length - 1;
          return (
            <rect
              key={i}
              x={x} y={y}
              width={barW} height={bh}
              fill={isLast ? color : `url(#rainBarGrad)`}
              fillOpacity={isLast ? 1 : 0.6}
              rx="2"
            />
          );
        })}

        <text x={padX} y={height - 2} textAnchor="start" fontSize="9.5" fill="#6d818d" fontWeight="500">30m ago</text>
        <text x={width - padX} y={height - 2} textAnchor="end" fontSize="9.5" fill="#6d818d" fontWeight="600">Now</text>
      </svg>
    </div>
  );
}

// ─── Stat Card component (Detailed Admin Version) ──────────────────────────────
function AnimatedStatCard({
  icon: Icon,
  label,
  badge,
  value,
  numericValue,
  decimals = 1,
  trendText,
  sub,
  detailLine1,
  detailLine2,
  color,
  tooltip,
  delay = 0,
  variant = 'water',
  history = [],
  currentLevel = 0,
  predicted30m = 0,
  predicted60m = 0,
  // for health card
  rssi = -65,
  voltage = 12.2,
  wsConnected = false,
  // for rain card
  rainRate = 0,
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
      className={`bg-white rounded-2xl p-4 sm:p-5 border border-[#e4edf0] shadow-sm flex flex-col gap-2.5 card-enter card-enter-d${delay} hover:shadow-md transition-shadow duration-300`}
      title={tooltip}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6d818d]">{label}</span>
        {badge && (
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#123a54]/5 text-[#123a54] border border-[#123a54]/10">
            {badge}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        {/* Left: Big number + metadata */}
        <div className="flex flex-col justify-start flex-shrink-0 pt-0.5">
          {variant === 'ai' ? (
            <div className="flex flex-col gap-1.5 mb-1.5">
              <div className="flex items-baseline justify-between bg-[#f8fbfc] px-2.5 py-1.5 rounded-lg border border-[#eef4f6]">
                <span className="text-xs font-semibold text-[#5a7180]">In 30 mins:</span>
                <span className="font-display text-lg font-bold text-[#123a54] tracking-tight leading-none">
                  {displayed30m} m
                </span>
              </div>
              <div className="flex items-baseline justify-between bg-[#f8fbfc] px-2.5 py-1.5 rounded-lg border border-[#eef4f6]">
                <span className="text-xs font-semibold text-[#5a7180]">In 60 mins:</span>
                <span className="font-display text-lg font-bold text-[#123a54] tracking-tight leading-none">
                  {displayed60m} m
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-1">
              <span className="font-display text-3xl font-bold text-[#123a54] tracking-tight leading-none inline-block">
                {numericValue != null && !Number.isNaN(Number(numericValue))
                  ? `${displayed}${cleanVal.replace(/^[\d.\s-]+/, ' ')}`
                  : (cleanVal || '—')}
              </span>
              {trendText && (
                <span className="block text-[10.5px] font-semibold mt-0.5" style={{ color }}>
                  {trendText}
                </span>
              )}
            </div>
          )}
          {variant !== 'ai' && sub && <p className="text-[11px] font-bold text-[#123a54] leading-tight mb-1">{sub}</p>}
          {variant !== 'ai' && detailLine1 && <p className="text-[9.5px] text-[#6d818d] font-mono leading-tight">{detailLine1}</p>}
          {variant !== 'ai' && detailLine2 && <p className="text-[9.5px] text-[#6d818d] font-mono leading-tight mt-0.5">{detailLine2}</p>}
        </div>

        {/* Right: Chart or Vitals */}
        <div className="min-w-0 flex-1">
          {variant === 'water' && (
            <WaterLevelSparkline history={history} currentLevel={validNum} color={color} />
          )}
          {variant === 'ai' && (
            <AiForecastSparkline currentM={currentLevel} p30M={predicted30m} p60M={predicted60m} color={color} />
          )}
          {variant === 'rain' && (
            <RainRateSparkline history={history} currentRate={rainRate} color={color} />
          )}
          {variant === 'health' && (
            <StationVitalsReadout rssi={rssi} voltage={voltage} wsConnected={wsConnected} />
          )}
        </div>
      </div>
    </div>
  );
}


export default function FloodMonitoringDashboard() {
  const { pst, date } = usePSTClock();
  const { toasts, pushToast, dismissToast } = useToast();
  const navigate = useNavigate();

  // ── Auth helpers ──────────────────────────────────────────────────────────
  const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionStorage.getItem('sf_token') || ''}`,
  });

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
    } catch { /* silent */ }
    sessionStorage.removeItem('sf_token');
    sessionStorage.removeItem('sf_operator');
    navigate('/', { replace: true });
  };

  const operatorName = sessionStorage.getItem('sf_operator') || 'Operator';

  const [isLive, setIsLive] = useState(true);
  const [sirenActive, setSirenActive] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [radarTab, setRadarTab] = useState('Satellite');
  const [radarZoom, setRadarZoom] = useState(1);
  const [phone, setPhone] = useState('');
  const [smsConfirmed, setSmsConfirmed] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [telemetry, setTelemetry] = useState({
    waterLevelM: 0.00,
    waterDistanceCm: 240,
    rainRateMmHr: 0.0,
    rainTips: 0,
    wifiRssi: -65,
    gridVoltage: 12.2,
    espUptime: '00:00:00',
  });

  const [aiPrediction, setAiPrediction] = useState({
    riskScore: 0,
    predicted30m: 0.00,
    predicted60m: 0.00,
    timeToCriticalMins: null,
    modelConfidence: 96.5,
  });

  const [thresholds, setThresholds] = useState({
    level1_watch: 1.20,
    level2_alarm: 1.60,
    level3_danger: 2.00,
  });

  const [aiMetrics, setAiMetrics] = useState({
    totalEvaluated: 0,
    mae_m: 0.0,
    rmse_m: 0.0,
    avgAccuracy_pct: 'Evaluating (+30m in progress...)',
    methodUsed: 'ONNX_LSTM (flood_lstm.onnx)',
    history: [],
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/test/ai-evaluation`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          setAiMetrics(j.data);
        }
      }).catch(() => {});
  }, []);

  const [selectedScenario, setSelectedScenario] = useState('flash_flood');
  const [scenarioState, setScenarioState] = useState({
    isRunning: false,
    scenarioId: 'flash_flood',
    currentStep: 0,
    totalSteps: 25,
    comment: '',
  });

  const getToken = () => sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token') || '';

  const handleStartScenario = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/test/run-scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ scenarioId: selectedScenario, stepIntervalMs: 2500 }),
      });
      const json = await res.json();
      if (json.success) {
        pushToast('info', '▶️ Scenario Started', `Playing '${selectedScenario}' (${json.totalSteps} steps at 2.5s pacing)...`);
        setScenarioState({
          isRunning: true,
          scenarioId: selectedScenario,
          currentStep: 0,
          totalSteps: json.totalSteps,
          comment: 'Initiating scenario playback...',
        });
      } else {
        pushToast('danger', 'Scenario Error', json.error || 'Failed to start scenario');
      }
    } catch (err) {
      pushToast('danger', 'Scenario Error', err.message);
    }
  };

  const handleStopScenario = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/test/stop-scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        pushToast('warning', '⏹️ Scenario Stopped', 'Scenario playback halted.');
        setScenarioState(prev => ({ ...prev, isRunning: false }));
      }
    } catch (err) {
      pushToast('danger', 'Stop Error', err.message);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/test/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        pushToast('info', '▶️ Storm Simulation Initiated', '20-step hydrological cycle streaming to ONNX LSTM engine...');
      } else {
        pushToast('warning', 'Simulation Notice', json.error || json.message || 'Could not start simulation');
      }
    } catch (err) {
      pushToast('danger', 'Simulation Error', err.message);
    } finally {
      setTimeout(() => setIsSimulating(false), 5000);
    }
  };

  const handleResetTestTelemetry = async () => {
    if (!window.confirm('Are you sure you want to reset all test telemetry and event logs?')) return;
    setIsResetting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/test/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        pushToast('success', '🔄 Baseline Reset', 'Database truncated & evaluation metrics reset.');
        setTelemetry({
          waterLevelM: 0.00,
          waterDistanceCm: 240,
          rainRateMmHr: 0.0,
          rainTips: 0,
          wifiRssi: -65,
          gridVoltage: 12.2,
          espUptime: '00:00:00',
        });
        setAiPrediction({
          riskScore: 0,
          predicted30m: 0.00,
          predicted60m: 0.00,
          timeToCriticalMins: null,
          modelConfidence: 96.5,
        });
        setDbHistory([]);
        setLogs([]);
        setAiMetrics({
          totalEvaluated: 0,
          mae_m: 0.0,
          rmse_m: 0.0,
          avgAccuracy_pct: 'Evaluating (+30m in progress...)',
          methodUsed: 'ONNX_LSTM (flood_lstm.onnx)',
          history: [],
        });
      } else {
        pushToast('danger', 'Reset Failed', json.error || 'Failed to reset test telemetry');
      }
    } catch (err) {
      pushToast('danger', 'Reset Error', err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // Poll latest telemetry from GET /api/v1/telemetry/latest every 3s
  useEffect(() => {
    async function fetchLatest() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/latest`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const level = parseFloat(d.water_level_m ?? 0.00);
          const dist = parseFloat(d.raw_distance_cm ?? Math.round((2.4 - level) * 100));
          setTelemetry(prev => ({
            ...prev,
            waterLevelM: level,
            waterDistanceCm: dist,
            wifiRssi: parseInt(d.rssi_dbm ?? -65),
            gridVoltage: parseFloat(d.supply_voltage ?? 12.2),
          }));
          fetchHistory();
        } else if (json.success && json.data === null) {
          // Empty database — reset to 0.00m / 0 mm/h
          setTelemetry({
            waterLevelM: 0.00,
            waterDistanceCm: 240,
            rainRateMmHr: 0.0,
            rainTips: 0,
            wifiRssi: -65,
            gridVoltage: 12.2,
            espUptime: '00:00:00',
          });
          setAiPrediction(prev => ({
            ...prev,
            riskScore: 0,
            predicted30m: 0.00,
            predicted60m: 0.00,
          }));
        }
      } catch (err) {
        console.error('[Fetch Latest Telemetry Error]', err);
      }
    }

    fetchLatest();
    const interval = setInterval(fetchLatest, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial stored settings from GET /api/v1/settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/settings`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setThresholds(prev => ({
            level1_watch: d.level1_watch ? parseFloat(d.level1_watch) : (d.level1_advisory ? parseFloat(d.level1_advisory) : prev.level1_watch),
            level2_alarm: d.level2_alarm ? parseFloat(d.level2_alarm) : (d.level2_siren ? parseFloat(d.level2_siren) : prev.level2_alarm),
            level3_danger: d.level3_danger ? parseFloat(d.level3_danger) : prev.level3_danger,
          }));
        }
      } catch (err) {
        console.error('[Load Settings Error]', err);
      }
    }
    loadSettings();
  }, []);

  // Debounced Auto-Save thresholds to POST /api/v1/settings (500ms delay)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const token = getToken();
        if (!token) return;
        await fetch(`${API_BASE_URL}/api/v1/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            level1_watch: thresholds.level1_watch,
            level2_alarm: thresholds.level2_alarm,
            level3_danger: thresholds.level3_danger,
            level1_advisory: thresholds.level1_watch,
            level2_siren: thresholds.level2_alarm,
          }),
        });
      } catch (err) {
        console.error('[Auto-Save Settings Error]', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [thresholds]);

  // ── "Last updated X seconds ago" counter ─────────────────────────────────
  const [secondsAgo, setSecondsAgo] = useState(0);
  const secondsAgoRef = useRef(null);
  const resetSecondsAgo = () => {
    setSecondsAgo(0);
    if (secondsAgoRef.current) clearInterval(secondsAgoRef.current);
    secondsAgoRef.current = setInterval(() => setSecondsAgo(s => s + 1), 1000);
  };
  useEffect(() => {
    resetSecondsAgo();
    return () => { if (secondsAgoRef.current) clearInterval(secondsAgoRef.current); };
  }, []);

  const [timeFrame, setTimeFrame] = useState('30m');
  const [customValue, setCustomValue] = useState(2);
  const [customUnit, setCustomUnit] = useState('hours');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRangeText, setCustomRangeText] = useState('2 Hours');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Real Database History State
  const [dbHistory, setDbHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch real PostgreSQL telemetry logs from GET /api/v1/telemetry/history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      let rangeParam = timeFrame;
      if (timeFrame === 'custom') {
        const unitShort = customUnit === 'minutes' ? 'm' : customUnit === 'days' ? 'd' : 'h';
        rangeParam = `${customValue}${unitShort}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/history?range=${rangeParam}`);
      if (!res.ok) throw new Error('History fetch failed');
      const json = await res.json();

      if (json.success && json.data && json.data.length > 0) {
        const formatted = json.data.map((item, i, arr) => {
          const isLatest = i === arr.length - 1;
          const t = new Date(item.timestamp);
          const timeLabel = isLatest
            ? 'Now'
            : t.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false });

          return {
            time: timeLabel,
            waterLevel: parseFloat(item.water_level_m),
            rawDistanceCm: parseFloat(item.raw_distance_cm),
            timestamp: item.timestamp,
          };
        });
        setDbHistory(formatted);
      } else {
        setDbHistory([]);
      }
    } catch (err) {
      console.error('[History Fetch Error]', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [timeFrame, customValue, customUnit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getFallbackHistory = (range, level) => {
    return [
      { time: 'Now', waterLevel: level },
    ];
  };

  const activeHistory = dbHistory.length > 0 ? dbHistory : getFallbackHistory(timeFrame, telemetry.waterLevelM);

  const [logs, setLogs] = useState([]);

  // Fetch real initial events from database
  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/events?limit=10`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const mapped = json.data.map(ev => ({
            id: `event-${ev.id}`,
            time: new Date(ev.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
            type: ev.severity === 'WARNING' || ev.severity === 'CRITICAL' ? 'alarm' : 'notice',
            msg: ev.message,
          }));
          setLogs(mapped);
        }
      } catch (err) {
        console.error('[Load Events Error]', err);
      }
    }
    loadEvents();
  }, []);

  const addLog = (type, msg) => {
    const timeStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setLogs(prev => [{ id: `log-${Date.now()}-${Math.random()}`, time: timeStr, type, msg }, ...prev.slice(0, 9)]);
  };

  // Fetch initial ML projection from GET /api/v1/telemetry/projection
  useEffect(() => {
    async function loadProjection() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/projection`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
          const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
          const conf = Math.round(parseFloat(p.confidenceScore ?? p.confidence_score ?? 96.5));
          setAiPrediction(prev => ({
            ...prev,
            predicted30m: Number.isNaN(p30) ? 0.00 : p30,
            predicted60m: Number.isNaN(p60) ? 0.00 : p60,
            modelConfidence: Number.isNaN(conf) ? 96.5 : conf,
          }));
        }
      } catch (err) {
        console.error('[Load Projection Error]', err);
      }
    }
    loadProjection();
  }, []);

  // ── Real-Time WebSocket Connection ─────────────────────────────────────────
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connectWS = () => {
      ws = new WebSocket(WS_BASE_URL);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'TELEMETRY' && message.data) {
            const d = message.data;
            const level = d.waterLevelM ?? d.water_level_m ?? d.waterLevel ?? 1.05;
            const dist = d.rawDistanceCm ?? d.raw_distance_cm ?? Math.round((1.8 - level) * 100);
            const rssi = d.rssiDbm ?? d.rssi_dbm ?? -65;
            const voltage = d.supplyVoltageV ?? d.supply_voltage ?? d.batteryVoltage ?? 12.0;

            setTelemetry(prev => ({
              ...prev,
              waterLevelM: parseFloat(level),
              waterDistanceCm: parseFloat(dist),
              wifiRssi: parseInt(rssi),
              gridVoltage: parseFloat(voltage),
            }));

            setAiPrediction(prev => {
              const p30 = Math.min(1.8, level + 0.10);
              const p60 = Math.min(1.8, level + 0.20);
              const risk = Math.round((p60 / 1.8) * 100);
              return { ...prev, riskScore: risk, predicted30m: +p30.toFixed(2), predicted60m: +p60.toFixed(2) };
            });
            fetchHistory();
          } else if (message.type === 'PROJECTION' && message.data) {
            const p = message.data;
            const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
            const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
            const conf = Math.round(parseFloat(p.confidenceScore ?? p.confidence_score ?? 96.5));
            setAiPrediction(prev => ({
              ...prev,
              predicted30m: Number.isNaN(p30) ? 0.00 : p30,
              predicted60m: Number.isNaN(p60) ? 0.00 : p60,
              modelConfidence: Number.isNaN(conf) ? 96.5 : conf,
            }));
          } else if (message.type === 'EVENT' && message.data) {
            const ev = message.data;
            addLog(ev.severity === 'WARNING' || ev.severity === 'CRITICAL' ? 'alarm' : 'notice', ev.message);
          } else if (message.type === 'SIREN_CONTROL' && message.data) {
            const { sirenState } = message.data;
            if (sirenState === 'ON' || sirenState === 'TEST') {
              setSirenActive(true);
              setManualOverride(false);
            }
            if (sirenState === 'MUTED') {
              setSirenActive(false);
              setManualOverride(true);
            }
            if (sirenState === 'OFF') {
              setSirenActive(false);
              setManualOverride(false);
            }
          } else if (message.type === 'AI_EVALUATION' && message.data) {
            setAiMetrics(message.data);
          } else if (message.type === 'SCENARIO_PROGRESS' && message.data) {
            const d = message.data;
            setScenarioState({
              isRunning: true,
              scenarioId: d.scenarioId,
              currentStep: d.currentStep,
              totalSteps: d.totalSteps,
              comment: d.comment || '',
            });
          } else if (message.type === 'SCENARIO_COMPLETE' || message.type === 'SCENARIO_STOPPED') {
            setScenarioState(prev => ({ ...prev, isRunning: false }));
          }
        } catch (e) {
          console.error('[WS Error]', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWS();
    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const floodLevel = getFloodLevel(telemetry.waterLevelM, thresholds);
  const friendly = getFriendlyContent(floodLevel, telemetry, aiPrediction);

  const sendSirenControl = async (action, durationMs = 5000) => {
    try {
      const token = getToken();
      if (!token) return;
      await fetch(`${API_BASE_URL}/api/v1/control/siren`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, durationMs }),
      });
    } catch (err) {
      console.error('[Siren Control Error]', err);
    }
  };

  const testTimeoutRef = useRef(null);

  const toggleSiren = useCallback(() => {
    if (sirenActive) {
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current);
        testTimeoutRef.current = null;
      }
      setSirenActive(false);
      setManualOverride(true);
      addLog('override', 'MUTE ALARM: Operator silenced acoustic siren (Manual Override active).');
      sendSirenControl('MUTE');
    } else {
      setSirenActive(true);
      setManualOverride(false);
      addLog('system', 'SIREN ACTIVATED: Operator manually triggered acoustic relay.');
      sendSirenControl('ENABLE');
      if (telemetry.waterLevelM < thresholds.level2_alarm) {
        if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
        testTimeoutRef.current = setTimeout(() => {
          setSirenActive(false);
          addLog('system', 'SIREN TEST: 5-second relay test completed automatically.');
          sendSirenControl('DISABLE');
        }, 5000);
      }
    }
  }, [sirenActive, telemetry.waterLevelM, thresholds.level2_alarm]);

  // ── Keyboard shortcuts: S = toggle siren (also T / M) ───────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 's' || e.key === 'S' || e.key === 't' || e.key === 'T' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleSiren();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSiren]);

  // ── Toast when flood level rises ─────────────────────────────────────────
  const prevLevelIdRef = useRef(floodLevel.id);
  useEffect(() => {
    if (floodLevel.id > prevLevelIdRef.current) {
      const msgs = [
        '',
        'Water level has entered WATCH range (>1.2 m). Stay alert.',
        '⚠ Water is rising fast — now in ALARM range (>1.6 m). Prepare to act.',
        '🚨 DANGER LEVEL reached (>2.0 m). Move to higher ground immediately!',
      ];
      const severityMap = ['info', 'info', 'warning', 'danger'];
      pushToast({
        message: msgs[floodLevel.id] || 'Flood level has changed.',
        severity: severityMap[floodLevel.id] || 'warning',
        duration: floodLevel.id >= 3 ? 8000 : 5000,
      });
    }
    prevLevelIdRef.current = floodLevel.id;
  }, [floodLevel.id]);

  // ── Reset "last updated" timer on every telemetry water level change ──────
  const prevWaterRef = useRef(telemetry.waterLevelM);
  useEffect(() => {
    if (prevWaterRef.current !== telemetry.waterLevelM) {
      resetSecondsAgo();
      prevWaterRef.current = telemetry.waterLevelM;
    }
  }, [telemetry.waterLevelM]);

  const exportTelemetryCsv = () => {
    const csvRows = [
      ['Timestamp', 'Water Level (m)', 'Distance to Sensor (cm)', 'Rain Rate (mm/h)', 'System Status'],
      ...activeHistory.map(h => [
        h.time,
        h.waterLevel.toFixed(2),
        Math.round((1.8 - h.waterLevel) * 100),
        telemetry.rainRateMmHr,
        getFloodLevel(h.waterLevel).label
      ]),
      [
        new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }),
        telemetry.waterLevelM.toFixed(2),
        telemetry.waterDistanceCm,
        telemetry.rainRateMmHr,
        floodLevel.label
      ]
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartFlood_Telemetry_${timeFrame}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog('system', 'Exported telemetry log to CSV file.');
  };

  const tryScenario = (label, level) => {
    setIsLive(false);
    setManualOverride(false);
    setSirenActive(level >= 1.60);
    setTelemetry(prev => ({
      ...prev,
      waterLevelM: level,
      waterDistanceCm: Math.round((1.8 - level) * 100 * 10) / 10,
      rainRateMmHr: level < 0.6 ? 2 : level < 1.3 ? 14 : 30,
    }));
    setAiPrediction(prev => {
      const p30 = Math.min(2.4, level + 0.10);
      const p60 = Math.min(2.4, level + 0.20);
      return { ...prev, riskScore: Math.round((p60 / 2.4) * 100), predicted30m: +p30.toFixed(2), predicted60m: +p60.toFixed(2), timeToCriticalMins: Math.max(5, Math.round((2.0 - level) * 120)) };
    });
    addLog('system', `Preview mode: showing what "${label}" looks like.`);
  };

  const resumeLive = () => { setIsLive(true); setManualOverride(false); };

  const sendSms = () => {
    if (phone.trim().length < 7) return;
    setSmsConfirmed(true);
    setTimeout(() => setSmsConfirmed(false), 4000);
  };

  const chartH = 130;
  const chartW = 560;
  const maxLevel = 2.4;
  const histLevels = activeHistory.map(h => h.waterLevel);
  // Allocate 88% width for historical telemetry, reserving rightmost 12% for +60m ML forecast projection
  const telemetryW = chartW * 0.88;
  const toChartPt = (v, i, arr) => ({
    x: (i / Math.max(arr.length - 1, 1)) * telemetryW,
    y: chartH - (v / maxLevel) * chartH,
  });
  const buildPath = (arr) => arr.map((v, i, a) => {
    const { x, y } = toChartPt(v, i, a);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const areaPath = (() => {
    const pts = histLevels.map((v, i, a) => toChartPt(v, i, a));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ` L ${telemetryW} ${chartH} L 0 ${chartH} Z`;
  })();

  const lastMeasuredPt = toChartPt(telemetry.waterLevelM, activeHistory.length - 1, activeHistory);
  const forecastPt = {
    x: chartW - 10,
    y: chartH - (aiPrediction.predicted60m / maxLevel) * chartH,
  };

  const logStyle = (type) => ({
    alarm: { badge: 'bg-[#fce7e0] text-[#e0522f] border border-[#f2bfab]', dot: '#e0522f' },
    override: { badge: 'bg-[#eee7fb] text-[#6b4fbf] border border-[#d9c9f5]', dot: '#6b4fbf' },
    weather: { badge: 'bg-[#e6f2f8] text-[#2b6e8f] border border-[#bfdbe8]', dot: '#2b6e8f' },
    notice: { badge: 'bg-[#fdf1de] text-[#e69138] border border-[#f4d6a4]', dot: '#e69138' },
    system: { badge: 'bg-[#f1f5f2] text-[#6d818d] border border-[#dbe4de]', dot: '#6d818d' },
  }[type] || { badge: 'bg-gray-100 text-gray-600', dot: '#6d818d' });

  const AdviceIcon = friendly.icon;
  const rainKey = rainIntensityKey(telemetry.rainRateMmHr);

  const surgeDelta = +(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2);
  const surgeRateText = surgeDelta > 0.01 ? `+${surgeDelta.toFixed(2)} m/h` : '0.00 m/h (Steady)';
  const displayRainRate = useCountUp(telemetry.rainRateMmHr, 900, 1);
  const displayRiskScore = useCountUp(aiPrediction.riskScore, 900, 0);

  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setInitialLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  if (initialLoading) {
    return <SkeletonDashboard />;
  }

  return (
    <>
    <div className="min-h-screen w-full font-sans text-[#3f5361] py-0 md:py-6 px-0 sm:px-3 md:px-6 lg:px-8 xl:px-12 flex flex-col justify-start items-center">

      <div className="w-full max-w-7xl bg-[#123a54] backdrop-blur-xl shadow-2xl rounded-none md:rounded-[28px] border-none overflow-hidden min-h-screen md:min-h-0">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-white">
          <div className="max-w-full px-3 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-4 text-center sm:text-left flex-wrap justify-center sm:justify-start">
              <img src="/PUBMAT3.png" alt="PUBMAT 3 logo"
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 border-white/60 object-cover bg-white p-0.5 shadow-md flex-shrink-0" />
              <div>
                <h1 className="font-display text-lg sm:text-2xl font-bold leading-tight tracking-wide">Smart Flood</h1>
                <p className="text-[11px] sm:text-xs text-sky-100/90">EOC Admin Dashboard · Real-Time Monitoring &amp; Control</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-sky-200 uppercase tracking-wide">Local time</p>
                <p className="text-base font-mono font-semibold leading-tight">{pst}</p>
                <p className="text-[10px] text-sky-100/80">{date}</p>
              </div>
            </div>
          </div>
        </header>

        {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
        <main className="bg-white/75 px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          {/* LEFT COLUMN: Current Status, Water Level Gauge, Metrics, Graphs, & Logs (7/12 width) */}
          <div className="lg:col-span-7 min-w-0 w-full flex flex-col justify-start space-y-4">

            {/* ── HERO STATUS CARD ────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[24px] border shadow-sm p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center card-enter card-enter-d1"
              style={{ background: `linear-gradient(135deg, ${floodLevel.soft}, #ffffff 70%)`, borderColor: floodLevel.border }}>
              <RainOverlay intensity={rainKey} />
              <div className="relative z-[1]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: floodLevel.color }}>
                  <MapPin size={13} /> Current status
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
                  <span>Updates automatically</span>
                </div>

                <div className="flex flex-wrap gap-4 sm:gap-5 mt-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#6d818d]">
                    <Zap size={15} className="text-[#e69138]" />
                    <span>Surge Rate: <b className="text-[#123a54] font-mono">{surgeRateText}</b></span>
                  </div>
                </div>
              </div>

              <div className="relative z-[1] flex justify-center">
                <WaterTankGauge levelM={telemetry.waterLevelM} dangerM={thresholds.level3_danger} color={floodLevel.color} />
              </div>
            </div>

            {/* ─── STAT CARDS GRID (2-card stacked: Water Level + AI Forecast) ── */}
            <div className="grid grid-cols-1 gap-3">

              {/* Card 1: Water Level — side-by-side layout with timeframe + export */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e4edf0] shadow-sm flex flex-col gap-2.5 card-enter card-enter-d2 hover:shadow-md transition-shadow duration-300">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6d818d]">Water Level</span>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#123a54]/5 text-[#123a54] border border-[#123a54]/10">JSN-SR04T</span>
                </div>

                {/* Side-by-side: metric left, sparkline right */}
                <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                  <div className="flex flex-col justify-start pt-1">
                    <span className="font-display text-3xl sm:text-4xl font-bold text-[#123a54] tracking-tight leading-none">
                      {telemetry.waterLevelM.toFixed(2)} m
                    </span>
                  </div>
                  <div className="min-w-0">
                    <WaterLevelSparkline history={activeHistory.map(h => h.waterLevel)} currentLevel={telemetry.waterLevelM} color={floodLevel.color} />
                  </div>
                </div>

                {/* Footer: timeframe + export */}
                <div className="flex items-center justify-between pt-2 border-t border-[#f1f5f6] gap-2 flex-wrap">
                  <div className="relative flex items-center gap-0.5 bg-[#eef4f6] p-0.5 rounded-lg border border-[#e4edf0]">
                    {[{ id: '30m', label: '30m' }, { id: '1h', label: '1h' }, { id: '6h', label: '6h' }, { id: '24h', label: '24h' }].map(({ id, label }) => (
                      <button key={id}
                        onClick={() => { setTimeFrame(id); setShowCustomModal(false); }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                          timeFrame === id ? 'bg-white text-[#2b6e8f] shadow-sm' : 'text-[#6d818d] hover:text-[#123a54]'
                        }`}>
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={() => { setTimeFrame('custom'); setShowCustomModal(!showCustomModal); }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                        timeFrame === 'custom' ? 'bg-[#2b6e8f] text-white shadow-sm' : 'text-[#6d818d] hover:text-[#123a54]'
                      }`}>
                      <Sliders size={9} /> Custom
                    </button>
                    {showCustomModal && (
                      <div className="absolute bottom-full left-0 mb-2 z-30 bg-white rounded-xl shadow-xl border border-[#e4edf0] p-3 w-52 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-[#123a54] pb-1 border-b border-[#f1f5f6]">
                          <span>Custom Range</span>
                          <button onClick={() => setShowCustomModal(false)} className="text-[#6d818d] hover:text-red-500">×</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" max="100" value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            className="w-14 px-2 py-1 border border-[#d1e0e8] rounded-lg text-center font-bold text-[#123a54]" />
                          <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}
                            className="flex-1 px-2 py-1 border border-[#d1e0e8] rounded-lg font-semibold text-[#123a54] bg-white cursor-pointer">
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <button
                          onClick={() => { setCustomRangeText(`${customValue} ${customUnit.charAt(0).toUpperCase()}${customUnit.slice(1)}`); setTimeFrame('custom'); setShowCustomModal(false); }}
                          className="w-full py-1.5 rounded-lg bg-[#2b6e8f] text-white font-bold hover:bg-[#1f6f94] transition text-center">
                          Apply Range
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={exportTelemetryCsv}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2b6e8f]/10 text-[#2b6e8f] font-bold text-[10px] hover:bg-[#2b6e8f]/20 transition border border-[#2b6e8f]/30"
                    title="Export telemetry log to CSV">
                    <Download size={11} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Card 2: AI 30 & 60 Minute Forecast */}
              <AnimatedStatCard
                icon={TrendingUp}
                label="AI 30 and 60 Minute Forecast"
                badge="ONNX LSTM"
                value={`${aiPrediction.predicted30m.toFixed(2)} m`}
                numericValue={aiPrediction.predicted30m}
                decimals={2}
                trendText={`+${(aiPrediction.predicted30m - telemetry.waterLevelM).toFixed(2)} m delta`}
                sub={`Risk Score: ${aiPrediction.riskScore}%`}
                detailLine1={`Conf: ${aiPrediction.modelConfidence}% · MAE ±1.5cm · R² 82.6%`}
                detailLine2={`+60m: ${aiPrediction.predicted60m.toFixed(2)} m · ±2.2 cm`}
                color="#e69138"
                tooltip="ONNX LSTM 30 & 60-minute forecast with confidence cone"
                delay={3}
                variant="ai"
                currentLevel={telemetry.waterLevelM}
                predicted30m={aiPrediction.predicted30m}
                predicted60m={aiPrediction.predicted60m}
              />

            </div>


            {/* Predictive AI Flood Projection */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#123a54] mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-[#e69138]" /> Predictive AI Flood Projection
                </h2>
                <div className="space-y-2.5">
                  {[
                    { label: '30-Minute AI Horizon', value: `${aiPrediction.predicted30m.toFixed(2)} m`, delta: `+${(aiPrediction.predicted30m - telemetry.waterLevelM).toFixed(2)}m`, margin: 'MAE ±1.5 cm', r2: '82.6%', level: getFloodLevel(aiPrediction.predicted30m) },
                    { label: '60-Minute AI Horizon', value: `${aiPrediction.predicted60m.toFixed(2)} m`, delta: `+${(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2)}m`, margin: 'MAE ±2.2 cm', r2: '62.9%', level: getFloodLevel(aiPrediction.predicted60m) },
                  ].map(({ label, value, delta, margin, r2, level }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-xl border" style={{ background: level.soft, borderColor: level.border }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-bold text-[#6d818d]">{label}</p>
                          <span className="text-[9px] font-mono font-medium text-[#2b6e8f] bg-white/80 px-1.5 py-0.5 rounded border border-[#2b6e8f]/20 shadow-2xs">
                            {margin}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <p className="font-display text-lg font-bold" style={{ color: level.color }}>{value}</p>
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-white/90 border border-black/5 shadow-2xs" style={{ color: level.color }}>
                            ▲ {delta} delta
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${level.color}20`, color: level.color }}>
                          {level.label}
                        </span>
                        <p className="text-[9px] text-[#6d818d] font-mono mt-1">R²: {r2}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-[#f1f5f6] flex items-center justify-between text-[11px] text-[#6d818d] flex-wrap gap-1">
                <span>Model Test Validation:</span>
                <span>MAE <b className="text-[#123a54]">±1.5 cm</b> (+30m) / <b className="text-[#123a54]">±2.2 cm</b> (+60m) · R² <b className="text-[#123a54]">82.6%</b></span>
              </div>
            </div>

            {/* Activity feed */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={16} className="text-[#2b6e8f]" />
                  <h2 className="text-sm font-semibold text-[#123a54]">What's been happening</h2>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {logs.map((log, idx) => {
                    const s = logStyle(log.type);
                    return (
                      <div key={log.id}
                        className="flex items-start gap-2.5 text-xs sm:text-sm p-2.5 rounded-xl glass-card"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0 animate-pulse" style={{ background: s.dot }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${s.badge} flex-shrink-0`}>[{log.time}]</span>
                            <p className="text-[#3f5361] font-mono text-[10px] sm:text-xs font-semibold leading-snug">{log.msg}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Weather Map & ESP32 Controls (5/12 width) */}
          <div className="lg:col-span-5 min-w-0 w-full flex flex-col gap-4">

            {/* Interactive Dynamic Leaflet Weather Map Card with severity beacon */}
            <WeatherMapCard severity={floodLevel.id} />

            {/* ── SYSTEM CONTROLS & ALERTS CARD ─────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-5">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#f1f5f6] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#123a54] leading-tight">System Controls &amp; Alerts</h2>
                  <p className="text-[11px] text-[#6d818d] mt-0.5">Manage flood warning levels, siren broadcast, and resident alerts</p>
                </div>
                <span className="text-[10px] bg-[#e5f6ec] text-[#2f9463] font-bold px-2.5 py-1 rounded-full border border-[#bfe6cf] flex-shrink-0">
                  Admin Control
                </span>
              </div>

              {/* Flood Alert Threshold Sliders */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a7180]">
                    Flood Alert Thresholds
                  </h3>
                  <span className="text-[10.5px] font-medium text-[#8fa3b0]">Scale: 0.50 m – 2.40 m</span>
                </div>

                <div className="space-y-2.5">
                  {[
                    { key: 'level1_watch', badge: 'Level 1', label: 'Advisory Watch', desc: 'Early water rise notice', min: 0.5, max: 2.4, color: '#2b6e8f', soft: '#e6f2f8' },
                    { key: 'level2_alarm', badge: 'Level 2', label: 'Warning Alarm', desc: 'Triggers automated warning siren', min: 0.5, max: 2.4, color: '#e69138', soft: '#fdf1de' },
                    { key: 'level3_danger', badge: 'Level 3', label: 'Danger Level', desc: 'Critical threshold', min: 0.5, max: 2.4, color: '#e0522f', soft: '#fce7e0' },
                  ].map(({ key, badge, label, desc, min, max, color, soft }) => {
                    const val = Number(thresholds[key] || min);
                    const pct = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
                    return (
                      <div key={key} className="bg-[#f8fbfc] rounded-xl p-3 border border-[#eef4f6] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                              style={{ backgroundColor: soft, color }}
                            >
                              {badge}
                            </span>
                            <div className="truncate">
                              <span className="text-xs font-bold text-[#123a54]">{label}</span>
                              <span className="hidden sm:inline text-[10.5px] text-[#6d818d] ml-1.5">· {desc}</span>
                            </div>
                          </div>
                          <span
                            className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-[#e4edf0] flex-shrink-0"
                            style={{ color }}
                          >
                            {val.toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step="0.05"
                          value={val}
                          onChange={e => setThresholds({ ...thresholds, [key]: parseFloat(e.target.value) })}
                          style={{
                            background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e2ecef ${pct}%, #e2ecef 100%)`,
                            '--thumb-color': color,
                          }}
                          className="w-full h-2 rounded-full cursor-pointer block"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Station Operations & Maintenance */}
              <div className="space-y-2.5 pt-2 border-t border-[#f1f5f6]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a7180]">
                  Station Operations &amp; Maintenance
                </h3>

                {/* 1. Emergency Siren Override */}
                <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  sirenActive ? 'bg-rose-50/70 border-rose-200' : 'bg-[#f8fbfc] border-[#eef4f6]'
                }`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#123a54]">Emergency Siren</p>
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        sirenActive ? 'bg-rose-100 text-rose-700' : 'bg-[#e4edf0] text-[#5a7180]'
                      }`}>
                        {sirenActive ? 'Active' : 'Standby'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6d818d] mt-0.5">
                      {sirenActive ? 'Siren is currently sounding at the station' : 'Manually test or activate the station siren'}
                    </p>
                  </div>
                  <button
                    onClick={toggleSiren}
                    title={sirenActive ? 'Click to silence siren (Shortcut: S)' : 'Click to activate siren (Shortcut: S)'}
                    className={`w-36 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border shadow-2xs transition-all flex-shrink-0 cursor-pointer active:scale-95 ${
                      sirenActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                        : 'bg-[#2b6e8f] hover:bg-[#1f6f94] text-white border-[#245e7b]'
                    }`}
                  >
                    {sirenActive ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    <span>{sirenActive ? 'Silence Siren' : 'Activate Siren'}</span>
                  </button>
                </div>

                {/* 2. Community Email Alerts */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#f8fbfc] border border-[#eef4f6]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#123a54]">Community Email Alerts</p>
                    <p className="text-[11px] text-[#6d818d] mt-0.5">
                      View subscribed residents and send email advisories
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="w-36 h-9 rounded-xl bg-white hover:bg-[#e6f2f8] text-[#123a54] font-bold text-xs border border-[#cbdbe2] flex items-center justify-center gap-1.5 shadow-2xs transition-all flex-shrink-0 cursor-pointer active:scale-95"
                  >
                    <Mail size={14} className="text-[#2b6e8f]" />
                    <span>Manage Alerts</span>
                  </button>
                </div>

                {/* 3. Reset Telemetry Data */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#f8fbfc] border border-[#eef4f6]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#123a54]">Reset Sensor Logs</p>
                    <p className="text-[11px] text-[#6d818d] mt-0.5">
                      Clear test history and reset water level baseline
                    </p>
                  </div>
                  <button
                    onClick={handleResetTestTelemetry}
                    disabled={isResetting}
                    className="w-36 h-9 rounded-xl bg-white hover:bg-gray-100 text-[#5a7180] hover:text-[#123a54] font-bold text-xs border border-[#cbdbe2] flex items-center justify-center gap-1.5 shadow-2xs transition-all flex-shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcw size={13} className={isResetting ? 'animate-spin' : ''} />
                    <span>{isResetting ? 'Resetting...' : 'Reset Logs'}</span>
                  </button>
                </div>
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
          <button
            onClick={() => setShowDisclaimer(true)}
            className="flex items-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition cursor-pointer"
          >
            <Info size={13} />
            <span>Data Sources &amp; Disclaimers</span>
          </button>
        </footer>

      </div>
    </div>

    {/* Data Sources & Disclaimers Modal */}
    <DataSourcesDisclaimerModal
      isOpen={showDisclaimer}
      onClose={() => setShowDisclaimer(false)}
    />

    {/* Email Subscribers & Broadcast Center Modal */}
    <EmailSubscribersModal
      isOpen={showEmailModal}
      onClose={() => setShowEmailModal(false)}
      onNotification={({ type, msg }) => pushToast(type, 'Email Alert', msg)}
    />

    {/* ── TOAST NOTIFICATIONS (portal, fixed bottom-right) ─────────────── */}
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
