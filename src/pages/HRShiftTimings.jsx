import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Pencil, Trash2, Loader2, Star } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ShiftTimingForm from '@/components/hr/ShiftTimingForm';

export default function HRShiftTimings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shift-timings'],
    queryFn: () => base44.entities.ShiftTiming.list('shift_name', 200),
  });

  if (user && user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-center text-slate-600">Admin access required.</CardContent></Card>
      </div>
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shift-timings'] });

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      // Enforce unique shift_name (case-insensitive)
      const existing = shifts.find(s =>
        s.shift_name?.toLowerCase() === data.shift_name.toLowerCase() &&
        s.id !== selected?.id
      );
      if (existing) {
        toast({ title: 'Duplicate name', description: `Shift "${data.shift_name}" already exists`, variant: 'destructive' });
        setSaving(false);
        return;
      }

      // If is_default = true, clear existing defaults
      if (data.is_default) {
        const otherDefaults = shifts.filter(s => s.is_default && s.id !== selected?.id);
        for (const s of otherDefaults) {
          await base44.entities.ShiftTiming.update(s.id, { ...s, is_default: false });
        }
      }

      if (selected) {
        await base44.entities.ShiftTiming.update(selected.id, data);
        toast({ title: 'Shift updated' });
      } else {
        await base44.entities.ShiftTiming.create(data);
        toast({ title: 'Shift created' });
      }
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shift) => {
    if (!confirm(`Delete shift "${shift.shift_name}"?`)) return;
    setDeletingId(shift.id);
    try {
      await base44.entities.ShiftTiming.delete(shift.id);
      toast({ title: 'Shift deleted' });
      refresh();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Shift Timings</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Define work shifts used to flag late arrivals, early departures and overtime
            </p>
          </div>
        </div>
        <Button onClick={() => { setSelected(null); setDialogOpen(true); }} className="h-11 md:h-9 gap-2">
          <Plus className="w-4 h-4" /> New Shift
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Shifts ({shifts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No shifts defined yet. Create one to begin.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="text-left px-3 py-2 font-medium">Shift Name</th>
                    <th className="text-left px-3 py-2 font-medium">Start</th>
                    <th className="text-left px-3 py-2 font-medium">End</th>
                    <th className="text-left px-3 py-2 font-medium">Grace (Late/Early)</th>
                    <th className="text-left px-3 py-2 font-medium">Break</th>
                    <th className="text-left px-3 py-2 font-medium">OT Threshold</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{s.shift_name}</span>
                          {s.is_default && (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                              <Star className="w-3 h-3" /> Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{s.start_time}</td>
                      <td className="px-3 py-2 text-slate-700">{s.end_time}</td>
                      <td className="px-3 py-2 text-slate-600">{s.grace_minutes_late || 0}m / {s.grace_minutes_early || 0}m</td>
                      <td className="px-3 py-2 text-slate-600">{s.break_minutes || 0}m</td>
                      <td className="px-3 py-2 text-slate-600">+{s.overtime_threshold_minutes || 0}m</td>
                      <td className="px-3 py-2">
                        {s.is_active !== false
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                          : <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Inactive</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setSelected(s); setDialogOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete(s)}
                            disabled={deletingId === s.id}
                          >
                            {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      <ShiftTimingForm
        open={dialogOpen}
        shift={selected}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}