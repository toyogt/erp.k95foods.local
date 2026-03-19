/**
 * Audit Panel
 * Created by/date, updated by/date
 */

import { format } from 'date-fns';

export default function AuditPanel({
  createdDate,
  createdBy,
  updatedDate = null,
  updatedBy = null,
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-slate-600 font-medium">Created</p>
          <p className="text-slate-900">{format(new Date(createdDate), 'MMM d, yyyy HH:mm')}</p>
          {createdBy && (
            <p className="text-slate-600">{createdBy}</p>
          )}
        </div>

        {updatedDate && (
          <div>
            <p className="text-slate-600 font-medium">Last Updated</p>
            <p className="text-slate-900">{format(new Date(updatedDate), 'MMM d, yyyy HH:mm')}</p>
            {updatedBy && (
              <p className="text-slate-600">{updatedBy}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}