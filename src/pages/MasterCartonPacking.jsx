import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Package, Settings, History, Plus } from 'lucide-react';
import MasterCartonWizard from '@/components/mastercarton/MasterCartonWizard';
import { format } from 'date-fns';

export default function MasterCartonPacking() {
  const [activeTab, setActiveTab] = useState('pack');
  const [showWizard, setShowWizard] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['masterCartonConfigs'],
    queryFn: () => base44.entities.MasterCartonConfig.list(),
  });

  const { data: cartons = [] } = useQuery({
    queryKey: ['masterCartons'],
    queryFn: () => base44.entities.MasterCarton.list('-packed_date'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Carton Packing</h1>
          <p className="text-sm text-slate-500">Pack boxes into master cartons</p>
        </div>
        <Button onClick={() => setShowWizard(true)} size="lg" className="h-12">
          <Plus className="w-5 h-5 mr-2" />
          New Carton
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pack">
            <Package className="w-4 h-4 mr-2" />
            Pack
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

        <TabsContent value="pack" className="space-y-4">
          <Card className="p-6 text-center bg-slate-50">
            <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">Start New Packing</h3>
            <p className="text-sm text-slate-600 mb-4">Click the button above to pack a master carton</p>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          {configs.map(config => (
            <Card key={config.id} className="p-4">
              <p className="font-bold text-slate-900">{config.box_sku}</p>
              <p className="text-sm text-slate-500">Carton size: {config.carton_size} boxes</p>
              {config.label_template_id && (
                <p className="text-xs text-slate-400 mt-1">Template: {config.label_template_id}</p>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {cartons.map(carton => (
            <Card key={carton.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-slate-900">{carton.inner_box_name}</p>
                  <p className="text-sm text-slate-500">{carton.master_carton_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{carton.boxes_packed} boxes</p>
                  <p className="text-xs text-slate-500">{format(new Date(carton.packed_date), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">SKU:</span>
                  <span className="ml-1 font-mono">{carton.inner_box_sku}</span>
                </div>
                <div>
                  <span className="text-slate-500">Batches:</span>
                  <span className="ml-1">{carton.batch_codes?.length || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mfg:</span>
                  <span className="ml-1">{format(new Date(carton.mfg_date), 'dd MMM yy')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Exp:</span>
                  <span className="ml-1">{format(new Date(carton.exp_date), 'dd MMM yy')}</span>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <MasterCartonWizard onClose={() => setShowWizard(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}