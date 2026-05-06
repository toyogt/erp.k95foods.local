import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Send, Upload, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_BADGE = {
  clarification_request: 'bg-purple-100 text-purple-700',
  reply: 'bg-blue-100 text-blue-700',
  note: 'bg-slate-100 text-slate-600',
  status_change: 'bg-amber-100 text-amber-700',
};

export default function PRCommentThread({ prNumber, lineNumber, user, onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['pr-comments', prNumber, lineNumber],
    queryFn: () => base44.entities.PRComment.filter({ pr_number: prNumber, line_number: lineNumber }, 'created_date', 100),
    staleTime: 10000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments.length]);

  async function handleAttachment(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachmentUrl(file_url);
    setUploading(false);
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    await base44.entities.PRComment.create({
      pr_number: prNumber,
      line_number: lineNumber,
      comment_type: 'reply',
      message: message.trim(),
      attachment_url: attachmentUrl || undefined,
      author_email: user?.email || '',
      author_name: user?.full_name || '',
    });
    setMessage('');
    setAttachmentUrl('');
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ['pr-comments', prNumber, lineNumber] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <div className="bg-white w-full md:w-[480px] md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm">Comments — Item #{lineNumber}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {isLoading && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>}
          {comments.map(c => {
            const isOwn = c.author_email === user?.email;
            return (
              <div key={c.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isOwn ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${isOwn ? 'text-blue-200' : 'text-slate-500'}`}>{c.author_name || c.author_email}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_BADGE[c.comment_type] || TYPE_BADGE.note}`}>{c.comment_type?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm">{c.message}</p>
                  {c.attachment_url && (
                    <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className={`text-xs underline mt-1 block ${isOwn ? 'text-blue-200' : 'text-blue-600'}`}>View attachment</a>
                  )}
                </div>
              </div>
            );
          })}
          {comments.length === 0 && !isLoading && (
            <p className="text-center text-sm text-slate-400 py-4">No comments yet</p>
          )}
        </div>

        <div className="border-t border-slate-200 p-3 space-y-2">
          {attachmentUrl && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">
              <Paperclip className="w-3 h-3" /> Attachment ready
              <button onClick={() => setAttachmentUrl('')} className="ml-auto text-red-400"><X className="w-3 h-3" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Paperclip className="w-4 h-4 text-slate-400" />}
              <input type="file" className="hidden" onChange={handleAttachment} disabled={uploading} />
            </label>
            <input
              className="flex-1 h-10 border border-slate-200 rounded-xl px-3 text-sm"
              placeholder="Type a message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <Button size="sm" className="h-10 px-4" onClick={handleSend} disabled={sending || !message.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}