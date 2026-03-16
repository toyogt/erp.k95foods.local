import { useState } from 'react';
import { ChevronLeft, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrialPackTab from '@/components/fgwarehouse/TrialPackTab';
import MasterCartonTab from '@/components/fgwarehouse/MasterCartonTab';

export default function MoreTab({ onBack, skus = [] }) {
  const [activeTab, setActiveTab] = useState('trial');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">More Tools</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trial" className="text-sm">
            🧪 Trial Packs
          </TabsTrigger>
          <TabsTrigger value="carton" className="text-sm">
            📦 Master Cartons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trial" className="mt-4">
          <TrialPackTab skus={skus} />
        </TabsContent>

        <TabsContent value="carton" className="mt-4">
          <MasterCartonTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToolCard({ icon, title, sub, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 ${color} text-white rounded-xl px-5 py-4 text-left hover:opacity-90 active:scale-[0.98] transition-all min-h-[68px]`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs opacity-80 mt-0.5">{sub}</p>
      </div>
    </button>
  );
}