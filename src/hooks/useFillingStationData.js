/**
 * Filling Station Data Hook
 * Manages filling operation state
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useFillingStationData(batchId = null) {
  const [batch, setBatch] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);
  const [crates, setCrates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [batchId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active machine batch
      const machineActive = await base44.entities.MachineActiveBatch.filter(
        { machine_id: 'filling_station_01' },
        '-created_date',
        1
      );

      if (machineActive && machineActive[0]) {
        setActiveBatch(machineActive[0]);

        // Get batch
        const batches = await base44.entities.Batch.filter(
          { id: machineActive[0].batch_id },
          'created_date',
          1
        );
        if (batches && batches[0]) {
          setBatch(batches[0]);

          // Get crates
          const crateList = await base44.entities.Crate.filter(
            { batch_id: batches[0].id },
            '-created_date',
            500
          );
          setCrates(crateList || []);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCrate = async (crateData) => {
    try {
      const crate = await base44.entities.Crate.create({
        batch_id: batch.id,
        ...crateData,
      });
      setCrates([...crates, crate]);
      return { success: true, crate };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateCrate = async (crateId, data) => {
    try {
      await base44.entities.Crate.update(crateId, data);
      setCrates(crates.map(c => c.id === crateId ? { ...c, ...data } : c));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const removeCrate = async (crateId) => {
    try {
      await base44.entities.Crate.delete(crateId);
      setCrates(crates.filter(c => c.id !== crateId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const refreshData = () => {
    loadData();
  };

  return {
    batch,
    activeBatch,
    crates,
    loading,
    error,
    addCrate,
    updateCrate,
    removeCrate,
    refreshData,
  };
}