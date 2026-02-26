import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Printer, Loader2, RefreshCw, AlertTriangle, Search, X } from 'lucide-react';
import PrintPreview from './PrintPreview';

const STATUS_STYLE = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  PRINTED:  'bg-slate-100 text-slate-600',
};

function fmtDate(d) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}

function genSerial(date) {
  const d = (date || new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BX-${d}-${rand}`;
}

export default function MyRequestsList({ requests, products, user, onRefresh }) {
  const [generating, setGenerating] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmReprint, setConfirmReprint] = useState(null);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Filter by batch no / request_id / item_code
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(r =>
      (r.batch_no || '').toLowerCase().includes(q) ||
      (r.request_id || '').toLowerCase().includes(q) ||
      (r.item_code || '').toLowerCase().includes(q)
    );
  }, [requests, search]);

  // Show only last 10 unless showAll or searching
  const visible = (search || showAll) ? filtered : filtered.slice(0, 10);
  const hasMore = !search && !showAll && filtered.length > 10;

  async function handlePrintClick(req) {
    if (req.status === 'PRINTED') {
      setConfirmReprint(req);
    } else {
      await handleGenerate(req);
    }
  }

  async function handleGenerate(req) {
    setGenerating(req.request_id);
    const product = products.find(p => p.item_code === req.item_code) || {};
    const now = new Date().toISOString();
    const labels = [];

    for (let i = 0; i < req.qty_labels; i++) {
      const serial = genSerial(req.mfg_date ? new Date(req.mfg_date) : new Date());
      const qrPayload = JSON.stringify({ s: serial, r: req.request_id, i: req.item_code, b: req.batch_no });
      const label = await base44.entities.BoxLabel.create({
        box_serial: serial,
        item_code: req.item_code,
        batch_no: req.batch_no,
        mfg_date: req.mfg_date,
        exp_date: req.exp_date,
        qr_payload: qrPayload,
        status: 'PRINTED_UNREGISTERED',
        printed_at: now,
        printed_by: user?.email || '',
        current_location: 'LABEL-STATION',
      });
      labels.push({ ...label, qr_payload: qrPayload, mfg_date: req.mfg_date, exp_date: req.exp_date, batch_no: req.batch_no, item_code: req.item_code, box_serial: serial, printed_at: now });

      if (req.is_trial_pack && req.contents_json?.length) {
        for (const line of req.contents_json) {
          await base44.entities.BoxLabelContent.create({
            box_serial: serial,
            item_code: line.item_code || req.item_code,
            batch_no: line.batch_no || req.batch_no,
            mfg_date: line.mfg_date || req.mfg_date,
            exp_date: line.exp_date || req.exp_date,
            qty_bottles: Number(line.qty_bottles) || 0,
          });
        }
      }
    }

    await base44.entities.LabelPrintRequest.update(req.id, {
      status: 'PRINTED',
      decision_notes: (req.decision_notes ? req.decision_notes + ' | ' : '') +
        `Printed by ${user?.email || 'unknown'} at ${new Date().toLocaleString()}`,
    });

    setGenerating(null);
    setPrintData({ labels, product });
    onRefresh?.();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-base">My Requests</h3>
        <button onClick={onRefresh} className="text-slate-400 hover:text-slate-600 p-1">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full h-9 pl-9 pr-8 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none"
          placeholder="Search by batch no, item code, request ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results info */}
      {search && (
        <p className="text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"</p>
      )}

      {visible.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">
          {search ? 'No matching requests.' : 'No requests yet.'}
        </p>
      )}

      {/* Card list */}
      <div className="space-y-2">
        {visible.map(req => (
          <div key={req.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400 truncate">{req.request_id}</p>
                <p className="font-semibold text-slate-800 text-sm truncate">{req.item_code}</p>
                <p className="text-xs text-slate-500 truncate">
                  {products.find(p => p.item_code === req.item_code)?.product_name || ''}
                  {req.is_trial_pack && <span className="ml-1 text-purple-600 font-bold">TRIAL</span>}
                </p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[req.status] || 'bg-slate-100 text-slate-500'}`}>
                {req.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs text-slate-600">
              <div><span className="text-slate-400">Batch</span><br /><b>{req.batch_no}</b></div>
              <div><span className="text-slate-400">Mfg</span><br />{fmtDate(req.mfg_date)}</div>
              <div><span className="text-slate-400">Qty</span><br /><b>{req.qty_labels}</b> labels</div>
            </div>
            {(req.status === 'APPROVED' || req.status === 'PRINTED') && (
              <Button
                size="sm"
                className={`w-full h-8 text-xs rounded-lg gap-1 ${req.status === 'PRINTED' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}
                disabled={generating === req.request_id}
                onClick={() => handlePrintClick(req)}
              >
                {generating === req.request_id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : req.status === 'PRINTED'
                    ? <><Printer className="w-3.5 h-3.5" /> Reprint</>
                    : <><Printer className="w-3.5 h-3.5" /> Generate & Print</>
                }
              </Button>
            )}
            {req.status === 'REJECTED' && req.decision_notes && (
              <p className="text-xs text-red-500 italic">{req.decision_notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-xs text-slate-500 hover:text-slate-700 py-2 border border-dashed border-slate-200 rounded-xl"
        >
          Show all {filtered.length} requests (showing last 10)
        </button>
      )}
      {showAll && filtered.length > 10 && !search && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
        >
          Show less
        </button>
      )}

      {/* Print preview overlay */}
      {printData && (
        <PrintPreview
          labels={printData.labels}
          product={printData.product}
          onClose={() => setPrintData(null)}
        />
      )}

      {/* Reprint warning dialog */}
      {confirmReprint && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Labels Already Printed</p>
                <p className="text-sm text-slate-500 mt-1">
                  Labels for <strong>{confirmReprint.request_id}</strong> were already printed. Reprinting will generate new box serials.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmReprint(null)}>Cancel</Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={async () => { setConfirmReprint(null); await handleGenerate(confirmReprint); }}
              >
                <Printer className="w-4 h-4 mr-1" /> Print Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}