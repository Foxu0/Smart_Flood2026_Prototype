// Flood levels in one place: used by the resident page, the station dashboard,
// the CDRRMO overview and the Alerts page. Level 3 = spill level.

// Colours for each level (dashboards, gauges, charts)
export const FLOOD_LEVELS = [
  { id: 0, label: 'All Clear',        color: '#2f9463', soft: '#e5f6ec', border: '#bfe6cf' },
  { id: 1, label: 'Advisory',         color: '#2b6e8f', soft: '#e6f2f8', border: '#bfdbe8' },
  { id: 2, label: 'Watch Closely',    color: '#e69138', soft: '#fdf1de', border: '#f4d6a4' },
  { id: 3, label: 'SPILL · EVACUATE', color: '#e0522f', soft: '#fce7e0', border: '#f2bfab' },
];

// Which level a water height is at. Thresholds come with each board (every board has its own);
// the defaults are the manuscript values.
export function getFloodLevel(waterM, t = {}) {
  const l1 = t?.level1_watch ?? 1.2;
  const l2 = t?.level2_alarm ?? 1.6;
  const l3 = t?.level3_danger ?? 2.0;
  if (waterM < l1) return { ...FLOOD_LEVELS[0], min: 0, max: l1 };
  if (waterM < l2) return { ...FLOOD_LEVELS[1], min: l1, max: l2 };
  if (waterM < l3) return { ...FLOOD_LEVELS[2], min: l2, max: l3 };
  return { ...FLOOD_LEVELS[3], min: l3, max: 2.4 };
}

// Small coloured tags used in the staff console (status of a station, level of an alert)
export const LEVEL_TAG = {
  0: { name: 'Normal',   style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  1: { name: 'Advisory', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  2: { name: 'Warning',  style: 'bg-amber-50 text-amber-800 border-amber-200' },
  3: { name: 'Spill',    style: 'bg-red-50 text-red-700 border-red-200' },
};
export const OFF_TAG = { name: 'Off', style: 'bg-gray-100 text-gray-600 border-gray-200' };

// Clock time N minutes from now in Philippine time, e.g. "7:45 PM" (chart labels)
export function formatTimeOffset(minutesOffset = 0) {
  const d = new Date(Date.now() + minutesOffset * 60000);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}
