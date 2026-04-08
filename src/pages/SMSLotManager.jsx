import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { QrCode, Search, Printer, FileText, Eye } from 'lucide-react';
import InvoicePreviewModal from '@/components/store/InvoicePreviewModal';
import ExportButton from '@/components/store/ExportButton';
import { Input } from '@/components/ui/input';
import { SkeletonTable } from '@/components/store/StoreSkeleton';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';

function calcDaysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function AgingBadge({ days }) {
  if (days === null || days === undefined) return <span className="text-slate-400">—</span>;
  let cls = 'bg-green-100 text-green-700';
  if (days > 30) cls = 'bg-red-100 text-red-700';
  else if (days > 14) cls = 'bg-orange-100 text-orange-700';
  else if (days > 7) cls = 'bg-yellow-100 text-yellow-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{days}d</span>;
}

// Effective status: always driven by actual stored stock + issued qty, not just DB status field
function getEffectiveStatus(dbStatus, storedQty, issuedQty, originalQty) {
  if (['rejected', 'damaged'].includes(dbStatus)) return dbStatus;
  if (storedQty > 0 && issuedQty > 0) return 'partial'; // has stock + some issued
  if (storedQty > 0) return 'putaway';                   // has stock, nothing issued
  if (issuedQty >= originalQty && originalQty > 0) return 'consumed'; // fully issued
  if (issuedQty > 0 && storedQty === 0) return 'consumed'; // issued all, nothing left
  return 'pending_putaway'; // stored=0, issued=0 → waiting for putaway
}

function StatusBadge({ status, storedQty, issuedQty, originalQty }) {
  const effective = getEffectiveStatus(status, storedQty, issuedQty, originalQty);
  const map = {
    pending_putaway: 'bg-amber-100 text-amber-700',
    putaway: 'bg-blue-100 text-blue-700',
    partial: 'bg-orange-100 text-orange-700',
    consumed: 'bg-slate-100 text-slate-500',
    rejected: 'bg-red-100 text-red-700',
    damaged: 'bg-orange-100 text-orange-700',
  };
  const labels = {
    pending_putaway: 'Pending Putaway',
    putaway: 'Available for Issue',
    partial: 'Partially Consumed',
    consumed: 'Fully Consumed',
    rejected: 'Rejected',
    damaged: 'Damaged',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[effective] || 'bg-slate-100 text-slate-600'}`}>
      {labels[effective] || effective}
    </span>
  );
}

function QRModal({ lot, onClose }) {
  function handlePrint() {
    const printWin = window.open('', '_blank', 'width=400,height=500');
    const qrVal = lot.qr_code || lot.lot_id;
    printWin.document.write(`
      <html><head><title>Lot QR - ${lot.lot_id}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:24px} img{width:180px;height:180px} p{margin:4px 0} .mono{font-family:monospace;font-size:13px;font-weight:bold}</style>
      </head><body>
      <p style="font-size:14px;font-weight:600">Lot QR Code</p>
      <p style="font-size:12px;color:#666">${lot.item_name}</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}" />
      <p class="mono">${lot.lot_id}</p>
      <p style="font-size:11px;color:#999">${lot.supplier_name || ''}</p>
      </body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  }
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 p-6 w-full max-w-xs text-center">
        <p className="text-sm font-semibold text-slate-700 mb-1">Lot QR Code</p>
        <p className="text-xs text-slate-500 mb-1">{lot.item_name}</p>
        <p className="text-xs text-slate-400 mb-4 font-mono">{lot.lot_id}</p>
        <div className="flex justify-center mb-4 p-4 bg-white border border-slate-200 rounded-xl">
          <QRCode value={lot.qr_code || lot.lot_id} size={160} />
        </div>
        <p className="text-xs font-mono text-slate-600 mb-4">{lot.lot_id}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10" onClick={onClose}>Close</Button>
          <Button className="flex-1 h-10 gap-2" onClick={handlePrint}><Printer className="w-4 h-4" /> Print QR</Button>
        </div>
      </div>
    </div>
  );
}

const LOT_HEADERS = [
  'Lot ID', 'Item', 'Batch', 'Supplier', 'Original Qty',
  'Stored Stock', 'Issued / Consumed', 'Remaining Qty', 'Stored At', 'Manufacture Date', 'Expiry', 'Goods Received Note Age', 'Stock Age', 'Status', 'Invoice', 'QR',
];

export default function SMSLotManager() {
  const { toast } = useToast();
  const [lots, setLots] = useState([]);
  const [storedByLot, setStoredByLot] = useState({});
  const [issuedByLot, setIssuedByLot] = useState({});
  const [locationsByLot, setLocationsByLot] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [qrLot, setQrLot] = useState(null);
  const [gateEntries, setGateEntries] = useState({});
  const [invoicePreview, setInvoicePreview] = useState(null);


  async function load() {
    setLoading(true);
    // Parallel fetch: lots + stock balances + issue lines
    const [lotsData, balances, issueLines, gates] = await Promise.all([
      base44.entities.StoreLot.list('-created_date', 500),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreIssueLine.list('-created_date', 2000),
      base44.entities.GateEntry.list('-created_date', 500),
    ]);

    // Build gate entry map: gate_id → entry
    const gateMap = {};
    gates.forEach(g => { gateMap[g.gate_id] = g; });
    setGateEntries(gateMap);

    // Build locations map: lot_id → unique location codes with qty
    const lbl = {};
    balances.filter(b => (b.quantity || 0) > 0).forEach(b => {
      if (!b.lot_id) return;
      if (!lbl[b.lot_id]) lbl[b.lot_id] = [];
      const entry = `${b.location_code || b.location_id} (${b.quantity})`;
      if (!lbl[b.lot_id].includes(entry)) lbl[b.lot_id].push(entry);
    });

    // Build stored stock map: lot_id → sum of current balances
    const sbl = {};
    balances.forEach(b => { sbl[b.lot_id] = (sbl[b.lot_id] || 0) + (b.quantity || 0); });

    // Build issued map: lot_id → sum of issued quantities
    const ibl = {};
    issueLines.forEach(l => { ibl[l.lot_id] = (ibl[l.lot_id] || 0) + (l.issued_quantity || 0); });

    setLots(lotsData);
    setStoredByLot(sbl);
    setIssuedByLot(ibl);
    setLocationsByLot(lbl);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = lots.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.lot_id?.toLowerCase().includes(q) ||
      l.item_name?.toLowerCase().includes(q) ||
      l.item_code?.toLowerCase().includes(q) ||
      l.supplier_name?.toLowerCase().includes(q);
    if (!statusFilter) return matchSearch;
    // Compute effective status for filtering
    const stored = storedByLot[l.lot_id] ?? 0;
    const issued = issuedByLot[l.lot_id] ?? 0;
    const effective = getEffectiveStatus(l.status, stored, issued, l.quantity);
    return matchSearch && effective === statusFilter;
  });

  const exportData = filtered.map(l => ({
    ...l,
    stored_stock: storedByLot[l.lot_id] ?? 0,
    issued_consumed: issuedByLot[l.lot_id] ?? 0,
  }));

  return (
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lot Manager</h1>
          <p className="text-sm text-slate-500">Track all lots with stored stock, issued quantities, and QR codes</p>
        </div>
        <ExportButton data={exportData} columns={[
          { key: 'lot_id', label: 'Lot ID' }, { key: 'item_name', label: 'Item' }, { key: 'item_code', label: 'Code' },
          { key: 'supplier_name', label: 'Supplier' }, { key: 'quantity', label: 'Original Qty' },
          { key: 'stored_stock', label: 'Stored Stock' }, { key: 'issued_consumed', label: 'Issued / Consumed' },
          { key: 'uom', label: 'Unit' }, { key: 'mfg_date', label: 'Manufacture Date' },
          { key: 'expiry_date', label: 'Expiry' }, { key: 'status', label: 'Status' },
        ]} filename="lots" />
      </div>

      {/* Aging Legend */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Stock Aging Legend (Days)</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '0–7 days', cls: 'bg-green-100 text-green-700' },
            { label: '8–14 days', cls: 'bg-yellow-100 text-yellow-700' },
            { label: '15–30 days', cls: 'bg-orange-100 text-orange-700' },
            { label: '30+ days', cls: 'bg-red-100 text-red-700' },
          ].map(w => <span key={w.label} className={`px-3 py-1 rounded-full text-xs font-medium ${w.cls}`}>{w.label}</span>)}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-11 md:h-9 text-base md:text-sm" placeholder="Search by Lot ID, Item, Supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-11 md:h-9 border border-slate-200 rounded-md px-3 text-base md:text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending_putaway">Pending Putaway</option>
          <option value="putaway">Available for Issue</option>
          <option value="partial">Partially Consumed</option>
          <option value="consumed">Fully Consumed</option>
          <option value="rejected">Rejected</option>
          <option value="damaged">Damaged</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={11} headers={LOT_HEADERS} />
      ) : (
        <>
        {/* Desktop Table */}
        <div className="hidden lg:block bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs whitespace-nowrap">
                  {LOT_HEADERS.map(h => (
                    <th key={h} className={`px-3 md:px-4 py-3 font-semibold ${['Stored Stock', 'Issued / Consumed', 'Original Qty'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={16} className="text-center py-12 text-slate-400">No lots found</td></tr>
                ) : filtered.map(lot => {
                  const stored = storedByLot[lot.lot_id] ?? 0;
                  const issued = issuedByLot[lot.lot_id] ?? 0;
                  const lotGateEntry = gateEntries[lot.gate_entry_id];
                  const lotInvoiceUrl = lotGateEntry?.invoice_photo;
                  return (
                    <tr key={lot.id} className="hover:bg-slate-50">
                      <td className="px-3 md:px-4 py-3 font-mono text-sm font-bold text-slate-800 whitespace-nowrap min-w-[180px]">{lot.lot_id}</td>
                      <td className="px-3 md:px-4 py-3">
                        <p className="font-medium text-slate-800 truncate">{lot.item_name}</p>
                        <p className="text-xs text-slate-400">{lot.item_code}</p>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-sm">
                        {lot.batch_number ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium font-mono">{lot.batch_number}</span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 md:px-4 py-3 text-slate-600 truncate text-sm">{lot.supplier_name || '—'}</td>
                      <td className="px-3 md:px-4 py-3 text-right font-medium text-slate-800 text-sm">
                        {lot.quantity} <span className="text-xs text-slate-400">{lot.uom}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right">
                        <span className={`font-bold ${stored > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{stored.toFixed(2)}</span>
                        <span className="text-xs text-slate-400 ml-1">{lot.uom}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right">
                        <span className={`font-bold ${issued > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{issued.toFixed(2)}</span>
                        <span className="text-xs text-slate-400 ml-1">{lot.uom}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right">
                        <span className={`font-bold ${(lot.remaining_quantity ?? lot.quantity) > 0 ? 'text-green-700' : 'text-slate-400'}`}>{(lot.remaining_quantity ?? lot.quantity).toFixed(2)}</span>
                        <span className="text-xs text-slate-400 ml-1">{lot.uom}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        {locationsByLot[lot.lot_id]?.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {locationsByLot[lot.lot_id].map((loc, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono whitespace-nowrap">{loc}</span>
                            ))}
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 md:px-4 py-3 text-slate-600 text-xs">{lot.mfg_date || '—'}</td>
                      <td className="px-3 md:px-4 py-3 text-slate-600 text-xs">{lot.expiry_date || '—'}</td>
                      <td className="px-3 md:px-4 py-3"><AgingBadge days={calcDaysAgo(lot.created_date)} /></td>
                      <td className="px-3 md:px-4 py-3">{lot.mfg_date ? <AgingBadge days={calcDaysAgo(lot.mfg_date)} /> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 md:px-4 py-3"><StatusBadge status={lot.status} storedQty={stored} issuedQty={issued} originalQty={lot.quantity} /></td>
                      <td className="px-3 md:px-4 py-3">
                        {lotInvoiceUrl ? (
                          <button onClick={() => setInvoicePreview(lotInvoiceUrl)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="View Invoice">
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <button onClick={() => setQrLot(lot)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="QR Code">
                          <QrCode className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500 font-medium">{filtered.length} lot(s)</div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No lots found</div>
          ) : filtered.map(lot => {
            const stored = storedByLot[lot.lot_id] ?? 0;
            const issued = issuedByLot[lot.lot_id] ?? 0;
            const lotGateEntry = gateEntries[lot.gate_entry_id];
            const lotInvoiceUrl = lotGateEntry?.invoice_photo;
            return (
              <div key={lot.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-slate-500">{lot.lot_id}</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{lot.item_name}</p>
                    {lot.batch_number && <p className="text-xs text-indigo-600 font-mono">Batch: {lot.batch_number}</p>}
                    {lot.supplier_name && <p className="text-xs text-slate-500">{lot.supplier_name}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                   <StatusBadge status={lot.status} storedQty={stored} issuedQty={issued} originalQty={lot.quantity} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-xs text-slate-500">Original</p>
                    <p className="text-sm font-bold text-slate-800">{lot.quantity}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-xs text-blue-500">Stored</p>
                    <p className="text-sm font-bold text-blue-700">{stored.toFixed(1)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-xs text-orange-500">Issued</p>
                    <p className="text-sm font-bold text-orange-600">{issued.toFixed(1)}</p>
                  </div>
                </div>
                {locationsByLot[lot.lot_id]?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {locationsByLot[lot.lot_id].map((loc, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">{loc}</span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                  {lot.mfg_date && <span>Manufacture: <strong className="text-slate-700">{lot.mfg_date}</strong></span>}
                  {lot.expiry_date && <span>Expiry: <strong className="text-slate-700">{lot.expiry_date}</strong></span>}
                  {lot.invoice_number && <span>Invoice: <strong className="text-slate-700">{lot.invoice_number}</strong></span>}
                  {lot.invoice_date && <span>Invoice Date: <strong className="text-slate-700">{lot.invoice_date}</strong></span>}
                  <span>Goods Received Note Age: <strong className="text-slate-700">{calcDaysAgo(lot.created_date) !== null ? `${calcDaysAgo(lot.created_date)} days` : '—'}</strong></span>
                  {lot.mfg_date && <span>Stock Age: <strong className="text-slate-700">{calcDaysAgo(lot.mfg_date) !== null ? `${calcDaysAgo(lot.mfg_date)} days` : '—'}</strong></span>}
                </div>
                <div className="flex gap-2 mt-3">
                  {lotInvoiceUrl && (
                    <button onClick={() => setInvoicePreview(lotInvoiceUrl)} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-blue-600"><Eye className="w-4 h-4" /> Invoice</button>
                  )}
                  <button onClick={() => setQrLot(lot)} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-slate-700"><QrCode className="w-4 h-4" /> QR Code</button>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-400 text-center py-1">{filtered.length} lot(s)</p>
        </div>
        </>
      )}

      {qrLot && <QRModal lot={qrLot} onClose={() => setQrLot(null)} />}

      {invoicePreview && (
        <InvoicePreviewModal imageUrl={invoicePreview} title="Invoice Preview" onClose={() => setInvoicePreview(null)} />
      )}
      </div>
      </motion.div>
      );
}