import { createClient } from 'npm:@supabase/supabase-js@2';
import { reportCss, reportMarkup } from './report.ts';

const env = (name: string) => Deno.env.get(name) || '';
const allowed = new Set(['https://coppercustom.com', 'https://www.coppercustom.com',
  ...env('ATOMIC_ASSURANCE_ALLOWED_ORIGINS').split(',').map(value => value.trim()).filter(Boolean)]);

function base64(value: string) {
  let binary = '';
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
  const respond = (status: number, message: string) =>
    Response.json(status === 200 ? { success: true } : { error: message }, { status, headers });
  if (origin && !allowed.has(origin)) return respond(403, 'Origin is not allowed.');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond(405, 'Use POST.');
  const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return respond(401, 'Sign in first.');

  try {
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return respond(401, 'Sign in again.');
    const { data: staff } = await db.from('cc_staff').select('user_id')
      .eq('user_id', auth.user.id).eq('active', true).maybeSingle();
    if (!staff) return respond(403, 'Active staff access is required.');
    const { id, revision } = await req.json();
    if (typeof id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id) ||
        !Number.isSafeInteger(revision) || revision < 1) return respond(400, 'Invalid report reference.');

    const { data: row, error } = await db.from('cc_atomic_assurance_reports')
      .select('*, cc_consultations!inner(customer_name, customer_email, answers, trashed_at)')
      .eq('consultation_id', id).eq('revision', revision).maybeSingle();
    if (error) return respond(500, 'Unable to load the saved report.');
    const customer = row?.cc_consultations;
    if (!row || !customer || customer.trashed_at || customer.answers?.documentation_package_requested !== true) {
      return respond(409, 'Reopen the consultation and confirm the current report.');
    }
    if (!/^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/.test(customer.customer_email) ||
        /[\r\n]/.test(customer.customer_email)) return respond(422, 'The customer email address is invalid.');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
        client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
        refresh_token: env('GOOGLE_GMAIL_REFRESH_TOKEN'),
        grant_type: 'refresh_token'
      })
    });
    if (!tokenResponse.ok) return respond(502, 'Could not connect to the report mail account.');
    const accessToken = (await tokenResponse.json()).access_token;
    const html = '<!doctype html><html><meta charset="utf-8"><style>'+reportCss+'</style>'+
      reportMarkup(customer.customer_name,row)+'</html>';
    const encoded = base64(html).match(/.{1,76}/g)?.join('\r\n');
    const mime = [
      'To: '+customer.customer_email,'Subject: Your Copper Custom Atomic Assurance Build Report',
      'MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64','',encoded
    ].join('\r\n');
    const sent = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer '+accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: base64(mime).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') })
    });
    return sent.ok ? respond(200,'') : respond(502,'The mail provider did not confirm delivery.');
  } catch {
    return respond(500,'Unable to send the report. Check sent mail before retrying.');
  }
});
