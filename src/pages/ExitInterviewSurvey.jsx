import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, Loader2, Star } from 'lucide-react';

const RATING_LABELS = { 1: 'Very Poor', 2: 'Poor', 3: 'Average', 4: 'Good', 5: 'Excellent' };

function RatingPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-11 w-11 md:h-10 md:w-10 rounded-lg border flex items-center justify-center transition-all ${
            value === n
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
          }`}
        >
          <Star className={`w-5 h-5 ${value === n ? 'fill-white' : ''}`} />
        </button>
      ))}
      {value && <span className="text-sm text-slate-600 ml-2">{RATING_LABELS[value]}</span>}
    </div>
  );
}

export default function ExitInterviewSurvey() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    reason_for_leaving: '',
    work_environment_rating: 0,
    management_rating: 0,
    compensation_rating: 0,
    would_recommend: '',
    suggestions: '',
    additional_comments: '',
  });

  // Load token from URL & fetch survey
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (!t) {
      setError('No survey token provided. Please use the link from your invitation email.');
      setLoading(false);
      return;
    }
    base44.functions.invoke('submitExitInterviewSurvey', { action: 'fetch', token: t })
      .then((res) => {
        const data = res.data || res;
        if (data?.error) {
          setError(data.error);
        } else {
          setMeta(data.survey);
          if (data.survey?.already_submitted) setSubmitted(true);
        }
      })
      .catch((err) => setError(err?.response?.data?.error || err.message || 'Failed to load survey'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason_for_leaving.trim()) {
      setError('Please share your reason for leaving.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submitExitInterviewSurvey', {
        action: 'submit',
        token,
        answers: form,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-semibold text-slate-900">Unable to open survey</h2>
            <p className="text-sm text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold text-slate-900">Thank you!</h2>
            <p className="text-sm text-slate-600">
              Your responses have been recorded. We appreciate your feedback and wish you the best.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-slate-900">Exit Interview</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Hello {meta?.candidate_name || ''}, your feedback is confidential and will help us improve.
              Please take a few minutes to complete this short survey.
            </p>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Reason for leaving *</Label>
                <Textarea
                  value={form.reason_for_leaving}
                  onChange={(e) => set('reason_for_leaving', e.target.value)}
                  placeholder="Please describe the main reason..."
                  rows={3}
                  className="text-base md:text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Work environment</Label>
                <RatingPicker value={form.work_environment_rating} onChange={(v) => set('work_environment_rating', v)} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Management & supervisor support</Label>
                <RatingPicker value={form.management_rating} onChange={(v) => set('management_rating', v)} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Compensation & benefits</Label>
                <RatingPicker value={form.compensation_rating} onChange={(v) => set('compensation_rating', v)} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Would you recommend us as an employer?</Label>
                <Select value={form.would_recommend} onValueChange={(v) => set('would_recommend', v)}>
                  <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="Maybe">Maybe</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Suggestions for improvement</Label>
                <Textarea
                  value={form.suggestions}
                  onChange={(e) => set('suggestions', e.target.value)}
                  placeholder="What could we do better?"
                  rows={3}
                  className="text-base md:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Additional comments</Label>
                <Textarea
                  value={form.additional_comments}
                  onChange={(e) => set('additional_comments', e.target.value)}
                  placeholder="Anything else you'd like to share?"
                  rows={3}
                  className="text-base md:text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full text-base"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit Exit Interview
          </Button>
          <p className="text-xs text-slate-500 text-center">
            Your responses are confidential and will only be reviewed by HR.
          </p>
        </form>
      </div>
    </div>
  );
}