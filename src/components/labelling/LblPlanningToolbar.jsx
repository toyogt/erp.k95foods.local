import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, X } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'priority_asc', label: 'Priority (High → Low)' },
  { value: 'priority_desc', label: 'Priority (Low → High)' },
  { value: 'date_desc', label: 'Newest First (Plan Date)' },
  { value: 'date_asc', label: 'Oldest First (Plan Date)' },
];

export default function LblPlanningToolbar({
  search, onSearchChange,
  sortBy, onSortChange,
  lines, selectedLineIds, onToggleLine, onSelectAllLines,
  statusFilter, onClearStatusFilter,
}) {
  const allSelected = selectedLineIds.length === 0 || selectedLineIds.length === lines.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 space-y-3">
      {/* Row 1: Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search lines or products…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-11 md:h-9"
          />
        </div>
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
      </div>

      {/* Row 2: Line filter pills */}
      {lines.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-600 mt-2 shrink-0">Lines:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onSelectAllLines}
              className={`h-9 px-3 rounded-full text-xs font-semibold border transition-all ${
                allSelected
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              All ({lines.length})
            </button>
            {lines.map(line => {
              const isSelected = selectedLineIds.includes(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => onToggleLine(line.id)}
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