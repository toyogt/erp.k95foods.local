/**
 * Production Orders Data Hook
 * Fetches and manages production order list
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useProductionOrdersData(filters = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOrders();
  }, [filters]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const query = {};

      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.sku) {
        query.sku = filters.sku;
      }
      if (filters.dateFrom) {
        query.created_date = { $gte: filters.dateFrom };
      }

      const results = await base44.entities.ProductionOrder.filter(
        query,
        '-created_date',
        500
      );

      setOrders(results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (orderData) => {
    try {
      const order = await base44.entities.ProductionOrder.create(orderData);
      setOrders([order, ...orders]);
      return { success: true, order };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateOrder = async (orderId, data) => {
    try {
      await base44.entities.ProductionOrder.update(orderId, data);
      setOrders(orders.map(o => o.id === orderId ? { ...o, ...data } : o));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      await base44.entities.ProductionOrder.delete(orderId);
      setOrders(orders.filter(o => o.id !== orderId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const refreshOrders = () => {
    loadOrders();
  };

  return {
    orders,
    loading,
    error,
    createOrder,
    updateOrder,
    deleteOrder,
    refreshOrders,
  };
}