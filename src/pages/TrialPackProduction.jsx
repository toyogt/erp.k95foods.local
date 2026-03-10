import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Settings, History, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import TrialPackBOMManager from '@/components/trialpack/TrialPackBOMManager';
import TrialPackProductionWizard from '@/components/trialpack/TrialPackProductionWizard';
import { format } from 'date-fns';

export default function TrialPackProduction() {
  const [activeTab, setActiveTab] = useState('produce');
  const [showWizard, setShowWizard] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [newConfig, setNewConfig] = useState({ trial_pack_sku: '', display_name: '', total_bottles: 6 });
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['trialPackConfigs'],
    queryFn: () => base44.entities.TrialPackConfig.list(),
  });

  const { data: productions = [] } = useQuery({
    queryKey: ['trialPackProductions'],
    queryFn: () => base44.entities.TrialPackProduction.list('-production_date'),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trial Pack Production</h1>
          <p className="text-sm text-slate-500">Create trial packs from finished goods</p>
        </div>
        <Button onClick={() => setShowWizard(true)} size="lg" className="h-12">
          <Plus className="w-5 h-5 mr-2" />
          New Production
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="produce">
            <Package className="w-4 h-4 mr-2" />
            Produce
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-2" />
            Config
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produce" className="space-y-4">
          <Card className="p-6 text-center bg-slate-50">
            <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">Start New Production</h3>
            <p className="text-sm text-slate-600 mb-4">Click the button above to begin trial pack production</p>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Button onClick={() => setShowConfigForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Trial Pack SKU
          </Button>

          {configs.length === 0 && (
            <Card className="p-6 text-center bg-slate-50">
              <Package className="w-12 h-12 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">No trial pack SKUs configured yet. Click above to add one.</p>
            </Card>
          )}

          {configs.map(config => (
            <Card key={config.id} className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-slate-900">{config.display_name}</p>
                  <p className="text-sm text-slate-500">{config.trial_pack_sku} • {config.total_bottles} bottles</p>
                </div>
                <Button
                  variant={selectedSku === config.trial_pack_sku ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSku(config.trial_pack_sku)}
                >
                  {selectedSku === config.trial_pack_sku ? 'Selected' : 'Manage BOM'}
                </Button>
              </div>
              {selectedSku === config.trial_pack_sku && (
                <TrialPackBOMManager trialPackSku={config.trial_pack_sku} />
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {productions.map(prod => (
            <Card key={prod.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-slate-900">{prod.trial_pack_name}</p>
                  <p className="text-sm text-slate-500">{prod.production_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{prod.quantity_produced} units</p>
                  <p className="text-xs text-slate-500">{format(new Date(prod.production_date), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Batch:</span>
                  <span className="ml-1 font-mono">{prod.batch_code}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mfg:</span>
                  <span className="ml-1">{format(new Date(prod.mfg_date), 'dd MMM yy')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Exp:</span>
                  <span className="ml-1">{format(new Date(prod.exp_date), 'dd MMM yy')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Source Lots:</span>
                  <span className="ml-1">{prod.source_lots?.length || 0}</span>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

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
              <label className="text-sm font-medium text-slate-700">Trial Pack SKU Code</label>
              <Input
                placeholder="e.g., TRIAL-VARIETY-6PK"
                value={newConfig.trial_pack_sku}
                onChange={(e) => setNewConfig({ ...newConfig, trial_pack_sku: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Display Name</label>
              <Input
                placeholder="e.g., Variety Pack of 6"
                value={newConfig.display_name}
                onChange={(e) => setNewConfig({ ...newConfig, display_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Total Bottles</label>
              <Input
                type="number"
                value={newConfig.total_bottles}
                onChange={(e) => setNewConfig({ ...newConfig, total_bottles: parseInt(e.target.value) || 0 })}
              />
            </div>
            <Button
              onClick={() => createConfigMutation.mutate(newConfig)}
              disabled={!newConfig.trial_pack_sku || !newConfig.display_name || createConfigMutation.isPending}
              className="w-full"
            >
              Create Trial Pack SKU
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}