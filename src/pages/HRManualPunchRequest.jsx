import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Plus, Pencil, Trash2, Ban, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatIstDateTime } from '@/lib/istFormatter';
import PunchRequestDialog from '@/components/hr/PunchRequestDialog';
import PunchRequestList from '@/components/hr/PunchRequestList';

export default function HRManualPunchRequest() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [sourceLog, setSourceLog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logIdInput, setLogIdInput] = useState('');
  const [deleteReasonOpen, setDeleteReasonOpen] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch user's own requests
  const { data: myRequests = [], isLoading } = useQuery({
    queryKey: ['my-punch-requests', user?.email],
    queryFn: () => base44.entities.ManualPunchRequest.filter(
      { requested_by: user.email },
      '-requested_at',
      100
    ),
    enabled: !!user?.email,
  });

  // Fetch a few recent attendance logs to allow edit/delete from UI
  const { data: recentLogs = [] } = useQuery({
    queryKey: ['recent-attendance-logs-for-request'],
    queryFn: () => base44.entities.AttendanceLog.list('-log_datetime', 50),
  });

  if (!user) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-punch-requests'] });

  const submitRequest = async (payload) => {
    setSaving(true);
    try {
      await base44.entities.ManualPunchRequest.create({
        ...payload,
        status: 'PENDING',
        requested_by: user.email,
        requested_at: new Date().toISOString(),
      });
      toast({ title: 'Request submitted', description: 'Awaiting approval from HR/admin' });
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setSourceLog(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const openEdit = (log) => {
    setSourceLog(log);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const submitDeleteRequest = async () => {
    if (!deleteReasonOpen) return;
    if (!deleteReason.trim()) {
      toast({ title: 'Reason required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const log = deleteReasonOpen;
      await base44.entities.ManualPunchRequest.create({
        request_type: 'delete',
        target_log_id: log.id,
        employee_code: log.employee_code,
        employee_name: log.employee_name || '',
        log_datetime: log.log_datetime,
        log_date: log.log_date,
        punch_direction: log.punch_direction,
        device_sn: log.device_sn,
        previous_values: {
          employee_code: log.employee_code,
          log_datetime: log.log_datetime,
          punch_direction: log.punch_direction,
          device_sn: log.device_sn,
        },
        reason: deleteReason.trim(),
        status: 'PENDING',
        requested_by: user.email,
        requested_at: new Date().toISOString(),
      });
      toast({ title: 'Delete request submitted', description: 'Awaiting approval' });
      setDeleteReasonOpen(null);
      setDeleteReason('');
      refresh();
    } catch (e) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (req) => {
    if (!confirm('Cancel this pending request?')) return;
    try {
      await base44.entities.ManualPunchRequest.update(req.id, {
        status: 'CANCELLED',
        reviewed_at: new Date().toISOString(),
        review_remarks: 'Cancelled by requester',
      });
      toast({ title: 'Request cancelled' });
      refresh();
    } catch (e) {
      toast({ title: 'Cancel failed', description: e.message, variant: 'destructive' });
    }
  };

  const filteredLogs = logIdInput
    ? recentLogs.filter(l =>
        l.employee_code?.toLowerCase().includes(logIdInput.toLowerCase()) ||
        l.employee_name?.toLowerCase().includes(logIdInput.toLowerCase())
      )
    : recentLogs.slice(0, 10);

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Manual Punch Requests</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Request to add, edit, or delete punches. Changes apply only after HR/admin approval.
            </p>
          </div>
        </div>
        <Button onClick={openAdd} className="h-11 md:h-9 gap-2">
          <Plus className="w-4 h-4" /> Request New Punch
        </Button>
      </div>

      {/* Edit/Delete from recent punches */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Request Edit / Delete on Existing Punch</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={logIdInput}
            onChange={(e) => setLogIdInput(e.target.value)}
            placeholder="Search by employee code or name..."
            className="h-11 md:h-9 w-full border border-slate-200 rounded-md px-3 text-base md:text-sm mb-3"
          />
          {filteredLogs.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">No matching punches.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="text-left px-3 py-2 font-medium">Employee</th>
                    <th className="text-left px-3 py-2 font-medium">Punch Time</th>
                    <th className="text-left px-3 py-2 font-medium">Direction</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{log.employee_code}</div>
                        {log.employee_name && <div className="text-xs text-slate-500">{log.employee_name}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatIstDateTime(log.log_datetime)}</td>
                      <td className="px-3 py-2 text-slate-600">{log.punch_direction || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEdit(log)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => { setDeleteReasonOpen(log); setDeleteReason(''); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Requests ({myRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <PunchRequestList
            requests={myRequests}
            isLoading={isLoading}
            renderActions={(r) =>
              r.status === 'PENDING' ? (
                <Button size="sm" variant="outline" className="h-8 px-2 gap-1" onClick={() => cancelRequest(r)}>
                  <Ban className="w-3.5 h-3.5" /> Cancel
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>

      <PunchRequestDialog
        open={dialogOpen}
        mode={dialogMode}
        sourceLog={sourceLog}
        onClose={() => setDialogOpen(false)}
        onSubmit={submitRequest}
        saving={saving}
      />

      {/* Delete reason mini-dialog */}
      {deleteReasonOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">Request Punch Deletion</h3>
            <p className="text-sm text-slate-600">
              {deleteReasonOpen.employee_code} · {formatIstDateTime(deleteReasonOpen.log_datetime)}
            </p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion..."
              rows={3}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteReasonOpen(null)} className="h-11 md:h-9">Cancel</Button>
              <Button onClick={submitDeleteRequest} disabled={saving} className="h-11 md:h-9 gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}