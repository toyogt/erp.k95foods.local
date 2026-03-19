import { useEffect } from 'react';
import { createPageUrl } from '@/utils';

// PurchaseGRNHub is now merged into PurchaseOps (Hub tab).
// Redirect any old links automatically.
export default function PurchaseGRNHub() {
  useEffect(() => {
    window.location.replace(createPageUrl('PurchaseOps'));
  }, []);
  return null;
}