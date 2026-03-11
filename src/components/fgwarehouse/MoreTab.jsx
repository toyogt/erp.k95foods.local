import { useState } from 'react';
import { ChevronLeft, Package, Layers } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import TrialPackProductionWizard from '@/components/trialpack/TrialPackProductionWizard';
import MasterCartonWizard from '@/components/mastercarton/MasterCartonWizard';

export default function MoreTab({ onBack }) {
  const [showTrialWizard, setShowTrialWizard] = useState(false);
  const [showCartonWizard, setShowCartonWizard] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">More Tools</h2>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Warehouse Tools</p>
        <div className="grid grid-cols-1 gap-2">
          <ToolCard
            icon="🧪"
            title="Trial Pack Production"
            sub="Build trial packs from component boxes"
            color="bg-purple-700"
            onClick={() => setShowTrialWizard(true)}
          />
          <ToolCard
            icon="📦"
            title="Master Carton Packing"
            sub="Pack boxes into master cartons"
            color="bg-indigo-700"
            onClick={() => setShowCartonWizard(true)}
          />
        </div>
      </div>

      <Dialog open={showTrialWizard} onOpenChange={setShowTrialWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <TrialPackProductionWizard onClose={() => setShowTrialWizard(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCartonWizard} onOpenChange={setShowCartonWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <MasterCartonWizard onClose={() => setShowCartonWizard(false)} />
        </DialogContent>
      </Dialog>
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