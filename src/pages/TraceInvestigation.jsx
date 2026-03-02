import { useState } from 'react';
import { Search, Download, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runTraceInvestigation } from '@/components/trace/useTraceInvestigation';
import TraceTimeline from '@/components/trace/TraceTimeline';

export default function TraceInvestigation() {
  const [form, setForm] = useState({
    crateId: '', palletId: '', boxSerial: '', batchId: '', ryanCount: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchError, setSearchError] = useState('');

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSearch() {
    const hasInput = Object.values(form).some(v => v.trim());
    if (!hasInput) { setSearchError('Enter at least one search value.'); return; }
    setSearchError('');
    setLoading(true);
    setResult(null);
    const r = await runTraceInvestigation({
      crateId:    form.crateId.trim()    || null,
      palletId:   form.palletId.trim()   || null,
      boxSerial:  form.boxSerial.trim()  || null,
      batchId:    form.batchId.trim()    || null,
      ryanCount:  form.ryanCount.trim()  || null,
    });
    setResult(r);
    setLoading(false);
  }

  function handleReset() {
    setForm({ crateId: '', palletId: '', boxSerial: '', batchId: '', ryanCount: '' });
    setResult(null);
    setSearchError('');
  }

  function handlePrint() {
    window.print();
  }

  const hasData = result && (
    result.crate || result.pallet || result.filling ||
    result.chamber?.length || result.labelling || result.packaging
  );

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #trace-print-area, #trace-print-area * { visibility: visible; }
          #trace-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-5 max-w-3xl mx-auto">
        {/* Header */}
        <div className="no-print">
          <h1 className="text-2xl font-bold text-slate-900">Trace Investigation</h1>
          <p className="text-sm text-slate-500">Full production traceability — filling → chamber → labelling → packaging</p>
        </div>

        {/* Search form */}
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search (enter at least one)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Crate ID</label>
              <Input placeholder="CRATE-…" value={form.crateId} onChange={e => setField('crateId', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Pallet ID</label>
              <Input placeholder="PLT-…" value={form.palletId} onChange={e => setField('palletId', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Box Serial</label>
              <Input placeholder="BOX-…" value={form.boxSerial} onChange={e => setField('boxSerial', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Batch ID</label>
              <Input placeholder="BATCH-…" value={form.batchId} onChange={e => setField('batchId', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ryan Count (approx ±500)</label>
              <Input type="number" placeholder="e.g. 48500" value={form.ryanCount} onChange={e => setField('ryanCount', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
          </div>
          {searchError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4" /> {searchError}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading} className="flex-1 h-12 rounded-xl gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Searching…' : 'Search'}
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-12 rounded-xl px-4">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Result area */}
        {result && (
          <div id="trace-print-area">
            {/* Print header — only visible in print */}
            <div className="hidden print:block mb-6">
              <h1 className="text-xl font-black">Trace Investigation Report</h1>
              <p className="text-sm text-slate-500">Generated: {new Date().toLocaleString()}</p>
              <div className="text-xs text-slate-400 mt-1">
                {Object.entries(result.searchParams).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' · ')}
              </div>
            </div>

            {/* Summary bar */}
            <div className="no-print flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {hasData ? (
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    ✓ Trace found
                  </span>
                ) : (
                  <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                    No records found for these search params
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={handlePrint} className="gap-2 h-9 rounded-xl text-sm">
                <Download className="w-4 h-4" /> Export / Print PDF
              </Button>
            </div>

            <TraceTimeline data={result} />
          </div>
        )}
      </div>
    </>
  );
}