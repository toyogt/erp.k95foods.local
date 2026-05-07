/**
 * Error Boundary
 * Catches errors and shows fallback UI
 */

import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/Dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
          <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h2>
              <p className="text-sm text-slate-600">
                An unexpected error occurred. Please try again or return to the dashboard.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-left">
                <p className="text-xs font-mono text-red-600 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Retry
              </Button>
              <Button
                onClick={this.handleReset}
                className="flex-1 bg-slate-900 hover:bg-slate-800"
              >
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}