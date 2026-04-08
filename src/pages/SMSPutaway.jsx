import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
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
    // For 'approved' lots (pending putaway), use quantity if remaining_quantity is 0 or not set
    const pending = lots.filter(l => {
      if (['rejected', 'damaged', 'consumed'].includes(l.status)) return false;
      const remaining = l.remaining_quantity;
      const original = l.quantity || 0;
      // If remaining is explicitly > 0, show it
      if (remaining > 0) return true;
      // If lot is approved (not yet put away) and has original quantity, show it even if remaining is 0
      if (l.status === 'approved' && original > 0) return true;
      return false;
    });

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
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
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
      </motion.div>
      );
      }