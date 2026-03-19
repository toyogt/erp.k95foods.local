import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, Camera, Search } from 'lucide-react';
import { GRN_STATUS_COLOR, logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import { postGRNtoQCHold } from '@/components/grn/stockLedger';
import ChecklistGate from '@/components/grn/ChecklistGate';

function GRNItemRow({ item, onChange }) {
  const [receivedQty, setReceivedQty] = useState(String(item.received_qty ?? ''));
  const [damagedQty, setDamagedQty] = useState(String(item.damaged_qty ?? '0'));
  const [batchText, setBatchText] = useState(item.batch_or_lot_text || '');
  const [lineNotes, setLineNotes] = useState(item.line_notes || '');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  function emit() {
    onChange({
      ...item,
      received_qty: Number(receivedQty) || 0,
      damaged_qty: Number(damagedQty) || 0,
      batch_or_lot_text: batchText,
      line_notes: lineNotes,
      photos_json: photoUrl ? JSON.stringify([photoUrl]) : item.photos_json,
    });
  }

  async function handlePhoto(file) {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  }

  useEffect(() => { emit(); }, [receivedQty, damagedQty, batchText, lineNotes, photoUrl]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{item.item_name || item.item_code}</p>
          <p className="text-xs text-slate-400">{item.item_code} · Ordered: {item.ordered_qty} {item.uom_code}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-0.5">Received Qty <span className="text-red-500">*</span></label>
          <input type="number" value={receivedQty} onChange={e => setReceivedQty(e.target.value)} onBlur={emit}
            placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-0.5">Damaged Qty</label>
          <input type="number" value={damagedQty} onChange={e => setDamagedQty(e.target.value)} onBlur={emit}
            placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <input type="text" value={batchText} onChange={e => setBatchText(e.target.value)} onBlur={emit}
        placeholder="Batch / Lot # (optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
      <input type="text" value={lineNotes} onChange={e => setLineNotes(e.target.value)} onBlur={emit}
        placeholder="Line notes…" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
      <label className="flex items-center gap-2 cursor-pointer">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-16 h-12 object-cover rounded-lg border border-slate-200" />
        ) : (
          <span className="flex items-center gap-1 text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:border-blue-400">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            {uploading ? 'Uploading…' : 'Add Photo'}
          </span>
        )}
        <input type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
      </label>
    </div>
  );
}

export default function GRNReceive() {
  const [user, setUser] = useState(null);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [grnItems, setGrnItems] = useState([]);
  const [itemEdits, setItemEdits] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const [u, data] = await Promise.all([
      base44.auth.me(),
      base44.entities.GRNHeader.filter({ status: 'DRAFT' }, '-created_date', 100),
    ]);
    setUser(u);
    setGrns(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function selectGRN(grn) {
    setSelected(grn);
    setDone(false);
    setShowChecklist(false);
    setItemEdits({});
    const its = await base44.entities.GRNItem.filter({ grn_id: grn.grn_id });
    setGrnItems(its);
    const edits = {};
    its.forEach(it => { edits[it.id] = it; });
    setItemEdits(edits);
    // Pre-load checklist config
    const tmpl = await getChecklistTemplate('GRN', 'RECEIVE');
    setChecklistTemplate(tmpl);
  }

  function handleItemChange(updated) {
    setItemEdits(prev => ({ ...prev, [updated.id]: updated }));
  }

  async function handleChecklistDone(runId) {
    await finalizeSubmit(runId);
  }

  async function handleSubmitClick() {
    if (checklistTemplate) {
      setShowChecklist(true);
    } else {
      await finalizeSubmit(null);
    }
  }

  async function finalizeSubmit(checklistRunId) {
    setSubmitting(true);
    // Save all item edits
    const updates = Object.values(itemEdits);
    await Promise.all(updates.map(it =>
      base44.entities.GRNItem.update(it.id, {
        received_qty: it.received_qty,
        damaged_qty: it.damaged_qty || 0,
        batch_or_lot_text: it.batch_or_lot_text || '',
        line_notes: it.line_notes || '',
        photos_json: it.photos_json || '',
      })
    ));
    // Update GRN header
    const headerUpdate = {
      status: 'SUBMITTED_TO_QC',
      received_at: new Date().toISOString(),
      received_by: user?.email || '',
    };
    if (checklistRunId) headerUpdate.checklist_run_id = checklistRunId;
    await base44.entities.GRNHeader.update(selected.id, headerUpdate);

    // Post received items into QC_HOLD bin
    const finalItems = Object.values(itemEdits).filter(it => (it.received_qty || 0) > 0);
    await postGRNtoQCHold({ grn_id: selected.grn_id }, finalItems, user?.email || '').catch(e => console.warn('Stock post error:', e.message));

    await logGrnAudit({
      action: 'GRN_SUBMITTED_TO_QC',
      entity_type: 'GRNHeader',
      entity_id: selected.grn_id,
      details: { po_id: selected.po_id, item_count: updates.length },
      user,
    });

    setDone(true);
    setSubmitting(false);
    load();
  }

  const filteredGrns = grns.filter(g => {
    const q = search.toLowerCase();
    return !q || (g.grn_id || '').toLowerCase().includes(q) ||
      (g.supplier_name || '').toLowerCase().includes(q) ||
      (g.po_id || '').toLowerCase().includes(q) ||
      (g.gate_id || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">GRN Receive</h1>
        <button onClick={load} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {!selected ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search GRN ID, supplier, PO, gate ID…"
              className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm" />
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : filteredGrns.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="font-semibold">No draft GRNs found.</p>
              <p className="text-xs mt-1">Create GRNs from Gate Inbox first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGrns.map(g => (
                <button key={g.id} onClick={() => selectGRN(g)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono">{g.grn_id}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRN_STATUS_COLOR[g.status]}`}>{g.status}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{g.supplier_name || '—'}</p>
                      <p className="text-xs text-slate-400">{g.po_id ? `PO: ${g.po_id}` : 'No PO linked'} · Gate: {g.gate_id || '—'}</p>
                    </div>
                    <span className="text-blue-500 text-sm font-semibold">Open →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : done ? (
        <div className="text-center space-y-4 py-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">Submitted to QC</h2>
          <p className="text-slate-500">{selected.grn_id}</p>
          <Button onClick={() => { setSelected(null); setDone(false); }} className="w-full h-12 bg-slate-900">Back to GRN List</Button>
        </div>
      ) : showChecklist && checklistTemplate ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">GRN Checklist</h2>
          <ChecklistGate
            template={checklistTemplate}
            entityId={selected.grn_id}
            entityType="GRNHeader"
            user={user}
            onComplete={handleChecklistDone}
            onSkip={() => finalizeSubmit(null)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(null)} className="text-blue-500 text-sm font-semibold">← Back</button>
            <div>
              <span className="font-bold text-slate-900">{selected.grn_id}</span>
              {selected.po_id && <span className="text-xs text-slate-400 ml-2">PO: {selected.po_id}</span>}
              {!selected.po_id && <span className="text-xs text-amber-600 ml-2 font-semibold">No PO linked</span>}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-sm">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Supplier: <span className="font-semibold text-slate-700">{selected.supplier_name || '—'}</span></span>
              <span>Gate: <span className="font-semibold text-slate-700">{selected.gate_id || '—'}</span></span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {grnItems.length === 0 && (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm">No items. GRN was created without a PO.</p>
                <p className="text-xs mt-1">You can still submit and note details manually.</p>
              </div>
            )}
            {grnItems.map(it => (
              <GRNItemRow key={it.id} item={itemEdits[it.id] || it} onChange={handleItemChange} />
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">GRN Notes</label>
            <textarea rows={2} placeholder="Overall notes, discrepancies…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none"
              onChange={e => setSelected(prev => ({ ...prev, notes: e.target.value }))} />
          </div>

          <Button onClick={handleSubmitClick} disabled={submitting}
            className="w-full h-12 bg-green-600 hover:bg-green-700">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {checklistTemplate ? 'Next: Complete Checklist →' : 'Submit GRN to QC'}
          </Button>
        </div>
      )}
    </div>
  );
}