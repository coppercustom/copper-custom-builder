import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { Client, Pool } = (await import(process.env.COPPER_TEST_PG_DRIVER ?? 'pg')).default;
const connection = {
  host: '127.0.0.1',
  port: Number(process.env.COPPER_TEST_PG_PORT ?? 55439),
  user: 'postgres',
  password: process.env.COPPER_TEST_PG_PASSWORD ?? '',
  database: 'copper_security_test',
};
const db = new Pool({ ...connection, max: 20 });
const hash = n => n.toString(16).padStart(64, '0');

async function request(scope, identity) {
  const client = await db.connect();
  try {
    await client.query('set role service_role');
    const result = await client.query(
      'select public.cc_allow_public_request($1, $2) as allowed',
      [scope, identity],
    );
    return result.rows[0].allowed;
  } finally {
    try {
      await client.query('reset role');
    } finally {
      client.release();
    }
  }
}

test.before(async () => {
  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query('create database copper_security_test');
    await admin.query('create role anon; create role authenticated; create role service_role bypassrls');
  } finally {
    await admin.end();
  }
  await db.query(await readFile(new URL('./migrations/001_public_request_limits.sql', import.meta.url), 'utf8'));
});
test.after(() => db.end());
test.beforeEach(async () => {
  await db.query('truncate public.cc_public_request_windows');
  // Avoid crossing a real window boundary inside a concurrent assertion.
  const { rows: [{ remaining }] } = await db.query(
    'select 60 - mod(floor(extract(epoch from clock_timestamp()))::int, 60) as remaining',
  );
  if (remaining <= 2) await new Promise(resolve => setTimeout(resolve, remaining * 1000 + 100));
});

test('concurrent per-client bursts allow exactly 60 searches and five intakes', async () => {
  const scopes = [
    { scope: 'search', count: 90, cap: 60 },
    { scope: 'consultation', count: 30, cap: 5 },
  ];
  for (const { scope, count, cap } of scopes) {
    const results = await Promise.all(Array.from({ length: count }, () => request(scope, hash(1))));
    assert.equal(results.filter(Boolean).length, cap);
    assert.equal(await request(scope, hash(2)), true);
  }
});

test('missing-identity caps preserve capacity for valid gateway identities', async () => {
  for (const [scope, cap] of [['search', 180], ['consultation', 20]]) {
    const results = await Promise.all(Array.from({ length: cap + 10 }, () => request(scope, null)));
    assert.equal(results.filter(Boolean).length, cap);
    assert.equal(await request(scope, hash(1)), true);
  }
});

test('the shared ceiling stays atomic across distinct clients', async () => {
  for (const [scope, cap] of [['search', 1200], ['consultation', 120]]) {
    const results = await Promise.all(Array.from({ length: cap + 20 }, (_, n) => request(scope, hash(n))));
    assert.equal(results.filter(Boolean).length, cap);
    const size = await db.query(
      'select count(*)::int as rows from public.cc_public_request_windows where scope = $1', [scope],
    );
    assert.equal(size.rows[0].rows, cap + 1);
  }
});

test('rollover removes prior-window buckets and begins with fresh quotas', async () => {
  assert.equal(await request('search', hash(1)), true);
  await db.query("update public.cc_public_request_windows set attempts = 1200, window_start = window_start - 1");
  assert.equal(await request('search', hash(2)), true);
  const result = await db.query('select bucket, attempts from public.cc_public_request_windows order by bucket');
  assert.deepEqual(result.rows, [{ bucket: hash(2), attempts: 1 }, { bucket: 'global', attempts: 1 }]);
});

test('anonymous and authenticated clients cannot read counters or execute the RPC', async () => {
  for (const role of ['anon', 'authenticated']) {
    const client = await db.connect();
    try {
      await client.query(`set role ${role}`);
      for (const query of [
        'select * from public.cc_public_request_windows',
        "select public.cc_allow_public_request('search', null)",
      ]) {
        await assert.rejects(client.query(query), { code: '42501' });
      }
    } finally {
      try {
        await client.query('reset role');
      } finally {
        client.release();
      }
    }
  }
  await assert.rejects(request('invalid', null), { code: '22023' });
  await assert.rejects(request('search', '192.0.2.1'), { code: '22023' });
});
