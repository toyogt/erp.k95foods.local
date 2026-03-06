import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Square } from 'lucide-react';

export default function ProductionControl() {
  const [user, setUser] = useState(null);
  const [machines, setMachines] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activeBatches, setActiveBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingMachine, setStartingMachine] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [stoppingMachine, setStoppingMachine] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin' && u?.role !== 'production_manager') {
        alert('Access denied');
        return;
      }
      loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [macs, pls, bats] = await Promise.all([
      base44.entities.Machine.filter({ machine_type: 'FILLER' }, '-created_date', 100),
      base44.entities.LiquidBatchPlan.filter({ status: 'RELEASED' }, '-created_date', 100),
      base44.entities.MachineActiveBatch.filter({ status: 'ACTIVE' }, '-created_date', 100),
    ]);
    setMachines(macs);
    setPlans(pls);
    setActiveBatches(bats);
    setLoading(false);
  };

  const getActiveBatch = (machineId) => activeBatches.find(b => b.machine_id === machineId);

  const handleStartFilling = async () => {
    if (!startingMachine || !selectedPlan) {
      alert('Select a machine and plan');
      return;
    }

    try {
      const response = await base44.functions.invoke('startLiquidPlan', {
        plan_id: selectedPlan.plan_id,
        filler_machine_id: startingMachine.machine_id,
      });

      if (response.data.success) {
        alert(`Plan started. ${response.data.batch_ids_generated} batch IDs generated.`);
        setStartingMachine(null);
        setSelectedPlan(null);
        loadData();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleStopFilling = async (batch) => {
    if (!window.confirm(`Stop filling batch ${batch.batch_id}?`)) return;

    try {
      // Find the plan
      const planObj = plans.find(p => p.plan_id === batch.batch_id);
      if (planObj) {
        await base44.entities.LiquidBatchPlan.update(planObj.id, {
          status: 'COMPLETED',
        });
      }

      // Close the active batch
      await base44.entities.MachineActiveBatch.update(batch.id, {
        status: 'CLOSED',
      });

      alert('Filling stopped');
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Filling Start/Stop</h1>
        <p className="text-sm text-slate-500">Manage liquid batch plans on filler machines</p>
      </div>

      {/* Active Fillings */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">Active Fillings</h2>
        {activeBatches.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No active fillings</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeBatches.map(batch => {
              const machine = machines.find(m => m.machine_id === batch.machine_id);
              return (
                <div key={batch.id} className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-green-900">{machine?.machine_id || batch.machine_id}</p>
                      <p className="text-sm text-green-700">{machine?.name}</p>
                    </div>
                    <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">ACTIVE</span>
                  </div>
                  <div className="bg-white rounded-lg p-3 space-y-1 mb-3">
                    <p className="text-xs text-slate-600">Batch</p>
                    <p className="font-mono font-semibold text-slate-800">{batch.batch_id}</p>
                    <p className="text-xs text-slate-600 mt-2">{batch.product_name || batch.product_code}</p>
                    {batch.started_at && (
                      <p className="text-xs text-slate-500 mt-2">
                        Started: {new Date(batch.started_at).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStopFilling(batch)}
                    className="w-full gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop Filling
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Start New Filling */}
      <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
        <h2 className="font-semibold text-slate-900 mb-3">Start New Filling</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Machine Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Filler Machine</label>
            <select
              value={startingMachine?.id || ''}
              onChange={e => {
                const id = e.target.value;
                setStartingMachine(machines.find(m => m.id === id) || null);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">— Select machine —</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.machine_id} - {m.name}
                </option>
              ))}
            </select>
            {startingMachine && getActiveBatch(startingMachine.machine_id) && (
              <p className="text-xs text-red-600 mt-1">Machine is already in use</p>
            )}
          </div>

          {/* Plan Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Liquid Batch Plan</label>
            <select
              value={selectedPlan?.id || ''}
              onChange={e => {
                const id = e.target.value;
                setSelectedPlan(plans.find(p => p.id === id) || null);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">— Select plan —</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.plan_id} - {p.recipe_id} ({p.recipe_name})
                </option>
              ))}
            </select>
          </div>

          {/* Start Button */}
          <div className="flex items-end">
            <Button
              onClick={handleStartFilling}
              disabled={!startingMachine || !selectedPlan || (startingMachine && getActiveBatch(startingMachine.machine_id))}
              className="w-full gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4" /> Start Filling
            </Button>
          </div>
        </div>

        {selectedPlan && (
          <div className="bg-white rounded-lg p-3 text-sm text-slate-700">
            <p><strong>Recipe:</strong> {selectedPlan.recipe_id} - {selectedPlan.recipe_name}</p>
            <p><strong>Status:</strong> {selectedPlan.status}</p>
            {selectedPlan.linked_order_ids && (
              <p><strong>Orders:</strong> {selectedPlan.linked_order_ids}</p>
            )}
          </div>
        )}
      </div>

      {/* Machines Overview */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">All Filler Machines</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Machine ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Active Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {machines.map(m => {
                const activeBatch = getActiveBatch(m.machine_id);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{m.machine_id}</td>
                    <td className="px-4 py-3 text-slate-700">{m.name}</td>
                    <td className="px-4 py-3 text-center">
                      {activeBatch ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">RUNNING</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">IDLE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {activeBatch ? (
                        <span className="font-mono text-sm font-semibold">{activeBatch.batch_id}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}