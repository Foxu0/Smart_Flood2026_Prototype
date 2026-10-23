import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Small shared building blocks for the console pages.

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#123a54] leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[#6d818d] mt-1 max-w-[70ch]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children }) {
  return <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">{children}</div>;
}

export function Card({ className = '', children }) {
  return <div className={`bg-white rounded-2xl border border-[#e4edf0] shadow-sm ${className}`}>{children}</div>;
}

const BTN = {
  primary:   'bg-[#123a54] hover:bg-[#1b4d6e] text-white',
  secondary: 'bg-white hover:bg-[#f4f8f9] text-[#123a54] border border-[#d5e2e7]',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
  ghost:     'text-[#2b6e8f] hover:bg-[#eef4f6]',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${pad} ${BTN[variant]} ${className}`}
    />
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[#6d818d] mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123a54]/20 focus:border-[#123a54]';

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef2f4]">
          <h2 className="font-display font-bold text-[#123a54]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#6d818d] hover:text-[#123a54]"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-[#eef2f4] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div className="mb-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2">{children}</div>;
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && <Icon size={32} className="mx-auto text-[#9fb3bd] mb-3" />}
      <p className="font-semibold text-[#123a54]">{title}</p>
      {children && <p className="text-sm text-[#6d818d] mt-1">{children}</p>}
    </div>
  );
}

export function formatDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}
