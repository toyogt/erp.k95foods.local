import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus, Plus, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CandidateLeadTable from '@/components/hr/CandidateLeadTable';
import CandidateLeadFormDialog from '@/components/hr/CandidateLeadFormDialog';
import CandidateTimelineDialog from '@/components/hr/CandidateTimelineDialog';
import CandidateStatusChangeDialog from '@/components/hr/CandidateStatusChangeDialog';
import { fireFMSEvent, triggerFMSProcess } from '@/lib/useFMSAutoComplete';

/**
 * Logs a status transition for a candidate, computing how long they spent in the previous status.
 * Best-effort — failures are warned but never block the save.
 */
async function logCandidateStatusChange({ candidate, oldStatus, newStatus, userEmail, remarks }) {
  try {
    const now = new Date().toISOString();
    let durationMinutes;
    if (oldStatus) {
      const lastLog = await base44.entities.CandidateLeadStatusLog.filter(
        { candidate_lead_id: candidate.id },
        '-changed_at',
        1
      );
      const startISO = lastLog?.[0]?.changed_at || candidate.created_date;
      if (startISO) {
        const diffMs = new Date(now).getTime() - new Date(startISO).getTime();
        durationMinutes = Math.max(0, Math.round(diffMs / 60000));
      }
    }
    await base44.entities.CandidateLeadStatusLog.create({
      candidate_lead_id: candidate.id,
      candidate_name: candidate.candidate_name,
      old_status: oldStatus || '',
      new_status: newStatus,
      changed_at: now,
      changed_by: userEmail || 'system',
      duration_in_previous_status_minutes: durationMinutes,
      remarks: remarks || '',
    });
  } catch (err) {
    console.warn('[HR] Status log failed:', err?.message);
  }
}

const ALLOWED_ROLES = ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'];
const STATUSES = ['New', 'Contacted', 'Shortlisted', 'Interviewed', 'Hired', 'Rejected', 'On Hold'];

/**
 * Fires the appropriate HR FMS events based on status transitions.
 * - On create: candidate_lead_created (always) + maybe candidate_hired
 * - On update: fire only when status actually transitions
 */
async function fireHRLifecycleEvents({ before, after }) {
  try {
    if (!before) {
      // New candidate
      await triggerFMSProcess({
        triggerSource: 'candidate_lead_created',
        triggerRefId: after.id,
        title: `Candidate Lead: ${after.candidate_name}`,
        triggerData: { mobile: after.mobile_number, source: after.source_type },
      });
      if (after.status === 'Hired') {
        await fireFMSEvent('candidate_hired', after.id);
      }
      if (after.status === 'Terminated') {
        await fireFMSEvent('employee_exit_initiated', after.id);
      }
      return;
    }

    if (before.status === after.status) return;

    // Status transitions
    const map = {
      Shortlisted: 'candidate_shortlisted',
      Interviewed: 'candidate_interviewed',
      Hired: 'candidate_hired',
      Terminated: 'employee_exit_initiated',
    };
    const eventKey = map[after.status];
    if (!eventKey) return;

    // For 'Hired', start onboarding process (auto-trigger)
    if (after.status === 'Hired') {
      await triggerFMSProcess({
        triggerSource: 'candidate_hired',
        triggerRefId: after.id,
        title: `Onboarding: ${after.candidate_name}`,
        triggerData: { employee_code: after.employee_code, department: after.department },
      });
    }

    // For 'Terminated', start exit process AND auto-send the exit interview survey
    if (after.status === 'Terminated') {
      await triggerFMSProcess({
        triggerSource: 'employee_exit_initiated',
        triggerRefId: after.id,
        title: `Exit: ${after.candidate_name}`,
        triggerData: { exit_type: after.exit_type, attrition_date: after.attrition_date },
      });
      // Fire-and-forget: send the exit interview survey link
      try {
        await base44.functions.invoke('sendExitInterviewSurvey', {
          candidate_lead_id: after.id,
          app_origin: window.location.origin,
        });
        await fireFMSEvent('exit_interview_sent', after.id);
      } catch (e) {
        console.warn('[HR] Exit interview send failed:', e?.message);
      }
    }

    // Always also fire as auto-complete event for any active steps
    await fireFMSEvent(eventKey, after.id);
  } catch (err) {
    console.warn('[HR] FMS event fire failed:', err?.message);
  }
}

export default function HRCandidateLeads() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [timelineCandidate, setTimelineCandidate] = useState(null);
  const [statusChangeCandidate, setStatusChangeCandidate] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: candidates = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['candidate-leads'],
    queryFn: () => base44.entities.CandidateLead.list('-created_date', 1000),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  // Dedicated mutation for status-only changes via the guided dialog.
  // Reuses the existing logging + FMS event firing logic for full consistency.
  const statusChangeMutation = useMutation({
    mutationFn: async ({ candidate, newStatus, remarks }) => {
      const before = { ...candidate };
      const updatePayload = { status: newStatus };

      // Auto-fill enrollment_date when transitioning to Hired
      if (newStatus === 'Hired' && !candidate.enrollment_date) {
        updatePayload.enrollment_date = new Date().toISOString().slice(0, 10);
      }
      // Auto-fill attrition_date when transitioning to Terminated
      if (newStatus === 'Terminated' && !candidate.attrition_date) {
        updatePayload.attrition_date = new Date().toISOString().slice(0, 10);
      }

      const saved = await base44.entities.CandidateLead.update(candidate.id, updatePayload);

      await logCandidateStatusChange({
        candidate: saved,
        oldStatus: before.status || '',
        newStatus,
        userEmail: user?.email,
        remarks,
      });

      await fireHRLifecycleEvents({ before, after: saved });
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-leads'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-status-log', saved.id] });
      toast({
        title: 'Status updated',
        description: `${saved.candidate_name} → ${saved.status}`,
      });
      setStatusChangeCandidate(null);

      // For Terminated, redirect to full termination form for offboarding details.
      if (saved.status === 'Terminated') {
        navigate(`/HRTerminationForm?id=${saved.id}`);
      }
    },
    onError: (err) => {
      toast({ title: 'Status change failed', description: err.message, variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      // Duplicate check on mobile_number (case-insensitive, trimmed)
      const mobile = (payload.mobile_number || '').trim();
      if (mobile) {
        const existing = await base44.entities.CandidateLead.filter({ mobile_number: mobile });
        const duplicate = existing.find((c) => c.id !== editing?.id);
        if (duplicate) {
          throw new Error(`Mobile number already exists for "${duplicate.candidate_name}"`);
        }
      }
      const before = editing ? { ...editing } : null;
      let saved;
      if (editing?.id) {
        saved = await base44.entities.CandidateLead.update(editing.id, payload);
      } else {
        saved = await base44.entities.CandidateLead.create(payload);
      }

      // Log status transitions (creation or change) — best-effort
      const beforeStatus = before?.status || '';
      const afterStatus = saved.status || 'New';
      if (!before || beforeStatus !== afterStatus) {
        await logCandidateStatusChange({
          candidate: saved,
          oldStatus: before ? beforeStatus : '',
          newStatus: afterStatus,
          userEmail: user?.email,
        });
      }

      // Fire HR FMS lifecycle events (non-blocking — best-effort)
      await fireHRLifecycleEvents({ before, after: saved });
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-leads'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-status-log', saved.id] });
      toast({ title: editing ? 'Candidate updated' : 'Candidate added', description: 'Saved successfully' });
      setDialogOpen(false);
      setEditing(null);

      // If status was changed to Terminated, redirect to dedicated termination form
      // for full offboarding details (exit type, last working day, exit feedback, survey).
      if (saved.status === 'Terminated') {
        navigate(`/HRTerminationForm?id=${saved.id}`);
      }
    },
    onError: (err) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            HR access required to view Candidate Leads.
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = candidates.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      c.candidate_name?.toLowerCase().includes(q) ||
      c.mobile_number?.toLowerCase().includes(q) ||
      c.location_area?.toLowerCase().includes(q) ||
      c.role_interested?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchSource = !sourceFilter || c.source_type === sourceFilter;
    return matchSearch && matchStatus && matchSource;
  });

  const stats = {
    total: candidates.length,
    new: candidates.filter((c) => c.status === 'New').length,
    shortlisted: candidates.filter((c) => c.status === 'Shortlisted').length,
    hired: candidates.filter((c) => c.status === 'Hired').length,
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Candidate Lead Master</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Track manpower candidates · {candidates.length} record{candidates.length !== 1 && 's'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-11 md:h-9 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="h-11 md:h-9 gap-2"
          >
            <Plus className="w-4 h-4" />
            New Candidate Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={stats.total} />
        <StatCard label="New" value={stats.new} valueClass="text-slate-700" />
        <StatCard label="Shortlisted" value={stats.shortlisted} valueClass="text-amber-700" />
        <StatCard label="Hired" value={stats.hired} valueClass="text-green-700" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs font-medium text-slate-700">Search</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, mobile, location, role..."
                  className="h-11 md:h-9 pl-9 text-base md:text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Status</Label>
              <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Source</Label>
              <Select value={sourceFilter || 'all'} onValueChange={(v) => setSourceFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="Market Visit">Market Visit</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="Incoming Call">Incoming Call</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Candidate Leads {filtered.length !== candidates.length && `(${filtered.length} of ${candidates.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateLeadTable
            candidates={filtered}
            isLoading={isLoading}
            onEdit={(c) => { setEditing(c); setDialogOpen(true); }}
            onViewTimeline={(c) => setTimelineCandidate(c)}
            onChangeStatus={(c) => setStatusChangeCandidate(c)}
          />
        </CardContent>
      </Card>

      <CandidateLeadFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        candidate={editing}
        onSubmit={(payload) => saveMutation.mutate(payload)}
        saving={saveMutation.isPending}
      />

      <CandidateTimelineDialog
        open={!!timelineCandidate}
        onOpenChange={(o) => { if (!o) setTimelineCandidate(null); }}
        candidate={timelineCandidate}
      />

      <CandidateStatusChangeDialog
        open={!!statusChangeCandidate}
        onOpenChange={(o) => { if (!o) setStatusChangeCandidate(null); }}
        candidate={statusChangeCandidate}
        saving={statusChangeMutation.isPending}
        onSubmit={({ newStatus, remarks }) =>
          statusChangeMutation.mutate({
            candidate: statusChangeCandidate,
            newStatus,
            remarks,
          })
        }
      />
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl md:text-2xl font-bold mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}