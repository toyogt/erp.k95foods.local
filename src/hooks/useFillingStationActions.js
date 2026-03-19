/**
 * Filling Station Actions Hook
 * Filling operations and state transitions
 */

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fireTraceEvent } from '@/lib/traceEventHelper';
import { fireFMSEvent, linkFMSRef } from '@/lib/useFMSAutoComplete';

export function useFillingStationActions(onSuccess) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const startBatch = async (batchId, machineId, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      // Create machine active batch
      await base44.entities.MachineActiveBatch.create({
        machine_id: machineId,
        batch_id: batchId,
        started_at: new Date().toISOString(),
        started_by: user.email,
      });

      // Fire FMS event
      await fireFMSEvent('BATCH_FILLING_START', batchId);

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const recordCrate = async (crateData, batch, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      // Create crate
      const crate = await base44.entities.Crate.create({
        crate_id: crateData.crate_id,
        batch_id: batch.id,
        bottle_type: crateData.bottle_type || batch.bottle_type,
        bottle_count: crateData.bottle_count || batch.bottle_count,
        status: 'FILLED',
        filled_time: new Date().toISOString(),
        current_location: 'FILLING_LINE',
      });

      // Fire trace event
      await fireTraceEvent({
        eventType: 'FILLING_OUTPUT',
        module: 'PRODUCTION',
        sourceType: 'Batch',
        sourceId: batch.id,
        targetType: 'Crate',
        targetId: crate.id,
        quantity: crateData.bottle_count,
        unit: 'bottles',
        batchId: batch.id,
        crateId: crate.id,
        user,
        device: 'filling_station_01',
      });

      onSuccess?.();
      return { success: true, crate };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const completeBatch = async (batchId, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      // Update batch
      await base44.entities.Batch.update(batchId, {
        status: 'FILLING_COMPLETE',
        completed_at: new Date().toISOString(),
      });

      // Fire FMS event
      await fireFMSEvent('BATCH_FILLING_COMPLETE', batchId);

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const pauseBatch = async (batchId, reason, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await base44.entities.MachineActiveBatch.update(batchId, {
        paused_at: new Date().toISOString(),
        pause_reason: reason,
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
    startBatch,
    recordCrate,
    completeBatch,
    pauseBatch,
    actionLoading,
    actionError,
  };
}