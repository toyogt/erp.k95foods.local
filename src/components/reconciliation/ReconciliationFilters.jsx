/**
 * Reconciliation Filters
 * Filter mismatches by date, module, severity, status
 */

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function ReconciliationFilters({
  filters,
  onFilterChange,
  modules = ['PRODUCTION', 'WAREHOUSE', 'LABELLING', 'GRN', 'SYNC', 'APPROVAL'],
}) {
  const activeFilters = Object.entries(filters).filter(([_, v]) => v);

  return (
    <div className="space-y-3">
      {/* Search */}
      <Input
        placeholder="Search by entity code, SKU, or ID..."
        value={filters.search || ''}
        onChange={e => onFilterChange({ ...filters, search: e.target.value })}
        className="h-9 text-sm"
      />

      {/* Grid of filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Module */}
        <Select
          value={filters.module || ''}
          onValueChange={value => onFilterChange({ ...filters, module: value || null })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Modules</SelectItem>
            {modules.map(mod => (
              <SelectItem key={mod} value={mod}>{mod}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity */}
        <Select
          value={filters.severity || ''}
          onValueChange={value => onFilterChange({ ...filters, severity: value || null })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status || ''}
          onValueChange={value => onFilterChange({ ...filters, status: value || null })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="false_positive">False Positive</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={e => onFilterChange({ ...filters, dateFrom: e.target.value })}
          className="h-9 text-sm"
        />

        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={e => onFilterChange({ ...filters, dateTo: e.target.value })}
          className="h-9 text-sm"
        />
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-200">
          <span className="text-xs text-slate-600 font-medium">Active filters:</span>
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              onClick={() => onFilterChange({ ...filters, [key]: null })}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200"
            >
              {key}: {String(value).substring(0, 10)}
              <X className="w-3 h-3" />
            </button>
          ))}
          <button
            onClick={() => onFilterChange({})}
            className="text-xs text-slate-600 hover:text-slate-900 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}