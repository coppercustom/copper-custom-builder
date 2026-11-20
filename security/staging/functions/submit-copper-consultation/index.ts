
import { createClient } from 'npm:@supabase/supabase-js@2';

import { gatewayIp, limiterHash } from '../_shared/security.ts';

const ALLOWED_ORIGINS = new Set([
  'https://coppercustom.com',
  'https://www.coppercustom.com'
]);

const MAX_BODY_BYTES = 30_000;
const SENDER = 'sales@coppercustom.com';

function response(
  origin: string,
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      ...(status === 429 ? { 'Retry-After': '300' } : {}),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type'
    }
  });
}

function clean(value: unknown, max: number) {
  return typeof value === 'string'
    ? value.trim().slice(0, max)
    : '';
}

function validAnswers(
  value: unknown
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false;

  const v = value as Record<string, unknown>;

  if (
    v.schema_version !== 1 ||
    !v.selections ||
    typeof v.selections !== 'object' ||
    Array.isArray(v.selections)
  ) return false;

  const s = v.selections as Record<string, unknown>;

  return (
    ['Rifle', 'Pistol', 'Shotgun'].includes(String(s.category)) &&
    !!s.purpose &&
    !!s.budget &&
    !!s.primary &&
    !!s.optics &&
    !!s.suppressors &&
    !!s.extras
  );
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 250);
}

function formatSummary(answers: Record<string, unknown>): string {
  const summary = answers.summary;

  if (!Array.isArray(summary)) {
    return JSON.stringify(answers.selections, null, 2);
  }

  return summary.map((row: unknown) => {
    if (!row || typeof row !== 'object') return '';

    const item = row as Record<string, unknown>;

    return `${String(item.label ?? '')}: ${String(item.value ?? '')}`;
  }).filter(Boolean).join('\n');
}

async function readSubmission(req: Request): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function sendConsultationEmail(details: {
  reference: string;
  name: string;
  email: string;
  phone: string;
  method: string;
  weaponClass: string;
  answers: Record<string, unknown>;
}) {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_GMAIL_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail credentials are not configured');
  }

  const tokenResponse = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }),
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(`Google token request failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error('Google did not provide an access token');
  }

  const representative = details.answers.representative_preference;

  let representativeText = 'No preference';

  if (representative && typeof representative === 'object') {
    const rep = representative as Record<string, unknown>;
    representativeText = String(rep.choice ?? 'No preference');

    if (rep.requested_name) {
      representativeText += ` - ${String(rep.requested_name)}`;
    }
  }

  const subject = safeHeader(
    `Custom Build Submission - ${details.reference}`
  );

  const body = [
    'NEW COPPER CUSTOM BUILD CONSULTATION',
    '',
    `Reference: ${details.reference}`,
    '',
    'CUSTOMER INFORMATION',
    '------------------------------',
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    `Phone: ${details.phone}`,
    `Preferred Contact Method: ${details.method}`,
    `Representative Preference: ${representativeText}`,
    '',
    'BUILD INFORMATION',
    '------------------------------',
    `Weapon Class: ${details.weaponClass}`,
    '',
    formatSummary(details.answers),
    '',
    '------------------------------',
    'This consultation has been saved in the',
    'Copper Custom employee dashboard.',
    '',
    'Automated notification from Copper Custom.'
  ].join('\r\n');

  const salesMessage = [
    `From: Copper Custom Notifications <${SENDER}>`,
    `To: ${SENDER}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body
  ].join('\r\n');

  const sends = [
    sendGmailMessage(tokenData.access_token, salesMessage).catch(() => {
      console.error('consultation_notification_failed');
    })
  ];

  // Accept one bare mailbox. Never pass address lists or display names into the header.
  const recipient = details.email;
  const singleMailbox = /^[a-z0-9_+%-]+(?:\.[a-z0-9_+%-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (Deno.env.get('SEND_CUSTOMER_CONSULTATION_SUMMARY') === 'true' &&
      singleMailbox.test(recipient) && recipient.split('@')[0].length <= 64) {
    const customerBody = [
      'Thank you for reaching out to Copper Custom. We’ve received your consultation request and look forward to hearing more about what you have in mind.',
      '',
      'A member of our team will review the details you shared and follow up using your preferred contact method. For your records, we’ve included a copy of your submission below.',
      '',
      `Reference: ${details.reference}`,
      `Build category: ${details.weaponClass}`,
      `Preferred contact method: ${details.method}`,
      '',
      'Your consultation details',
      '------------------------------',
      formatSummary(details.answers),
      '',
      'If anything changes or you’d like to add a detail, simply reply to this email. We’ll include it in your consultation.',
      '',
      'Best regards,',
      'The Copper Custom Team',
      '',
      'If you didn’t submit this request, you can disregard this email.'
    ].join('\r\n');
    const customerMessage = [
      `From: Copper Custom <${SENDER}>`,
      `To: ${recipient}`,
      `Reply-To: ${SENDER}`,
      'Subject: Your Copper Custom consultation',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      customerBody
    ].join('\r\n');
    sends.push(sendGmailMessage(tokenData.access_token, customerMessage).catch(() => {
      console.error('consultation_customer_confirmation_failed');
    }));
  }

  await Promise.all(sends);
}

async function sendGmailMessage(accessToken: string, message: string) {
  const sendResponse = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodeBase64Url(message)
      }),
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!sendResponse.ok) {
    throw new Error(`Gmail send failed: ${sendResponse.status}`);
  }
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';

  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type'
      }
    });
  }

  if (req.method !== 'POST') {
    return response(origin, { error: 'Method not allowed' }, 405);
  }

  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return response(origin, { error: 'Request too large' }, 413);
  }

  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const salt = Deno.env.get('CONSULTATION_RATE_LIMIT_SALT');

  if (!turnstileSecret || !supabaseUrl || !serviceRoleKey || !salt || salt.length < 32) {
    return response(
      origin,
      { error: 'Submission service is not configured' },
      503
    );
  }

  try {
    const raw = await readSubmission(req);

    if (raw === null) {
      return response(origin, { error: 'Request too large' }, 413);
    }

    const p = JSON.parse(raw);

    const name = clean(p.customer_name, 120);
    const email = clean(p.customer_email, 254).toLowerCase();
    const phone = clean(p.customer_phone, 40);
    const method = clean(p.preferred_contact_method, 10);
    const weaponClass = clean(p.weapon_class, 20);

    if (
      name.length < 2 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !/^\+?[\d\s().-]+$/.test(phone) ||
      phone.replace(/\D/g, '').length < 10 ||
      phone.replace(/\D/g, '').length > 15 ||
      !['Email', 'Phone'].includes(method) ||
      !['Rifle', 'Pistol', 'Shotgun'].includes(weaponClass)
    ) {
      return response(
        origin,
        { error: 'Please provide valid contact details' },
        400
      );
    }

    if (
      !validAnswers(p.answers) ||
      (p.answers.selections as Record<string, unknown>).category !== weaponClass
    ) {
      return response(
        origin,
        { error: 'Incomplete consultation answers' },
        400
      );
    }

    const token = clean(p.turnstile_token, 2048);

    if (!token) {
      return response(origin, { error: 'Verification is required' }, 400);
    }

    const challenge = new FormData();
    challenge.set('secret', turnstileSecret);
    challenge.set('response', token);

    const ip = gatewayIp(req.headers, Deno.env.get('TRUST_MANAGED_GATEWAY_IP') === 'true');
    const db = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    try {
      const clientHash = await limiterHash(ip, salt);
      const { data: allowed, error } = await db.rpc('cc_allow_public_request', {
        p_scope: 'consultation',
        p_client_hash: clientHash
      }).abortSignal(AbortSignal.timeout(5000));

      if (error || typeof allowed !== 'boolean') throw new Error('limiter_unavailable');
      if (!allowed) {
        console.warn('consultation_rate_limited', ip === null ? 'shared' : 'gateway');
        return response(origin, { error: 'Too many requests. Try again shortly.' }, 429);
      }
    } catch {
      console.error('consultation_limiter_unavailable');
      return response(origin, { error: 'Submission service unavailable' }, 503);
    }

    if (ip) challenge.set('remoteip', ip);

    let verdict;
    try {
      const check = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: challenge,
          signal: AbortSignal.timeout(5000)
        }
      );
      if (!check.ok) throw new Error('verification_http_error');
      verdict = await check.json();
      if (!verdict || typeof verdict.success !== 'boolean') {
        throw new Error('verification_invalid_response');
      }
    } catch {
      console.error('consultation_verification_unavailable');
      return response(origin, { error: 'Verification service unavailable' }, 503);
    }

    if (
      !verdict.success ||
      !verdict.hostname ||
      !['coppercustom.com', 'www.coppercustom.com'].includes(verdict.hostname)
    ) {
      return response(
        origin,
        { error: 'Verification failed. Please try again.' },
        403
      );
    }

    const { data, error } = await db
      .from('cc_consultations')
      .insert({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        weapon_class: weaponClass,
        status: 'New',
        answers: {
          ...p.answers,
          preferred_contact_method: method
        }
      })
      .select('id')
      .single();

    if (error) {
      console.error(
        'Consultation insert failed:',
        error.code
      );

      return response(
        origin,
        { error: 'Unable to save the consultation. Please try again.' },
        503
      );
    }

    // Database save succeeded. Attempt notification separately.
    try {
      await sendConsultationEmail({
        reference: String(data.id),
        name,
        email,
        phone,
        method,
        weaponClass,
        answers: p.answers
      });
    } catch {
      // Never fail a saved consultation because email failed.
      console.error('consultation_notification_failed');
    }

    return response(
      origin,
      {
        success: true,
        reference: data.id
      },
      201
    );

  } catch {
    console.warn('consultation_invalid_request');

    return response(
      origin,
      { error: 'Unable to process submission' },
      400
    );
  }
});
