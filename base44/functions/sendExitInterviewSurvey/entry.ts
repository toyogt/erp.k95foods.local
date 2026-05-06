import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Generates a secure exit interview survey link for a CandidateLead in 'Terminated' status,
 * stores it in ExitInterviewSurvey, and emails the link to the candidate.
 *
 * Payload: { candidate_lead_id: string, app_origin?: string }
 */
function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { candidate_lead_id, app_origin } = await req.json();
    if (!candidate_lead_id) {
      return Response.json({ error: 'candidate_lead_id is required' }, { status: 400 });
    }

    // Load candidate
    const candidate = await base44.asServiceRole.entities.CandidateLead.get(candidate_lead_id);
    if (!candidate) return Response.json({ error: 'Candidate not found' }, { status: 404 });
    if (candidate.status !== 'Terminated') {
      return Response.json({ error: 'Candidate must be in Terminated status' }, { status: 400 });
    }

    // Check for existing active survey (avoid duplicates)
    const existing = await base44.asServiceRole.entities.ExitInterviewSurvey.filter({
      candidate_lead_id,
      status: 'SENT',
    });
    if (existing.length > 0) {
      return Response.json({
        ok: true,
        message: 'Survey already sent',
        survey_url: existing[0].survey_url,
        survey_id: existing[0].id,
        already_sent: true,
      });
    }

    // Resolve recipient: try Employee email if linked, fall back to candidate.mobile_number as channel note
    let recipient = '';
    if (candidate.employee_id) {
      try {
        const emp = await base44.asServiceRole.entities.Employee.get(candidate.employee_id);
        recipient = emp?.email || '';
      } catch (_) { /* ignore */ }
    }

    // Generate token & expiry (30 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Build public survey URL
    const origin = app_origin || req.headers.get('origin') || req.headers.get('referer') || '';
    const baseUrl = origin.replace(/\/$/, '').split('?')[0].split('#')[0];
    const survey_url = `${baseUrl}/ExitInterviewSurvey?token=${token}`;

    // Create survey record
    const survey = await base44.asServiceRole.entities.ExitInterviewSurvey.create({
      candidate_lead_id,
      candidate_name: candidate.candidate_name,
      employee_code: candidate.employee_code || '',
      token,
      survey_url,
      sent_to: recipient || `Mobile: ${candidate.mobile_number}`,
      sent_at: new Date().toISOString(),
      status: 'SENT',
      expires_at: expiresAt,
    });

    // Send email if we have a recipient email
    if (recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      try {
        await base44.integrations.Core.SendEmail({
          to: recipient,
          subject: 'Your Exit Interview — Your feedback matters',
          body: `Dear ${candidate.candidate_name},

Thank you for your time with us. As part of our offboarding process, we kindly request your feedback through a short exit interview.

Your responses will remain confidential and help us improve.

Please complete the survey here (link valid for 30 days):
${survey_url}

If you have any questions, please reach out to the HR department.

Best regards,
HR Team`,
        });
      } catch (emailErr) {
        console.warn('Email send failed:', emailErr?.message);
      }
    }

    return Response.json({
      ok: true,
      survey_id: survey.id,
      survey_url,
      sent_to: recipient || null,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('sendExitInterviewSurvey error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});