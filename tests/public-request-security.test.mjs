// Generic security regression tests. No network calls, credentials or production writes.
// Run: node --test tests/public-request-security.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Mirrors the deployed public endpoint's current header-selection behavior.
function currentIdentity(headers) {
  return headers['cf-connecting-ip'] || headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}
function digest(salt, identity) { return createHash('sha256').update(salt + ':' + identity).digest('hex'); }

// Proposed fail-closed trust contract: only use a client IP from a gateway-provided,
// independently verified source. Never accept a caller-supplied forwarding header as proof.
function trustedIdentity(headers, verifiedGatewayIp) {
  if (!verifiedGatewayIp) return null;
  return verifiedGatewayIp;
}

test('current implementation selects cf-connecting-ip when present', () => {
  assert.equal(currentIdentity({'cf-connecting-ip':'198.51.100.4','x-forwarded-for':'203.0.113.1'}), '198.51.100.4');
});
test('current implementation accepts a potentially caller-controlled forwarded IP', () => {
  assert.equal(currentIdentity({'x-forwarded-for':'203.0.113.5, 10.0.0.1'}), '203.0.113.5');
});
test('current implementation assigns unknown when headers absent', () => {
  assert.equal(currentIdentity({}), 'unknown');
});
test('unverified headers cannot establish a trusted identity', () => {
  assert.equal(trustedIdentity({'cf-connecting-ip':'198.51.100.4','x-forwarded-for':'203.0.113.5'}, null), null);
});
test('verified gateway identity wins over contradictory forwarded headers', () => {
  assert.equal(trustedIdentity({'x-forwarded-for':'203.0.113.5'}, '192.0.2.10'), '192.0.2.10');
});
test('salted identifiers are stable but do not expose raw address', () => {
  const a=digest('example-test-salt','192.0.2.10');
  assert.equal(a,digest('example-test-salt','192.0.2.10'));
  assert.notEqual(a,digest('example-test-salt','192.0.2.11'));
  assert.match(a,/^[a-f0-9]{64}$/);
});
test('one unknown bucket would incorrectly group unrelated clients', () => {
  assert.equal(currentIdentity({}),currentIdentity({}));
  // This asserts the limitation, not that a shared fallback is production-ready.
});
