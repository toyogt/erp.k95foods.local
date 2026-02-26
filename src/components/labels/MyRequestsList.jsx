import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Printer, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import PrintPreview from './PrintPreview';

const STATUS_STYLE = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  PRINTED:  'bg-slate-100 text-slate-600',
};

function genSerial(date) {
  const d = (date || new Date()).toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.random().toString(36).slice(2,8).toUpperCase();
  return `BX-${d}-${rand}`;
}

export default function MyRequestsList({ requests, products, user, onRefresh }) {
  const [generating, setGenerating] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmReprint, setConfirmReprint] = useState(null); // req to confirm reprint

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
        // registered_at / registered_by intentionally omitted (null)
      });
      labels.push({ ...label, qr_payload: qrPayload, mfg_date: req.mfg_date, exp_date: req.exp_date, batch_no: req.batch_no, item_code: req.item_code, box_serial: serial, printed_at: now });

      // If trial pack, save content lines
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

    // Update request status
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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-base">My Requests</h3>
        <button onClick={onRefresh} className="text-slate-400 hover:text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {requests.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">No requests yet.</p>
      )}

      {requests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left py-2 pr-3">Request ID</th>
                <th className="text-left py-2 pr-3">Item</th>
                <th className="text-left py-2 pr-3">Batch</th>
                <th className="text-left py-2 pr-3">Mfg</th>
                <th className="text-left py-2 pr-3">Exp</th>
                <th className="text-right py-2 pr-3">Qty</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-600">{req.request_id}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-800">{req.item_code}</td>
                  <td className="py-2 pr-3 text-slate-600">{req.batch_no}</td>
                  <td className="py-2 pr-3 text-slate-600">{req.mfg_date}</td>
                  <td className="py-2 pr-3 text-slate-600">{req.exp_date}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{req.qty_labels}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[req.status] || 'bg-slate-100 text-slate-500'}`}>
                      {req.status}
                    </span>
                    {req.is_trial_pack && <span className="ml-1 text-xs text-purple-600 font-semibold">TRIAL</span>}
                  </td>
                  <td className="py-2">
                    {(req.status === 'APPROVED' || req.status === 'PRINTED') && (
                      <Button
                        size="sm"
                        className={`h-7 text-xs rounded-lg gap-1 ${req.status === 'PRINTED' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}
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
                      <span className="text-xs text-red-500 italic">{req.decision_notes}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Print preview overlay */}
      {printData && (
        <PrintPreview
          labels={printData.labels}
          product={printData.product}
          onClose={() => setPrintData(null)}
        />
      )}
    </div>
  );
}