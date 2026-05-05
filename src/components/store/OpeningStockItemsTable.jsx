import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import TablePagination from '@/components/store/TablePagination';
import OpeningStockLotForm from './OpeningStockLotForm';
import OpeningStockLotsSubTable from './OpeningStockLotsSubTable';

const CATEGORY_LABELS = {
  ingredient: 'Ingredient',
  box_type: 'Box Type',
  cap_type: 'Cap Type',
  container: 'Container',
  flavour: 'Flavour',
  label_artwork: 'Label Artwork',
  packaging: 'Packaging',
  other: 'Other',
};

export default function OpeningStockItemsTable({ items, allLots, locations, onLotAdded }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState(null);
  const [showFormId, setShowFormId] = useState(null);

  const total = items.length;
  const paginated = items.slice((page - 1) * pageSize, page * pageSize);

  function handleSaved(entry) {
    setShowFormId(null);
    if (onLotAdded) onLotAdded(entry);
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
    setShowFormId(null);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Desktop table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs">
             <th className="px-3 py-2.5 text-left font-semibold w-8"></th>
             <th className="px-3 py-2.5 text-left font-semibold">Item Code</th>
             <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Item Name</th>
             <th className="px-3 py-2.5 text-left font-semibold">Category</th>
             <th className="px-3 py-2.5 text-left font-semibold">UOM</th>
             <th className="px-3 py-2.5 text-left font-semibold">Rules</th>
             <th className="px-3 py-2.5 text-right font-semibold">Opening Stock</th>
             <th className="px-3 py-2.5 text-right font-semibold">Lot Quantity</th>
             <th className="px-3 py-2.5 text-center font-semibold">Lots</th>
             <th className="px-3 py-2.5 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map(item => {
              const itemLots = allLots.filter(l => l.item_code === item.item_code);
              const totalQty = itemLots.reduce((s, l) => s + (l.quantity || 0), 0);
              const isExpanded = expandedId === item.id;

              return (
                <ItemTableRow
                  key={item.id}
                  item={item}
                  itemLots={itemLots}
                  totalQty={totalQty}
                  isExpanded={isExpanded}
                  showForm={showFormId === item.id}
                  locations={locations}
                  onToggleExpand={() => toggleExpand(item.id)}
                  onShowForm={() => { setExpandedId(item.id); setShowFormId(item.id); }}
                  onSaved={handleSaved}
                  onCancelForm={() => setShowFormId(null)}
                />
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-slate-400 text-sm">
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

function ItemTableRow({ item, itemLots, totalQty, isExpanded, showForm, locations, onToggleExpand, onShowForm, onSaved, onCancelForm }) {
  const hasRules = item.batch_required || item.expiry_required || item.mfg_date_required;
  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-3 py-2.5">
          <button onClick={onToggleExpand} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{item.item_code || '—'}</td>
        <td className="px-3 py-2.5">
          <span className="font-medium text-slate-900">{item.item_name}</span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {CATEGORY_LABELS[item.item_category] || item.item_category}
          </span>
        </td>
        <td className="px-3 py-2.5 text-slate-600">{item.uom || 'Nos'}</td>
        <td className="px-3 py-2.5">
          {hasRules ? (
            <div className="flex flex-wrap gap-1">
              {item.batch_required && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Batch</span>}
              {item.expiry_required && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Expiry</span>}
              {item.mfg_date_required && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Mfg Date</span>}
            </div>
          ) : <span className="text-xs text-slate-400">—</span>}
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className={`font-bold ${(item.opening_stock || 0) > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
            {item.opening_stock || 0}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className={`font-bold ${totalQty > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
            {totalQty}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${itemLots.length > 0 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'}`}>
            {itemLots.length}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <Button
            size="sm"
            className="h-8 gap-1 bg-teal-700 hover:bg-teal-800 text-xs"
            onClick={onShowForm}
          >
            <Plus className="w-3.5 h-3.5" /> Add Lot
          </Button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={10} className="bg-slate-50/50 px-4 py-3">
            <div className="space-y-3">
              {showForm && (
                <div className="border border-teal-200 bg-teal-50/30 rounded-xl p-4">
                  <p className="text-sm font-semibold text-teal-800 mb-3">New Opening Stock Lot</p>
                  <OpeningStockLotForm
                    item={item}
                    locations={locations}
                    existingLotsCount={itemLots.length}
                    onSaved={onSaved}
                    onCancel={onCancelForm}
                  />
                </div>
              )}
              <OpeningStockLotsSubTable lots={itemLots} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}