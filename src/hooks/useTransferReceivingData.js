/**
 * Transfer Receiving Data Hook
 * Fetches and manages transfer receiving data
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useTransferReceivingData(transferId = null) {
  const [transfer, setTransfer] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [transferId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (transferId) {
        // Get existing transfer
        const transfers = await base44.entities.WarehouseTransfer.filter(
          { id: transferId },
          'created_date',
          1
        );
        
        if (transfers && transfers[0]) {
          setTransfer(transfers[0]);

          // Get line items
          const lineItems = await base44.entities.WarehouseTransferLine.filter(
            { transfer_id: transferId },
            'created_date',
            500
          );
          setLines(lineItems || []);
        } else {
          setError('Transfer not found');
        }
      } else {
        // New transfer
        setTransfer(null);
        setLines([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addLine = async (lineData) => {
    try {
      const line = await base44.entities.WarehouseTransferLine.create({
        transfer_id: transfer.id,
        ...lineData,
      });
      setLines([...lines, line]);
      return { success: true, line };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateLine = async (lineId, lineData) => {
    try {
      await base44.entities.WarehouseTransferLine.update(lineId, lineData);
      setLines(lines.map(l => l.id === lineId ? { ...l, ...lineData } : l));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const removeLine = async (lineId) => {
    try {
      await base44.entities.WarehouseTransferLine.delete(lineId);
      setLines(lines.filter(l => l.id !== lineId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const refreshTransfer = () => {
    loadData();
  };

  return {
    transfer,
    lines,
    loading,
    error,
    addLine,
    updateLine,
    removeLine,
    refreshTransfer,
  };
}