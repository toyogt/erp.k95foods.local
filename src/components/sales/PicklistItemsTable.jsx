/**
 * Picklist Items Table — ERPNext-style with columns matching reference PDF.
 * Shows item code, name, qty, picked qty, UOM, available stock, delivered qty.
 * Editable picked qty when in picking/dispatch_scheduled status.
 */
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

const STATUS_BADGE = {
  picked: { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Picked' },
  short: { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle, label: 'Short' },
  pending: { color: 'bg-slate-100 text-slate-500', icon: Clock, label: 'Pending' },
  picking: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Picking' },
};

export default function PicklistItemsTable({ items, status, pickQtys, onPickQtyChange }) {
  const isEditable = ['picking', 'dispatch_scheduled'].includes(status);
  const totalQty = items.reduce((s, i) => s + (i.required_qty || 0), 0);
  const totalPicked = items.reduce((s, i) => s + (i.picked_qty || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Locations (Pick List Items)</h3>
        <span className="text-xs text-slate-500">{items.length} items · Total Qty: {totalQty}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-700 w-10">Sr</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Item Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Item Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Item Group</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Picked Qty</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-700">UOM</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Available Stock</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Delivered Qty</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-6 text-slate-400">No items</td></tr>
            ) : items.map((item, idx) => {
              const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
              const Icon = badge.icon;
              return (
                <tr key={item.sales_order_item_id || idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2 font-mono text-slate-800 text-xs whitespace-nowrap">{item.item_code || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{item.item_name || item.description || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{item.item_group || 'Kombucha'}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{item.required_qty || 0}</td>
                  <td className="px-3 py-2 text-right">
                    {isEditable ? (
                      <Input
                        type="number" min="0"
                        className="h-8 w-20 text-sm text-right ml-auto"
                        value={pickQtys?.[item.sales_order_item_id] ?? item.required_qty ?? 0}
                        onChange={e => onPickQtyChange?.(prev => ({
                          ...prev,
                          [item.sales_order_item_id]: e.target.value,
                        }))}
                      />
                    ) : (
                      <span className="font-medium">{item.picked_qty ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-500">{item.uom || 'Pcs'}</td>
                  <td className="px-3 py-2 text-right">
                    {item.available_stock !== undefined ? (
                      <span className={`font-medium ${(item.available_stock || 0) >= (item.required_qty || 0) ? 'text-green-700' : 'text-amber-600'}`}>
                        {item.available_stock}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.delivered_qty ?? 0}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                      <Icon className="w-3 h-3" /> {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Total</td>
              <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">{totalQty}</td>
              <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">{totalPicked}</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}