import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPendingTransactions,
  getFailedTransactions,
  getAllTransactions,
  syncPendingTransactions,
  resolveConflict,
  cleanupOldTransactions,
} from '@/lib/offlineSyncEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Cloud, CloudOff, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, Trash2, Eye, MessageSquare, Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function SyncCenter() {
  const [user, setUser] = useState(null);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [syncStatus, setSyncStatus] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [conflictNotes, setConflictNotes] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Load transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['offlineTransactions'],
    queryFn: () => getAllTransactions(),
    refetchInterval: 5000,
  });

  const pending = transactions.filter(t => t.status === 'queued' || t.status === 'processing');
  const failed = transactions.filter(t => t.status === 'failed');
  const conflicts = transactions.filter(t => t.status === 'conflict');
  const confirmed = transactions.filter(t => t.status === 'confirmed');

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncStatus({ state: 'syncing', message: 'Syncing transactions...' });
      const result = await syncPendingTransactions();
      setSyncStatus({ state: 'complete', message: `Synced ${result.synced}, failed ${result.failed}` });
      queryClient.invalidateQueries({ queryKey: ['offlineTransactions'] });
      setTimeout(() => setSyncStatus(null), 3000);
      return result;
    },
  });

  // Resolve conflict mutation
  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTxn) throw new Error('No transaction selected');
      await resolveConflict(selectedTxn.transaction_id, {
        notes: conflictNotes,
        resolution_type: 'supervisor_override',
      });
      queryClient.invalidateQueries({ queryKey: ['offlineTransactions'] });
      setSelectedTxn(null);
      setConflictNotes('');
    },
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const count = cleanupOldTransactions(30);
      queryClient.invalidateQueries({ queryKey: ['offlineTransactions'] });
      setSyncStatus({ state: 'info', message: `Cleaned up ${count} old transactions` });
      setTimeout(() => setSyncStatus(null), 2000);
    },
  });

  const isAdmin = user?.role === 'admin';
  const isOnline = navigator.onLine;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sync Center</h1>
          <p className="text-sm text-slate-600 mt-1">Offline transaction queue & sync status</p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
              <Cloud className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
              <CloudOff className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Message */}
      {syncStatus && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            syncStatus.state === 'syncing'
              ? 'bg-blue-50 text-blue-700'
              : syncStatus.state === 'complete'
              ? 'bg-green-50 text-green-700'
              : 'bg-slate-50 text-slate-700'
          }`}
        >
          {syncStatus.state === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
          {syncStatus.state === 'complete' && <CheckCircle2 className="w-4 h-4" />}
          <span className="text-sm font-medium">{syncStatus.message}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          label="Pending"
          count={pending.length}
          icon={Clock}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatsCard
          label="Failed"
          count={failed.length}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatsCard
          label="Conflicts"
          count={conflicts.length}
          icon={Zap}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatsCard
          label="Synced"
          count={confirmed.length}
          icon={CheckCircle2}
          color="text-green-600"
          bg="bg-green-50"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {['pending', 'failed', 'conflicts', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 font-medium border-b-2 transition-all ${
              selectedTab === tab
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({getTabCount(tab)})
          </button>
        ))}
      </div>

      {/* Sync Button */}
      {pending.length > 0 && (
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || !isOnline}
          size="lg"
          className="w-full h-11 text-base"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : `Sync ${pending.length} Transactions`}
        </Button>
      )}

      {/* Transactions List */}
      <div className="space-y-3">
        {getTabData(selectedTab).map(txn => (
          <TransactionCard
            key={txn.transaction_id}
            transaction={txn}
            isAdmin={isAdmin}
            onViewDetails={() => setSelectedTxn(txn)}
          />
        ))}

        {getTabData(selectedTab).length === 0 && (
          <div className="p-8 text-center">
            <p className="text-slate-500">No transactions to show</p>
          </div>
        )}
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <div className="pt-6 border-t border-slate-200 space-y-3">
          <h3 className="font-semibold text-slate-900">Admin Actions</h3>
          <Button
            variant="outline"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clean Up Old Transactions (30+ days)
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTxn && (
        <TransactionDetailModal
          transaction={selectedTxn}
          isAdmin={isAdmin}
          onClose={() => setSelectedTxn(null)}
          onResolve={(notes) => {
            setConflictNotes(notes);
            resolveMutation.mutate();
          }}
          isResolving={resolveMutation.isPending}
        />
      )}
    </div>
  );

  function getTabCount(tab) {
    switch (tab) {
      case 'pending':
        return pending.length;
      case 'failed':
        return failed.length;
      case 'conflicts':
        return conflicts.length;
      case 'all':
        return transactions.length;
      default:
        return 0;
    }
  }

  function getTabData(tab) {
    switch (tab) {
      case 'pending':
        return pending;
      case 'failed':
        return failed;
      case 'conflicts':
        return conflicts;
      case 'all':
        return transactions;
      default:
        return [];
    }
  }
}

// Status Card Component
function StatsCard({ label, count, icon: Icon, color, bg }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{count}</p>
          </div>
          <div className={`p-3 rounded-lg ${bg}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Transaction Card Component
function TransactionCard({ transaction, isAdmin, onViewDetails }) {
  const statusColors = {
    queued: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
    processing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: RefreshCw },
    confirmed: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
    failed: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertTriangle },
    conflict: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Zap },
  };

  const colors = statusColors[transaction.status] || statusColors.queued;
  const StatusIcon = colors.icon;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onViewDetails}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`${colors.bg} ${colors.text} border-0`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </Badge>
              <span className="text-xs text-slate-500">ID: {transaction.transaction_id.substr(0, 12)}...</span>
            </div>

            <div className="text-sm space-y-1">
              <p className="font-medium text-slate-900">
                {transaction.action_type} {transaction.entity_type}
              </p>
              <p className="text-slate-600">
                Module: <span className="font-medium">{transaction.module}</span>
              </p>
              <p className="text-slate-600">
                By: <span className="font-medium">{transaction.user_id}</span>
              </p>
              {transaction.last_error && (
                <p className="text-xs text-red-600 mt-2">Error: {transaction.last_error}</p>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span>Created: {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}</span>
              {transaction.retry_count > 0 && (
                <span className="text-amber-600">Retries: {transaction.retry_count}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
            >
              <Eye className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Detail Modal
function TransactionDetailModal({ transaction, isAdmin, onClose, onResolve, isResolving }) {
  const [notes, setNotes] = useState('');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>ID: {transaction.transaction_id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-xs text-slate-600">Status</p>
              <p className="font-medium text-slate-900 mt-1">{transaction.status}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Module</p>
              <p className="font-medium text-slate-900 mt-1">{transaction.module}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Entity Type</p>
              <p className="font-medium text-slate-900 mt-1">{transaction.entity_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Action</p>
              <p className="font-medium text-slate-900 mt-1">{transaction.action_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">User</p>
              <p className="font-medium text-slate-900 mt-1 truncate">{transaction.user_id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Retry Count</p>
              <p className="font-medium text-slate-900 mt-1">{transaction.retry_count}</p>
            </div>
          </div>

          {/* Payload */}
          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">Payload</p>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-auto max-h-48">
              {JSON.stringify(transaction.payload, null, 2)}
            </pre>
          </div>

          {/* Error Details */}
          {transaction.last_error && (
            <div>
              <p className="text-xs font-medium text-red-700 mb-2">Error</p>
              <p className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{transaction.last_error}</p>
            </div>
          )}

          {/* Conflict Details */}
          {transaction.conflict_details && (
            <div>
              <p className="text-xs font-medium text-amber-700 mb-2">Conflict Details</p>
              <pre className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs overflow-auto">
                {JSON.stringify(transaction.conflict_details, null, 2)}
              </pre>
            </div>
          )}

          {/* Supervisor Override (for conflicts) */}
          {isAdmin && transaction.status === 'conflict' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Supervisor Notes</label>
              <Textarea
                placeholder="Explain resolution (e.g., 'Approved override - stock verified' or 'Rejected - duplicate')"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-24"
              />
              <Button
                onClick={() => onResolve(notes)}
                disabled={!notes.trim() || isResolving}
                className="w-full h-11"
              >
                {isResolving ? 'Resolving...' : 'Resolve Conflict & Retry'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}