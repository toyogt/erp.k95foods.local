/**
 * Transfer Receiving Actions Hook
 * Business logic for transfer receiving
 */

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { checkTransferRules, validateReceiveQty } from '@/lib/transferReceivingRules';
import { formatTransferCode } from '@/lib/transferReceivingHelpers';

export function useTransferReceivingActions(onSuccess) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const createTransfer = async (formData, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      // Validate rules
      const errors = checkTransferRules({ ...formData });
      if (errors.length > 0) {
        setActionError(errors[0]);
        return { success: false, error: errors[0] };
      }

      // Create transfer
      const transferCode = formatTransferCode('TRF', Date.now());
      const transfer = await base44.entities.WarehouseTransfer.create({
        transfer_code: transferCode,
        ...formData,
        status: 'DRAFT',
        created_by: user.email,
        created_by_name: user.full_name,
      });

      onSuccess?.();
      return { success: true, transfer };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const submitTransfer = async (transferId, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await base44.entities.WarehouseTransfer.update(transferId, {
        status: 'SENT',
        sent_by: user.email,
        sent_at: new Date().toISOString(),
      });

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const receiveTransfer = async (transferId, receivedLines, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      // Validate received quantities
      for (const line of receivedLines) {
        const err = validateReceiveQty(line.received_qty, line.expected_qty);
        if (err) {
          setActionError(err);
          return { success: false, error: err };
        }
      }

      // Update each line
      for (const line of receivedLines) {
        await base44.entities.WarehouseTransferLine.update(line.id, {
          received_qty: line.received_qty,
          received_at: new Date().toISOString(),
          received_by: user.email,
        });
      }

      // Update transfer status
      await base44.entities.WarehouseTransfer.update(transferId, {
        status: 'RECEIVED',
        received_by: user.email,
        received_at: new Date().toISOString(),
      });

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const discardTransfer = async (transferId) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await base44.entities.WarehouseTransfer.update(transferId, {
        status: 'CANCELLED',
      });

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  return {
    createTransfer,
    submitTransfer,
    receiveTransfer,
    discardTransfer,
    actionLoading,
    actionError,
  };
}