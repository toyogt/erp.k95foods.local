/**
 * Production Orders Actions Hook
 * Create, release, and manage production orders
 */

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { checkProductionRules } from '@/lib/productionRules';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

export function useProductionOrdersActions(onSuccess) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const createProductionOrder = async (formData, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      // Validate
      const errors = checkProductionRules(formData);
      if (errors.length > 0) {
        setActionError(errors[0]);
        return { success: false, error: errors[0] };
      }

      // Create order
      const order = await base44.entities.ProductionOrder.create({
        ...formData,
        status: 'DRAFT',
        created_by: user.email,
        created_by_name: user.full_name,
      });

      // Fire FMS event
      await fireFMSEvent('PRODUCTION_ORDER_CREATE', order.id);

      onSuccess?.();
      return { success: true, order };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const releaseOrder = async (orderId, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await base44.entities.ProductionOrder.update(orderId, {
        status: 'RELEASED',
        released_by: user.email,
        released_at: new Date().toISOString(),
      });

      // Fire FMS event
      await fireFMSEvent('PRODUCTION_ORDER_RELEASE', orderId);

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const completeOrder = async (orderId, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await base44.entities.ProductionOrder.update(orderId, {
        status: 'COMPLETED',
        completed_by: user.email,
        completed_at: new Date().toISOString(),
      });

      // Fire FMS event
      await fireFMSEvent('PRODUCTION_ORDER_COMPLETE', orderId);

      onSuccess?.();
      return { success: true };
    } catch (error) {
      setActionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(false);
    }
  };

  const cancelOrder = async (orderId, reason, user) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await base44.entities.ProductionOrder.update(orderId, {
        status: 'CANCELLED',
        cancelled_reason: reason,
        cancelled_by: user.email,
        cancelled_at: new Date().toISOString(),
      });

      // Fire FMS event
      await fireFMSEvent('PRODUCTION_ORDER_CANCEL', orderId);

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
    createProductionOrder,
    releaseOrder,
    completeOrder,
    cancelOrder,
    actionLoading,
    actionError,
  };
}