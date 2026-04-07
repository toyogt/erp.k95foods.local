import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportButton from '@/components/store/ExportButton';
import PutawayPanel from '@/components/store/PutawayPanel';
import PutawayTabs from '@/components/store/PutawayTabs';

export default function SMSPutaway() {
  const { toast } = useToast();
  const [pendingLots, setPendingLots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [putawayHistory, setPutawayHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [lots, locs, history, balances, issueLines] = await Promise.all([
      base44.entities.StoreLot.list('-created_date', 500),
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StorePutaway.list('-created_date', 50),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreIssueLine.list('-created_date', 2000),
    ]);

    // Build maps: lot_id → stored qty, lot_id → issued qty
    const storedMap = {};
    balances.forEach(b => { storedMap[b.lot_id] = (storedMap[b.lot_id] || 0) + (b.quantity || 0); });
    const issuedMap = {};
    issueLines.forEach(l => { issuedMap[l.lot_id] = (issuedMap[l.lot_id] || 0) + (l.issued_quantity || 0); });

    // Pending putaway = not rejected/damaged/consumed AND still has remaining quantity
    const pending = lots.filter(l =>
      !['rejected', 'damaged', 'consumed'].includes(l.status) &&
      (l.remaining_quantity ?? l.quantity) > 0
    );

    setPendingLots(pending);
    setLocations(locs);
    setPutawayHistory(history);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const exportColumns = [
    { key: 'putaway_id', label: 'Putaway ID' },
    { key: 'lot_id', label: 'Lot ID' },
    { key: 'item_name', label: 'Item' },
    { key: 'location_code', label: 'Location' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'uom', label: 'Unit' },
    { key: 'putaway_by', label: 'Done By' },
    { key: 'putaway_at', label: 'Date' },
  ];

  return (
    <div className="pb-12">
      <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Putaway</h1>
          <p className="text-sm text-slate-500">Store approved stock into locations — scan QR or select manually</p>
        </div>
        <ExportButton data={putawayHistory} columns={exportColumns} filename="putaway_history" />
      </div>

      {!loading && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-100/70 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700">
            <strong>{pendingLots.length}</strong> approved lot(s) awaiting putaway
          </p>
        </div>
      )}

      {/* Core Putaway Panel — supports both Scan and Manual modes */}
      {!loading && (
        <PutawayPanel
          lots={pendingLots}
          locations={locations}
          onSuccess={load}
        />
      )}

      {/* Tabs */}
      <PutawayTabs pendingLots={pendingLots} putawayHistory={putawayHistory} loading={loading} />
      </div>
      </div>
      );
      }