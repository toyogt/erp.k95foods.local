import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react';

function genId() { return 'MAB-' + Date.now().toString(36).toUpperCase(); }

export default function ProductionControl() {
  const [user, setUser] = useState(null);
  const [fillers, setFillers] = useState([]);
  const [activeBatches, setActiveBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assign panel state
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ machine_id: '', product_code: '', bottle_type: '', batch_id: '', expected_crates: '', change_reason: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Close batch state
  const [closingId, setClosingId] = useState(null); // MachineActiveBatch db id
  const [closeReason, setCloseReason] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [machines, batches, prods, bts] = await Promise.all([
      base44.entities.Machine.filter({ machine_type: 'FILLER', is_active: true }),
      base44.entities.MachineActiveBatch.filter({ status: 'ACTIVE' }, '-assigned_at', 20),
      base44.entities.ProductMaster.list('-created_date', 200).catch(() => []),
      base44.entities.BottleType.list('-created_date', 50).catch(() => []),
    ]);
    setFillers(machines);
    setActiveBatches(batches);
    setProducts(prods);
    setBottleTypes(bts);
    setLoading(false);
  }

  function openAssignPanel(machine_id = '') {
    setForm({ machine_id, product_code: '', bottle_type: '', batch_id: '', expected_crates: '', change_reason: '' });
    setFormError('');
    setShowAssign(true);
  }

  async function handleAssign() {
    if (!form.machine_id) { setFormError('Select a filler machine.'); return; }
    if (!form.batch_id.trim()) { setFormError('Batch ID is required.'); return; }
    if (!form.product_code.trim()) { setFormError('Product code is required.'); return; }
    if (!form.bottle_type.trim()) { setFormError('Bottle type is required.'); return; }

    setSaving(true);
    setFormError('');
    const now = new Date().toISOString();

    // Find existing ACTIVE batch for this machine
    const existing = activeBatches.find(b => b.machine_id === form.machine_id && b.status === 'ACTIVE');
    if (existing) {
      if (!form.change_reason.trim()) { setFormError('Provide a change reason to replace the existing active batch.'); setSaving(false); return; }
      await base44.entities.MachineActiveBatch.update(existing.id, {
        status: 'CLOSED',
        closed_by: user?.email || '',
        closed_at: now,
        change_reason: form.change_reason.trim(),
      });
    }

    await base44.entities.MachineActiveBatch.create({
      machine_id: form.machine_id,
      batch_id: form.batch_id.trim(),
      product_code: form.product_code.trim(),
      bottle_type: form.bottle_type.trim(),
      status: 'ACTIVE',
      assigned_by: user?.email || '',
      assigned_at: now,
      expected_crates: form.expected_crates ? Number(form.expected_crates) : undefined,
      created_crates: 0,
    });

    setShowAssign(false);
    await loadAll();
    setSaving(false);
  }

  async function handleClose(batch) {
    if (!closeReason.trim()) return;
    setCloseLoading(true);
    await base44.entities.MachineActiveBatch.update(batch.id, {
      status: 'CLOSED',
      closed_by: user?.email || '',
      closed_at: new Date().toISOString(),
      change_reason: closeReason.trim(),
    });
    setClosingId(null);
    setCloseReason('');
    await loadAll();
    setCloseLoading(false);
  }

  const existingForMachine = form.machine_id ? activeBatches.find(b => b.machine_id === form.machine_id && b.status === 'ACTIVE') : null;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Control</h1>
          <p className="text-sm text-slate-500 mt-0.5">Assign batches to filling machines</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button onClick={() => openAssignPanel()} className="gap-2 rounded-xl">
            <PlusCircle className="w-4 h-4" /> Assign Batch
          </Button>
        </div>
      </div>

      {/* Active Assignments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm font-bold text-slate-700">Active Batch Assignments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Machine</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Batch ID</th>
                <th className="text-left px-4 py-3 font-semibold">Bottle Type</th>
                <th className="text-right px-4 py-3 font-semibold">Crates</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fillers.map(m => {
                const batch = activeBatches.find(b => b.machine_id === m.machine_id && b.status === 'ACTIVE');
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{m.machine_id}</p>
                      <p className="text-xs text-slate-400">{m.display_name}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-700 text-xs">{batch?.product_code || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-4 font-mono font-semibold text-slate-800">{batch?.batch_id || <span className="text-slate-300 font-normal">—</span>}</td>
                    <td className="px-4 py-4 text-slate-600 text-xs">{batch?.bottle_type || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-4 text-right">
                      {batch ? (
                        <span className="font-bold text-slate-800">
                          {batch.created_crates || 0}
                          {batch.expected_crates ? <span className="text-slate-400 font-normal"> / {batch.expected_crates}</span> : null}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openAssignPanel(m.machine_id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                          {batch ? 'Change' : 'Assign'}
                        </button>
                        {batch && closingId !== batch.id && (
                          <button onClick={() => { setClosingId(batch.id); setCloseReason(''); }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                            Close
                          </button>
                        )}
                      </div>
                      {/* Inline close reason input */}
                      {batch && closingId === batch.id && (
                        <div className="mt-2 flex gap-2 items-center">
                          <input
                            className="flex-1 h-8 text-xs rounded-lg border border-slate-300 px-2 focus:outline-none focus:border-red-400"
                            placeholder="Close reason…"
                            value={closeReason}
                            onChange={e => setCloseReason(e.target.value)}
                          />
                          <button onClick={() => handleClose(batch)} disabled={closeLoading || !closeReason.trim()}
                            className="text-xs font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-red-700">
                            {closeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                          </button>
                          <button onClick={() => setClosingId(null)} className="text-slate-400 hover:text-slate-600">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {fillers.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">No FILLER machines configured. Add machines in Master Data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign / Change Panel */}
      {showAssign && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900">Assign Batch to Filler</p>
            <button onClick={() => setShowAssign(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
          </div>

          {/* Machine */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filler Machine</label>
            <select
              className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500 bg-white"
              value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value, change_reason: '' }))}>
              <option value="">— Select machine —</option>
              {fillers.map(m => <option key={m.id} value={m.machine_id}>{m.machine_id} — {m.display_name}</option>)}
            </select>
          </div>

          {/* Existing active batch warning */}
          {existingForMachine && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <p className="font-semibold">⚠ Active batch exists: <span className="font-mono">{existingForMachine.batch_id}</span></p>
              <p className="text-xs mt-0.5">It will be closed when you assign a new batch. Provide a change reason below.</p>
            </div>
          )}

          {/* Product */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Code</label>
            {products.length > 0 ? (
              <select
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500 bg-white"
                value={form.product_code} onChange={e => setForm(f => ({ ...f, product_code: e.target.value }))}>
                <option value="">— Select product —</option>
                {products.map(p => <option key={p.id} value={p.product_code || p.name}>{p.product_code || p.name} {p.name !== p.product_code ? `— ${p.name}` : ''}</option>)}
              </select>
            ) : (
              <input className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Product code (manual)" value={form.product_code} onChange={e => setForm(f => ({ ...f, product_code: e.target.value }))} />
            )}
          </div>

          {/* Bottle Type */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bottle Type</label>
            {bottleTypes.length > 0 ? (
              <select
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500 bg-white"
                value={form.bottle_type} onChange={e => setForm(f => ({ ...f, bottle_type: e.target.value }))}>
                <option value="">— Select bottle type —</option>
                {bottleTypes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            ) : (
              <input className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Bottle type (manual)" value={form.bottle_type} onChange={e => setForm(f => ({ ...f, bottle_type: e.target.value }))} />
            )}
          </div>

          {/* Batch ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch ID</label>
            <input className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g. B-20250302-001" value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))} />
          </div>

          {/* Expected Crates */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expected Crates (optional)</label>
            <input type="number" min="0" className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500"
              placeholder="0" value={form.expected_crates} onChange={e => setForm(f => ({ ...f, expected_crates: e.target.value }))} />
          </div>

          {/* Change Reason (required when replacing) */}
          {existingForMachine && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Change Reason *</label>
              <input className="w-full h-10 rounded-xl border border-red-300 px-3 text-sm focus:outline-none focus:border-red-500"
                placeholder="Why are you changing the active batch?" value={form.change_reason} onChange={e => setForm(f => ({ ...f, change_reason: e.target.value }))} />
            </div>
          )}

          {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700" onClick={handleAssign} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Batch'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}