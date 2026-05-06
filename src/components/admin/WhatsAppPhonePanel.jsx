import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Loader2, Check, Phone } from 'lucide-react';

export default function WhatsAppPhonePanel({ users, onReload }) {
  const [editingId, setEditingId] = useState(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [saving, setSaving] = useState(false);

  const usersWithNames = users.filter(u => u.email);

  const startEdit = (u) => {
    setEditingId(u.id);
    setPhoneValue(u.phone_number || '');
  };

  const savePhone = async (u) => {
    setSaving(true);
    const cleaned = phoneValue.replace(/[\s\-\+]/g, '');
    await base44.entities.User.update(u.id, { phone_number: cleaned });
    setSaving(false);
    setEditingId(null);
    onReload();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-green-600" />
        <h3 className="text-base font-semibold text-slate-900">WhatsApp Phone Numbers</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Add phone numbers with country code (e.g. 919876543210) to enable WhatsApp task notifications.
      </p>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_2fr_2fr_auto] gap-3 px-4 py-2.5 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Name</span>
          <span>Email</span>
          <span>WhatsApp Number</span>
          <span></span>
        </div>
        <div className="divide-y divide-slate-100">
          {usersWithNames.map(u => (
            <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_2fr_auto] gap-2 sm:gap-3 px-4 py-3 items-center">
              <span className="text-sm font-medium text-slate-700">{u.full_name || '—'}</span>
              <span className="text-sm text-slate-500 truncate">{u.email}</span>
              <div>
                {editingId === u.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={phoneValue}
                      onChange={e => setPhoneValue(e.target.value)}
                      placeholder="919876543210"
                      className="h-9 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => savePhone(u)}
                      disabled={saving}
                      className="h-9 px-3"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(u)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-600 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {u.phone_number ? (
                      <span className="text-green-700 font-medium">+{u.phone_number}</span>
                    ) : (
                      <span className="text-slate-400">Click to add</span>
                    )}
                  </button>
                )}
              </div>
              <div />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}