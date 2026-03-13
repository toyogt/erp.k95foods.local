import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Package, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import TrialPackProductionWizard from '@/components/trialpack/TrialPackProductionWizard';

export default function TrialPackTab() {
  const [showWizard, setShowWizard] = useState(false);
  const [showBOMDialog, setShowBOMDialog] = useState(false);
  const [selectedTrialSku, setSelectedTrialSku] = useState(null);
  const [bomForm, setBomForm] = useState({ component_sku: '', bottles_required: 1 });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: trialPacks = [] } = useQuery({
    queryKey: ['trialPackSKUs'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_trial_pack: true, is_active: true }),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['trialPackBOM', selectedTrialSku],
    queryFn: () => selectedTrialSku ? base44.entities.TrialPackBOM.filter({ trial_pack_sku: selectedTrialSku }) : Promise.resolve([]),
    enabled: !!selectedTrialSku,
  });

  const addBOMMutation = useMutation({
    mutationFn: async (data) => {
      const trialPack = trialPacks.find(p => p.item_code === selectedTrialSku);
      const currentTotal = bomItems.reduce((sum, b) => sum + b.bottles_required, 0);
      const bottlesRequired = parseInt(data.bottles_required) || 0;
      const newTotal = currentTotal + bottlesRequired;
      const capacity = trialPack?.bottles_per_box || 0;
      
      console.log('Validation: currentTotal=', currentTotal, 'bottlesRequired=', bottlesRequired, 'newTotal=', newTotal, 'capacity=', capacity, 'bomItems=', bomItems);
      
      if (newTotal > capacity) {
        const error = new Error(`Cannot add ${bottlesRequired} bottles. Current BOM has ${currentTotal} bottles, but trial pack capacity is only ${capacity} bottles.`);
        console.log('Throwing validation error:', error.message);
        return Promise.reject(error);
      }
      
      return base44.entities.TrialPackBOM.create({
        trial_pack_sku: selectedTrialSku,
        ...data,
      });
    },
    onSuccess: () => {
      console.log('Mutation success - component added');
      queryClient.invalidateQueries({ queryKey: ['trialPackBOM'] });
      toast.success('Component added to BOM');
      setBomForm({ component_sku: '', bottles_required: 1 });
    },
    onError: (error) => {
      console.log('Mutation error caught:', error);
      toast.error(error.message || 'Failed to add component', { duration: 4000 });
    },
  });

  const deleteBOMMutation = useMutation({
    mutationFn: (id) => base44.entities.TrialPackBOM.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['trialPackBOM']);
      toast.success('Component removed');
    },
  });

  const regularProducts = allProducts.filter(p => !p.is_trial_pack);

  const handleManageBOM = (sku) => {
    setSelectedTrialSku(sku);
    setShowBOMDialog(true);
  };

  const handleCloseBOM = () => {
    const trialPack = trialPacks.find(p => p.item_code === selectedTrialSku);
    const totalBottles = bomItems.reduce((sum, b) => sum + b.bottles_required, 0);
    const isComplete = totalBottles === (trialPack?.bottles_per_box || 0);

    if (!isComplete && bomItems.length > 0) {
      setShowCloseConfirm(true);
      return true; // prevents dialog from closing
    } else {
      setSelectedTrialSku(null);
      setBomForm({ component_sku: '', bottles_required: 1 });
      setShowBOMDialog(false);
      setShowCloseConfirm(false);
    }
  };

  const handleSaveAndClose = () => {
    const trialPack = trialPacks.find(p => p.item_code === selectedTrialSku);
    const totalBottles = bomItems.reduce((sum, b) => sum + b.bottles_required, 0);
    const requiredBottles = trialPack?.bottles_per_box || 0;

    if (totalBottles !== requiredBottles) {
      toast.error(`BOM incomplete: has ${totalBottles} bottles but needs ${requiredBottles} bottles`, { duration: 4000 });
      return;
    }

    toast.success('BOM saved successfully', { duration: 3000 });
    setTimeout(() => {
      setSelectedTrialSku(null);
      setBomForm({ component_sku: '', bottles_required: 1 });
      setShowBOMDialog(false);
      setShowCloseConfirm(false);
    }, 500);
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowWizard(true)} size="lg" className="w-full h-14 text-base">
        <Plus className="w-5 h-5 mr-2" />
        New Production
      </Button>

      <div className="border-t pt-4">
        <h3 className="font-bold text-slate-900 mb-3">Trial Pack SKUs</h3>

        {trialPacks.length === 0 && (
          <Card className="p-6 text-center bg-slate-50">
            <Package className="w-12 h-12 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">No trial pack SKUs found</p>
            <p className="text-xs text-slate-400 mt-1">Add SKUs with is_trial_pack=true in SKU Setup</p>
          </Card>
        )}

        {trialPacks.map(pack => {
          const packBOM = bomItems.filter(b => b.trial_pack_sku === pack.item_code);
          const totalBottles = packBOM.reduce((sum, b) => sum + b.bottles_required, 0);

          return (
            <Card key={pack.id} className="p-4 mb-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-slate-900">{pack.product_name}</p>
                  <p className="text-sm text-slate-500">{pack.item_code}</p>
                  <p className="text-xs text-slate-400">
                    {pack.bottles_per_box || 0} bottles per pack
                    {selectedTrialSku === pack.item_code && packBOM.length > 0 && ` • BOM: ${totalBottles} bottles`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleManageBOM(pack.item_code)}
                >
                  Manage BOM
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <TrialPackProductionWizard onClose={() => setShowWizard(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showBOMDialog} onOpenChange={(open) => {
        if (!open) {
          handleCloseBOM();
        } else {
          setShowBOMDialog(open);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Manage BOM: {trialPacks.find(p => p.item_code === selectedTrialSku)?.product_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-b pb-4">
              <h4 className="font-semibold text-slate-900 mb-3">Add Component</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Component SKU</label>
                  <select
                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm"
                    value={bomForm.component_sku}
                    onChange={(e) => setBomForm({ ...bomForm, component_sku: e.target.value })}
                  >
                    <option value="">Select SKU...</option>
                    {regularProducts.filter(p => !bomItems.some(b => b.component_sku === p.item_code)).map(p => (
                      <option key={p.id} value={p.item_code}>
                        {p.item_code} - {p.product_name} ({p.bottles_per_box} bottles/box)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Bottles Required</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={bomForm.bottles_required}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setBomForm({ ...bomForm, bottles_required: val === '' ? '' : parseInt(val) || 1 });
                    }}
                    placeholder="1"
                  />
                </div>
                <Button
                    onClick={() => {
                      if (!bomForm.component_sku || !bomForm.bottles_required) {
                        toast.error('Please select a component SKU and enter bottles required');
                        return;
                      }
                      console.log('Mutating with:', bomForm, 'trialPacks:', trialPacks, 'selectedTrialSku:', selectedTrialSku);
                      addBOMMutation.mutate(bomForm);
                    }}
                   disabled={addBOMMutation.isPending}
                   className="w-full h-12 text-base"
                 >
                   <Plus className="w-4 h-4 mr-2" />
                   Add Component
                 </Button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Current BOM</h4>
              {(() => {
                const trialPack = trialPacks.find(p => p.item_code === selectedTrialSku);
                const totalBottles = bomItems.reduce((sum, b) => sum + b.bottles_required, 0);
                const remainingBottles = (trialPack?.bottles_per_box || 0) - totalBottles;
                
                return (
                  <>
                    {trialPack && (
                      <div className={`mb-3 p-3 rounded-lg text-sm ${remainingBottles === 0 ? 'bg-green-50 border border-green-200' : remainingBottles < 0 ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                        <p className={`font-semibold ${remainingBottles === 0 ? 'text-green-700' : remainingBottles < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                          {remainingBottles === 0 ? '✓ Complete' : remainingBottles > 0 ? `${remainingBottles} bottles remaining` : `⚠️ ${Math.abs(remainingBottles)} bottles over capacity`}
                        </p>
                        <p className={`text-xs mt-1 ${remainingBottles === 0 ? 'text-green-600' : remainingBottles < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          Trial pack: {trialPack.bottles_per_box} bottles • BOM total: {totalBottles} bottles
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
              {bomItems.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No components yet</p>
              )}
              <div className="space-y-2">
                {bomItems.map(item => {
                  const product = allProducts.find(p => p.item_code === item.component_sku);
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{item.component_sku}</p>
                        <p className="text-xs text-slate-500">
                          {item.bottles_required} bottles needed • {product?.bottles_per_box || '?'} bottles/box
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBOMMutation.mutate(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <Button
                onClick={handleSaveAndClose}
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
              >
                Save & Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mb-4">
            The BOM is incomplete. Do you want to save your changes or discard them?
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setShowBOMDialog(false);
                setShowCloseConfirm(false);
                toast.success('Changes discarded');
              }}
              variant="outline"
              className="flex-1 h-12 text-base"
            >
              Don't Save
            </Button>
            <Button
              onClick={handleSaveAndClose}
              className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700"
            >
              Save & Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}