import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Public, token-validated endpoint that accepts an exit interview submission.
 * - Validates the token + expiry
 * - Saves responses to ExitInterviewSurvey
 * - Auto-populates CandidateLead.exit_feedback with a formatted summary
 * - Notifies the HR manager (HRNotificationConfig.hr_emails)
 *
 * Two modes:
 *   GET-style:  payload { action: 'fetch', token }            → returns minimal survey context
 *   POST-style: payload { action: 'submit', token, answers }  → submits the survey
 */

function buildFeedbackSummary(answers, existingFeedback) {
  const lines = [];
  if (answers.reason_for_leaving) lines.push(`Reason: ${answers.reason_for_leaving}`);
  if (answers.work_environment_rating) lines.push(`Work environment: ${answers.work_environment_rating}/5`);
  if (answers.management_rating) lines.push(`Management: ${answers.management_rating}/5`);
  if (answers.compensation_rating) lines.push(`Compensation: ${answers.compensation_rating}/5`);
  if (answers.would_recommend) lines.push(`Would recommend: ${answers.would_recommend}`);
  if (answers.suggestions) lines.push(`Suggestions: ${answers.suggestions}`);
  if (answers.additional_comments) lines.push(`Comments: ${answers.additional_comments}`);
  const submittedOn = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  const block = `[Exit Interview submitted on ${submittedOn}]\n${lines.join('\n')}`;
  if (existingFeedback && existingFeedback.trim()) {
    return `${existingFeedback.trim()}\n\n${block}`;
  }
  return block;
}

Deno.serve(async (req) => {
  try {
    // Public endpoint — no user auth required, but we use service role
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, token } = body || {};

    if (!token || typeof token !== 'string' || token.length < 16) {
      return Response.json({ error: 'Invalid or missing token' }, { status: 400 });
    }

    // Look up survey by token
    const surveys = await base44.asServiceRole.entities.ExitInterviewSurvey.filter({ token });
    const survey = surveys[0];
    if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });

    // Expiry check
    if (survey.expires_at && new Date(survey.expires_at).getTime() < Date.now()) {
      if (survey.status !== 'EXPIRED') {
        await base44.asServiceRole.entities.ExitInterviewSurvey.update(survey.id, { status: 'EXPIRED' });
      }
      return Response.json({ error: 'This survey link has expired' }, { status: 410 });
    }

    // ─── FETCH ───
    if (action === 'fetch') {
      // Mark as opened on first fetch
      if (survey.status === 'SENT') {
        await base44.asServiceRole.entities.ExitInterviewSurvey.update(survey.id, { status: 'OPENED' });
      }
      return Response.json({
        ok: true,
        survey: {
          candidate_name: survey.candidate_name,
          status: survey.status === 'SENT' ? 'OPENED' : survey.status,
          already_submitted: survey.status === 'SUBMITTED',
        },
      });
    }

    // ─── SUBMIT ───
    if (action === 'submit') {
      if (survey.status === 'SUBMITTED') {
        return Response.json({ error: 'This survey has already been submitted' }, { status: 409 });
      }

      const answers = body.answers || {};
      const submittedAt = new Date().toISOString();

      // Update survey record
      await base44.asServiceRole.entities.ExitInterviewSurvey.update(survey.id, {
        status: 'SUBMITTED',
        submitted_at: submittedAt,
        reason_for_leaving: answers.reason_for_leaving || '',
        work_environment_rating: Number(answers.work_environment_rating) || undefined,
        management_rating: Number(answers.management_rating) || undefined,
        compensation_rating: Number(answers.compensation_rating) || undefined,
        would_recommend: answers.would_recommend || '',
        suggestions: answers.suggestions || '',
        additional_comments: answers.additional_comments || '',
      });

      // Auto-populate CandidateLead.exit_feedback
      let candidate = null;
      try {
        candidate = await base44.asServiceRole.entities.CandidateLead.get(survey.candidate_lead_id);
        const updatedFeedback = buildFeedbackSummary(answers, candidate?.exit_feedback || '');
        await base44.asServiceRole.entities.CandidateLead.update(survey.candidate_lead_id, {
          exit_feedback: updatedFeedback.slice(0, 2000),
        });
      } catch (err) {
        console.warn('Failed to update CandidateLead.exit_feedback:', err?.message);
      }

      // Alert HR manager(s)
      let hrAlerted = false;
      try {
        const configs = await base44.asServiceRole.entities.HRNotificationConfig.filter({ config_key: 'DEFAULT' });
        const hrEmails = (configs[0]?.hr_emails || []).filter((e) => e && e.includes('@'));
        if (hrEmails.length > 0) {
          const subject = `Exit Interview Submitted — ${survey.candidate_name}`;
          const ratingLine = (label, val) => val ? `${label}: ${val}/5` : '';
          const bodyLines = [
            `An exit interview has been submitted.`,
            ``,
            `Candidate: ${survey.candidate_name}`,
            survey.employee_code ? `Employee Code: ${survey.employee_code}` : '',
            `Submitted: ${new Date(submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Calcutta' })}`,
            ``,
            `── Responses ──`,
            answers.reason_for_leaving ? `Reason for leaving: ${answers.reason_for_leaving}` : '',
            ratingLine('Work environment', answers.work_environment_rating),
            ratingLine('Management', answers.management_rating),
            ratingLine('Compensation', answers.compensation_rating),
            answers.would_recommend ? `Would recommend: ${answers.would_recommend}` : '',
            answers.suggestions ? `\nSuggestions:\n${answers.suggestions}` : '',
            answers.additional_comments ? `\nAdditional comments:\n${answers.additional_comments}` : '',
            ``,
            `Please review in HR → Candidate Leads.`,
          ].filter(Boolean);
          for (const to of hrEmails) {
            try {
              await base44.integrations.Core.SendEmail({
                to,
                subject,
                body: bodyLines.join('\n'),
              });
            } catch (e) { console.warn(`HR email to ${to} failed:`, e?.message); }
          }
          hrAlerted = true;
          await base44.asServiceRole.entities.ExitInterviewSurvey.update(survey.id, {
            hr_alerted: true,
            hr_alerted_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('HR alert failed:', err?.message);
      }

      return Response.json({ ok: true, hr_alerted: hrAlerted, submitted_at: submittedAt });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('submitExitInterviewSurvey error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});