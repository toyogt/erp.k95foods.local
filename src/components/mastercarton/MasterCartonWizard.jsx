import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Package, Printer } from 'lucide-react';
import { toast } from 'sonner';
import StepBar from '@/components/fgwarehouse/StepBar';
import QRScanInput from '@/components/fgwarehouse/QRScanInput';
import { format } from 'date-fns';

const STEPS = [
  { id: 'select', label: 'Select SKU' },
  { id: 'scan', label: 'Scan Boxes' },
  { id: 'seal', label: 'Seal & Print' },
];

export default function MasterCartonWizard({ onClose }) {
  const [step, setStep] = useState('select');
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [scannedBoxes, setScannedBoxes] = useState([]);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: configs = [] } = useQuery({
    queryKey: ['masterCartonConfigs'],
    queryFn: () => base44.entities.MasterCartonConfig.filter({ is_active: true }),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ['warehouseLots'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }),
  });

  const handleConfigSelect = (config) => {
    setSelectedConfig(config);
    setStep('scan');
  };

  const handleScanBox = (lotId) => {
    const lot = lots.find(l => l.lot_id === lotId);
    if (!lot) {
      toast.error('Lot not found');
      return;
    }

    if (lot.sku_code !== selectedConfig.box_sku) {
      toast.error(`Wrong SKU. Expected ${selectedConfig.box_sku}`);
      return;
    }

    if (scannedBoxes.length >= selectedConfig.carton_size) {
      toast.error('Master carton is full');
      return;
    }

    if (scannedBoxes.find(b => b.lot_id === lotId)) {
      toast.error('Already scanned this lot');
      return;
    }

    setScannedBoxes([...scannedBoxes, { 
      lot_id: lotId, 
      batch_code: lot.batch_code, 
      mfg_date: lot.mfg_date, 
      exp_date: lot.exp_date,
      product_name: lot.product_name 
    }]);
    toast.success('Box scanned');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const cartonId = `MC-${format(new Date(), 'ddMMyyyy')}-${Date.now().toString().slice(-4)}`;
      const allBatches = [...new Set(scannedBoxes.map(b => b.batch_code))];
      const allLots = scannedBoxes.map(b => b.lot_id);
      
      const oldestMfg = scannedBoxes.reduce((min, b) => new Date(b.mfg_date) < new Date(min) ? b.mfg_date : min, scannedBoxes[0].mfg_date);
      const oldestExp = scannedBoxes.reduce((min, b) => new Date(b.exp_date) < new Date(min) ? b.exp_date : min, scannedBoxes[0].exp_date);

      return base44.entities.MasterCarton.create({
        master_carton_id: cartonId,
        inner_box_sku: selectedConfig.box_sku,
        inner_box_name: scannedBoxes[0].product_name,
        boxes_packed: scannedBoxes.length,
        batch_codes: allBatches,
        mfg_date: oldestMfg,
        exp_date: oldestExp,
        source_lot_ids: allLots,
        packed_date: format(new Date(), 'yyyy-MM-dd'),
        packed_by: user?.email,
        label_printed: false,
        status: 'DRAFT',
      });
    },
    onSuccess: (carton) => {
      queryClient.invalidateQueries(['masterCartons']);
      toast.success('Master carton created');
      setStep('seal');
    },
  });

  return (
    <div className="space-y-6">
      <StepBar steps={STEPS} currentStep={step} />

      {step === 'select' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Select Box SKU</h2>
          {configs.map(config => (
            <Card key={config.id} className="p-4 hover:bg-slate-50 cursor-pointer" onClick={() => handleConfigSelect(config)}>
              <p className="font-bold text-slate-900">{config.box_sku}</p>
              <p className="text-sm text-slate-500">Carton size: {config.carton_size} boxes</p>
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

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-blue-900">{selectedConfig.box_sku}</p>
                <p className="text-sm text-blue-700">Target: {selectedConfig.carton_size} boxes</p>
              </div>
              <div className="text-3xl font-bold text-blue-900">{scannedBoxes.length}/{selectedConfig.carton_size}</div>
            </div>
          </Card>

          <QRScanInput onScan={handleScanBox} placeholder="Scan box QR code" />

          {scannedBoxes.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold text-slate-900 mb-2">Scanned Boxes</h3>
              <div className="space-y-1 max-h-60 overflow-auto">
                {scannedBoxes.map((box, idx) => (
                  <div key={idx} className="text-sm bg-slate-50 p-2 rounded flex justify-between">
                    <span className="font-mono">{box.lot_id}</span>
                    <span className="text-slate-500">{box.batch_code}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={scannedBoxes.length === 0 || createMutation.isPending} 
            className="w-full h-14 text-base"
          >
            <Package className="w-5 h-5 mr-2" />
            Create Master Carton
          </Button>
        </div>
      )}

      {step === 'seal' && (
        <div className="space-y-4">
          <Card className="p-6 bg-green-50 border-green-200 text-center">
            <Package className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-xl font-bold text-green-900 mb-2">Master Carton Created</h3>
            <p className="text-sm text-green-700">Ready to print label</p>
          </Card>

          <Button className="w-full h-14 text-base">
            <Printer className="w-5 h-5 mr-2" />
            Print Label
          </Button>

          <Button variant="outline" onClick={onClose} className="w-full h-14 text-base">
            Done
          </Button>
        </div>
      )}
    </div>
  );
}