import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Mail, CheckCircle, RefreshCw, Loader2, Info, Zap } from 'lucide-react';

export default function GmailIntegrationSettings() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  async function handleManualSync() {
    setTesting(true);
    setLastResult(null);
    try {
      // Fetch unread emails from the last 7 days from known platforms
      const res = await base44.functions.invoke('gmailGRNProcessor', {
        data: { new_message_ids: [] }, // will be handled by manual fetch
        manual_sync: true,
      });
      setLastResult(res.data);
      toast({
        title: 'Gmail sync complete',
        description: `Processed ${res.data?.processed ?? 0} new emails`,
      });
    } catch (err) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setTesting(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Mail className="w-4 h-4 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Gmail Integration</p>
          <p className="text-xs text-slate-500 mt-0.5">Auto-fetch Goods Receipt Notes and Debit Notes from Swiggy, Zepto, and Blinkit emails</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Gmail OAuth Connected</p>
            <p className="text-xs text-green-600">Real-time email monitoring is active. New emails are processed automatically.</p>
          </div>
        </div>

        {/* How it works */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Info className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold text-blue-800">How it works</p>
          </div>
          <p className="text-xs text-blue-700">• Monitors your inbox in real-time for new emails from Swiggy, Zepto, and Blinkit</p>
          <p className="text-xs text-blue-700">• Automatically extracts Goods Receipt Note and Debit Note data using AI</p>
          <p className="text-xs text-blue-700">• Creates records in the GRN Reconciliation module instantly</p>
          <p className="text-xs text-blue-700">• Skips duplicate records — safe to run multiple times</p>
        </div>

        {/* Automation status */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">Real-time Automation</p>
            <p className="text-xs text-slate-500">Webhook-based — triggers instantly when new emails arrive</p>
          </div>
          <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-1 rounded-full">Active</span>
        </div>

        {/* Manual sync */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="h-11 text-sm border-slate-200 flex-1"
            onClick={handleManualSync}
            disabled={testing}
          >
            {testing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
              : <><RefreshCw className="w-4 h-4 mr-2" /> Trigger Manual Sync</>
            }
          </Button>
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs font-medium text-slate-700 mb-1">Last sync result</p>
            <p className="text-xs text-slate-600">Processed: <span className="font-semibold">{lastResult.processed ?? 0}</span> emails</p>
            {lastResult.results?.map((r, i) => (
              <p key={i} className="text-xs text-slate-500 mt-0.5">
                {r.status === 'created' ? `✓ Created ${r.type === 'grn' ? 'Goods Receipt' : 'Debit Note'}: ${r.number}` : ''}
                {r.status === 'duplicate' ? `↩ Already exists: ${r.grn_number || r.debit_note_number}` : ''}
                {r.status === 'skipped' ? `— Skipped: ${r.reason}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}