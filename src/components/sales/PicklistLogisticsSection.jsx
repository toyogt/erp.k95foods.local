/**
 * Logistics details section shown on the Picklist detail page.
 * Transporter + packaging + weight are highlighted here for filling.
 * Uses "Set Now" for missing product weight/units on picklist items.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Truck, Package, Scale, AlertCircle, Info, Loader2, CheckCircle2 } from 'lucide-react';
import SetProductDetailInline from './logistics/SetProductDetailInline';

export default function PicklistLogisticsSection({ picklist, onUpdated }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [transporter, setTransporter] = useState(picklist?.transporter || '');
  const [packagingType, setPackagingType] = useState(picklist?.packaging_type || '');

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });
  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || [];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || [];

  const { data: products = [] } = useQuery({
    queryKey: ['product-master-weights'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
    staleTime: 300000,
  });

  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.item_code] = p; });
    return map;
  }, [products]);

  const items = picklist?.items || [];
  const itemsWithDetails = useMemo(() => {
    return items.map(item => {
      const code = item.item_code || '';
      const product = productMap[code];
      return {
        ...item,
        packingUnit: product?.bottles_per_box || null,
        weightPerBox: product?.gross_weight_kg || null,
        productId: product?.id || null,
      };
    });
  }, [items, productMap]);

  const missingDetails = itemsWithDetails.filter(i => i.productId && (!i.packingUnit || !i.weightPerBox));
  const hasMissing = missingDetails.length > 0;

  // Highlight fields that need filling
  const needsTransporter = !transporter;
  const needsPackaging = !packagingType;
  const hasPendencies = needsTransporter || needsPackaging || hasMissing;

  async function handleSaveLogistics() {
    if (!transporter.trim()) {
      toast({ title: 'Transporter is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesPicklist.update(picklist.id, {
      transporter: transporter.trim(),
      packaging_type: packagingType.trim(),
    });
    // Also update parent sales order
    if (picklist.sales_order_id) {
      await base44.entities.SalesOrder.update(picklist.sales_order_id, {
        transporter: transporter.trim(),
        packaging_type: packagingType.trim(),
      });
    }
    setSaving(false);
    toast({ title: 'Logistics details saved' });
    if (onUpdated) onUpdated();
  }

  function handleProductUpdated() {
    qc.invalidateQueries({ queryKey: ['product-master-weights'] });
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {hasPendencies && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Logistics details pending</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {needsTransporter && 'Transporter not set. '}
              {needsPackaging && 'Packaging type not set. '}
              {hasMissing && `${missingDetails.length} item(s) missing weight/units configuration.`}
            </p>
          </div>
        </div>
      )}

      {/* Transporter + Packaging */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className={`text-xs font-medium flex items-center gap-1 ${needsTransporter ? 'text-amber-700' : 'text-slate-700'}`}>
              <Truck className="w-3 h-3" /> Transporter Name
              {needsTransporter && <span className="text-amber-500">· Required</span>}
            </Label>
            {transporters.length > 0 ? (
              <select className={`mt-1 h-9 w-full rounded-md border px-3 text-sm ${needsTransporter ? 'border-amber-300 bg-amber-50' : 'border-input bg-background'}`}
                value={transporter} onChange={e => setTransporter(e.target.value)}>
                <option value="">Select transporter...</option>
                {transporters.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <Input className={`h-9 text-sm mt-1 ${needsTransporter ? 'border-amber-300 bg-amber-50' : ''}`}
                value={transporter} onChange={e => setTransporter(e.target.value)}
                placeholder="Enter transporter name" />
            )}
          </div>
          <div>
            <Label className={`text-xs font-medium flex items-center gap-1 ${needsPackaging ? 'text-amber-700' : 'text-slate-700'}`}>
              <Package className="w-3 h-3" /> Packaging Type
              {needsPackaging && <span className="text-amber-500">· Recommended</span>}
            </Label>
            {packingTypes.length > 0 ? (
              <select className={`mt-1 h-9 w-full rounded-md border px-3 text-sm ${needsPackaging ? 'border-amber-300 bg-amber-50' : 'border-input bg-background'}`}
                value={packagingType} onChange={e => setPackagingType(e.target.value)}>
                <option value="">Select packaging type...</option>
                {packingTypes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <Input className={`h-9 text-sm mt-1 ${needsPackaging ? 'border-amber-300 bg-amber-50' : ''}`}
                value={packagingType} onChange={e => setPackagingType(e.target.value)}
                placeholder="Enter packaging type" />
            )}
          </div>
        </div>
        {(transporter !== picklist?.transporter || packagingType !== picklist?.packaging_type) && (
          <div className="mt-3 flex justify-end">
            <Button className="h-11 text-sm" onClick={handleSaveLogistics} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Save Logistics Details
            </Button>
          </div>
        )}
      </div>

      {/* Item weight details with Set Now */}
      {hasMissing && (
        <div className="border border-amber-200 rounded-xl overflow-hidden">
          <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Items Missing Weight / Units Configuration</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Item Code</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Description</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Units per Box</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Weight per Box (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missingDetails.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-900">{item.item_code}</td>
                    <td className="px-3 py-2 text-slate-600">{item.description}</td>
                    <td className="px-3 py-2 text-right">
                      {item.packingUnit ? (
                        <span className="text-slate-700">{item.packingUnit}</span>
                      ) : (
                        <SetProductDetailInline
                          productId={item.productId}
                          sku={item.item_code}
                          fieldKey="bottles_per_box"
                          fieldLabel="Units per Box"
                          fieldType="number"
                          onUpdated={handleProductUpdated}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.weightPerBox ? (
                        <span className="text-slate-700">{item.weightPerBox} kg</span>
                      ) : (
                        <SetProductDetailInline
                          productId={item.productId}
                          sku={item.item_code}
                          fieldKey="gross_weight_kg"
                          fieldLabel="Weight per Box (kg)"
                          fieldType="number"
                          onUpdated={handleProductUpdated}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}