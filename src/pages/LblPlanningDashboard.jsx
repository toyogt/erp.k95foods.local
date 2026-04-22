import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { canManagePlans } from '@/lib/labellingHelpers';
import LblLineJobQueue from '@/components/labelling/LblLineJobQueue';
import LblPlanningToolbar from '@/components/labelling/LblPlanningToolbar';
import LblPlanningStats from '@/components/labelling/LblPlanningStats';
import { Loader2, Factory } from 'lucide-react';

const STATUS_FILTER_LABELS = {
  pending: 'Pending',
  active: 'In Progress',
  completed: 'Completed',
};

const IN_PROGRESS_STATUSES = ['active', 'stock_transferred', 'demo_print_sent', 'demo_print_verified',
  'checklist_submitted', 'demo_pending_approval', 'demo_approved', 'bulk_printing', 'paused',
  'bulk_printing_awaiting_printer_reset'];

export default function LblPlanningDashboard() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('priority_asc');
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [user, setUser] = useState(null);

  // Load current user for permission check
  useState(() => {
    base44.auth.me().then(setUser).catch(() => {});
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['label-lines'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });

  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['lbl-all-jobs'],
    queryFn: () => base44.entities.LabellingJob.list('priority_order', 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
  });

  const canManage = canManagePlans(user?.role);

  // Line filter — if no specific lines selected, show all
  const visibleLines = useMemo(() => {
    if (selectedLineIds.length === 0) return lines;
    return lines.filter(l => selectedLineIds.includes(l.id));
  }, [lines, selectedLineIds]);

  // Filter lines by search (name or product inside queue)
  const filteredLines = useMemo(() => {
    if (!search) return visibleLines;
    const needle = search.toLowerCase();
    return visibleLines.filter(line => {
      if (line.display_name?.toLowerCase().includes(needle)) return true;
      // Match any job's product/SKU inside this line
      return allJobs.some(j =>
        (j.line_id === line.id || j.line_id === line.machine_id) &&
        ((j.product_name || '').toLowerCase().includes(needle) ||
          (j.sku_code || '').toLowerCase().includes(needle))
      );
    });
  }, [visibleLines, search, allJobs]);

  // Filter jobs by status filter (from stat-card clicks)
  const filteredJobs = useMemo(() => {
    if (!statusFilter) return allJobs;
    if (statusFilter === 'pending') return allJobs.filter(j => j.status === 'pending');
    if (statusFilter === 'completed') return allJobs.filter(j => j.status === 'completed');
    if (statusFilter === 'active') return allJobs.filter(j => IN_PROGRESS_STATUSES.includes(j.status));
    return allJobs;
  }, [allJobs, statusFilter]);

  const stats = {
    total: allJobs.length,
    pending: allJobs.filter(j => j.status === 'pending').length,
    active: allJobs.filter(j => IN_PROGRESS_STATUSES.includes(j.status)).length,
    completed: allJobs.filter(j => j.status === 'completed').length,
  };

  const toggleLine = (lineId) => {
    setSelectedLineIds(prev =>
      prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]
    );
  };

  const selectAllLines = () => setSelectedLineIds([]);

  const isLoading = linesLoading || jobsLoading;

  // Responsive grid columns based on how many lines are visible
  const gridCols = filteredLines.length === 1
    ? 'grid-cols-1'
    : filteredLines.length === 2
      ? 'grid-cols-1 lg:grid-cols-2'
      : 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3';

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
          <Factory className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Labelling Job Queue</h1>
          <p className="text-xs md:text-sm text-slate-500">Manage and prioritise labelling jobs across all production lines</p>
        </div>
      </div>

      {/* Clickable stat cards */}
      <LblPlanningStats
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Toolbar: search + sort + line pills */}
      <LblPlanningToolbar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        lines={lines}
        selectedLineIds={selectedLineIds}
        onToggleLine={toggleLine}
        onSelectAllLines={selectAllLines}
        statusFilter={statusFilter ? STATUS_FILTER_LABELS[statusFilter] : null}
        onClearStatusFilter={() => setStatusFilter(null)}
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      )}

      {/* No lines configured */}
      {!isLoading && lines.length === 0 && (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 border-dashed rounded-xl">
          <p className="font-medium">No label lines configured.</p>
          <p className="text-sm mt-1">Add machines with type "Label Line" in Master Data.</p>
        </div>
      )}

      {/* No lines match filter */}
      {!isLoading && lines.length > 0 && filteredLines.length === 0 && (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 border-dashed rounded-xl">
          <p className="font-medium">No lines match your filter.</p>
          <p className="text-sm mt-1">Try clearing the search or selecting a different line.</p>
        </div>
      )}

      {/* Line Queue Grid — adapts to number of selected lines */}
      {!isLoading && filteredLines.length > 0 && (
        <div className={`grid ${gridCols} gap-4`}>
          {filteredLines.map(line => (
            <LblLineJobQueue
              key={line.id}
              line={line}
              jobs={filteredJobs}
              products={products}
              canManage={canManage}
              user={user}
              sortBy={sortBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}