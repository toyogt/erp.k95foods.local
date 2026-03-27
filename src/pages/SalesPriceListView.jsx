import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Tag, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

function exportCSV(priceListName, rows) {
  const headers = ['Item Code', 'Item Name', 'HSN Code', 'UOM', 'Rate (INR)', 'MRP', 'IGST %', 'Packing Unit', 'Brand', 'Valid From', 'Valid Upto'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([r.item_code, r.item_name, r.hsn_code, r.uom, r.rate, r.mrp, r.igst_rate, r.packing_unit, r.brand, r.valid_from, r.valid_upto]
      .map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${priceListName || 'price_list'}.csv`; a.click();
}

export default function SalesPriceListView() {
  const urlParams = new URLSearchParams(window.location.search);
  const defaultList = urlParams.get('list') || '';

  const [selectedList, setSelectedList] = useState(defaultList);
  const [filterCustomer, setFilterCustomer] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const { data: allRates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ['sales_rate_list_all'],
    queryFn: () => base44.entities.SalesRateList.list('-created_date', 1000),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers_all'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  // Unique price lists from master data
  const priceLists = [...new Set(allRates.map(r => r.price_list).filter(Boolean))].sort();

  // When a customer is selected, auto-select their price list
  useEffect(() => {
    if (filterCustomer) {
      const cust = customers.find(c => c.id === filterCustomer);
      if (cust?.price_list) setSelectedList(cust.price_list);
    }
  }, [filterCustomer, customers]);

  const selectedCustomer = customers.find(c => c.id === filterCustomer);

  // Items for the selected price list
  const listItems = allRates.filter(r => r.price_list === selectedList);

  const filteredItems = listItems.filter(r => {
    const s = itemSearch.toLowerCase();
    return !itemSearch || r.item_code?.toLowerCase().includes(s) || r.item_name?.toLowerCase().includes(s);
  });

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/SalesRateListManager">
            <Button variant="outline" className="h-9 w-9 p-0"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Price List Explorer</h1>
            <p className="text-sm text-slate-500">View item rates by price list · Check what a customer pays</p>
          </div>
        </div>
        {selectedList && (
          <Button variant="outline" className="h-11 text-sm" onClick={() => exportCSV(selectedList, filteredItems)}>
            <Download className="w-4 h-4 mr-2" /> Export {selectedList}
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Customer lookup */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Lookup by Customer (auto-selects their price list)
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filterCustomer}
              onChange={e => setFilterCustomer(e.target.value)}
            >
              <option value="">— Select a customer —</option>
              {customers.filter(c => c.price_list).map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.price_list ? `(${c.price_list})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Price list selector */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">
              <Tag className="w-3.5 h-3.5 inline mr-1" />
              Price List
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedList}
              onChange={e => { setSelectedList(e.target.value); setFilterCustomer(''); }}
            >
              <option value="">— Select a price list —</option>
              {priceLists.map(pl => (
                <option key={pl} value={pl}>{pl}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedCustomer && selectedList && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800">
            <strong>{selectedCustomer.name}</strong> is on price list <strong>{selectedList}</strong>
            {selectedCustomer.gstin && <span className="ml-2 text-blue-600 text-xs">(GSTIN: {selectedCustomer.gstin})</span>}
          </div>
        )}
      </div>

      {/* Price list summary cards */}
      {!selectedList && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {priceLists.map(pl => {
            const items = allRates.filter(r => r.price_list === pl);
            const custCount = customers.filter(c => c.price_list === pl).length;
            return (
              <button
                key={pl}
                onClick={() => setSelectedList(pl)}
                className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <Tag className="w-5 h-5 text-rose-500 mt-0.5" />
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{items.length} items</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{pl}</p>
                <p className="text-xs text-slate-500 mt-1">{custCount} customer{custCount !== 1 ? 's' : ''} assigned</p>
              </button>
            );
          })}
          {ratesLoading && <div className="col-span-3 text-center text-slate-400 text-sm py-8">Loading...</div>}
        </div>
      )}

      {/* Item table for selected list */}
      {selectedList && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedList(''); setFilterCustomer(''); }} className="text-slate-400 hover:text-slate-700">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-900 text-sm">{selectedList}</span>
              <span className="text-xs text-slate-500">({filteredItems.length} items)</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search items..." className="pl-9 h-8 text-sm" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No items in this price list</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
                    <th className="px-3 py-2.5 text-left">Item Code</th>
                    <th className="px-3 py-2.5 text-left">Item Name</th>
                    <th className="px-3 py-2.5 text-left">Brand</th>
                    <th className="px-3 py-2.5 text-right">Rate (INR)</th>
                    <th className="px-3 py-2.5 text-right">MRP</th>
                    <th className="px-3 py-2.5 text-right">IGST %</th>
                    <th className="px-3 py-2.5 text-right">Pack Unit</th>
                    <th className="px-3 py-2.5 text-left">Valid Upto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.item_code}</td>
                      <td className="px-3 py-2 text-slate-800">{r.item_name}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{r.brand || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">₹{r.rate}</td>
                      <td className="px-3 py-2 text-right text-slate-600">₹{r.mrp || '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{r.igst_rate || '—'}%</td>
                      <td className="px-3 py-2 text-right text-slate-600">{r.packing_unit || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{r.valid_upto || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}