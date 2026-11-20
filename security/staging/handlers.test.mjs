import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { gatewayIp, limiterHash } from './functions/_shared/security.ts';

const env = new Map(Object.entries({
  SUPABASE_URL: 'https://db.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture',
  SUPABASE_SECRET_KEYS: '{"default":"sb_secret_fixture"}',
  BUILDER_RATE_LIMIT_SALT: 'search-fixture-salt'.repeat(2),
  CONSULTATION_RATE_LIMIT_SALT: 'consultation-fixture-salt'.repeat(2),
  TURNSTILE_SECRET_KEY: 'fixture',
  TRUST_MANAGED_GATEWAY_IP: 'true',
  GOOGLE_OAUTH_CLIENT_ID: 'fixture',
  GOOGLE_OAUTH_CLIENT_SECRET: 'fixture',
  GOOGLE_GMAIL_REFRESH_TOKEN: 'fixture',
}));
const origin = 'https://coppercustom.com';
let handler;
let permit;
let verdict;
let calls;
let verification;
let notification;
let stored;

globalThis.Deno = { env: { get: key => env.get(key) }, serve: fn => { handler = fn; } };
globalThis.copperTestClient = {
  rpc(name, params) {
    calls.push([name, params]);
    return { abortSignal: signal => {
      assert.ok(signal instanceof AbortSignal);
      return { data: permit };
    } };
  },
  from(table) {
    assert.equal(table, 'cc_consultations');
    return { insert: data => {
      stored.push(data);
      return { select: () => ({ single: () => ({ data: { id: 'synthetic-id' } }) }) };
    } };
  },
};

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'npm:@supabase/supabase-js@2') {
      return { url: 'data:text/javascript,export const createClient=()=>globalThis.copperTestClient', shortCircuit: true };
    }
    return next(specifier, context);
  },
});
await import('./functions/submit-copper-consultation/index.ts');
const intake = handler;
await import('./functions/public-lipseys-search/index.ts');
const search = handler;
hooks.deregister();

const actualTimeout = AbortSignal.timeout;
AbortSignal.timeout = ms => actualTimeout.call(AbortSignal, Math.min(ms, 30));
const keepAlive = setInterval(() => {}, 1000);
test.after(() => { clearInterval(keepAlive); AbortSignal.timeout = actualTimeout; });
const abortingFetch = signal => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});

globalThis.fetch = async (url, init) => {
  const target = new URL(url);
  if (target.hostname === 'db.invalid') {
    if (target.pathname.endsWith('/cc_allow_public_request')) {
      calls.push(['cc_allow_public_request', JSON.parse(init.body)]);
      return Response.json(permit);
    }
    assert.ok(target.pathname.startsWith('/rest/v1/'));
    return Response.json([]);
  }
  if (target.hostname === 'challenges.cloudflare.com') {
    calls.push(['turnstile', init.body.get('remoteip')]);
    if (verification === 'timeout') return abortingFetch(init.signal);
    if (verification === 'bad-json') return new Response('{');
    if (verification === 'upstream-http') return new Response(null, { status: 500 });
    return Response.json(verdict);
  }
  if (target.hostname === 'oauth2.googleapis.com') {
    calls.push(['oauth']);
    if (notification === 'timeout') return abortingFetch(init.signal);
    return Response.json({ access_token: 'fixture' });
  }
  assert.equal(target.hostname, 'gmail.googleapis.com');
  const message = Buffer.from(JSON.parse(init.body).raw, 'base64url').toString('utf8');
  calls.push(['gmail', message]);
  if (notification === 'customer-failure' && message.includes('To: test@example.invalid\r\n')) {
    return new Response(null, { status: 502 });
  }
  return Response.json({});
};

test.beforeEach(() => {
  permit = true;
  verdict = { success: true, hostname: 'coppercustom.com' };
  calls = [];
  stored = [];
  verification = 'ok';
  notification = 'ok';
  env.delete('SEND_CUSTOMER_CONSULTATION_SUMMARY');
});

const payload = {
  customer_name: 'Synthetic Fixture', customer_email: 'test@example.invalid',
  customer_phone: '202-555-0100', preferred_contact_method: 'Email',
  weapon_class: 'Rifle', turnstile_token: 'fixture',
  answers: { schema_version: 1, selections: {
    category: 'Rifle', purpose: 'fixture', budget: 'fixture',
    primary: {}, optics: {}, suppressors: {}, extras: {},
  } },
};
function post(body, headers = {}) {
  return new Request('https://local.invalid', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const client = { origin, 'cf-connecting-ip': '192.0.2.4', 'x-forwarded-for': '203.0.113.8' };

test('gateway identity ignores forwarded headers and rejects invalid or combined IPs', async () => {
  for (const value of ['', '999.1.1.1', '192.0.2.4, 192.0.2.4', 'fe80::1%eth0']) {
    assert.equal(gatewayIp(new Headers({ 'cf-connecting-ip': value, 'x-forwarded-for': '192.0.2.1' }), true), null);
  }
  const headers = new Headers(client);
  assert.equal(gatewayIp(headers, false), null);
  assert.equal(gatewayIp(headers, true), '192.0.2.4');
  assert.equal(gatewayIp(new Headers({ 'cf-connecting-ip': '2001:0db8:0:0::01' }), true), '2001:db8::1');
  assert.notEqual(await limiterHash('192.0.2.4', env.get('BUILDER_RATE_LIMIT_SALT')),
    await limiterHash('192.0.2.4', env.get('CONSULTATION_RATE_LIMIT_SALT')));
});

test('search serves browser and non-browser callers without an auth token', async () => {
  for (const headers of [client, { origin: 'https://www.coppercustom.com' }, {}]) {
    const response = await search(post({ action: 'categories' }, headers));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), headers.origin ?? null);
  }
  assert.match(calls[0][1].p_client_hash, /^[0-9a-f]{64}$/);
  assert.equal(calls[1][1].p_client_hash, null);
  assert.equal(calls[2][1].p_client_hash, null);
  assert.equal((await search(post({ action: 'invalid' }, client))).status, 400);
  assert.equal((await search(post(' '.repeat(4001), client))).status, 413);
});

test('search returns 429 for a denied bucket and 503 for an invalid limiter result', async () => {
  permit = false;
  const response = await search(post({ action: 'categories' }, client));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  permit = null;
  assert.equal((await search(post({ action: 'categories' }, client))).status, 503);
});

test('intake rejects invalid origins, methods and byte limits before the limiter', async () => {
  assert.equal((await intake(post(payload))).status, 403);
  assert.equal((await intake(new Request('https://local.invalid', { headers: client }))).status, 405);
  assert.equal((await intake(post('{}', { ...client, 'content-length': '30001' }))).status, 413);
  assert.equal((await intake(post('é'.repeat(15001), client))).status, 413);
  assert.equal((await intake(post(' '.repeat(30000), client))).status, 400);
  assert.equal(calls.length, 0);
});

test('intake throttles malformed-identity clients before Turnstile and handles limiter failures', async () => {
  permit = false;
  const response = await intake(post(payload, { origin, 'x-forwarded-for': '192.0.2.4' }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '300');
  assert.deepEqual(calls, [['cc_allow_public_request', { p_scope: 'consultation', p_client_hash: null }]]);
  permit = null;
  assert.equal((await intake(post(payload, client))).status, 503);
  assert.equal(stored.length, 0);
});

test('intake reports upstream timeout, bad JSON and HTTP failure as 503', async () => {
  for (const mode of ['timeout', 'bad-json', 'upstream-http']) {
    verification = mode;
    const response = await intake(post(payload, client));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'Verification service unavailable');
  }
  assert.equal(stored.length, 0);
});

test('replayed or wrong-host Turnstile verdicts never write a record', async () => {
  for (const result of [
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { success: true, hostname: 'unapproved.invalid' },
  ]) {
    verdict = result;
    assert.equal((await intake(post(payload, client))).status, 403);
  }
  assert.equal(stored.length, 0);
});

test('successful intake saves once and OAuth timeout preserves the 201', async () => {
  notification = 'timeout';
  const response = await intake(post(payload, client));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, reference: 'synthetic-id' });
  assert.equal(stored.length, 1);
  assert.deepEqual(calls.slice(1), [['turnstile', '192.0.2.4'], ['oauth']]);
});

test('customer summary is opt-in at deployment and uses a separate message', async () => {
  assert.equal((await intake(post(payload, client))).status, 201);
  assert.equal(calls.filter(([kind]) => kind === 'gmail').length, 1);
  calls = [];
  env.set('SEND_CUSTOMER_CONSULTATION_SUMMARY', 'true');
  const response = await intake(post({
    ...payload, answers: { ...payload.answers, summary: [{ label: 'Notes', value: 'Synthetic café' }] },
  }, client));
  assert.equal(response.status, 201);
  assert.equal(calls.filter(([kind]) => kind === 'oauth').length, 1);
  const [sales, customer] = calls.filter(([kind]) => kind === 'gmail').map(([, raw]) => raw);
  assert.match(sales, /To: sales@coppercustom.com/);
  assert.match(customer, /To: test@example.invalid\r\nReply-To: sales@coppercustom.com/);
  assert.match(customer, /Reference: synthetic-id/);
  assert.match(customer, /Notes: Synthetic café/);
  assert.doesNotMatch(customer, /employee dashboard|202-555-0100/);
});

test('customer delivery failure does not affect saved consultation or Sales send', async () => {
  env.set('SEND_CUSTOMER_CONSULTATION_SUMMARY', 'true');
  notification = 'customer-failure';
  assert.equal((await intake(post(payload, client))).status, 201);
  assert.equal(stored.length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'gmail').length, 2);
});

test('customer confirmation never sends an address list', async () => {
  env.set('SEND_CUSTOMER_CONSULTATION_SUMMARY', 'true');
  await intake(post({ ...payload, customer_email: 'one@example.invalid,two@example.invalid' }, client));
  const messages = calls.filter(([kind]) => kind === 'gmail');
  assert.equal(messages.length, 1);
  assert.ok(messages[0][1].includes('To: sales@coppercustom.com\r\n'));
});
