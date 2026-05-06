import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from './purchaseHelpers';
import ItemSelectWithStock from './ItemSelectWithStock';
import { Plus, Trash2, FileDown, Loader2 } from 'lucide-react';

export default function POCreateItemsTab({ items, setItems, form, setForm }) {
  const [showPRPicker, setShowPRPicker] = useState(false);
  const [loadingPRItems, setLoadingPRItems] = useState(false);

  const { data: storeItems = [] } = useQuery({
    queryKey: ['store-items-po-create'],
    queryFn: () => base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 1000),
    staleTime: 60000,
  });

  const { data: eligiblePRs = [] } = useQuery({
    queryKey: ['eligible-prs-po-modal'],
    queryFn: async () => {
      const [prs, pos] = await Promise.all([
        base44.entities.PurchaseRequest.list('-created_date', 300),
        base44.entities.PurchaseOrder.list('-created_date', 500),
      ]);
      const linked = new Set(pos.flatMap(po => [po.mr_id, po.pr_number, ...(po.linked_pr_ids || [])]).filter(Boolean));
      return prs.filter(pr => ['Approved', 'Partially Approved', 'APPROVED'].includes(pr.status) && !linked.has(pr.pr_number || pr.mr_id));
    },
    staleTime: 30000,
  });

  function addRow() {
    setItems(prev => [...prev, { item_code: '', item_name: '', qty: 0, uom_code: '', rate: 0, gst_percent: 18, required_by: '' }]);
  }

  function updateRow(idx, updates) {
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  function removeRow(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function loadPRItems(pr) {
    setLoadingPRItems(true);
    const prKey = pr.pr_number || pr.mr_id;
    const [byPr, byMr] = await Promise.all([
      base44.entities.PurchaseRequestItem.filter({ pr_number: prKey }, 'line_number', 100).catch(() => []),
      base44.entities.PurchaseRequestItem.filter({ mr_id: prKey }, 'line_number', 100).catch(() => []),
    ]);
    const prItems = byPr.length > 0 ? byPr : byMr;
    const newRows = prItems
      .filter(it => it.item_status === 'Approved' || it.item_status === 'Pending')
      .map(it => ({
        item_code: it.item_code || '',
        item_name: it.item_name || '',
        qty: it.qty || it.quantity || 0,
        uom_code: it.unit || it.uom_code || '',
        rate: it.estimated_rate || 0,
        gst_percent: 18,
        required_by: it.required_by || '',
        _source_pr: prKey,
      }));
    setItems(prev => [...prev, ...newRows]);
    // Track linked PRs
    setForm(prev => ({
      ...prev,
      linked_pr_ids: [...new Set([...(prev.linked_pr_ids || []), prKey])],
      pr_number: prev.pr_number || prKey,
    }));
    setLoadingPRItems(false);
    setShowPRPicker(false);
  }

  const subtotal = items.reduce((s, r) => s + (r.rate || 0) * (r.qty || 0), 0);
  const totalGST = items.reduce((s, r) => {
    const amt = (r.rate || 0) * (r.qty || 0);
    return s + amt * ((r.gst_percent || 0) / 100);
  }, 0);

  return (
    <div className="space-y-3 p-4 md:p-5">
      {/* Get Items from PR */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowPRPicker(!showPRPicker)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <FileDown className="w-4 h-4" /> Get Items from Open Purchase Requests
        </button>
        {loadingPRItems && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>

      {showPRPicker && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
          {eligiblePRs.length === 0 ? (
            <p className="text-sm text-slate-500">No eligible Purchase Requests found.</p>
          ) : (
            eligiblePRs.map(pr => (
              <button
                key={pr.id}
                onClick={() => loadPRItems(pr)}
                className="w-full text-left p-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{pr.pr_number || pr.mr_id}</p>
                  <p className="text-xs text-slate-500">{pr.title || '—'} · {pr.department || '—'}</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{pr.status}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="text-center px-2 py-2.5 w-10">No.</th>
                <th className="text-left px-2 py-2.5 min-w-[180px]">Item Code *</th>
                <th className="text-left px-2 py-2.5 min-w-[100px]">Required By</th>
                <th className="text-right px-2 py-2.5 w-20">Quantity *</th>
                <th className="text-left px-2 py-2.5 w-20">Unit *</th>
                <th className="text-right px-2 py-2.5 w-24">Rate (₹)</th>
                <th className="text-right px-2 py-2.5 w-28">Amount (₹)</th>
                <th className="text-center px-2 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, idx) => {
                const amt = (row.rate || 0) * (row.qty || 0);
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="text-center px-2 py-2 text-xs text-slate-500 font-medium">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <ItemSelectWithStock
                        ingredients={storeItems}
                        value={{ item_code: row.item_code, item_name: row.item_name }}
                        onSelect={sel => updateRow(idx, { item_code: sel.item_code, item_name: sel.item_name, uom_code: sel.unit || row.uom_code })}
                        onManualEntry={sel => updateRow(idx, { item_code: sel.item_code || sel.item_name, item_name: sel.item_name, uom_code: '' })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm"
                        value={row.required_by || ''}
                        onChange={e => updateRow(idx, { required_by: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm text-right"
                        value={row.qty || ''}
                        onChange={e => updateRow(idx, { qty: Number(e.target.value) || 0 })}
                        min={0}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm"
                        value={row.uom_code || ''}
                        onChange={e => updateRow(idx, { uom_code: e.target.value })}
                        placeholder="Unit"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm text-right"
                        value={row.rate || ''}
                        onChange={e => updateRow(idx, { rate: Number(e.target.value) || 0 })}
                        min={0}
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-medium text-slate-700">
                      {formatINR(amt)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeRow(idx)} className="text-slate-400 hover:text-red-500 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Empty add row */}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                    No items yet. Add a row or import from a Purchase Request.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={addRow} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add Row
        </button>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 min-w-[220px]">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total Quantity</span>
            <span className="font-medium">{items.reduce((s, r) => s + (r.qty || 0), 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">GST</span>
            <span className="font-medium">{formatINR(totalGST)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1 mt-1">
            <span>Total (₹)</span>
            <span>{formatINR(subtotal + totalGST)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}