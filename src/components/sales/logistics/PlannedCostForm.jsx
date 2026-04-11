import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { COST_HEADS } from './costHeads';
import { Save, Loader2, ArrowDown, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PlannedCostForm({ costRecord, systemEstimate, onSave, saving, hasRateCardMatch }) {
  const isSaved = !!(costRecord?.planned_total && costRecord.planned_total > 0);
  const [form, setForm] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (costRecord) {
      const initial = {};
      COST_HEADS.forEach(h => { initial[h.key] = costRecord[`planned_${h.key}`] || ''; });
      setForm(initial);
    }
  }, [costRecord]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const total = COST_HEADS.reduce((s, h) => s + (Number(form[h.key]) || 0), 0);

  const handleSave = () => {
    const data = {};
    COST_HEADS.forEach(h => { data[`planned_${h.key}`] = Number(form[h.key]) || 0; });
    data.planned_total = total;
    onSave(data);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-900">Planned Transportation Cost</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">User-entered values</span>
          {systemEstimate && (systemEstimate.system_total || 0) > 0 && !showConfirm && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
              onClick={() => setShowConfirm(true)}
            >
              <ArrowDown className="w-3 h-3" /> Apply System Estimate (₹{(systemEstimate.system_total || 0).toLocaleString('en-IN')})
            </Button>
          )}
        </div>
      </div>
      {hasRateCardMatch === false && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">No system estimate available</p>
            <p className="text-xs text-amber-600 mt-0.5">
              No transport rate card matches this order. Add a rate card to enable auto-calculated estimates.
            </p>
            <Link
              to="/TransportRateCards"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Go to Transport Rate Cards
            </Link>
          </div>
        </div>
      )}
      {showConfirm && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">Apply system estimate to planned costs?</p>
          <p className="text-xs text-blue-600 mt-1">This will fill all fields with the system-calculated values. You can still edit them afterwards.</p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="h-9 text-sm bg-blue-700 hover:bg-blue-800 text-white gap-1"
              onClick={() => {
                const newForm = {};
                COST_HEADS.forEach(h => {
                  newForm[h.key] = systemEstimate[`system_${h.key}`] || 0;
                });
                setForm(newForm);
                setShowConfirm(false);
              }}
            >
              <Check className="w-3.5 h-3.5" /> Yes, Apply
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => setShowConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {COST_HEADS.map(h => (
          <div key={h.key}>
            <Label className="text-xs font-medium text-slate-700">{h.label} (₹)</Label>
            <Input
              className="h-9 text-sm mt-1"
              type="number"
              value={form[h.key] || ''}
              onChange={e => set(h.key, e.target.value)}
              placeholder="0"
              disabled={isSaved}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div>
          <span className="text-sm font-semibold text-slate-900">Planned Total: </span>
          <span className="text-sm font-bold text-slate-900">₹{total.toLocaleString('en-IN')}</span>
        </div>
        {isSaved ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
            <Check className="w-4 h-4" /> Planned Cost Saved
          </span>
        ) : (
          <Button className="h-11 text-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Planned Cost
          </Button>
        )}
      </div>
    </div>
  );
}