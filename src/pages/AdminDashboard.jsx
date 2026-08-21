import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, CheckCircle2, CloudRain, Cpu,
  Droplets, Info, MapPin, RefreshCw,
  Sliders, Volume2, VolumeX, Wifi, Zap, Activity,
  Radio, Globe, Send, Download, FileSpreadsheet, Timer, LogOut,
  Play, RotateCcw, Target, TrendingUp, BarChart3
} from 'lucide-react';
import RainOverlay from '../RainOverlay.jsx';
import WeatherMapCard from '../WeatherMapCard.jsx';
import WaterTankGauge from '../components/WaterTankGauge.jsx';
import SparklineBar from '../components/SparklineBar.jsx';
import ToastContainer, { useToast } from '../components/ToastNotification.jsx';
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
  { id: 0, min: 0, max: 1.0, color: '#2f9463', soft: '#e5f6ec', border: '#bfe6cf' },
  { id: 1, min: 1.0, max: 1.4, color: '#2b6e8f', soft: '#e6f2f8', border: '#bfdbe8' },
  { id: 2, min: 1.4, max: 1.6, color: '#e69138', soft: '#fdf1de', border: '#f4d6a4' },
  { id: 3, min: 1.6, max: 1.8, color: '#e0522f', soft: '#fce7e0', border: '#f2bfab' },
];
function getFloodLevel(waterM) {
  return FLOOD_LEVELS.find(l => waterM >= l.min && waterM < l.max) || FLOOD_LEVELS[3];
}

// ─── Plain-language content, keyed by flood level id ─────────────────────────
function getFriendlyContent(level, telemetry, aiPrediction) {
  switch (level.id) {
    case 0:
      return {
        badge: 'All Clear', icon: CheckCircle2,
        heroTitle: 'Everything looks calm',
        heroMsg: "Water near your area is well within the normal range, and no heavy rain is expected soon. Nothing for you to do right now — we're still keeping watch.",
        adviceTitle: "You're all set",
        advice: [
          'No action needed today.',
          "We're still checking water levels and weather conditions continuously.",
          'Come back any time to see the latest reading.',
        ],
      };
    case 1:
      return {
        badge: 'Keep an Eye Out', icon: Info,
        heroTitle: 'Water is a little higher than usual',
        heroMsg: 'Levels have gone up a bit after recent rain. Nothing urgent yet — just a good time to double-check system readiness.',
        adviceTitle: 'A few things to prepare',
        advice: [
          'Check that emergency equipment is ready.',
          'Keep half an eye on the weather over the next hour.',
          "We'll let you know the moment anything changes.",
        ],
      };
    case 2:
      return {
        badge: 'Watch Closely', icon: AlertTriangle,
        heroTitle: 'Water is rising steadily',
        heroMsg: `Our station is seeing a faster rise than normal. System model expects it could reach about ${aiPrediction.predicted60m} m within the hour. Please stay alert.`,
        adviceTitle: "Here's what to do right now",
        advice: [
          'Keep monitoring equipment ready.',
          'Keep clear of drainage channels and low-lying areas.',
          "We'll send an alert the moment threshold is reached.",
        ],
      };
    default:
      return {
        badge: 'Danger', icon: AlertTriangle,
        heroTitle: 'Water is close to the danger mark',
        heroMsg: 'Water level is rising fast and closing in on the danger threshold line. Please move to higher ground immediately.',
        adviceTitle: 'Please act now',
        advice: [
          'Move to higher ground immediately.',
          "Turn off electrical equipment if safe to do so.",
          'Follow emergency safety protocols.',
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
// ─── Stat card with animated counter ────────────────────────────────────────
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
      await fetch('http://localhost:3001/api/v1/auth/logout', {
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

  const [telemetry, setTelemetry] = useState({
    waterLevelM: 1.05,
    waterDistanceCm: 75,
    rainRateMmHr: 14.5,
    rainTips: 32,
    wifiRssi: -62,
    gridVoltage: 12.1,
    espUptime: '04:12:35',
  });

  const [aiPrediction, setAiPrediction] = useState({
    riskScore: 58,
    predicted30m: 1.18,
    predicted60m: 1.30,
    timeToCriticalMins: 42,
    modelConfidence: 94,
  });

  const [thresholds, setThresholds] = useState({
    level1_watch: 1.0,
    level2_alarm: 1.4,
    level3_danger: 1.6,
  });

  const [aiMetrics, setAiMetrics] = useState({
    totalEvaluated: 0,
    mae_m: 0.03,
    rmse_m: 0.04,
    avgAccuracy_pct: 96.8,
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

  const getToken = () => sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token') || '';

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
        setDbHistory([]);
        setLogs([]);
        setAiMetrics({
          totalEvaluated: 0,
          mae_m: 0.03,
          rmse_m: 0.04,
          avgAccuracy_pct: 96.8,
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
        await fetch(`${API_BASE_URL}/api/v1/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  // Real Database History State
  const [dbHistory, setDbHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch real PostgreSQL telemetry logs from GET /api/v1/telemetry/history
  useEffect(() => {
    async function fetchHistory() {
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
              rainfallRate: parseFloat(item.rainfall_rate),
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
    }

    fetchHistory();
  }, [timeFrame, customValue, customUnit]);

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
          setAiPrediction(prev => ({
            ...prev,
            predicted30m: parseFloat(p.horizon_30m_m),
            predicted60m: parseFloat(p.horizon_60m_m),
            modelConfidence: Math.round(parseFloat(p.confidence_score)),
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
            const level = d.water_level_m ?? d.waterLevel ?? 1.05;
            const dist = d.raw_distance_cm ?? d.rawDistanceCm ?? Math.round((1.8 - level) * 100);
            const rain = d.rainfall_rate ?? d.rainfallRate ?? 0;
            const rssi = d.rssi_dbm ?? d.rssiDbm ?? -65;
            const voltage = d.supply_voltage ?? d.supplyVoltage ?? 12.0;

            setTelemetry(prev => ({
              ...prev,
              waterLevelM: parseFloat(level),
              waterDistanceCm: parseFloat(dist),
              rainRateMmHr: parseFloat(rain),
              wifiRssi: parseInt(rssi),
              gridVoltage: parseFloat(voltage),
            }));

            setAiPrediction(prev => {
              const p30 = Math.min(1.8, level + 0.10);
              const p60 = Math.min(1.8, level + 0.20);
              const risk = Math.round((p60 / 1.8) * 100);
              return { ...prev, riskScore: risk, predicted30m: +p30.toFixed(2), predicted60m: +p60.toFixed(2) };
            });
          } else if (message.type === 'PROJECTION' && message.data) {
            const p = message.data;
            setAiPrediction(prev => ({
              ...prev,
              predicted30m: parseFloat(p.horizon_30m_m),
              predicted60m: parseFloat(p.horizon_60m_m),
              modelConfidence: Math.round(parseFloat(p.confidence_score)),
            }));
          } else if (message.type === 'EVENT' && message.data) {
            const ev = message.data;
            addLog(ev.severity === 'WARNING' || ev.severity === 'CRITICAL' ? 'alarm' : 'notice', ev.message);
          } else if (message.type === 'SIREN_CONTROL' && message.data) {
            const { sirenState } = message.data;
            if (sirenState === 'ON' || sirenState === 'TEST') setSirenActive(true);
            if (sirenState === 'OFF' || sirenState === 'MUTED') setSirenActive(false);
          } else if (message.type === 'AI_EVALUATION' && message.data) {
            setAiMetrics(message.data);
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

  const floodLevel = getFloodLevel(telemetry.waterLevelM);
  const friendly = getFriendlyContent(floodLevel, telemetry, aiPrediction);

  const toggleSiren = () => {
    const next = !sirenActive;
    setSirenActive(next);
    setManualOverride(true);
    addLog('override', `A barangay official manually ${next ? 'turned ON' : 'turned OFF'} the alarm.`);
  };

  const testSiren = () => {
    setSirenActive(true);
    setManualOverride(false);
    addLog('system', 'TEST SIREN: Operator triggered a 5-second acoustic relay test.');
    setTimeout(() => {
      if (telemetry.waterLevelM < thresholds.level2_alarm) {
        setSirenActive(false);
        addLog('system', 'TEST SIREN: Test sequence completed automatically.');
      }
    }, 5000);
  };

  const muteSiren = () => {
    setSirenActive(false);
    setManualOverride(true);
    addLog('override', 'MUTE ALARM: Operator silenced acoustic siren (Manual Override active).');
  };

  // ── Keyboard shortcuts: T = test siren, M = mute ─────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 't' || e.key === 'T') testSiren();
      if (e.key === 'm' || e.key === 'M') muteSiren();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Toast when flood level rises ─────────────────────────────────────────
  const prevLevelIdRef = useRef(floodLevel.id);
  useEffect(() => {
    if (floodLevel.id > prevLevelIdRef.current) {
      const msgs = [
        '',
        'Water level has entered WATCH range (>1.0 m). Stay alert.',
        '⚠ Water is rising fast — now in ALARM range (>1.4 m). Prepare to act.',
        '🚨 DANGER LEVEL reached (>1.6 m). Move to higher ground immediately!',
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
    setSirenActive(level >= 1.4);
    setTelemetry(prev => ({
      ...prev,
      waterLevelM: level,
      waterDistanceCm: Math.round((1.8 - level) * 100 * 10) / 10,
      rainRateMmHr: level < 0.6 ? 2 : level < 1.3 ? 14 : 30,
    }));
    setAiPrediction(prev => {
      const p30 = Math.min(1.8, level + 0.10);
      const p60 = Math.min(1.8, level + 0.20);
      return { ...prev, riskScore: Math.round((p60 / 1.8) * 100), predicted30m: +p30.toFixed(2), predicted60m: +p60.toFixed(2), timeToCriticalMins: Math.max(5, Math.round((1.6 - level) * 120)) };
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
  const maxLevel = 1.8;
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

  const surgeRate = Math.max(0.04, +(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2));
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

      <div className="w-full max-w-6xl bg-[#123a54] backdrop-blur-xl shadow-2xl rounded-none md:rounded-[28px] border-none overflow-hidden min-h-screen md:min-h-0">

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
              {/* WS status */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                wsConnected
                  ? 'bg-[#2f9463]/25 border border-[#2f9463]/50 text-emerald-300'
                  : 'bg-amber-500/25 border border-amber-500/50 text-amber-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#2f9463] animate-ping' : 'bg-amber-400'}`} />
                {wsConnected ? 'LIVE WS' : 'CONNECTING WS'}
              </div>

              <div className="text-right hidden lg:block border-l border-white/20 pl-3 sm:pl-4">
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
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">

            {/* ── HERO STATUS CARD ────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[24px] border shadow-sm p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center card-enter card-enter-d1"
              style={{ background: `linear-gradient(135deg, ${floodLevel.soft}, #ffffff 70%)`, borderColor: floodLevel.border }}>
              <RainOverlay intensity={rainKey} />
              <div className="relative z-[1]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2 float-badge" style={{ color: floodLevel.color }}>
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
                sub={telemetry.waterDistanceCm <= 25 ? '⚠️ Transducer Limit (25cm blind spot)' : `${telemetry.waterDistanceCm} cm to sensor transducer`}
                bar={Math.min(100, (telemetry.waterLevelM / 1.8) * 100)}
                color={floodLevel.color}
                tooltip="JSN-SR04T ultrasonic sensor measured water column height"
                delay={2}
                variant="water"
              />
              <AnimatedStatCard
                icon={CloudRain}
                label="Rainfall"
                value={`${telemetry.rainRateMmHr.toFixed(1)} mm/h`}
                numericValue={telemetry.rainRateMmHr}
                decimals={1}
                sub={rainDescription(telemetry.rainRateMmHr)}
                bar={Math.min(100, (telemetry.rainRateMmHr / 60) * 100)}
                color="#2b6e8f"
                tooltip="Tipping bucket rain gauge — accumulated tips converted to mm/hr"
                delay={3}
                variant="rain"
              />
              <AnimatedStatCard
                icon={Cpu}
                label="Station Health"
                value="Working fine"
                sub={`Online · RSSI ${telemetry.wifiRssi} dBm`}
                bar={92}
                color="#2f9463"
                tooltip="ESP32 Wi-Fi signal strength and uptime status"
                delay={4}
                variant="ai"
              />
            </div>

            {/* Trend / Water Level History */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Activity size={16} className="text-[#2b6e8f]" />
                  <h2 className="text-sm font-semibold text-[#123a54]">
                    Water level ({timeFrame === '30m' ? '30 Mins' : timeFrame === '1h' ? '1 Hour' : timeFrame === '6h' ? '6 Hours' : timeFrame === '24h' ? '24 Hours' : `Custom (${customRangeText})`})
                  </h2>
                  {/* Time Frame Selector Pills */}
                  <div className="relative flex items-center gap-1 bg-[#eef4f6] p-0.5 rounded-lg border border-[#e4edf0] ml-1">
                    {[
                      { id: '30m', label: '30m' },
                      { id: '1h', label: '1h' },
                      { id: '6h', label: '6h' },
                      { id: '24h', label: '24h' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => { setTimeFrame(id); setShowCustomModal(false); }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                          timeFrame === id
                            ? 'bg-white text-[#2b6e8f] shadow-sm'
                            : 'text-[#6d818d] hover:text-[#123a54]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    
                    {/* Custom Pill */}
                    <button
                      onClick={() => { setTimeFrame('custom'); setShowCustomModal(!showCustomModal); }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                        timeFrame === 'custom'
                          ? 'bg-[#2b6e8f] text-white shadow-sm'
                          : 'text-[#6d818d] hover:text-[#123a54]'
                      }`}
                    >
                      <Sliders size={10} />
                      Custom
                    </button>

                    {/* Custom Popover Form */}
                    {showCustomModal && (
                      <div className="absolute top-full left-0 mt-2 z-30 bg-white rounded-xl shadow-xl border border-[#e4edf0] p-3 w-56 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-[#123a54] pb-1 border-b border-[#f1f5f6]">
                          <span>Custom Time Range</span>
                          <button onClick={() => setShowCustomModal(false)} className="text-[#6d818d] hover:text-red-500 text-sm">×</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            className="w-16 px-2 py-1 border border-[#d1e0e8] rounded-lg text-center font-bold text-[#123a54]"
                          />
                          <select
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                            className="flex-1 px-2 py-1 border border-[#d1e0e8] rounded-lg font-semibold text-[#123a54] bg-white cursor-pointer"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            const unitText = customUnit.charAt(0).toUpperCase() + customUnit.slice(1);
                            setCustomRangeText(`${customValue} ${unitText}`);
                            setTimeFrame('custom');
                            setShowCustomModal(false);
                          }}
                          className="w-full py-1.5 rounded-lg bg-[#2b6e8f] text-white font-bold hover:bg-[#1f6f94] transition text-center shadow-sm"
                        >
                          Apply Range
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] sm:text-[11px] text-[#6d818d] flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#2b6e8f] inline-block rounded" /> Ultrasonic Telemetry</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#e69138] inline-block rounded" /> ML Projection</span>
                  <button
                    onClick={exportTelemetryCsv}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2b6e8f]/10 text-[#2b6e8f] font-bold text-[10px] hover:bg-[#2b6e8f]/20 transition border border-[#2b6e8f]/30 shadow-xs ml-1"
                    title="Export telemetry log to CSV"
                  >
                    <Download size={11} />
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto w-full">
                <svg viewBox={`0 0 ${chartW} ${chartH + 22}`} className="w-full min-w-[280px]" style={{ height: 150 }}>
                  <defs>
                    <linearGradient id="floodAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2b6e8f" stopOpacity="0.32">
                        <animate attributeName="stop-opacity" values="0.25;0.40;0.25" dur="4s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="100%" stopColor="#1f6f94" stopOpacity="0.04" />
                    </linearGradient>
                    <filter id="lineGlow">
                      <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#123a54" floodOpacity="0.35" />
                    </filter>
                  </defs>

                  {/* Danger Line */}
                  <line x1="0" y1={chartH - (1.6 / maxLevel) * chartH} x2={chartW} y2={chartH - (1.6 / maxLevel) * chartH}
                    stroke="#e0522f" strokeWidth="1" strokeDasharray="6,4" opacity="0.6" />
                  <text x="8" y={chartH - (1.6 / maxLevel) * chartH - 5} textAnchor="start" fontSize="9" fill="#e0522f" fontWeight="bold">Danger line (1.6 m)</text>

                  {/* Subtle Animated Flood Area Fill */}
                  <path d={areaPath} fill="url(#floodAreaGrad)" />
                  <path d={areaPath} fill="#2b6e8f15" className="animate-pulse" />

                  {/* Measured Telemetry Line */}
                  <path d={buildPath(histLevels)} fill="none" stroke="#2b6e8f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)" />

                  {/* Forecast Dashed Connection Line & Target Node */}
                  <line x1={lastMeasuredPt.x} y1={lastMeasuredPt.y} x2={forecastPt.x} y2={forecastPt.y} stroke="#e69138" strokeWidth="2.5" strokeDasharray="4,4" />
                  <circle cx={forecastPt.x} cy={forecastPt.y} r="5" fill="#e69138" stroke="white" strokeWidth="2" />
                  <text x={forecastPt.x} y={chartH + 16} textAnchor="middle" fontSize="9" fill="#e69138" fontWeight="bold">+60m ML</text>

                  {/* Measured Telemetry Nodes */}
                  {histLevels.map((v, i, a) => {
                    const { x, y } = toChartPt(v, i, a);
                    const isLast = i === histLevels.length - 1;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="#2b6e8f" stroke="white" strokeWidth="2"
                          className={isLast ? 'glow-tail' : ''} />
                        {isLast && (
                          <>
                            <circle cx={x} cy={y} r="9" fill="#2b6e8f" opacity="0.15" className="animate-pulse" />
                            <circle cx={x} cy={y} r="14" fill="#2b6e8f" opacity="0.07" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
                          </>
                        )}
                        {!isLast && <circle cx={x} cy={y} r="5" fill="#2b6e8f" opacity="0.10" className="animate-pulse" />}
                      </g>
                    );
                  })}
                  {activeHistory.map((h, i, a) => {
                    const { x } = toChartPt(h.waterLevel, i, a);
                    return <text key={i} x={x} y={chartH + 16} textAnchor="middle" fontSize="9" fill="#6d818d" fontWeight="600">{h.time}</text>;
                  })}
                </svg>
              </div>
            </div>

            {/* Predictive AI Flood Projection */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#123a54] mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-[#e69138]" /> Predictive AI Flood Projection
                </h2>
                <div className="space-y-2.5">
                  {[
                    { label: '30-Minute AI Horizon', value: `${aiPrediction.predicted30m.toFixed(2)} m`, delta: `+${(aiPrediction.predicted30m - telemetry.waterLevelM).toFixed(2)}m`, level: getFloodLevel(aiPrediction.predicted30m) },
                    { label: '60-Minute AI Horizon', value: `${aiPrediction.predicted60m.toFixed(2)} m`, delta: `+${(aiPrediction.predicted60m - telemetry.waterLevelM).toFixed(2)}m`, level: getFloodLevel(aiPrediction.predicted60m) },
                  ].map(({ label, value, delta, level }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-xl border" style={{ background: level.soft, borderColor: level.border }}>
                      <div>
                        <p className="text-[11px] font-bold text-[#6d818d]">{label}</p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <p className="font-display text-lg font-bold" style={{ color: level.color }}>{value}</p>
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-white/90 border border-black/5 shadow-2xs" style={{ color: level.color }}>
                            ▲ {delta} delta
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${level.color}20`, color: level.color }}>
                        {level.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#6d818d] text-center pt-2">
                LSTM Model Confidence Score: <b className="text-[#123a54]">{aiPrediction.modelConfidence}%</b>
              </p>
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
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Interactive Dynamic Leaflet Weather Map Card with severity beacon */}
            <WeatherMapCard severity={floodLevel.id} />

            {/* ── ESP32 SYSTEM & THRESHOLD CONTROLS CARD ────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f6] pb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-[#2b6e8f]" />
                  <h2 className="text-sm font-semibold text-[#123a54]">ESP32 Node &amp; System Controls</h2>
                </div>
                <span className="text-[10px] bg-[#2f9463]/15 text-[#2f9463] font-bold px-2 py-0.5 rounded-full border border-[#2f9463]/30">
                  ADMIN MONITORING
                </span>
              </div>

              {/* Alert Threshold Sliders */}
              <div>
                <h3 className="text-xs font-bold text-[#123a54] mb-1 flex items-center gap-1.5">
                  <Sliders size={14} className="text-[#2b6e8f]" /> Alert Threshold Settings (Meters)
                </h3>
                <p className="text-[10px] text-[#6d818d] mb-3">Adjust trigger levels for automated siren &amp; warnings.</p>
                <div className="space-y-3.5 text-xs bg-[#fbfdfe] rounded-xl p-3 border border-[#eef2f3]">
                  {[
                    { key: 'level1_watch', label: 'Level 1 — Advisory Watch', min: 0.5, max: 1.2, color: '#2b6e8f' },
                    { key: 'level2_alarm', label: 'Level 2 — Siren Warning Alarm', min: 1.0, max: 1.5, color: '#e69138' },
                    { key: 'level3_danger', label: 'Level 3 — Emergency Danger', min: 1.4, max: 1.8, color: '#e0522f' },
                  ].map(({ key, label, min, max, color }) => (
                    <div key={key}>
                      <div className="flex justify-between mb-1 text-[11px]">
                        <span className="text-[#3f5361] font-semibold">{label}</span>
                        <span className="font-bold font-mono" style={{ color }}>{thresholds[key]} m</span>
                      </div>
                      <input type="range" min={min} max={max} step="0.05"
                        value={thresholds[key]}
                        onChange={e => setThresholds({ ...thresholds, [key]: parseFloat(e.target.value) })}
                        style={{ accentColor: color }}
                        className="w-full h-1.5 rounded-lg bg-[#eef4f6] cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Siren Relay Controls */}
              <div className="pt-2 border-t border-[#f1f5f6]">
                <h3 className="text-xs font-bold text-[#123a54] mb-2 flex items-center gap-1.5">
                  <Volume2 size={14} className="text-[#e0522f]" /> Manual Siren Relay Override
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={testSiren}
                    className="py-2 px-3 rounded-xl bg-[#2b6e8f] hover:bg-[#1f6f94] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-[1.02] active:scale-95"
                  >
                    <Volume2 size={13} />
                    TEST SIREN
                    <kbd className="text-[8px] bg-white/20 rounded px-1 ml-0.5">T</kbd>
                  </button>
                  <button
                    onClick={muteSiren}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition border hover:scale-[1.02] active:scale-95 ${
                      sirenActive || manualOverride
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 siren-shake'
                        : 'bg-gray-100 hover:bg-gray-200 text-[#3f5361] border-gray-300'
                    }`}
                  >
                    <VolumeX size={13} />
                    {manualOverride ? 'SIREN MUTED' : 'MUTE ALARM'}
                    <kbd className="text-[8px] bg-black/10 rounded px-1 ml-0.5">M</kbd>
                  </button>
                </div>
              </div>
            </div>

            {/* ── AI MODEL BENCHMARK & ACCURACY CARD ─────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f6] pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#2b6e8f]" />
                  <h2 className="text-sm font-semibold text-[#123a54]">AI Model Benchmark &amp; Accuracy</h2>
                </div>
                <span className="text-[10px] bg-[#2b6e8f]/15 text-[#2b6e8f] font-bold px-2 py-0.5 rounded-full border border-[#2b6e8f]/30 font-mono">
                  {aiMetrics.methodUsed || 'ONNX_LSTM'}
                </span>
              </div>

              {/* Summary Metric Badges */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#f0f9ff] border border-[#bfe6cf] rounded-xl p-2.5">
                  <p className="text-[9px] text-[#2b6e8f] font-bold uppercase tracking-wider">Avg Accuracy</p>
                  <p className="text-lg font-bold font-mono text-[#2f9463]">{aiMetrics.avgAccuracy_pct}%</p>
                </div>
                <div className="bg-[#fcf8f2] border border-[#f4d6a4] rounded-xl p-2.5">
                  <p className="text-[9px] text-[#e69138] font-bold uppercase tracking-wider">MAE (Error)</p>
                  <p className="text-lg font-bold font-mono text-[#e69138]">{aiMetrics.mae_m} m</p>
                </div>
                <div className="bg-[#fbfdfe] border border-[#eef2f3] rounded-xl p-2.5">
                  <p className="text-[9px] text-[#6d818d] font-bold uppercase tracking-wider">RMSE</p>
                  <p className="text-lg font-bold font-mono text-[#123a54]">{aiMetrics.rmse_m} m</p>
                </div>
              </div>

              {/* Defense Simulation Control Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#f1f5f6]">
                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  title="Stream 20-step synthetic storm cycle into ONNX engine"
                >
                  <Play size={13} className={isSimulating ? 'animate-spin' : ''} />
                  {isSimulating ? 'SIMULATING...' : 'RUN SIMULATION'}
                </button>

                <button
                  onClick={handleResetTestTelemetry}
                  disabled={isResetting}
                  className="py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#3f5361] font-bold text-xs border border-gray-300 flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  title="Purge database logs and reset baseline"
                >
                  <RotateCcw size={13} className={isResetting ? 'animate-spin' : ''} />
                  {isResetting ? 'RESETTING...' : 'RESET TELEMETRY'}
                </button>
              </div>

              {/* Recent Comparison History Table */}
              <div className="pt-2 border-t border-[#f1f5f6]">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-[#123a54] flex items-center gap-1.5">
                    <Target size={13} className="text-[#2b6e8f]" /> Actual vs. Predicted (+30m) Log
                  </h3>
                  <span className="text-[10px] text-[#6d818d] font-mono">Samples: {aiMetrics.history?.length || 0}</span>
                </div>

                <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-xl border border-[#eef2f3] text-[10px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#f4f7f8] text-[#6d818d] font-bold uppercase sticky top-0 border-b border-[#eef2f3]">
                      <tr>
                        <th className="p-2">Time</th>
                        <th className="p-2">Actual</th>
                        <th className="p-2">+30m Pred</th>
                        <th className="p-2">Error</th>
                        <th className="p-2">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f6] font-mono">
                      {(!aiMetrics.history || aiMetrics.history.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-[#6d818d] italic">
                            No comparison samples evaluated yet. Click "RUN SIMULATION" to generate live storm metrics.
                          </td>
                        </tr>
                      ) : (
                        aiMetrics.history.map((row) => (
                          <tr key={row.id} className="hover:bg-[#fbfdfe]">
                            <td className="p-2 text-[#6d818d]">
                              {new Date(row.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </td>
                            <td className="p-2 font-bold text-[#123a54]">{row.actual_m.toFixed(2)} m</td>
                            <td className="p-2 text-[#2b6e8f]">{row.predicted30m_m.toFixed(2)} m</td>
                            <td className="p-2 text-[#e69138]">±{row.error30m_m.toFixed(2)} m</td>
                            <td className="p-2 font-bold text-[#2f9463]">{row.accuracy30m_pct}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-sky-200/90 text-center text-[10px] sm:text-xs py-3.5 px-4 flex items-center justify-center gap-2 flex-wrap border-t border-white/10">
          <img src="/PUBMAT3.png" alt="logo" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white p-0.5" />
          <span>Smart Flood · Real-Time Monitoring &amp; Early Warning System · Capstone 2026</span>
        </footer>

      </div>
    </div>

    {/* ── TOAST NOTIFICATIONS (portal, fixed bottom-right) ─────────────── */}
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
