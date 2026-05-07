import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LblQueueUpNext from '@/components/labelling/LblQueueUpNext';
import LblQueuePriorityList from '@/components/labelling/LblQueuePriorityList';
import LblQueuePausedSection from '@/components/labelling/LblQueuePausedSection';
import LblQueueArchiveSection from '@/components/labelling/LblQueueArchiveSection';
import { Loader2, Search, X, Tag } from 'lucide-react';

export default function LblOperatorQueue() {
  // Only one labelling line can be viewed at a time — defaults to first line once loaded
  const [lineTab, setLineTab]   = useState(null);
  const [search, setSearch]     = useState('');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['labelling-jobs-all'],
    queryFn: () => base44.entities.LabellingJob.list('-created_date', 1000),
    refetchInterval: 8000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['labelling-machines'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });

  // Auto-select the first line once machines load — operators can only view one line at a time
  useEffect(() => {
    if (!lineTab && machines.length > 0) {
      setLineTab(machines[0].id);
    }
  }, [machines, lineTab]);

  // Search filter
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.trim().toLowerCase();
    return jobs.filter(j =>
      (j.job_id || '').toLowerCase().includes(q) ||
      (j.product_name || '').toLowerCase().includes(q) ||
      (j.batch_no || '').toLowerCase().includes(q)
    );
  }, [jobs, search]);

  // Line filter — always scoped to a single line
  const lineFiltered = useMemo(() => {
    if (!lineTab) return [];
    return searchFiltered.filter(j => j.line_id === lineTab);
  }, [searchFiltered, lineTab]);

  // Categorize jobs
  const IN_PROGRESS_STATUSES = [
    'active', 'stock_transferred', 'demo_print_sent', 'demo_print_verified',
    'checklist_submitted', 'demo_pending_approval', 'demo_approved', 'demo_rejected',
    'bulk_printing', 'bulk_printing_awaiting_printer_reset',
  ];

  const { upNext, priorityQueue, paused, completed, cancelled, onHold } = useMemo(() => {
    const sorted = [...lineFiltered].sort((a, b) => (a.priority_order || 999) - (b.priority_order || 999));

    const inProgress = sorted.filter(j => IN_PROGRESS_STATUSES.includes(j.status));
    const pausedJobs = sorted.filter(j => j.status === 'paused');
    const pending    = sorted.filter(j => j.status === 'pending');
    const done       = sorted.filter(j => j.status === 'completed');
    const cancelled  = sorted.filter(j => j.status === 'cancelled');
    const onHold     = sorted.filter(j => j.status === 'on_hold');

    // "Up Next" = first in-progress job, or first pending if nothing active
    const hero = inProgress[0] || pausedJobs[0] || pending[0] || null;

    // Priority queue = all pending (excluding hero if hero is pending)
    const queueJobs = pending.filter(j => j.id !== hero?.id);
    // Also include remaining in-progress jobs after hero
    const remainingInProgress = inProgress.filter(j => j.id !== hero?.id);

    return {
      upNext: hero,
      priorityQueue: [...remainingInProgress, ...queueJobs],
      paused: pausedJobs.filter(j => j.id !== hero?.id),
      completed: done,
      cancelled,
      onHold,
    };
  }, [lineFiltered]);

  const lines = machines;
  const totalActive = lineFiltered.filter(j =>
    [...IN_PROGRESS_STATUSES, 'paused', 'pending'].includes(j.status)
  ).length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Labelling Queue</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {totalActive} job{totalActive !== 1 ? 's' : ''} remaining · Auto-refreshes every 8 seconds
        </p>
      </div>

      {/* ── Line Tabs (single-select — only one line at a time) ── */}
      {lines.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lines.map(m => (
            <button
              key={m.id}
              onClick={() => setLineTab(m.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-all h-11 ${
                lineTab === m.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by product name, job ID or batch number…"
          className="pl-9 pr-9 h-11 text-sm"
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

      {/* ── Empty state ── */}
      {!upNext && priorityQueue.length === 0 && paused.length === 0 && (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Tag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">No active jobs found</p>
          <p className="text-sm text-slate-400 mt-1">All jobs are completed or there are no jobs yet</p>
        </div>
      )}

      {/* ── Up Next (Hero) ── */}
      {upNext && <LblQueueUpNext job={upNext} />}

      {/* ── Paused Jobs ── */}
      {paused.length > 0 && <LblQueuePausedSection jobs={paused} />}

      {/* ── Priority Queue (Pending + remaining in-progress) ── */}
      {priorityQueue.length > 0 && <LblQueuePriorityList jobs={priorityQueue} />}

      {/* ── Archive (On Hold / Completed / Cancelled) ── */}
      <LblQueueArchiveSection onHold={onHold} completed={completed} cancelled={cancelled} />

    </div>
  );
}