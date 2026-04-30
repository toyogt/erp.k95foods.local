import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, RefreshCw, Loader2, Search } from 'lucide-react';

const STATUS_COLORS = {
  ROUTING: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  QUEUED: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  DOWNLOADING: 'bg-indigo-100 text-indigo-700',
  RENDERING: 'bg-purple-100 text-purple-700',
  PRINTING: 'bg-amber-100 text-amber-700',
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  ROUTING_FAILED: 'bg-red-100 text-red-700',
};

function formatDDMMYYYY(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Field({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 text-right">{children}</span>
    </div>
  );
}

export default function PrintJobs() {
  const params = new URLSearchParams(window.location.search);
  const initialErpJobId = params.get('erp_job_id') || '';
  const [search, setSearch] = useState(initialErpJobId);
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [selected, setSelected] = useState(null);

  const jobsQuery = useQuery({
    queryKey: ['print-jobs', statusFilter],
    queryFn: () => {
      const where = statusFilter === '__all__' ? {} : { status: statusFilter };
      return base44.entities.PrintJobAudit.filter(where, '-created_date', 200);
    },
    refetchInterval: 15_000,
  });

  const filtered = useMemo(() => {
    const rows = jobsQuery.data || [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(j =>
      (j.erp_job_id || '').toLowerCase().includes(q) ||
      (j.remote_job_id || '').toLowerCase().includes(q) ||
      (j.selected_workstation_id || '').toLowerCase().includes(q) ||
      (j.selected_printer || '').toLowerCase().includes(q)
    );
  }, [jobsQuery.data, search]);

  useEffect(() => {
    if (initialErpJobId && jobsQuery.data) {
      const match = jobsQuery.data.find(j => j.erp_job_id === initialErpJobId);
      if (match) setSelected(match);
    }
  }, [initialErpJobId, jobsQuery.data]);

  const syncMutation = useMutation({
    mutationFn: async (erp_job_id) => {
      const res = await base44.functions.invoke('printSyncJobStatus', { erp_job_id });
      return res.data;
    },
    onSuccess: () => jobsQuery.refetch(),
  });

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/PrintManagementDashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Print Jobs</h1>
          <p className="text-xs md:text-sm text-slate-500">Audit trail of every ERP-initiated print job</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-11 md:h-9 text-base md:text-sm" placeholder="Search ERP/remote job, workstation, printer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 md:h-9 text-base md:text-sm md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 font-medium">ERP Job</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Printer</th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobsQuery.isLoading ? (
                <tr><td colSpan={4} className="px-3 py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-slate-400" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-500">No print jobs found</td></tr>
              ) : filtered.map(j => (
                <tr key={j.id} onClick={() => setSelected(j)} className={`hover:bg-slate-50 cursor-pointer ${selected?.id === j.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2 text-slate-900 font-mono text-xs">{j.erp_job_id}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[j.status] || 'bg-slate-100 text-slate-700'}`}>{j.status}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 text-xs">
                    {j.selected_printer || '—'}
                    {j.selected_workstation_id && <div className="text-slate-500">{j.selected_workstation_id}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{formatDDMMYYYY(j.created_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          {!selected ? (
            <div className="text-sm text-slate-500 text-center py-12">Select a job to view details</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">ERP Job</div>
                  <div className="font-mono text-sm text-slate-900">{selected.erp_job_id}</div>
                </div>
                <Button size="sm" variant="outline" className="h-9 gap-2 text-xs" onClick={() => syncMutation.mutate(selected.erp_job_id)} disabled={syncMutation.isPending}>
                  {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <Field label="Status"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status] || 'bg-slate-100 text-slate-700'}`}>{selected.status}</span></Field>
                <Field label="Source">{selected.source_type}: <span className="font-mono text-xs">{selected.source_value}</span></Field>
                <Field label="Label">{selected.label_size || selected.template_id || '—'} × {selected.copies}</Field>
                <Field label="Workstation">{selected.selected_workstation_id || '—'}</Field>
                <Field label="Printer">{selected.selected_printer || '—'}</Field>
                <Field label="Agent">{selected.selected_agent_id || '—'}</Field>
                <Field label="Remote Job">{selected.remote_job_id || '—'}</Field>
                <Field label="Created">{formatDDMMYYYY(selected.created_date)}</Field>
              </div>
              {selected.error_info && Object.keys(selected.error_info).length > 0 && (
                <details>
                  <summary className="text-xs text-red-700 cursor-pointer">Error details</summary>
                  <pre className="bg-red-50 border border-red-200 rounded p-2 text-[11px] mt-1 overflow-x-auto">{JSON.stringify(selected.error_info, null, 2)}</pre>
                </details>
              )}
              <details>
                <summary className="text-xs text-slate-600 cursor-pointer">Routing trace</summary>
                <pre className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] mt-1 overflow-x-auto">{JSON.stringify(selected.routing_trace || {}, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}