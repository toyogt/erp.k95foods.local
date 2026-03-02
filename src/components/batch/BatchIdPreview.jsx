import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPeriodKey, peekNextSequence, nextSequence, renderBatchId } from './batchIdEngine';
import { Loader2, Eye, Zap } from 'lucide-react';

export default function BatchIdPreview({ rule, onClose, user }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [skuCode, setSkuCode] = useState('');
  const [preview, setPreview] = useState('');
  const [previewSeq, setPreviewSeq] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sku, setSku] = useState(null);

  const isAdmin = user?.role === 'admin';

  // Fetch SKU data when sku_code changes
  useEffect(() => {
    if (!skuCode) {
      setSku(null);
      return;
    }
    const loadSku = async () => {
      try {
        const products = await base44.entities.ProductMaster.filter({ item_code: skuCode });
        setSku(products[0] || null);
      } catch {
        setSku(null);
      }
    };
    loadSku();
  }, [skuCode]);

  const handlePreview = async () => {
    if (!skuCode || !rule?.rule_id || !rule?.format_json) {
      alert('Please fill in SKU Code');
      return;
    }
    setLoading(true);
    try {
      const date = new Date(selectedDate);
      const resetScope = 'DAILY'; // Default; could be parameterized
      const periodKey = getPeriodKey(date, resetScope);
      const seq = await peekNextSequence(rule.rule_id, skuCode, periodKey);
      const batchId = renderBatchId({ rule, sku: sku || { item_code: skuCode }, date, seq });
      setPreview(batchId);
      setPreviewSeq(seq);
    } catch (err) {
      alert('Error: ' + err.message);
      setPreview('');
      setPreviewSeq(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTest = async () => {
    if (!isAdmin) {
      alert('Only admins can generate test batch IDs');
      return;
    }
    if (!skuCode || !rule?.rule_id || !rule?.format_json) {
      alert('Please fill in SKU Code');
      return;
    }
    setGenerating(true);
    try {
      const date = new Date(selectedDate);
      const resetScope = 'DAILY'; // Default
      const periodKey = getPeriodKey(date, resetScope);
      const seq = await nextSequence(rule.rule_id, skuCode, periodKey);
      const batchId = renderBatchId({ rule, sku: sku || { item_code: skuCode }, date, seq });
      setPreview(batchId);
      setPreviewSeq(seq);
    } catch (err) {
      alert('Error: ' + err.message);
      setPreview('');
      setPreviewSeq(null);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <h3 className="font-semibold text-slate-800">Preview Batch ID</h3>
      <p className="text-xs text-slate-500">Rule: <code className="font-mono bg-slate-100 px-1 rounded">{rule?.rule_id}</code></p>

      <div className="space-y-2">
        <div>
          <Label className="text-xs font-semibold">Date</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-sm" />
        </div>

        <div>
          <Label className="text-xs font-semibold">SKU Code</Label>
          <Input
            placeholder="e.g., PROD001"
            value={skuCode}
            onChange={e => setSkuCode(e.target.value)}
            className="text-sm"
          />
          {sku && (
            <p className="text-xs text-slate-500 mt-1">
              Found: {sku.product_name} {sku.batch_prefix && `(prefix: ${sku.batch_prefix})`}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePreview}
          disabled={loading || !skuCode}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Preview
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            onClick={handleGenerateTest}
            disabled={generating || !skuCode}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate Test
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {preview && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Batch ID</p>
          <p className="font-mono font-bold text-lg text-slate-800">{preview}</p>
          {previewSeq !== null && (
            <p className="text-xs text-slate-400 mt-1">Seq: {previewSeq}</p>
          )}
        </div>
      )}
    </div>
  );
}