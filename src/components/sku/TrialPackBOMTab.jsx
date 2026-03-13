import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrialPackBOMTab({ sku, skuData }) {
  const [bomForm, setBomForm] = useState({ component_sku: '', bottles_required: 1 });
  const queryClient = useQueryClient();

  const { data: allProducts = [] } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['trialPackBOM', sku],
    queryFn: () => sku ? base44.entities.TrialPackBOM.filter({ trial_pack_sku: sku }) : Promise.resolve([]),
    enabled: !!sku,
  });

  const addBOMMutation = useMutation({
    mutationFn: async (data) => {
      const currentTotal = bomItems.reduce((sum, b) => sum + b.bottles_required, 0);
      const bottlesRequired = parseInt(data.bottles_required) || 0;
      const newTotal = currentTotal + bottlesRequired;
      const capacity = skuData?.bottles_per_box || 0;
      
      if (newTotal > capacity) {
        const error = new Error(`Cannot add ${bottlesRequired} bottles. Current BOM has ${currentTotal} bottles, but trial pack capacity is only ${capacity} bottles.`);
        return Promise.reject(error);
      }
      
      return base44.entities.TrialPackBOM.create({
        trial_pack_sku: sku,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trialPackBOM'] });
      toast.success('Component added to BOM');
      setBomForm({ component_sku: '', bottles_required: 1 });
    },
    onError: (error) => {
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
  const totalBottles = bomItems.reduce((sum, b) => sum + b.bottles_required, 0);
  const remainingBottles = (skuData?.bottles_per_box || 0) - totalBottles;

  if (!skuData?.is_trial_pack) {
    return (
      <div className="p-6 text-center bg-slate-50 rounded-lg">
        <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-600">BOM management is only available for Trial Pack SKUs</p>
        <p className="text-xs text-slate-400 mt-1">Enable "Is Trial Pack" in Basics tab to use this feature</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${
        remainingBottles === 0 
          ? 'bg-green-50 border-green-200' 
          : remainingBottles < 0 
          ? 'bg-red-50 border-red-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          {remainingBottles === 0 ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`font-semibold text-sm ${
              remainingBottles === 0 ? 'text-green-700' : remainingBottles < 0 ? 'text-red-700' : 'text-blue-700'
            }`}>
              {remainingBottles === 0 
                ? '✓ BOM Complete' 
                : remainingBottles > 0 
                ? `${remainingBottles} bottles remaining` 
                : `⚠️ ${Math.abs(remainingBottles)} bottles over capacity`}
            </p>
            <p className={`text-xs mt-1 ${
              remainingBottles === 0 ? 'text-green-600' : remainingBottles < 0 ? 'text-red-600' : 'text-blue-600'
            }`}>
              Trial pack: {skuData.bottles_per_box} bottles • BOM total: {totalBottles} bottles
            </p>
          </div>
        </div>
      </div>

      {/* Add Component Form */}
      <div className="border rounded-lg p-4 bg-white">
        <h4 className="font-semibold text-slate-900 mb-4">Add Component</h4>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Component SKU</label>
            <select
              className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm"
              value={bomForm.component_sku}
              onChange={(e) => setBomForm({ ...bomForm, component_sku: e.target.value })}
            >
              <option value="">Select SKU...</option>
              {regularProducts
                .filter(p => !bomItems.some(b => b.component_sku === p.item_code))
                .map(p => (
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

      {/* Current BOM List */}
      <div className="border rounded-lg p-4 bg-white">
        <h4 className="font-semibold text-slate-900 mb-4">Current BOM</h4>
        {bomItems.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No components yet</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}