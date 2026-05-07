import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MailX, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_BADGE = {
  SENT: { className: 'bg-green-100 text-green-700', label: 'Sent', Icon: Mail },
  SKIPPED_NO_RECIPIENT: { className: 'bg-amber-100 text-amber-700', label: 'No recipient', Icon: MailX },
  FAILED: { className: 'bg-red-100 text-red-700', label: 'Failed', Icon: AlertTriangle },
};

const ALERT_BADGE = {
  MISSING_OUT: 'bg-orange-100 text-orange-700',
  MISSING_IN: 'bg-orange-100 text-orange-700',
  FLAGGED: 'bg-red-100 text-red-700',
  NO_PUNCHES: 'bg-slate-100 text-slate-700',
  SINGLE_PUNCH: 'bg-orange-100 text-orange-700',
};

export default function HRAttendanceAlerts() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['attendance-alerts'],
    queryFn: () => base44.entities.AttendanceAlertLog.list('-sent_at', 200),
    refetchInterval: 60_000,
    enabled: !!user,
  });

  if (user === null) return null;
  if (!['admin', 'hr_manager', 'hr_supervisor', 'hr_user'].includes(user?.role)) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          You do not have permission to view attendance alerts.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Attendance Alerts</h1>
          <p className="text-sm text-slate-600">Audit log of supervisor / HR notifications for attendance anomalies.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-slate-500">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No alerts yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Sent To</TableHead>
                  <TableHead>CC</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {alerts.map((a) => {
                  const sb = STATUS_BADGE[a.send_status] || STATUS_BADGE.SENT;
                  const Icon = sb.Icon;
                  return (
                    <TableRow key={a.id} className="hover:bg-slate-50 align-top">
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">{a.work_date}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium text-slate-900">{a.employee_name || '—'}</div>
                        <div className="text-xs text-slate-500">{a.employee_code}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{a.department || '—'}</TableCell>
                      <TableCell>
                        <Badge className={`${ALERT_BADGE[a.alert_type] || 'bg-slate-100 text-slate-700'} hover:opacity-100`}>
                          {a.alert_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {(a.recipients_to || []).join(', ') || <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {(a.recipients_cc || []).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={`${sb.className} hover:opacity-100 gap-1`}>
                          <Icon className="w-3 h-3" />
                          {sb.label}
                        </Badge>
                        {a.failure_reason && (
                          <p className="text-xs text-red-600 mt-1 max-w-xs ml-auto truncate" title={a.failure_reason}>
                            {a.failure_reason}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}