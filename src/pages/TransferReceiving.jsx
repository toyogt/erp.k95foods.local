/**
 * Transfer Receiving Page (Refactored)
 * Container for transfer receiving workflow
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TransferReceivingView from '@/components/warehouse/TransferReceivingView';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useTransferReceivingData } from '@/hooks/useTransferReceivingData';
import { useTransferReceivingActions } from '@/hooks/useTransferReceivingActions';
import { toast } from 'sonner';

export default function TransferReceivingPage() {
  const { transferId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Load user
  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(() => {});
  }, []);

  // Load data
  const {
    transfer,
    lines,
    loading,
    error,
    removeL ine,
    refreshTransfer,
  } = useTransferReceivingData(transferId);

  // Actions
  const { receiveTransfer, discardTransfer, actionLoading } = useTransferReceivingActions(() => {
    toast.success('Transfer updated');
    refreshTransfer();
    if (transfer?.status === 'RECEIVED') {
      setTimeout(() => navigate('/WarehouseOps'), 1000);
    }
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  const handleReceive = async (receivedQtys) => {
    if (!user) return;

    const receivedLines = lines.map(line => ({
      ...line,
      received_qty: receivedQtys[line.id],
    }));

    const result = await receiveTransfer(transferId, receivedLines, user);
    if (!result.success) {
      toast.error(result.error);
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Cancel this transfer?')) {
      const result = await discardTransfer(transferId);
      if (result.success) {
        navigate('/WarehouseOps');
      } else {
        toast.error(result.error);
      }
    }
  };

  return (
    <ErrorBoundary>
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto"></div>
        </div>
      ) : (
        <TransferReceivingView
          transfer={transfer}
          lines={lines}
          loading={actionLoading}
          onRemoveLine={removeLine}
          onSubmit={handleReceive}
          onCancel={handleCancel}
        />
      )}
    </ErrorBoundary>
  );
}