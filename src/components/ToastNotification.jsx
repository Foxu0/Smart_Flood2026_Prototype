import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * useToast — Returns { toasts, pushToast, dismissToast }
 *
 * Each toast: { id, message, severity, duration }
 * severity: 'info' | 'warning' | 'danger' | 'success'
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback(({ message, severity = 'info', duration = 4500 }) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, severity, duration, exiting: false }]);
    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => t.id === id ? { ...t, exiting: true } : t)
      );
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 320);
    }, duration);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, exiting: true } : t)
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 320);
  }, []);

  return { toasts, pushToast, dismissToast };
}

/* ─── Toast config by severity ──────────────────────────────────────────── */
const CONFIG = {
  info: {
    icon: Info,
    bg: 'bg-[#e6f2f8]',
    border: 'border-[#bfdbe8]',
    text: 'text-[#2b6e8f]',
    bar: 'bg-[#2b6e8f]',
    iconColor: '#2b6e8f',
  },
  success: {
    icon: CheckCircle2,
    bg: 'bg-[#e5f6ec]',
    border: 'border-[#bfe6cf]',
    text: 'text-[#2f9463]',
    bar: 'bg-[#2f9463]',
    iconColor: '#2f9463',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-[#fdf1de]',
    border: 'border-[#f4d6a4]',
    text: 'text-[#e69138]',
    bar: 'bg-[#e69138]',
    iconColor: '#e69138',
  },
  danger: {
    icon: AlertTriangle,
    bg: 'bg-[#fce7e0]',
    border: 'border-[#f2bfab]',
    text: 'text-[#e0522f]',
    bar: 'bg-[#e0522f]',
    iconColor: '#e0522f',
  },
};

/* ─── Single Toast Item ─────────────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }) {
  const cfg = CONFIG[toast.severity] || CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      className={`
        relative overflow-hidden rounded-2xl border shadow-lg px-4 py-3
        flex items-start gap-3 min-w-[260px] max-w-[340px] cursor-pointer
        ${cfg.bg} ${cfg.border}
        ${toast.exiting ? 'toast-exit' : 'toast-enter'}
      `}
      onClick={() => onDismiss(toast.id)}
    >
      {/* Icon */}
      <Icon size={18} color={cfg.iconColor} className="mt-0.5 flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${cfg.text}`}>
          {toast.severity === 'danger' ? '⚠ FLOOD ALERT' :
           toast.severity === 'warning' ? '⚠ WARNING' :
           toast.severity === 'success' ? '✓ STATUS UPDATE' : 'ℹ INFO'}
        </p>
        <p className="text-[11px] text-[#3f5361] leading-snug mt-0.5 font-medium">
          {toast.message}
        </p>
        <p className="text-[9px] text-[#6d818d] mt-1 font-mono">
          Press <kbd className="bg-white/80 border border-[#d1e0e8] rounded px-1 py-0.5 text-[8px] font-bold mx-0.5">M</kbd> to mute
          · <kbd className="bg-white/80 border border-[#d1e0e8] rounded px-1 py-0.5 text-[8px] font-bold mx-0.5">T</kbd> to test
        </p>
      </div>

      {/* Dismiss X */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(toast.id); }}
        className={`${cfg.text} opacity-50 hover:opacity-100 transition flex-shrink-0`}
      >
        <X size={14} />
      </button>

      {/* Auto-dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5 rounded-b-2xl overflow-hidden">
        <div
          className={`h-full rounded-b-2xl ${cfg.bar}`}
          style={{
            animation: `drain ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

/* ─── Toast Portal / Container ──────────────────────────────────────────── */
export default function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-6 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
