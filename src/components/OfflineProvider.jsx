import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Wifi, WifiOff } from 'lucide-react';

const OfflineContext = createContext({
  isOnline: true,
  pendingActions: [],
  addOfflineAction: () => {},
  syncPendingActions: () => {},
});

export const useOffline = () => useContext(OfflineContext);

const OFFLINE_QUEUE_KEY = 'factory_offline_queue';

function getQueue() {
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function OfflineBanner() {
  const { isOnline, pendingActions } = useOffline();
  if (isOnline && pendingActions.length === 0) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${
      isOnline ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
    }`}>
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          Syncing {pendingActions.length} pending action{pendingActions.length !== 1 ? 's' : ''}…
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          Offline — actions queued locally ({pendingActions.length})
        </>
      )}
    </div>
  );
}

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState(getQueue());

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const addOfflineAction = useCallback((action) => {
    const queue = getQueue();
    const entry = { ...action, queued_at: new Date().toISOString(), id: crypto.randomUUID() };
    queue.push(entry);
    saveQueue(queue);
    setPendingActions(queue);
  }, []);

  const syncPendingActions = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    const failed = [];
    for (const action of queue) {
      try {
        if (action.type === 'create') {
          await base44.entities[action.entity].create(action.data);
        } else if (action.type === 'update') {
          await base44.entities[action.entity].update(action.entityId, action.data);
        }
        // Log that it was synced from offline
        await base44.entities.AuditLog.create({
          action: `OFFLINE_SYNC: ${action.auditAction || action.type}`,
          entity_type: action.entity,
          entity_id: action.auditEntityId || '',
          user_email: action.userEmail || '',
          user_name: action.userName || '',
          details: action.data,
          synced: false,
        });
      } catch {
        failed.push(action);
      }
    }
    saveQueue(failed);
    setPendingActions(failed);
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncPendingActions();
    }
  }, [isOnline, pendingActions.length, syncPendingActions]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingActions, addOfflineAction, syncPendingActions }}>
      {children}
    </OfflineContext.Provider>
  );
}