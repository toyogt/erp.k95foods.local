import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { QrCode, CheckCircle2, XCircle, Search, Package } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import QRCode from 'react-qr-code';

function WeekBadge({ weeks }) {
  if (!weeks || weeks <= 1) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Week 1</span>;
  if (weeks === 2) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Week 2</span>;
  if (weeks === 3) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Week 3</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Week {weeks}+</span>;
}

function StatusBadge({ status }) {
  const map = {
    qc_pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    putaway: 'bg-blue-100 text-blue-700',
    consumed: 'bg-slate-100 text-slate-500',
    damaged: 'bg-orange-100 text-orange-700',
  };
  const labels = { qc_pending: 'QC Pending', approved: 'Approved', rejected: 'Rejected', putaway: 'Stored', consumed: 'Consumed', damaged: 'Damaged' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}

function QCModal({ lot, onDone, onClose }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function decide(approved) {
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.StoreLot.update(lot.id, {
      status: approved ? 'approved' : 'rejected',
      qc_notes: notes,
      qc_by: user?.email,
      qc_at: new Date().toISOString(),
    });
    toast({ title: approved ? 'Lot Approved' : 'Lot Rejected' });
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">QC Decision — {lot.lot_id}</h2>
          <p className="text-sm text-slate-500">{lot.item_name} · {lot.quantity} {lot.uom}</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700">QC Notes (optional)</label>
            <textarea className="w-full border border-slate-200 rounded-md p-2 text-sm mt-1 h-20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter inspection notes..." />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1 gap-2" disabled={saving} onClick={() => decide(false)}><XCircle className="w-4 h-4" /> Reject</Button>
          <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" disabled={saving} onClick={() => decide(true)}><CheckCircle2 className="w-4 h-4" /> Approve</Button>
        </div>
      </div>
    </div>
  );
}

function QRModal({ lot, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center">
        <p className="text-sm font-semibold text-slate-700 mb-1">Lot QR Code</p>
        <p className="text-xs text-slate-500 mb-1">{lot.item_name}</p>
        <p className="text-xs text-slate-400 mb-4">{lot.lot_id}</p>
        <div className="flex justify-center mb-4 p-4 bg-white border border-slate-200 rounded-lg">
          <QRCode value={lot.qr_code || lot.lot_id} size={160} />
        </div>
        <p className="text-xs font-mono text-slate-600 mb-1">{lot.lot_id}</p>
        <p className="text-xs text-slate-400 mb-4">Qty: {lot.quantity} {lot.uom}</p>
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default function SMSLotManager() {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [qcLot, setQcLot] = useState(null);
  const [qrLot, setQrLot] = useState(null);

  async function load() {
    setLoading(true);
    const data = await base44.entities.StoreLot.list('-created_date', 500);
    setLots(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = lots.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.lot_id?.toLowerCase().includes(q) || l.item_name?.toLowerCase().includes(q) || l.item_code?.toLowerCase().includes(q) || l.supplier_name?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lot Manager</h1>
          <p className="text-sm text-slate-500">Track all lots with QR codes and week-based aging</p>
        </div>
        <ExportButton data={filtered} columns={[
          { key: 'lot_id', label: 'Lot ID' }, { key: 'item_name', label: 'Item' }, { key: 'item_code', label: 'Code' },
          { key: 'supplier_name', label: 'Supplier' }, { key: 'quantity', label: 'Quantity' }, { key: 'remaining_quantity', label: 'Remaining' },
          { key: 'uom', label: 'Unit' }, { key: 'mfg_date', label: 'Manufacture Date' }, { key: 'expiry_date', label: 'Expiry' }, { key: 'status', label: 'Status' },
        ]} filename="lots" />
      </div>

      {/* Week Color Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Week Aging Legend</p>
        <div className="flex flex-wrap gap-2">
          {[{ label: 'Week 1 (Current)', cls: 'bg-green-100 text-green-700' }, { label: 'Week 2', cls: 'bg-yellow-100 text-yellow-700' }, { label: 'Week 3', cls: 'bg-orange-100 text-orange-700' }, { label: 'Week 4+', cls: 'bg-red-100 text-red-700' }].map(w => (
            <span key={w.label} className={`px-3 py-1 rounded-full text-xs font-medium ${w.cls}`}>{w.label}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-9" placeholder="Search by Lot ID, Item, Supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-9 border border-slate-200 rounded-md px-3 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="qc_pending">QC Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="putaway">Stored</option>
          <option value="consumed">Consumed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="text-left px-4 py-3 font-semibold">Lot ID</th>
                <th className="text-left px-4 py-3 font-semibold">Item</th>
                <th className="text-left px-4 py-3 font-semibold">Supplier</th>
                <th className="text-right px-4 py-3 font-semibold">Quantity</th>
                <th className="text-right px-4 py-3 font-semibold">Remaining</th>
                <th className="text-left px-4 py-3 font-semibold">Manufacture Date</th>
                <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                <th className="text-left px-4 py-3 font-semibold">Aging</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">Loading lots...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">No lots found</td></tr>
              ) : filtered.map(lot => (
                <tr key={lot.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{lot.lot_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{lot.item_name}</p>
                    <p className="text-xs text-slate-400">{lot.item_code}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lot.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{lot.quantity} <span className="text-xs text-slate-400">{lot.uom}</span></td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{lot.remaining_quantity ?? lot.quantity} <span className="text-xs text-slate-400">{lot.uom}</span></td>
                  <td className="px-4 py-3 text-slate-600">{lot.mfg_date || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{lot.expiry_date || '—'}</td>
                  <td className="px-4 py-3"><WeekBadge weeks={lot.weeks_elapsed} /></td>
                  <td className="px-4 py-3"><StatusBadge status={lot.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setQrLot(lot)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="QR Code"><QrCode className="w-4 h-4" /></button>
                      {lot.status === 'qc_pending' && (
                        <button onClick={() => setQcLot(lot)} className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600" title="QC Decision"><Package className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-400">{filtered.length} lot(s)</div>
      </div>

      {qcLot && <QCModal lot={qcLot} onDone={() => { setQcLot(null); load(); }} onClose={() => setQcLot(null)} />}
      {qrLot && <QRModal lot={qrLot} onClose={() => setQrLot(null)} />}
    </div>
  );
}