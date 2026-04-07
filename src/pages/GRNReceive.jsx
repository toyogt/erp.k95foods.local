import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle2, Plus, Trash2, Search, AlertTriangle, Camera, ListChecks, FileText } from 'lucide-react';
import InvoicePreviewModal from '@/components/store/InvoicePreviewModal';
import { logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent, linkFMSRef } from '@/lib/useFMSAutoComplete';
import ChecklistGate from '@/components/grn/ChecklistGate';
import GRNItemCard from '@/components/store/GRNItemCard';
import GRNPrintTemplate from '@/components/store/GRNPrintTemplate';
import { showErrorAlert, showWarningAlert, showValidationErrors, showSuccessToast } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import moment from 'moment';
import useDraftSave from '@/hooks/useDraftSave';

function GRNTable({ grns, title }) {
  if (!grns || grns.length === 0) {
    return <div className="text-center py-12 text-slate-400"><p className="font-semibold">No records found.</p></div>;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs">
              <th className="text-left px-4 py-3 font-medium">Goods Received Note ID</th>
              <th className="text-left px-4 py-3 font-medium">Gate Entry</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Received By</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grns.map(g => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-bold text-slate-900">{g.grn_id}</td>
                <td className="px-4 py-3 text-slate-600">{g.gate_id || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{g.supplier_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    g.status === 'RECEIVED' ? 'bg-green-100 text-green-700' :
                    g.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                    'bg-amber-100 text-amber-700'
                  }`}>{g.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{g.received_by || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {g.received_at ? moment(g.received_at).format('DD/MM/YYYY') : g.created_date ? moment(g.created_date).format('DD/MM/YYYY') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function emptyItem() {
  return { item_code: '', item_name: '', original_quantity: '', quantity: '', qty_mismatch: 'no', mismatch_type: 'none', mismatch_reason: '', uom: 'Nos', batch_lot: '', expiry_date: '', mfg_date: '', material_photo: '', supplier_name: '', notes: '', _rules: null };
}

const GRN_DRAFT_INITIAL = { items: [emptyItem()], grnNotes: '', selectedGateId: '' };

export default function GRNReceive() {
  const [user, setUser] = useState(null);
  const [gateEntries, setGateEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [draft, setDraftState, clearGrnDraft, hasGrnDraft] = useDraftSave('grn_receive', GRN_DRAFT_INITIAL);
  const [items, setItemsRaw] = useState(draft.items || [emptyItem()]);
  const [grnNotes, setGrnNotesRaw] = useState(draft.grnNotes || '');
  // Sync items/notes to draft
  function setItems(updater) {
    setItemsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setDraftState(d => ({ ...d, items: next }));
      return next;
    });
  }
  function setGrnNotes(v) {
    setGrnNotesRaw(v);
    setDraftState(d => ({ ...d, grnNotes: v }));
  }
  const [suppliers, setSuppliers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [search, setSearch] = useState('');
  const [storeItems, setStoreItems] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [allGrns, setAllGrns] = useState([]);
  const [grnItems, setGrnItems] = useState({});
  const [invoicePreview, setInvoicePreview] = useState(null);

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
    setAllGrns(existingGrns);

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
    // Restore draft items if selecting same gate entry
    if (draft.selectedGateId === entry.gate_id && draft.items?.length > 0) {
      setItemsRaw(draft.items);
      setGrnNotesRaw(draft.grnNotes || '');
    } else {
      setItemsRaw([emptyItem()]);
      setGrnNotesRaw('');
      setDraftState(d => ({ ...d, selectedGateId: entry.gate_id, items: [emptyItem()], grnNotes: '' }));
    }
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

  const validItems = items.filter(it => it.item_name.trim() && parseFloat(it.original_quantity || it.quantity) > 0);

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
      showWarningAlert('No Items', 'Please add at least one item with a valid quantity.');
      return;
    }

    const errors = validateItems();
    if (errors.length > 0) {
      showValidationErrors('Validation Errors', errors);
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
      const originalQty = parseFloat(it.original_quantity || it.quantity);
      const receivedQty = it.qty_mismatch === 'yes' ? parseFloat(it.quantity) : originalQty;
      const mismatchType = it.qty_mismatch === 'yes' ? (it.mismatch_type || 'none') : 'none';

      await base44.entities.GRNItem.create({
        grn_id,
        item_code: it.item_code || it.item_name,
        item_name: it.item_name,
        ordered_qty: originalQty,
        received_qty: receivedQty,
        uom_code: it.uom || 'Nos',
        batch_or_lot_text: it.batch_lot || '',
        line_notes: it.notes || '',
        mismatch_type: mismatchType,
        mismatch_reason: it.mismatch_reason || '',
        damaged_qty: mismatchType === 'damaged' ? (originalQty - receivedQty) : 0,
      });

      const lotId = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await base44.entities.StoreLot.create({
        lot_id: lotId, qr_code: lotId,
        item_code: it.item_code || it.item_name,
        item_name: it.item_name,
        uom: it.uom || 'Nos',
        original_quantity: originalQty,
        quantity: receivedQty, remaining_quantity: receivedQty,
        mismatch_type: mismatchType,
        mismatch_reason: it.mismatch_reason || '',
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

    setDone({ grn_id, gate_id: selected.gate_id, item_count: validItems.length, items: validItems });
    setSubmitting(false);
    clearGrnDraft();
    load();
  }

  const filteredEntries = gateEntries.filter(e => {
    const q = search.toLowerCase();
    return !q || (e.gate_id || '').toLowerCase().includes(q) ||
      (e.vehicle_number || '').toLowerCase().includes(q) ||
      (e.driver_name || '').toLowerCase().includes(q);
  });



  async function loadGrnItemsFor(grnId) {
    if (grnItems[grnId]) return;
    const itemsList = await base44.entities.GRNItem.filter({ grn_id: grnId });
    setGrnItems(prev => ({ ...prev, [grnId]: itemsList }));
  }

  // Load GRN items when viewing master tab
  useEffect(() => {
    if (activeTab === 'master') {
      allGrns.forEach(g => loadGrnItemsFor(g.grn_id));
    }
  }, [activeTab, allGrns]);

  // ── Success ─────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Goods Received Note Confirmed</h2>
        <p className="text-slate-500 font-mono text-lg">{done.grn_id}</p>
        <p className="text-sm text-slate-400">Gate Entry: {done.gate_id} · {done.item_count} item lot(s) created</p>
        <div className="flex gap-2 justify-center">
          <GRNPrintTemplate
            grnId={done.grn_id}
            gateId={done.gate_id}
            items={done.items || []}
            notes={grnNotes}
            receivedBy={user?.email}
            receivedAt={new Date().toISOString()}
          />
        </div>
        <Button onClick={() => { setSelected(null); setDone(null); }} className="w-full h-12 bg-slate-900">
          Back to Goods Received Note List
        </Button>
      </div>
    );
  }

  // ── Checklist ────────────────────────────────────────────────
  if (showChecklist && checklistTemplate) {
    return (
      <div className="space-y-4 pb-12">
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
  <div className="space-y-4 pb-12">
    <ToastContainer />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Goods Received Note</h1>
        <button onClick={() => load()} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex justify-center border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'create', label: 'Create New', icon: Plus },
          { id: 'master', label: `All Records (${allGrns.length})`, icon: ListChecks },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelected(null); setDone(null); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Master Tab */}
      {activeTab === 'master' && <GRNTable grns={allGrns} title="All Goods Received Notes" />}

      {/* Create Tab — Gate Entry Table */}
      {activeTab === 'create' && !selected && (
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
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Gate Entry ID</th>
                      <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                      <th className="text-left px-4 py-3 font-medium">Driver</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{e.gate_id}</td>
                        <td className="px-4 py-3 text-slate-700">{e.vehicle_number || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{e.driver_name || '—'}</p>
                          {e.driver_number && <p className="text-xs text-slate-400">{e.driver_number}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{e.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {e.arrived_at ? new Date(e.arrived_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button size="sm" onClick={() => selectGateEntry(e)} className="h-9 gap-1.5 text-sm">
                            <Plus className="w-3.5 h-3.5" /> Create Goods Received Note
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Tab — Items Entry Form */}
      {activeTab === 'create' && selected && (
        <div className="space-y-4">
          {/* Header — breadcrumb + gate info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => setSelected(null)} className="text-blue-500 font-semibold">← Back</button>
                <span className="text-slate-400">/</span>
                <span className="text-slate-500">Goods Received Notes</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                Goods Received Note <span className="font-mono text-base text-slate-500 ml-1">{selected.gate_id}</span>
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {selected.vehicle_number && <span>Vehicle: <strong className="text-slate-700">{selected.vehicle_number}</strong></span>}
              <span>Driver: <strong className="text-slate-700">{selected.driver_name || '—'}</strong></span>
              {selected.invoice_photo && (
                <button onClick={() => setInvoicePreview(selected.invoice_photo)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium">
                  <FileText className="w-3.5 h-3.5" /> View Invoice
                </button>
              )}
            </div>
          </div>

          {/* Draft banner */}
          {hasGrnDraft && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700 font-medium">You have an unsaved draft Goods Received Note for this entry</p>
              <button onClick={() => { clearGrnDraft(); setItemsRaw([emptyItem()]); setGrnNotesRaw(''); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear Draft</button>
            </div>
          )}

          {/* Items section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
            <p className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Items Received <span className="text-red-500">*</span></p>
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
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add another item
            </button>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
            <label className="block text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Goods Received Notes</label>
            <textarea
              rows={3}
              placeholder="Overall notes, discrepancies..."
              value={grnNotes}
              onChange={e => setGrnNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none"
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
      {invoicePreview && (
        <InvoicePreviewModal imageUrl={invoicePreview} title="Invoice Preview" onClose={() => setInvoicePreview(null)} />
      )}
    </div>
  );
}