import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { useState } from 'react';
import { Loader2, PlayCircle, Activity } from 'lucide-react';

/**
 * Real-time view of the AttendanceOutbox: shows queue counts, recent
 * failures, and a manual "Run worker now" trigger for admins.
 */
export default function AttendanceOutboxStatus({ onWorkerRun }) {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ['attendance-outbox'],
    queryFn: () => base44.entities.AttendanceOutbox.list('-created_date', 200),
    refetchInterval: 15000,
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const runWorker = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('processAttendanceOutbox', {});
      const data = res?.data;
      setLastRun(data);
      if (data?.ok) {
        toast({
          title: 'Worker ran',
          description: `Sent ${data.summary.sent}, retried ${data.summary.retried}, failed ${data.summary.failed}`,
        });
        refetch();
        onWorkerRun?.();
      } else {
        toast({ title: 'Worker failed', description: data?.error || 'unknown', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Worker failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const recentFailed = rows.filter(r => r.status === 'FAILED').slice(0, 5);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" /> Outbound Delivery Queue
        </CardTitle>
        <Button onClick={runWorker} disabled={running} className="h-11 md:h-9 gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          Run worker now
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusTile label="Pending" value={counts.PENDING || 0} className="bg-amber-50 text-amber-700 border-amber-200" />
          <StatusTile label="Processing" value={counts.PROCESSING || 0} className="bg-blue-50 text-blue-700 border-blue-200" />
          <StatusTile label="Sent" value={counts.SENT || 0} className="bg-green-100 text-green-700 border-green-200" />
          <StatusTile label="Failed" value={counts.FAILED || 0} className="bg-red-100 text-red-700 border-red-200" />
        </div>

        {recentFailed.length > 0 && (
          <div className="border border-red-200 rounded-lg bg-red-50/40 p-3">
            <div className="text-xs font-semibold text-red-700 mb-2">Recent failures</div>
            <div className="space-y-2">
              {recentFailed.map((r) => (
                <div key={r.id} className="text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-700">FAILED</Badge>
                    <span className="font-mono">{r.payload?.employee_code}</span>
                    <span className="text-slate-500">retries: {r.retry_count}</span>
                  </div>
                  <div className="text-slate-500 truncate">{r.failure_reason || r.response_body_excerpt}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lastRun?.summary && (
          <div className="text-xs text-slate-500">
            Last run: picked {lastRun.summary.picked}, sent {lastRun.summary.sent}, retried {lastRun.summary.retried}, failed {lastRun.summary.failed}, recovered stale {lastRun.summary.recovered_stale}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusTile({ label, value, className }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${className}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}