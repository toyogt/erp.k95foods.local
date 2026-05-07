import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import HolidayForm from '@/components/hr/HolidayForm';

const TYPE_COLORS = {
  gazetted: 'bg-purple-100 text-purple-700',
  restricted: 'bg-amber-100 text-amber-700',
  optional: 'bg-blue-100 text-blue-700',
  weekly_off: 'bg-slate-100 text-slate-600',
};

export default function HRHolidays() {
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

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => base44.entities.Holiday.list('-holiday_date_iso', 500),
  });

  if (user && user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-center text-slate-600">Admin access required.</CardContent></Card>
      </div>
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['holidays'] });

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      // Prevent duplicate dates
      const dup = holidays.find(h =>
        h.holiday_date_iso === data.holiday_date_iso && h.id !== selected?.id
      );
      if (dup) {
        toast({ title: 'Duplicate date', description: `A holiday already exists on ${data.holiday_date}`, variant: 'destructive' });
        setSaving(false);
        return;
      }

      if (selected) {
        await base44.entities.Holiday.update(selected.id, data);
        toast({ title: 'Holiday updated' });
      } else {
        await base44.entities.Holiday.create(data);
        toast({ title: 'Holiday created' });
      }
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h) => {
    if (!confirm(`Delete holiday "${h.holiday_name}" (${h.holiday_date})?`)) return;
    setDeletingId(h.id);
    try {
      await base44.entities.Holiday.delete(h.id);
      toast({ title: 'Holiday deleted' });
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
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Registered Holidays</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Holidays affect attendance flagging in daily calculation
            </p>
          </div>
        </div>
        <Button onClick={() => { setSelected(null); setDialogOpen(true); }} className="h-11 md:h-9 gap-2">
          <Plus className="w-4 h-4" /> New Holiday
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Holidays ({holidays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No holidays registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Holiday Name</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium">Paid</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{h.holiday_date || h.holiday_date_iso}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {h.holiday_name}
                        {h.remarks && <div className="text-xs text-slate-500">{h.remarks}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[h.holiday_type] || 'bg-slate-100 text-slate-600'}`}>
                          {h.holiday_type || 'gazetted'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{h.is_paid !== false ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        {h.is_active !== false
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                          : <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Inactive</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setSelected(h); setDialogOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete(h)}
                            disabled={deletingId === h.id}
                          >
                            {deletingId === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      <HolidayForm
        open={dialogOpen}
        holiday={selected}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}