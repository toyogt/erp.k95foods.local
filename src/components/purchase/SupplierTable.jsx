import { Edit2, Link2, Trash2 } from 'lucide-react';
import TablePagination from '@/components/store/TablePagination';

const STATUS_BADGE = {
  APPROVED: 'bg-green-100 text-green-700',
  HOLD: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

export default function SupplierTable({ suppliers, page, pageSize, onPageChange, onPageSizeChange, onEdit, onStatusChange, onDelete, onMapping }) {
  const total = suppliers.length;
  const start = (page - 1) * pageSize;
  const paged = suppliers.slice(start, start + pageSize);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Supplier ID</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Supplier Name</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">GSTIN</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Contact</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Payment Terms</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Quick Actions</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.supplier_id}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{s.supplier_name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[s.approval_status] || 'bg-slate-100 text-slate-600'}`}>
                    {s.approval_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.gstin || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.contact_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.phone || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.email || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.payment_terms_days ? `${s.payment_terms_days} days` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {s.approval_status !== 'HOLD' && (
                      <button onClick={() => onStatusChange(s, 'HOLD')}
                        className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md hover:bg-amber-200 transition-colors">
                        Hold
                      </button>
                    )}
                    {s.approval_status !== 'BLOCKED' && (
                      <button onClick={() => onStatusChange(s, 'BLOCKED')}
                        className="text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-md hover:bg-red-200 transition-colors">
                        Block
                      </button>
                    )}
                    {s.approval_status !== 'APPROVED' && (
                      <button onClick={() => onStatusChange(s, 'APPROVED')}
                        className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-md hover:bg-green-200 transition-colors">
                        Approve
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onMapping(s)} className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors" title="Item Mapping">
                      <Link2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-slate-400">No suppliers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {paged.map(s => (
          <div key={s.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-900">{s.supplier_name}</p>
                <p className="text-xs text-slate-400 font-mono">{s.supplier_id}</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[s.approval_status] || ''}`}>
                {s.approval_status}
              </span>
            </div>
            {s.gstin && <p className="text-xs text-slate-500">GSTIN: {s.gstin}</p>}
            {s.contact_name && <p className="text-xs text-slate-500">{s.contact_name} · {s.phone}</p>}
            {s.email && <p className="text-xs text-slate-500">{s.email}</p>}
            <div className="flex gap-2 pt-1 flex-wrap">
              {s.approval_status !== 'APPROVED' && (
                <button onClick={() => onStatusChange(s, 'APPROVED')} className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">Approve</button>
              )}
              {s.approval_status !== 'HOLD' && (
                <button onClick={() => onStatusChange(s, 'HOLD')} className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">Hold</button>
              )}
              {s.approval_status !== 'BLOCKED' && (
                <button onClick={() => onStatusChange(s, 'BLOCKED')} className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg">Block</button>
              )}
              <button onClick={() => onEdit(s)} className="text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg ml-auto">Edit</button>
              <button onClick={() => onDelete(s)} className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">Delete</button>
            </div>
          </div>
        ))}
        {paged.length === 0 && <p className="text-center text-slate-400 py-8">No suppliers found</p>}
      </div>

      {/* Pagination */}
      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}