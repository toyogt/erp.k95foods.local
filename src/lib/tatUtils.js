export function calculateDueDate(fromDate, step) {
  const from = new Date(fromDate);
  switch (step.tat_type) {
    case 'fixed_hours': return new Date(from.getTime() + (step.tat_hours || 1) * 60 * 60 * 1000);
    case 'end_of_day': {
      const [h, m] = (step.tat_eod_time || '18:00').split(':').map(Number);
      const eod = new Date(from); eod.setHours(h, m, 0, 0);
      if (eod <= from) eod.setDate(eod.getDate() + 1);
      return eod;
    }
    case 'fixed_time': {
      const [h, m] = (step.tat_fixed_time || '17:00').split(':').map(Number);
      const ft = new Date(from); ft.setHours(h, m, 0, 0);
      if (ft <= from) ft.setDate(ft.getDate() + 1);
      return ft;
    }
    case 'business_days': {
      const days = step.tat_business_days || 1; let d = new Date(from); let added = 0;
      while (added < days) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) added++; }
      return d;
    }
    default: return new Date(from.getTime() + 2 * 60 * 60 * 1000);
  }
}

export function tatLabel(step) {
  switch (step.tat_type) {
    case 'fixed_hours': return `${step.tat_hours || 1}h`;
    case 'end_of_day': return `EOD (${step.tat_eod_time || '18:00'})`;
    case 'fixed_time': return `By ${step.tat_fixed_time || '17:00'}`;
    case 'business_days': return `${step.tat_business_days || 1} biz day(s)`;
    default: return 'N/A';
  }
}

export function isDelayed(s) { if (s.status === 'completed' || !s.due_at) return false; return new Date() > new Date(s.due_at); }
export function getDelayMinutes(s) { if (!s.due_at) return 0; return Math.max(0, Math.floor((new Date() - new Date(s.due_at)) / 60000)); }
export function formatDelay(minutes) { if (minutes < 60) return `${minutes}m late`; const h = Math.floor(minutes / 60); const m = minutes % 60; return m === 0 ? `${h}h late` : `${h}h ${m}m late`; }
export function formatDue(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr); const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + time;
}