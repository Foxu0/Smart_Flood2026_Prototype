import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { API_BASE_URL } from '../../config.js';
import { LEVEL_TAG, OFF_TAG } from '../../lib/floodLevels.js';

// CDRRMO overview: one small card per barangay station with the numbers only —
// water level now, and the forecast for 30 and 60 minutes.
// Most urgent first: Spill → Warning → Advisory → Normal → No data → Off, then A–Z.

const NO_DATA_TAG = { name: 'No data yet', style: 'bg-gray-50 text-gray-500 border-gray-200' };
const EDGE = { 0: 'border-t-emerald-400', 1: 'border-t-sky-400', 2: 'border-t-amber-400', 3: 'border-t-red-500' };
const FILL = { 0: 'bg-emerald-500', 1: 'bg-sky-500', 2: 'bg-amber-500', 3: 'bg-red-500' };

const isOff = (b) => b.status === 'MAINTENANCE';
const rank = (b) => (isOff(b) ? -2 : b.latest ? b.level : -1);

function timeAgo(v) {
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : new Date(v).toLocaleDateString('en-PH', { dateStyle: 'medium' });
}

// Value with its unit; a plain dash (no unit) when there is no number yet
function Value({ v, big }) {
  if (v == null || Number.isNaN(v)) return <span className={`font-display font-bold text-[#c5d1d8] ${big ? 'text-3xl' : 'text-base'}`}>—</span>;
  return (
    <span className={`font-display font-bold text-[#123a54] ${big ? 'text-3xl' : 'text-base'}`}>
      {v.toFixed(2)}<span className={`font-semibold text-[#6d818d] ml-0.5 ${big ? 'text-sm' : 'text-[11px]'}`}> m</span>
    </span>
  );
}

// Rising / Steady / Falling, from the 30-minute forecast
function Trend({ now, next }) {
  if (now == null || next == null || Number.isNaN(next)) return null;
  const d = next - now;
  const [Icon, text, color] = d > 0.02 ? [TrendingUp, 'Rising', 'text-amber-700']
    : d < -0.02 ? [TrendingDown, 'Falling', 'text-emerald-700']
    : [Minus, 'Steady', 'text-[#6d818d]'];
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${color}`}><Icon size={13} />{text}</span>;
}

function StationCard({ board }) {
  const [forecast, setForecast] = useState(null);
  const off = isOff(board);
  const hasReading = Boolean(board.latest);
  const tag = off ? OFF_TAG : hasReading ? LEVEL_TAG[board.level] : NO_DATA_TAG;
  const now = hasReading ? Number(board.latest.waterLevelM) : null;
  const spill = Number(board.thresholds?.level3_danger ?? 2);
  const toSpill = now == null ? 0 : Math.min(100, (now / spill) * 100);

  // AI forecast for this station (refreshed every minute)
  useEffect(() => {
    if (!hasReading || off) return undefined;
    const load = () => fetch(`${API_BASE_URL}/api/v1/telemetry/projection?nodeId=${board.id}`)
      .then((r) => r.json())
      .then(({ data: d }) => {
        if (d) setForecast({ p30: parseFloat(d.horizon30mM ?? d.predicted30m), p60: parseFloat(d.horizon60mM ?? d.predicted60m) });
      })
      .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [board.id, hasReading, off]);

  return (
    <div className={`bg-white rounded-2xl border border-[#e4edf0] shadow-sm p-4 min-w-0 ${!off && hasReading ? `border-t-4 ${EDGE[board.level]}` : ''}`}>
      {/* Barangay + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-[#123a54] leading-tight truncate">{board.barangay}</p>
          <p className="text-[11px] text-[#6d818d] truncate">{board.name}</p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${tag.style}`}>{tag.name}</span>
      </div>

      {/* Water level now */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6d818d]">Water level now</p>
        <Trend now={now} next={forecast?.p30} />
      </div>
      <p className="leading-none mt-1.5">
        {hasReading ? <Value v={now} big /> : <span className="text-sm font-semibold text-[#8a9ca7]">No reading yet</span>}
      </p>

      {/* How close the water is to the spill level */}
      <div className="mt-2.5 h-1.5 rounded-full bg-[#eef2f4] overflow-hidden">
        <div className={`h-full rounded-full ${FILL[board.level] || FILL[0]}`} style={{ width: `${toSpill}%` }} />
      </div>
      <p className="text-[11px] text-[#8a9ca7] mt-1 flex justify-between">
        <span>{hasReading ? `${Math.round(toSpill)}% of spill level` : '0 m'}</span>
        <span>Spill at {spill.toFixed(2)} m</span>
      </p>

      {/* Forecast */}
      <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#6d818d]">Forecast</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {[['In 30 min', forecast?.p30], ['In 60 min', forecast?.p60]].map(([label, v]) => (
          <div key={label} className="rounded-lg bg-[#f6f9fa] border border-[#eef4f6] px-2.5 py-1.5">
            <p className="text-[10px] font-semibold text-[#6d818d]">{label}</p>
            <p className="leading-tight"><Value v={v} /></p>
          </div>
        ))}
      </div>

      {(off || hasReading) && (
        <p className="mt-3 pt-2.5 border-t border-[#f1f5f6] text-[11px] text-[#8a9ca7]">
          {off ? 'Turned off' : `Updated ${timeAgo(board.latest.recordedAt)}`}
        </p>
      )}
    </div>
  );
}

export default function StationOverview({ boards }) {
  const sorted = [...boards].sort((a, b) => rank(b) - rank(a) || a.barangay.localeCompare(b.barangay));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sorted.map((b) => <StationCard key={b.id} board={b} />)}
    </div>
  );
}
