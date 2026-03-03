import { useState } from 'react';
import IngredientSpecTab from './IngredientSpecTab';
import IngredientBrandTab from './IngredientBrandTab';

const TABS = ['Specs', 'Brand Items'];

export default function IngredientMasterManager({ user }) {
  const [tab, setTab] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${tab === i ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <IngredientSpecTab user={user} />}
      {tab === 1 && <IngredientBrandTab user={user} />}
    </div>
  );
}