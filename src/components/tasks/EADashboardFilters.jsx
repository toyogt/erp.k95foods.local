import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, AlertTriangle, Clock, Calendar, Star } from 'lucide-react';

const DATE_PRESETS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'overdue', label: 'Overdue' },
];

function parseDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function endOfDay(d) { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; }

export function applyFilters(tasks, filters) {
  let result = tasks;

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t =>
      t.task_name?.toLowerCase().includes(q) ||
      t.assigned_to_name?.toLowerCase().includes(q) ||
      t.task_number?.toLowerCase().includes(q)
    );
  }

  // Director
  if (filters.director && filters.director !== 'all') {
    result = result.filter(t => t.director_email === filters.director);
  }

  // Assigned person
  if (filters.assignee && filters.assignee !== 'all') {
    result = result.filter(t => t.assigned_to_email === filters.assignee);
  }

  // Date preset
  if (filters.datePreset && filters.datePreset !== 'all') {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today); endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const startNextWeek = new Date(endOfWeek); startNextWeek.setDate(startNextWeek.getDate() + 1);
    const endNextWeek = new Date(startNextWeek); endNextWeek.setDate(endNextWeek.getDate() + 6);

    result = result.filter(t => {
      const d = parseDDMMYYYY(t.end_date);
      if (!d) return false;
      const ds = startOfDay(d);

      switch (filters.datePreset) {
        case 'today': return ds.getTime() === today.getTime();
        case 'tomorrow': return ds.getTime() === tomorrow.getTime();
        case 'this_week': return ds >= today && ds <= endOfDay(endOfWeek);
        case 'next_week': return ds >= startNextWeek && ds <= endOfDay(endNextWeek);
        case 'overdue': return ds < today && t.status !== 'completed' && t.status !== 'cancelled';
        default: return true;
      }
    });
  }

  // Important only
  if (filters.importantOnly) {
    result = result.filter(t => t.is_important);
  }

  // Overdue only
  if (filters.overdueOnly) {
    const today = startOfDay(new Date());
    result = result.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      const d = parseDDMMYYYY(t.end_date);
      return d && startOfDay(d) < today;
    });
  }

  return result;
}

export default function EADashboardFilters({
  search, onSearchChange,
  directors, selectedDirector, onDirectorChange,
  assignees,
  filters, onFiltersChange,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeFilterCount = [
    filters.assignee && filters.assignee !== 'all',
    filters.datePreset && filters.datePreset !== 'all',
    filters.importantOnly,
    filters.overdueOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({ assignee: 'all', datePreset: 'all', importantOnly: false, overdueOnly: false });
  };

  return (
    <div className="space-y-3">
      {/* Primary row */}
      <div className="flex gap-3 flex-wrap">
        {directors.length > 1 && (
          <Select value={selectedDirector} onValueChange={onDirectorChange}>
            <SelectTrigger className="w-48 h-11 md:h-9">
              <SelectValue placeholder="All Directors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directors</SelectItem>
              {directors.map(d => (
                <SelectItem key={d.email} value={d.email}>{d.name || d.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-11 md:h-9" placeholder="Search tasks…" value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <Button
          variant={showAdvanced || activeFilterCount > 0 ? 'default' : 'outline'}
          className="h-11 md:h-9 px-4 gap-2 shrink-0"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-slate-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced filter row */}
      {showAdvanced && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
          <div className="flex gap-3 flex-wrap">
            {/* Assignee filter */}
            <div className="min-w-[180px]">
              <label className="text-xs font-medium text-slate-700 mb-1 block">Assigned To</label>
              <Select value={filters.assignee || 'all'} onValueChange={v => onFiltersChange({ ...filters, assignee: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All People" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All People</SelectItem>
                  {assignees.map(a => (
                    <SelectItem key={a.email} value={a.email}>{a.name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date preset */}
            <div className="min-w-[160px]">
              <label className="text-xs font-medium text-slate-700 mb-1 block">Due Date</label>
              <Select value={filters.datePreset || 'all'} onValueChange={v => onFiltersChange({ ...filters, datePreset: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick toggle pills */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onFiltersChange({ ...filters, importantOnly: !filters.importantOnly })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.importantOnly
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Star className="w-3.5 h-3.5" /> Important Only
            </button>
            <button
              onClick={() => onFiltersChange({ ...filters, overdueOnly: !filters.overdueOnly })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.overdueOnly
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Overdue Only
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white text-slate-500 border border-slate-200 hover:bg-slate-100">
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}