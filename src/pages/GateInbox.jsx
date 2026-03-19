import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Search, Link2, Package } from 'lucide-react';
import { GATE_STATUS_COLOR, logGrnAudit, genId } from '@/components/grn/grnHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

function POCard({ po, onSelect }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !items.length) {
      base44.entities.PurchaseOrderItem.filter({ po_id: po.po_id }).then(setItems);
    }
  }, [open]);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100">
        <div>
          <span className="font-bold text-slate-900">{po.po_id}</span>
          <span className="text-xs text-slate-400 ml-2">{po.po_date} · ₹{Number(po.total_amount || 0).toFixed(0)}</span>
          <span className="ml-2 text-xs font-bold text-purple-600">{po.status}</span>
        </div>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-1">
          {items.map((it, i) => (
            <div key={i} className="flex justify-between text-xs py-1 px-2 bg-white rounded-lg border border-slate-100">
              <span>{it.item_name || it.item_code}</span>
              <span className="text-slate-400">{it.qty} {it.uom_code}</span>
            </div>
          ))}
          <Button onClick={() => onSelect(po)} className="w-full mt-2 h-9 bg-purple-600 hover:bg-purple-700 text-sm">
            Link This PO →
          </Button>
        </div>
      )}
    </div>
  );
}

function GateDetail({ entry, user, onDone }) {
  const [suppliers, setSuppliers] = useState([]);
  const [suppId, setSuppId] = useState(entry.supplier_id || '');
  const [candidatePOs, setCandidatePOs] = useState([]);
  const [linking, setLinking] = useState(false);
  const [grnLoading, setGrnLoading] = useState(false);
  const [linkedPO, setLinkedPO] = useState(entry.linked_po_id || null);
  const [grnId, setGrnId] = useState(null);

  useEffect(() => {
    base44.entities.Supplier.filter({}).then(setSuppliers);
  }, []);

  async function searchPOs(sid) {
    if (!sid) return;
    const suppName = suppliers.find(s => s.supplier_id === sid)?.supplier_name || '';
    const all = await base44.entities.PurchaseOrder.filter({ supplier_id: sid });
    const candidates = all.filter(p => ['APPROVED', 'SENT', 'PART_RECEIVED'].includes(p.status));
    setCandidatePOs(candidates);
  }

  async function handleSuppChange(sid) {
    setSuppId(sid);
    setCandidatePOs([]);
    if (!sid) return;
    const supp = suppliers.find(s => s.supplier_id === sid);
    await base44.entities.GateEntry.update(entry.id, {
      supplier_id: sid,
      supplier_name: supp?.supplier_name || '',
      status: 'IN_REVIEW',
    });
    await logGrnAudit({ action: 'GATE_SUPPLIER_SET', entity_type: 'GateEntry', entity_id: entry.gate_id, details: { supplier_id: sid }, user });
    searchPOs(sid);
  }

  async function handleLinkPO(po) {
    setLinking(true);
    await base44.entities.GateEntry.update(entry.id, { linked_po_id: po.po_id, status: 'LINKED_TO_PO' });
    await logGrnAudit({ action: 'GATE_PO_LINKED', entity_type: 'GateEntry', entity_id: entry.gate_id, details: { po_id: po.po_id }, user });
    setLinkedPO(po.po_id);
    setLinking(false);
  }

  async function handleCreateGRN() {
    setGrnLoading(true);
    const po = candidatePOs.find(p => p.po_id === linkedPO) || null;
    const supp = suppliers.find(s => s.supplier_id === suppId);
    const grn_id = genId('GRN');

    const grn = await base44.entities.GRNHeader.create({
      grn_id,
      gate_id: entry.gate_id,
      supplier_id: suppId,
      supplier_name: supp?.supplier_name || entry.supplier_name_text || '',
      po_id: linkedPO || undefined,
      status: 'DRAFT',
      received_at: new Date().toISOString(),
      received_by: user?.email || '',
    });
    await logGrnAudit({ action: 'GRN_CREATED', entity_type: 'GRNHeader', entity_id: grn_id, details: { gate_id: entry.gate_id, po_id: linkedPO }, user });

    // FMS: fire grn_received using po.id (in chain), then link grn into chain
    if (linkedPO) {
      const po = candidatePOs.find(p => p.po_id === linkedPO);
      if (po?.id) {
        await fireFMSEvent('grn_received', po.id);
        const instances = await findFMSInstanceByRef(po.id);
        for (const inst of instances) {
          await linkFMSRef(inst.id, grn.id);
        }
      }
    }

    // Pre-fill GRN items from PO items
    if (linkedPO) {
      const poItems = await base44.entities.PurchaseOrderItem.filter({ po_id: linkedPO });
      await Promise.all(poItems.map(it =>
        base44.entities.GRNItem.create({
          grn_id,
          po_id: linkedPO,
          item_code: it.item_code,
          item_name: it.item_name || '',
          uom_code: it.uom_code || '',
          ordered_qty: it.qty || 0,
          received_qty: 0,
          damaged_qty: 0,
        })
      ));
    }

    setGrnId(grn_id);
    setGrnLoading(false);
    onDone();
  }

  return (
    <div className="space-y-4">
      {/* Photos */}
      <div className="flex gap-3 flex-wrap">
        {entry.invoice_photo && (
          <a href={entry.invoice_photo} target="_blank" rel="noreferrer">
            <img src={entry.invoice_photo} alt="invoice" className="w-28 h-20 object-cover rounded-xl border border-slate-200" />
            <p className="text-xs text-center text-slate-400 mt-0.5">Invoice</p>
          </a>
        )}
        {entry.vehicle_photo && (
          <a href={entry.vehicle_photo} target="_blank" rel="noreferrer">
            <img src={entry.vehicle_photo} alt="vehicle" className="w-28 h-20 object-cover rounded-xl border border-slate-200" />
            <p className="text-xs text-center text-slate-400 mt-0.5">Vehicle</p>
          </a>
        )}
        {entry.weighbridge_slip_photo && (
          <a href={entry.weighbridge_slip_photo} target="_blank" rel="noreferrer">
            <img src={entry.weighbridge_slip_photo} alt="weighbridge" className="w-28 h-20 object-cover rounded-xl border border-slate-200" />
            <p className="text-xs text-center text-slate-400 mt-0.5">Weighbridge</p>
          </a>
        )}
      </div>

      {entry.notes && <p className="text-xs text-slate-500 italic">Notes: {entry.notes}</p>}

      {/* Supplier selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier (for PO search)</label>
        <select value={suppId} onChange={e => handleSuppChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
          <option value="">— Select Supplier —</option>
          {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
        </select>
      </div>

      {/* Find POs */}
      {suppId && !candidatePOs.length && !linkedPO && (
        <Button variant="outline" onClick={() => searchPOs(suppId)} className="w-full h-10 text-sm">
          <Search className="w-4 h-4 mr-1" /> Find Matching POs for Supplier
        </Button>
      )}

      {linkedPO && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-purple-800">Linked PO: {linkedPO}</span>
        </div>
      )}

      {candidatePOs.length > 0 && !linkedPO && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-semibold">Candidate POs (tap to expand and link)</p>
          {candidatePOs.map(po => (
            <POCard key={po.po_id} po={po} onSelect={handleLinkPO} />
          ))}
        </div>
      )}
      {suppId && candidatePOs.length === 0 && linkedPO === null && entry.status === 'IN_REVIEW' && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">No approved POs found for this supplier. GRN can still be created without a PO.</p>
      )}

      {grnId ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="font-bold text-green-800">GRN Created: {grnId}</p>
          <Link to={createPageUrl('GRNReceive')} className="text-blue-600 underline text-sm">Open GRN Receive →</Link>
        </div>
      ) : (
        suppId && (
          <Button onClick={handleCreateGRN} disabled={grnLoading || linking} className="w-full h-11 bg-green-600 hover:bg-green-700">
            {grnLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
            {linkedPO ? `Create GRN from ${linkedPO}` : 'Create GRN (no PO)'}
          </Button>
        )
      )}
    </div>
  );
}

export default function GateInbox() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    const [u, data] = await Promise.all([
      base44.auth.me(),
      base44.entities.GateEntry.filter({}, '-created_date', 100),
    ]);
    setUser(u);
    // Show OPEN + IN_REVIEW + LINKED_TO_PO (not CLOSED)
    setEntries(data.filter(e => e.status !== 'CLOSED'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || (e.vehicle_number || '').toLowerCase().includes(q) ||
      (e.supplier_name_text || '').toLowerCase().includes(q) ||
      (e.supplier_name || '').toLowerCase().includes(q) ||
      (e.gate_id || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Gate Inbox</h1>
        <button onClick={load} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vehicle, supplier, gate ID…"
          className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-slate-400 py-8">No open gate entries.</p>}
          {filtered.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button onClick={() => setSelected(selected?.id === e.id ? null : e)} className="w-full text-left p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 font-mono">{e.gate_id}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GATE_STATUS_COLOR[e.status] || ''}`}>{e.status}</span>
                      {e.linked_po_id && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold">{e.linked_po_id}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{e.vehicle_number}</p>
                    <p className="text-xs text-slate-400">{e.supplier_name || e.supplier_name_text || 'Supplier unknown'} · {new Date(e.arrived_at || e.created_date).toLocaleString('en-IN')}</p>
                  </div>
                  <span className="text-slate-400 text-lg">{selected?.id === e.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {selected?.id === e.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                  <GateDetail entry={e} user={user} onDone={load} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}