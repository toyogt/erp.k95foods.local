import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied({ page }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-600">
            You don't have permission to access this page.
          </p>
          {page && (
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-mono bg-slate-100 px-2 py-1 rounded">{page}</span>
            </p>
          )}
        </div>

        <div className="space-y-2 pt-4">
          <Button 
            onClick={() => navigate('/')}
            className="w-full h-11"
          >
            Go to Dashboard
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full h-11"
          >
            Go Back
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          If you believe this is an error, contact your administrator.
        </p>
      </div>
    </div>
  );
}