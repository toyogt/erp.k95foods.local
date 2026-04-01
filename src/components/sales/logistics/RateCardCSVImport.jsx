/**
 * RateCardCSVImport — CSV import modal for Transport Rate Cards.
 * Supports customer/customer group mapping.
 */
import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

const CSV_HEADERS = [
  'name',
  'customer_name',
  'customer_group',
  'weight_from_kg',
  'weight_to_kg',
  'freight_cost',
  'door_delivery_cost',
  'bilty_cost',
  'labour_cost',
  'pickup_charges',
  'late_fees',
  'transporter',
  'destination_region',
  'is_active',
  'notes',
];

const SAMPLE_ROWS = [
  ['Mumbai Local', 'Zepto', 'Quick Commerce', '0', '50', '500', '200', '100', '150', '0', '0', 'Blue Dart', 'Mumbai', 'true', ''],
  ['Delhi NCR Standard', 'Blinkit', 'Quick Commerce', '0', '100', '1200', '400', '200', '300', '100', '0', 'Delhivery', 'Delhi NCR', 'true', 'Standard rates'],
  ['Pan India Heavy', '', 'General Trade', '100', '500', '3500', '800', '350', '500', '200', '100', 'GATI', 'Pan India', 'true', 'Heavy shipments'],
  ['Default Rate', '', '', '0', '50', '800', '300', '150', '200', '50', '0', '', '', 'true', 'Default for all customers'],
];

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['File must have a header row and at least one data row'] };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    // Validate required fields
    const wFrom = parseFloat(row.weight_from_kg);
    const wTo = parseFloat(row.weight_to_kg);
    if (isNaN(wFrom) || isNaN(wTo)) {
      errors.push(`Row ${i + 1}: Weight range is required and must be numeric`);
      continue;
    }

    rows.push({
      name: row.name || undefined,
      customer_name: row.customer_name || undefined,
      customer_group: row.customer_group || undefined,
      weight_from_kg: wFrom,
      weight_to_kg: wTo,
      freight_cost: parseFloat(row.freight_cost) || 0,
      door_delivery_cost: parseFloat(row.door_delivery_cost) || 0,
      bilty_cost: parseFloat(row.bilty_cost) || 0,
      labour_cost: parseFloat(row.labour_cost) || 0,
      pickup_charges: parseFloat(row.pickup_charges) || 0,
      late_fees: parseFloat(row.late_fees) || 0,
      transporter: row.transporter || undefined,
      destination_region: row.destination_region || undefined,
      is_active: row.is_active ? row.is_active.toLowerCase() !== 'false' : true,
      notes: row.notes || undefined,
    });
  }

  return { rows, errors };
}

export default function RateCardCSVImport({ open, onOpenChange }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null); // { rows, errors }
  const [result, setResult] = useState(null);   // { success, failed }

  const handleDownloadSample = () => {
    const csvContent = [CSV_HEADERS.join(','), ...SAMPLE_ROWS.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transport_rate_cards_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview?.rows?.length) return;
    setImporting(true);
    let success = 0;
    let failed = 0;

    // Bulk create in batches of 20
    const batchSize = 20;
    for (let i = 0; i < preview.rows.length; i += batchSize) {
      const batch = preview.rows.slice(i, i + batchSize);
      try {
        await base44.entities.TransportRateCard.bulkCreate(batch);
        success += batch.length;
      } catch {
        // Fallback to individual creates
        for (const row of batch) {
          try {
            await base44.entities.TransportRateCard.create(row);
            success++;
          } catch {
            failed++;
          }
        }
      }
    }

    setImporting(false);
    setResult({ success, failed });
    qc.invalidateQueries({ queryKey: ['transport-rate-cards-all'] });
    toast({
      title: `Import complete: ${success} created, ${failed} failed`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  };

  const handleClose = () => {
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transport Rate Cards from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-blue-800 font-medium">CSV Format Instructions</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc pl-4">
              <li><strong>customer_name</strong> — Map rate to a specific customer (e.g., Zepto, Blinkit). Leave blank for default.</li>
              <li><strong>customer_group</strong> — Map rate to a customer group (e.g., Quick Commerce, General Trade). Leave blank for default.</li>
              <li><strong>weight_from_kg</strong> and <strong>weight_to_kg</strong> — Required. Define the weight bracket for this rate.</li>
              <li>Cost columns accept numeric values in INR. Leave blank or 0 if not applicable.</li>
              <li><strong>is_active</strong> — Use "true" or "false". Defaults to true if blank.</li>
            </ul>
          </div>

          {/* Download sample */}
          <Button variant="outline" className="h-11 w-full text-sm gap-2" onClick={handleDownloadSample}>
            <Download className="w-4 h-4" /> Download Sample CSV File
          </Button>

          {/* File upload */}
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-3">Upload your CSV file</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" className="h-11 text-sm gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Choose CSV File
            </Button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              {preview.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 mb-1">Validation Errors</p>
                  {preview.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-900 mb-2">
                  Preview: {preview.rows.length} rate card{preview.rows.length !== 1 ? 's' : ''} ready to import
                </p>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="text-left py-1.5 px-2 font-medium">Name</th>
                        <th className="text-left py-1.5 px-2 font-medium">Customer</th>
                        <th className="text-left py-1.5 px-2 font-medium">Group</th>
                        <th className="text-right py-1.5 px-2 font-medium">Weight (kg)</th>
                        <th className="text-right py-1.5 px-2 font-medium">Freight</th>
                        <th className="text-right py-1.5 px-2 font-medium">Door Delivery</th>
                        <th className="text-left py-1.5 px-2 font-medium">Transporter</th>
                        <th className="text-left py-1.5 px-2 font-medium">Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1 px-2">{r.name || '—'}</td>
                          <td className="py-1 px-2">{r.customer_name || '—'}</td>
                          <td className="py-1 px-2">{r.customer_group || '—'}</td>
                          <td className="py-1 px-2 text-right">{r.weight_from_kg}–{r.weight_to_kg}</td>
                          <td className="py-1 px-2 text-right">₹{r.freight_cost}</td>
                          <td className="py-1 px-2 text-right">₹{r.door_delivery_cost}</td>
                          <td className="py-1 px-2">{r.transporter || '—'}</td>
                          <td className="py-1 px-2">{r.destination_region || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows.length > 10 && (
                    <p className="text-xs text-slate-500 mt-1 text-center">...and {preview.rows.length - 10} more rows</p>
                  )}
                </div>
              </div>

              {/* Result */}
              {result && (
                <div className={`rounded-lg p-3 border flex items-center gap-2 ${
                  result.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
                }`}>
                  {result.failed > 0
                    ? <AlertCircle className="w-4 h-4 text-amber-600" />
                    : <CheckCircle2 className="w-4 h-4 text-green-600" />
                  }
                  <span className="text-sm">
                    {result.success} rate card{result.success !== 1 ? 's' : ''} imported successfully
                    {result.failed > 0 && `, ${result.failed} failed`}
                  </span>
                </div>
              )}

              {/* Import button */}
              {!result && preview.rows.length > 0 && (
                <Button className="h-11 w-full text-sm gap-2" onClick={handleImport} disabled={importing}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import {preview.rows.length} Rate Card{preview.rows.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}