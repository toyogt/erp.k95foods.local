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
        'cap_colour'
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
        capColourOptions || 'Gold/Silver/Red/Blue'
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
        caps[0]?.cap_colour || 'Gold'
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
      'is_active'
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
      p.is_active ? 'TRUE' : 'FALSE'
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

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            brand_name: { type: 'string' },
            product_family: { type: 'string' },
            product_name: { type: 'string' },
            flavour: { type: 'string' },
            ml_per_bottle: { type: 'number' },
            bottles_per_box: { type: 'number' },
            mrp: { type: 'number' },
            gross_weight_kg: { type: 'number' },
            shelf_life_days: { type: 'number' },
            is_trial_pack: { type: 'boolean' },
            container_type: { type: 'string' },
            colour: { type: 'string' },
            cap_type: { type: 'string' },
            cap_colour: { type: 'string' }
          }
        }
      };

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      if (extractResult.status === 'error') {
        toast.error(extractResult.details || 'Failed to extract data from file');
        setImporting(false);
        return;
      }

      const rows = extractResult.output;
      let created = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          // Auto-generate SKU code
          const prefix = row.brand_name?.substring(0, 2).toUpperCase() || 'SK';
          const familyCode = row.product_family?.substring(0, 3).toUpperCase() || 'XXX';
          const mlCode = row.ml_per_bottle || '000';
          const btlCode = row.bottles_per_box || '00';
          const itemCode = `${prefix}-${familyCode}-${mlCode}ML-${btlCode}PC`;

          // Auto-generate bottle type name
          let bottleType = '';
          if (row.container_type && row.colour && row.ml_per_bottle) {
            bottleType = `${row.container_type} ${row.colour} ${row.ml_per_bottle}ML`;
          }

          // Auto-generate cap SKU
          let capSku = '';
          if (row.cap_type && row.cap_colour) {
            capSku = `CAP-${row.cap_type.replace(/\s+/g, '-').toUpperCase()}-${row.cap_colour.toUpperCase()}`;
          }

          await base44.entities.ProductMaster.create({
            item_code: itemCode,
            brand_name: row.brand_name,
            product_family: row.product_family,
            product_name: row.product_name,
            flavour: row.flavour,
            ml_per_bottle: row.ml_per_bottle,
            bottles_per_box: row.bottles_per_box,
            mrp: row.mrp,
            gross_weight_kg: row.gross_weight_kg,
            shelf_life_days: row.shelf_life_days,
            is_trial_pack: row.is_trial_pack || false,
            bottle_type: bottleType,
            cap_sku_code: capSku,
            is_active: false
          });
          created++;
        } catch (err) {
          console.error('Failed to create SKU:', err);
          errors++;
        }
      }

      toast.success(`Imported ${created} SKUs${errors > 0 ? `, ${errors} errors` : ''}`, { duration: 5000 });
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