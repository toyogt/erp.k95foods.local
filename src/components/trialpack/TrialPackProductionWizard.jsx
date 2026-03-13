import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, X, Trash2, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import StepBar from '@/components/fgwarehouse/StepBar';
import QRScanInput from '@/components/fgwarehouse/QRScanInput';
import LotCardPrint from '@/components/fgwarehouse/LotCardPrint';
import { format } from 'date-fns';

const STEPS = [
  { id: 'select', label: 'Select SKU' },
  { id: 'scan', label: 'Scan Lots' },
  { id: 'confirm', label: 'Confirm' },
];

export default function TrialPackProductionWizard({ onClose }) {
  const [step, setStep] = useState('select');
  const [selectedSku, setSelectedSku] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [bom, setBom] = useState([]);
  const [scannedLots, setScannedLots] = useState([]);
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newLot, setNewLot] = useState(null);
  const [boxLabels, setBoxLabels] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: trialPacks = [] } = useQuery({
    queryKey: ['trialPackSKUs'],
    queryFn: async () => {
      const packs = await base44.entities.ProductMaster.filter({ is_trial_pack: true, is_active: true });
      const packsWithBOM = [];
      
      for (const pack of packs) {
        const bomItems = await base44.entities.TrialPackBOM.filter({ trial_pack_sku: pack.item_code });
        if (bomItems.length > 0) {
          packsWithBOM.push(pack);
        }
      }
      
      return packsWithBOM;
    },
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ['warehouseLots'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ is_active: true }),
  });

  const { data: customerBarcodes = [] } = useQuery({
    queryKey: ['customerBarcodes'],
    queryFn: () => base44.entities.SKUCustomerBarcode.filter({ is_active: true }),
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

  const getSuggestedLots = (componentSku, boxesNeeded) => {
    const availableLots = lots
      .filter(lot => lot.sku_code === componentSku && lot.boxes_balance > 0)
      .sort((a, b) => new Date(a.mfg_date) - new Date(b.mfg_date));
    
    // Calculate total available
    const totalAvailable = availableLots.reduce((sum, lot) => sum + (lot.boxes_balance || 0), 0);
    
    // Return lots with availability info
    return {
      lots: availableLots,
      totalAvailable,
      isEnough: totalAvailable >= boxesNeeded
    };
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

  const handleScanLot = (lotId) => {
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
    const qty = parseInt(quantity) || 0;
    const boxesNeeded = Math.ceil((requiredComponent.bottles_required * qty) / bottlesPerBox);
    const alreadyScanned = scannedLots.filter(l => l.component_sku === lot.sku_code).reduce((sum, l) => sum + l.boxes_used, 0);

    if (alreadyScanned >= boxesNeeded) {
      toast.error(`Already scanned enough ${lot.sku_code}`);
      return;
    }

    const boxesToTake = Math.min(boxesNeeded - alreadyScanned, lot.boxes_balance || 0);
    if (boxesToTake <= 0) {
      toast.error('No boxes available in this lot');
      return;
    }

    setScannedLots([...scannedLots, { 
      lot_id: lotId, 
      sku_code: lot.sku_code,
      product_name: lot.product_name, 
      component_sku: lot.sku_code,
      batch_code: lot.batch_code, 
      mfg_date: lot.mfg_date, 
      exp_date: lot.exp_date,
      bottles_per_box: bottlesPerBox,
      boxes_used: boxesToTake
    }]);
    toast.success(`Scanned ${lot.product_name} - ${boxesToTake} box(es)`);
  };

  const isAllScanned = () => {
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return false;
    return bom.every(bomItem => {
      const product = allProducts.find(p => p.item_code === bomItem.component_sku);
      const bottlesPerBox = product?.bottles_per_box || 1;
      const boxesNeeded = Math.ceil((bomItem.bottles_required * qty) / bottlesPerBox);
      const scanned = scannedLots.filter(l => l.component_sku === bomItem.component_sku).reduce((sum, l) => sum + l.boxes_used, 0);
      return scanned >= boxesNeeded;
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity);
      const productionId = `TP-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-4)}`;
      const allBatches = [...new Set(scannedLots.map(l => l.batch_code))];
      const allLotIds = [...new Set(scannedLots.map(l => l.lot_id))];
      
      const oldestMfg = scannedLots.reduce((min, l) => new Date(l.mfg_date) < new Date(min) ? l.mfg_date : min, scannedLots[0].mfg_date);
      const oldestExp = scannedLots.reduce((min, l) => new Date(l.exp_date) < new Date(min) ? l.exp_date : min, scannedLots[0].exp_date);
      
      const batchCode = `${selectedSku.item_code}-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-3)}`;

      await base44.entities.TrialPackProduction.create({
        production_id: productionId,
        trial_pack_sku: selectedSku.item_code,
        trial_pack_name: selectedSku.product_name,
        quantity_produced: qty,
        batch_code: batchCode,
        mfg_date: oldestMfg,
        exp_date: oldestExp,
        source_lots: allLotIds,
        source_batches: allBatches,
        production_date: format(new Date(), 'yyyy-MM-dd'),
        produced_by: user?.email,
        status: 'CONFIRMED',
      });

      const lotSeq = Date.now();
      const lotId = `LOT-${format(new Date(), 'dd-MM-yyyy')}-${lotSeq}`;
      
      const customerBarcode = selectedCustomer 
        ? customerBarcodes.find(cb => cb.customer_id === selectedCustomer && cb.sku_code === selectedSku.item_code)
        : null;

      const createdLot = await base44.entities.WarehouseLot.create({
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
        boxes_in: qty,
        boxes_balance: qty,
        loose_bottles_in: 0,
        loose_bottles_balance: 0,
        bottles_per_box: selectedSku.bottles_per_box || 6,
        status: 'ACTIVE',
        is_trial_pack: true,
        location: location || '',
        customer_id: selectedCustomer || null,
        customer_barcode: customerBarcode?.barcode_value || null,
      });

      // Generate box labels for trial pack
      const boxLabels = [];
      for (let i = 1; i <= qty; i++) {
        const boxSerial = `${batchCode}-${String(i).padStart(4, '0')}`;
        await base44.entities.BoxLabel.create({
          box_serial: boxSerial,
          item_code: selectedSku.item_code,
          product_name: selectedSku.product_name,
          batch_no: batchCode,
          mfg_date: oldestMfg,
          exp_date: oldestExp,
          qr_payload: boxSerial,
          status: 'PRINTED_UNREGISTERED',
          product_code: selectedSku.item_code,
          printed_at: new Date().toISOString(),
          printed_by: user?.email,
        });
        boxLabels.push(boxSerial);
      }

      for (const scannedLot of scannedLots) {
        const lot = lots.find(l => l.lot_id === scannedLot.lot_id);
        await base44.entities.WarehouseLot.update(lot.id, {
          boxes_balance: (lot.boxes_balance || 0) - scannedLot.boxes_used,
        });
      }

      return { lotId, batchCode, createdLot, boxLabels };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['warehouseLots']);
      queryClient.invalidateQueries(['trialPackProductions']);
      queryClient.invalidateQueries(['boxLabels']);
      setNewLot(data.createdLot);
      setBoxLabels(data.boxLabels || []);
      setStep('done');
      toast.success('Trial pack production completed');
    },
  });

  const handleRemoveLot = (lotId) => {
    setScannedLots(scannedLots.filter(l => l.lot_id !== lotId));
    toast.success('Lot removed');
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col z-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-700" />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 text-lg">Trial Pack Production</h1>
            <p className="text-xs text-slate-500">Step {step === 'select' ? '1' : step === 'scan' ? '2' : '3'} of 3</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-4 pb-20">
          <StepBar steps={STEPS} currentStep={step} />

      {step === 'select' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Select Trial Pack</h2>
          {trialPacks.length === 0 && (
            <p className="text-sm text-slate-500">No trial pack SKUs found</p>
          )}
          <div className="grid grid-cols-1 gap-3">
            {trialPacks.map(pack => (
              <Card key={pack.id} className="p-5 hover:bg-slate-50 cursor-pointer border-2 hover:border-slate-300 transition-all active:scale-[0.98]" onClick={() => handleSkuSelect(pack)}>
                <p className="font-bold text-slate-900 text-base mb-1">{pack.brand_name}</p>
                <p className="font-medium text-slate-700 text-sm">{pack.product_family} {pack.flavour}</p>
                <p className="text-xs text-slate-500 mt-2">{pack.item_code} • {pack.bottles_per_box || 0} bottles</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => { setStep('select'); setQuantity(''); setScannedLots([]); }} className="h-12 text-base">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>

          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-3 text-base">How many trial pack boxes to make?</h3>
            <Input 
              type="tel"
              inputMode="numeric"
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="h-16 text-2xl text-center font-bold"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Minimum: {calculateMinProduction(bom)} box(es) based on BOM
            </p>
            {selectedSku && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="font-bold text-slate-700 text-sm">{selectedSku.brand_name}</p>
                <p className="text-xs text-slate-600">{selectedSku.product_family} {selectedSku.flavour}</p>
                <p className="text-xs text-slate-500 mt-1">{selectedSku.bottles_per_box || 0} bottles per box</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-2 text-base">Required Components</h3>
            <p className="text-xs text-slate-600 mb-4">Collect required number of boxes from each lot for the SKU</p>
            {bom.map(item => {
              const product = allProducts.find(p => p.item_code === item.component_sku);
              const bottlesPerBox = product?.bottles_per_box || 1;
              const qty = parseInt(quantity) || 0;
              const boxesNeeded = Math.ceil((item.bottles_required * qty) / bottlesPerBox);
              const scanned = scannedLots.filter(l => l.component_sku === item.component_sku).reduce((sum, l) => sum + l.boxes_used, 0);
              const lotInfo = getSuggestedLots(item.component_sku, boxesNeeded);

              return (
                <div key={item.id} className="mb-4 pb-4 border-b last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm">{item.component_sku}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{product?.product_name || ''}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.bottles_required * qty} bottles needed = {boxesNeeded} box(es)
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 shrink-0 ml-3">{scanned}/{boxesNeeded} scanned</p>
                  </div>
                  {qty > 0 && scanned < boxesNeeded && (
                    <div className="mt-2">
                      {!lotInfo.isEnough ? (
                        <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 border border-red-200">
                          ⚠️ Not enough stock! Need {boxesNeeded} boxes but only {lotInfo.totalAvailable} available. Receive more or reduce quantity.
                        </div>
                      ) : (
                        <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5 space-y-1">
                          <p className="font-semibold">Suggested lots (oldest first):</p>
                          {lotInfo.lots.slice(0, 3).map(l => (
                            <p key={l.lot_id}>• {l.lot_id} {l.location && `📍 ${l.location}`} ({l.boxes_balance} available)</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          <QRScanInput onScan={handleScanLot} placeholder="Scan LOT for all components" className="h-16 text-base" />

          {scannedLots.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold text-slate-900 mb-3 text-sm">Scanned Lots ({scannedLots.length})</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {scannedLots.map((lot, idx) => (
                  <div key={idx} className="text-sm bg-slate-50 p-3 rounded flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-slate-900 text-xs">{lot.lot_id}</p>
                      <p className="text-xs text-slate-600 truncate">{lot.product_name}</p>
                      <p className="text-xs text-slate-500 mt-1">{lot.boxes_used} box(es) used</p>
                    </div>
                    <button
                      onClick={() => handleRemoveLot(lot.lot_id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={() => setStep('confirm')} disabled={!isAllScanned()} className="w-full h-16 text-lg">
            <CheckCircle className="w-6 h-6 mr-2" />
            Continue to Confirm
          </Button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">Production Complete!</p>
                <p className="text-sm text-slate-500 mt-1">{quantity} box(es) produced successfully</p>
              </div>
            </div>
          </Card>
          
          {newLot && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">🖨️ Print & attach lot card</p>
              <LotCardPrint lot={newLot} />
            </Card>
          )}

          {boxLabels.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">📦 Box Labels Created</p>
              <p className="text-xs text-slate-600 mb-3">
                {boxLabels.length} box label(s) generated.
              </p>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-mono text-slate-700">
                  {boxLabels[0]} {boxLabels.length > 1 && `to ${boxLabels[boxLabels.length - 1]}`}
                </p>
              </div>
            </Card>
          )}

          <Button onClick={onClose} className="w-full h-14 text-base font-bold min-h-[56px]">
            Close
          </Button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setStep('scan')} className="h-12 text-base">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>

          <Card className="p-5 bg-green-50 border-green-200">
            <h3 className="font-bold text-green-900 mb-4 text-base">Ready to Produce</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-bold text-green-900 text-base">{selectedSku?.brand_name}</p>
                <p className="text-green-700">{selectedSku?.product_family} {selectedSku?.flavour}</p>
                <p className="text-xs text-green-600 mt-1">{selectedSku?.item_code} · {selectedSku?.bottles_per_box} bottles/box</p>
              </div>

              <div className="bg-white/60 rounded-lg p-3 space-y-2 border border-green-300">
                <p className="text-xs font-bold text-green-900">📋 Recipe per Trial Pack:</p>
                {bom.map(item => {
                  const product = allProducts.find(p => p.item_code === item.component_sku);
                  return (
                    <div key={item.id} className="flex justify-between items-center">
                      <p className="text-xs text-green-800">
                        <strong>{item.component_sku}</strong> — {product?.brand_name || ''} {product?.flavour || ''}
                      </p>
                      <p className="text-xs font-bold text-green-900">{item.bottles_required} bottles</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-2 border-t border-green-300">
                <span className="text-green-700">Quantity:</span>
                <span className="font-bold text-green-900 text-base">{quantity} box(es)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Lots Used:</span>
                <span className="font-bold text-green-900">{scannedLots.length}</span>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            <Label className="text-xs text-slate-500">👤 Customer (optional)</Label>
            <select
              value={selectedCustomer || ''}
              onChange={e => setSelectedCustomer(e.target.value || null)}
              className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base bg-white min-h-[48px]"
            >
              <option value="">— No specific customer —</option>
              {customers.map(c => (
                <option key={c.id} value={c.customer_id}>{c.customer_name}</option>
              ))}
            </select>
            {selectedCustomer && customerBarcodes.find(cb => cb.customer_id === selectedCustomer && cb.sku_code === selectedSku?.item_code) && (
              <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                ✓ Custom barcode configured: {customerBarcodes.find(cb => cb.customer_id === selectedCustomer && cb.sku_code === selectedSku?.item_code)?.barcode_value}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-slate-500">📍 Location (optional)</Label>
            <Input 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              placeholder="e.g. Rack A-3, Bay 2" 
              className="h-12 text-base min-h-[48px]" 
            />
          </div>

          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full h-16 text-lg bg-green-600 hover:bg-green-700 min-h-[56px]">
            Confirm Production
          </Button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}