/**
 * Editable Sales Order Items Table
 * Allows editing quantity, rate, and items with mandatory reason logging.
 * Only editable in draft/confirmed/logistics_review statuses.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import SOEditReasonModal from './SOEditReasonModal';
import { Pencil, Check, X, Loader2, Trash2, Plus } from 'lucide-react';

const EDITABLE_STATUSES = ['draft', 'confirmed', 'logistics_review'];

export default function SOEditableItemsTable({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [pendingChange, setPendingChange] = useState(null);
  const [saving, setSaving] = useState(false);

  const canEdit = EDITABLE_STATUSES.includes(order?.status);

  function startEdit(item) {
    setEditingId(item.id);
    setEditData({
      quantity: item.quantity,
      unit_base_cost: item.unit_base_cost || item.rate_snapshot || 0,
      description: item.description,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  function requestSave() {
    const item = items.find(i => i.id === editingId);
    if (!item) return;
    const changes = [];
    if (editData.quantity !== item.quantity) changes.push(`Quantity: ${item.quantity} → ${editData.quantity}`);
    if (editData.unit_base_cost !== (item.unit_base_cost || item.rate_snapshot || 0))
      changes.push(`Rate: ₹${item.unit_base_cost || item.rate_snapshot || 0} → ₹${editData.unit_base_cost}`);
    if (editData.description !== item.description) changes.push(`Description changed`);
    if (changes.length === 0) { cancelEdit(); return; }
    setPendingChange({ itemId: editingId, changes, item });
  }

  async function confirmSave(reason) {
    if (!pendingChange) return;
    setSaving(true);
    const { itemId, changes, item } = pendingChange;
    const qty = Number(editData.quantity) || 0;
    const rate = Number(editData.unit_base_cost) || 0;
    const taxableValue = qty * rate;
    const igstRate = item.igst_rate || 0;
    const igstAmount = taxableValue * (igstRate / 100);

    await base44.entities.SalesOrderItem.update(itemId, {
      quantity: qty,
      unit_base_cost: rate,
      rate_snapshot: rate,
      description: editData.description,
      taxable_value: taxableValue,
      igst_amount: igstAmount,
      total_amount: taxableValue + igstAmount,
    });

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrderItem',
      entity_id: itemId,
      reference_number: order.so_number,
      action: 'item_edited',
      old_value: changes.join('; '),
      new_value: `Reason: ${reason}`,
      notes: reason,
      user_email: user?.email,
    });

    // Recalculate SO totals
    const allItems = await base44.entities.SalesOrderItem.filter({ sales_order_id: order.id });
    const totalTaxable = allItems.reduce((s, i) => s + (i.taxable_value || 0), 0);
    const totalTax = allItems.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
    await base44.entities.SalesOrder.update(order.id, {
      taxable_amount: totalTaxable,
      tax_amount: totalTax,
      total_amount: totalTaxable + totalTax,
    });

    setSaving(false);
    setPendingChange(null);
    setEditingId(null);
    setEditData({});
    toast({ title: 'Item Updated', description: `Change logged with reason` });
    if (onUpdated) onUpdated();
  }

  async function handleDeleteItem(item) {
    setPendingChange({ itemId: item.id, changes: [`Delete item: ${item.description}`], item, isDelete: true });
  }

  async function confirmDelete(reason) {
    if (!pendingChange) return;
    setSaving(true);
    await base44.entities.SalesOrderItem.delete(pendingChange.itemId);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrderItem',
      entity_id: pendingChange.itemId,
      reference_number: order.so_number,
      action: 'item_deleted',
      old_value: pendingChange.item.description,
      notes: reason,
      user_email: user?.email,
    });

    // Recalculate totals
    const allItems = await base44.entities.SalesOrderItem.filter({ sales_order_id: order.id });
    const totalTaxable = allItems.reduce((s, i) => s + (i.taxable_value || 0), 0);
    const totalTax = allItems.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
    await base44.entities.SalesOrder.update(order.id, {
      taxable_amount: totalTaxable,
      tax_amount: totalTax,
      total_amount: totalTaxable + totalTax,
    });

    setSaving(false);
    setPendingChange(null);
    toast({ title: 'Item Deleted', description: `Reason logged` });
    if (onUpdated) onUpdated();
  }

  const taxableAmt = items.reduce((s, i) => s + (i.taxable_value || 0), 0);
  const taxAmt = items.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
  const grandTotal = order.total_amount || (taxableAmt + taxAmt);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left px-2 py-2 font-medium w-6">#</th>
              <th className="text-left px-2 py-2 font-medium">Item Code</th>
              <th className="text-left px-2 py-2 font-medium">Description</th>
              <th className="text-right px-2 py-2 font-medium">Quantity</th>
              <th className="text-right px-2 py-2 font-medium">Rate</th>
              <th className="text-right px-2 py-2 font-medium">Taxable Value</th>
              <th className="text-right px-2 py-2 font-medium">IGST %</th>
              <th className="text-right px-2 py-2 font-medium">Amount</th>
              {canEdit && <th className="text-center px-2 py-2 font-medium w-20">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={canEdit ? 9 : 8} className="text-center py-6 text-slate-400">No items</td></tr>
            ) : items.map((item, idx) => {
              const isEditing = editingId === item.id;
              return (
                <tr key={item.id} className={`hover:bg-slate-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-2 text-slate-700 font-mono">{item.item_code || '—'}</td>
                  <td className="px-2 py-2 text-slate-900">
                    {isEditing ? (
                      <Input className="h-7 text-xs w-full" value={editData.description}
                        onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                    ) : item.description}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {isEditing ? (
                      <Input type="number" min="0" className="h-7 text-xs w-20 text-right ml-auto"
                        value={editData.quantity}
                        onChange={e => setEditData(d => ({ ...d, quantity: Number(e.target.value) || 0 }))} />
                    ) : <span className="text-slate-900">{item.quantity}</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {isEditing ? (
                      <Input type="number" min="0" step="0.01" className="h-7 text-xs w-24 text-right ml-auto"
                        value={editData.unit_base_cost}
                        onChange={e => setEditData(d => ({ ...d, unit_base_cost: Number(e.target.value) || 0 }))} />
                    ) : <span className="text-slate-700">₹{(item.unit_base_cost || item.rate_snapshot || 0).toLocaleString('en-IN')}</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">₹{(item.taxable_value || 0).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2 text-right text-slate-500">{item.igst_rate || 0}%</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-900">₹{(item.total_amount || 0).toLocaleString('en-IN')}</td>
                  {canEdit && (
                    <td className="px-2 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={requestSave} className="text-green-600 hover:text-green-800 p-1">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-700 p-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-slate-900 p-1">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteItem(item)} className="text-slate-300 hover:text-red-600 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-1.5 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50">
          <div className="flex justify-between text-slate-600">
            <span>Total Quantity</span>
            <span className="font-medium text-slate-900">{items.reduce((s, i) => s + (i.quantity || 0), 0)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Net Total</span>
            <span className="font-medium text-slate-900">₹{taxableAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Tax</span>
            <span className="font-medium text-slate-900">₹{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold border-t border-slate-300 pt-1.5 mt-1">
            <span>Grand Total</span>
            <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Reason Modal */}
      {pendingChange && (
        <SOEditReasonModal
          changes={pendingChange.changes}
          isDelete={pendingChange.isDelete}
          onConfirm={pendingChange.isDelete ? confirmDelete : confirmSave}
          onCancel={() => { setPendingChange(null); if (!pendingChange.isDelete) cancelEdit(); }}
          saving={saving}
        />
      )}
    </div>
  );
}