import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const LANGUAGES = [
  { key: 'english', label: 'English' },
  { key: 'hindi', label: 'हिंदी' },
  { key: 'hinglish', label: 'Hinglish' },
];

export default function TaskLanguageToggle({ language, onLanguageChange, tasks, onTranslationsReady }) {
  const [translating, setTranslating] = useState(false);

  const handleLanguageChange = async (langKey) => {
    if (langKey === language) return;

    if (langKey === 'english') {
      onLanguageChange('english');
      onTranslationsReady({});
      return;
    }

    // Build translation prompt for all tasks at once
    const taskTexts = tasks.map(t => ({
      id: t.id,
      task_name: t.task_name || '',
      task_details: t.task_details || '',
    }));

    if (taskTexts.length === 0) {
      onLanguageChange(langKey);
      return;
    }

    setTranslating(true);
    onLanguageChange(langKey);

    const targetLang = langKey === 'hindi'
      ? 'Hindi (Devanagari script)'
      : 'Hinglish (Hindi words written in Roman/English script, mixed with English)';

    const prompt = `Translate the following task data into ${targetLang}. 
Keep the same JSON structure. Only translate "task_name" and "task_details" fields. Keep "id" as-is.
If task_details is empty, keep it empty.
Do NOT add any explanation, only output the JSON array.

Input:
${JSON.stringify(taskTexts)}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          translations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                task_name: { type: 'string' },
                task_details: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const translationMap = {};
    if (result?.translations) {
      for (const t of result.translations) {
        translationMap[t.id] = { task_name: t.task_name, task_details: t.task_details };
      }
    }
    onTranslationsReady(translationMap);
    setTranslating(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Languages className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      {LANGUAGES.map(lang => (
        <button
          key={lang.key}
          onClick={() => handleLanguageChange(lang.key)}
          disabled={translating}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all min-h-[28px] ${
            language === lang.key
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
          } ${translating ? 'opacity-60' : ''}`}
        >
          {lang.label}
        </button>
      ))}
      {translating && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 ml-1" />}
    </div>
  );
}