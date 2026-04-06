import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500', title: 'text-green-800', text: 'text-green-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', title: 'text-amber-800', text: 'text-amber-700' },
  error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', title: 'text-red-800', text: 'text-red-700' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', title: 'text-blue-800', text: 'text-blue-700' },
};

const BTN_COLORS = {
  success: 'bg-green-600 hover:bg-green-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
  error: 'bg-red-600 hover:bg-red-700',
  info: 'bg-blue-600 hover:bg-blue-700',
};

export function SweetAlertModal({ open, type = 'info', title, message, onClose, onConfirm, confirmText = 'OK', showCancel = false }) {
  if (!open) return null;

  const Icon = ICONS[type] || ICONS.info;
  const c = COLORS[type] || COLORS.info;
  const btn = BTN_COLORS[type] || BTN_COLORS.info;

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className={`${c.bg} ${c.border} border rounded-t-2xl p-6 text-center`}>
          <div className={`w-16 h-16 rounded-full ${c.bg} border-4 ${c.border} flex items-center justify-center mx-auto mb-3`}>
            <Icon className={`w-8 h-8 ${c.icon}`} />
          </div>
          <h3 className={`text-lg font-bold ${c.title}`}>{title}</h3>
          {message && <p className={`text-sm mt-2 ${c.text}`}>{message}</p>}
        </div>
        <div className="p-4 flex gap-2">
          {showCancel && (
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          )}
          <button onClick={onConfirm || onClose} className={`flex-1 h-11 rounded-xl text-sm font-medium text-white ${btn} transition-colors`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline validation alert (non-modal) */
export function ValidationAlert({ type = 'error', message, onClose }) {
  if (!message) return null;
  const c = COLORS[type] || COLORS.error;
  const Icon = ICONS[type] || ICONS.error;

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-3 flex items-start gap-2`}>
      <Icon className={`w-4 h-4 ${c.icon} mt-0.5 shrink-0`} />
      <p className={`text-sm ${c.text} flex-1`}>{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default SweetAlertModal;