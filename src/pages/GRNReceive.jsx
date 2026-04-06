import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle2, Plus, Trash2, Search, AlertTriangle, Camera } from 'lucide-react';
import { logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent, linkFMSRef } from '@/lib/useFMSAutoComplete';
import ChecklistGate from '@/components/grn/ChecklistGate';
import { useToast } from '@/components/ui/use-toast';
import { SweetAlertModal, ValidationAlert } from '@/components/store/SweetAlert';
import GRNItemCard from '@/components/store/GRNItemCard';

function emptyItem() {
  return { item_code: '', item_name: '', quantity: '', uom: 'Nos', batch_lot: '', expiry_date: '', mfg_date: '', material_photo: '', supplier_name: '', notes: '', _rules: null };
}

export default function GRNReceive() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [gateEntries, setGateEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([emptyItem()]);
  const [grnNotes, setGrnNotes] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [search, setSearch] = useState('');
  const [storeItems, setStoreItems] = useState([]);
  const [alertConfig, setAlertConfig] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gateIdParam = params.get('gate_id');
    load(gateIdParam);
  }, []);

  async function load(autoSelectGateId) {
    setLoading(true);
    const [u, entries, existingGrns, masterItems, approvedSuppliers] = await Promise.all([
      base44.auth.me(),
      base44.entities.GateEntry.filter({ status: 'OPEN' }, '-created_date', 100),
      base44.entities.GRNHeader.list('-created_date', 200),
      base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500),
      base44.entities.Supplier.filter({ approval_status: 'APPROVED' }, 'supplier_name', 500).catch(() => []),
    ]);
    setUser(u);
    setStoreItems(masterItems);
    setSuppliers(approvedSuppliers);

    const usedGateIds = new Set(existingGrns.map(g => g.gate_id).filter(Boolean));
    const pending = entries.filter(e => !usedGateIds.has(e.gate_id));
    setGateEntries(pending);

    if (autoSelectGateId) {
      const match = pending.find(e => e.gate_id === autoSelectGateId)
        || entries.find(e => e.gate_id === autoSelectGateId);
      if (match) selectGateEntry(match);
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

  function onSelectMasterItem(idx, masterItem) {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      item_name: masterItem.item_name,
      item_code: masterItem.item_code || masterItem.item_name,
      uom: masterItem.uom || 'Nos',
      _rules: {
        batch_required: masterItem.batch_required,
        expiry_required: masterItem.expiry_required,
        mfg_date_required: masterItem.mfg_date_required,
        qc_required: masterItem.qc_required,
        min_shelf_life_days: masterItem.min_shelf_life_days,
        material_photo: masterItem.material_photo,
      },
    } : it));
  }

  const validItems = items.filter(it => it.item_name.trim() && parseFloat(it.quantity) > 0);

  function validateItems() {
    const errors = [];
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const rules = it._rules;
      if (rules?.batch_required && !it.batch_lot?.trim()) {
        errors.push(`Item ${i + 1} (${it.item_name}): Batch / Lot number is required`);
      }
      if (rules?.expiry_required && !it.expiry_date) {
        errors.push(`Item ${i + 1} (${it.item_name}): Expiry date is required`);
      }
      if (rules?.mfg_date_required && !it.mfg_date) {
        errors.push(`Item ${i + 1} (${it.item_name}): Manufacture date is required`);
      }
      if (!it.material_photo && !rules?.material_photo) {
        // Material photo warning (not blocking if master has one)
      }
    }
    return errors;
  }

  async function handleSubmitClick() {
    if (validItems.length === 0) {
      setAlertConfig({ open: true, type: 'warning', title: 'No Items', message: 'Please add at least one item with a valid quantity.' });
      return;
    }

    const errors = validateItems();
    if (errors.length > 0) {
      setAlertConfig({
        open: true, type: 'error', title: 'Validation Errors',
        message: errors.join('\n'),
      });
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

    // Collect unique supplier names from items
    const uniqueSuppliers = [...new Set(validItems.map(it => it.supplier_name).filter(Boolean))];

    const grnHeader = await base44.entities.GRNHeader.create({
      grn_id,
      gate_id: selected.gate_id,
      supplier_name: uniqueSuppliers.join(', '),
      status: 'RECEIVED',
      received_at: new Date().toISOString(),
      received_by: user?.email || '',
      notes: grnNotes,
      ...(checklistRunId ? { checklist_run_id: checklistRunId } : {}),
    });

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
        item_code: it.item_code || it.item_name,
        item_name: it.item_name,
        uom: it.uom || 'Nos',
        quantity: qty, remaining_quantity: qty,
        mfg_date: it.mfg_date || undefined,
        expiry_date: it.expiry_date || undefined,
        supplier_name: it.supplier_name || '',
        gate_entry_id: selected.gate_id, grn_id,
        status: it._rules?.qc_required ? 'approved' : 'approved',
      });
    }

    await base44.entities.GateEntry.update(selected.id, { status: 'PROCESSED' });

    await logGrnAudit({
      action: 'GRN_RECEIVED', entity_type: 'GRNHeader',
      entity_id: grn_id, details: { gate_id: selected.gate_id, item_count: validItems.length, suppliers: uniqueSuppliers }, user,
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



  // ── Success ─────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center space-y-4 px-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Goods Received Note Confirmed</h2>
        <p className="text-slate-500 font-mono text-lg">{done.grn_id}</p>
        <p className="text-sm text-slate-400">Gate Entry: {done.gate_id} · {done.item_count} item lot(s) created</p>
        <Button onClick={() => { setSelected(null); setDone(null); }} className="w-full h-12 bg-slate-900">
          Back to Gate Entry List
        </Button>
      </div>
    );
  }

  // ── Checklist ────────────────────────────────────────────────
  if (showChecklist && checklistTemplate) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-12 px-2 md:px-0">
        <h2 className="text-lg font-bold text-slate-900">Goods Received Note Checklist</h2>
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
      {alertConfig && (
        <SweetAlertModal
          open={alertConfig.open}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          onClose={() => setAlertConfig(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">GRN (Goods Received Note)</h1>
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
              <p className="text-xs mt-1">Complete a Gate Entry first to create a Goods Received Note.</p>
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
                <GRNItemCard
                  key={idx}
                  index={idx}
                  item={it}
                  storeItems={storeItems}
                  suppliers={suppliers}
                  canRemove={items.length > 1}
                  onUpdate={(k, v) => setItem(idx, k, v)}
                  onSelectMasterItem={(masterItem) => onSelectMasterItem(idx, masterItem)}
                  onRemove={() => removeItem(idx)}
                />
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Goods Received Notes</label>
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
            {submitting ? 'Confirming...' : (checklistTemplate ? 'Next: Complete Checklist →' : 'Confirm Goods Received Note')}
          </Button>
        </div>
      )}
    </div>
  );
}