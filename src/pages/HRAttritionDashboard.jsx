import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import AttritionKPICards from '@/components/hr/AttritionKPICards';
import {
  ReachVsConversionChart,
  CategoryBarChart,
  TenureBucketChart,
  StatusPieChart,
} from '@/components/hr/AttritionCharts';
import {
  computeKPIs,
  groupByDate,
  buildDailySeries,
  groupByCategory,
  inDateRange,
} from '@/lib/candidateAttritionStats';

const ALLOWED_ROLES = ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'];

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function HRAttritionDashboard() {
  const [user, setUser] = useState(null);
  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: candidates = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['candidate-leads-analytics'],
    queryFn: () => base44.entities.CandidateLead.list('-created_date', 5000),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  // Filter by first_contact_date range for "reach" funnel; full set used for tenure
  const reachedInRange = useMemo(
    () => candidates.filter((c) => inDateRange(c, 'first_contact_date', fromDate, toDate)),
    [candidates, fromDate, toDate]
  );
  const enrolledInRange = useMemo(
    () => candidates.filter((c) => inDateRange(c, 'enrollment_date', fromDate, toDate)),
    [candidates, fromDate, toDate]
  );
  const terminatedInRange = useMemo(
    () => candidates.filter((c) => inDateRange(c, 'attrition_date', fromDate, toDate)),
    [candidates, fromDate, toDate]
  );

  const reachedSeries = useMemo(
    () => buildDailySeries(groupByDate(reachedInRange, 'first_contact_date'), fromDate, toDate),
    [reachedInRange, fromDate, toDate]
  );
  const convertedSeries = useMemo(
    () => buildDailySeries(groupByDate(enrolledInRange, 'enrollment_date'), fromDate, toDate),
    [enrolledInRange, fromDate, toDate]
  );

  const kpis = useMemo(() => computeKPIs(candidates), [candidates]);
  const sourceBreakdown = useMemo(() => groupByCategory(candidates, 'source_type'), [candidates]);
  const locationBreakdown = useMemo(
    () => groupByCategory(candidates.filter((c) => c.location_area), 'location_area').slice(0, 8),
    [candidates]
  );
  const roleBreakdown = useMemo(
    () => groupByCategory(candidates.filter((c) => c.role_interested), 'role_interested').slice(0, 8),
    [candidates]
  );
  const statusBreakdown = useMemo(() => groupByCategory(candidates, 'status'), [candidates]);

  // Attrition by source (only among hired candidates)
  const attritionBySource = useMemo(() => {
    const hired = candidates.filter((c) => c.status === 'Hired' || c.status === 'Terminated');
    const groups = {};
    for (const c of hired) {
      const k = c.source_type || 'Unknown';
      groups[k] = groups[k] || { hired: 0, terminated: 0 };
      groups[k].hired += 1;
      if (c.status === 'Terminated') groups[k].terminated += 1;
    }
    return Object.entries(groups)
      .map(([name, v]) => ({
        name,
        value: v.hired ? Math.round((v.terminated / v.hired) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [candidates]);

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            HR access required to view Attrition Analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Attrition Analytics</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Recruitment funnel & employee tenure insights · {candidates.length} lead{candidates.length !== 1 && 's'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="h-11 md:h-9 gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <AttritionKPICards kpis={kpis} />

          {/* Date range filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Date Range Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">From Date</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-11 md:h-9 text-base md:text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">To Date</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-11 md:h-9 text-base md:text-sm"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button variant="outline" onClick={() => { setFromDate(isoDaysAgo(7)); setToDate(new Date().toISOString().slice(0, 10)); }} className="h-11 md:h-9 flex-1">7D</Button>
                  <Button variant="outline" onClick={() => { setFromDate(isoDaysAgo(30)); setToDate(new Date().toISOString().slice(0, 10)); }} className="h-11 md:h-9 flex-1">30D</Button>
                  <Button variant="outline" onClick={() => { setFromDate(isoDaysAgo(90)); setToDate(new Date().toISOString().slice(0, 10)); }} className="h-11 md:h-9 flex-1">90D</Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                <div className="bg-slate-50 rounded-md p-2">
                  <div className="text-xs text-slate-500">Reached</div>
                  <div className="text-lg font-bold text-slate-900">{reachedInRange.length}</div>
                </div>
                <div className="bg-green-50 rounded-md p-2">
                  <div className="text-xs text-slate-500">Converted</div>
                  <div className="text-lg font-bold text-green-700">{enrolledInRange.length}</div>
                </div>
                <div className="bg-red-50 rounded-md p-2">
                  <div className="text-xs text-slate-500">Exited</div>
                  <div className="text-lg font-bold text-red-700">{terminatedInRange.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reach vs Conversion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daily Reach vs Conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <ReachVsConversionChart reachedSeries={reachedSeries} convertedSeries={convertedSeries} />
            </CardContent>
          </Card>

          {/* Tenure & Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tenure Distribution (Exited Employees)</CardTitle>
              </CardHeader>
              <CardContent>
                <TenureBucketChart data={kpis.tenureBuckets} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusPieChart data={statusBreakdown} />
              </CardContent>
            </Card>
          </div>

          {/* Source / Location / Role / Attrition by source */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Leads by Source</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBarChart data={sourceBreakdown} label="Leads" color="#3b82f6" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Attrition Rate by Source (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBarChart data={attritionBySource} label="Attrition %" color="#ef4444" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBarChart data={locationBreakdown} label="Leads" color="#10b981" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Roles of Interest</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBarChart data={roleBreakdown} label="Leads" color="#8b5cf6" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}