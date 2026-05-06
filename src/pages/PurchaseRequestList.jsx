import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, Languages, Camera, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PRCreateForm from '@/components/purchase/PRCreateForm';
import PRListFilters from '@/components/purchase/PRListFilters';
import PRDetailView from '@/components/purchase/PRDetailView';
import TablePagination from '@/components/store/TablePagination';
import { PR_STATUS_COLOR, PRIORITY_COLOR, formatDateDDMMYYYY } from '@/components/purchase/purchaseHelpers';
import HINDI_LABELS from '@/components/purchase/purchaseHindiLabels';

export default function PurchaseRequestList() {
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [isHindi, setIsHindi] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';

  const { data: prs = [], isLoading: loading } = useQuery({
    queryKey: ['pr-list', user?.email, isManager],
    queryFn: async () => {
      if (isManager) return base44.entities.PurchaseRequest.list('-created_date', 300);
      return base44.entities.PurchaseRequest.filter({ requested_by: user.email }, '-created_date', 300);
    },
    enabled: !!user?.email, staleTime: 30000,
  });

  const t = useCallback((key) => isHindi ? (HINDI_LABELS[key] || key) : key, [isHindi]);

  const filtered = prs.filter(pr => {
    if (filters.status && pr.status !== filters.status) return false;
    if (filters.department && pr.department !== filters.department) return false;
    if (filters.priority && pr.priority !== filters.priority) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(pr.pr_number?.toLowerCase().includes(q) || pr.title?.toLowerCase().includes(q) || pr.requested_by_name?.toLowerCase().includes(q) || pr.department?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const { data: pendingPhotoItems = [] } = useQuery({
    queryKey: ['pr-pending-photos', user?.email],
    queryFn: () => base44.entities.PurchaseRequestItem.filter({ item_status: 'Sample Photo Requested' }, '-created_date', 100),
    enabled: !!user?.email, staleTime: 30000,
  });
  const myPendingPhotos = pendingPhotoItems.filter(it => {
    const pr = prs.find(p => p.pr_number === it.pr_number);
    return pr && (pr.requested_by === user?.email);
  });

  if (selectedPR) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-20">
        <PRDetailView pr={selectedPR} user={user} isManager={isManager} isHindi={isHindi} t={t}
          onBack={() => setSelectedPR(null)}
          onRefresh={async () => {
            await queryClient.invalidateQueries({ queryKey: ['pr-list'] });
            const refreshed = (await base44.entities.PurchaseRequest.filter({ pr_number: selectedPR.pr_number }))[0];
            if (refreshed) setSelectedPR(refreshed); else setSelectedPR(null);
          }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{t('My Purchase Requests')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{isManager ? t('All purchase requests across the organisation') : t('Your submitted purchase requests and their status')}</p>
        </div>
        <button onClick={() => setIsHindi(!isHindi)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0">
          <Languages className="w-4 h-4" />
          <span className="hidden md:inline">{isHindi ? 'English' : 'हिंदी'}</span>
          <span className="md:hidden text-xs">{isHindi ? 'EN' : 'हि'}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto h-11 text-base md:text-sm font-bold px-6">
          <Plus className="w-4 h-4 mr-2" /> {t('New Purchase Request')}
        </Button>
        {myPendingPhotos.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-700 font-medium">
            <Camera className="w-4 h-4" /> {myPendingPhotos.length} {isHindi ? 'नमूना फ़ोटो अनुरोधित' : 'sample photo(s) requested'}
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white"
          placeholder={isHindi ? "अनुरोध संख्या, नाम, या विभाग खोजें..." : "Search by request number, name, or department..."}
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <PRListFilters filters={filters} onChange={f => { setFilters(f); setPage(1); }} isHindi={isHindi} t={t} />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground text-sm">{t('No purchase requests found.')}</p>
          <Button variant="outline" onClick={() => setShowCreate(true)} className="h-11"><Plus className="w-4 h-4 mr-2" /> {t('Create Your First Request')}</Button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Purchase Request Number')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Requester Name / On Whose Behalf')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Status')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Priority')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Department')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Requested By')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Request Date')}</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">{t('Required By')}</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">{t('Actions')}</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(pr => (
                    <tr key={pr.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedPR(pr)}>
                      <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{pr.pr_number || pr.mr_id}</td>
                      <td className="px-3 py-3 text-slate-700 max-w-[200px] truncate">{pr.title || (isHindi ? 'अनामित अनुरोध' : 'Untitled Request')}</td>
                      <td className="px-3 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${PR_STATUS_COLOR[pr.status] || 'bg-slate-100 text-slate-600'}`}>{isHindi ? t(pr.status) : pr.status}</span></td>
                      <td className="px-3 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_COLOR[pr.priority] || ''}`}>{isHindi ? t(pr.priority) : pr.priority}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{pr.department || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{pr.requested_by_name || pr.requested_by || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(pr.request_date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(pr.required_by_date)}</td>
                      <td className="px-3 py-3 text-center"><ChevronRight className="w-4 h-4 text-slate-400 mx-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="w-full md:w-[calc(100vw-4rem)] md:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 rounded-2xl">
          <DialogHeader className="px-4 sm:px-5 pt-4 sm:pt-5 pb-0">
            <DialogTitle className="text-lg font-bold text-slate-900">{t('New Purchase Request')}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden">
            <PRCreateForm user={user} isHindi={isHindi} t={t}
              onDone={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['pr-list'] }); }}
              onCancel={() => setShowCreate(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}