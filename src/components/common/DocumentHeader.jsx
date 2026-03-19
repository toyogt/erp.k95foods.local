/**
 * Document Header
 * Reusable header for any document (order, dispatch, transfer, etc.)
 */

import { Edit, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function DocumentHeader({
  code,
  title,
  status,
  date,
  note,
  onEdit,
  canEdit = false,
  statusColor = 'bg-slate-100 text-slate-700',
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-xs text-slate-600 font-medium">Document</p>
          <h1 className="text-2xl font-bold text-slate-900">{code}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={statusColor}>
            {status}
          </Badge>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex items-center gap-1"
            >
              <Edit className="w-3 h-3" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{title}</span>
        </div>

        {date && (
          <p className="text-slate-600">
            <span className="font-medium">{format(new Date(date), 'MMM d, yyyy HH:mm')}</span>
          </p>
        )}

        {note && (
          <div className="flex gap-2 p-2 bg-blue-50 rounded border border-blue-200 mt-3">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-blue-700">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
}