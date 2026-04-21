import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import LblJobCard from '@/components/labelling/LblJobCard';
import { Loader2, Tag, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';

export default function LblOperatorQueue() {
  const [user, setUser] = useState(null);
  const [lineFilter, setLineFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('new_first'); // 'new_first' | 'old_first'

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  // Load ALL jobs — no date filter
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['labelling-jobs-all'],
    queryFn: () => base44.entities.LabellingJob.list('-created_date', 1000),
    refetchInterval: 10000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['labelling-machines'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });

  // Apply line filter
  const filtered = lineFilter === 'all'
    ? jobs
    : jobs.filter(j => j.line_id === lineFilter || j.line_id === machines.find(m => m.id === lineFilter)?.id);

  // Group by line
  const byLine = {};
  filtered.forEach(j => {
    const key = j.line_name || j.line_id || 'Unassigned';
    if (!byLine[key]) byLine[key] = [];
    byLine[key].push(j);
  });

  // Sort within each line
  Object.values(byLine).forEach(lj => lj.sort((a, b) => {
    if (sortOrder === 'new_first') {
      // New first: sort by created_date desc, then by priority_order
      const dateDiff = new Date(b.created_date || 0) - new Date(a.created_date || 0);
      if (dateDiff !== 0) return dateDiff;
    } else {
      // Old first: sort by created_date asc
      const dateDiff = new Date(a.created_date || 0) - new Date(b.created_date || 0);
      if (dateDiff !== 0) return dateDiff;
    }
    return (a.priority_order || 999) - (b.priority_order || 999);
  }));

  // Build plan groups within each line
  const getPlanGroups = (lineJobs) => {
    const groups = [];
    let currentPlan = null;
    for (const j of lineJobs) {
      if (j.plan_id !== currentPlan) {
        currentPlan = j.plan_id;
        groups.push({ planId: j.plan_id, jobs: [] });
      }
      groups[groups.length - 1].jobs.push(j);
    }
    return groups;
  };

  const toggleSort = () => setSortOrder(s => s === 'new_first' ? 'old_first' : 'new_first');

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Operator Queue</h1>
          <p className="text-sm text-slate-500">All labelling jobs across all dates</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Line selector */}
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger className="h-11 md:h-9 w-full md:w-52">
              <SelectValue placeholder="Filter by line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {machines.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort toggle */}
          <Button
            variant="outline"
            className="h-11 md:h-9 gap-2 shrink-0"
            onClick={toggleSort}
          >
            {sortOrder === 'new_first'
              ? <><ArrowDown className="w-4 h-4" /> Newest First</>
              : <><ArrowUp className="w-4 h-4" /> Oldest First</>
            }
          </Button>
        </div>
      </div>

      {/* Job list */}
      {Object.keys(byLine).length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
          <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500">No jobs found</p>
        </div>
      ) : Object.entries(byLine).map(([lineName, lineJobs]) => {
        const planGroups = getPlanGroups(lineJobs);
        const completedOrCancelled = new Set(['completed', 'cancelled']);
        const inProgressIds = new Set(
          lineJobs.filter(j => !completedOrCancelled.has(j.status) && j.status !== 'pending').map(j => j.id)
        );
        const hasAnyInProgress = inProgressIds.size > 0;
        const firstPendingId = !hasAnyInProgress ? lineJobs.find(j =>
          j.status === 'pending' &&
          lineJobs.filter(other => other.priority_order < j.priority_order)
                  .every(other => completedOrCancelled.has(other.status))
        )?.id : null;

        return (
          <div key={lineName} className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-pink-600" />
              {lineName}
              <span className="text-xs text-slate-400 font-normal">
                {lineJobs.filter(j => j.status === 'completed').length}/{lineJobs.length} completed
              </span>
            </h2>

            {planGroups.map((group) => (
              <div key={group.planId} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Plan: {group.planId}
                  </span>
                  <span className="text-xs text-slate-400">
                    {group.jobs.filter(j => j.status === 'completed').length}/{group.jobs.length} done
                  </span>
                </div>
                {group.jobs.map((job) => (
                  <LblJobCard
                    key={job.id}
                    job={job}
                    isFirst={job.id === firstPendingId || inProgressIds.has(job.id)}
                    planLocked={true}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}