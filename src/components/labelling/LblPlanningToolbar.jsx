import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, X, Calendar, Package, RotateCcw } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'priority_asc', label: 'Priority (High → Low)' },
  { value: 'priority_desc', label: 'Priority (Low → High)' },
  { value: 'date_desc', label: 'Newest First (Plan Date)' },
  { value: 'date_asc', label: 'Oldest First (Plan Date)' },
];

const ALL_PRODUCTS = '__all__';

export default function LblPlanningToolbar({
  search, onSearchChange,
  sortBy, onSortChange,
  lines, selectedLineId, onSelectLine,
  statusFilter, onClearStatusFilter,
  entryDateFrom, entryDateTo, onEntryDateFromChange, onEntryDateToChange,
  mfgDateFrom, mfgDateTo, onMfgDateFromChange, onMfgDateToChange,
  productCode, onProductCodeChange, products = [],
  onResetFilters,
  caps = {
    canSearch: true, canSort: true, canFilterByDate: true,
    canFilterByProduct: true, canFilterByLine: true, canClearFilters: true,
  },
}) {
  const hasAnyDateFilter = entryDateFrom || entryDateTo || mfgDateFrom || mfgDateTo || (productCode && productCode !== ALL_PRODUCTS);
  const hasAnyFilter =
    hasAnyDateFilter ||
    !!search ||
    (sortBy && sortBy !== 'priority_asc') ||
    !!statusFilter;

  const handleClearAll = () => {
    onSearchChange('');
    onSortChange('priority_asc');
    if (statusFilter) onClearStatusFilter();
    onResetFilters();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 space-y-3">
      {/* Row 1: Search + Sort */}
      {(caps.canSearch || caps.canSort) && (
      <div className="flex flex-col sm:flex-row gap-2">
        {caps.canSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search lines or products…"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 h-11 md:h-9"
            />
          </div>
        )}
        {caps.canSort && (
          <div className="flex items-center gap-2 sm:w-72">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="h-11 md:h-9 text-sm">
                <SelectValue placeholder="Sort by…" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      )}

      {/* Row 2: Date filters + Product filter — fully responsive */}
      {(caps.canFilterByDate || caps.canFilterByProduct) && (
      <div
        className="grid gap-3 pt-3 border-t border-slate-100"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {caps.canFilterByDate && (
        <>
        {/* Entry Date Range */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Entry Date (Job Created)
          </label>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
          >
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">From</span>
              <Input
                type="date"
                value={entryDateFrom || ''}
                onChange={e => onEntryDateFromChange(e.target.value)}
                className="h-11 md:h-9 text-xs w-full min-w-0"
                aria-label="Entry date from"
              />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">To</span>
              <Input
                type="date"
                value={entryDateTo || ''}
                onChange={e => onEntryDateToChange(e.target.value)}
                className="h-11 md:h-9 text-xs w-full min-w-0"
                aria-label="Entry date to"
              />
            </div>
          </div>
        </div>

        {/* Manufacturing Date Range */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Manufacturing Date
          </label>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
          >
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">From</span>
              <Input
                type="date"
                value={mfgDateFrom || ''}
                onChange={e => onMfgDateFromChange(e.target.value)}
                className="h-11 md:h-9 text-xs w-full min-w-0"
                aria-label="Manufacturing date from"
              />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">To</span>
              <Input
                type="date"
                value={mfgDateTo || ''}
                onChange={e => onMfgDateToChange(e.target.value)}
                className="h-11 md:h-9 text-xs w-full min-w-0"
                aria-label="Manufacturing date to"
              />
            </div>
          </div>
        </div>
        </>
        )}

        {/* Product Code */}
        {caps.canFilterByProduct && (
        <div className="space-y-1 min-w-0">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400" /> Product Code
          </label>
          <Select value={productCode || ALL_PRODUCTS} onValueChange={v => onProductCodeChange(v === ALL_PRODUCTS ? '' : v)}>
            <SelectTrigger className="h-11 md:h-9 text-sm w-full">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent className="max-w-[90vw]">
              <SelectItem value={ALL_PRODUCTS}>All products</SelectItem>
              {products.map(p => {
                const code = p.item_code || p.id;
                return (
                  <SelectItem key={p.id} value={code}>
                    {code} — {p.product_name || p.item_name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        )}
      </div>
      )}

      {/* Clear all filters (search, sort, lines, status, dates, product) */}
      {hasAnyFilter && caps.canClearFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="h-9 text-xs text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900 gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear all filters
          </Button>
        </div>
      )}

      {/* Row 3: Line filter pills — single-select, only one line active at a time */}
      {caps.canFilterByLine && lines.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-600 mt-2 shrink-0">Line:</span>
          <div className="flex flex-wrap gap-1.5">
            {lines.map(line => {
              const isSelected = selectedLineId === line.id;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => onSelectLine(line.id)}
                  className={`h-9 px-3 rounded-full text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  {line.display_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active status filter chip */}
      {statusFilter && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">Filtering by:</span>
          <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full pl-3 pr-1 h-7 text-xs font-semibold">
            {statusFilter}
            <Button
              size="icon"
              variant="ghost"
              onClick={onClearStatusFilter}
              className="h-5 w-5 rounded-full hover:bg-blue-100"
            >
              <X className="w-3 h-3" />
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}