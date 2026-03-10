import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Package, Scan, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import StepBar from '@/components/fgwarehouse/StepBar';
import QRScanInput from '@/components/fgwarehouse/QRScanInput';
import { format } from 'date-fns';

const STEPS = [
  { id: 'select', label: 'Select SKU' },
  { id: 'scan', label: 'Scan Boxes' },
  { id: 'confirm', label: 'Confirm' },
];

export default function TrialPackProductionWizard({ onClose }) {
  const [step, setStep] = useState('select');
  const [selectedSku, setSelectedSku] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [bom, setBom] = useState([]);
  const [scannedBoxes, setScannedBoxes] = useState([]);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: configs = [] } = useQuery({
    queryKey: ['trialPackConfigs'],
    queryFn: () => base44.entities.TrialPackConfig.filter({ is_active: true }),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ['warehouseLots'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }),
  });

  const loadBOM = async (sku) => {
    const bomItems = await base44.entities.TrialPackBOM.filter({ trial_pack_sku: sku });
    setBom(bomItems);
    return bomItems;
  };

  const getSuggestedLots = (componentSku) => {
    return lots
      .filter(lot => lot.sku_code === componentSku && lot.boxes_balance > 0)
      .sort((a, b) => new Date(a.exp_date) - new Date(b.exp_date));
  };

  const handleSkuSelect = async (config) => {
    setSelectedSku(config);
    const bomData = await loadBOM(config.trial_pack_sku);
    if (bomData.length === 0) {
      toast.error('No BOM configured for this trial pack');
      return;
    }
    setStep('scan');
  };

  const handleScanBox = (lotId) => {
    const lot = lots.find(l => l.lot_id === lotId);
    if (!lot) {
      toast.error('Lot not found');
      return;
    }

    const requiredComponent = bom.find(b => b.component_sku === lot.sku_code);
    if (!requiredComponent) {
      toast.error(`${lot.sku_code} not in BOM`);
      return;
    }

    const alreadyScanned = scannedBoxes.filter(b => b.component_sku === lot.sku_code).length;
    const needed = requiredComponent.quantity_required * quantity;

    if (alreadyScanned >= needed) {
      toast.error(`Already scanned enough ${lot.sku_code}`);
      return;
    }

    setScannedBoxes([...scannedBoxes, { lot_id: lotId, sku_code: lot.sku_code, batch_code: lot.batch_code, mfg_date: lot.mfg_date, exp_date: lot.exp_date }]);
    toast.success(`Scanned ${lot.product_name}`);
  };

  const isAllScanned = () => {
    return bom.every(bomItem => {
      const needed = bomItem.quantity_required * quantity;
      const scanned = scannedBoxes.filter(b => b.component_sku === bomItem.component_sku).length;
      return scanned >= needed;
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const productionId = `TP-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-4)}`;
      const allBatches = [...new Set(scannedBoxes.map(b => b.batch_code))];
      const allLots = [...new Set(scannedBoxes.map(b => b.lot_id))];
      
      // Find oldest mfg/exp
      const oldestMfg = scannedBoxes.reduce((min, b) => new Date(b.mfg_date) < new Date(min) ? b.mfg_date : min, scannedBoxes[0].mfg_date);
      const oldestExp = scannedBoxes.reduce((min, b) => new Date(b.exp_date) < new Date(min) ? b.exp_date : min, scannedBoxes[0].exp_date);
      
      const batchCode = `${selectedSku.trial_pack_sku}-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-3)}`;

      // Create trial pack production record
      const production = await base44.entities.TrialPackProduction.create({
        production_id: productionId,
        trial_pack_sku: selectedSku.trial_pack_sku,
        trial_pack_name: selectedSku.display_name,
        quantity_produced: quantity,
        batch_code: batchCode,
        mfg_date: oldestMfg,
        exp_date: oldestExp,
        source_lots: allLots,
        source_batches: allBatches,
        production_date: format(new Date(), 'yyyy-MM-dd'),
        produced_by: user?.email,
        status: 'CONFIRMED',
      });

      // Create warehouse lot for trial packs
      const lotSeq = Date.now();
      const lotId = `LOT-${format(new Date(), 'dd-MM-yyyy')}-${lotSeq}`;
      
      await base44.entities.WarehouseLot.create({
        lot_id: lotId,
        lot_date: format(new Date(), 'yyyy-MM-dd'),
        lot_seq: lotSeq,
        sku_code: selectedSku.trial_pack_sku,
        product_name: selectedSku.display_name,
        batch_code: batchCode,
        mfg_date: oldestMfg,
        exp_date: oldestExp,
        boxes_in: quantity,
        boxes_balance: quantity,
        loose_bottles_in: 0,
        loose_bottles_balance: 0,
        bottles_per_box: selectedSku.total_bottles,
        status: 'ACTIVE',
        is_trial_pack: true,
      });

      // Deduct from source lots
      for (const box of scannedBoxes) {
        const lot = lots.find(l => l.lot_id === box.lot_id);
        await base44.entities.WarehouseLot.update(lot.id, {
          boxes_balance: (lot.boxes_balance || 0) - 1,
        });
      }

      return production;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['warehouseLots']);
      queryClient.invalidateQueries(['trialPackProductions']);
      toast.success('Trial pack production completed');
      onClose();
    },
  });

  return (
    <div className="space-y-6">
      <StepBar steps={STEPS} currentStep={step} />

      {step === 'select' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Select Trial Pack</h2>
          {configs.map(config => (
            <Card key={config.id} className="p-4 hover:bg-slate-50 cursor-pointer" onClick={() => handleSkuSelect(config)}>
              <p className="font-bold text-slate-900">{config.display_name}</p>
              <p className="text-sm text-slate-500">{config.trial_pack_sku} • {config.total_bottles} bottles</p>
            </Card>
          ))}
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setStep('select')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card className="p-4">
            <h3 className="font-bold text-slate-900 mb-2">Quantity to Produce</h3>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} min={1} />
          </Card>

          <Card className="p-4">
            <h3 className="font-bold text-slate-900 mb-4">Required Components</h3>
            {bom.map(item => {
              const needed = item.quantity_required * quantity;
              const scanned = scannedBoxes.filter(b => b.component_sku === item.component_sku).length;
              const suggested = getSuggestedLots(item.component_sku);

              return (
                <div key={item.id} className="mb-4 pb-4 border-b last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-slate-900">{item.component_sku}</p>
                    <p className="text-sm font-bold text-slate-700">{scanned}/{needed} scanned</p>
                  </div>
                  {suggested.length > 0 && (
                    <div className="text-xs text-slate-500 mb-2">
                      Suggested: {suggested.slice(0, 3).map(l => `${l.lot_id} (${l.boxes_balance} available)`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          <QRScanInput onScan={handleScanBox} placeholder="Scan box QR code" />

          {scannedBoxes.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold text-slate-900 mb-2">Scanned Boxes ({scannedBoxes.length})</h3>
              <div className="space-y-1 max-h-40 overflow-auto">
                {scannedBoxes.map((box, idx) => (
                  <div key={idx} className="text-sm bg-slate-50 p-2 rounded flex justify-between">
                    <span className="font-mono">{box.lot_id}</span>
                    <span className="text-slate-500">{box.sku_code}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={() => setStep('confirm')} disabled={!isAllScanned()} className="w-full h-14 text-base">
            <CheckCircle className="w-5 h-5 mr-2" />
            Continue to Confirm
          </Button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setStep('scan')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card className="p-4 bg-green-50 border-green-200">
            <h3 className="font-bold text-green-900 mb-4">Ready to Produce</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Trial Pack:</span>
                <span className="font-bold text-green-900">{selectedSku?.display_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Quantity:</span>
                <span className="font-bold text-green-900">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Boxes Used:</span>
                <span className="font-bold text-green-900">{scannedBoxes.length}</span>
              </div>
            </div>
          </Card>

          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full h-14 text-base bg-green-600 hover:bg-green-700">
            <Package className="w-5 h-5 mr-2" />
            Confirm Production
          </Button>
        </div>
      )}
    </div>
  );
}