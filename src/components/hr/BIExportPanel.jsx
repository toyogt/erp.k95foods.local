import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Database, Copy, Check } from 'lucide-react';
import { candidatesToCSV, downloadCSV } from '@/lib/hrAnalyticsHelpers';

/**
 * BI Export panel — provides:
 * - CSV download of all candidate leads (for Tableau / Power BI / Looker Studio import)
 * - Live JSON endpoint guidance using the existing Base44 SDK / REST
 */
export default function BIExportPanel({ candidates }) {
  const [copied, setCopied] = useState(false);

  const handleCSVDownload = () => {
    const csv = candidatesToCSV(candidates);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `hr-attrition-${stamp}.csv`);
  };

  const sampleQuery = `// Pull candidate leads from Base44 SDK
import { base44 } from '@/api/base44Client';
const leads = await base44.entities.CandidateLead.list('-created_date', 5000);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-600" />
          BI Tool Integration (Tableau / Power BI / Looker Studio)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CSV Download */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-slate-200 rounded-md p-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Download Flat CSV</div>
            <p className="text-xs text-slate-500 mt-0.5">
              One row per candidate with computed tenure. Import directly into your BI tool.
            </p>
          </div>
          <Button onClick={handleCSVDownload} className="h-11 md:h-9 gap-2 w-full md:w-auto">
            <Download className="w-4 h-4" />
            Download CSV ({candidates.length} rows)
          </Button>
        </div>

        {/* Programmatic access */}
        <div className="border border-slate-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-900">Programmatic Access</div>
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 gap-1">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="text-xs bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto">
{sampleQuery}
          </pre>
          <p className="text-xs text-slate-500">
            For scheduled BI refreshes, build a backend function that queries this entity, exports the CSV
            to cloud storage (Google Sheets / Drive), and connect your BI tool to that source.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-900">
          <strong>Power BI / Tableau / Looker Studio:</strong> Use the CSV export above as a static source,
          or schedule an automated export via the Sync Center to keep BI dashboards current.
        </div>
      </CardContent>
    </Card>
  );
}