import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Send, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Sends a test record through the same captureAttendance webhook
 * the biometric device uses, so the admin can verify end-to-end flow.
 */
export default function AttendanceApiTester({ onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const sendTest = async () => {
    setSubmitting(true);
    setLastResult(null);
    try {
      const now = new Date();
      const payload = {
        employee_code: 'TEST001',
        employee_name: 'API Test User',
        log_datetime: now.toISOString().replace('T', ' ').slice(0, 19),
        downloaded_at: now.toISOString().replace('T', ' ').slice(0, 19),
        device_sn: 'TEST-DEVICE',
        device_no: '99',
        device_name: 'Admin Test',
        punch_direction: 'IN',
      };

      // Call our own backend function — bypasses auth header (uses logged-in user session),
      // but exercises the same parsing + DB write path the device uses.
      const res = await base44.functions.invoke('captureAttendance', payload);
      const data = res?.data;
      if (data?.ok) {
        setLastResult({ ok: true, data });
        toast({ title: 'Test record created', description: `Accepted: ${data.accepted}` });
        onSuccess?.();
      } else {
        setLastResult({ ok: false, data });
        toast({ title: 'Test failed', description: data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      setLastResult({ ok: false, error: e.message });
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4" /> API Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Sends a sample attendance record (Employee <span className="font-mono">TEST001</span>) through the same pipeline the biometric device uses. Use this to confirm the endpoint and database write are working.
        </p>
        <Button
          onClick={sendTest}
          disabled={submitting}
          className="h-11 md:h-9 w-full md:w-auto gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Test Punch
        </Button>

        {lastResult && (
          <div className={`mt-2 p-3 rounded-lg text-xs ${lastResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2 font-semibold">
              {lastResult.ok ? (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-green-700">Success</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-red-600" /><span className="text-red-700">Failed</span></>
              )}
            </div>
            <pre className="whitespace-pre-wrap break-all text-slate-700 font-mono">
              {JSON.stringify(lastResult.data || lastResult.error, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}