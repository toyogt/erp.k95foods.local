import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AttendanceCalculatorPanel({ onCalculated }) {
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const todayIso = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };

  const runCalculation = async (payload, label) => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('calculateDailyAttendance', payload);
      const data = res.data || res;
      setLastResult({ label, data });
      toast({
        title: `Calculated ${label}`,
        description: `${data.summaries_created || 0} created, ${data.summaries_updated || 0} updated`,
      });
      onCalculated?.();
    } catch (e) {
      toast({ title: 'Calculation failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Calculate Work Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Generates daily summaries by pairing IN/OUT punches. Auto-runs nightly at 02:00 IST. Manual overrides are preserved.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => runCalculation({ work_date_iso: todayIso() }, 'today')}
            disabled={running}
            className="h-11 md:h-9 gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Today
          </Button>
          <Button
            variant="outline"
            onClick={() => runCalculation({}, 'yesterday')}
            disabled={running}
            className="h-11 md:h-9 gap-2"
          >
            Yesterday
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => runCalculation({ from_date_iso: fromDate, to_date_iso: toDate }, `${fromDate} → ${toDate}`)}
              disabled={running || !fromDate || !toDate}
              className="h-11 md:h-9 w-full"
            >
              Calculate Range
            </Button>
          </div>
        </div>

        {lastResult && (
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
            <div className="font-medium text-slate-700">Last run: {lastResult.label}</div>
            <div className="text-slate-600">
              Employees: {lastResult.data.employees_processed || 0} ·
              Created: {lastResult.data.summaries_created || 0} ·
              Updated: {lastResult.data.summaries_updated || 0} ·
              Skipped (manual): {lastResult.data.summaries_skipped_manual || 0}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}