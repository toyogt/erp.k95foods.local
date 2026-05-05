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
import CandidateLeadTable from '@/components/hr/CandidateLeadTable';
import CandidateLeadFormDialog from '@/components/hr/CandidateLeadFormDialog';

const ALLOWED_ROLES = ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'];
const STATUSES = ['New', 'Contacted', 'Shortlisted', 'Interviewed', 'Hired', 'Rejected', 'On Hold'];

export default function HRCandidateLeads() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: candidates = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['candidate-leads'],
    queryFn: () => base44.entities.CandidateLead.list('-created_date', 1000),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
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
      if (editing?.id) {
        return base44.entities.CandidateLead.update(editing.id, payload);
      }
      return base44.entities.CandidateLead.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-leads'] });
      toast({ title: editing ? 'Candidate updated' : 'Candidate added', description: 'Saved successfully' });
      setDialogOpen(false);
      setEditing(null);
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