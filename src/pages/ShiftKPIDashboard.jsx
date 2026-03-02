import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import KPIFilters from '@/components/shift-kpi/KPIFilters';
import LabellingKPITab from '@/components/shift-kpi/LabellingKPITab';
import ChamberKPITab from '@/components/shift-kpi/ChamberKPITab';
import FillingKPITab from '@/components/shift-kpi/FillingKPITab';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

export default function ShiftKPIDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: formatDate(new Date(Date.now() - 7 * 86400_000)),
    dateTo:   formatDate(new Date()),
    line:     '',
    operator: '',
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  const allowed = user?.role === 'admin' || user?.role === 'production_manager' ||
                  user?.role === 'labelling_supervisor';

  if (!allowed) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
      <BarChart3 className="w-10 h-10 text-slate-300" />
      <p className="text-slate-500 font-semibold">Access Restricted</p>
      <p className="text-sm text-slate-400">Shift KPI dashboard is visible to supervisors and managers only.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shift KPI Dashboard</h1>
        <p className="text-sm text-slate-500">Throughput · Downtime · Waste · Rework</p>
      </div>

      <KPIFilters filters={filters} onChange={setFilters} />

      <Tabs defaultValue="labelling">
        <TabsList className="bg-slate-100 rounded-xl p-1">
          <TabsTrigger value="labelling"  className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Labelling</TabsTrigger>
          <TabsTrigger value="chamber"   className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Chamber</TabsTrigger>
          <TabsTrigger value="filling"   className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Filling</TabsTrigger>
        </TabsList>

        <TabsContent value="labelling" className="mt-4">
          <LabellingKPITab filters={filters} />
        </TabsContent>
        <TabsContent value="chamber" className="mt-4">
          <ChamberKPITab filters={filters} />
        </TabsContent>
        <TabsContent value="filling" className="mt-4">
          <FillingKPITab filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}