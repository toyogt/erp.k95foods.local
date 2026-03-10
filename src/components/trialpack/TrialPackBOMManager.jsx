import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function TrialPackBOMManager({ trialPackSku }) {
  const [items, setItems] = useState([]);
  const queryClient = useQueryClient();

  const { data: bomItems = [] } = useQuery({
    queryKey: ['trialPackBOM', trialPackSku],
    queryFn: () => base44.entities.TrialPackBOM.filter({ trial_pack_sku: trialPackSku }),
    enabled: !!trialPackSku,
  });

  const saveMutation = useMutation({
    mutationFn: async (bomData) => {
      await base44.entities.TrialPackBOM.filter({ trial_pack_sku: trialPackSku })
        .then(existing => Promise.all(existing.map(item => base44.entities.TrialPackBOM.delete(item.id))));
      return base44.entities.TrialPackBOM.bulkCreate(bomData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['trialPackBOM']);
      toast.success('BOM saved');
      setItems([]);
    },
  });

  const addItem = () => {
    setItems([...items, { component_sku: '', quantity_required: 1, display_order: items.length + 1 }]);
  };

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    updated[idx][field] = value;
    setItems(updated);
  };

  const handleSave = () => {
    if (!trialPackSku) {
      toast.error('Select a trial pack SKU first');
      return;
    }
    const valid = items.every(item => item.component_sku && item.quantity_required > 0);
    if (!valid) {
      toast.error('Fill all component details');
      return;
    }
    saveMutation.mutate(items.map(item => ({ ...item, trial_pack_sku: trialPackSku })));
  };

  return (
    <Card className="p-4">
      <h3 className="font-bold text-slate-900 mb-4">Bill of Materials</h3>
      
      {bomItems.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-slate-600">Current BOM:</p>
          {bomItems.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded">
              <span className="font-mono">{item.component_sku}</span>
              <span className="text-slate-500">×{item.quantity_required}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 mb-4">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              placeholder="Component SKU"
              value={item.component_sku}
              onChange={(e) => updateItem(idx, 'component_sku', e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={item.quantity_required}
              onChange={(e) => updateItem(idx, 'quantity_required', parseInt(e.target.value) || 1)}
              className="w-20"
            />
            <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={addItem} className="flex-1">
          <Plus className="w-4 h-4 mr-2" />
          Add Component
        </Button>
        {items.length > 0 && (
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save BOM
          </Button>
        )}
      </div>
    </Card>
  );
}