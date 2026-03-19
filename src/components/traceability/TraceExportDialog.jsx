/**
 * Trace Export Dialog
 * Export traceability report to PDF or CSV
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function TraceExportDialog({
  trace,
  searchType,
  searchValue,
  onClose,
}) {
  const [format_type, setFormatType] = useState('pdf');
  const [exportOptions, setExportOptions] = useState({
    includeTimeline: true,
    includeSources: true,
    includeDerivatives: true,
    includeSummary: true,
  });
  const [exporting, setExporting] = useState(false);

  const toggleOption = (key) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (format_type === 'pdf') {
        await exportPDF();
      } else if (format_type === 'csv') {
        exportCSV();
      }
      onClose();
    } catch (error) {
      alert('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 10;

    // Header
    doc.setFontSize(16);
    doc.text('Traceability Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Summary
    doc.setFontSize(12);
    doc.text('Summary', 10, yPos);
    yPos += 7;

    doc.setFontSize(9);
    doc.text(`Search Type: ${searchType.toUpperCase()}`, 10, yPos);
    yPos += 5;
    doc.text(`Search Value: ${searchValue}`, 10, yPos);
    yPos += 5;

    if (exportOptions.includeSummary && trace.summary) {
      doc.text(`Total Events: ${trace.summary.totalEvents || trace.completeTimeline?.length || 0}`, 10, yPos);
      yPos += 5;
      doc.text(`Source Materials: ${trace.summary.sources || 0}`, 10, yPos);
      yPos += 5;
      doc.text(`Derivatives: ${trace.summary.derivatives || 0}`, 10, yPos);
      yPos += 5;
      doc.text(`Final Dispatches: ${trace.summary.finalDispatches || 0}`, 10, yPos);
      yPos += 10;
    }

    // Timeline
    if (exportOptions.includeTimeline) {
      doc.setFontSize(12);
      doc.text('Event Timeline', 10, yPos);
      yPos += 7;

      const events = trace.completeTimeline || trace.timeline || [];
      const maxEvents = 50; // Limit to avoid huge PDFs

      for (let i = 0; i < Math.min(events.length, maxEvents); i++) {
        const event = events[i];

        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 10;
        }

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(formatEventType(event.event_type), 10, yPos);
        yPos += 4;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text(`${format(new Date(event.timestamp), 'MMM d HH:mm:ss')}`, 10, yPos);
        yPos += 3;

        doc.text(`${event.source_entity_type} → ${event.target_entity_type}`, 10, yPos);
        yPos += 3;

        if (event.quantity) {
          doc.text(`Qty: ${event.quantity} ${event.unit}`, 10, yPos);
          yPos += 3;
        }

        yPos += 2;
      }

      if (events.length > maxEvents) {
        doc.setFontSize(8);
        doc.text(`... and ${events.length - maxEvents} more events`, 10, yPos);
        yPos += 5;
      }
    }

    // Save
    doc.save(`trace_${searchType}_${searchValue}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  };

  const exportCSV = () => {
    const events = trace.completeTimeline || trace.timeline || [];

    // Headers
    const headers = [
      'Timestamp',
      'Event Type',
      'Module',
      'Source Type',
      'Source ID',
      'Target Type',
      'Target ID',
      'Quantity',
      'Unit',
      'Batch ID',
      'Lot ID',
      'Crate ID',
      'Pallet ID',
      'Dispatch ID',
      'Product Code',
      'User',
      'Remarks',
      'Loss',
      'Loss Reason',
    ];

    // Data rows
    const rows = events.map(event => [
      format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      event.event_type,
      event.module,
      event.source_entity_type,
      event.source_entity_id,
      event.target_entity_type,
      event.target_entity_id,
      event.quantity || '',
      event.unit || '',
      event.batch_id || '',
      event.lot_id || '',
      event.crate_id || '',
      event.pallet_id || '',
      event.dispatch_id || '',
      event.sku || '',
      event.user_name || '',
      `"${(event.remarks || '').replace(/"/g, '""')}"`, // Escape quotes
      event.yield_loss || '',
      event.loss_reason || '',
    ]);

    // Build CSV
    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell =>
          typeof cell === 'string' && cell.includes(',')
            ? `"${cell}"`
            : cell
        ).join(',')
      ),
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace_${searchType}_${searchValue}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Traceability Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format selector */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Export Format</label>
            <Select value={format_type} onValueChange={setFormatType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF (Document)</SelectItem>
                <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm font-medium text-slate-700">Include in Report</p>

            {[
              { key: 'includeSummary', label: 'Summary Statistics' },
              { key: 'includeTimeline', label: 'Event Timeline' },
              { key: 'includeSources', label: 'Source Materials' },
              { key: 'includeDerivatives', label: 'Downstream Products' },
            ].map(option => (
              <label key={option.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={exportOptions[option.key]}
                  onCheckedChange={() => toggleOption(option.key)}
                />
                <span className="text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Info */}
          <div className="text-xs text-slate-600 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-medium mb-1">Report includes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Search criteria and metadata</li>
              <li>All trace events in chronological order</li>
              <li>Batch, lot, crate, and pallet information</li>
              <li>User actions and timestamps</li>
              <li>Loss/waste tracking</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {format_type.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatEventType(type) {
  return type
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}