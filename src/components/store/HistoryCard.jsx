import { useState } from 'react';
import { ArrowRight, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '@/lib/dateFormatter';

/**
 * Reusable card for history records across Store module.
 * @param {object} props
 * @param {string} props.id - record ID (e.g. PUT-xxx, TRF-xxx)
 * @param {string} props.title - main title (item name)
 * @param {string} props.subtitle - secondary line
 * @param {Array} props.details - [{label, value}]
 * @param {string} props.status - status text
 * @param {string} props.statusColor - 'green' | 'amber' | 'blue' | 'red'
 * @param {string} props.date - ISO date string
 * @param {string} props.from - source location (for transfers)
 * @param {string} props.to - destination location (for transfers)
 */
export default function HistoryCard({ id, title, subtitle, details = [], status, statusColor = 'green', date, from, to, expandedContent, children }) {
  const [expanded, setExpanded] = useState(false);

  function handlePrint() {
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const statusBadge = status ? `<span class="badge">${status}</span>` : '';
    const transferBlock = from && to ? `
      <div class="transfer-box">
        <span class="from">${from}</span>
        <span class="arrow">→</span>
        <span class="to">${to}</span>
      </div>` : '';

    const detailsHtml = details.length > 0 ? `
      <table class="details-table">
        <tbody>
          ${details.map(d => `<tr><td class="dt-label">${d.label}</td><td class="dt-value">${d.value}</td></tr>`).join('')}
        </tbody>
      </table>` : '';

    const printWin = window.open('', '_blank', 'width=700,height=800');
    printWin.document.write(`
      <html><head><title>${id}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; padding: 32px; color: #1e293b; max-width: 700px; margin: 0 auto; }
        .header { padding-bottom: 16px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
        .header h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #0f172a; }
        .header .doc-id { font-size: 13px; color: #64748b; font-family: monospace; margin: 0 0 4px; }
        .header .sub { font-size: 12px; color: #64748b; margin: 2px 0; }
        .badge { display: inline-block; padding: 3px 12px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #15803d; margin-top: 8px; }
        .transfer-box { background: #f8fafc; padding: 12px 20px; border-radius: 8px; margin: 16px 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 12px; border: 1px solid #e2e8f0; }
        .transfer-box .arrow { color: #94a3b8; font-size: 18px; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .details-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .dt-label { color: #64748b; width: 40%; }
        .dt-value { font-weight: 600; color: #1e293b; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <div class="header">
        <h1>${title || '—'}</h1>
        <p class="doc-id">${id}</p>
        ${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
        <p class="sub">Date: ${date ? fmtDT(date) : '—'}</p>
        ${statusBadge}
      </div>
      ${transferBlock}
      ${detailsHtml}
      <div class="footer"><span>K95 ERP — Store Management</span><span>Printed on ${fmtDate(new Date())}</span></div>
      </body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);
  }

  const colorMap = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };

  const hasExpandable = expandedContent || children;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow ${hasExpandable ? 'cursor-pointer' : ''}`}>
      <div className="p-4" onClick={() => hasExpandable && setExpanded(!expanded)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold text-slate-500">{id}</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1">
            {status && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorMap[statusColor] || colorMap.green}`}>
                {status}
              </span>
            )}
            {date && (
              <span className="text-xs text-slate-400">
                {formatDateTime(date)}
              </span>
            )}
          </div>
          {hasExpandable && (
            expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Transfer arrow */}
      {from && to && (
        <div className="flex items-center gap-2 mt-2 bg-slate-50 rounded-lg px-3 py-1.5">
          <span className="font-mono text-xs font-bold text-slate-700">{from}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-mono text-xs font-bold text-slate-700">{to}</span>
        </div>
      )}

      {/* Detail chips */}
      {details.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
          {details.map((d, i) => (
            <span key={i}>
              {d.label}: <strong className="text-slate-700">{d.value}</strong>
            </span>
          ))}
        </div>
      )}

      {hasExpandable && !expanded && (
        <p className="text-xs text-blue-500 font-medium mt-2">Tap to view full details</p>
      )}
      </div>

      {/* Expanded content */}
      {expanded && hasExpandable && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3">
          {expandedContent || children}
        </div>
      )}

      {/* Print button */}
      <div className="flex gap-2 px-4 pb-3 pt-2 border-t border-slate-100">
        <button onClick={(e) => { e.stopPropagation(); handlePrint(); }} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>
    </div>
  );
}