import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import KPITable from './KPITable';

export default function FillingKPITab({ filters }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const toMs   = filters.dateTo   ? new Date(filters.dateTo + 'T23:59:59').getTime() : Date.now();

    // Crate-based filling metrics from WIPMovementLog or Crate entity
    const crates = await base44.entities.Crate.filter({}, '-created_date', 300).catch(() => []);

    const filtered = crates.filter(c => {
      const ts = c.created_date ? new Date(c.created_date).getTime() : 0;
      return ts >= fromMs && ts <= toMs;
    });

    // Group by filler_machine_id
    const byMachine = {};
    filtered.forEach(c => {
      const mid = c.filler_machine_id || 'Unknown';
      if (!byMachine[mid]) byMachine[mid] = { machine: mid, crates: 0, bottles: 0 };
      byMachine[mid].crates++;
      byMachine[mid].bottles += c.bottle_count || 0;
    });

    setRows(Object.values(byMachine));
    setLoading(false);
  }

  const columns = [
    { key: 'machine', label: 'Machine' },
    { key: 'crates',  label: 'Crates Filled' },
    { key: 'bottles', label: 'Bottles Est.' },
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 italic">Filling KPIs — crate-count based. Full throughput metrics in a future prompt.</p>
      <KPITable columns={columns} rows={rows} emptyMsg="No crate data for this date range." />
    </div>
  );
}