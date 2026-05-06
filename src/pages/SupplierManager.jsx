import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Search } from 'lucide-react';
import { logPurchaseAudit, genId } from '@/components/purchase/purchaseHelpers';
import SupplierStatusCards from '@/components/purchase/SupplierStatusCards';
import SupplierTable from '@/components/purchase/SupplierTable';
import SupplierFormDialog from '@/components/purchase/SupplierFormDialog';
import SupplierItemMappingPanel from '@/components/store/SupplierItemMappingPanel';

export default function SupplierManager() {
  const [user, setUser] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mappingSupplier, setMappingSupplier] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Supplier.list('supplier_name', 500);
    setSuppliers(data);
    setLoading(false);
  }

  function startNew() {
    setEditingSupplier({ supplier_id: genId('SUP') });
    setFormOpen(true);
  }

  function startEdit(s) {
    setEditingSupplier(s);
    setFormOpen(true);
  }

  async function handleSave(form, existingId) {
    setSaving(true);
    const payload = {
      ...form,
      payment_terms_days: Number(form.payment_terms_days) || undefined,
      is_approved: form.approval_status === 'APPROVED',
    };
    if (existingId) {
      await base44.entities.Supplier.update(existingId, payload);
      await logPurchaseAudit({ action: `Supplier ${form.supplier_id} updated`, entity_type: 'Supplier', entity_id: form.supplier_id, user });
    } else {
      await base44.entities.Supplier.create(payload);
      await logPurchaseAudit({ action: `Supplier ${form.supplier_id} created`, entity_type: 'Supplier', entity_id: form.supplier_id, user });
    }
    setSaving(false);
    setFormOpen(false);
    setEditingSupplier(null);
    load();
  }

  async function handleStatusChange(s, newStatus) {
    await base44.entities.Supplier.update(s.id, { approval_status: newStatus, is_approved: newStatus === 'APPROVED' });
    await logPurchaseAudit({ action: `Supplier ${s.supplier_id} → ${newStatus}`, entity_type: 'Supplier', entity_id: s.supplier_id, user });
    load();
  }

  async function handleDelete(s) {
    const pos = await base44.entities.PurchaseOrder.filter({ supplier_id: s.supplier_id }, '-created_date', 1);
    if (pos.length > 0) {
      alert(`Cannot delete — ${s.supplier_name} has purchase orders. Block or Hold instead.`);
      return;
    }
    if (!window.confirm(`Delete supplier ${s.supplier_name}?`)) return;
    await base44.entities.Supplier.delete(s.id);
    await logPurchaseAudit({ action: `Supplier ${s.supplier_id} deleted`, entity_type: 'Supplier', entity_id: s.supplier_id, user });
    load();
  }

  // Filter by status + search
  const q = search.toLowerCase();
  const filtered = suppliers.filter(s => {
    if (statusFilter !== 'ALL' && s.approval_status !== statusFilter) return false;
    if (!q) return true;
    return (
      s.supplier_name?.toLowerCase().includes(q) ||
      s.supplier_id?.toLowerCase().includes(q) ||
      s.gstin?.toLowerCase().includes(q) ||
      s.contact_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 pb-12 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500">Master list with approval status</p>
        </div>
        <Button onClick={startNew} className="h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2">
          <Plus className="w-4 h-4" /> Add Supplier
        </Button>
      </div>

      {/* Status Cards */}
      <SupplierStatusCards suppliers={suppliers} activeFilter={statusFilter} onFilter={setStatusFilter} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Search by name, ID, GSTIN, contact, email..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table / Loading */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <SupplierTable
          suppliers={filtered}
          page={page} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={v => { setPageSize(v); setPage(1); }}
          onEdit={startEdit}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onMapping={setMappingSupplier}
        />
      )}

      {/* Create / Edit Dialog */}
      {formOpen && (
        <SupplierFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingSupplier(null); }}
          supplier={editingSupplier}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Item Mapping Dialog */}
      {mappingSupplier && (
        <Dialog open={!!mappingSupplier} onOpenChange={() => setMappingSupplier(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Item Mapping — {mappingSupplier.supplier_name}</DialogTitle>
            </DialogHeader>
            <SupplierItemMappingPanel supplierId={mappingSupplier.supplier_id} supplierName={mappingSupplier.supplier_name} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}