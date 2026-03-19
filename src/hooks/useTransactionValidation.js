/**
 * Transaction Validation Hook
 * Simplifies validation flow in pages
 */

import { useState, useCallback } from 'react';
import { validateTransaction, logBlockedAttempt } from '@/lib/rulesEngine';
import { base44 } from '@/api/base44Client';

export function useTransactionValidation() {
  const [user, setUser] = useState(null);
  const [device, setDevice] = useState(null);
  const [validation, setValidation] = useState(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [pendingOverride, setPendingOverride] = useState(null);

  // Load user and device on mount
  const initializeValidation = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Generate device ID (persistent across session)
      let deviceId = sessionStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('device_id', deviceId);
      }
      setDevice(deviceId);
    } catch (error) {
      console.error('Failed to initialize validation:', error);
    }
  }, []);

  /**
   * Validate before action
   * Returns { canProceed, validation, attemptId }
   */
  const validate = useCallback(
    async ({
      module,
      entityType,
      actionType,
      entityId = null,
      payload = {},
      currentData = {},
    }) => {
      if (!user || !device) {
        throw new Error('Validation not initialized');
      }

      const result = await validateTransaction({
        module,
        entityType,
        actionType,
        entityId,
        payload,
        currentData,
        user,
        device,
      });

      setValidation(result);

      if (!result.valid) {
        // Log blocked attempt
        const id = await logBlockedAttempt({
          ruleKey: result.blocks[0]?.ruleKey,
          module,
          entityType,
          entityId,
          actionType,
          user,
          device,
          errorMessage: result.blocks[0]?.errorMessage,
          payload,
          validationDetails: result.blocks[0]?.validationDetails,
        });

        setAttemptId(id);
        setBlockDialogOpen(true);

        return {
          canProceed: false,
          validation: result,
          attemptId: id,
        };
      }

      return {
        canProceed: true,
        validation: result,
      };
    },
    [user, device]
  );

  /**
   * Called when block is overridden
   */
  const onOverride = useCallback((override) => {
    setPendingOverride(override);
    setBlockDialogOpen(false);
  }, []);

  /**
   * Check if override is pending
   */
  const getOverride = useCallback(() => {
    const override = pendingOverride;
    setPendingOverride(null);
    return override;
  }, [pendingOverride]);

  return {
    initializeValidation,
    validate,
    validation,
    blockDialogOpen,
    setBlockDialogOpen,
    attemptId,
    onOverride,
    getOverride,
    user,
    device,
  };
}