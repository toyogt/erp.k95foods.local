import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { formatDateDDMMYYYY, formatINR } from '@/components/purchase/purchaseHelpers';

/**
 * Shows open Purchase Orders for the selected supplier.
 * User can expand POs, check items, enter received qty → parent gets items array.
 */
export default function GRNPOItemPicker({ supplierName, onItemsSelected }) {
  const [expandedPOs, setExpandedPOs] = useState({});
  const [selectedItems, setSelectedItems] = useState({});  // key: `${po_id}__${line}` → { ...item, received_qty_input }

  // Fetch open POs for this supplier
  const { data: allPOs = [], isLoading: posLoading } = useQuery({
    queryKey: ['grn-open-pos', supplierName],
    queryFn: () => base44.entities.PurchaseOrder.filter({ supplier_name: supplierName }, '-po_date', 200),
    enabled: !!supplierName?.trim(),
    staleTime: 15000,
  });

  // Filter to only open POs (not Delivered, not Cancelled)
  const openPOs = useMemo(() =>
    allPOs.filter(po => !['Delivered', 'Cancelled'].includes(po.status)),
    [allPOs]
  );

  // Fetch all PO items for open POs
  const poIds = openPOs.map(po => po.po_id);
  const { data: allPOItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['grn-po-items', poIds.join(',')],
    queryFn: async () => {
      if (poIds.length === 0) return [];
      const items = await base44.entities.PurchaseOrderItem.list('line_number', 2000);
      return items.filter(it => poIds.includes(it.po_id));
    },
    enabled: poIds.length > 0,
    staleTime: 15000,
  });

  // Group items by PO
  const itemsByPO = useMemo(() => {
    const map = {};
    allPOItems.forEach(it => {
      if (!map[it.po_id]) map[it.po_id] = [];
      map[it.po_id].push(it);
    });
    return map;
  }, [allPOItems]);

  function togglePO(poId) {
    setExpandedPOs(prev => ({ ...prev, [poId]: !prev[poId] }));
  }

  function itemKey(poId, lineNumber) {
    return `${poId}__${lineNumber}`;
  }

  function toggleItem(poId, item) {
    const key = itemKey(poId, item.line_number);
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        const ordered = item.qty || item.quantity || 0;
        const received = item.received_qty || 0;
        const pending = Math.max(0, ordered - received);
        next[key] = {
          po_id: poId,
          line_number: item.line_number,
          item_code: item.item_code,
          item_name: item.item_name,
          uom_code: item.uom_code || 'Nos',
          ordered_qty: ordered,
          already_received: received,
          pending_qty: pending,
          receive_now: pending, // default to full pending
        };
      }
      notifyParent(next);
      return next;
    });
  }

  function updateReceiveQty(key, val) {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[key]) {
        next[key] = { ...next[key], receive_now: Math.max(0, parseFloat(val) || 0) };
      }
      notifyParent(next);
      return next;
    });
  }

  function notifyParent(items) {
    const arr = Object.values(items).filter(i => i.receive_now > 0);
    onItemsSelected(arr);
  }

  if (!supplierName?.trim()) return null;

  const isLoading = posLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading Purchase Orders...
      </div>
    );
  }

  if (openPOs.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
        No open Purchase Orders found for <strong>{supplierName}</strong>.
        <br />
        <span className="text-xs text-slate-400">You can still add items manually below.</span>
      </div>
    );
  }

  const selectedCount = Object.keys(selectedItems).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Open Purchase Orders ({openPOs.length})
        </p>
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {openPOs.map(po => {
        const poItems = itemsByPO[po.po_id] || [];
        const isExpanded = expandedPOs[po.po_id];
        const poSelectedCount = poItems.filter(it => selectedItems[itemKey(po.po_id, it.line_number)]).length;

        return (
          <div key={po.id} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* PO Header — clickable */}
            <button
              onClick={() => togglePO(po.po_id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
            >
              <Package className="w-5 h-5 text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm text-slate-900">{po.po_id}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    po.status === 'Partially Received' ? 'bg-orange-100 text-orange-700' :
                    po.status === 'In Transit' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{po.status}</span>
                  {poSelectedCount > 0 && (
                    <span className="text-xs text-green-700 font-medium">({poSelectedCount} picked)</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Date: {formatDateDDMMYYYY(po.po_date)} · Due: {formatDateDDMMYYYY(po.due_date)} · {formatINR(po.total_amount)} · {poItems.length} item{poItems.length !== 1 ? 's' : ''}
                </p>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {/* PO Items */}
            {isExpanded && (
              <div className="border-t border-slate-100">
                {poItems.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No items found for this order.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {poItems.map(it => {
                      const key = itemKey(po.po_id, it.line_number);
                      const isSelected = !!selectedItems[key];
                      const ordered = it.qty || it.quantity || 0;
                      const received = it.received_qty || 0;
                      const pending = Math.max(0, ordered - received);
                      const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;

                      if (pending <= 0) {
                        return (
                          <div key={key} className="px-4 py-2.5 flex items-center gap-3 bg-green-50/50 opacity-60">
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-600 line-through">{it.item_name || it.item_code}</p>
                            </div>
                            <span className="text-xs text-green-600 font-medium">Fully received</span>
                          </div>
                        );
                      }

                      return (
                        <div key={key} className={`px-4 py-3 ${isSelected ? 'bg-blue-50/60' : 'bg-white'}`}>
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleItem(po.po_id, it)}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">{it.item_name || it.item_code}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                                <span>Ordered: <strong className="text-slate-700">{ordered}</strong> {it.uom_code}</span>
                                <span>Received: <strong className="text-green-700">{received}</strong></span>
                                <span>Pending: <strong className="text-amber-700">{pending}</strong></span>
                                {pct > 0 && <span className="text-slate-400">({pct}%)</span>}
                              </div>

                              {/* Receive qty input — only if selected */}
                              {isSelected && (
                                <div className="mt-2 flex items-center gap-2">
                                  <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Receive now:</label>
                                  <input
                                    type="number"
                                    className="w-24 h-9 border border-slate-200 rounded-lg px-2 text-sm text-center font-bold"
                                    value={selectedItems[key]?.receive_now || ''}
                                    min={0}
                                    max={pending}
                                    onChange={e => updateReceiveQty(key, e.target.value)}
                                  />
                                  <span className="text-xs text-slate-500">of {pending} {it.uom_code} pending</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}