import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TelegramConfigPanel({ users, onReload }) {
  const [saving, setSaving] = useState(null);
  const [chatIds, setChatIds] = useState({});
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});

  useEffect(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u.telegram_chat_id || ''; });
    setChatIds(map);
  }, [users]);

  const handleSave = async (u) => {
    setSaving(u.id);
    await base44.entities.User.update(u.id, { telegram_chat_id: chatIds[u.id]?.trim() || '' });
    setSaving(null);
    onReload?.();
  };

  const handleTest = async (u) => {
    const chatId = chatIds[u.id]?.trim();
    if (!chatId) return;
    setTesting(u.id);
    setTestResult({});
    try {
      const res = await base44.functions.invoke('sendTelegramTest', { chat_id: chatId, name: u.full_name || u.email });
      setTestResult({ [u.id]: res.data?.success ? 'ok' : 'fail' });
    } catch {
      setTestResult({ [u.id]: 'fail' });
    }
    setTesting(null);
  };

  const usersWithChatId = users.filter(u => u.email);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Send className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">Telegram Notifications</h3>
      </div>
      <p className="text-xs text-slate-500">
        Add Telegram Chat IDs for users who should receive task notifications. 
        To get a Chat ID, ask each user to message <strong>@userinfobot</strong> on Telegram.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_2fr_1fr_80px] gap-3 px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Name</span><span>Telegram Chat ID</span><span></span><span></span>
        </div>
        {usersWithChatId.map(u => (
          <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_80px] gap-2 sm:gap-3 px-4 py-3 items-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                {(u.full_name || u.email)[0]?.toUpperCase()}
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">{u.full_name || u.email}</span>
                <span className="text-xs text-slate-400 ml-2 hidden sm:inline">{u.role}</span>
              </div>
            </div>
            <Input
              value={chatIds[u.id] || ''}
              onChange={e => setChatIds(prev => ({ ...prev, [u.id]: e.target.value }))}
              placeholder="e.g. 123456789"
              className="h-9 text-sm"
            />
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => handleSave(u)}
                disabled={saving === u.id} className="h-9 text-xs gap-1">
                {saving === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save
              </Button>
              {chatIds[u.id]?.trim() && (
                <Button size="sm" variant="ghost" onClick={() => handleTest(u)}
                  disabled={testing === u.id} className="h-9 text-xs gap-1 text-blue-600">
                  {testing === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Test
                </Button>
              )}
            </div>
            <div className="flex items-center justify-center">
              {testResult[u.id] === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {testResult[u.id] === 'fail' && <AlertCircle className="w-4 h-4 text-red-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}