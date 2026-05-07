import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import AttritionKPICards from '@/components/hr/AttritionKPICards';
import PeriodKPICards from '@/components/hr/PeriodKPICards';
import ConversionFunnelChart from '@/components/hr/ConversionFunnelChart';
import AttritionFunnelPanel from '@/components/hr/AttritionFunnelPanel';
import ConversionBreakdownTable from '@/components/hr/ConversionBreakdownTable';
import BIExportPanel from '@/components/hr/BIExportPanel';
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
import {
  buildTenureBucketsDetailed,
  buildConversionFunnel,
  buildAttritionFunnel,
  computePeriodKPIs,
  buildConversionBreakdown,
} from '@/lib/hrAnalyticsHelpers';

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

  // Range-scoped subsets
  const reachedInRange = useMemo(
    () => candidates.filter((c) => inDateRange(c, 'first_contact_date', fromDate, toDate)),
    [candidates, fromDate, toDate]
  );
  const enrolledInRange = useMemo(
    () => candidates.filter((c) => inDateRange(c, 'enrollment_date', fromDate, toDate)),
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
  const periodKPIs = useMemo(() => computePeriodKPIs(candidates, fromDate, toDate), [candidates, fromDate, toDate]);

  // Funnel — across reached-in-range candidates
  const conversionFunnel = useMemo(
    () => buildConversionFunnel(reachedInRange.length ? reachedInRange : candidates),
    [reachedInRange, candidates]
  );
  const attritionFunnel = useMemo(() => buildAttritionFunnel(candidates), [candidates]);
  const tenureDetailed = useMemo(() => buildTenureBucketsDetailed(candidates), [candidates]);

  // Successful conversion breakdowns
  const conversionBySource = useMemo(() => buildConversionBreakdown(candidates, 'source_type'), [candidates]);
  const conversionByRole = useMemo(() => buildConversionBreakdown(candidates.filter((c) => c.role_interested), 'role_interested'), [candidates]);
  const conversionByLocation = useMemo(() => buildConversionBreakdown(candidates.filter((c) => c.location_area), 'location_area'), [candidates]);

  // Distributions
  const sourceBreakdown = useMemo(() => groupByCategory(candidates, 'source_type'), [candidates]);
  const statusBreakdown = useMemo(() => groupByCategory(candidates, 'status'), [candidates]);

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

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Lifetime KPI Cards */}
          <AttritionKPICards kpis={kpis} />

          {/* Date range filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Date Range Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                  <Button variant="outline" onClick={() => { setFromDate(isoDaysAgo(365)); setToDate(new Date().toISOString().slice(0, 10)); }} className="h-11 md:h-9 flex-1">1Y</Button>
                </div>
              </div>

              {/* Period KPIs */}
              <PeriodKPICards kpis={periodKPIs} />
            </CardContent>
          </Card>

          {/* Daily Reach vs Conversion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daily Reach vs Conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <ReachVsConversionChart reachedSeries={reachedSeries} convertedSeries={convertedSeries} />
            </CardContent>
          </Card>

          {/* Conversion Funnel — all stages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recruitment Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversionFunnelChart data={conversionFunnel} />
            </CardContent>
          </Card>

          {/* Attrition Funnel — Hired → Active vs Exited (with reasons) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Attrition Funnel (Hired → Exit)</CardTitle>
              </CardHeader>
              <CardContent>
                <AttritionFunnelPanel funnel={attritionFunnel} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tenure Distribution (in days)</CardTitle>
              </CardHeader>
              <CardContent>
                <TenureBucketChart data={tenureDetailed} />
              </CardContent>
            </Card>
          </div>

          {/* Successful Conversion Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conversion by Source</CardTitle>
              </CardHeader>
              <CardContent>
                <ConversionBreakdownTable data={conversionBySource} label="Source" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conversion by Role</CardTitle>
              </CardHeader>
              <CardContent>
                <ConversionBreakdownTable data={conversionByRole} label="Role" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conversion by Location</CardTitle>
              </CardHeader>
              <CardContent>
                <ConversionBreakdownTable data={conversionByLocation} label="Location" />
              </CardContent>
            </Card>
          </div>

          {/* Distributions */}
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
                <CardTitle className="text-base">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusPieChart data={statusBreakdown} />
              </CardContent>
            </Card>
          </div>

          {/* BI Export */}
          <BIExportPanel candidates={candidates} />
        </>
      )}
    </div>
  );
}