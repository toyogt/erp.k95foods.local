import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { canManagePlans, JOB_STATUSES } from '@/lib/labellingHelpers';
import LblLineJobQueue from '@/components/labelling/LblLineJobQueue';
import { Search, Loader2 } from 'lucide-react';

export default function LblPlanningDashboard() {
  const [search, setSearch] = useState('');
  const [user, setUser] = useState(null);

  // Load current user for permission check
  useState(() => {
    base44.auth.me().then(setUser).catch(() => {});
  });

  // Fetch all label lines (machines of type LABEL-LINE)
  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['label-lines'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });

  // Fetch all labelling jobs (not cancelled/completed filters — show all active queue)
  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['lbl-all-jobs'],
    queryFn: () => base44.entities.LabellingJob.list('priority_order', 500),
  });

  // Fetch products for the add/edit modal
  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
  });

  const canManage = canManagePlans(user?.role);

  // Filter lines by search
  const filteredLines = lines.filter(line =>
    !search || line.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Global stats
  const stats = {
    total: allJobs.length,
    pending: allJobs.filter(j => j.status === 'pending').length,
    active: allJobs.filter(j => !['pending', 'completed', 'cancelled', 'on_hold'].includes(j.status)).length,
    completed: allJobs.filter(j => j.status === 'completed').length,
  };

  const isLoading = linesLoading || jobsLoading;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Labelling Job Queue</h1>
          <p className="text-sm text-slate-500">Manage and prioritise labelling jobs across all production lines</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs', value: stats.total, color: 'text-slate-900' },
          { label: 'Pending', value: stats.pending, color: 'text-slate-700' },
          { label: 'In Progress', value: stats.active, color: 'text-blue-700' },
          { label: 'Completed', value: stats.completed, color: 'text-green-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search lines..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-11 md:h-9"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      )}

      {/* No lines configured */}
      {!isLoading && lines.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="font-medium">No label lines configured.</p>
          <p className="text-sm mt-1">Add machines with type "Label Line" in Master Data.</p>
        </div>
      )}

      {/* Line Queue Columns */}
      {!isLoading && filteredLines.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredLines.map(line => (
            <LblLineJobQueue
              key={line.id}
              line={line}
              jobs={allJobs}
              products={products}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}