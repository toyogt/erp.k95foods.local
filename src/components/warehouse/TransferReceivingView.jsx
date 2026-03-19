/**
 * Transfer Receiving View
 * Pure presentation component for transfer receiving
 */

import { useState } from 'react';
import DocumentHeader from '@/components/common/DocumentHeader';
import StatusBadge from '@/components/common/StatusBadge';
import ScanInput from '@/components/common/ScanInput';
import ActionFooter from '@/components/common/ActionFooter';
import AuditPanel from '@/components/common/AuditPanel';
import { TRANSFER_STATUSES, TRANSFER_STATUS_COLORS } from '@/lib/transferReceivingHelpers';
import { validateReceiveQty, getVarianceSeverity } from '@/lib/transferReceivingRules';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function TransferReceivingView({
  transfer,
  lines,
  loading = false,
  onReceiveQty,
  onAddLine,
  onRemoveLine,
  onSubmit,
  onCancel,
}) {
  const [scanValue, setScanValue] = useState('');
  const [receivedQtys, setReceivedQtys] = useState({});

  const handleScan = (value) => {
    // Parse scanned value and find matching line
    const matchingLine = lines.find(l => l.sku === value);
    if (matchingLine) {
      // Focus qty input for this line
      const input = document.getElementById(`qty_${matchingLine.id}`);
      input?.focus();
    }
    setScanValue('');
  };

  const handleQtyChange = (lineId, qty) => {
    setReceivedQtys({ ...receivedQtys, [lineId]: qty });
  };

  const handleReceiveAll = () => {
    const updates = lines.reduce((acc, line) => ({
      ...acc,
      [line.id]: line.qty,
    }), {});
    setReceivedQtys(updates);
  };

  const canSubmit = Object.keys(receivedQtys).length === lines.length;

  if (!transfer) {
    return <div className="text-center py-12 text-slate-500">Transfer not found</div>;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <DocumentHeader
        code={transfer.transfer_code}
        title={`Transfer from ${transfer.source_warehouse} to ${transfer.destination_warehouse}`}
        status={TRANSFER_STATUSES[transfer.status]}
        statusColor={TRANSFER_STATUS_COLORS[transfer.status]}
        date={transfer.created_date}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Items" value={lines.length} />
        <SummaryCard label="Expected Total" value={lines.reduce((s, l) => s + (l.qty || 0), 0)} />
        <SummaryCard label="Received" value={Object.values(receivedQtys).reduce((s, v) => s + (parseFloat(v) || 0), 0)} />
        <SummaryCard label="Status" value={TRANSFER_STATUSES[transfer.status]} />
      </div>

      {/* Scan input */}
      {transfer.status === 'SENT' && (
        <ScanInput
          value={scanValue}
          onChange={setScanValue}
          onScan={handleScan}
          placeholder="Scan Product Code or SKU..."
          format="PRODUCT_CODE or SKU"
        />
      )}

      {/* Lines table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product Code</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Expected</th>
                <th className="px-4 py-3 text-right font-medium">Received</th>
                <th className="px-4 py-3 text-center font-medium">Variance</th>
                {transfer.status === 'SENT' && (
                  <th className="px-4 py-3 text-center font-medium">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map(line => {
                const receivedQty = receivedQtys[line.id];
                const isComplete = receivedQty !== undefined && receivedQty !== null;
                const variance = isComplete ? Math.abs(line.qty - receivedQty) / line.qty * 100 : null;
                const severity = variance !== null ? getVarianceSeverity(variance) : null;

                return (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-900">{line.sku}</td>
                    <td className="px-4 py-3 text-slate-700">{line.description}</td>
                    <td className="px-4 py-3 text-right font-medium">{line.qty}</td>
                    <td className="px-4 py-3 text-right">
                      {transfer.status === 'SENT' ? (
                        <Input
                          id={`qty_${line.id}`}
                          type="number"
                          value={receivedQty || ''}
                          onChange={e => handleQtyChange(line.id, parseFloat(e.target.value))}
                          placeholder="0"
                          className="w-20 h-8 text-right"
                          min="0"
                        />
                      ) : (
                        <span className="font-medium">{line.received_qty || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isComplete ? (
                        <VarianceBadge variance={variance} severity={severity} />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    {transfer.status === 'SENT' && (
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveLine?.(line.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit */}
      {transfer.created_date && (
        <AuditPanel
          createdDate={transfer.created_date}
          createdBy={transfer.created_by_name}
          updatedDate={transfer.updated_date}
          updatedBy={transfer.updated_by_name}
        />
      )}

      {/* Action footer */}
      <ActionFooter
        onCancel={onCancel}
        submitLabel={transfer.status === 'SENT' ? 'Confirm Receipt' : 'Submit Transfer'}
        onSubmit={() => {
          if (transfer.status === 'SENT') {
            onSubmit?.(receivedQtys);
          }
        }}
        loading={loading}
        disabled={transfer.status === 'SENT' && !canSubmit}
      />

      {/* Quick actions */}
      {transfer.status === 'SENT' && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReceiveAll}
          >
            <Plus className="w-4 h-4 mr-1" />
            Receive All
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-xs text-slate-600 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function VarianceBadge({ variance, severity }) {
  const colors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[severity]}`}>
      {variance.toFixed(1)}%
    </span>
  );
}