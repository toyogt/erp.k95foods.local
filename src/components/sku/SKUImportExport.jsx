import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';

export default function SKUImportExport({ products, onImportComplete }) {
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState(null);

  const generateTemplate = async () => {
    try {
      // Fetch master data for dropdowns
      const [brands, families, flavours, containers, caps, boxes] = await Promise.all([
        base44.entities.BrandMaster.filter({ is_active: true }).catch(() => []),
        base44.entities.ProductFamilyMaster.filter({ is_active: true }).catch(() => []),
        base44.entities.FlavourMaster.filter({ is_active: true }).catch(() => []),
        base44.entities.ContainerType.list('-created_date', 100).catch(() => []),
        base44.entities.CapType.filter({ is_active: true }).catch(() => []),
        base44.entities.BoxType.filter({ is_active: true }).catch(() => []),
      ]);

      // Build options lists
      const brandOptions = brands.map(b => b.brand_name).join('/');
      const containerOptions = containers.map(c => c.container_type).filter((v, i, a) => a.indexOf(v) === i).join('/');
      const colourOptions = containers.map(c => c.colour).filter((v, i, a) => a.indexOf(v) === i).join('/');
      const capTypeOptions = [...new Set(caps.map(c => c.cap_type))].join('/');
      const capColourOptions = [...new Set(caps.map(c => c.cap_colour))].join('/');

      const headers = [
        'brand_name',
        'product_family',
        'flavour',
        'ml_per_bottle',
        'bottles_per_box',
        'mrp',
        'gross_weight_kg',
        'shelf_life_days',
        'is_trial_pack',
        'container_type',
        'colour',
        'cap_type',
        'cap_colour',
        'hsn_code',
        'swiggy_item_id',
        'bigbasket_item_id',
        'zepto_item_id',
        'amazon_item_id'
      ];

      const optionsRow = [
        brandOptions || 'Brand1/Brand2/Brand3',
        'Family is auto-filtered by brand after upload',
        'Flavour is auto-filtered by brand+family after upload',
        '250/330/500/750/1000',
        '6/12/24',
        '25/30/35/40/50',
        '3.5/4.0/5.5',
        '180/365',
        'TRUE/FALSE',
        containerOptions || 'Glass Bottle/Can',
        colourOptions || 'Transparent/Amber',
        capTypeOptions || 'Crown Cap/Flip-Top Cap',
        capColourOptions || 'Gold/Silver/Red/Blue',
        'e.g. 22021090 (HSN/SAC)',
        'Swiggy platform item ID',
        'BigBasket platform item ID',
        'Zepto platform item ID',
        'Amazon ASIN'
      ];

      const exampleRow = [
        brands[0]?.brand_name || 'Example Brand',
        families[0]?.family_name || 'Beverages',
        flavours[0]?.flavour_name || 'Sweet Orange',
        '250',
        '12',
        '50',
        '3.5',
        '180',
        'FALSE',
        containers[0]?.container_type || 'Glass Bottle',
        containers[0]?.colour || 'Transparent',
        caps[0]?.cap_type || 'Crown Cap',
        caps[0]?.cap_colour || 'Gold',
        '22021090',
        '',
        '',
        '',
        ''
      ];

      const csv = [
        headers.join(','),
        '# OPTIONS: ' + optionsRow.join(','),
        exampleRow.join(',')
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sku_import_template.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Smart template downloaded with options');
    } catch (error) {
      console.error('Template generation error:', error);
      toast.error('Failed to generate template');
    }
  };

  const exportSKUs = () => {
    if (products.length === 0) {
      toast.error('No SKUs to export');
      return;
    }

    const headers = [
      'item_code',
      'brand_name',
      'product_family',
      'product_name',
      'flavour',
      'ml_per_bottle',
      'bottles_per_box',
      'mrp',
      'gross_weight_kg',
      'shelf_life_days',
      'is_trial_pack',
      'is_active',
      'hsn_code',
      'swiggy_item_id',
      'bigbasket_item_id',
      'zepto_item_id',
      'amazon_item_id'
    ];

    const rows = products.map(p => [
      p.item_code || '',
      p.brand_name || '',
      p.product_family || '',
      p.product_name || '',
      p.flavour || '',
      p.ml_per_bottle || '',
      p.bottles_per_box || '',
      p.mrp || '',
      p.gross_weight_kg || '',
      p.shelf_life_days || '',
      p.is_trial_pack ? 'TRUE' : 'FALSE',
      p.is_active ? 'TRUE' : 'FALSE',
      p.hsn_code || '',
      p.swiggy_item_id || '',
      p.bigbasket_item_id || '',
      p.zepto_item_id || '',
      p.amazon_item_id || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sku_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${products.length} SKUs`);
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    // Proper CSV parser handling quoted fields
    const parseLine = (line) => {
      const vals = [];
      let cur = '', inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      vals.push(cur.trim());
      return vals;
    };
    return lines.slice(1).map(line => {
      const vals = parseLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    }).filter(r => Object.values(r).some(v => v !== ''));
  };

  const handleImport = async () => {
    if (!file) { toast.error('Please select a file'); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('No valid rows found in CSV');
        setImporting(false);
        return;
      }

      // Build lookup of existing product codes for upsert
      const existingMap = {};
      (products || []).forEach(p => { existingMap[p.item_code] = p.id; });

      const toCreate = [];
      const toUpdate = []; // { id, data }

      rows.forEach(row => {
        const prefix = (row.brand_name || 'SK').substring(0, 2).toUpperCase();
        const familyCode = (row.product_family || 'XXX').substring(0, 3).toUpperCase();
        const ml = row.ml_per_bottle || '000';
        const btl = row.bottles_per_box || '00';
        // If item_code is provided in CSV use it directly, otherwise auto-generate
        const itemCode = row.item_code?.trim() || `${prefix}-${familyCode}-${ml}ML-${btl}PC`;

        const bottleType = (row.container_type && row.colour && row.ml_per_bottle)
          ? `${row.container_type} ${row.colour} ${row.ml_per_bottle}ML` : '';
        const capSku = (row.cap_type && row.cap_colour)
          ? `CAP-${row.cap_type.replace(/\s+/g, '-').toUpperCase()}-${row.cap_colour.toUpperCase()}` : '';

        const data = {
          item_code: itemCode,
          brand_name: row.brand_name || '',
          product_family: row.product_family || '',
          product_name: row.product_name || '',
          flavour: row.flavour || '',
          ...(row.ml_per_bottle ? { ml_per_bottle: Number(row.ml_per_bottle) } : {}),
          ...(row.bottles_per_box ? { bottles_per_box: Number(row.bottles_per_box) } : {}),
          ...(row.mrp ? { mrp: Number(row.mrp) } : {}),
          ...(row.gross_weight_kg ? { gross_weight_kg: Number(row.gross_weight_kg) } : {}),
          ...(row.shelf_life_days ? { shelf_life_days: Number(row.shelf_life_days) } : {}),
          is_trial_pack: String(row.is_trial_pack).toUpperCase() === 'TRUE',
          ...(bottleType ? { bottle_type: bottleType } : {}),
          ...(capSku ? { cap_sku_code: capSku } : {}),
          hsn_code: row.hsn_code || '',
          swiggy_item_id: row.swiggy_item_id || '',
          bigbasket_item_id: row.bigbasket_item_id || '',
          zepto_item_id: row.zepto_item_id || '',
          amazon_item_id: row.amazon_item_id || '',
        };

        const existingId = existingMap[itemCode];
        if (existingId) {
          toUpdate.push({ id: existingId, data });
        } else {
          toCreate.push({ ...data, is_active: false });
        }
      });

      // Run creates and updates in parallel
      await Promise.all([
        toCreate.length > 0 ? base44.entities.ProductMaster.bulkCreate(toCreate) : Promise.resolve(),
        ...toUpdate.map(({ id, data }) => base44.entities.ProductMaster.update(id, data)),
      ]);

      const msg = [];
      if (toCreate.length) msg.push(`${toCreate.length} created`);
      if (toUpdate.length) msg.push(`${toUpdate.length} updated`);
      toast.success(`Product Codes imported: ${msg.join(', ')}`, { duration: 5000 });
      setShowImport(false);
      setFile(null);
      onImportComplete?.();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={generateTemplate} variant="outline" size="sm">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Download Template
        </Button>
        <Button onClick={() => setShowImport(true)} variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Import SKUs
        </Button>
        <Button onClick={exportSKUs} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export SKUs
        </Button>
      </div>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import SKUs from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Smart Import</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>SKU codes auto-generated from brand, family, ml, and bottle count</li>
                    <li>Bottle type auto-generated from container type, colour, and ml</li>
                    <li>Cap SKU auto-generated from cap type and colour</li>
                    <li>All imported SKUs start as inactive</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowImport(false)}
                variant="outline"
                className="flex-1"
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                className="flex-1"
                disabled={!file || importing}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}