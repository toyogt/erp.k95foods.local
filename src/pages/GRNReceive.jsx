import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle2, Plus, Trash2, Search } from 'lucide-react';
import { logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent, linkFMSRef } from '@/lib/useFMSAutoComplete';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { useToast } from '@/components/ui/use-toast';

// ── Item name search ──────────────────────────────────────────────────────────
function ItemNameSelect({ value, onChangeName, onSelectItem }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
   Promise.all([
     base44.entities.ItemMaster.list('-created_date', 500),
     base44.entities.StoreLot.list('-created_date', 500),
   ]).then(([im, lots]) => {
     const seen = new Set();
     const merged = [
       ...im.map(i => ({ item_code: i.item_code, item_name: i.item_name, uom: i.base_uom })),
       ...lots.map(l => ({ item_code: l.item_code, item_name: l.item_name, uom: l.uom })),
     ].filter(i => {
       const key = i.item_name?.trim().toLowerCase();
       if (!key || seen.has(key)) return false;
       seen.add(key); return true;
     });
     setSuggestions(merged);
   }).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = query.trim()
    ? suggestions.filter(s => s.item_name?.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
          placeholder="Type to search item..."
          value={query}
          onChange={e => { setQuery(e.target.value); onChangeName(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
           query.trim()
             ? <div className="px-4 py-2.5 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 flex items-center gap-2" onClick={() => { setOpen(false); onChangeName(query); }}>
                 <Plus className="w-3.5 h-3.5" /> Add "{query}" as new item
               </div>
             : <div className="px-4 py-3 text-sm text-slate-400">No items found. Start typing...</div>
          ) : filtered.map((s, i) => (
           <div key={i} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50"
             onClick={() => { setQuery(s.item_name); setOpen(false); onSelectItem(s); }}>
             <p className="font-medium text-slate-800">{s.item_name}</p>
             <p className="text-xs text-slate-400">{s.item_code && `Code: ${s.item_code}`} {s.uom && `· Unit: ${s.uom}`}</p>
           </div>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyItem() { return { item_code: '', item_name: '', quantity: '', uom: 'Nos', batch_lot: '', notes: '' }; }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GRNReceive() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [gateEntries, setGateEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // selected gate entry
  const [items, setItems] = useState([emptyItem()]);
  const [grnNotes, setGrnNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [search, setSearch] = useState('');

  // Check URL param for pre-selected gate_id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gateIdParam = params.get('gate_id');
    load(gateIdParam);
  }, []);

  async function load(autoSelectGateId) {
    setLoading(true);
    const [u, entries, existingGrns] = await Promise.all([
      base44.auth.me(),
      base44.entities.GateEntry.filter({ status: 'OPEN' }, '-created_date', 100),
      base44.entities.GRNHeader.list('-created_date', 200),
    ]);
    setUser(u);

    // Filter gate entries that don't yet have a GRN
    const usedGateIds = new Set(existingGrns.map(g => g.gate_id).filter(Boolean));
    const pending = entries.filter(e => !usedGateIds.has(e.gate_id));
    setGateEntries(pending);

    if (autoSelectGateId) {
      const match = pending.find(e => e.gate_id === autoSelectGateId)
        || entries.find(e => e.gate_id === autoSelectGateId);
      if (match) { selectGateEntry(match); }
    }
    setLoading(false);
    const tmpl = await getChecklistTemplate('GRN', 'RECEIVE');
    setChecklistTemplate(tmpl);
  }

  function selectGateEntry(entry) {
    setSelected(entry);
    setItems([emptyItem()]);
    setGrnNotes('');
    setDone(null);
    setShowChecklist(false);
  }

  function setItem(idx, k, v) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  }
  function addItem() { setItems(prev => [...prev, emptyItem()]); }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const validItems = items.filter(it => it.item_name.trim() && parseFloat(it.quantity) > 0);

  async function handleSubmitClick() {
    if (validItems.length === 0) {
      toast({ title: 'Please add at least one item with a valid quantity.', variant: 'destructive' });
      return;
    }
    if (checklistTemplate) { setShowChecklist(true); return; }
    await finalizeSubmit(null);
  }

  async function handleChecklistDone(runId) {
    await finalizeSubmit(runId);
  }

  async function finalizeSubmit(checklistRunId) {
    setSubmitting(true);
    const grn_id = `GRN-${Date.now().toString(36).toUpperCase()}`;

    // Create GRN Header
    const grnHeader = await base44.entities.GRNHeader.create({
      grn_id,
      gate_id: selected.gate_id,
      status: 'RECEIVED',
      received_at: new Date().toISOString(),
      received_by: user?.email || '',
      notes: grnNotes,
      ...(checklistRunId ? { checklist_run_id: checklistRunId } : {}),
    });

    // Create GRN Items + StoreLots
    for (const it of validItems) {
      await base44.entities.GRNItem.create({
        grn_id,
        item_code: it.item_code || it.item_name,
        item_name: it.item_name,
        ordered_qty: parseFloat(it.quantity),
        received_qty: parseFloat(it.quantity),
        uom_code: it.uom || 'Nos',
        batch_or_lot_text: it.batch_lot || '',
        line_notes: it.notes || '',
      });

      const lotId = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const qty = parseFloat(it.quantity);
      await base44.entities.StoreLot.create({
        lot_id: lotId, qr_code: lotId,
        item_name: it.item_name,
        uom: it.uom || 'Nos',
        quantity: qty, remaining_quantity: qty,
        gate_entry_id: selected.gate_id, grn_id,
        status: 'qc_pending',
      });
    }

    // Mark gate entry as processed
    await base44.entities.GateEntry.update(selected.id, { status: 'PROCESSED' });

    await logGrnAudit({
      action: 'GRN_RECEIVED', entity_type: 'GRNHeader',
      entity_id: grn_id, details: { gate_id: selected.gate_id, item_count: validItems.length }, user,
    });
    await fireFMSEvent('grn_received', grnHeader.id);

    setDone({ grn_id, gate_id: selected.gate_id, item_count: validItems.length });
    setSubmitting(false);
    load();
  }

  const filteredEntries = gateEntries.filter(e => {
    const q = search.toLowerCase();
    return !q || (e.gate_id || '').toLowerCase().includes(q) ||
      (e.vehicle_number || '').toLowerCase().includes(q) ||
      (e.driver_name || '').toLowerCase().includes(q);
  });

  // ── Success ─────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center space-y-4 px-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Goods Receipt Confirmed</h2>
        <p className="text-slate-500 font-mono text-lg">{done.grn_id}</p>
        <p className="text-sm text-slate-400">Gate Entry: {done.gate_id} · {done.item_count} item lot(s) created</p>
        <Button onClick={() => { setSelected(null); setDone(null); }} className="w-full h-12 bg-slate-900">
          Back to Gate Entry List
        </Button>
      </div>
    );
  }

  // ── Checklist ────────────────────────────────────────────────────────────────
  if (showChecklist && checklistTemplate) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-12 px-2 md:px-0">
        <h2 className="text-lg font-bold text-slate-900">Goods Receipt Checklist</h2>
        <ChecklistGate
          template={checklistTemplate}
          entityId={selected.gate_id}
          entityType="GRNHeader"
          user={user}
          onComplete={handleChecklistDone}
          onSkip={() => finalizeSubmit(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12 px-2 md:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Goods Receipt Note</h1>
        <button onClick={() => load()} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* ── Gate Entry List ── */}
      {!selected ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by Gate Entry ID, vehicle number..."
              className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-semibold">No pending gate entries found.</p>
              <p className="text-xs mt-1">Complete a Gate Entry first to create a Goods Receipt.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map(e => (
                <button key={e.id} onClick={() => selectGateEntry(e)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 font-mono">{e.gate_id}</span>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {e.vehicle_number ? `Vehicle: ${e.vehicle_number}` : 'Non-vehicle delivery'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Driver: {e.driver_name || '—'} · Mobile: {e.driver_number || '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Arrived: {e.arrived_at ? new Date(e.arrived_at).toLocaleString('en-IN') : '—'}
                      </p>
                    </div>
                    <span className="text-blue-500 text-sm font-semibold shrink-0">Open →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Items Entry Form ── */
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(null)} className="text-blue-500 text-sm font-semibold">← Back</button>
            <span className="font-bold text-slate-900">{selected.gate_id}</span>
          </div>

          {/* Gate entry summary */}
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
            {selected.vehicle_number && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Vehicle</span>
                <span className="font-semibold text-slate-700">{selected.vehicle_number}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500">
              <span>Driver Number</span>
              <span className="font-semibold text-slate-700">{selected.driver_number || '—'}</span>
            </div>
          </div>

          {/* Items section */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Items Received *</p>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
                      <div className="mt-1">
                        <ItemNameSelect
                           value={it.item_name}
                           onChangeName={v => setItem(idx, 'item_name', v)}
                           onSelectItem={item => {
                             setItem(idx, 'item_name', item.item_name);
                             setItem(idx, 'item_code', item.item_code || item.item_name);
                             if (item.uom) setItem(idx, 'uom', item.uom);
                           }}
                         />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                      <Input type="number" className="h-9 text-sm mt-1" value={it.quantity}
                        onChange={e => setItem(idx, 'quantity', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Unit</Label>
                      <select className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm mt-1"
                        value={it.uom} onChange={e => setItem(idx, 'uom', e.target.value)}>
                        <option value="Nos">Numbers</option>
                        <option value="Kg">Kilograms</option>
                        <option value="Ltr">Litres</option>
                        <option value="ML">Millilitres</option>
                        <option value="Pcs">Pieces</option>
                        <option value="Box">Boxes</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Batch / Lot</Label>
                      <Input className="h-9 text-sm mt-1 col-span-1" value={it.batch_lot}
                        onChange={e => setItem(idx, 'batch_lot', e.target.value)} placeholder="Optional" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Item
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Goods Receipt Notes</label>
            <textarea
              rows={2}
              placeholder="Overall notes, discrepancies..."
              value={grnNotes}
              onChange={e => setGrnNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none"
            />
          </div>

          <Button
            onClick={handleSubmitClick}
            disabled={submitting || validItems.length === 0}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-base"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {submitting ? 'Confirming...' : (checklistTemplate ? 'Next: Complete Checklist →' : 'Confirm Goods Receipt')}
          </Button>
        </div>
      )}
    </div>
  );
}