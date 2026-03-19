/**
 * Permission Debug Panel
 * Visible only to super admin
 * Shows all permission info for current user
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { getPermissionDebugInfo } from '@/lib/permissionResolver';

export default function PermissionDebugPanel() {
  const [debugInfo, setDebugInfo] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      if (u?.role === 'admin') {
        const info = await getPermissionDebugInfo(u);
        setDebugInfo(info);
      }
    });
  }, []);

  if (!user || user.role !== 'admin') return null;
  if (!debugInfo) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors"
        >
          <span className="text-xs font-semibold">🔐 Permission Debug</span>
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-slate-700 p-4 space-y-3 max-h-96 overflow-y-auto bg-slate-950">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">USER</p>
              <div className="text-xs bg-slate-800 rounded p-2 font-mono space-y-1">
                <p><span className="text-amber-300">email:</span> {debugInfo.user.email}</p>
                <p><span className="text-amber-300">role:</span> {debugInfo.user.role}</p>
                <p><span className="text-amber-300">name:</span> {debugInfo.user.name}</p>
              </div>
            </div>

            {debugInfo.policy && (
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-1">MODULE ACCESS</p>
                <div className="text-xs bg-slate-800 rounded p-2 font-mono">
                  {debugInfo.policy.module_access?.length > 0 ? (
                    <div className="space-y-0.5">
                      {debugInfo.policy.module_access.map(m => (
                        <div key={m} className="text-green-400">✓ {m}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">No modules assigned</p>
                  )}
                </div>
              </div>
            )}

            {debugInfo.policy?.page_overrides?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-1">PAGE OVERRIDES</p>
                <div className="text-xs bg-slate-800 rounded p-2 font-mono space-y-0.5">
                  {debugInfo.policy.page_overrides.map((o, i) => (
                    <div key={i} className={o.allow ? 'text-green-400' : 'text-red-400'}>
                      {o.allow ? '✓' : '✗'} {o.page_key}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy Debug JSON
            </button>

            <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
              Last updated: {new Date(debugInfo.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}