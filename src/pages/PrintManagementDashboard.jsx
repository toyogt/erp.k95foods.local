import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PrintStatCards from '@/components/printmanagement/PrintStatCards';
import PrintEndpointTable from '@/components/printmanagement/PrintEndpointTable';
import { Printer, Plus, Settings, ListChecks, Loader2 } from 'lucide-react';

export default function PrintManagementDashboard() {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const liveQuery = useQuery({
    queryKey: ['print-discovery-live'],
    queryFn: async () => {
      const res = await base44.functions.invoke('printDiscoveryLive', {});
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('printDiscoveryLive', { refresh: true });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['print-discovery-live'] }),
  });

  const { data: failedJobs = [] } = useQuery({
    queryKey: ['print-jobs-failed-24h'],
    queryFn: () => base44.entities.PrintJobAudit.filter({ status: 'FAILED' }, '-created_date', 200),
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    const rows = liveQuery.data?.rows || [];
    const wids = new Set(rows.map(r => r.workstation_id));
    const activeEndpoints = [...wids].filter(wid => rows.find(r => r.workstation_id === wid && r.probe_ok)).length;
    const staleEndpoints = [...wids].filter(wid => rows.find(r => r.workstation_id === wid && !r.probe_ok)).length;
    const activePrinters = rows.filter(r => r.printer_name && r.probe_ok).length;
    const since = Date.now() - 24 * 3600 * 1000;
    const failed24 = (failedJobs || []).filter(j => Date.parse(j.created_date) >= since).length;
    return { activeEndpoints, staleEndpoints, activePrinters, failedJobs: failed24 };
  }, [liveQuery.data, failedJobs]);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Print Management</h1>
            <p className="text-xs md:text-sm text-slate-500">Workstation print agents, routing, and live endpoints</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/PrintJobCreate"><Button className="h-11 md:h-9 gap-2 text-sm"><Plus className="w-4 h-4" /> New Print Job</Button></Link>
          <Link to="/PrintJobs"><Button variant="outline" className="h-11 md:h-9 gap-2 text-sm"><ListChecks className="w-4 h-4" /> Print Jobs</Button></Link>
          {isAdmin && (
            <Link to="/PrintManagementAdmin"><Button variant="outline" className="h-11 md:h-9 gap-2 text-sm"><Settings className="w-4 h-4" /> Admin</Button></Link>
          )}
        </div>
      </div>

      <PrintStatCards stats={stats} />

      {liveQuery.isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
      ) : (
        <PrintEndpointTable
          rows={liveQuery.data?.rows || []}
          loading={refreshMutation.isPending}
          onRefresh={() => refreshMutation.mutate()}
        />
      )}
    </div>
  );
}