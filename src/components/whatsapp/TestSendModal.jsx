import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send } from 'lucide-react';

export default function TestSendModal({ open, onClose, template }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [paramValues, setParamValues] = useState([]);
  const [sending, setSending] = useState(false);

  // Init param values from examples
  useState(() => {
    if (template) {
      setParamValues(template.example_values || []);
    }
  }, [template]);

  if (!template) return null;

  const uniqueParams = [...new Set((template.body_text?.match(/\{\{\d+\}\}/g) || []).map(p => parseInt(p.replace(/[{}]/g, ''))))].sort((a, b) => a - b);

  async function handleSend() {
    if (!phone.trim()) {
      toast({ title: 'Error', description: 'Phone number is required', variant: 'destructive' });
      return;
    }

    setSending(true);
    const resp = await base44.functions.invoke('whatsappTemplateManager', {
      action: 'send_message',
      phone_number_id: template.phone_number_id || '__FROM_ENV__',
      phone_number: phone,
      template_name: template.template_name,
      language: template.language || 'en',
      parameters: paramValues,
    });

    if (resp.data?.success) {
      toast({ title: 'Message sent!', description: `Message ID: ${resp.data.message_id}` });
      onClose();
    } else {
      const errMsg = resp.data?.details?.error?.message || resp.data?.error || 'Send failed';
      toast({ title: 'Send failed', description: errMsg, variant: 'destructive' });
    }
    setSending(false);
  }

  function updateParam(idx, val) {
    const updated = [...paramValues];
    updated[idx] = val;
    setParamValues(updated);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Test Send: {template.display_name || template.template_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Recipient Phone Number *</label>
            <Input className="h-9 text-sm mt-1" value={phone} onChange={e => setPhone(e.target.value)} placeholder="919876543210" />
            <p className="text-xs text-slate-400 mt-0.5">Include country code without +</p>
          </div>

          {uniqueParams.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Parameter Values</label>
              {uniqueParams.map((pIdx, i) => {
                const mapping = (template.parameter_mappings || []).find(m => m.index === pIdx);
                return (
                  <div key={pIdx} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 w-10 shrink-0">{`{{${pIdx}}}`}</span>
                    <span className="text-xs text-slate-400 w-24 truncate shrink-0">{mapping?.label || `Param ${pIdx}`}</span>
                    <Input className="h-8 text-sm flex-1" value={paramValues[i] || ''} onChange={e => updateParam(i, e.target.value)} placeholder={mapping?.fallback_value || 'Value'} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Preview */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-green-700 mb-1">Message Preview</p>
            <div className="text-sm text-slate-800 whitespace-pre-wrap font-mono">
              {template.header_text && <div className="font-bold mb-1">{template.header_text}</div>}
              <div>
                {uniqueParams.reduce((text, pIdx, i) => {
                  return text.replace(`{{${pIdx}}}`, paramValues[i] || `[{{${pIdx}}}]`);
                }, template.body_text || '')}
              </div>
              {template.footer_text && <div className="text-xs text-slate-500 mt-2">{template.footer_text}</div>}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 text-sm">Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="flex-1 h-11 bg-green-700 hover:bg-green-800 text-sm gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send Test Message'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}