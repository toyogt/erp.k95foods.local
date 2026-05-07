/**
 * Rynan Printer Center
 * Tabs: Configuration | Test Dispatch | Command Log
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import LblPrinterManager from '@/components/labelling/LblPrinterManager';
import { getRynanMiddlewareSnapshot, sendRynanTestCommand, sendRynanPrintCommand } from '@/lib/rynanPrinterService';
import { Printer, FlaskConical, ScrollText, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import moment from 'moment';

const EDIT_ROLES = ['admin', 'production_manager', 'labelling_supervisor', 'lbl_supervisor'];

function SnapshotPanel({ snap }) {
  if (!snap) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[
        { label: 'Health', data: snap.health, error: snap.healthError },
        { label: 'Printers', data: snap.printers, error: snap.printersError },
        { label: 'Metrics', data: snap.metrics, error: snap.metricsError },
      ].map(({ label, data, error }) => (
        <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
          {error ? (
            <div className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="w-3.5 h-3.5" />{error}</div>
          ) : data ? (
            <pre className="text-xs text-slate-700 whitespace-pre-wrap break-all overflow-auto max-h-40">{JSON.stringify(data, null, 2)}</pre>
          ) : (
            <p className="text-xs text-slate-400">No data</p>
          )}
        </div>
      ))}
    </div>
  );
}

function TestDispatchTab({ userRole }) {
  const [printerId, setPrinterId] = useState('');
  const [commandJson, setCommandJson] = useState(JSON.stringify({ type: 'test_ping' }, null, 2));
  const [snapLoading, setSnapLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [snap, setSnap] = useState(null);
  const [result, setResult] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-master'],
    queryFn: () => base44.entities.LblPrinterConfig.list('-created_date', 100),
  });

  const selectedPrinter = printers.find(p => p.printer_id === printerId);

  const handleCheckMiddleware = async () => {
    if (!selectedPrinter) { toast({ title: 'Select a printer first', variant: 'destructive' }); return; }
    setSnapLoading(true);
    setSnap(null);
    try {
      const s = await getRynanMiddlewareSnapshot(selectedPrinter);
      setSnap(s);
    } catch (err) {
      toast({ title: 'Error checking middleware', description: err.message, variant: 'destructive' });
    }
    setSnapLoading(false);
  };

  const handleSendTest = async () => {
    if (!selectedPrinter) { toast({ title: 'Select a printer first', variant: 'destructive' }); return; }
    setSending(true);
    setResult(null);
    let command;
    try {
      command = JSON.parse(commandJson);
    } catch {
      toast({ title: 'Invalid JSON in command payload', variant: 'destructive' });
      setSending(false);
      return;
    }
    const res = await sendRynanPrintCommand(selectedPrinter, command, {
      commandType: command.type || 'test_ping',
      user,
    });
    setResult(res);
    toast({ title: res.success ? 'Command Sent Successfully' : 'Command Failed', variant: res.success ? 'default' : 'destructive' });
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">Select Printer</Label>
        <Select value={printerId} onValueChange={setPrinterId}>
          <SelectTrigger className="h-11 md:h-9 w-full md:max-w-sm"><SelectValue placeholder="Select printer" /></SelectTrigger>
          <SelectContent>{printers.map(p => <SelectItem key={p.printer_id} value={p.printer_id}>{p.name} ({p.printer_id})</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-slate-700">Command JSON Payload</Label>
        <Textarea
          value={commandJson}
          onChange={e => setCommandJson(e.target.value)}
          className="font-mono text-sm min-h-[140px]"
          placeholder='{"type":"test_ping"}'
        />
        <p className="text-xs text-slate-500">Sent as the "command" field in the POST /print payload</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11 md:h-9 gap-2" onClick={handleCheckMiddleware} disabled={snapLoading || !selectedPrinter}>
          {snapLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Check Middleware
        </Button>
        <Button className="h-11 md:h-9 gap-2" onClick={handleSendTest} disabled={sending || !selectedPrinter}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Send Test Command
        </Button>
      </div>

      {snap && <SnapshotPanel snap={snap} />}

      {result && (
        <div className={`border rounded-lg p-3 space-y-2 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2">
            {result.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span className={`text-sm font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? 'Success' : 'Failed'}
            </span>
            {result.commandRecord?.command_id && <span className="text-xs text-slate-500 font-mono">ID: {result.commandRecord.command_id}</span>}
          </div>
          {result.errorMessage && <p className="text-sm text-red-700">{result.errorMessage}</p>}
          {result.responseBody && (
            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-white border border-slate-200 rounded p-2 max-h-40 overflow-auto">
              {JSON.stringify(result.responseBody, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function CommandLogTab() {
  const { data: commands = [], isLoading } = useQuery({
    queryKey: ['lbl-print-commands-log'],
    queryFn: () => base44.entities.LblPrintCommand.list('-sent_at', 100),
  });

  const statusColor = {
    acknowledged: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    sent: 'bg-purple-100 text-purple-700',
    queued: 'bg-slate-100 text-slate-600',
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (commands.length === 0) return (
    <div className="text-center py-8 bg-white border border-slate-200 rounded-lg">
      <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-500">No commands logged yet</p>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left px-4 py-3 font-medium">Command ID</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Printer</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">HTTP</th>
              <th className="text-left px-4 py-3 font-medium">Middleware Job</th>
              <th className="text-left px-4 py-3 font-medium">Sent At</th>
              <th className="text-left px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commands.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{c.command_id}</td>
                <td className="px-4 py-3"><span className="capitalize">{c.command_type}</span></td>
                <td className="px-4 py-3 text-slate-500">{c.printer_id || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.response_status_code || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.middleware_job_id || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{c.sent_at ? moment(c.sent_at).format('DD/MM/YYYY HH:mm') : '—'}</td>
                <td className="px-4 py-3 text-xs text-red-600 max-w-[200px] truncate">{c.error_message || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile view */}
      <div className="md:hidden divide-y divide-slate-100">
        {commands.map(c => (
          <div key={c.id} className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-700">{c.command_id}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
            </div>
            <p className="text-sm text-slate-900 capitalize">{c.command_type} — {c.printer_id || 'No printer'}</p>
            <p className="text-xs text-slate-500">{c.sent_at ? moment(c.sent_at).format('DD/MM/YYYY HH:mm') : '—'} · HTTP {c.response_status_code || '—'}</p>
            {c.error_message && <p className="text-xs text-red-600">{c.error_message}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RynanPrinterCenter() {
  const [tab, setTab] = useState('config');
  const [userRole, setUserRole] = useState('user');

  useEffect(() => { base44.auth.me().then(u => setUserRole(u?.role || 'user')).catch(() => {}); }, []);

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Rynan Printer Center</h1>
        <p className="text-sm text-slate-500">Manage middleware printers, test commands, and audit print history</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="config" className="gap-2 h-11 md:h-9"><Printer className="w-4 h-4" /> Configuration</TabsTrigger>
          <TabsTrigger value="test" className="gap-2 h-11 md:h-9"><FlaskConical className="w-4 h-4" /> Test Dispatch</TabsTrigger>
          <TabsTrigger value="log" className="gap-2 h-11 md:h-9"><ScrollText className="w-4 h-4" /> Command Log</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <LblPrinterManager userRole={userRole} />
        </TabsContent>
        <TabsContent value="test" className="mt-4">
          <TestDispatchTab userRole={userRole} />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <CommandLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}