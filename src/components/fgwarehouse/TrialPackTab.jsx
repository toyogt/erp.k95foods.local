import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import TrialPackProductionWizard from '@/components/trialpack/TrialPackProductionWizard';
import TrialPackBOMManager from '@/components/trialpack/TrialPackBOMManager';

export default function TrialPackTab() {
  const [showWizard, setShowWizard] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [newConfig, setNewConfig] = useState({ trial_pack_sku: '', display_name: '', total_bottles: 6 });
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['trialPackConfigs'],
    queryFn: () => base44.entities.TrialPackConfig.list(),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data) => base44.entities.TrialPackConfig.create({ ...data, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['trialPackConfigs']);
      toast.success('Trial pack SKU created');
      setShowConfigForm(false);
      setNewConfig({ trial_pack_sku: '', display_name: '', total_bottles: 6 });
    },
  });

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowWizard(true)} size="lg" className="w-full h-14 text-base">
        <Plus className="w-5 h-5 mr-2" />
        New Production
      </Button>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900">Configuration</h3>
          <Button onClick={() => setShowConfigForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add SKU
          </Button>
        </div>

        {configs.length === 0 && (
          <Card className="p-6 text-center bg-slate-50">
            <Package className="w-12 h-12 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">No trial pack SKUs configured yet</p>
          </Card>
        )}

        {configs.map(config => (
          <Card key={config.id} className="p-4 mb-3">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-bold text-slate-900">{config.display_name}</p>
                <p className="text-sm text-slate-500">{config.trial_pack_sku} • {config.total_bottles} bottles</p>
              </div>
              <Button
                variant={selectedSku === config.trial_pack_sku ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSku(selectedSku === config.trial_pack_sku ? null : config.trial_pack_sku)}
              >
                {selectedSku === config.trial_pack_sku ? 'Hide BOM' : 'Manage BOM'}
              </Button>
            </div>
            {selectedSku === config.trial_pack_sku && (
              <TrialPackBOMManager trialPackSku={config.trial_pack_sku} />
            )}
          </Card>
        ))}
      </div>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <TrialPackProductionWizard onClose={() => setShowWizard(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Trial Pack SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Trial Pack SKU Code</label>
              <Input
                placeholder="e.g., TRIAL-VARIETY-6PK"
                value={newConfig.trial_pack_sku}
                onChange={(e) => setNewConfig({ ...newConfig, trial_pack_sku: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Display Name</label>
              <Input
                placeholder="e.g., Variety Pack of 6"
                value={newConfig.display_name}
                onChange={(e) => setNewConfig({ ...newConfig, display_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Total Bottles</label>
              <Input
                type="number"
                value={newConfig.total_bottles}
                onChange={(e) => setNewConfig({ ...newConfig, total_bottles: parseInt(e.target.value) || 0 })}
              />
            </div>
            <Button
              onClick={() => createConfigMutation.mutate(newConfig)}
              disabled={!newConfig.trial_pack_sku || !newConfig.display_name || createConfigMutation.isPending}
              className="w-full h-12"
            >
              Create Trial Pack SKU
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}