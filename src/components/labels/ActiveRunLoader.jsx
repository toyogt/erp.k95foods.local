import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Finds the active/running PackingWO for a given line and provides it to children.
 * Also resolves the label_variant_id from SKUPrintMapping if available.
 *
 * Props:
 *   lineMachineId  – e.g. "LABEL-LINE-1"
 *   onRunLoaded(run | null)  – callback with resolved run object or null
 */
export default function ActiveRunLoader({ lineMachineId, onRunLoaded }) {
  const [loading, setLoading] = useState(true);
  const [activeRun, setActiveRun] = useState(undefined); // undefined = not fetched yet

  useEffect(() => {
    if (lineMachineId) load();
  }, [lineMachineId]);

  async function load() {
    setLoading(true);
    try {
      // Look for RUNNING or RELEASED (approved/started) WOs on this line
      const wos = await base44.entities.PackingWO.filter(
        { assigned_line: lineMachineId },
        '-updated_date',
        20
      );
      const active = wos.find(w => w.status === 'RUNNING' || w.status === 'RELEASED');

      if (!active) {
        setActiveRun(null);
        onRunLoaded(null);
        setLoading(false);
        return;
      }

      // Try to enrich with label_variant_id from SKUPrintMapping
      let labelVariantId = null;
      if (active.product_code) {
        const mappings = await base44.entities.SKUPrintMapping.filter(
          { product_code: active.product_code, is_active: true },
          '-updated_date',
          1
        ).catch(() => []);
        if (mappings.length > 0) labelVariantId = mappings[0].label_variant_id;
      }

      const run = {
        ...active,
        label_variant_id: labelVariantId || active.label_variant_id || '',
      };
      setActiveRun(run);
      onRunLoaded(run);
    } catch (e) {
      setActiveRun(null);
      onRunLoaded(null);
    }
    setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking active run…
    </div>
  );

  if (activeRun) return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-green-800">Active Run: {activeRun.wo_id}</p>
        <p className="text-xs text-green-700 truncate">{activeRun.product} {activeRun.product_code ? `(${activeRun.product_code})` : ''}</p>
        {activeRun.batch_id && <p className="text-xs text-green-600">Batch: {activeRun.batch_id}</p>}
      </div>
      <button onClick={load} className="text-green-600 hover:text-green-800 p-1">
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-800">No approved labelling run active</p>
        <p className="text-xs text-amber-700">Ask supervisor to approve / start the run before printing box labels.</p>
      </div>
      <button onClick={load} className="text-amber-600 hover:text-amber-800 p-1">
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
}