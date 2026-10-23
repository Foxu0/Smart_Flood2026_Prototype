import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle, Bell, CheckCircle2, Info, MapPin, Volume2, VolumeX, Zap, Timer, TrendingUp,
} from 'lucide-react';
import FloodHeatMap from '../components/dashboard/FloodHeatMap.jsx';
import WaterTankGauge from '../components/WaterTankGauge.jsx';
import ToastContainer, { useToast } from '../components/ToastNotification.jsx';
import SkeletonDashboard from '../components/SkeletonDashboard.jsx';
import useCountUp from '../hooks/useCountUp.js';
import { API_BASE_URL, WS_BASE_URL } from '../config.js';
import { getFloodLevel } from '../lib/floodLevels.js';
import { WaterLevelSparkline, AiForecastSparkline } from '../components/dashboard/Sparklines.jsx';


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
          'Continuous automated monitoring of the water level is active.',
          'No emergency alerts or manual overrides required at this time.',
        ],
      };
    case 1:
      return {
        badge: 'Keep an Eye Out', icon: Info,
        heroTitle: 'Water Level Rising',
        heroMsg: 'The river is rising. The water level is slightly elevated but remains within monitored advisory limits.',
        adviceTitle: 'Operational Readiness',
        advice: [
          'Verify telemetry stream continuity and battery supply voltages.',
          'Keep watching the water level trend closely.',
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
        badge: 'SPILL · EVACUATE', icon: AlertTriangle,
        heroTitle: 'Spill Level Reached',
        heroMsg: `Water has reached the spill level (${telemetry.waterLevelM.toFixed(2)} m) and may overflow the riverbank. Evacuation protocols in effect.`,
        adviceTitle: 'Immediate Emergency Directives',
        advice: [
          'Sound emergency siren if not already activated.',
          'Coordinate emergency evacuation routes with Antipolo CDRRMO EOC.',
          'Issue mandatory high-ground evacuation broadcast.',
        ],
      };
  }
}

// ─── JarGauge replaced by WaterTankGauge (imported above) ───────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Time Offset Helper ──────────────────────────────────────────────────────

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
          {detailLine1 && <p className="text-[11px] text-[#6d818d] leading-tight">{detailLine1}</p>}
          {detailLine2 && <p className="text-[11px] text-[#6d818d] leading-tight mt-0.5">{detailLine2}</p>}
        </div>

        {/* Right: Chart or Vitals */}
        <div className="min-w-0 flex-1">
          {variant === 'water' && (
            <WaterLevelSparkline history={history} currentLevel={validNum} color={color} />
          )}
          {variant === 'ai' && (
            <AiForecastSparkline currentM={currentLevel} p30M={predicted30m} p60M={predicted60m} color={color} />
          )}
        </div>
      </div>
    </div>
  );
}


// nodeId: show one board only (each board has its own readings, forecast and thresholds)
export default function FloodMonitoringDashboard({ nodeId = null }) {
  const forBoard = (sep) => (nodeId ? `${sep}nodeId=${nodeId}` : '');
  const otherBoard = (d) => nodeId != null && d?.nodeId != null && Number(d.nodeId) !== Number(nodeId);
  const { toasts, pushToast, dismissToast } = useToast();

  const [sirenActive, setSirenActive] = useState(false);

  const [telemetry, setTelemetry] = useState({
    waterLevelM: 0.00,
    waterDistanceCm: 240,
    wifiRssi: -65,
    gridVoltage: 12.2,
    espUptime: '00:00:00',
  });

  const [aiPrediction, setAiPrediction] = useState({
    predicted30m: 0.00,
    predicted60m: 0.00,
    methodLabel: 'Loading…', testScores: null,
  });

  const [thresholds, setThresholds] = useState({
    level1_watch: 1.20,
    level2_alarm: 1.60,
    level3_danger: 2.00,
  });



  // Poll latest telemetry from GET /api/v1/telemetry/latest every 3s
  useEffect(() => {
    async function fetchLatest() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/latest${forBoard('?')}`);
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
          // Thresholds of the board that sent this reading (each board has its own)
          if (d.thresholds) setThresholds(d.thresholds);
          fetchHistory();
        } else if (json.success && json.data === null) {
          // Empty database — reset to 0.00m / 0 mm/h
          setTelemetry({
            waterLevelM: 0.00,
            waterDistanceCm: 240,
            wifiRssi: -65,
            gridVoltage: 12.2,
            espUptime: '00:00:00',
          });
          setAiPrediction(prev => ({
            ...prev,
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

  const [timeFrame, setTimeFrame] = useState('1h');

  // Real Database History State
  const [dbHistory, setDbHistory] = useState([]);

  // Fetch real PostgreSQL telemetry logs from GET /api/v1/telemetry/history
  const fetchHistory = useCallback(async () => {
    try {
      const rangeParam = timeFrame;

      const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/history?range=${rangeParam}${forBoard('&')}`);
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
    }
  }, [timeFrame]);

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
        const res = await fetch(`${API_BASE_URL}/api/v1/events?limit=10${forBoard('&')}`);
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
        const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/projection${forBoard('?')}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
          const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
          setAiPrediction(prev => ({
            ...prev,
            predicted30m: Number.isNaN(p30) ? 0.00 : p30,
            predicted60m: Number.isNaN(p60) ? 0.00 : p60,
            methodLabel: p.methodLabel ?? prev.methodLabel, testScores: p.testScores ?? prev.testScores,
          }));
        }
      } catch (err) {
        console.error('[Load Projection Error]', err);
      }
    }
    loadProjection();
  }, []);

  // ── Real-Time WebSocket Connection ─────────────────────────────────────────

  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connectWS = () => {
      ws = new WebSocket(WS_BASE_URL);

      ws.onopen = () => {
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (otherBoard(message.data)) return; // reading from a different board
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

            fetchHistory();
          } else if (message.type === 'PROJECTION' && message.data) {
            const p = message.data;
            const p30 = parseFloat(p.horizon30mM ?? p.predicted30m ?? p.horizon_30m_m ?? 0.00);
            const p60 = parseFloat(p.horizon60mM ?? p.predicted60m ?? p.horizon_60m_m ?? 0.00);
            setAiPrediction(prev => ({
              ...prev,
              predicted30m: Number.isNaN(p30) ? 0.00 : p30,
              predicted60m: Number.isNaN(p60) ? 0.00 : p60,
              methodLabel: p.methodLabel ?? prev.methodLabel, testScores: p.testScores ?? prev.testScores,
            }));
          } else if (message.type === 'EVENT' && message.data) {
            const ev = message.data;
            addLog(ev.severity === 'WARNING' || ev.severity === 'CRITICAL' ? 'alarm' : 'notice', ev.message);
          } else if (message.type === 'SIREN_CONTROL' && message.data) {
            const { sirenState } = message.data;
            if (sirenState === 'ON' || sirenState === 'TEST') {
              setSirenActive(true);
            }
            if (sirenState === 'MUTED') {
              setSirenActive(false);
            }
            if (sirenState === 'OFF') {
              setSirenActive(false);
            }
          }
        } catch (e) {
          console.error('[WS Error]', e);
        }
      };

      ws.onclose = () => {
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
      addLog('override', 'MUTE ALARM: Operator silenced acoustic siren (Manual Override active).');
      sendSirenControl('MUTE');
    } else {
      setSirenActive(true);
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

  // ── Toast when flood level rises ─────────────────────────────────────────
  const prevLevelIdRef = useRef(floodLevel.id);
  useEffect(() => {
    if (floodLevel.id > prevLevelIdRef.current) {
      const msgs = [
        '',
        'Water level has entered WATCH range (>1.2 m). Stay alert.',
        'Water is rising fast — now in ALARM range (>1.6 m). Prepare to act.',
        'SPILL LEVEL reached: water may overflow the riverbank. Move to higher ground immediately!',
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


  const logStyle = (type) => ({
    alarm: { badge: 'bg-[#fce7e0] text-[#e0522f] border border-[#f2bfab]', dot: '#e0522f' },
    override: { badge: 'bg-[#eee7fb] text-[#6b4fbf] border border-[#d9c9f5]', dot: '#6b4fbf' },
    weather: { badge: 'bg-[#e6f2f8] text-[#2b6e8f] border border-[#bfdbe8]', dot: '#2b6e8f' },
    notice: { badge: 'bg-[#fdf1de] text-[#e69138] border border-[#f4d6a4]', dot: '#e69138' },
    system: { badge: 'bg-[#f1f5f2] text-[#6d818d] border border-[#dbe4de]', dot: '#6d818d' },
  }[type] || { badge: 'bg-gray-100 text-gray-600', dot: '#6d818d' });


  const surgeDelta = +(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2);
  const surgeRateText = surgeDelta > 0.01 ? `+${surgeDelta.toFixed(2)} m/h` : '0.00 m/h (Steady)';

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
    <div className="w-full font-sans text-[#3f5361] px-4 sm:px-6 lg:px-8 py-4 flex flex-col items-center">

      <div className="w-full max-w-7xl">

        {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          {/* LEFT COLUMN: Current Status, Water Level Gauge, Metrics, Graphs, & Logs (7/12 width) */}
          <div className="lg:col-span-7 min-w-0 w-full flex flex-col justify-start space-y-4">

            {/* ── HERO STATUS CARD ────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[24px] border shadow-sm p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center card-enter card-enter-d1"
              style={{ background: `linear-gradient(135deg, ${floodLevel.soft}, #ffffff 70%)`, borderColor: floodLevel.border }}>
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
                    {[{ id: '1h', label: '1h' }, { id: '6h', label: '6h' }, { id: '24h', label: '24h' }].map(({ id, label }) => (
                      <button key={id}
                        onClick={() => setTimeFrame(id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                          timeFrame === id ? 'bg-white text-[#2b6e8f] shadow-sm' : 'text-[#6d818d] hover:text-[#123a54]'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2: AI 30 & 60 Minute Forecast */}
              <AnimatedStatCard
                icon={TrendingUp}
                label="Forecast"
                badge={aiPrediction.methodLabel}
                value={`${aiPrediction.predicted30m.toFixed(2)} m`}
                numericValue={aiPrediction.predicted30m}
                decimals={2}
                trendText={`+${(aiPrediction.predicted30m - telemetry.waterLevelM).toFixed(2)} m delta`}
                sub={`+60 min: ${aiPrediction.predicted60m.toFixed(2)} m`}
                detailLine1="Based on the last hour of readings"
                color="#e69138"
                tooltip="Expected water level in 30 and 60 minutes, based on how the river changed in the last hour"
                delay={3}
                variant="ai"
                currentLevel={telemetry.waterLevelM}
                predicted30m={aiPrediction.predicted30m}
                predicted60m={aiPrediction.predicted60m}
              />

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

          {/* RIGHT COLUMN: Flood map & siren (5/12 width) */}
          <div className="lg:col-span-5 min-w-0 w-full flex flex-col gap-4">

            {/* Flood heat map: every station's level, this station highlighted */}
            <FloodHeatMap highlightId={nodeId} />

            {/* ── SYSTEM CONTROLS & ALERTS CARD ─────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-5">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#f1f5f6] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#123a54] leading-tight">Station siren</h2>
                </div>
              </div>

              <div className="space-y-2.5">

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

              </div>
            </div>

          </div>
        </main>


      </div>
    </div>



    {/* ── TOAST NOTIFICATIONS (portal, fixed bottom-right) ─────────────── */}
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
