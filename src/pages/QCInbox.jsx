import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, FlaskConical, Search, CheckCircle2, XCircle, AlertCircle, Camera } from 'lucide-react';
import { GRN_STATUS_COLOR, logGrnAudit, getChecklistTemplate } from '@/components/grn/grnHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import { getWorkflowBin, moveAfterQC } from '@/components/grn/stockLedger';
import ChecklistGate from '@/components/grn/ChecklistGate';

const RESULT_OPTS = [
  { v: 'PASS', label: 'PASS', cls: 'bg-green-600 hover:bg-green-700' },
  { v: 'HOLD', label: 'HOLD', cls: 'bg-amber-500 hover:bg-amber-600' },
  { v: 'FAIL', label: 'FAIL', cls: 'bg-red-600 hover:bg-red-700' },
];

function computeOverall(items) {
  if (items.some(i => i.result === 'FAIL')) return 'FAIL';
  if (items.some(i => i.result === 'HOLD')) return 'HOLD';
  if (items.every(i => i.result === 'PASS')) return 'PASS';
  return null;
}

function ResultBadge({ result }) {
  const cls = result === 'PASS' ? 'bg-green-100 text-green-700' : result === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{result}</span>;
}

export default function QCInbox() {
  const [user, setUser] = useState(null);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [grnItems, setGrnItems] = useState([]);
  const [itemResults, setItemResults] = useState({}); // id -> {result, defect_notes, sample_qty}
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [checklistTmpl, setChecklistTmpl] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const [u, data] = await Promise.all([
      base44.auth.me(),
      base44.entities.GRNHeader.filter({ status: 'SUBMITTED_TO_QC' }, '-created_date', 100),
    ]);
    setUser(u);
    setGrns(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function selectGRN(grn) {
    setSelected(grn);
    setNotes('');
    setPhotos([]);
    setDone(null);
    setShowChecklist(false);
    const its = await base44.entities.GRNItem.filter({ grn_id: grn.grn_id });
    setGrnItems(its);
    const ir = {};
    its.forEach(it => { ir[it.id] = { result: 'PASS', defect_notes: '', sample_qty: it.received_qty || 0, received_qty: it.received_qty || 0, sku_code: it.item_code }; });
    setItemResults(ir);
    const tmpl = await getChecklistTemplate('QC', 'INSPECT');
    setChecklistTmpl(tmpl);
  }

  async function uploadPhoto(file) {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotos(p => [...p, file_url]);
    setUploading(false);
  }

  function setItemResult(id, field, val) {
    setItemResults(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }

  async function handleSubmitClick() {
    if (checklistTmpl) { setShowChecklist(true); return; }
    await finalizeQC(null);
  }

  async function handleChecklistDone(runId) {
    await finalizeQC(runId);
  }

  async function finalizeQC(checklistRunId) {
    setSubmitting(true);
    const itemArr = Object.values(itemResults);
    const overall = computeOverall(itemArr) || 'PASS';
    const qc_id = `QC-${Date.now().toString(36).toUpperCase()}`;

    // Create QCInspection header
    await base44.entities.QCInspection.create({
      qc_id,
      grn_id: selected.grn_id,
      status: overall,
      inspected_by: user?.email || '',
      inspected_at: new Date().toISOString(),
      notes,
      checklist_run_id: checklistRunId || '',
      photos_json: photos.length ? JSON.stringify(photos) : '',
    });

    // Create per-item QCInspectionItems
    const grnItemMap = {};
    grnItems.forEach(it => { grnItemMap[it.id] = it; });
    await Promise.all(
      Object.entries(itemResults).map(([id, r]) => {
        const grnIt = grnItemMap[id] || {};
        return base44.entities.QCInspectionItem.create({
          qc_id,
          sku_code: r.sku_code || grnIt.item_code || '',
          item_name: grnIt.item_name || '',
          grn_item_ref: id,
          sample_qty: r.sample_qty || 0,
          received_qty: r.received_qty || 0,
          result: r.result,
          defect_notes: r.defect_notes || '',
        });
      })
    );

    // Update GRN status
    const newGrnStatus = overall === 'PASS' ? 'QC_PASSED' : overall === 'FAIL' ? 'QC_FAILED' : 'QC_HOLD';
    await base44.entities.GRNHeader.update(selected.id, { status: newGrnStatus });

    // Stock movements
    const qcBin = await getWorkflowBin('QC_HOLD');
    const passItems = itemArr.filter(i => i.result === 'PASS');
    const failItems = itemArr.filter(i => i.result === 'FAIL');

    if (qcBin) {
      if (passItems.length) {
        const stagingBin = await getWorkflowBin('RECEIVING') || await getWorkflowBin('DEFAULT_PUTAWAY');
        if (stagingBin) await moveAfterQC(passItems, qc_id, qcBin, stagingBin, 'QC_PASS_MOVE', user?.email);
      }
      if (failItems.length) {
        const rejBin = await getWorkflowBin('REJECTED') || await getWorkflowBin('RTV');
        if (rejBin) await moveAfterQC(failItems, qc_id, qcBin, rejBin, 'QC_FAIL_MOVE', user?.email);
      }
    }

    await logGrnAudit({ action: `QC_RESULT_${overall}`, entity_type: 'QCInspection', entity_id: qc_id, details: { grn_id: selected.grn_id, overall }, user });

    setDone({ qc_id, overall });
    setSubmitting(false);
    load();
  }

  const filtered = grns.filter(g => {
    const q = search.toLowerCase();
    return !q || (g.grn_id || '').toLowerCase().includes(q) || (g.supplier_name || '').toLowerCase().includes(q) || (g.po_id || '').toLowerCase().includes(q);
  });

  const overall = Object.keys(itemResults).length ? computeOverall(Object.values(itemResults)) : null;

  if (!selected) return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">QC Inbox</h1>
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><RefreshCw className="w-5 h-5" /></button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search GRN, supplier, PO…"
          className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm" />
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
        : filtered.length === 0
          ? <div className="text-center py-12 text-slate-400"><FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="font-semibold">No GRNs awaiting QC.</p></div>
          : filtered.map(g => (
            <button key={g.id} onClick={() => selectGRN(g)} className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">{g.grn_id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRN_STATUS_COLOR[g.status]}`}>{g.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{g.supplier_name || '—'}</p>
                  <p className="text-xs text-slate-400">{g.po_id ? `PO: ${g.po_id}` : 'No PO'} · Gate: {g.gate_id || '—'}</p>
                </div>
                <span className="text-blue-500 text-sm font-semibold">Start QC →</span>
              </div>
            </button>
          ))
      }
    </div>
  );

  if (done) return (
    <div className="max-w-md mx-auto pt-12 text-center space-y-4">
      {done.overall === 'PASS' ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" /> : done.overall === 'FAIL' ? <XCircle className="w-16 h-16 text-red-500 mx-auto" /> : <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />}
      <h2 className="text-2xl font-bold text-slate-900">QC {done.overall}</h2>
      <p className="text-slate-500 font-mono">{done.qc_id}</p>
      <p className="text-sm text-slate-400">{done.overall === 'PASS' ? 'Stock moved to staging bin. Proceed to Putaway.' : done.overall === 'HOLD' ? 'Stock remains in QC Hold. Re-inspect later.' : 'Stock moved to Rejected/RTV bin.'}</p>
      <Button onClick={() => { setSelected(null); setDone(null); }} className="w-full h-12 bg-slate-900">← Back to QC Inbox</Button>
    </div>
  );

  if (showChecklist && checklistTmpl) return (
    <div className="max-w-lg mx-auto space-y-4 pb-12">
      <button onClick={() => setShowChecklist(false)} className="text-blue-500 text-sm font-semibold">← Back to Results</button>
      <h2 className="text-lg font-bold text-slate-900">QC Checklist — {selected.grn_id}</h2>
      <ChecklistGate template={checklistTmpl} entityId={selected.grn_id} entityType="GRNHeader" user={user}
        onComplete={handleChecklistDone} onSkip={() => finalizeQC(null)} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <div className="flex items-center gap-2">
        <button onClick={() => setSelected(null)} className="text-blue-500 text-sm font-semibold">← Back</button>
        <span className="font-bold text-slate-900">{selected.grn_id}</span>
        <span className="text-xs text-slate-400">{selected.supplier_name || '—'} {selected.po_id ? `· PO: ${selected.po_id}` : ''}</span>
      </div>

      {/* Overall preview */}
      {overall && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border font-semibold text-sm ${overall === 'PASS' ? 'bg-green-50 border-green-200 text-green-800' : overall === 'FAIL' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          Overall: {overall} &nbsp;·&nbsp; {Object.values(itemResults).filter(i => i.result === 'PASS').length} pass / {Object.values(itemResults).filter(i => i.result === 'FAIL').length} fail / {Object.values(itemResults).filter(i => i.result === 'HOLD').length} hold
        </div>
      )}

      {/* Per-item results */}
      <div className="space-y-3">
        {grnItems.map(it => {
          const r = itemResults[it.id] || {};
          return (
            <div key={it.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{it.item_name || it.item_code}</p>
                  <p className="text-xs text-slate-400">Received: {it.received_qty} {it.uom_code}</p>
                </div>
                {r.result && <ResultBadge result={r.result} />}
              </div>
              <div className="flex gap-1.5">
                {RESULT_OPTS.map(opt => (
                  <button key={opt.v} onClick={() => setItemResult(it.id, 'result', opt.v)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all ${r.result === opt.v ? opt.cls : 'bg-slate-200 text-slate-500'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Sample Qty</label>
                  <input type="number" value={r.sample_qty || ''} onChange={e => setItemResult(it.id, 'sample_qty', Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              </div>
              {(r.result === 'HOLD' || r.result === 'FAIL') && (
                <input type="text" placeholder="Defect notes (required for HOLD/FAIL)…" value={r.defect_notes || ''}
                  onChange={e => setItemResult(it.id, 'defect_notes', e.target.value)}
                  className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-xs" />
              )}
            </div>
          );
        })}
      </div>

      {/* Header notes + photos */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Overall Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Inspection notes…" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none" />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {photos.map((p, i) => <img key={i} src={p} alt="" className="w-16 h-12 object-cover rounded-lg border border-slate-200" />)}
        <label className="flex items-center gap-1 text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer hover:border-blue-400">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          Add Photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
        </label>
      </div>

      <Button onClick={handleSubmitClick} disabled={submitting || !overall}
        className={`w-full h-12 ${overall === 'PASS' ? 'bg-green-600 hover:bg-green-700' : overall === 'FAIL' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        {checklistTmpl ? 'Next: Checklist →' : `Submit QC — ${overall || '...'}`}
      </Button>
    </div>
  );
}