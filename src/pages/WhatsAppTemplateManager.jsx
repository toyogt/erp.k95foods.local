import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import TemplateList from '@/components/whatsapp/TemplateList';
import TemplateForm from '@/components/whatsapp/TemplateForm';
import TestSendModal from '@/components/whatsapp/TestSendModal';
import { Loader2, MessageSquare } from 'lucide-react';

export default function WhatsAppTemplateManager() {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editTemplate, setEditTemplate] = useState(null);
  const [testTemplate, setTestTemplate] = useState(null);

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => base44.entities.WhatsAppTemplate.list('-created_date', 200),
  });

  function handleNew() {
    setEditTemplate(null);
    setView('form');
  }

  function handleEdit(tpl) {
    setEditTemplate(tpl);
    setView('form');
  }

  function handleSaved() {
    setView('list');
    setEditTemplate(null);
    refetch();
  }

  return (
    <div className="space-y-4 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-green-600" />
          WhatsApp Template Manager
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Create, manage, and send WhatsApp message templates. Map parameters to entity fields for automated sending.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : view === 'list' ? (
        <TemplateList
          templates={templates}
          onRefetch={refetch}
          onEdit={handleEdit}
          onNew={handleNew}
          onTestSend={setTestTemplate}
        />
      ) : (
        <TemplateForm
          template={editTemplate}
          onBack={() => { setView('list'); setEditTemplate(null); }}
          onSaved={handleSaved}
        />
      )}

      <TestSendModal
        open={!!testTemplate}
        onClose={() => setTestTemplate(null)}
        template={testTemplate}
      />
    </div>
  );
}