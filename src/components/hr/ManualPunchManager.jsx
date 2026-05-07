import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatIstDateTime } from '@/lib/istFormatter';
import PunchEditDialog from './PunchEditDialog';

// Convert log_datetime ISO → YYYY-MM-DD for recalculation
function isoToWorkDateIso(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ManualPunchManager({ logs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedPunch, setSelectedPunch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const triggerRecalc = async (workDateIso, secondaryDateIso = null) => {
    const dates = [workDateIso];
    if (secondaryDateIso && secondaryDateIso !== workDateIso) dates.push(secondaryDateIso);
    for (const d of dates) {
      try {
        await base44.functions.invoke('calculateDailyAttendance', { work_date_iso: d });
      } catch (e) {
        // Non-blocking — surfaced via toast below
        console.error('Recalc failed for', d, e);
      }
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    queryClient.invalidateQueries({ queryKey: ['daily-attendance-summary'] });
  };

  const openCreate = () => {
    setSelectedPunch(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const openEdit = (punch) => {
    setSelectedPunch(punch);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      let oldDateIso = null;
      if (dialogMode === 'create') {
        await base44.entities.AttendanceLog.create(payload);
        toast({ title: 'Punch created', description: 'Recalculating daily attendance...' });
      } else {
        oldDateIso = selectedPunch?.log_datetime ? isoToWorkDateIso(selectedPunch.log_datetime) : null;
        await base44.entities.AttendanceLog.update(selectedPunch.id, payload);
        toast({ title: 'Punch updated', description: 'Recalculating daily attendance...' });
      }
      const newDateIso = isoToWorkDateIso(payload.log_datetime);
      await triggerRecalc(newDateIso, oldDateIso);
      setDialogOpen(false);
      refreshAll();
      toast({ title: 'Recalculation complete' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (punch) => {
    if (!confirm(`Delete punch for ${punch.employee_code} at ${formatIstDateTime(punch.log_datetime)}?`)) return;
    setDeletingId(punch.id);
    try {
      const dateIso = isoToWorkDateIso(punch.log_datetime);
      await base44.entities.AttendanceLog.delete(punch.id);
      toast({ title: 'Punch deleted', description: 'Recalculating daily attendance...' });
      await triggerRecalc(dateIso);
      refreshAll();
      toast({ title: 'Recalculation complete' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Manual Punch Entry</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Add, edit, or delete individual punch records. Each change auto-triggers recalculation.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 md:h-9 gap-2">
          <Plus className="w-4 h-4" />
          Add Punch
        </Button>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No punch records to manage. Use "Add Punch" to create one manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="text-left px-3 py-2 font-medium">Employee</th>
                  <th className="text-left px-3 py-2 font-medium">Punch Time (IST)</th>
                  <th className="text-left px-3 py-2 font-medium">Direction</th>
                  <th className="text-left px-3 py-2 font-medium">Device</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{log.employee_code}</div>
                      {log.employee_name && <div className="text-xs text-slate-500">{log.employee_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatIstDateTime(log.log_datetime)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.punch_direction === 'IN' ? 'bg-green-100 text-green-700' :
                        log.punch_direction === 'OUT' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {log.punch_direction || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{log.device_sn || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => openEdit(log)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDelete(log)}
                          disabled={deletingId === log.id}
                        >
                          {deletingId === log.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length > 50 && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                Showing first 50 of {logs.length} records. Use filters above to narrow down.
              </p>
            )}
          </div>
        )}
      </CardContent>

      <PunchEditDialog
        open={dialogOpen}
        mode={dialogMode}
        punch={selectedPunch}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </Card>
  );
}