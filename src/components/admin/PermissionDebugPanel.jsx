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
    <div className="w-full">
      <div className="bg-slate-800 text-white rounded-lg border border-slate-700">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700 transition-colors rounded-lg"
        >
          <span className="text-[10px] font-semibold">🔐 Permissions Debug</span>
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-slate-700 p-3 space-y-2 max-h-72 overflow-y-auto bg-slate-900 rounded-b-lg">
            <div>
              <p className="text-[10px] font-semibold text-slate-300 mb-1">USER</p>
              <div className="text-[10px] bg-slate-800 rounded p-1.5 font-mono space-y-0.5">
                <p><span className="text-amber-300">email:</span> {debugInfo.user.email}</p>
                <p><span className="text-amber-300">role:</span> {debugInfo.user.role}</p>
              </div>
            </div>

            {debugInfo.policy && (
              <div>
                <p className="text-[10px] font-semibold text-slate-300 mb-1">MODULES</p>
                <div className="text-[10px] bg-slate-800 rounded p-1.5 font-mono max-h-24 overflow-y-auto">
                  {debugInfo.policy.module_access?.length > 0 ? (
                    <div className="space-y-0.5">
                      {debugInfo.policy.module_access.map(m => (
                        <div key={m} className="text-green-400">✓ {m}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">No modules</p>
                  )}
                </div>
              </div>
            )}

            {debugInfo.policy?.page_overrides?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-300 mb-1">PAGE OVERRIDES</p>
                <div className="text-[10px] bg-slate-800 rounded p-1.5 font-mono space-y-0.5 max-h-20 overflow-y-auto">
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
              className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}