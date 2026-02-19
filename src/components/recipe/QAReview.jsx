import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function QAReview({ batch, qcResult, onDecision }) {
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  async function decide(decision) {
    setSaving(true);
    await onDecision(decision, remarks);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">QC Results</h3>
        {qcResult ? (
          <div className="grid grid-cols-3 gap-3">
            {[['Brix', qcResult.brix, '°Bx'], ['pH', qcResult.ph, ''], ['Temp', qcResult.temp, '°C']].map(([label, val, unit]) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-slate-900">{val}<span className="text-xs text-slate-400 ml-0.5">{unit}</span></p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No QC readings submitted yet</p>
        )}
        {qcResult?.notes && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">{qcResult.notes}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 block mb-1.5">QA Remarks</label>
        <textarea
          rows={3}
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Enter approval / rejection remarks…"
          className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => decide('APPROVED')}
          disabled={saving}
          className="h-16 rounded-2xl text-base font-bold bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" /> Approve
        </Button>
        <Button
          onClick={() => decide('REJECTED')}
          disabled={saving}
          variant="destructive"
          className="h-16 rounded-2xl text-base font-bold"
        >
          <XCircle className="w-5 h-5 mr-2" /> Reject
        </Button>
      </div>
    </div>
  );
}