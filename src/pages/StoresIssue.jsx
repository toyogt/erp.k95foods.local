import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/components/AuditLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronRight, CheckCircle2, ScanLine, ArrowLeft, AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

// Offline queue helper
function queueOffline(action) {
  const q = JSON.parse(localStorage.getItem('factory_offline_queue') || '[]');
  q.push({ ...action, id: crypto.randomUUID(), queued_at: new Date().toISOString() });
  localStorage.setItem('factory_offline_queue', JSON.stringify(q));
}

export default function StoresIssue() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState('list'); // list | issue
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    const data = await base44.entities.MaterialRequest.filter({ status: 'RELEASED' }, '-created_date');
    setRequests(data);
    setLoading(false);
  }

  async function selectRequest(req) {
    setSelected(req);
    setLoading(true);
    const lineData = await base44.entities.MaterialIssueLine.filter({ request_id: req.request_id });
    setLines(lineData.map(l => ({ ...l, _issued: l.qty_issued || 0, _lot: l.lot_no || '' })));
    setStep('issue');
    setLoading(false);
  }

  function updateLine(id, field, value) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  async function completeIssue() {
    setSaving(true);
    try {
      for (const line of lines) {
        const update = { qty_issued: Number(line._issued), lot_no: line._lot, status: 'ISSUED' };
        try {
          await base44.entities.MaterialIssueLine.update(line.id, update);
        } catch {
          queueOffline({ type: 'update', entity: 'MaterialIssueLine', entityId: line.id, data: update, userEmail: user?.email, userName: user?.full_name, auditAction: 'IssueLineUpdate', auditEntityId: line.id });
        }
      }
      try {
        await base44.entities.MaterialRequest.update(selected.id, { status: 'ISSUED' });
      } catch {
        queueOffline({ type: 'update', entity: 'MaterialRequest', entityId: selected.id, data: { status: 'ISSUED' }, userEmail: user?.email, userName: user?.full_name, auditAction: 'RequestIssued', auditEntityId: selected.request_id });
      }
      await logAudit({ action: `Completed issue for request ${selected.request_id}`, entity_type: 'MaterialRequest', entity_id: selected.request_id, user });
      showToast('Issue completed!', 'success');
      setTimeout(() => { setStep('list'); setSelected(null); loadRequests(); }, 1200);
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Request list ──────────────────────────────────────────────
  if (step === 'list') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stores Issue</h1>
          <p className="text-sm text-slate-500">Select a released material request</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-12 h-12 text-slate-300" />
            <p className="text-slate-400 font-medium">No released requests</p>
            <Button variant="outline" onClick={loadRequests} className="rounded-xl mt-2">Refresh</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <button key={req.id} onClick={() => selectRequest(req)} className="w-full text-left rounded-2xl bg-white border border-slate-200 p-5 active:scale-[0.98] transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 text-lg">{req.request_id}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {req.request_type} · Ref: {req.reference_id || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={req.status} />
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Issue lines ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-white text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <button onClick={() => { setStep('list'); setSelected(null); }} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1 mb-1">
        <ArrowLeft className="w-4 h-4" /> Requests
      </button>

      <div className="rounded-2xl bg-slate-900 text-white p-5">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Request</p>
        <p className="text-xl font-bold">{selected?.request_id}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-slate-300">{selected?.request_type}</span>
          {selected?.reference_id && <span className="text-sm text-slate-400">· {selected.reference_id}</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="space-y-3">
            {lines.map(line => (
              <div key={line.id} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{line.item_name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{line.item_code}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                    Req: {line.qty_requested} {line.uom}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Lot No.</label>
                    <div className="relative">
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Scan / enter lot"
                        value={line._lot}
                        onChange={e => updateLine(line.id, '_lot', e.target.value)}
                        className="pl-9 rounded-xl h-12 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Qty Issued</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={line._issued}
                      onChange={e => updateLine(line.id, '_issued', e.target.value)}
                      className="rounded-xl h-12 text-center text-lg font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={completeIssue}
            disabled={saving || lines.length === 0}
            className="w-full h-16 rounded-2xl text-lg font-bold bg-emerald-600 hover:bg-emerald-700 mt-4"
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6 mr-2" /> Complete Issue</>}
          </Button>
        </>
      )}
    </div>
  );
}