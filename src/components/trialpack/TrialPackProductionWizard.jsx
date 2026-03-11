import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
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

  const { data: trialPacks = [] } = useQuery({
    queryKey: ['trialPackSKUs'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_trial_pack: true, is_active: true }),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
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

  const calculateMinProduction = (bomData) => {
    if (!bomData || bomData.length === 0) return 0;
    
    const mins = bomData.map(item => {
      const product = allProducts.find(p => p.item_code === item.component_sku);
      if (!product || !product.bottles_per_box) return Infinity;
      return Math.floor(product.bottles_per_box / item.bottles_required);
    });
    
    return Math.min(...mins);
  };

  const getSuggestedLots = (componentSku) => {
    return lots
      .filter(lot => lot.sku_code === componentSku && lot.boxes_balance > 0)
      .sort((a, b) => new Date(a.exp_date) - new Date(b.exp_date));
  };

  const handleSkuSelect = async (pack) => {
    setSelectedSku(pack);
    const bomData = await loadBOM(pack.item_code);
    if (bomData.length === 0) {
      toast.error('No BOM configured for this trial pack');
      return;
    }
    const minQty = calculateMinProduction(bomData);
    if (minQty === 0 || minQty === Infinity) {
      toast.error('Invalid BOM configuration');
      return;
    }
    setQuantity(minQty);
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

    const product = allProducts.find(p => p.item_code === lot.sku_code);
    const bottlesPerBox = product?.bottles_per_box || 1;
    const boxesNeeded = Math.ceil((requiredComponent.bottles_required * quantity) / bottlesPerBox);
    const alreadyScanned = scannedBoxes.filter(b => b.component_sku === lot.sku_code).length;

    if (alreadyScanned >= boxesNeeded) {
      toast.error(`Already scanned enough ${lot.sku_code}`);
      return;
    }

    setScannedBoxes([...scannedBoxes, { 
      lot_id: lotId, 
      sku_code: lot.sku_code, 
      batch_code: lot.batch_code, 
      mfg_date: lot.mfg_date, 
      exp_date: lot.exp_date,
      bottles_per_box: bottlesPerBox
    }]);
    toast.success(`Scanned ${lot.product_name}`);
  };

  const isAllScanned = () => {
    return bom.every(bomItem => {
      const product = allProducts.find(p => p.item_code === bomItem.component_sku);
      const bottlesPerBox = product?.bottles_per_box || 1;
      const boxesNeeded = Math.ceil((bomItem.bottles_required * quantity) / bottlesPerBox);
      const scanned = scannedBoxes.filter(b => b.component_sku === bomItem.component_sku).length;
      return scanned >= boxesNeeded;
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const productionId = `TP-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-4)}`;
      const allBatches = [...new Set(scannedBoxes.map(b => b.batch_code))];
      const allLots = [...new Set(scannedBoxes.map(b => b.lot_id))];
      
      const oldestMfg = scannedBoxes.reduce((min, b) => new Date(b.mfg_date) < new Date(min) ? b.mfg_date : min, scannedBoxes[0].mfg_date);
      const oldestExp = scannedBoxes.reduce((min, b) => new Date(b.exp_date) < new Date(min) ? b.exp_date : min, scannedBoxes[0].exp_date);
      
      const batchCode = `${selectedSku.item_code}-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-3)}`;

      await base44.entities.TrialPackProduction.create({
        production_id: productionId,
        trial_pack_sku: selectedSku.item_code,
        trial_pack_name: selectedSku.product_name,
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

      const lotSeq = Date.now();
      const lotId = `LOT-${format(new Date(), 'dd-MM-yyyy')}-${lotSeq}`;
      
      await base44.entities.WarehouseLot.create({
        lot_id: lotId,
        lot_date: format(new Date(), 'yyyy-MM-dd'),
        lot_seq: lotSeq,
        sku_code: selectedSku.item_code,
        product_name: selectedSku.product_name,
        brand_name: selectedSku.brand_name,
        product_family: selectedSku.product_family,
        batch_code: batchCode,
        mfg_date: oldestMfg,
        exp_date: oldestExp,
        boxes_in: quantity,
        boxes_balance: quantity,
        loose_bottles_in: 0,
        loose_bottles_balance: 0,
        bottles_per_box: selectedSku.bottles_per_box || 6,
        status: 'ACTIVE',
        is_trial_pack: true,
      });

      for (const box of scannedBoxes) {
        const lot = lots.find(l => l.lot_id === box.lot_id);
        await base44.entities.WarehouseLot.update(lot.id, {
          boxes_balance: (lot.boxes_balance || 0) - 1,
        });
      }

      return { lotId, batchCode };
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
          {trialPacks.length === 0 && (
            <p className="text-sm text-slate-500">No trial pack SKUs found</p>
          )}
          {trialPacks.map(pack => (
            <Card key={pack.id} className="p-4 hover:bg-slate-50 cursor-pointer" onClick={() => handleSkuSelect(pack)}>
              <p className="font-bold text-slate-900">{pack.product_name}</p>
              <p className="text-sm text-slate-500">{pack.item_code} • {pack.bottles_per_box || 0} bottles</p>
            </Card>
          ))}
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setStep('select')} className="h-12">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card className="p-4">
            <h3 className="font-bold text-slate-900 mb-2">Quantity to Produce</h3>
            <Input 
              type="number" 
              value={quantity} 
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} 
              min={calculateMinProduction(bom)} 
            />
            <p className="text-xs text-slate-500 mt-1">
              Minimum: {calculateMinProduction(bom)} pack(s) based on BOM
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="font-bold text-slate-900 mb-4">Required Components</h3>
            {bom.map(item => {
              const product = allProducts.find(p => p.item_code === item.component_sku);
              const bottlesPerBox = product?.bottles_per_box || 1;
              const boxesNeeded = Math.ceil((item.bottles_required * quantity) / bottlesPerBox);
              const scanned = scannedBoxes.filter(b => b.component_sku === item.component_sku).length;
              const suggested = getSuggestedLots(item.component_sku);

              return (
                <div key={item.id} className="mb-4 pb-4 border-b last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium text-slate-900">{item.component_sku}</p>
                      <p className="text-xs text-slate-500">
                        {item.bottles_required * quantity} bottles needed = {boxesNeeded} box(es)
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{scanned}/{boxesNeeded} scanned</p>
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
          <Button variant="outline" onClick={() => setStep('scan')} className="h-12">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card className="p-4 bg-green-50 border-green-200">
            <h3 className="font-bold text-green-900 mb-4">Ready to Produce</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Trial Pack:</span>
                <span className="font-bold text-green-900">{selectedSku?.product_name}</span>
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
            Confirm Production
          </Button>
        </div>
      )}
    </div>
  );
}