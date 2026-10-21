import React, { useId } from 'react';
import { formatTimeOffset } from '../../lib/floodLevels.js';

// The two small charts used on the resident page and the station dashboard.
// Times are in Philippine time; the right side shows the metre scale.

// ─── Line Graph for Water Level (Bottom: Timeframe, Right: Meter Scale) ──────
export function WaterLevelSparkline({ history = [], currentLevel = 0, color = '#2f9463', framed = false }) {
  const width = 260;
  const height = 72;
  const padY = 8;
  const padX = 8;
  const drawW = width - padX * 2;
  const drawH = height - padY * 2;

  // Not enough readings yet → a flat line at the current level (no made-up points)
  const pts = Array.isArray(history) && history.length >= 2 ? history : [currentLevel, currentLevel];

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
  const gradId = `water${useId().replace(/:/g, '')}`;

  const time30mAgo = formatTimeOffset(-30);
  const time15mAgo = formatTimeOffset(-15);
  const timeNow = formatTimeOffset(0);

  return (
    <div className={`relative w-full select-none ${framed ? 'pt-2 border-t border-[#f1f5f6]' : 'my-auto'}`}>
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
export function AiForecastSparkline({ currentM = 0, p30M = 0, p60M = 0, color = '#e69138', framed = false }) {
  const width = 260;
  const height = 72;
  const padY = 8;
  const padX = 10;
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

  // Error band = the model's average test error (MAE ±1.7 cm at 30 min, ±2.3 cm at 60 min)
  const offset30 = Math.min(12, Math.max(4, (0.017 / range) * drawH));
  const offset60 = Math.min(16, Math.max(5, (0.023 / range) * drawH));

  const coneD = `M ${pt0.x.toFixed(1)} ${pt0.y.toFixed(1)} ` +
    `L ${pt30.x.toFixed(1)} ${Math.max(2, pt30.y - offset30).toFixed(1)} ` +
    `L ${pt60.x.toFixed(1)} ${Math.max(2, pt60.y - offset60).toFixed(1)} ` +
    `L ${pt60.x.toFixed(1)} ${Math.min(height - 2, pt60.y + offset60).toFixed(1)} ` +
    `L ${pt30.x.toFixed(1)} ${Math.min(height - 2, pt30.y + offset30).toFixed(1)} Z`;

  const lineD = `M ${pt0.x.toFixed(1)} ${pt0.y.toFixed(1)} L ${pt30.x.toFixed(1)} ${pt30.y.toFixed(1)} L ${pt60.x.toFixed(1)} ${pt60.y.toFixed(1)}`;
  const areaD = `${lineD} L ${pt60.x.toFixed(1)} ${height} L ${pt0.x.toFixed(1)} ${height} Z`;

  const uid = useId().replace(/:/g, '');
  const areaId = `forecastArea${uid}`;
  const coneId = `forecastCone${uid}`;
  const timeNow = formatTimeOffset(0);
  const time30m = formatTimeOffset(30);
  const time60m = formatTimeOffset(60);

  return (
    <div className={`relative w-full select-none ${framed ? 'pt-2 border-t border-[#f1f5f6]' : 'my-auto'}`}>
      <div className="grid grid-cols-[1fr_auto] gap-x-2 items-stretch">
        {/* Plot Area with Grid & Axes */}
        <div className="relative bg-[#f8fbfc] border-b border-r border-[#cbdbe2] rounded-tl-lg overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 block">
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id={coneId} x1="0" y1="0" x2="1" y2="0">
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

            {/* Shaded error band (test MAE) */}
            <path d={coneD} fill={`url(#${coneId})`} />

            {/* Under-line gradient */}
            <path d={areaD} fill={`url(#${areaId})`} />

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
