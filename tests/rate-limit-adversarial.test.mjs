// Isolated model of the current request identity and atomic per-minute counter.
// This suite does not make HTTP requests or change production state.
// Run: node --test tests/rate-limit-adversarial.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const currentIdentity = headers => headers['cf-connecting-ip'] || headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
const hash = ip => createHash('sha256').update('test-salt:' + ip).digest('hex');
class Counter {
  #counts = new Map();
  allow(identity, minute = 0) {
    const key = minute + ':' + hash(identity);
    const n = (this.#counts.get(key) || 0) + 1;
    this.#counts.set(key, n);
    return n <= 60;
  }
}

test('same identity is limited to 60 requests in one minute', () => {
  const c = new Counter();
  for (let i=0;i<60;i++) assert.equal(c.allow('192.0.2.1'),true);
  assert.equal(c.allow('192.0.2.1'),false);
});
test('new minute starts a new window', () => {
  const c = new Counter();
  for(let i=0;i<61;i++) c.allow('192.0.2.1',0);
  assert.equal(c.allow('192.0.2.1',1),true);
});
test('rotating untrusted forwarded headers bypasses the modeled per-identity limit', () => {
  const c = new Counter();
  let accepted = 0;
  for(let i=0;i<100;i++) {
    const identity = currentIdentity({'x-forwarded-for': '203.0.113.' + (i+1)});
    if(c.allow(identity)) accepted++;
  }
  assert.equal(accepted,100);
  // This proves a conditional weakness in the identity algorithm, NOT that
  // Supabase's managed gateway forwards spoofed headers unchanged.
});
test('missing headers group unrelated modeled clients into one bucket', () => {
  const c = new Counter();
  for(let i=0;i<60;i++) assert.equal(c.allow(currentIdentity({})),true);
  assert.equal(c.allow(currentIdentity({})),false);
});
test('a trusted gateway identity prevents forwarded-header rotation in the model', () => {
  const c = new Counter();
  let accepted=0;
  for(let i=0;i<100;i++) {
    const untrusted = {'x-forwarded-for': '203.0.113.' + (i+1)};
    void untrusted;
    if(c.allow('192.0.2.44')) accepted++;
  }
  assert.equal(accepted,60);
});
