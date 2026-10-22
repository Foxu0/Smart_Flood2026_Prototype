import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { Map as MapIcon } from 'lucide-react';
import { API_BASE_URL } from '../../config.js';
import { FLOOD_LEVELS } from '../../lib/floodLevels.js';

/**
 * Flood heat map: a glow at every station, coloured by its current flood level
 * (green Normal, blue Advisory, amber Warning, red Spill; grey = off or no data yet).
 * Uses only Smart Flood's own sensor readings, refreshed every 30 seconds.
 */
const NAMES = ['Normal', 'Advisory', 'Warning', 'Spill'];
const GREY = '#94a3b8';
const ANTIPOLO = [14.5869, 121.1754];

const colorOf = (s) => (s.off || s.level == null ? GREY : FLOOD_LEVELS[s.level].color);
const statusOf = (s) => (s.off ? 'Turned off' : s.level == null ? 'No data yet' : NAMES[s.level]);

function timeAgo(v) {
  if (!v) return '';
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : new Date(v).toLocaleDateString('en-PH', { dateStyle: 'medium' });
}

// Fit the map around the stations (or the highlighted one) when they first load
function FitToStations({ stations, highlight }) {
  const map = useMap();
  const key = stations.map((s) => s.id).join(',') + '|' + (highlight ?? '');
  useEffect(() => {
    const target = stations.find((s) => s.id === highlight);
    if (target) map.setView([target.latitude, target.longitude], 13, { animate: true });
    else if (stations.length === 1) map.setView([stations[0].latitude, stations[0].longitude], 14);
    else if (stations.length > 1) map.fitBounds(stations.map((s) => [s.latitude, s.longitude]), { padding: [40, 40], maxZoom: 14 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function FloodHeatMap({ highlightId = null, height = 320, title = 'Flood map' }) {
  const [stations, setStations] = useState([]);

  useEffect(() => {
    const load = () => fetch(`${API_BASE_URL}/api/v1/telemetry/stations`)
      .then((r) => r.json())
      .then((j) => setStations((j.data || []).filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))))
      .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Draw the worst level last so it sits on top
  const ordered = useMemo(() => [...stations].sort((a, b) => (a.level ?? -1) - (b.level ?? -1)), [stations]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 min-w-0 w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#2b6e8f]/10 text-[#2b6e8f] flex items-center justify-center">
          <MapIcon size={15} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#123a54] leading-tight">{title}</h3>
          <p className="text-[11px] text-[#6d818d]">Live water level at each station. Tap a circle for details.</p>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-[#e4edf0]" style={{ height }}>
        <MapContainer center={ANTIPOLO} zoom={13} minZoom={11} maxZoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          {/* Light grey base map + place names (Esri, no API key needed) */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={16}
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxZoom={16}
          />
          <FitToStations stations={stations} highlight={highlightId} />
          {ordered.map((s) => {
            const c = colorOf(s);
            const strong = s.level != null && !s.off;
            return (
              <React.Fragment key={s.id}>
                {/* Heat glow (same size on screen at any zoom): wide and faint → small and strong,
                    bigger for higher levels so a rising station stands out */}
                <CircleMarker center={[s.latitude, s.longitude]} radius={26 + (s.level ?? 0) * 8} interactive={false}
                  pathOptions={{ stroke: false, fillColor: c, fillOpacity: strong ? 0.14 : 0.08 }} />
                <CircleMarker center={[s.latitude, s.longitude]} radius={16 + (s.level ?? 0) * 5} interactive={false}
                  pathOptions={{ stroke: false, fillColor: c, fillOpacity: strong ? 0.26 : 0.14 }} />
                <CircleMarker
                  center={[s.latitude, s.longitude]}
                  radius={s.id === highlightId ? 9 : 7}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: c, fillOpacity: 1 }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    <div className="text-xs">
                      <b>{s.barangay}</b> · {statusOf(s)}<br />
                      {s.name}<br />
                      {s.waterLevelM != null ? `${Number(s.waterLevelM).toFixed(2)} m (spill at ${Number(s.spillAtM).toFixed(2)} m)` : 'No readings yet'}
                      {s.recordedAt ? <><br />Updated {timeAgo(s.recordedAt)}</> : null}
                    </div>
                  </Tooltip>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>
        {stations.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 text-sm text-[#6d818d]">No stations yet.</div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#3f5361]">
        {NAMES.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: FLOOD_LEVELS[i].color }} /> {n}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: GREY }} /> Off / no data
        </span>
      </div>
    </div>
  );
}
