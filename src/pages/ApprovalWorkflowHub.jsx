import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2 } from 'lucide-react';
import ApprovalRulesList from '@/components/admin/ApprovalRulesList';

export default function ApprovalWorkflowHub() {
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.DocumentApprovalRule.filter({ is_active: true }, '-sort_order'),
    ]).then(([me, rulesData]) => {
      setUser(me);
      setRules(rulesData);
      setLoading(false);
    });
  }, []);

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const docTypes = [...new Set(rules.map(r => r.doc_type))].sort();
  const filtered = filter === 'all' ? rules : rules.filter(r => r.doc_type === filter);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-6 h-6 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Approval Workflows</h1>
      </div>
      <p className="text-slate-600">Manage document state transitions and who can approve them</p>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({rules.length})
        </button>
        {docTypes.map(dt => (
          <button
            key={dt}
            onClick={() => setFilter(dt)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === dt
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {dt} ({rules.filter(r => r.doc_type === dt).length})
          </button>
        ))}
      </div>

      <ApprovalRulesList rules={filtered} />
    </div>
  );
}