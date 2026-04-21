import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LblJobCard from '@/components/labelling/LblJobCard';
import {
  Loader2, Tag, ArrowDown, ArrowUp, Search, X,
  CheckCircle2, Clock, Play, Pause, AlertCircle
} from 'lucide-react';

// Status groups for the filter tabs
const STATUS_GROUPS = [
  {
    key: 'active',
    label: 'Active',
    icon: Play,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    activeColor: 'bg-blue-600 text-white border-blue-600',
    statuses: [
      'active', 'stock_transferred', 'demo_print_sent', 'demo_print_verified',
      'checklist_submitted', 'demo_pending_approval', 'demo_approved', 'demo_rejected',
      'bulk_printing', 'bulk_printing_awaiting_printer_reset', 'paused',
    ],
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: Clock,
    color: 'text-slate-600 bg-slate-50 border-slate-200',
    activeColor: 'bg-slate-700 text-white border-slate-700',
    statuses: ['pending'],
  },
  {
    key: 'on_hold',
    label: 'On Hold',
    icon: Pause,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    activeColor: 'bg-amber-500 text-white border-amber-500',
    statuses: ['on_hold'],
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-600 bg-green-50 border-green-200',
    activeColor: 'bg-green-600 text-white border-green-600',
    statuses: ['completed'],
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: X,
    color: 'text-red-500 bg-red-50 border-red-200',
    activeColor: 'bg-red-500 text-white border-red-500',
    statuses: ['cancelled'],
  },
  {
    key: 'all',
    label: 'All',
    icon: AlertCircle,
    color: 'text-slate-500 bg-white border-slate-200',
    activeColor: 'bg-slate-900 text-white border-slate-900',
    statuses: null, // null = no filter
  },
];

export default function LblOperatorQueue() {
  const [lineFilter, setLineFilter]   = useState('all');
  const [statusGroup, setStatusGroup] = useState('active'); // default: show active jobs only
  const [sortOrder, setSortOrder]     = useState('new_first');
  const [search, setSearch]           = useState('');

  // Load ALL jobs — no date filter
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['labelling-jobs-all'],
    queryFn: () => base44.entities.LabellingJob.list('-created_date', 1000),
    refetchInterval: 8000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['labelling-machines'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });

  // Count jobs per status group for badges
  const groupCounts = useMemo(() => {
    const counts = {};
    STATUS_GROUPS.forEach(g => {
      counts[g.key] = g.statuses
        ? jobs.filter(j => g.statuses.includes(j.status)).length
        : jobs.length;
    });
    return counts;
  }, [jobs]);

  const activeGroup = STATUS_GROUPS.find(g => g.key === statusGroup);

  // Apply all filters
  const filtered = useMemo(() => {
    let result = [...jobs];

    // Status group filter
    if (activeGroup?.statuses) {
      result = result.filter(j => activeGroup.statuses.includes(j.status));
    }

    // Line filter
    if (lineFilter !== 'all') {
      result = result.filter(j => j.line_id === lineFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(j =>
        (j.job_id || '').toLowerCase().includes(q) ||
        (j.product_name || '').toLowerCase().includes(q) ||
        (j.sku_code || '').toLowerCase().includes(q) ||
        (j.batch_no || '').toLowerCase().includes(q) ||
        (j.plan_id || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [jobs, activeGroup, lineFilter, search]);

  // Group by line
  const byLine = useMemo(() => {
    const map = {};
    filtered.forEach(j => {
      const key = j.line_name || j.line_id || 'Unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(j);
    });

    // Sort within each line
    Object.values(map).forEach(lj => lj.sort((a, b) => {
      if (sortOrder === 'new_first') {
        const d = new Date(b.created_date || 0) - new Date(a.created_date || 0);
        if (d !== 0) return d;
      } else {
        const d = new Date(a.created_date || 0) - new Date(b.created_date || 0);
        if (d !== 0) return d;
      }
      return (a.priority_order || 999) - (b.priority_order || 999);
    }));

    return map;
  }, [filtered, sortOrder]);

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

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Operator Queue</h1>
          <p className="text-sm text-slate-500">All labelling jobs — {jobs.length} total</p>
        </div>

        {/* Sort + Line filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger className="h-11 md:h-9 w-48">
              <SelectValue placeholder="All Lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {machines.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="h-11 md:h-9 gap-2 shrink-0" onClick={toggleSort}>
            {sortOrder === 'new_first'
              ? <><ArrowDown className="w-4 h-4" /> Newest First</>
              : <><ArrowUp className="w-4 h-4" /> Oldest First</>
            }
          </Button>
        </div>
      </div>

      {/* ── Status group tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_GROUPS.map(g => {
          const Icon = g.icon;
          const isActive = statusGroup === g.key;
          const count = groupCounts[g.key] || 0;
          return (
            <button
              key={g.key}
              onClick={() => setStatusGroup(g.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                isActive ? g.activeColor : g.color
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {g.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                isActive ? 'bg-white/20' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search bar ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by job ID, product, batch number, or plan…"
          className="pl-9 pr-9 h-11 md:h-9 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Results summary ── */}
      {(search || lineFilter !== 'all') && (
        <p className="text-xs text-slate-500">
          Showing {filtered.length} job{filtered.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
          {lineFilter !== 'all' ? ` on ${machines.find(m => m.id === lineFilter)?.display_name || lineFilter}` : ''}
        </p>
      )}

      {/* ── Job list ── */}
      {Object.keys(byLine).length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Tag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-slate-500">No jobs found</p>
          {statusGroup !== 'all' && (
            <button
              onClick={() => setStatusGroup('all')}
              className="mt-2 text-sm text-blue-600 underline"
            >
              Show all jobs
            </button>
          )}
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
          <div key={lineName} className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-pink-600 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">{lineName}</h2>
              <span className="text-xs text-slate-400 font-normal">
                {lineJobs.filter(j => j.status === 'completed').length}/{lineJobs.length} completed
              </span>
            </div>

            {planGroups.map((group) => (
              <div key={group.planId} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
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