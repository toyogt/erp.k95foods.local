import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Upload, Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';

/**
 * Admin-only CSV importer for the Employee master.
 * Accepts TotalEmployee.csv-style files. Uploads via Core.UploadFile, then
 * invokes the importEmployeesFromCSV backend function.
 */
export default function EmployeeCSVImport({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const upload = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = upload?.file_url;
      if (!fileUrl) throw new Error('upload returned no file_url');

      const res = await base44.functions.invoke('importEmployeesFromCSV', { file_url: fileUrl });
      const data = res?.data;
      if (data?.ok) {
        setResult({ ok: true, summary: data.summary });
        toast({
          title: 'Employees imported',
          description: `Created ${data.summary.created}, updated ${data.summary.updated}, skipped ${data.summary.skipped}`,
        });
        onSuccess?.();
      } else {
        setResult({ ok: false, error: data?.error || 'unknown_error', headers_seen: data?.headers_seen });
        toast({ title: 'Import failed', description: data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      setResult({ ok: false, error: e.message });
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4" /> Import Employee Master (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Upload a CSV with at minimum an <span className="font-mono">employee_code</span> column.
          Optional columns: employee_name, email, phone, department, designation, date_of_joining (DD/MM/YYYY).
          Existing rows are matched by normalized code and updated.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
          <Button
            onClick={handleImport}
            disabled={!file || busy}
            className="h-11 md:h-9 gap-2 w-full sm:w-auto"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import
          </Button>
        </div>

        {result && (
          <div className={`p-3 rounded-lg text-xs ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 font-semibold mb-2">
              {result.ok ? (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-green-700">Import complete</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-red-600" /><span className="text-red-700">Import failed</span></>
              )}
            </div>
            <pre className="whitespace-pre-wrap break-all text-slate-700 font-mono">
              {JSON.stringify(result.summary || result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}