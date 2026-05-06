import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package } from 'lucide-react';
import { formatDateDDMMYYYY, formatINR } from './purchaseHelpers';

export default function POGRNHistory({ poId }) {
  const { data: grnHeaders = [], isLoading } = useQuery({
    queryKey: ['po-grn-history', poId],
    queryFn: async () => {
      const [byPo, allHeaders] = await Promise.all([
        base44.entities.GRNHeader.filter({ po_id: poId }, '-received_at', 50).catch(() => []),
        base44.entities.GRNHeader.list('-received_at', 200).catch(() => []),
      ]);
      const byLinked = allHeaders.filter(h => Array.isArray(h.linked_po_ids) && h.linked_po_ids.includes(poId));
      const seen = new Set();
      const merged = [];
      [...byPo, ...byLinked].forEach(h => { if (!seen.has(h.id)) { seen.add(h.id); merged.push(h); } });
      return merged;
    },
    staleTime: 30000, enabled: !!poId,
  });

  const { data: grnItems = [] } = useQuery({
    queryKey: ['po-grn-items', poId],
    queryFn: () => base44.entities.GRNItem.list('-created_date', 500).catch(() => []),
    staleTime: 30000, enabled: grnHeaders.length > 0,
  });

  if (isLoading) return <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>;
  if (grnHeaders.length === 0) return <p className="text-sm text-slate-400 text-center py-4">No Goods Receipt Notes recorded yet</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">Goods Receipt History ({grnHeaders.length})</p>
      {grnHeaders.map(grn => {
        const items = grnItems.filter(gi => gi.grn_id === grn.grn_id || gi.grn_header_id === grn.id);
        return (
          <div key={grn.id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                <span className="font-bold text-sm text-slate-900">{grn.grn_id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${grn.status === 'RECEIVED' || grn.status === 'QC_PASSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{grn.status}</span>
              </div>
              <span className="text-xs text-slate-500">{formatDateDDMMYYYY(grn.received_at)}</span>
            </div>
            {grn.freight_amount > 0 && <p className="text-xs text-slate-500">Freight: {formatINR(grn.freight_amount)}{grn.freight_notes ? ` — ${grn.freight_notes}` : ''}</p>}
            {items.length > 0 && (
              <div className="text-xs space-y-1">
                {items.map((gi, i) => (
                  <div key={i} className="flex justify-between text-slate-600">
                    <span>{gi.item_name || gi.item_code}</span>
                    <span className="font-medium text-green-700">+{gi.received_qty || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}