import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle2, Plus, Search, ListChecks, FileText, Eye, ChevronRight, ExternalLink } from 'lucide-react';
import GRNDetailModal from '@/components/store/GRNDetailModal';
import InvoicePreviewModal from '@/components/store/InvoicePreviewModal';
import { logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import ChecklistGate from '@/components/grn/ChecklistGate';
import GRNItemCard from '@/components/store/GRNItemCard';
import GRNPrintTemplate from '@/components/store/GRNPrintTemplate';
import GRNManualSupplierSelect from '@/components/store/GRNManualSupplierSelect';
import GRNPOItemPicker from '@/components/store/GRNPOItemPicker';
import { showErrorAlert, showWarningAlert, showValidationErrors } from '@/lib/toastHelpers';
import { formatDateTime, formatDate } from '@/lib/dateFormatter';
import Swal from 'sweetalert2';
import useDraftSave from '@/hooks/useDraftSave';

import TablePagination from '@/components/store/TablePagination';


function GRNTable({ grns, allGateEntries, onViewInvoice, onOpenGrn }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  if (!grns || grns.length === 0) {
    return <div className="text-center py-12 text-slate-400"><p className="font-semibold">No records found.</p></div>;
  }
  const paged = grns.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs">
              <th className="text-left px-4 py-3 font-medium">Goods Received Note ID</th>
              <th className="text-left px-4 py-3 font-medium">Gate Entry</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">Invoice Number</th>
              <th className="text-left px-4 py-3 font-medium">Invoice Date</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Received By</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-center px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.map(g => {
              const gateEntry = allGateEntries?.[g.gate_id];
              const invoiceUrl = gateEntry?.invoice_photo;
              return (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{g.grn_id}</td>
                  <td className="px-4 py-3 text-slate-600">{g.gate_id || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{g.supplier_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{g.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(g.invoice_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      g.status === 'RECEIVED' ? 'bg-green-100 text-green-700' :
                      g.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>{g.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{g.received_by || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDateTime(g.received_at || g.created_date)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onOpenGrn(g)} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="View Details">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {invoiceUrl && (
                        <button onClick={() => onViewInvoice(invoiceUrl)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="View Invoice">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination total={grns.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  );
}

function emptyItem() {
  return { item_code: '', item_name: '', original_quantity: '', quantity: '', qty_mismatch: 'no', mismatch_type: 'none', mismatch_reason: '', uom: 'Nos', batch_lot: '', expiry_date: '', mfg_date: '', material_photo: '', notes: '', _rules: null };
}

const GRN_DRAFT_INITIAL = { items: [emptyItem()], grnNotes: '', selectedGateId: '', supplierName: '', invoiceNumber: '', invoiceDate: '', freightAmount: '', freightNotes: '' };

export default function GRNReceive() {
  const [user, setUser] = useState(null);
  const [gateEntries, setGateEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [draft, setDraftState, clearGrnDraft, hasGrnDraft] = useDraftSave('grn_receive', GRN_DRAFT_INITIAL);
  const [items, setItemsRaw] = useState(draft.items || [emptyItem()]);
  const [grnNotes, setGrnNotesRaw] = useState(draft.grnNotes || '');
  const [supplierName, setSupplierNameRaw] = useState(draft.supplierName || '');
  const [invoiceNumber, setInvoiceNumberRaw] = useState(draft.invoiceNumber || '');
  const [invoiceDate, setInvoiceDateRaw] = useState(draft.invoiceDate || '');
  const [freightAmount, setFreightAmountRaw] = useState(draft.freightAmount || '');
  const [freightNotes, setFreightNotesRaw] = useState(draft.freightNotes || '');
  function setFreightAmount(v) { setFreightAmountRaw(v); setDraftState(d => ({ ...d, freightAmount: v })); }
  function setFreightNotes(v) { setFreightNotesRaw(v); setDraftState(d => ({ ...d, freightNotes: v })); }
  function setSupplierName(v) {
    setSupplierNameRaw(v);
    setDraftState(d => ({ ...d, supplierName: v }));
  }
  function setInvoiceNumber(v) {
    setInvoiceNumberRaw(v);
    setDraftState(d => ({ ...d, invoiceNumber: v }));
  }
  function setInvoiceDate(v) {
    setInvoiceDateRaw(v);
    setDraftState(d => ({ ...d, invoiceDate: v }));
  }

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
  const [allGateMap, setAllGateMap] = useState({});
  const [selectedGrn, setSelectedGrn] = useState(null);
  const [poPickedItems, setPoPickedItems] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gateIdParam = params.get('gate_id');
    load(gateIdParam);
  }, []);

  async function load(autoSelectGateId) {
    setLoading(true);
    const [u, entries, existingGrns, masterItems, allGates] = await Promise.all([
      base44.auth.me(),
      base44.entities.GateEntry.filter({ status: 'OPEN' }, '-created_date', 100),
      base44.entities.GRNHeader.list('-created_date', 200),
      base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500),
      base44.entities.GateEntry.list('-created_date', 500),
    ]);
    const gateMap = {};
    allGates.forEach(g => { gateMap[g.gate_id] = g; });
    setAllGateMap(gateMap);
    setUser(u);
    setStoreItems(masterItems);
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
    if (draft.selectedGateId === entry.gate_id && draft.items?.length > 0) {
      setItemsRaw(draft.items);
      setGrnNotesRaw(draft.grnNotes || '');
      setSupplierNameRaw(draft.supplierName || '');
      setInvoiceNumberRaw(draft.invoiceNumber || '');
      setInvoiceDateRaw(draft.invoiceDate || '');
      setFreightAmountRaw(draft.freightAmount || '');
      setFreightNotesRaw(draft.freightNotes || '');
    } else {
      setItemsRaw([emptyItem()]);
      setGrnNotesRaw('');
      setSupplierNameRaw('');
      setInvoiceNumberRaw('');
      setInvoiceDateRaw('');
      setFreightAmountRaw('');
      setFreightNotesRaw('');
      setDraftState(d => ({ ...d, selectedGateId: entry.gate_id, items: [emptyItem()], grnNotes: '', supplierName: '', invoiceNumber: '', invoiceDate: '', freightAmount: '', freightNotes: '' }));
    }
    setDone(null);
    setShowChecklist(false);
    setPoPickedItems([]);
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

  function validateForm() {
    const errors = [];
    if (!supplierName.trim()) errors.push('Supplier Name is required.');
    if (!invoiceNumber.trim()) errors.push('Invoice Number is required.');
    if (!invoiceDate) errors.push('Invoice Date is required.');

    // Validate PO picked items
    for (const pi of poPickedItems) {
      if (pi.receive_now > pi.pending_qty) {
        errors.push(`${pi.item_name}: Receive quantity (${pi.receive_now}) exceeds pending quantity (${pi.pending_qty}).`);
      }
    }

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
    }
    return errors;
  }

  async function handleSubmitClick() {
    const hasPoItems = poPickedItems.length > 0;
    if (validItems.length === 0 && !hasPoItems) {
      showWarningAlert('No Items', 'Please select items from Purchase Orders or add items manually.');
      return;
    }

    const errors = validateForm();
    if (errors.length > 0) {
      showValidationErrors('Please fix the following issues:', errors);
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


    const freightVal = freightAmount ? parseFloat(freightAmount) : 0;
    const grnHeader = await base44.entities.GRNHeader.create({
      grn_id,
      gate_id: selected.gate_id,
      supplier_name: supplierName,
      invoice_number: invoiceNumber || undefined,
      invoice_date: invoiceDate || undefined,
      status: 'RECEIVED',
      received_at: new Date().toISOString(),
      received_by: user?.email || '',
      notes: grnNotes,
      freight_amount: freightVal || undefined,
      freight_notes: freightNotes || undefined,
      ...(checklistRunId ? { checklist_run_id: checklistRunId } : {}),
    });

    // --- Process PO-picked items ---
    const linkedPoIds = new Set();
    let totalItemCount = 0;
    for (const poItem of poPickedItems) {
      const receiveQty = parseFloat(poItem.receive_now) || 0;
      if (receiveQty <= 0) continue;

      linkedPoIds.add(poItem.po_id);
      totalItemCount++;

      await base44.entities.GRNItem.create({
        grn_id,
        item_code: poItem.item_code,
        item_name: poItem.item_name,
        ordered_qty: poItem.ordered_qty,
        received_qty: receiveQty,
        uom_code: poItem.uom_code || 'Nos',
        po_id: poItem.po_id,
        line_notes: '',
        mismatch_type: receiveQty < poItem.pending_qty ? 'decreased' : 'none',
      });

      const lotId = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await base44.entities.StoreLot.create({
        lot_id: lotId, qr_code: lotId,
        item_code: poItem.item_code,
        item_name: poItem.item_name,
        uom: poItem.uom_code || 'Nos',
        original_quantity: poItem.ordered_qty,
        quantity: receiveQty, remaining_quantity: receiveQty,
        supplier_name: supplierName || '',
        invoice_number: invoiceNumber || '',
        invoice_date: invoiceDate || '',
        gate_entry_id: selected.gate_id, grn_id,
        status: 'approved',
      });

      // Update PO item received_qty
      const poItemRecords = await base44.entities.PurchaseOrderItem.filter({
        po_id: poItem.po_id, item_code: poItem.item_code, line_number: poItem.line_number,
      }).catch(() => []);
      if (poItemRecords[0]) {
        const oldReceived = poItemRecords[0].received_qty || 0;
        const newReceived = oldReceived + receiveQty;
        const pendingAfter = Math.max(0, (poItemRecords[0].qty || poItemRecords[0].quantity || 0) - newReceived);
        await base44.entities.PurchaseOrderItem.update(poItemRecords[0].id, {
          received_qty: newReceived,
          pending_qty: pendingAfter,
        });
      }
    }

    // Update PO statuses
    for (const poId of linkedPoIds) {
      const poItemsAll = await base44.entities.PurchaseOrderItem.filter({ po_id: poId }).catch(() => []);
      const allFullyReceived = poItemsAll.every(it => {
        const ordered = it.qty || it.quantity || 0;
        return (it.received_qty || 0) >= ordered;
      });
      const poRecords = await base44.entities.PurchaseOrder.filter({ po_id: poId }).catch(() => []);
      if (poRecords[0]) {
        await base44.entities.PurchaseOrder.update(poRecords[0].id, {
          status: allFullyReceived ? 'Delivered' : 'Partially Received',
          linked_po_ids: undefined,
        });
      }
    }

    // Link GRN to POs
    if (linkedPoIds.size > 0) {
      await base44.entities.GRNHeader.update(grnHeader.id, {
        linked_po_ids: [...linkedPoIds],
        po_id: [...linkedPoIds][0],
      });
    }

    // --- Process manual items ---
    for (const it of validItems) {
      const originalQty = parseFloat(it.original_quantity || it.quantity);
      const receivedQty = it.qty_mismatch === 'yes' ? parseFloat(it.quantity) : originalQty;
      const mismatchType = it.qty_mismatch === 'yes' ? (it.mismatch_type || 'none') : 'none';
      totalItemCount++;

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
        batch_number: it.batch_lot || undefined,
        mfg_date: it.mfg_date || undefined,
        expiry_date: it.expiry_date || undefined,
        supplier_name: supplierName || '',
        invoice_number: invoiceNumber || '',
        invoice_date: invoiceDate || '',
        gate_entry_id: selected.gate_id, grn_id,
        status: 'approved',
      });
    }

    await base44.entities.GateEntry.update(selected.id, { status: 'PROCESSED' });

    await logGrnAudit({
      action: 'GRN_RECEIVED', entity_type: 'GRNHeader',
      entity_id: grn_id, details: { gate_id: selected.gate_id, item_count: totalItemCount, supplier: supplierName, invoice: invoiceNumber, linked_po_ids: [...linkedPoIds] }, user,
    });
    await fireFMSEvent('grn_received', grnHeader.id);

    setDone({ grn_id, gate_id: selected.gate_id, item_count: totalItemCount, items: validItems });
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

  useEffect(() => {
    if (activeTab === 'master') {
      allGrns.forEach(g => loadGrnItemsFor(g.grn_id));
    }
  }, [activeTab, allGrns]);

  // Show SweetAlert on GRN completion and auto-redirect
  useEffect(() => {
    if (done) {
      Swal.fire({
        icon: 'success',
        title: 'Goods Received Note Confirmed',
        html: `<p class="font-mono font-bold">${done.grn_id}</p><p>Gate Entry: ${done.gate_id} · ${done.item_count} item lot(s) created</p>`,
        confirmButtonText: 'View Print / Back',
        confirmButtonColor: '#0f172a',
      }).then(() => {});
    }
  }, [done]);

  if (done) {
    return (
      <div className="max-w-2xl mx-auto pt-8 text-center space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Goods Received Note Confirmed</h2>
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
              supplierName={supplierName}
              invoiceNumber={invoiceNumber}
              invoiceDate={invoiceDate}
              status="RECEIVED"
            />
          </div>
        </div>
        <Button onClick={() => { setSelected(null); setDone(null); }} className="w-full h-12 bg-slate-900">
          Back to Goods Received Note List
        </Button>
      </div>
    );
  }

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
  <motion.div className="space-y-4 pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {hasGrnDraft && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-700 font-medium">You have an unsaved draft</p>
          <button onClick={() => { clearGrnDraft(); setItemsRaw([emptyItem()]); setGrnNotesRaw(''); setSupplierNameRaw(''); setInvoiceNumberRaw(''); setInvoiceDateRaw(''); setFreightAmountRaw(''); setFreightNotesRaw(''); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear Draft</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Goods Received Note</h1>
        <button onClick={() => load()} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

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

      {activeTab === 'master' && <GRNTable grns={allGrns} allGateEntries={allGateMap} onViewInvoice={url => setInvoicePreview(url)} onOpenGrn={g => setSelectedGrn(g)} />}

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
            <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
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
                      <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => selectGateEntry(e)}>
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
                          {formatDateTime(e.arrived_at)}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={ev => ev.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            {e.invoice_photo && (
                              <button onClick={() => setInvoicePreview(e.invoice_photo)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="View Invoice">
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <Button size="sm" onClick={() => selectGateEntry(e)} className="h-9 gap-1.5 text-sm">
                              <Plus className="w-3.5 h-3.5" /> Create Goods Received Note
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {filteredEntries.map(e => (
                  <div key={e.id} className="px-4 py-3.5 active:bg-slate-50 cursor-pointer" onClick={() => selectGateEntry(e)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 font-mono">{e.gate_id}</p>
                        <p className="text-sm text-slate-600 mt-0.5">{e.vehicle_number || 'No vehicle'}{e.driver_name ? ` · ${e.driver_name}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{e.status}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span>{formatDateTime(e.arrived_at)}</span>
                      {e.invoice_photo && (
                        <button onClick={ev => { ev.stopPropagation(); setInvoicePreview(e.invoice_photo); }} className="flex items-center gap-1 text-blue-500 font-medium">
                          <Eye className="w-3.5 h-3.5" /> Invoice
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500 font-medium">{filteredEntries.length} entry(ies)</div>
            </div>
          )}
        </>
      )}

      {activeTab === 'create' && selected && (
        <div className="space-y-4">
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

          <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-5">
            <p className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Supplier & Invoice Details</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <GRNManualSupplierSelect
                  value={supplierName}
                  onChange={(name) => setSupplierName(name)}
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Invoice Number <span className="text-red-500">*</span></Label>
                <input className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2025-001" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Invoice Date <span className="text-red-500">*</span></Label>
                <input type="date" className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Purchase Order Picker — shows when supplier is selected */}
          {supplierName?.trim() && (
            <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-5">
              <GRNPOItemPicker
                supplierName={supplierName}
                onItemsSelected={setPoPickedItems}
              />
            </div>
          )}

          <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-5" style={{ overflow: 'visible' }}>
            <p className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
              {poPickedItems.length > 0 ? 'Additional Manual Items (Optional)' : 'Items Received'} <span className="text-red-500">{poPickedItems.length === 0 ? '*' : ''}</span>
            </p>
            <div className="space-y-3" style={{ overflow: 'visible' }}>
              {items.map((it, idx) => (
                <GRNItemCard
                  key={idx}
                  index={idx}
                  item={it}
                  storeItems={storeItems}
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

          {/* Freight Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
            <p className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Freight & Transport Cost</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Freight Amount (₹)</label>
                <input type="number" className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={freightAmount} onChange={e => setFreightAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Freight Notes / Transporter</label>
                <input className="h-11 text-sm mt-1 w-full border border-slate-200 rounded-xl px-3" value={freightNotes} onChange={e => setFreightNotes(e.target.value)} placeholder="e.g. ABC Transport, LR-12345" />
              </div>
            </div>
          </div>

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
            disabled={submitting || (validItems.length === 0 && poPickedItems.length === 0)}
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
      {selectedGrn && (
        <GRNDetailModal grn={selectedGrn} gateEntry={allGateMap[selectedGrn.gate_id]} onClose={() => setSelectedGrn(null)} />
      )}
    </motion.div>
  );
}