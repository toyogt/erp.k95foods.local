import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, Clock, XCircle, Search, Eye } from 'lucide-react';
import PRDetailView from '@/components/purchase/PRDetailView';
import { PR_STATUS_COLOR, PRIORITY_COLOR, formatDateDDMMYYYY, DEPARTMENTS } from '@/components/purchase/purchaseHelpers';
import TablePagination from '@/components/store/TablePagination';

export default function PurchaseRequestApprovals() {
  const [user, setUser] = useState(null);
  const [selectedPR, setSelectedPR] = useState(null);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const { data: prs = [], isLoading: loading } = useQuery({
    queryKey: ['pr-approvals'],
    queryFn: () => base44.entities.PurchaseRequest.list('-created_date', 500),
    staleTime: 60000, enabled: !!user,
  });

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';
  const pendingPRs = prs.filter(pr => pr.status === 'Pending Approval' || pr.status === 'SUBMITTED');
  const reviewedPRs = prs.filter(pr => ['Approved', 'Partially Approved', 'Rejected', 'APPROVED', 'REJECTED'].includes(pr.status));
  const tabPRs = tab === 'pending' ? pendingPRs : tab === 'reviewed' ? reviewedPRs : prs;

  const filtered = tabPRs.filter(pr => {
    if (statusFilter && pr.status !== statusFilter) return false;
    if (deptFilter && pr.department !== deptFilter) return false;
    if (priorityFilter && pr.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(pr.pr_number?.toLowerCase().includes(q) || pr.mr_id?.toLowerCase().includes(q) || pr.title?.toLowerCase().includes(q) || pr.requested_by_name?.toLowerCase().includes(q) || pr.department?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (selectedPR) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-20">
        <PRDetailView pr={selectedPR} user={user} isManager={isManager} showApprovalActions={true}
          onBack={() => setSelectedPR(null)}
          onRefresh={async () => {
            await queryClient.invalidateQueries({ queryKey: ['pr-approvals'] });
            const refreshed = (await base44.entities.PurchaseRequest.filter({ pr_number: selectedPR.pr_number || selectedPR.mr_id }))[0];
            if (refreshed) setSelectedPR(refreshed); else setSelectedPR(null);
          }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl md:text-2xl font-bold text-slate-900">Purchase Request Approvals</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <Clock className="w-5 h-5 text-amber-600 mx-auto" />
          <p className="text-2xl font-bold text-amber-700 mt-1">{pendingPRs.length}</p>
          <p className="text-xs text-amber-600">Pending</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
          <p className="text-2xl font-bold text-green-700 mt-1">{prs.filter(p => p.status === 'Approved' || p.status === 'APPROVED').length}</p>
          <p className="text-xs text-green-600">Approved</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <XCircle className="w-5 h-5 text-red-600 mx-auto" />
          <p className="text-2xl font-bold text-red-700 mt-1">{prs.filter(p => p.status === 'Rejected' || p.status === 'REJECTED').length}</p>
          <p className="text-xs text-red-600">Rejected</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[{ id: 'pending', label: `Pending (${pendingPRs.length})` }, { id: 'reviewed', label: `Reviewed (${reviewedPRs.length})` }, { id: 'all', label: `All (${prs.length})` }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white"
          placeholder="Search by request number, name, or department..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white min-w-[120px]" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Pending Approval">Pending Approval</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select className="h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white min-w-[120px]" value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white min-w-[120px]" value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}>
          <option value="">All Priority</option>
          <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No requests found matching filters.</div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Request Number</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Title</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Priority</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Department</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Requested By</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Required By</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(pr => (
                    <tr key={pr.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedPR(pr)}>
                      <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{pr.pr_number || pr.mr_id}</td>
                      <td className="px-3 py-3 text-slate-700 max-w-[180px] truncate whitespace-nowrap">{pr.title || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PR_STATUS_COLOR[pr.status] || 'bg-slate-100 text-slate-600'}`}>{pr.status}</span></td>
                      <td className="px-3 py-3 whitespace-nowrap"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOR[pr.priority] || ''}`}>{pr.priority || '—'}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{pr.department || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{pr.requested_by_name || pr.requested_by || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(pr.request_date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(pr.required_by_date)}</td>
                      <td className="px-3 py-3 text-center"><Eye className="w-4 h-4 text-slate-400 mx-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </>
      )}
    </div>
  );
}