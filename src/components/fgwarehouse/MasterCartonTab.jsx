import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterCartonWizard from '@/components/mastercarton/MasterCartonWizard';

export default function MasterCartonTab() {
  const [showWizard, setShowWizard] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [newConfig, setNewConfig] = useState({ box_sku: '', carton_size: 12 });
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['masterCartonConfigs'],
    queryFn: () => base44.entities.MasterCartonConfig.list(),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data) => base44.entities.MasterCartonConfig.create({ ...data, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['masterCartonConfigs']);
      toast.success('Master carton config created');
      setShowConfigForm(false);
      setNewConfig({ box_sku: '', carton_size: 12 });
    },
  });

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowWizard(true)} size="lg" className="w-full h-14 text-base">
        <Plus className="w-5 h-5 mr-2" />
        New Carton
      </Button>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900">Configuration</h3>
          <Button onClick={() => setShowConfigForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Config
          </Button>
        </div>

        {configs.length === 0 && (
          <Card className="p-6 text-center bg-slate-50">
            <Package className="w-12 h-12 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">No master carton configs yet</p>
          </Card>
        )}

        {configs.map(config => (
          <Card key={config.id} className="p-4 mb-3">
            <p className="font-bold text-slate-900">{config.box_sku}</p>
            <p className="text-sm text-slate-500">Carton size: {config.carton_size} boxes</p>
            {config.label_template_id && (
              <p className="text-xs text-slate-400 mt-1">Template: {config.label_template_id}</p>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <MasterCartonWizard onClose={() => setShowWizard(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Master Carton Config</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Box SKU</label>
              <Input
                placeholder="e.g., KOM-PEACH-6PK-LABELED"
                value={newConfig.box_sku}
                onChange={(e) => setNewConfig({ ...newConfig, box_sku: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Carton Size (boxes per carton)</label>
              <Input
                type="number"
                value={newConfig.carton_size}
                onChange={(e) => setNewConfig({ ...newConfig, carton_size: parseInt(e.target.value) || 1 })}
              />
            </div>
            <Button
              onClick={() => createConfigMutation.mutate(newConfig)}
              disabled={!newConfig.box_sku || createConfigMutation.isPending}
              className="w-full h-12"
            >
              Create Config
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}